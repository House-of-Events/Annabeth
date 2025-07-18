import knex from 'knex';
import knexConfig from '../../../../knexfile.js';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import logger from '../../../../lib/logger.js';
// const database = knex(knexConfig.development);
const sqsClient = new SQSClient({ region: 'us-west-2' });
const queueUrl = process.env.SQS_QUEUE_URL;

// const FixturesTable = () => database('soccer_2024_pl_fixtures');

export const findUpcomingFixtures = async (req, res) => {
  try {
    logger.info('Processing findUpcomingFixtures request');
    const now = new Date();
    const currentTimePST = now.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
    });
    const oneHourFromNowPST = new Date(
      now.getTime() + 60 * 60 * 1000
    ).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });

    // const upcomingFixtures = await FixturesTable()
    //     .select('*')
    //     .where('informed', false)
    //     .andWhere('date_time', '>=', currentTimePST)
    //     .andWhere('date_time', '<', oneHourFromNowPST);

    const upcomingFixtures = [
      {
        id: 'mat_041002',
        fixture_id: 'fix_962162',
        match_id: '2025-01-25-BOU-NFO',
        home_team: 'Bournemouth',
        away_team: "Nott'm Forest",
        venue: 'Vitality Stadium, Bournemouth',
        date: '2025-01-25',
        time: '07:00',
        date_time: '2025-01-25 07:00:00+00',
        date_created: '2025-01-21 03:43:12.926682+00',
        league: 'Premier League',
        informed: false,
        notification_sent_at: null,
      },
    ];

    logger.info('Processing upcoming fixtures', {
      fixtureCount: upcomingFixtures.length,
      currentTimePST,
      oneHourFromNowPST,
    });

    // Sent fixtures to SQS queue
    for (const fixture of upcomingFixtures) {
      const fixtureTime = new Date(fixture.date_time);
      const messageInformTime = new Date(
        fixtureTime.getTime() - 60 * 60 * 1000
      );

      const params = {
        MessageBody: JSON.stringify({
          ...fixture,
          messageInformTime: messageInformTime.toISOString(),
        }),
        QueueUrl: queueUrl,
      };

      try {
        await sqsClient.send(new SendMessageCommand(params));
        logger.info('Successfully sent fixture to SQS', {
          fixtureId: fixture.id,
          matchId: fixture.match_id,
          messageInformTime: messageInformTime.toISOString(),
        });
      } catch (error) {
        logger.error('Failed to send message to SQS', {
          error: error.message,
          fixtureId: fixture.id,
          matchId: fixture.match_id,
          queueUrl,
        });
        throw error;
      }
    }

    // // mark all the upcoming fixtures as informed
    // if (upcomingFixtures.length > 0) {
    //     await FixturesTable()
    //         .whereIn('id', upcomingFixtures.map(fixture => fixture.id))
    //         .update({ informed: true, notification_sent_at: currentTimePST });
    // }

    // // send notifcations to the users for the upcoming fixtures

    logger.info('Successfully processed upcoming fixtures', {
      fixtureCount: upcomingFixtures.length,
    });

    return res.response(upcomingFixtures).code(200);
  } catch (error) {
    logger.error('Database query error in findUpcomingFixtures', {
      error: error.message,
      stack: error.stack,
    });
    return res
      .response({
        error: 'Failed to retrieve upcoming fixtures',
        details: error.message,
      })
      .code(500);
  }
};

export const postFixture = async (payload, res) => {
  const { home_team, away_team, venue, date, time } = payload;
  const match_id = `${date}-${home_team}-${away_team}`;
  // date is in date type, time is in string type. We need to combine them to create a date_time field with timestamp type
  const date_time = `${date} ${time}:00+00`;

  logger.info('Creating new fixture', {
    homeTeam: home_team,
    awayTeam: away_team,
    venue,
    date,
    time,
    matchId: match_id,
  });

  await FixturesTable().insert({
    fixture_id: `fix_${Math.floor(Math.random() * 1000000)}`,
    match_id,
    home_team,
    away_team,
    venue,
    date,
    time,
    date_time,
    date_created: new Date().toISOString(),
    informed: false,
    notification_sent_at: null,
  });

  return res.response(body).code(200);
};

export const findAllFixtures = async (req, res) => {
  const env =
    req.headers['x-env'] === 'production' ? 'production' : 'development';
  const database = knex(knexConfig[env]);

  logger.info('Processing findAllFixtures request', { environment: env });

  try {
    const soccer_table = database('soccer_2024_pl_fixtures');
    const fixtures = await soccer_table.select('*');

    logger.info('Successfully retrieved all fixtures', {
      fixtureCount: fixtures.length,
      environment: env,
    });

    return res.response(fixtures).code(200);
  } catch (error) {
    logger.error('Database query error in findAllFixtures', {
      error: error.message,
      stack: error.stack,
      environment: env,
    });
    return res
      .response({
        error: 'Failed to retrieve upcoming fixtures',
        details: error.message,
      })
      .code(500);
  }
};
