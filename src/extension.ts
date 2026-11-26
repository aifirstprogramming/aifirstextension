import * as vscode from 'vscode';
import { AIBookProvider } from './AIBookProvider';
import { AIBookWebViewProvider } from './AIBookWebViewProvider';
import { AIFirstLanguageModelProvider } from './AIFirstLanguageModelProvider';
import { ExamplePreviewProvider, PREVIEW_SCHEME, findBookExample, trackEditors } from './bookInsertion';
import { initLog } from './log';

export function activate(context: vscode.ExtensionContext) {
	const output = initLog(context);

	// Everything a reader needs without Copilot is registered first, so a failure
	// in the language model integration can never take the Books panel or the
	// Find Book Example command down with it.
	const aiBookProvider = new AIBookProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('aiFirstBooks', aiBookProvider));
	trackEditors(context);

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, new ExamplePreviewProvider()),

		vscode.commands.registerCommand('ai-first-programming.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from AI First Programming!');
		}),

		vscode.commands.registerCommand('ai-first-programming.showExample', (example) => {
			AIBookWebViewProvider.showExample(context, example);
		}),

		vscode.commands.registerCommand('ai-first-programming.focus', () => {
			vscode.commands.executeCommand('aiFirstBooks.focus');
		}),

		vscode.commands.registerCommand('ai-first-programming.findExample', () => findBookExample()),

		vscode.commands.registerCommand('ai-first-programming.copyManageModelsCommand', async () => {
			const commandText = 'Chat: Manage Language Models';
			await vscode.env.clipboard.writeText(commandText);
			await vscode.commands.executeCommand('workbench.action.showCommands');
			vscode.window.showInformationMessage(
				`"${commandText}" copied to clipboard! Paste it in the Command Palette (Ctrl+V / Cmd+V)`,
				'OK'
			);
		}),
	);

	registerLanguageModel(context, output);
}

function registerLanguageModel(context: vscode.ExtensionContext, output: vscode.LogOutputChannel): void {
	if (typeof vscode.lm?.registerLanguageModelChatProvider !== 'function') {
		output.warn('Language model provider API not available; the AI First chat model is disabled. Find Book Example still works.');
		return;
	}
	try {
		const aiFirstProvider = new AIFirstLanguageModelProvider();
		context.subscriptions.push(vscode.lm.registerLanguageModelChatProvider('ai-first', aiFirstProvider));
		output.info('Language model provider registered (vendor ai-first).');
	} catch (error) {
		output.error(`Language model provider registration failed; Find Book Example still works. ${String(error)}`);
	}
}

export function deactivate() {}
