export default {
  // Database Configuration for local PostgreSQL
  DB_HOST: 'localhost',
  DB_PORT: 5433,
  DB_NAME: 'fixtures_daily',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  
  // LocalStack SQS URLs
  SQS_GET_ALL_FIXTURES_FROM_DB_DAILY_QUEUE_URL: 'http://localhost:4567/000000000000/fixtures-daily-queue',
  SQS_FIXTURES_DAILY_QUEUE_URL: 'http://localhost:4567/000000000000/fixtures-daily-queue',
  
  // SSL Configuration - Disabled for local development
  SHADOW_DB_SSL: false,
  
  // LocalStack configuration
  AWS_ENDPOINT: 'http://localhost:4567',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
}; 