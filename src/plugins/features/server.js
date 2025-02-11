import Hapi from '@hapi/hapi';
import { plugin as soccerPlugin } from './soccer-2024-pl/index.js';

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
  console.log('Routes registration function executed');
};

const configureServer = async () => {
  await registerRoutes(server);
  console.log('Routes registered');
  return server;
};

export { configureServer };
