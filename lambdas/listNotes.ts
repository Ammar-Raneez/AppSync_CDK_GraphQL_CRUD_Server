import { DynamoDB } from 'aws-sdk';

const dbClient = new DynamoDB.DocumentClient();

async function listNotes() {
  try {
    const data = await dbClient.scan({
      TableName: process.env.NOTES_TABLE!
    }).promise();

    return data.Items;
  } catch (err) {
    console.log('DynamoDB error: ', err);
    return null;
  }
}

export default listNotes;
