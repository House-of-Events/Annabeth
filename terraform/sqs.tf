// Create the dead-letter queue
resource "aws_sqs_queue" "fixtures_queue_deadletter" {
    name                        = "fixtures_queue_deadletter"
    message_retention_seconds   = 1209600  // Retain messages for 14 days (max allowed)
}

// Create the main SQS queue
resource "aws_sqs_queue" "fixtures_queue" {
    name                        = "fixtures_queue"
    delay_seconds               = 0  // Messages are available immediately
    message_retention_seconds   = 172800  // Retain messages for 2 days
    receive_wait_time_seconds   = 20  // Long polling to minimize Lambda invocations
    redrive_policy              = jsonencode({
        deadLetterTargetArn     = aws_sqs_queue.fixtures_queue_deadletter.arn
        maxReceiveCount         = 4  // Messages go to DLQ after 4 failed attempts
    })
    visibility_timeout_seconds  = 300  // Allow 5 minutes for message processing
}

// Create policy for the SQS queue
resource "aws_sqs_queue_policy" "fixtures_queue_policy" {
    queue_url = aws_sqs_queue.fixtures_queue.id
    policy = jsonencode({
        Version = "2012-10-17",
        Statement = [
            {
                Effect = "Allow",
                Principal = {
                    Service = "lambda.amazonaws.com"
                },
                Action = [
                    "sqs:SendMessage",
                    "sqs:ReceiveMessage",
                    "sqs:DeleteMessage",
                    "sqs:GetQueueAttributes"
                ],
                Resource = aws_sqs_queue.fixtures_queue.arn
            }
        ]
    })
}
