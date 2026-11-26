import * as vscode from 'vscode';
import { insertStepById } from './bookInsertion';

interface Example {
  title: string;
  description: string;
  /** Book language; when absent (e.g. an old caller), it is guessed from the text. */
  language?: string;
  prompts: Prompt[];
}

interface Prompt {
  /** Step id in @aifirst/content. Enables the Insert button. */
  id?: string;
  prompt: string;
  response: string;
}

type WebviewMessage =
  | { type: 'copy'; index: number; field: 'prompt' | 'response' }
  | { type: 'insert'; index: number };

export class AIBookWebViewProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentExample: Example | undefined;

  public static showExample(context: vscode.ExtensionContext, example: Example) {
    // Always try to open beside the active editor, or in column 2 if no active editor
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.Two;

    AIBookWebViewProvider.currentExample = example;

    // If we already have a panel, show it instead of creating a new one
    if (AIBookWebViewProvider.currentPanel) {
      const panel = AIBookWebViewProvider.currentPanel;
      panel.reveal(column);
      panel.title = `Example: ${example.title}`;
      panel.webview.html = this.getWebviewContent(panel.webview, context.extensionUri, example);
      return;
    }

    const prismRoot = vscode.Uri.joinPath(context.extensionUri, 'media', 'prism');
    const panel = vscode.window.createWebviewPanel(
      'aiBookExample',
      `Example: ${example.title}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        // Highlighting is bundled with the extension so the viewer works offline.
        localResourceRoots: [prismRoot]
      }
    );
    AIBookWebViewProvider.currentPanel = panel;

    panel.webview.html = this.getWebviewContent(panel.webview, context.extensionUri, example);

    // Copy and Insert run in the extension host: the host clipboard works where the
    // webview's navigator.clipboard may not, and Insert needs the editor APIs.
    panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(panel, message),
      null,
      context.subscriptions
    );

    // Reset when the current panel is closed
    panel.onDidDispose(
      () => {
        AIBookWebViewProvider.currentPanel = undefined;
        AIBookWebViewProvider.currentExample = undefined;
      },
      null,
      context.subscriptions
    );
  }

  private static async handleMessage(panel: vscode.WebviewPanel, message: WebviewMessage): Promise<void> {
    const prompt = AIBookWebViewProvider.currentExample?.prompts[message.index];
    if (!prompt) {
      return;
    }
    if (message.type === 'copy') {
      await vscode.env.clipboard.writeText(message.field === 'prompt' ? prompt.prompt : prompt.response);
      panel.webview.postMessage({ type: 'copied', index: message.index, field: message.field });
    } else if (message.type === 'insert' && prompt.id) {
      await insertStepById(prompt.id);
    }
  }

  private static detectLanguage(example: Example): string {
    if (example.language) {
      return example.language;
    }

    const title = example.title.toLowerCase();
    const description = example.description.toLowerCase();

    // Detect language based on context
    if (title.includes('java') || description.includes('java')) {
      return 'java';
    } else if (title.includes('python') || description.includes('python')) {
      return 'python';
    }

    // Default fallback - try to detect from common patterns
    if (example.prompts.length > 0) {
      const firstResponse = example.prompts[0].response.toLowerCase();
      if (firstResponse.includes('system.out.println') || firstResponse.includes('public class') || firstResponse.includes('public static')) {
        return 'java';
      }
    }

    return 'python'; // Default to python
  }

  private static nonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private static getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, example: Example): string {
    const language = this.detectLanguage(example);
    const nonce = this.nonce();
    const prism = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'prism', file));
    const multi = example.prompts.length > 1;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(example.title)}</title>
    <link href="${prism('prism-tomorrow.min.css')}" rel="stylesheet" />
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
            margin: 0;
            padding: 20px;
        }

        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .title {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin: 0 0 10px 0;
        }

        .description {
            font-size: 16px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .prompts-section {
            margin-top: 30px;
        }

        .prompts-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: var(--vscode-textLink-foreground);
        }

        .prompt-item {
            margin-bottom: 30px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
        }

        .prompt-header {
            background-color: var(--vscode-panel-background);
            padding: 15px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .prompt-content {
            padding: 15px;
            background-color: var(--vscode-input-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .response-header {
            background-color: var(--vscode-panel-background);
            padding: 15px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .response-content {
            padding: 0;
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-editor-font-family);
            overflow-x: auto;
        }

        .response-content pre {
            margin: 0;
            padding: 15px;
            background-color: var(--vscode-editor-background) !important;
            border: none;
            border-radius: 0;
        }

        .response-content code {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-font-size);
            background: transparent !important;
        }

        .copy-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            margin-left: 10px;
        }

        .copy-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .copy-button:active {
            background-color: var(--vscode-button-secondaryBackground);
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .section-title {
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${this.escapeHtml(example.title)}</div>
        <div class="description">${this.escapeHtml(example.description)}</div>
    </div>

    <div class="prompts-section">
        <div class="prompts-title">
            ${multi ? `Prompts &amp; Responses (${example.prompts.length} total)` : 'Prompt &amp; Response'}
        </div>

        ${example.prompts.map((prompt, index) => `
            <div class="prompt-item">
                <div class="prompt-header section-header">
                    <span class="section-title">${multi ? `Prompt ${index + 1}` : 'Prompt'}</span>
                    <span>
                        <button class="copy-button" data-action="copy" data-field="prompt" data-index="${index}">Copy Prompt</button>
                    </span>
                </div>
                <div class="prompt-content">${this.escapeHtml(prompt.prompt)}</div>
                <div class="response-header section-header">
                    <span class="section-title">${multi ? `Response ${index + 1}` : 'Response'}</span>
                    <span>
                        ${prompt.id ? `<button class="copy-button" data-action="insert" data-index="${index}" title="Insert this code into the last file you were editing">Insert into Editor</button>` : ''}
                        <button class="copy-button" data-action="copy" data-field="response" data-index="${index}">Copy Response</button>
                    </span>
                </div>
                <div class="response-content">
                    <pre><code class="language-${this.escapeHtml(language)}">${this.escapeHtml(prompt.response)}</code></pre>
                </div>
            </div>
        `).join('')}
    </div>

    <script nonce="${nonce}" src="${prism('prism-core.min.js')}" data-manual></script>
    <script nonce="${nonce}" src="${prism('prism-clike.min.js')}"></script>
    <script nonce="${nonce}" src="${prism('prism-java.min.js')}"></script>
    <script nonce="${nonce}" src="${prism('prism-python.min.js')}"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        if (typeof Prism !== 'undefined') {
            Prism.highlightAll();
        }

        document.addEventListener('click', function (event) {
            const button = event.target.closest('button[data-action]');
            if (!button) {
                return;
            }
            const index = Number(button.dataset.index);
            if (button.dataset.action === 'copy') {
                vscode.postMessage({ type: 'copy', index: index, field: button.dataset.field });
            } else if (button.dataset.action === 'insert') {
                vscode.postMessage({ type: 'insert', index: index });
            }
        });

        window.addEventListener('message', function (event) {
            const message = event.data;
            if (message.type !== 'copied') {
                return;
            }
            const button = document.querySelector(
                'button[data-action="copy"][data-field="' + message.field + '"][data-index="' + message.index + '"]'
            );
            if (!button) {
                return;
            }
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            button.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
            setTimeout(function () {
                button.textContent = originalText;
                button.style.backgroundColor = 'var(--vscode-button-background)';
            }, 2000);
        });
    </script>
</body>
</html>`;
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
