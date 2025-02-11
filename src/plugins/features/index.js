import { configureServer } from './server.js';

const startServer = async () => {
  try {
    const server = await configureServer();
    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();
