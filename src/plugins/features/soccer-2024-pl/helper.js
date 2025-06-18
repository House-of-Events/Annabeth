import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
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
  } catch (error) {
    console.error('Failed to send message to SQS:', error);
    throw error;
  }
};

// helper function to find today fixtures
export const findTodayFixtures = async (currentDate, FixturesTable) => {
  console.log(currentDate.toISOString().split('T')[0]);
  // query the database to retrieve fixtures that have `date` as currentDate
  const fixturesToday = await FixturesTable().where(
    'date',
    currentDate.toISOString().split('T')[0]
  );
  return fixturesToday;
};
