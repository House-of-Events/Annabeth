import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import config from '../../../config/local.js';
import logger from '../../../lib/logger.js';

const sqsClient = new SQSClient({
    endpoint: config.AWS_ENDPOINT,
    region: config.AWS_REGION,
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
});

async function checkSQSQueue() {
    logger.info('Checking SQS queue for messages', {
        queueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
        maxMessages: 10,
        waitTimeSeconds: 5
    });
    
    try {
        const command = new ReceiveMessageCommand({
            QueueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 5,
        });

        const response = await sqsClient.send(command);
        
        if (!response.Messages || response.Messages.length === 0) {
            logger.info('No messages found in queue');
            return;
        }

        logger.info('Found messages in queue', {
            messageCount: response.Messages.length
        });
        
        for (let i = 0; i < response.Messages.length; i++) {
            const message = response.Messages[i];
            logger.info('Processing message', {
                messageNumber: i + 1,
                messageId: message.MessageId,
                receiptHandle: message.ReceiptHandle
            });
            
            try {
                const body = JSON.parse(message.Body);
                logger.info('Message body parsed successfully', {
                    messageId: message.MessageId,
                    body: body
                });
            } catch (error) {
                logger.warn('Failed to parse message body as JSON', {
                    messageId: message.MessageId,
                    rawBody: message.Body,
                    error: error.message
                });
            }
            
            // Delete the message after viewing
            const deleteCommand = new DeleteMessageCommand({
                QueueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle,
            });
            
            await sqsClient.send(deleteCommand);
            logger.info('Message deleted from queue', {
                messageId: message.MessageId
            });
        }
        
    } catch (error) {
        logger.error('Error checking SQS queue', {
            error: error.message,
            stack: error.stack,
            queueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL
        });
    }
}

checkSQSQueue()
    .then(() => {
        logger.info('SQS check completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('SQS check failed', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }); 