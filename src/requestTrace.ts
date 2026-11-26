/**
 * Describes a language-model request in a form that is safe to log.
 *
 * VS Code is retiring the Local agent harness (February 2027) in favour of the
 * Copilot harness, and how that harness shapes requests to an extension model
 * is not documented: the tools it offers, their schemas, the tool mode, and how
 * it wraps the reader's prompt. `aiFirst.trace` records the *shape* so we can
 * find out from real sessions. It never records prompt text, file contents or
 * tool arguments, only roles, part kinds, lengths and tool names.
 *
 * This module deliberately does not import `vscode`: parts are classified by
 * their fields so the summary can be unit tested under plain Node.
 */

export type PartKind = 'text' | 'toolCall' | 'toolResult' | 'data' | 'unknown';

export interface PartSummary {
	kind: PartKind;
	/** Character count for text parts. */
	length?: number;
	/** Tool name for tool calls. */
	toolName?: string;
	/** Present for tool calls and tool results, so a result can be paired with its call. */
	callId?: string;
	/** MIME type for data parts. */
	mimeType?: string;
	/** Top-level property names of a tool call's input, never their values. */
	inputKeys?: string[];
}

export interface MessageSummary {
	role: string;
	/** Present when the message's content is a single string rather than parts. */
	length?: number;
	parts: PartSummary[];
}

export interface ToolSummary {
	name: string;
	/** Top-level property names declared by the tool's input schema. */
	inputKeys: string[];
	required: string[];
}

export interface RequestSummary {
	messages: MessageSummary[];
	tools: ToolSummary[];
	toolMode: string;
}

interface Duck {
	[key: string]: unknown;
}

function isObject(value: unknown): value is Duck {
	return typeof value === 'object' && value !== null;
}

export function classifyPart(part: unknown): PartSummary {
	if (!isObject(part)) {
		return { kind: 'unknown' };
	}
	if (typeof part.value === 'string') {
		return { kind: 'text', length: part.value.length };
	}
	if (typeof part.callId === 'string' && typeof part.name === 'string') {
		return {
			kind: 'toolCall',
			toolName: part.name,
			callId: part.callId,
			inputKeys: isObject(part.input) ? Object.keys(part.input).sort() : [],
		};
	}
	if (typeof part.callId === 'string' && Array.isArray(part.content)) {
		return { kind: 'toolResult', callId: part.callId };
	}
	if (typeof part.mimeType === 'string') {
		return { kind: 'data', mimeType: part.mimeType };
	}
	return { kind: 'unknown' };
}

export function roleName(role: unknown): string {
	// LanguageModelChatMessageRole: User = 1, Assistant = 2, System = 3 (proposed).
	switch (role) {
		case 1: return 'user';
		case 2: return 'assistant';
		case 3: return 'system';
		default: return String(role);
	}
}

export function toolModeName(mode: unknown): string {
	// LanguageModelChatToolMode: Auto = 1, Required = 2.
	switch (mode) {
		case 1: return 'auto';
		case 2: return 'required';
		case undefined: return 'unset';
		default: return String(mode);
	}
}

function schemaKeys(schema: unknown): { inputKeys: string[]; required: string[] } {
	if (!isObject(schema)) {
		return { inputKeys: [], required: [] };
	}
	const properties = isObject(schema.properties) ? Object.keys(schema.properties).sort() : [];
	const required = Array.isArray(schema.required)
		? schema.required.filter((key): key is string => typeof key === 'string').sort()
		: [];
	return { inputKeys: properties, required };
}

export function summarizeRequest(
	messages: readonly unknown[],
	options: { tools?: readonly unknown[]; toolMode?: unknown } | undefined
): RequestSummary {
	return {
		messages: messages.map(message => {
			const m = isObject(message) ? message : {};
			if (typeof m.content === 'string') {
				return { role: roleName(m.role), length: m.content.length, parts: [] };
			}
			const parts = Array.isArray(m.content) ? m.content.map(classifyPart) : [];
			return { role: roleName(m.role), parts };
		}),
		tools: (options?.tools ?? []).map(tool => {
			const t = isObject(tool) ? tool : {};
			return { name: String(t.name), ...schemaKeys(t.inputSchema) };
		}),
		toolMode: toolModeName(options?.toolMode),
	};
}
