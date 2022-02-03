import { DynamoDB } from 'aws-sdk';
import { Note } from './note';

const dbClient = new DynamoDB.DocumentClient();

async function createNote(note: Note) {
  if (!note.id) {
    note.id = generateRandomId();
  }

  try {
    await dbClient.put({
      TableName: process.env.NOTES_TABLE!,
      Item: note
    }).promise();

    return note;
  } catch (err) {
    console.log('DynamoDB error:', err);
    return null;
  }
}

export default createNote;

function generateRandomId() {
  return Math.random().toString(36).slice(2);
}