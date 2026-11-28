/*
 * Tests for the pure helpers behind the Copilot-harness compatibility work:
 * the privacy-safe request summary written by `aiFirst.trace`, and the text
 * handling used when Find Book Example inserts code into a reader's file.
 *
 * Message parts are plain objects with the same fields as the VS Code part
 * classes, so these run under plain Node without an extension host.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyPart, summarizeRequest } from '../requestTrace';
import { describeStep, endLine, toDocumentEol } from '../insertText';

const SECRET = 'my private prompt about payroll.py';

test('text parts are summarized by length, never by content', () => {
	const summary = classifyPart({ value: SECRET });
	assert.deepEqual(summary, { kind: 'text', length: SECRET.length });
	assert.ok(!JSON.stringify(summary).includes('payroll'));
});

test('tool calls record name and input keys but not input values', () => {
	const summary = classifyPart({
		callId: 'c1',
		name: 'replace_string_in_file',
		input: { filePath: '/home/reader/secret.py', oldString: SECRET, newString: 'x' },
	});
	assert.deepEqual(summary, {
		kind: 'toolCall',
		toolName: 'replace_string_in_file',
		callId: 'c1',
		inputKeys: ['filePath', 'newString', 'oldString'],
	});
	assert.ok(!JSON.stringify(summary).includes('secret'));
});

test('tool results are recognized and paired by call id', () => {
	assert.deepEqual(classifyPart({ callId: 'c1', content: [{ value: 'ok' }] }), { kind: 'toolResult', callId: 'c1' });
});

test('data and unrecognized parts are classified without throwing', () => {
	assert.deepEqual(classifyPart({ mimeType: 'image/png', data: new Uint8Array() }), { kind: 'data', mimeType: 'image/png' });
	assert.deepEqual(classifyPart(null), { kind: 'unknown' });
	assert.deepEqual(classifyPart({ something: 1 }), { kind: 'unknown' });
});

test('a request summary lists roles, offered tool schemas and tool mode', () => {
	const summary = summarizeRequest(
		[
			{ role: 1, content: [{ value: `<prompt>${SECRET}</prompt>` }] },
			{ role: 2, content: [{ callId: 'c1', name: 'edit', input: { path: 'a' } }] },
			{ role: 1, content: [{ callId: 'c1', content: [] }] },
		],
		{
			toolMode: 2,
			tools: [{
				name: 'replace_string_in_file',
				description: 'ignored',
				inputSchema: { type: 'object', properties: { oldString: {}, filePath: {}, newString: {} }, required: ['filePath', 'oldString'] },
			}],
		}
	);
	assert.deepEqual(summary.messages.map(m => m.role), ['user', 'assistant', 'user']);
	assert.deepEqual(summary.messages.map(m => m.parts[0].kind), ['text', 'toolCall', 'toolResult']);
	assert.deepEqual(summary.tools, [{ name: 'replace_string_in_file', inputKeys: ['filePath', 'newString', 'oldString'], required: ['filePath', 'oldString'] }]);
	assert.equal(summary.toolMode, 'required');
	assert.ok(!JSON.stringify(summary).includes('payroll'));
});

test('a request without options reports no tools and an unset tool mode', () => {
	const summary = summarizeRequest([{ role: 1, content: 'plain string content' }], undefined);
	assert.deepEqual(summary, { messages: [{ role: 'user', length: 20, parts: [] }], tools: [], toolMode: 'unset' });
});

test('inserted code follows the document line endings', () => {
	assert.equal(toDocumentEol('a\nb\n', '\r\n'), 'a\r\nb\r\n');
	assert.equal(toDocumentEol('a\r\nb\n', '\n'), 'a\nb\n');
	assert.equal(toDocumentEol('a\r\nb', '\r\n'), 'a\r\nb', 'existing CRLF is not doubled');
});

test('a matched step is described with book, chapter and step position', () => {
	const example = { title: 'Fizz Buzz', chapterNumber: 3, bookTitle: 'AI First Python Programming' };
	assert.equal(describeStep({ index: 1, total: 1 }, example), 'AI First Python Programming, Chapter 3 › Fizz Buzz');
	assert.equal(describeStep({ index: 2, total: 3 }, example), 'AI First Python Programming, Chapter 3 › Fizz Buzz (step 2 of 3)');
	assert.equal(describeStep({ index: 1, total: 1 }, undefined), 'Book example');
});

test('inserted code ends its line unless the text after it already starts one', () => {
	assert.equal(endLine('}', '// c1\n'), '}\n', 'text on the same line moves to the next line');
	assert.equal(endLine('}', ''), '}\n', 'the file ends with a newline');
	assert.equal(endLine('}', '\nnext'), '}');
	assert.equal(endLine('}', '\r\nnext'), '}');
	assert.equal(endLine('}\n', 'x'), '}\n');
});
