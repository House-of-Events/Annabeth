// handlers/dailyFixtures.js
import knex from 'knex';
import knexConfig from "./knexfile.js"
import { findTodayFixtures, postToQueue } from "./src/plugins/features/soccer-2024-pl/helper.js";
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
        console.log('Database connection test successful');
        return db;
    } catch (error) {
        console.error('Database connection test failed:', error);
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
    } catch (err) {
        console.error('Error posting to SQS:', err);
        throw err;
    }
};

export const handler = async (event, context) => {
    let database = null;
    
    try {
        console.log('Handler started');
        context.callbackWaitsForEmptyEventLoop = false;
        
        console.log('Attempting database connection...');
        database = await createDatabaseConnection();
        console.log('Database connection established');
        
        const FixturesTable = () => database('soccer_2024_pl_fixtures');
        
        const currentDateInPST = getPSTDate();
        console.log('Checking fixtures for date:', currentDateInPST);
        
        const fixturesToday = await findTodayFixtures(currentDateInPST, FixturesTable);
        console.log('Number of fixtures found:', fixturesToday.length);
        console.log("Fixtures found:", fixturesToday);
        if (fixturesToday.length === 0) {
            console.log('No fixtures found - returning early');
            const response = {
                statusCode: 200,
                body: JSON.stringify({ message: 'No fixtures found' })
            };
            console.log('Response:', response);
            return response;
        }
        
        console.log('Adding fixtures to SQS queue...');
        await addToSQSQueue(fixturesToday);
        console.log('Successfully added to SQS queue');
        
        const response = {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Successfully processed fixtures',
                count: fixturesToday.length 
            })
        };
        console.log('Success response:', response);
        return response;

    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        const errorResponse = {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                type: error.name,
                code: error.code 
            })
        };
        console.log('Error response:', errorResponse);
        return errorResponse;

    } finally {
        if (database) {
            try {
                console.log('Attempting to close database connection...');
                await database.destroy();
                console.log('Database connection closed successfully');
            } catch (err) {
                console.error('Failed to close database connection:', {
                    message: err.message,
                    stack: err.stack
                });
            }
        }
        console.log('Handler execution completed');
    }
};