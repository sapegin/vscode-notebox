import fs from 'node:fs';
import path from 'node:path';
import {
  Uri,
  type Webview,
  type WebviewView,
  type WebviewViewProvider,
  window,
} from 'vscode';
import { logMessage } from './debug';

export default class NoteboxProvider implements WebviewViewProvider {
  public static readonly viewType = 'notebox.noteboxView';

  /** Uri of the extension */
  private extensionUri: Uri;
  /** Absolute path to the notes file */
  private fullPath: string;
  /** Current text in the notebox */
  private value = '';
  /** WebviewView instance */
  private webviewView?: WebviewView;

  public constructor(extensionUri: Uri, notesUri: Uri) {
    this.extensionUri = extensionUri;
    this.fullPath = notesUri.fsPath;
  }

  public async resolveWebviewView(webviewView: WebviewView) {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    await this.readNotesFile();
    this.setTextareaValue(this.value);

    webviewView.webview.onDidReceiveMessage(
      (event: { type: string; data?: string }) => {
        logMessage('Received event from WebView:', event);
        switch (event.type) {
          // Take the value from the WebView and save the notes file
          case 'webview->extension': {
            this.value = event.data ?? '';
            void this.saveNotesFile();
            break;
          }
        }
      },
    );

    webviewView.onDidChangeVisibility(() => {
      // Set the textarea value when the panel gets focus
      if (webviewView.visible) {
        this.setTextareaValue(this.value);
      }
    });
  }

  /** Update the value of textarea in the WebView */
  private setTextareaValue(value: string) {
    this.postMessage('extension->webview', value);
  }

  /** Post a message to the WebView */
  private postMessage(cmd: string, arg?: string) {
    this.webviewView?.webview.postMessage({ type: cmd, value: arg });
  }

  /** Generate HTML document for the WebView */
  private getHtml(webview: Webview) {
    const styleUri = webview.asWebviewUri(
      Uri.joinPath(this.extensionUri, 'resources', 'style.css'),
    );
    const scriptUri = webview.asWebviewUri(
      Uri.joinPath(this.extensionUri, 'resources', 'script.js'),
    );

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; https:; script-src ${webview.cspSource}; style-src ${webview.cspSource};">
				<link href="${styleUri.toString()}" rel="stylesheet">
			</head>
			<body>
				<textarea id="textarea" disabled="disabled" aria-label="Notes">Loading…</textarea>
				<script src="${scriptUri.toString()}"/>
			</body>
			</html>`;
  }

  /** Read the notes file, creates if needed */
  private readNotesFile = async () => {
    try {
      // First, try to read the file
      const content = await fs.promises.readFile(this.fullPath, 'utf8');
      this.value = content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // If file doesn't exists, create an empty file
        await fs.promises.mkdir(path.dirname(this.fullPath), {
          recursive: true,
        });
        await fs.promises.writeFile(this.fullPath, this.value);
      }
      throw error;
    }
  };

  /** Save the notes file */
  private saveNotesFile = async () => {
    logMessage('Saving notes...');
    try {
      await fs.promises.writeFile(this.fullPath, this.value);
    } catch (error) {
      if (error instanceof Error) {
        window.showErrorMessage(`Cannot save notes: ${error.message}`);
      }
    }
  };
}
