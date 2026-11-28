import * as vscode from 'vscode';
import { findMatch, type Step } from '@aifirst/content';
import { getBookContent } from './bookContent';
import { captureFixture, log, traceEvent, traceRequest } from './log';
import {
	classifyTurn,
	fencedResponse,
	findExampleHint,
	findEditTool,
	NO_MATCH_REPLY,
	planEdit,
	REQUIRED_TOOL_ERROR,
	TOOL_MODE_REQUIRED,
	toolResultReply,
	type EditorSnapshot,
} from './providerLogic';

let requestCounter = 0;

/**
 * The "AI First Programming" chat model. It answers a book prompt with the
 * exact code the book prints for it, and never calls an AI service.
 *
 * The decisions live in providerLogic.ts, where they are unit tested against
 * requests captured from real VS Code builds. This class adapts them to the
 * VS Code API: the active editor, the progress stream and cancellation.
 */
export class AIFirstLanguageModelProvider implements vscode.LanguageModelChatProvider {
	private steps: readonly Step[] = getBookContent().steps;

	async provideLanguageModelChatInformation(
		_options: vscode.PrepareLanguageModelChatModelOptions,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelChatInformation[]> {
		return [
			{
				id: 'ai-first-programming',
				name: 'AI First Programming',
				family: 'AIFirst',
				version: '1.0.0',
				tooltip: 'Returns the exact code examples from the AI First books. Not an AI model: it only answers prompts from the books.',
				detail: 'Exact book examples',
				maxInputTokens: 128000,
				maxOutputTokens: 4096,
				capabilities: {
					imageInput: false,
					toolCalling: true
				}
			}
		];
	}

	async provideLanguageModelChatResponse(
		_model: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken
	): Promise<void> {
		// Diagnostics only (aiFirst.trace / aiFirst.captureFixtures); no behavior change.
		const requestId = `${Date.now().toString(36)}-${++requestCounter}`;
		traceRequest(requestId, messages, options);
		await captureFixture(requestId, messages, options);

		const stream = new ResponseStream(progress, token, requestId);
		const turn = classifyTurn(messages);

		if (turn.kind === 'toolResult') {
			// The follow-up to an edit we emitted. Report it; never emit the edit again.
			traceEvent(requestId, 'tool-result', { outcome: turn.outcome });
			await stream.text(toolResultReply(turn));
			return;
		}
		if (turn.kind === 'empty') {
			traceEvent(requestId, 'no-text');
			await stream.text('Could not find a prompt in this request. Type a prompt from the AI First books.');
			return;
		}
		if (token.isCancellationRequested) {
			return;
		}

		const editor = vscode.window.activeTextEditor;
		const editorLanguage = editor?.document.languageId;
		// Deliberately no fourth argument: findMatch's default preference order is
		// this extension's long-standing python → java → other fallthrough.
		const match = findMatch(turn.prompt, this.steps, editorLanguage);
		const editTool = findEditTool(options.tools);
		traceEvent(requestId, 'match', { stepId: match?.id ?? null, editTool: editTool ?? null, editorLanguage: editorLanguage ?? null });

		if (!match) {
			traceEvent(requestId, 'no-match');
			await stream.text(NO_MATCH_REPLY);
			return;
		}

		const edit = editTool && editor ? planEdit(snapshot(editor), match.response) : undefined;
		if (edit && editTool) {
			if (token.isCancellationRequested) {
				return;
			}
			stream.part(new vscode.LanguageModelToolCallPart(`aifirst_${Date.now()}`, editTool, { ...edit }));
			traceEvent(requestId, 'emit-tool-call', { target: 'file' });
			return;
		}

		if (options.toolMode === TOOL_MODE_REQUIRED) {
			traceEvent(requestId, 'required-tool-unavailable');
			throw new Error(REQUIRED_TOOL_ERROR);
		}

		traceEvent(requestId, 'stream-markdown');
		const fenced = fencedResponse(match.response, match.language ?? editorLanguage ?? '');
		// A writable editor is open but we couldn't edit it (Copilot harness, an
		// untitled or empty file): say how to insert the code.
		const hint = editor && !isReadOnly(editor) ? `\n${findExampleHint(process.platform)}\n` : '';
		await stream.text(fenced + hint, { chunked: true });
	}

	async provideTokenCount(
		_model: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		_token: vscode.CancellationToken
	): Promise<number> {
		// Simple token estimation: approximately 4 characters per token
		const content = typeof text === 'string'
			? text
			: text.content.map(part => part instanceof vscode.LanguageModelTextPart ? part.value : '').join(' ');
		return Math.ceil(content.length / 4);
	}
}

function snapshot(editor: vscode.TextEditor): EditorSnapshot {
	const doc = editor.document;
	return {
		scheme: doc.uri.scheme,
		isUntitled: doc.isUntitled,
		fsPath: doc.uri.fsPath,
		text: doc.getText(),
		selectionStart: doc.offsetAt(editor.selection.start),
		selectionEnd: doc.offsetAt(editor.selection.end),
		eol: doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
	};
}

/** Our own read-only example documents, and output-like schemes, are not insertion targets. */
function isReadOnly(editor: vscode.TextEditor): boolean {
	const scheme = editor.document.uri.scheme;
	return scheme !== 'file' && scheme !== 'untitled' && scheme !== 'vscode-remote';
}

/**
 * Writes response parts, stopping when the request is cancelled or the consumer
 * closes the stream.
 *
 * `progress.report` is typed as returning void but returns a promise that
 * rejects when Copilot Chat closes the stream (for example after early
 * stopping). That rejection is logged rather than surfacing as an unhandled
 * rejection, and no further parts are sent.
 */
class ResponseStream {
	private closed = false;

	constructor(
		private readonly progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		private readonly token: vscode.CancellationToken,
		private readonly requestId: string
	) {}

	part(part: vscode.LanguageModelResponsePart): void {
		if (this.closed || this.token.isCancellationRequested) {
			return;
		}
		try {
			const ret = this.progress.report(part) as unknown;
			if (ret && typeof (ret as Promise<unknown>).then === 'function') {
				(ret as Promise<unknown>).catch(error => this.close(error));
			}
		} catch (error) {
			this.close(error);
		}
	}

	async text(value: string, { chunked = false } = {}): Promise<void> {
		if (!chunked) {
			this.part(new vscode.LanguageModelTextPart(value));
			return;
		}
		for (let i = 0; i < value.length; i += 50) {
			if (this.closed || this.token.isCancellationRequested) {
				return;
			}
			this.part(new vscode.LanguageModelTextPart(value.substring(i, i + 50)));
			await new Promise(resolve => setTimeout(resolve, 10));
		}
	}

	private close(error: unknown): void {
		if (!this.closed) {
			this.closed = true;
			log()?.warn(`request ${this.requestId} response stream closed by the consumer: ${String(error)}`);
		}
	}
}
