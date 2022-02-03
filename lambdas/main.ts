import { Note } from './note';
import createNote from './createNote';
import listNotes from './listNotes';

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    noteId: string,
    note: Note
  }
}

exports.handler = async (event: AppSyncEvent) => {
  switch (event.info.fieldName) {
    case 'createNote':
      return await createNote(event.arguments.note);
    case 'listNotes':
      return await listNotes();
    default:
      return null;
  }
}
