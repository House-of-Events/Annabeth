// verify-sqs-message.js
import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import logger from './logger.js';
dotenv.config();

const queueUrl = process.env.SQS_GET_ALL_FIXTURES_FROM_DB_DAILY_QUEUE_URL;

const client = new SQSClient({ region: "us-west-2" });

async function checkQueue() {
  logger.info('Checking SQS queue for messages', {
    queueUrl,
    maxMessages: 5,
    waitTimeSeconds: 2
  });

  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 5,
    WaitTimeSeconds: 2,
    VisibilityTimeout: 0, // Don't hide the message after reading
  });

  try {
    const data = await client.send(command);
    if (data.Messages && data.Messages.length > 0) {
      logger.info('Found messages in queue', {
        messageCount: data.Messages.length
      });
      
      data.Messages.forEach((msg, idx) => {
        logger.info('Message details', {
          messageNumber: idx + 1,
          messageId: msg.MessageId,
          body: msg.Body
        });
      });
    } else {
      logger.info('No messages found in the queue');
    }
  } catch (err) {
    logger.error('Error receiving messages', {
      error: err.message,
      stack: err.stack,
      queueUrl
    });
  }
}

checkQueue();