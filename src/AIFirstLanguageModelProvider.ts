import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface PromptEntry {
	prompt: string;
	response: string;
	// Optional language id e.g. 'python', 'java' to allow language-scoped matching
	language?: string;
}

export class AIFirstLanguageModelProvider implements vscode.LanguageModelChatProvider {
	private extensionPath: string;
	private promptIndex: PromptEntry[] = [];
	private indexLoaded: boolean = false;

	constructor(extensionPath: string) {
		this.extensionPath = extensionPath;
		this.loadPromptsFromBooks();
	}

	async provideLanguageModelChatInformation(
		options: vscode.PrepareLanguageModelChatModelOptions,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelChatInformation[]> {
		return [
			{
				id: 'ai-first-book-examples',
				name: 'AI First Book Examples',
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
			await this.loadPromptsFromBooks();
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
		const promptTagMatch = rawUserPrompt.match(/<prompt>([\s\S]*?)<\/prompt>/i);
		const userPrompt = promptTagMatch ? promptTagMatch[1].trim() : rawUserPrompt;

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

	private async loadPromptsFromBooks(): Promise<void> {
		try {
			this.promptIndex = [];
			const bookContentPath = path.join(this.extensionPath, 'book_content');

			if (!fs.existsSync(bookContentPath)) {
				console.warn('AI First Programming: book_content directory not found:', bookContentPath);
				this.indexLoaded = true;
				return;
			}

			const files = fs.readdirSync(bookContentPath).filter(file => file.endsWith('.json'));

			for (const file of files) {
				try {
					const filePath = path.join(bookContentPath, file);
					const fileContent = fs.readFileSync(filePath, 'utf8');
					const bookData = JSON.parse(fileContent);

					// Derive language from filename when possible (e.g. 'python' or 'java')
					const lowerName = file.toLowerCase();
					let fileLanguage: string | undefined = undefined;
					if (lowerName.includes('python')) {
						fileLanguage = 'python';
					} else if (lowerName.includes('java')) {
						fileLanguage = 'java';
					}

					// Extract prompts from the book structure
					if (bookData.sections && Array.isArray(bookData.sections)) {
						for (const section of bookData.sections) {
							if (section.chapters && Array.isArray(section.chapters)) {
								for (const chapter of section.chapters) {
									if (chapter.examples && Array.isArray(chapter.examples)) {
										for (const example of chapter.examples) {
											// Handle single prompt/response
											if (example.prompt && example.response) {
												const response = Array.isArray(example.response)
													? example.response.join('\n')
													: example.response;
												this.promptIndex.push({
													prompt: example.prompt,
													response: response,
													language: fileLanguage
												});
											}

											// Handle multiple prompts array
											if (example.prompts && Array.isArray(example.prompts)) {
												for (const promptEntry of example.prompts) {
													if (promptEntry.prompt && promptEntry.response) {
														const response = Array.isArray(promptEntry.response)
															? promptEntry.response.join('\n')
															: promptEntry.response;
														this.promptIndex.push({
															prompt: promptEntry.prompt,
															response: response,
															language: fileLanguage
														});
													}
												}
											}
										}
									}
								}
							}
						}
					}
				} catch (error) {
					console.error(`AI First Programming: Error loading book file ${file}:`, error);
				}
			}

			console.log(`AI First Programming: Loaded ${this.promptIndex.length} prompts from book content`);
			this.indexLoaded = true;
		} catch (error) {
			console.error('AI First Programming: Error loading prompts:', error);
			this.indexLoaded = true;
		}
	}

	private findMatchingPrompt(userPrompt: string, language?: string): PromptEntry | null {
		if (this.promptIndex.length === 0) {
			return null;
		}

		// If a language is provided, restrict strictly to entries with that language.
		if (language && language !== 'plaintext') {
			const entries = this.promptIndex.filter(entry => entry.language === language);
			if (entries.length === 0) {
				return null;
			}
			return this.searchEntries(userPrompt, entries);
		}

		// Plaintext / unknown (e.g. Untitled-1): tiered search — exhaust Python entries entirely
		// (exact → partial → fuzzy) before falling through to Java, then anything else. This
		// avoids the Java entry winning just because it has an extra matching word.
		const python = this.promptIndex.filter(e => e.language === 'python');
		const java = this.promptIndex.filter(e => e.language === 'java');
		const other = this.promptIndex.filter(e => e.language !== 'python' && e.language !== 'java');
		for (const group of [python, java, other]) {
			if (group.length === 0) { continue; }
			const m = this.searchEntries(userPrompt, group);
			if (m) { return m; }
		}
		return null;
	}

	private searchEntries(userPrompt: string, entries: PromptEntry[]): PromptEntry | null {
		const normalizedUserPrompt = userPrompt.toLowerCase().trim();

		// 1. Exact match (case-insensitive)
		for (const entry of entries) {
			if (entry.prompt.toLowerCase().trim() === normalizedUserPrompt) {
				return entry;
			}
		}

		// 2. Partial match (user prompt contains stored prompt or vice versa)
		for (const entry of entries) {
			const normalizedStoredPrompt = entry.prompt.toLowerCase().trim();
			if (normalizedUserPrompt.includes(normalizedStoredPrompt) ||
				normalizedStoredPrompt.includes(normalizedUserPrompt)) {
				return entry;
			}
		}

		// 3. Fuzzy match (simple word-based similarity)
		let bestMatch: PromptEntry | null = null;
		let bestScore = 0;
		const userWords = normalizedUserPrompt.split(/\s+/).filter(w => w.length > 2);

		for (const entry of entries) {
			const storedWords = entry.prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
			const commonWords = userWords.filter(word => storedWords.includes(word));
			const score = commonWords.length / Math.max(userWords.length, storedWords.length);

			if (score > bestScore && score > 0.5) {
				bestScore = score;
				bestMatch = entry;
			}
		}

		return bestMatch;
	}

	private splitIntoChunks(text: string, chunkSize: number = 50): string[] {
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += chunkSize) {
			chunks.push(text.substring(i, i + chunkSize));
		}
		return chunks;
	}
}
