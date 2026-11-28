/**
 * Request and response decisions for the AI First chat model, kept free of the
 * `vscode` import so they can be unit tested under plain Node against the
 * requests captured in the compatibility lab (docs/testing/evidence/).
 *
 * Every rule here is backed by a captured fixture. Don't add a wrapper, a tool
 * adapter or a tool-result shape that hasn't been observed in a released build:
 * a guess that looks right can send a reader the wrong book code or a broken
 * edit.
 *
 * Parts are recognized by their fields, like requestTrace.ts: a text part has a
 * string `value`, a tool call has `callId`, `name` and `input`, and a tool
 * result has `callId` and a `content` array.
 */

import { endLine } from './insertText';

interface Duck {
	[key: string]: unknown;
}

function isObject(value: unknown): value is Duck {
	return typeof value === 'object' && value !== null;
}

/** LanguageModelChatMessageRole.User */
const USER_ROLE = 1;
/** LanguageModelChatToolMode.Required */
export const TOOL_MODE_REQUIRED = 2;

// ---------------------------------------------------------------------------
// Which kind of turn this is
// ---------------------------------------------------------------------------

/**
 * What happened to an edit the model asked for, as reported by the tool result.
 *
 * `applied` does not mean the reader kept it. In 1.148 the follow-up request
 * arrives as soon as the edit is in the editor, before the reader chooses Keep
 * or Undo, and neither choice sends another request.
 */
export type ToolOutcome = 'applied' | 'skipped' | 'failed';

export type Turn =
	| { kind: 'toolResult'; callId: string; outcome: ToolOutcome; detail: string }
	| { kind: 'prompt'; prompt: string }
	| { kind: 'empty' };

/** The two result texts observed for `replace_string_in_file` (Local harness, 1.148). */
const APPLIED = /^The following files were successfully edited/;
const SKIPPED = /^The user chose to skip the tool call/;

export function toolOutcome(resultText: string): ToolOutcome {
	if (APPLIED.test(resultText)) {
		return 'applied';
	}
	if (SKIPPED.test(resultText)) {
		return 'skipped';
	}
	return 'failed';
}

function textOf(parts: readonly unknown[]): string {
	return parts
		.filter((part): part is Duck => isObject(part) && typeof part.value === 'string')
		.map(part => part.value as string)
		.join(' ');
}

function contentParts(message: unknown): readonly unknown[] {
	if (!isObject(message)) {
		return [];
	}
	if (typeof message.content === 'string') {
		return [{ value: message.content }];
	}
	return Array.isArray(message.content) ? message.content : [];
}

/**
 * Decide what the newest message asks for.
 *
 * A tool result in the newest message is the follow-up to an edit we already
 * emitted: it is answered as such and never treated as a new prompt, so an edit
 * is never repeated. Otherwise the prompt is the newest user message that has
 * text, with the harness wrapper removed.
 */
export function classifyTurn(messages: readonly unknown[]): Turn {
	const newest = messages[messages.length - 1];
	if (isObject(newest) && newest.role === USER_ROLE) {
		const result = contentParts(newest).find(
			(part): part is Duck => isObject(part) && typeof part.callId === 'string' && Array.isArray(part.content)
		);
		if (result) {
			const detail = textOf(result.content as unknown[]).trim();
			return { kind: 'toolResult', callId: result.callId as string, outcome: toolOutcome(detail), detail };
		}
	}

	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (!isObject(message) || message.role !== USER_ROLE) {
			continue;
		}
		const raw = textOf(contentParts(message));
		if (raw.trim()) {
			const prompt = unwrapPrompt(raw);
			return prompt ? { kind: 'prompt', prompt } : { kind: 'empty' };
		}
	}
	return { kind: 'empty' };
}

// ---------------------------------------------------------------------------
// Prompt wrappers
// ---------------------------------------------------------------------------

/** Local harness: `<context>…<reminderInstructions>…<userRequest>prompt</userRequest>`. */
const USER_REQUEST = /<userRequest>([\s\S]*?)<\/userRequest>/i;
/** Inline chat: `<file>…<reminder>…<prompt>prompt</prompt>`. */
const PROMPT = /<prompt>([\s\S]*?)<\/prompt>/i;
/**
 * Copilot harness and Agents window: `<current_datetime>` before the prompt,
 * and `<system_reminder>` / `<tagged_files>` after it when an editor or file is
 * attached as context.
 */
const COPILOT_BLOCKS = /<(current_datetime|system_reminder|tagged_files)>[\s\S]*?<\/\1>/gi;

