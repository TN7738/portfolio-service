const express = require('express');

const {
  SecretsManagerClient,
  GetSecretValueCommand
} = require('@aws-sdk/client-secrets-manager');

const {
  SNSClient,
  PublishCommand
} = require('@aws-sdk/client-sns');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const AWS_REGION = process.env.AWS_REGION;
const SNS_SECRET_ID = process.env.SNS_SECRET_ID;

if (!AWS_REGION || !SNS_SECRET_ID) {
  throw new Error('AWS_REGION and SNS_SECRET_ID environment variables are required');
}

app.use(express.json());

const client = new SecretsManagerClient({
  region: AWS_REGION
});

async function getSnsConfig() {
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: SNS_SECRET_ID
    })
  );

  if (!response.SecretString) {
    throw new Error('SNS secret does not contain SecretString');
  }

  return JSON.parse(response.SecretString);
}

async function publishMessage(message) {
  const config = await getSnsConfig();

  const sns = new SNSClient({
    region: AWS_REGION
  });

  return sns.send(new PublishCommand({
    TopicArn: config.topicArn,
    Message: message
  }));
}

app.post('/message', async (req, res) => {
    const message = req.body;

    // Simple validation rule
    if (!message.text) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required field: text' 
        });
    }

    try {
      const result = await publishMessage(JSON.stringify(message));

      res.status(201).json({
        success: true,
        message: 'Message received successfully!',
        messageId: result.MessageId,
        data: message
      });
    } catch (error) {
      console.error('Failed to publish message to SNS:', error);
      res.status(502).json({
        success: false,
        message: 'Unable to publish message'
      });
    }
});

// Start the server
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});
