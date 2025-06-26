import { execSync } from 'child_process';

// Get secrets from Chamber
// In config/development.js
function getChamberSecrets(service) {
    const requiredKeys = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY', 
      'sqs_get_all_fixtures_from_db_daily_queue_url',
      'sqs_fixtures_daily_queue_url',
      'db_host',
      'db_port',
      'db_name',
      'db_username',
      'db_password'
    ];
    
    const secrets = {};
    
    requiredKeys.forEach(key => {
      try {
        const value = execSync(`chamber read ${service} ${key} -q`).toString().trim();
        secrets[key] = value;
      } catch (error) {
        console.error(`Error reading ${key} from ${service}:`, error.message);
        process.exit(1);
      }
    });
    return secrets;
  }

const appSecrets = getChamberSecrets('app-aws');
export default {
    // Database Configuration
    DB_HOST: appSecrets.db_host || 'localhost',
    DB_PORT: appSecrets.db_port || 5432,
    DB_NAME: appSecrets.db_name || 'fixtures_daily',
    DB_USER: appSecrets.db_username || 'postgres',
    DB_PASSWORD: appSecrets.db_password || 'postgres',
    SQS_GET_ALL_FIXTURES_FROM_DB_DAILY_QUEUE_URL: appSecrets.sqs_get_all_fixtures_from_db_daily_queue_url,
    SQS_FIXTURES_DAILY_QUEUE_URL: appSecrets.sqs_fixtures_daily_queue_url,
    
    // SSL Configuration - Enable SSL for AWS RDS
    SHADOW_DB_SSL: process.env.SHADOW_DB_SSL !== 'false',
};
