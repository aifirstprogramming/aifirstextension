import * as vscode from 'vscode';
import { findMatch, unwrapPromptTag, type Step } from '@aifirst/content';
import { getBookContent } from './bookContent';

export class AIFirstLanguageModelProvider implements vscode.LanguageModelChatProvider {
	private promptIndex: readonly Step[] = [];
	private indexLoaded: boolean = false;

	constructor() {
		this.loadPromptsFromBooks();
	}

	async provideLanguageModelChatInformation(
		options: vscode.PrepareLanguageModelChatModelOptions,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelChatInformation[]> {
		return [
			{
				id: 'ai-first-programming',
				name: 'AI First Programming',
				family: 'AIFirst',
				version: '1.0.0',
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
		model: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken
	): Promise<void> {
		// Ensure prompts are loaded
		if (!this.indexLoaded) {
			this.loadPromptsFromBooks();
		}

		// Determine the active editor language (if any) so we can restrict matching
		const activeEditor = vscode.window.activeTextEditor;
		const editorLanguage = activeEditor?.document.languageId;

		// Get the user's message from the messages array
		const userMessages = messages.filter(msg => msg.role === vscode.LanguageModelChatMessageRole.User);
		if (userMessages.length === 0) {
			this.reportSafely(progress, new vscode.LanguageModelTextPart('No user message found in the request.'));
			return;
		}

		const userMessage = userMessages[userMessages.length - 1];
		const rawUserPrompt = this.extractTextFromMessage(userMessage);
		// Inline chat / agent mode wraps the user's actual query in <prompt>...</prompt>.
		// Extract just the inner text so fuzzy matching sees the real prompt.
		const userPrompt = unwrapPromptTag(rawUserPrompt);

		if (!userPrompt) {
			this.reportSafely(progress, new vscode.LanguageModelTextPart('Could not extract text from user message.'));
			return;
		}

		const match = this.findMatchingPrompt(userPrompt, editorLanguage);

		// If Copilot offered the inline-edit tool, emit a tool call so its invocation drives the
		// edit and wraps it in the inline Keep/X diff overlay. For saved non-empty files we pass
		// the absolute path. For untitled or empty buffers, the tool needs a resolvable URI and a
		// non-empty oldString — we insert a tiny newline placeholder first and pass
		// doc.uri.toString() (e.g. "untitled:Untitled-1").
		const editTool = options.tools?.find(t => t.name === 'replace_string_in_file');

		if (match && editTool && activeEditor) {
			const doc = activeEditor.document;
			const fullText = doc.getText();
			const selection = activeEditor.selection;

			const canUseTool = !doc.isUntitled && doc.uri.scheme === 'file' && (!selection.isEmpty || fullText.length > 0);

			if (canUseTool) {
				const selStart = doc.offsetAt(selection.start);
				const selEnd = doc.offsetAt(selection.end);
				let oldString: string;
				let newString: string;
				if (!selection.isEmpty) {
					oldString = doc.getText(selection);
					newString = match.response;
				} else {
					oldString = fullText;
					newString = fullText.substring(0, selStart) + match.response + fullText.substring(selEnd);
				}
				this.reportSafely(progress, new vscode.LanguageModelToolCallPart(
					`aifirst_${Date.now()}`,
					'replace_string_in_file',
					{ filePath: doc.uri.fsPath, oldString, newString }
				));
				return;
			}

			// Untitled or empty buffer: insert a newline placeholder so the tool has something
			// unique to replace, then emit the tool call against the URI form of the path.
			const placeholder = '\n';
			const prepEdit = new vscode.WorkspaceEdit();
			prepEdit.insert(doc.uri, selection.active, placeholder);
			await vscode.workspace.applyEdit(prepEdit);
			this.reportSafely(progress, new vscode.LanguageModelToolCallPart(
				`aifirst_${Date.now()}`,
				'replace_string_in_file',
				{ filePath: doc.uri.toString(), oldString: placeholder, newString: match.response }
			));
			return;
		}

		// Chat-panel (no edit tool) path: stream as fenced markdown.
		if (match) {
			const fenceLang = match.language ?? editorLanguage ?? '';
			const fenced = `\`\`\`${fenceLang}\n${match.response}\n\`\`\`\n`;
			const chunks = this.splitIntoChunks(fenced);
			for (const chunk of chunks) {
				if (token.isCancellationRequested) {
					return;
				}
				this.reportSafely(progress, new vscode.LanguageModelTextPart(chunk));
				await new Promise(resolve => setTimeout(resolve, 10));
			}
		} else {
			const fallbackMessage = `I couldn't find a matching example for your prompt. Try checking the AI First Books panel for available examples, or use a prompt from the book content.`;
			this.reportSafely(progress, new vscode.LanguageModelTextPart(fallbackMessage));
		}
	}

	async provideTokenCount(
		model: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		token: vscode.CancellationToken
	): Promise<number> {
		// Simple token estimation: approximately 4 characters per token
		const textContent = typeof text === 'string' ? text : this.extractTextFromMessage(text);
		return Math.ceil((textContent?.length || 0) / 4);
	}

	// progress.report is typed as returning void but actually returns a promise that can reject
	// asynchronously when Copilot Chat closes the stream (e.g. after EarlyStopping triggers).
	// Capture that rejection so it doesn't surface as an unhandled rejection in the dev console.
	private reportSafely(
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		part: vscode.LanguageModelResponsePart
	): void {
		try {
			const ret = progress.report(part) as unknown;
			if (ret && typeof (ret as Promise<unknown>).then === 'function') {
				(ret as Promise<unknown>).catch(() => { /* swallow */ });
			}
		} catch {
			/* swallow */
		}
	}

	private extractTextFromMessage(message: vscode.LanguageModelChatRequestMessage): string {
		if (typeof message.content === 'string') {
			return message.content;
		}

		if (Array.isArray(message.content)) {
			// Extract text from content parts
			const textParts: string[] = [];
			for (const part of message.content) {
				if (part instanceof vscode.LanguageModelTextPart) {
					textParts.push(part.value);
				}
			}
			return textParts.join(' ');
		}

		return '';
	}

	private loadPromptsFromBooks(): void {
		this.promptIndex = getBookContent().steps;
		this.indexLoaded = true;
	}

	/**
	 * Resolve a prompt to the code the book prints for it.
	 *
	 * The matching itself lives in `@aifirst/content` so this extension and the
	 * `aifirst` CLI resolve a reader's prompt through exactly the same code path.
	 * Deliberately no fourth argument: `findMatch`'s default preference order is
	 * this extension's long-standing python → java → other fallthrough for an
	 * unknown language. The CLI passes the reader's chosen book instead; passing
	 * anything here would change which code a reader is shown.
	 */
	private findMatchingPrompt(userPrompt: string, language?: string): Step | null {
		return findMatch(userPrompt, this.promptIndex, language);
	}

	private splitIntoChunks(text: string, chunkSize: number = 50): string[] {
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += chunkSize) {
			chunks.push(text.substring(i, i + chunkSize));
		}
		return chunks;
	}
}