/** Remove the wrapper a harness puts around what the reader typed. */
export function unwrapPrompt(raw: string): string {
	const tagged = raw.match(USER_REQUEST) ?? raw.match(PROMPT);
	if (tagged) {
		return tagged[1].trim();
	}
	return raw.replace(COPILOT_BLOCKS, '').trim();
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

/**
 * Edit tools we know how to drive, by exact name and the input keys they must
 * declare. `replace_string_in_file` is offered by the Local harness and inline
 * chat; its follow-up results are captured. The Copilot harness offers `edit`
 * and `create` instead, which have no acceptance evidence yet, so they get no
 * adapter: the reader gets the code as text plus a pointer to Find Book Example.
 */
const EDIT_TOOL = { name: 'replace_string_in_file', keys: ['filePath', 'oldString', 'newString'] };

export function findEditTool(tools: readonly unknown[] | undefined): string | undefined {
	for (const tool of tools ?? []) {
		if (!isObject(tool) || tool.name !== EDIT_TOOL.name || !isObject(tool.inputSchema)) {
			continue;
		}
		const properties = tool.inputSchema.properties;
		if (isObject(properties) && EDIT_TOOL.keys.every(key => key in properties)) {
			return EDIT_TOOL.name;
		}
	}
	return undefined;
}

/** The parts of the active editor an edit decision needs. */
export interface EditorSnapshot {
	scheme: string;
	isUntitled: boolean;
	fsPath: string;
	text: string;
	/** Offsets into `text`. */
	selectionStart: number;
	selectionEnd: number;
	eol: '\n' | '\r\n';
}

export interface EditInput {
	filePath: string;
	oldString: string;
	newString: string;
}

/**
 * Build a `replace_string_in_file` call that puts the book code at the cursor or
 * over the selection, or return undefined when there is no target the tool can
 * edit unambiguously.
 *
 * The whole file is the `oldString`, so the match is always unique (a selected
 * snippet can occur more than once). For an empty saved file that is the empty
 * string, which the tool accepts as "write this content" in both inline chat
 * and the Local harness (1.148 lab, `inline-chat-empty-saved-file` and
 * `local-harness-empty-file-tool-result`). Untitled files get text instead,
 * because the tool forces a Save As for them (1.148 lab, B5). The provider
 * never edits the document itself.
 */
export function planEdit(editor: EditorSnapshot, response: string): EditInput | undefined {
	if (editor.isUntitled || editor.scheme !== 'file') {
		return undefined;
	}
	const before = editor.text.slice(0, editor.selectionStart);
	const after = editor.text.slice(editor.selectionEnd);
	let code = endLine(response.replace(/\r\n/g, '\n'), after);
	if (editor.eol === '\r\n') {
		code = code.replace(/\n/g, '\r\n');
	}
	return { filePath: editor.fsPath, oldString: editor.text, newString: before + code + after };
}

// ---------------------------------------------------------------------------
// What the reader sees
// ---------------------------------------------------------------------------

/** How to insert the code when the model can't. The shortcut matches package.json's keybinding. */
export function findExampleHint(platform: string): string {
	const keys = platform === 'darwin' ? 'Cmd+Alt+Shift+B' : 'Ctrl+Alt+Shift+B';
	return `To insert it into your file, run **AI First: Find Book Example…** (${keys}).`;
}

export function fencedResponse(code: string, language: string): string {
	return `\`\`\`${language}\n${code}\n\`\`\`\n`;
}

export function toolResultReply(turn: Extract<Turn, { kind: 'toolResult' }>): string {
	switch (turn.outcome) {
		case 'applied':
			return 'Inserted the book example. Choose **Keep** to accept it or **Undo** to remove it.';
		case 'skipped':
			return 'The edit was skipped, so nothing was inserted. To insert the book example yourself, run **AI First: Find Book Example…**.';
		case 'failed': {
			const reason = turn.detail.split('\n')[0].slice(0, 200);
			return `The book example couldn't be inserted${reason ? `: ${reason}` : '.'}\n\nRun **AI First: Find Book Example…** to insert it instead.`;
		}
	}
}

export const NO_MATCH_REPLY = `I couldn't find a matching example for your prompt. Try checking the AI First Books panel for available examples, or use a prompt from the book content.`;

export const REQUIRED_TOOL_ERROR = 'AI First can only answer this request by editing a saved file, and it has no supported edit for this one. Run "AI First: Find Book Example…" to insert the book code instead.';
