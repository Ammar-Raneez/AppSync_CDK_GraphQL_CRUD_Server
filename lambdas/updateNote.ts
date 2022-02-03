import { DynamoDB } from 'aws-sdk';

const dbClient = new DynamoDB.DocumentClient();

async function updateNote(noteId: string, note: any) {
  try {
    const params: any = {
      TableName: process.env.NOTES_TABLE!,
      Key: { id: noteId },
      UpdateExpression: '',
      ExpressionAttributeValues: { },
      ExpressionAttributeNames: { },
      ReturnValues: 'UPDATED_NEW'
    }

    let prefix = 'set ';
    const attributes = Object.keys(note);
    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes[i];
      params['UpdateExpression'] += `${prefix}# ${attribute} = :${attribute}`;
      params['ExpressionAttributeValues'][':' + attribute] = note[attribute];
      params['ExpressionAttributeNames']['#' + attribute] = attribute;
      prefix = ', ';
    }

    await dbClient.update(params).promise();
    return note;
  } catch (err) {
    console.log('DynamoDB error:', err);
    return null;
  }
}

export default updateNote;
