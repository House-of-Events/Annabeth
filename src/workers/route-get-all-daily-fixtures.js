import knex from 'knex';
import config from '../../config/index.js';
import newSQSClient from '../../lib/sqs.js';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

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
  console.log("Processing fixtures for next 1 hour")
  try {
    // Calculate time range (now to 1 hour from now) in UTC
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + (1 * 60 * 60 * 1000));

    console.log(`Current time (UTC): ${now.toISOString()}`);
    console.log(`Looking for fixtures between ${now.toISOString()} and ${oneHourFromNow.toISOString()}`);

    // Query the unified fixtures table for unprocessed fixtures in the time range
    const fixtures = await db('fixtures')
      .select('*')
      .where('processed', false)
      .where('date_deleted', null)
      .where('date_time', '>=', now)
      .where('date_time', '<=', oneHourFromNow)
      .orderBy('date_time', 'asc');

    console.log(`Found ${fixtures.length} fixtures to process`);

    // Group fixtures by sport type for logging
    const fixturesBySport = fixtures.reduce((acc, fixture) => {
      const sportType = fixture.sport_type;
      if (!acc[sportType]) {
        acc[sportType] = [];
      }
      acc[sportType].push(fixture);
      return acc;
    }, {});

    // Log counts by sport type
    Object.entries(fixturesBySport).forEach(([sportType, sportFixtures]) => {
      console.log(`Found ${sportFixtures.length} ${sportType} fixtures to process`);
    });

    // Process all fixtures
    if (fixtures.length > 0) {
      console.log('Processing fixtures...');
      for (const fixture of fixtures) {
        await processFixture(fixture);
      }
    }

    // Mark fixtures as processed
    if (fixtures.length > 0) {
      await markFixturesAsProcessed(fixtures);
    }

    console.log('Fixtures processing completed successfully');
  } catch (error) {
    console.error('Error processing fixtures:', error);
    throw error;
  } finally {
    // Close database connection
    await db.destroy();
  }
}

async function processFixture(fixture) {
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

    console.log(`Successfully queued ${fixture.sport_type} fixture ${fixture.id}`);
  } catch (error) {
    console.error(`Error processing ${fixture.sport_type} fixture ${fixture.id}:`, error);
    throw error;
  }
}

async function markFixturesAsProcessed(fixtures) {
  try {
    const fixtureIds = fixtures.map((f) => f.id);
    await db('fixtures').whereIn('id', fixtureIds).update({
      processed: true,
      date_processed: new Date(),
    });
  } catch (error) {
    console.error('Error marking fixtures as processed:', error);
    throw error;
  }
}

// Run the script
processAllDailyFixtures()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
