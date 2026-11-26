import * as vscode from 'vscode';
import { summarizeRequest } from './requestTrace';

/**
 * The extension's diagnostics.
 *
 * Always logged: versions, provider registration, and failures. These are what
 * a reader pastes into a bug report, and contain nothing they typed.
 *
 * `aiFirst.trace` adds the shape of each language-model request (roles, part
 * kinds, offered tools and their schema keys, tool mode, matched step id). No
 * prompt text or file contents.
 *
 * `aiFirst.trace.captureFixtures` is for the compatibility test lab only: it
 * writes full requests, prompt text included, to the extension's global storage
 * so they can become unit-test fixtures. It is not documented for readers.
 */

let channel: vscode.LogOutputChannel | undefined;
let fixtureDir: vscode.Uri | undefined;

export function initLog(context: vscode.ExtensionContext): vscode.LogOutputChannel {
	channel = vscode.window.createOutputChannel('AI First Programming', { log: true });
	context.subscriptions.push(channel);
	fixtureDir = vscode.Uri.joinPath(context.globalStorageUri, 'fixtures');
	const version = (context.extension.packageJSON as { version?: string }).version ?? 'unknown';
	channel.info(`AI First Programming ${version} on VS Code ${vscode.version} (${process.platform})`);
	return channel;
}

export function log(): vscode.LogOutputChannel | undefined {
	return channel;
}

function setting(key: string): boolean {
	return vscode.workspace.getConfiguration('aiFirst').get<boolean>(key, false);
}

export function traceRequest(
	requestId: string,
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	options: vscode.ProvideLanguageModelChatResponseOptions
): void {
	if (!channel || !setting('trace')) {
		return;
	}
	const editor = vscode.window.activeTextEditor;
	channel.info(`request ${requestId} ${JSON.stringify({
		...summarizeRequest(messages, options),
		editor: editor ? {
			languageId: editor.document.languageId,
			scheme: editor.document.uri.scheme,
			isUntitled: editor.document.isUntitled,
			isEmpty: editor.document.getText().length === 0,
			hasSelection: !editor.selection.isEmpty,
		} : null,
	})}`);
}

export function traceEvent(requestId: string, event: string, detail?: Record<string, unknown>): void {
	if (!channel || !setting('trace')) {
		return;
	}
	channel.info(`request ${requestId} ${event}${detail ? ' ' + JSON.stringify(detail) : ''}`);
}

/** Lab only: serialize a full request, prompt text included, for use as a test fixture. */
export async function captureFixture(
	requestId: string,
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	options: vscode.ProvideLanguageModelChatResponseOptions
): Promise<void> {
	if (!fixtureDir || !setting('trace.captureFixtures')) {
		return;
	}
	const fixture = {
		capturedAt: new Date().toISOString(),
		vscodeVersion: vscode.version,
		platform: process.platform,
		toolMode: options.toolMode,
		tools: (options.tools ?? []).map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
		messages: messages.map(m => ({
			role: m.role,
			name: m.name,
			content: m.content.map(part => {
				if (part instanceof vscode.LanguageModelTextPart) {
					return { kind: 'text', value: part.value };
				}
				if (part instanceof vscode.LanguageModelToolCallPart) {
					return { kind: 'toolCall', callId: part.callId, name: part.name, input: part.input };
				}
				if (part instanceof vscode.LanguageModelToolResultPart) {
					return {
						kind: 'toolResult',
						callId: part.callId,
						content: part.content.map(c => c instanceof vscode.LanguageModelTextPart ? { kind: 'text', value: c.value } : { kind: 'other' }),
					};
				}
				return { kind: 'other' };
			}),
		})),
	};
	try {
		await vscode.workspace.fs.createDirectory(fixtureDir);
		const file = vscode.Uri.joinPath(fixtureDir, `${requestId}.json`);
		await vscode.workspace.fs.writeFile(file, Buffer.from(JSON.stringify(fixture, null, 2), 'utf8'));
		channel?.info(`request ${requestId} fixture written to ${file.fsPath}`);
	} catch (error) {
		channel?.warn(`request ${requestId} fixture capture failed: ${String(error)}`);
	}
}
