import { DynamoDB } from 'aws-sdk';

const dbClient = new DynamoDB.DocumentClient();

async function deleteNote(noteId: string) {
  try {
    await dbClient.delete({
      TableName: process.env.NOTES_TABLE!,
      Key: { id: noteId },
    }).promise();

    return noteId;
  } catch (err) {
    console.log('DynamoDB error:', err);
    return null;
  }
}

export default deleteNote;
