import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import config from '../../../config/local.js';

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
    console.log('Checking SQS queue for messages...');
    
    try {
        const command = new ReceiveMessageCommand({
            QueueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 5,
        });

        const response = await sqsClient.send(command);
        
        if (!response.Messages || response.Messages.length === 0) {
            console.log('📭 No messages in queue');
            return;
        }

        console.log(`Found ${response.Messages.length} message(s):`);
        
        for (let i = 0; i < response.Messages.length; i++) {
            const message = response.Messages[i];
            console.log(`\n--- Message ${i + 1} ---`);
            console.log(`Message ID: ${message.MessageId}`);
            console.log(`Receipt Handle: ${message.ReceiptHandle}`);
            
            try {
                const body = JSON.parse(message.Body);
                console.log('Message Body:');
                console.log(JSON.stringify(body, null, 2));
            } catch (error) {
                console.log('Raw Message Body:', message.Body);
            }
            
            // Delete the message after viewing
            const deleteCommand = new DeleteMessageCommand({
                QueueUrl: config.SQS_FIXTURES_DAILY_QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle,
            });
            
            await sqsClient.send(deleteCommand);
            console.log('✅ Message deleted from queue');
        }
        
    } catch (error) {
        console.error('❌ Error checking SQS queue:', error);
    }
}

checkSQSQueue()
    .then(() => {
        console.log('🔍 SQS check completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 SQS check failed:', error);
        process.exit(1);
    }); 