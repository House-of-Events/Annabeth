import Hapi from '@hapi/hapi';
import { plugin as soccerPlugin } from './soccer-2024-pl/index.js';
import logger from '../../../lib/logger.js';

const server = Hapi.server({
  port: 3001,
  host: 'localhost',
  router: {
    stripTrailingSlash: true,
  },
});

const registerRoutes = async (server) => {
  await server.register({
    plugin: soccerPlugin,
  });
  logger.info('Routes registration function executed');
};

const configureServer = async () => {
  await registerRoutes(server);
  logger.info('Routes registered successfully');
  return server;
};

export { configureServer };
