import { DynamoDB } from 'aws-sdk';

const dbClient = new DynamoDB.DocumentClient();

async function getNoteById(noteId: string) {
  try {
    const { Item } = await dbClient.get({
      TableName: process.env.NOTES_TABLE!,
      Key: { id: noteId },
    }).promise();

    return Item;
  } catch (err) {
    console.log('DynamoDB error:', err);
    return null;
  }
}

export default getNoteById;
