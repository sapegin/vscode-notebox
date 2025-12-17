import { type ExtensionContext, Uri, window } from 'vscode';
import { logMessage } from './debug';
import NoteboxProvider from './NoteboxProvider';

/** Filename where to save notes, in the extension's global storage */
const notesFilename = 'notes.txt';

export function activate(context: ExtensionContext) {
  logMessage('📝 Notebox starting...');

  const notesFileUri = Uri.joinPath(context.globalStorageUri, notesFilename);
  logMessage('Notes file:', notesFileUri.fsPath);

  const noteboxProvider = new NoteboxProvider(
    context.extensionUri,
    notesFileUri,
  );

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      NoteboxProvider.viewType,
      noteboxProvider,
    ),
  );
}
