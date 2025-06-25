import { SQSClient } from '@aws-sdk/client-sqs';
import { HttpsAgent } from 'agentkeepalive';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const IDLE_SOCKET_TIMEOUT = 40000; // 40 seconds

const sqsConfig = {
    requestHandler: new NodeHttpHandler({
        httpAgent: new HttpsAgent({ freeSocketTimeout: IDLE_SOCKET_TIMEOUT }),
    }),
};

const newSQSClient = () => {
    return new SQSClient(sqsConfig);
};

export default newSQSClient;