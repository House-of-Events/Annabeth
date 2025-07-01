import knex from 'knex';
import config from '../../config/local.js';
import newSQSClient from '../../lib/sqs-local.js';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

// Create SQS queue first 
// aws --endpoint-url=http://localhost:4567 sqs create-queue \
//     --queue-name fixtures-daily-queue \
//     --region us-east-1

// Create tables first 
// -- Create fixtures table
// CREATE TABLE IF NOT EXISTS fixtures (
//     id SERIAL PRIMARY KEY,
//     sport_type VARCHAR(50) NOT NULL,
//     fixture_data JSONB NOT NULL,
//     date_time TIMESTAMP WITH TIME ZONE NOT NULL,
//     match_id VARCHAR(255) NOT NULL,
//     processed BOOLEAN DEFAULT FALSE,
//     date_processed TIMESTAMP WITH TIME ZONE,
//     date_deleted TIMESTAMP WITH TIME ZONE,
//     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
//     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
// );

// Insert some data into the fixtures table
// INSERT INTO fixtures (sport_type, fixture_data, date_time, match_id, processed) VALUES
// (
//     'football',
//     '{"home_team": "Arsenal", "away_team": "Chelsea", "competition": "Premier League", "venue": "Emirates Stadium"}',
//     NOW() + INTERVAL '30 minutes',
//     'soc_ars_che_02042000',
//     false
// ),
// (
//     'basketball',
//     '{"home_team": "Lakers", "away_team": "Warriors", "competition": "NBA", "venue": "Crypto.com Arena"}',
//     NOW() + INTERVAL '45 minutes',
//     'soc_lak_war_02042000',
//     false
// ),
// (
//     'tennis',
//     '{"player1": "Djokovic", "player2": "Nadal", "competition": "Wimbledon", "court": "Centre Court"}',
//     NOW() + INTERVAL '15 minutes',
//     'ten_djn_nar_02042000',
//     false
// ),
// (
//     'cricket',
//     '{"home_team": "England", "away_team": "Australia", "competition": "Ashes", "venue": "Lords"}',
//     NOW() + INTERVAL '20 minutes',
//     'cri_eng_aus_02042000',
//     false
// );

// -- Fixtures outside the time range (should not be processed)
// INSERT INTO fixtures (sport_type, fixture_data, date_time, match_id, processed) VALUES
// (
//     'football',
//     '{"home_team": "Manchester United", "away_team": "Liverpool", "competition": "Premier League", "venue": "Old Trafford"}',
//     NOW() + INTERVAL '2 hours',
//     'soc_man_liv_02042000',
//     false
// ),
// (
//     'basketball',
//     '{"home_team": "Celtics", "away_team": "Heat", "competition": "NBA", "venue": "TD Garden"}',
//     NOW() - INTERVAL '1 hour',
//     'bas_cel_hea_02042000',
//     false
// );


// Create Knex connection using local config
const db = knex({
  client: 'postgresql',
  connection: {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: false, // No SSL for local development
  },
  pool: {
    min: 2,
    max: 10,
  },
});

async function processAllDailyFixtures() {
  console.log("Processing fixtures for next 1 hour (LOCAL MODE)")
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
      match_id: fixture.match_id,
      fixture_type: fixture.sport_type,
      date_time: fixture.date_time,
      fixture_data: fixture.fixture_data,
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
    console.log(`Marked ${fixtures.length} fixtures as processed`);
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