import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import logger from '../../../../lib/logger.js';
const sqsClient = new SQSClient({ region: 'us-west-2' });
import dotenv from 'dotenv';
dotenv.config();
const queueUrl = process.env.SQS_QUEUE_URL;

export const postToQueue = async (fixture) => {
  const fixtureTime = new Date(fixture.date_time);
  //subtract 1 hour from the game time
  // so if game time is at 2PM, messageInformTime at the moment is 1 hour befor the game.
  const messageInformTime = new Date(fixtureTime.getTime() - 60 * 60 * 1000);
  const params = {
    MessageBody: JSON.stringify({
      ...fixture,
      messageInformTime: messageInformTime.toISOString(),
    }),
    QueueUrl: queueUrl,
  };

  try {
    await sqsClient.send(new SendMessageCommand(params));
    logger.info('Successfully sent message to SQS', {
      fixtureId: fixture.id,
      messageInformTime: messageInformTime.toISOString(),
      queueUrl,
    });
  } catch (error) {
    logger.error('Failed to send message to SQS', {
      error: error.message,
      fixtureId: fixture.id,
      queueUrl,
    });
    throw error;
  }
};

// helper function to find today fixtures
export const findTodayFixtures = async (currentDate, FixturesTable) => {
  const dateString = currentDate.toISOString().split('T')[0];
  logger.info('Finding fixtures for date', { date: dateString });

  // query the database to retrieve fixtures that have `date` as currentDate
  const fixturesToday = await FixturesTable().where('date', dateString);

  logger.info('Found fixtures for date', {
    date: dateString,
    count: fixturesToday.length,
  });

  return fixturesToday;
};
