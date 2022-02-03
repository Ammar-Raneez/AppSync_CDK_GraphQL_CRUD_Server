import { Note } from './note';
import createNote from './createNote';
import listNotes from './listNotes';
import getNoteById from './getNoteById';
import notesByCompletion from './notesByCompletion';
import updateNote from './updateNote';
import deleteNote from './deleteNote';

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    noteId: string,
    complete: string,
    note: Note
  },
  identity: {
    username: string,
    claims: {
      [key: string]: string[]
    }
  }
}

exports.handler = async (event: AppSyncEvent) => {
  switch (event.info.fieldName) {
    case 'createNote':
      return await createNote(event.arguments.note);
    case 'listNotes':
      return await listNotes();
    case 'getNoteById':
      return await getNoteById(event.arguments.noteId);
    case 'notesByCompletion':
      return await notesByCompletion(event.arguments.complete);
    case 'updateNote':
      return await updateNote(event.arguments.noteId, event.arguments.note);
    case 'deleteNote':
      return await deleteNote(event.arguments.noteId);
    default:
      return null;
  }
}
