import * as vscode from 'vscode';
import { AIBookProvider } from './AIBookProvider';
import { AIBookWebViewProvider } from './AIBookWebViewProvider';
import { AIFirstLanguageModelProvider } from './AIFirstLanguageModelProvider';

export function activate(context: vscode.ExtensionContext) {

	const aiBookProvider = new AIBookProvider();
	vscode.window.registerTreeDataProvider('aiFirstBooks', aiBookProvider);
	console.log('AI First Programming: debug - extension activated', { extensionPath: context.extensionPath });

	// Register AI First Language Model Chat Provider
	if (vscode.lm) {
		const aiFirstProvider = new AIFirstLanguageModelProvider();
		const languageModelDisposable = vscode.lm.registerLanguageModelChatProvider('ai-first', aiFirstProvider);
		context.subscriptions.push(languageModelDisposable);
		console.log('AI First Programming: Language Model Chat Provider registered');
	} else {
		console.warn('AI First Programming: Language Model API not available. Requires VS Code 1.102.0 or later.');
	}

	const disposable = vscode.commands.registerCommand('ai-first-programming.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from AI First Programming!');
	});

	const showExampleDisposable = vscode.commands.registerCommand('ai-first-programming.showExample', (example) => {
		AIBookWebViewProvider.showExample(context, example);
	});

	const focusDisposable = vscode.commands.registerCommand('ai-first-programming.focus', () => {
		vscode.commands.executeCommand('aiFirstBooks.focus');
	});

	const copyManageModelsCommandDisposable = vscode.commands.registerCommand('ai-first-programming.copyManageModelsCommand', async () => {
		const commandText = 'Chat: Manage Language Models';
		await vscode.env.clipboard.writeText(commandText);
		await vscode.commands.executeCommand('workbench.action.showCommands');
		vscode.window.showInformationMessage(
			`"${commandText}" copied to clipboard! Paste it in the Command Palette (Ctrl+V / Cmd+V)`,
			'OK'
		);
	});

	context.subscriptions.push(disposable, showExampleDisposable, focusDisposable, copyManageModelsCommandDisposable);
}

export function deactivate() {}
