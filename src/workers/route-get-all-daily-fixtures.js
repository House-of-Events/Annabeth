import knex from 'knex';
import config from '../../config/index.js';
import newSQSClient from '../../lib/sqs.js';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import logger from '../../lib/logger.js';

// Determine if we're connecting to AWS RDS (hostname contains 'rds.amazonaws.com')
const isAWSRDS = config.DB_HOST && config.DB_HOST.includes('rds.amazonaws.com');

// Create Knex connection using config
const db = knex({
  client: 'postgresql',
  connection: {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: isAWSRDS
      ? {
          rejectUnauthorized: false,
          require: true,
        }
      : config.SHADOW_DB_SSL
        ? { rejectUnauthorized: false }
        : false,
  },
  pool: {
    min: 2,
    max: 10,
  },
});

async function processAllDailyFixtures() {
  const startTime = Date.now();
  logger.info('Starting daily fixtures processing', {
    timestamp: new Date().toISOString(),
    timeRange: '1 hour',
  });

  try {
    // Calculate time range (now to 1 hour from now) in UTC
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    logger.info('Processing time range', {
      currentTime: now.toISOString(),
      endTime: oneHourFromNow.toISOString(),
      timeRangeMinutes: 60,
    });

    // Query the unified fixtures table for unprocessed fixtures in the time range
    const fixtures = await db('fixtures')
      .select('*')
      .where('processed', false)
      .where('date_deleted', null)
      .where('date_time', '>=', now)
      .where('date_time', '<=', oneHourFromNow)
      .orderBy('date_time', 'asc');

    logger.info('Found fixtures to process', {
      totalFixtures: fixtures.length,
      timeRange: `${now.toISOString()} to ${oneHourFromNow.toISOString()}`,
    });

    // Group fixtures by sport type for detailed logging
    const fixturesBySport = fixtures.reduce((acc, fixture) => {
      const sportType = fixture.sport_type;
      if (!acc[sportType]) {
        acc[sportType] = [];
      }
      acc[sportType].push(fixture);
      return acc;
    }, {});

    // Log detailed breakdown by sport type
    Object.entries(fixturesBySport).forEach(([sportType, sportFixtures]) => {
      logger.info('Sport fixtures breakdown', {
        sportType,
        count: sportFixtures.length,
        fixtureIds: sportFixtures.map((f) => f.id),
      });
    });

    // Process all fixtures
    if (fixtures.length > 0) {
      logger.info('Starting fixture processing', {
        totalFixtures: fixtures.length,
      });

      const processingResults = {
        successful: 0,
        failed: 0,
        errors: [],
      };

      for (const fixture of fixtures) {
        try {
          await processFixture(fixture);
          processingResults.successful++;
        } catch (error) {
          processingResults.failed++;
          processingResults.errors.push({
            fixtureId: fixture.id,
            sportType: fixture.sport_type,
            error: error.message,
          });
          logger.error('Failed to process fixture', {
            fixtureId: fixture.id,
            sportType: fixture.sport_type,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      logger.info('Fixture processing completed', {
        successful: processingResults.successful,
        failed: processingResults.failed,
        totalProcessed: fixtures.length,
      });

      // Mark fixtures as processed
      await markFixturesAsProcessed(fixtures);
    } else {
      logger.info('No fixtures found to process');
    }

    const processingTime = Date.now() - startTime;
    logger.info('Daily fixtures processing completed successfully', {
      processingTimeMs: processingTime,
      fixturesProcessed: fixtures.length,
    });
  } catch (error) {
    logger.error('Error processing daily fixtures', {
      error: error.message,
      stack: error.stack,
      processingTimeMs: Date.now() - startTime,
    });
    throw error;
  } finally {
    // Close database connection
    try {
      await db.destroy();
      logger.info('Database connection closed successfully');
    } catch (error) {
      logger.error('Error closing database connection', {
        error: error.message,
      });
    }
  }
}

async function processFixture(fixture) {
  const startTime = Date.now();

  logger.info('Processing fixture', {
    fixtureId: fixture.id,
    sportType: fixture.sport_type,
    matchId: fixture.match_id,
    dateTime: fixture.date_time?.toISOString(),
  });

  try {
    // Initialize SQS client
    const sqsClient = newSQSClient();

    // Send fixture to SQS queue for further processing
    const messageBody = {
      fixture_id: fixture.id,
      fixture_type: fixture.sport_type,
      fixture_data: fixture.fixture_data,
      match_id: fixture.match_id,
      date_time: fixture.date_time,
      processed_at: new Date().toISOString(),
    };

    // Send to SQS queue using AWS SDK v3
    const command = new SendMessageCommand({
      QueueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
    });

    await sqsClient.send(command);

    const processingTime = Date.now() - startTime;
    logger.info('Successfully queued fixture', {
      fixtureId: fixture.id,
      sportType: fixture.sport_type,
      processingTimeMs: processingTime,
      queueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Error processing fixture', {
      fixtureId: fixture.id,
      sportType: fixture.sport_type,
      error: error.message,
      processingTimeMs: processingTime,
      queueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
    });
    throw error;
  }
}

async function markFixturesAsProcessed(fixtures) {
  const startTime = Date.now();

  logger.info('Marking fixtures as processed', {
    fixtureCount: fixtures.length,
    fixtureIds: fixtures.map((f) => f.id),
  });

  try {
    const fixtureIds = fixtures.map((f) => f.id);
    const result = await db('fixtures').whereIn('id', fixtureIds).update({
      processed: true,
      date_processed: new Date(),
    });

    const processingTime = Date.now() - startTime;
    logger.info('Successfully marked fixtures as processed', {
      updatedCount: result,
      fixtureCount: fixtures.length,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Error marking fixtures as processed', {
      error: error.message,
      fixtureCount: fixtures.length,
      processingTimeMs: processingTime,
    });
    throw error;
  }
}

// Run the script
processAllDailyFixtures()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
