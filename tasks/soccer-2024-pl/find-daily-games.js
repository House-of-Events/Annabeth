// handlers/dailyFixtures.js
import knex from 'knex';
import knexConfig from "./knexfile.js"
import { findTodayFixtures, postToQueue } from "./src/plugins/features/soccer-2024-pl/helper.js";
import logger from '../../lib/logger.js';

// Create database connection with connection testing
const createDatabaseConnection = async () => {    
    // Log connection details (excluding sensitive info)
    const connConfig = knexConfig.production.connection();

    const db = knex({
        ...knexConfig.production,
        connection: connConfig
    });

    try {
        // Test the connection
        await db.raw('SELECT 1');
        logger.info('Database connection test successful');
        return db;
    } catch (error) {
        logger.error('Database connection test failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

const getPSTDate = () => {
    return new Date(new Date().toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }));
};

const addToSQSQueue = async (fixtures) => {
    try {
        // Process fixtures in parallel for better performance
        await Promise.all(fixtures.map(fixture => postToQueue(fixture)));
        logger.info('Successfully added fixtures to SQS queue', {
            fixtureCount: fixtures.length
        });
    } catch (err) {
        logger.error('Error posting to SQS', {
            error: err.message,
            stack: err.stack,
            fixtureCount: fixtures.length
        });
        throw err;
    }
};

export const handler = async (event, context) => {
    let database = null;
    const startTime = Date.now();
    
    try {
        logger.info('Handler started');
        context.callbackWaitsForEmptyEventLoop = false;
        
        logger.info('Attempting database connection');
        database = await createDatabaseConnection();
        logger.info('Database connection established');
        
        const FixturesTable = () => database('soccer_2024_pl_fixtures');
        
        const currentDateInPST = getPSTDate();
        logger.info('Checking fixtures for date', { currentDateInPST });
        
        const fixturesToday = await findTodayFixtures(currentDateInPST, FixturesTable);
        logger.info('Found fixtures for today', {
            fixtureCount: fixturesToday.length,
            fixtures: fixturesToday.map(f => ({ id: f.id, home_team: f.home_team, away_team: f.away_team }))
        });
        
        if (fixturesToday.length === 0) {
            logger.info('No fixtures found - returning early');
            const response = {
                statusCode: 200,
                body: JSON.stringify({ message: 'No fixtures found' })
            };
            logger.info('Returning response', { response });
            return response;
        }
        
        logger.info('Adding fixtures to SQS queue');
        await addToSQSQueue(fixturesToday);
        
        const response = {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Successfully processed fixtures',
                count: fixturesToday.length 
            })
        };
        logger.info('Success response', { response });
        return response;

    } catch (error) {
        logger.error('Handler execution failed', {
            error: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            processingTimeMs: Date.now() - startTime
        });
        
        const errorResponse = {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                type: error.name,
                code: error.code 
            })
        };
        logger.info('Error response', { errorResponse });
        return errorResponse;

    } finally {
        if (database) {
            try {
                logger.info('Attempting to close database connection');
                await database.destroy();
                logger.info('Database connection closed successfully');
            } catch (err) {
                logger.error('Failed to close database connection', {
                    error: err.message,
                    stack: err.stack
                });
            }
        }
        logger.info('Handler execution completed', {
            processingTimeMs: Date.now() - startTime
        });
    }
};