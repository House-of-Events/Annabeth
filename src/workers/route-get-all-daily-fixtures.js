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

    // Query both tables in parallel
    const [soccerFixtures, f1Fixtures] = await Promise.all([
      // Query soccer_2025_fixtures table
      db('soccer_2025_fixtures')
        .select('*')
        .where('date_time', '>=', now)
        .where('date_time', '<=', oneHourFromNow)
        .where('processed', false)
        .orderBy('date_time', 'asc'),

      // Query f1_2025_fixtures table
      db('f1_2025_fixtures')
        .select('*')
        .where('date_time', '>=', now)
        .where('date_time', '<=', oneHourFromNow)
        .where('processed', false)
        .orderBy('date_time', 'asc'),
    ]);

    console.log(`Found ${soccerFixtures.length} soccer fixtures to process`);
    console.log(`Found ${f1Fixtures.length} F1 fixtures to process`);

    // Process soccer fixtures
    if (soccerFixtures.length > 0) {
      console.log('Processing soccer fixtures...');
      for (const fixture of soccerFixtures) {
        await processFixture(fixture, 'soccer');
      }
    }

    // Process F1 fixtures
    if (f1Fixtures.length > 0) {
      console.log('Processing F1 fixtures...');
      for (const fixture of f1Fixtures) {
        await processFixture(fixture, 'f1');
      }
    }

    // Mark fixtures as processed
    if (soccerFixtures.length > 0 || f1Fixtures.length > 0) {
      await markFixturesAsProcessed(soccerFixtures, f1Fixtures);
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

async function processFixture(fixture, type) {
  try {
    // Initialize SQS client
    const sqsClient = newSQSClient();

    // Send fixture to SQS queue for further processing
    const messageBody = {
      fixture_id: fixture.id,
      fixture_type: type,
      fixture_data: fixture,
      processed_at: new Date().toISOString(),
    };

    // Send to SQS queue using AWS SDK v3
    const command = new SendMessageCommand({
      QueueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
    });

    await sqsClient.send(command);

    console.log(`Successfully queued ${type} fixture ${fixture.id}`);
  } catch (error) {
    console.error(`Error processing ${type} fixture ${fixture.id}:`, error);
    throw error;
  }
}

async function markFixturesAsProcessed(soccerFixtures, f1Fixtures) {
  try {
    // Mark soccer fixtures as processed
    if (soccerFixtures.length > 0) {
      const soccerIds = soccerFixtures.map((f) => f.id);
      await db('soccer_2025_fixtures').whereIn('id', soccerIds).update({
        processed: true,
        date_processed: new Date(),
      });
    }

    // Mark F1 fixtures as processed
    if (f1Fixtures.length > 0) {
      const f1Ids = f1Fixtures.map((f) => f.id);
      await db('f1_2025_fixtures').whereIn('id', f1Ids).update({
        processed: true,
        date_processed: new Date(),
      });
    }
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
