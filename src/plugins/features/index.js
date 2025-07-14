import { configureServer } from './server.js';
import logger from '../../../lib/logger.js';

const startServer = async () => {
  try {
    const server = await configureServer();
    await server.start();
    logger.info('Server started successfully', {
      uri: server.info.uri,
      port: server.info.port,
    });
  } catch (error) {
    logger.error('Error starting server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startServer();
