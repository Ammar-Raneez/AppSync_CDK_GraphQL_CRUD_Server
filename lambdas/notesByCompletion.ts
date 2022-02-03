import { DynamoDB } from 'aws-sdk';

const dbClient = new DynamoDB.DocumentClient();

async function notesByCompletion(complete: string) {
  try {
    const data = await dbClient.query({
      TableName: process.env.NOTES_TABLE!,
      IndexName: 'notesByCompletion',
      KeyConditionExpression: '#dbField = :complete',
      ExpressionAttributeValues: {
        ':complete': complete
      },
      ExpressionAttributeNames: {
        '#dbField': 'complete'
      }
    }).promise();

    return data.Items;
  } catch (err) {
    console.log('DynamoDB error:', err);
    return null;
  }
}

export default notesByCompletion;
