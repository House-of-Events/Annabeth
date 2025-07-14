const environment = process.env.NODE_ENV || 'development';
import logger from '../lib/logger.js';
logger.info('Loading application configuration', { environment });
const config = (await import(`./${environment}.js`)).default;
export default config;