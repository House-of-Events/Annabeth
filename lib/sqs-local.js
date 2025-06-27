import { SQSClient } from '@aws-sdk/client-sqs';
import config from '../config/local.js';

const sqsConfig = {
    endpoint: config.AWS_ENDPOINT,
    region: config.AWS_REGION,
    credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
    // Disable SSL verification for LocalStack
    forcePathStyle: true,
};

const newSQSClient = () => {
    return new SQSClient(sqsConfig);
};

export default newSQSClient; 