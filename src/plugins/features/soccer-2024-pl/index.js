import createFixtureSchema from '../../validators/soccer-2024-pl/CreateFixture.js';
import {
  findUpcomingFixtures,
  postFixture,
  findAllFixtures,
} from './controller.js';

const register = async (server, options) => {
  server.route({
    method: 'GET',
    path: '/soccer-2024-pl',
    handler: async (request, h) => {
      return await findUpcomingFixtures(request, h);
    },
  });

  server.route({
    method: 'POST',
    path: '/soccer-2024-pl',
    handler: async (request, h) => {
      return await postFixture(request.payload, h);
    },
    options: {
      validate: {
        payload: createFixtureSchema,
      },
    },
  });

  // add route to get all fixtures

  server.route({
    method: 'GET',
    path: '/soccer-2024-pl/fixtures',
    handler: async (request, h) => {
      return await findAllFixtures(request, h);
    },
  });
};

// Defining the plugin name
const name = 'soccer-2024-pl';

// Export both as named exports
export const plugin = { register, name };
export { name };
