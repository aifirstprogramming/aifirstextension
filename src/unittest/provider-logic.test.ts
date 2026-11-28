/*
 * Tests for the chat model's request and response decisions, replayed against
 * the requests captured in the compatibility lab (docs/testing/evidence/).
 *
 * The fixtures are real requests from VS Code 1.148, with system prompts
 * redacted. Their parts already carry the fields the logic duck-types on
 * (`value`, `callId`, `content`), so they are used as captured.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { findMatch } from '@aifirst/content';
import { getBookContent } from '../bookContent';
import {
	classifyTurn,
	fencedResponse,
	findEditTool,
	findExampleHint,
	planEdit,
	toolOutcome,
	toolResultReply,
	unwrapPrompt,
	type EditorSnapshot,
} from '../providerLogic';

const EVIDENCE = path.resolve(__dirname, '../../docs/testing/evidence');
const SIGNED_OUT = '2026-11-26-linux-1.148-signedout';
const SIGNED_IN = '2026-11-27-linux-1.148-signedin';

interface Fixture {
	toolMode: number;
	tools: unknown[];
	messages: unknown[];
}

function fixture(run: string, name: string): Fixture {
	return JSON.parse(readFileSync(path.join(EVIDENCE, run, `${name}.json`), 'utf8')) as Fixture;
}

const PY_PROMPT = "Ask for the user's name and print it";
const JAVA_PROMPT = 'Create a reminder by declaring a String variable and print the reminder.';
const steps = getBookContent().steps;

// --- prompts --------------------------------------------------------------

const PROMPT_FIXTURES: [run: string, name: string, prompt: string][] = [
	[SIGNED_OUT, 'copilot-harness-chat-panel', PY_PROMPT],
	[SIGNED_OUT, 'copilot-harness-chat-second-turn', PY_PROMPT],
	[SIGNED_OUT, 'inline-chat-saved-file', PY_PROMPT],
	[SIGNED_OUT, 'inline-chat-untitled-file', PY_PROMPT],
	[SIGNED_OUT, 'local-harness-chat-panel', PY_PROMPT],
	[SIGNED_IN, 'copilot-harness-chat-panel-signed-in', PY_PROMPT],
	[SIGNED_IN, 'copilot-harness-java-prompt', JAVA_PROMPT],
	[SIGNED_IN, 'agents-window', PY_PROMPT],
	[SIGNED_IN, 'inline-chat-empty-saved-file', JAVA_PROMPT],
];

for (const [run, name, prompt] of PROMPT_FIXTURES) {
	test(`${name}: the prompt is exactly what the reader typed`, () => {
		assert.deepEqual(classifyTurn(fixture(run, name).messages), { kind: 'prompt', prompt });
	});
}

test('unwrapped prompts hit the exact-match tier, not a partial match on the wrapper', () => {
	for (const [run, name, prompt] of PROMPT_FIXTURES) {
		const turn = classifyTurn(fixture(run, name).messages);
		assert.equal(turn.kind, 'prompt');
		const match = findMatch((turn as { prompt: string }).prompt, steps, prompt === JAVA_PROMPT ? 'java' : 'python');
		assert.equal(match?.prompt.trim().toLowerCase(), prompt.toLowerCase(), name);
	}
	assert.equal(findMatch(PY_PROMPT, steps, 'python')?.id, 'py-2-08');
	assert.equal(findMatch(JAVA_PROMPT, steps, 'java')?.id, 'java-2-01');
});

test('wrappers: only the observed tags are removed', () => {
	assert.equal(unwrapPrompt('<context>x</context>\n<userRequest>\n hi \n</userRequest>\n'), 'hi');
	assert.equal(unwrapPrompt('<file>f</file><prompt>\nhi\n</prompt>\n'), 'hi');
	assert.equal(
		unwrapPrompt('<current_datetime>t</current_datetime>\n\nhi\n\n<system_reminder>\na\n</system_reminder>\n\n<tagged_files>\n* b\n</tagged_files>'),
		'hi'
	);
	assert.equal(unwrapPrompt('print <b>bold</b> text'), 'print <b>bold</b> text', 'unknown tags are part of the prompt');
	assert.equal(unwrapPrompt('plain prompt '), 'plain prompt');
});

test('a message with only redacted or non-text parts has no prompt', () => {
	assert.deepEqual(classifyTurn([{ role: 1, content: [{ kind: 'text', redacted: 'x', length: 3 }] }]), { kind: 'empty' });
	assert.deepEqual(classifyTurn([]), { kind: 'empty' });
	assert.deepEqual(classifyTurn([{ role: 1, content: '<current_datetime>t</current_datetime>' }]), { kind: 'empty' });
});

// --- tool results ---------------------------------------------------------

const RESULT_FIXTURES: [name: string, outcome: string][] = [
	['local-harness-tool-result-success', 'applied'],
	['local-harness-tool-result-read-only-file', 'applied'],
	['local-harness-tool-result-skipped', 'skipped'],
];

for (const [name, outcome] of RESULT_FIXTURES) {
	test(`${name}: answered as a tool result (${outcome}), never as a new prompt`, () => {
		const turn = classifyTurn(fixture(SIGNED_IN, name).messages);
		assert.equal(turn.kind, 'toolResult');
		assert.equal((turn as { outcome: string }).outcome, outcome);
		assert.match((turn as { callId: string }).callId, /^aifirst_/);
	});
}

test('tool result replies: applied asks for Keep/Undo, skipped and failed point to Find Book Example', () => {
	assert.match(toolResultReply({ kind: 'toolResult', callId: 'c', outcome: 'applied', detail: '' }), /Keep.*Undo/);
	assert.match(toolResultReply({ kind: 'toolResult', callId: 'c', outcome: 'skipped', detail: '' }), /nothing was inserted.*Find Book Example/);
	const failed = toolResultReply({ kind: 'toolResult', callId: 'c', outcome: 'failed', detail: 'Error: the file is locked\nstack' });
	assert.match(failed, /couldn't be inserted: Error: the file is locked\n/);
	assert.ok(!failed.includes('stack'));
});

test('an unrecognized tool result text is a failure', () => {
	assert.equal(toolOutcome('Something else went wrong'), 'failed');
	assert.equal(toolOutcome(''), 'failed');
});

// --- edit tools -----------------------------------------------------------

test('the Local harness and inline chat offer the supported edit tool; the Copilot harness does not', () => {
	assert.equal(findEditTool(fixture(SIGNED_OUT, 'local-harness-chat-panel').tools), 'replace_string_in_file');
	assert.equal(findEditTool(fixture(SIGNED_OUT, 'inline-chat-saved-file').tools), 'replace_string_in_file');
	assert.equal(findEditTool(fixture(SIGNED_IN, 'copilot-harness-chat-panel-signed-in').tools), undefined);
	assert.equal(findEditTool(fixture(SIGNED_IN, 'agents-window').tools), undefined);
});

test('a tool with the right name but a different schema is not driven', () => {
	assert.equal(findEditTool([{ name: 'replace_string_in_file', inputSchema: { properties: { path: {}, old_str: {} } } }]), undefined);
	assert.equal(findEditTool([{ name: 'edit', inputSchema: { properties: { filePath: {}, oldString: {}, newString: {} } } }]), undefined);
	assert.equal(findEditTool(undefined), undefined);
});

// --- edit planning --------------------------------------------------------

function editor(text: string, start = text.length, end = start, extra: Partial<EditorSnapshot> = {}): EditorSnapshot {
	return { scheme: 'file', isUntitled: false, fsPath: '/w/a.py', text, selectionStart: start, selectionEnd: end, eol: '\n', ...extra };
}

test('the edit replaces the whole file, so the match is unique', () => {
	assert.deepEqual(planEdit(editor('# scratch\n\n'), 'print(1)'), {
		filePath: '/w/a.py',
		oldString: '# scratch\n\n',
		newString: '# scratch\n\nprint(1)\n',
	});
});

test('a selection is replaced, and a repeated selection is still unambiguous', () => {
	const text = 'x = 1\nTODO\nTODO\n';
	assert.equal(planEdit(editor(text, 6, 10), 'print(1)')?.newString, 'x = 1\nprint(1)\nTODO\n');
});

test('the inserted code ends its line and follows CRLF documents', () => {
	assert.equal(planEdit(editor('a\nb', 1), 'x')?.newString, 'ax\nb', 'text after the cursor starts with a newline already');
	assert.equal(planEdit(editor('ab', 1), 'x')?.newString, 'ax\nb');
	assert.equal(planEdit(editor('# s\r\n', 5, 5, { eol: '\r\n' }), 'a\nb')?.newString, '# s\r\na\r\nb\r\n');
});

test('untitled and non-file documents get text, not an edit', () => {
	assert.equal(planEdit(editor('x', 1, 1, { isUntitled: true, scheme: 'untitled' }), 'y'), undefined);
	assert.equal(planEdit(editor('x', 1, 1, { scheme: 'aifirst-example' }), 'y'), undefined);
});

test('an empty saved file is edited with an empty oldString, as captured in the lab', () => {
	assert.deepEqual(planEdit(editor(''), 'print(1)'), { filePath: '/w/a.py', oldString: '', newString: 'print(1)\n' });
	const captured = fixture(SIGNED_IN, 'local-harness-empty-file-tool-result').messages as { content: { kind: string; input?: unknown }[] }[];
	const call = captured.flatMap(m => m.content).find(p => p.kind === 'toolCall');
	const step = steps.find(s => s.id === 'py-2-08')!;
	assert.deepEqual(call?.input, { filePath: '/home/copilot/lab/ws/scratch.py', oldString: '', newString: `${step.response}\n` });
	assert.equal(classifyTurn(captured).kind, 'toolResult');
	assert.equal((classifyTurn(captured) as { outcome: string }).outcome, 'applied');
});

test('the fenced response is byte-identical to the book code', () => {
	const step = steps.find(s => s.id === 'py-2-08')!;
	assert.equal(fencedResponse(step.response, 'python'), `\`\`\`python\n${step.response}\n\`\`\`\n`);
});

test('a tool result earlier in the conversation does not hide a new prompt', () => {
	const turn = classifyTurn([
		{ role: 1, content: [{ value: '<userRequest>old</userRequest>' }] },
		{ role: 2, content: [{ callId: 'aifirst_1', name: 'replace_string_in_file', input: {} }] },
		{ role: 1, content: [{ callId: 'aifirst_1', content: [{ value: 'The following files were successfully edited:\n/w/a.py\n' }] }] },
		{ role: 2, content: [{ value: 'Inserted the book example.' }] },
		{ role: 1, content: [{ value: `<userRequest>${PY_PROMPT}</userRequest>` }] },
	]);
	assert.deepEqual(turn, { kind: 'prompt', prompt: PY_PROMPT });
});

test('the Find Book Example hint shows the shortcut for the platform', () => {
	assert.match(findExampleHint('darwin'), /Cmd\+Alt\+Shift\+B/);
	assert.match(findExampleHint('win32'), /Ctrl\+Alt\+Shift\+B/);
	assert.match(findExampleHint('linux'), /Ctrl\+Alt\+Shift\+B/);
});
