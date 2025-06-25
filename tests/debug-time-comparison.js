import knex from 'knex';
import config from '../config/index.js';

console.log('Debugging time comparison...');

// Determine if we're connecting to AWS RDS
const isAWSRDS = config.DB_HOST && config.DB_HOST.includes('rds.amazonaws.com');

const db = knex({
  client: 'postgresql',
  connection: {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: isAWSRDS ? {
      rejectUnauthorized: false,
      require: true
    } : (config.SHADOW_DB_SSL ? { rejectUnauthorized: false } : false)
  }
});

async function debugTimeComparison() {
  try {
    // Calculate time range (1 hour ago to 12 hours from now)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (1 * 60 * 60 * 1000));
    const twelveHoursFromNow = new Date(now.getTime() + (12 * 60 * 60 * 1000));

    console.log('Current time (now):', now.toISOString());
    console.log('One hour ago:', oneHourAgo.toISOString());
    console.log('Twelve hours from now:', twelveHoursFromNow.toISOString());
    console.log('Time range:', `${oneHourAgo.toISOString()} to ${twelveHoursFromNow.toISOString()}`);

    // Get all fixtures to see what's in the database
    const allFixtures = await db('soccer_2025_fixtures')
      .select('id', 'date_time', 'processed', 'home_team', 'away_team')
      .orderBy('date_time', 'asc');

    console.log('\nAll fixtures in database:');
    allFixtures.forEach(fixture => {
      console.log(`- ${fixture.id}: ${fixture.date_time} (processed: ${fixture.processed}) - ${fixture.home_team} vs ${fixture.away_team}`);
    });

    // Test the query that should find the fixture (using the updated logic)
    const matchingFixtures = await db('soccer_2025_fixtures')
      .select('*')
      .where('date_time', '>=', oneHourAgo)
      .where('date_time', '<=', twelveHoursFromNow)
      .where('processed', false)
      .orderBy('date_time', 'asc');

    console.log('\nFixtures matching the updated query criteria:');
    console.log(`Found ${matchingFixtures.length} fixtures`);
    matchingFixtures.forEach(fixture => {
      console.log(`- ${fixture.id}: ${fixture.date_time} - ${fixture.home_team} vs ${fixture.away_team}`);
    });

    // Check if the specific fixture exists and its processed status
    const specificFixture = await db('soccer_2025_fixtures')
      .select('*')
      .where('id', 'mat_20250124_001')
      .first();

    if (specificFixture) {
      console.log('\nSpecific fixture details:');
      console.log(`- ID: ${specificFixture.id}`);
      console.log(`- Date/Time: ${specificFixture.date_time}`);
      console.log(`- Processed: ${specificFixture.processed}`);
      console.log(`- Is >= oneHourAgo: ${new Date(specificFixture.date_time) >= oneHourAgo}`);
      console.log(`- Is <= twelveHoursFromNow: ${new Date(specificFixture.date_time) <= twelveHoursFromNow}`);
      console.log(`- Would be included: ${new Date(specificFixture.date_time) >= oneHourAgo && new Date(specificFixture.date_time) <= twelveHoursFromNow && !specificFixture.processed}`);
      
      // Test individual conditions
      console.log('\nTesting individual query conditions:');
      
      // Test processed = false
      const processedTest = await db('soccer_2025_fixtures')
        .where('id', 'mat_20250124_001')
        .where('processed', false)
        .first();
      console.log(`- processed = false: ${processedTest ? 'PASS' : 'FAIL'}`);
      
      // Test date_time >= oneHourAgo
      const timeLowerTest = await db('soccer_2025_fixtures')
        .where('id', 'mat_20250124_001')
        .where('date_time', '>=', oneHourAgo)
        .first();
      console.log(`- date_time >= oneHourAgo: ${timeLowerTest ? 'PASS' : 'FAIL'}`);
      
      // Test date_time <= twelveHoursFromNow
      const timeUpperTest = await db('soccer_2025_fixtures')
        .where('id', 'mat_20250124_001')
        .where('date_time', '<=', twelveHoursFromNow)
        .first();
      console.log(`- date_time <= twelveHoursFromNow: ${timeUpperTest ? 'PASS' : 'FAIL'}`);
      
    } else {
      console.log('\nSpecific fixture not found!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.destroy();
  }
}

debugTimeComparison(); 