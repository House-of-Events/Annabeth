// verify-sqs-message.js
import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
dotenv.config();

const queueUrl = process.env.SQS_GET_ALL_FIXTURES_FROM_DB_DAILY_QUEUE_URL;

const client = new SQSClient({ region: "us-west-2" });

async function checkQueue() {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 5,
    WaitTimeSeconds: 2,
    VisibilityTimeout: 0, // Don't hide the message after reading
  });

  try {
    const data = await client.send(command);
    if (data.Messages && data.Messages.length > 0) {
      console.log("Messages in queue:");
      data.Messages.forEach((msg, idx) => {
        console.log(`--- Message ${idx + 1} ---`);
        console.log("Body:", msg.Body);
        console.log("MessageId:", msg.MessageId);
      });
    } else {
      console.log("No messages found in the queue.");
    }
  } catch (err) {
    console.error("Error receiving messages:", err);
  }
}

checkQueue();