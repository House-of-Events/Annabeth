import knex from 'knex';
import config from '../config/index.js';

console.log('Testing database connection...');
console.log('Config:', {
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  ssl: config.SHADOW_DB_SSL
});

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

async function testConnection() {
  try {
    console.log('Attempting to connect to database...');
    await db.raw('SELECT 1 as test');
    console.log('✅ Database connection successful!');
    
    // Test if tables exist
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Available tables:', tables.rows.map(row => row.table_name));
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      severity: error.severity,
      hint: error.hint
    });
  } finally {
    await db.destroy();
  }
}

testConnection(); 