import {
  window,
  Uri,
  type WebviewViewProvider,
  type WebviewView,
  type Webview,
} from 'vscode';
import { mkdirp } from 'mkdirp';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
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

    this.value = this.readNotesFile();
  }

  public resolveWebviewView(webviewView: WebviewView) {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((event) => {
      logMessage('Received event from WebView:', event);
      switch (event.type) {
        // Take the value from the WebView and save the notes file
        case 'webview->extension': {
          this.value = event.data;
          this.saveNotesFile();
          break;
        }
      }
    });

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
				<link href="${styleUri}" rel="stylesheet">
			</head>
			<body>
				<textarea id="textarea">${this.value}</textarea>
				<script src="${scriptUri}"/>
			</body>
			</html>`;
  }

  /** Creates an empty notes file if it doesn't exists */
  private ensureNotesFile(): void {
    if (this.hasNotesFile()) {
      return;
    }

    mkdirp(path.dirname(this.fullPath));
    writeFileSync(this.fullPath, '');
  }

  /** Returns true if the notes file already exists */
  private hasNotesFile(): boolean {
    return existsSync(this.fullPath);
  }

  /** Read the notes file, creates if needed */
  private readNotesFile(): string {
    this.ensureNotesFile();
    return readFileSync(this.fullPath, 'utf8');
  }

  /** Save the notes file */
  private saveNotesFile = async () => {
    logMessage('Saving notes...');
    try {
      await writeFile(this.fullPath, this.value);
    } catch (error) {
      if (error instanceof Error) {
        window.showErrorMessage(`Cannot save notes: ${error.message}`);
      }
    }
  };
}
