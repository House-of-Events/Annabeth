// going ot be a cron job that runs at 1200AM everyday
import knex from 'knex';

import knexConfig from "../../knexfile.js";
import { findTodayFixtures, postToQueue } from "../../src/plugins/features/soccer-2024-pl/helper.js";

//change to prod during deployment
const database = knex(knexConfig.development);
const FixturesTable = () => database('soccer_2024_pl_fixtures');

// get all the fixtures that are not in the SQS queue and are scheduled for the day.
const findDailyGames = async () => {
    const options = { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' };
    const currentDateInPST = new Date(new Date().toLocaleString('en-US', options));
    const fixturesToday = await findTodayFixtures(currentDateInPST, FixturesTable);
    for (const fixture of fixturesToday) {
        await addToSQSQueue(fixture);
    }
    return;
    
}

const addToSQSQueue = async (fixture) => {
    console.log(`Fixture to be added to queue: ${fixture}`);
    try {
        await postToQueue(fixture);
    } catch (err) {
        console.error(err);
        throw err;
    }
}
await findDailyGames();   