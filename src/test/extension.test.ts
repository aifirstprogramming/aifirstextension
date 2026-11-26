import * as assert from 'assert';
import * as vscode from 'vscode';
import { findMatch } from '@aifirst/content';
import { getBookContent } from '../bookContent';
import { applyInsertion, captureTarget } from '../bookInsertion';

// These run inside a real extension host on each tested VS Code build
// (.vscode-test.mjs). They use only public APIs and need no Copilot sign-in,
// so they prove the extension's own behavior. Whether Copilot's harness routes
// requests to the model is covered by the manual lab checklist instead.

const EXTENSION_ID = 'aifirstprogramming.ai-first-programming';

suite('Extension Test Suite', () => {
	suiteSetup(async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `${EXTENSION_ID} should be installed in the test host`);
		await extension.activate();
	});

	// The books are imported from @aifirst/content through its ./books/* subpath
	// export, so they are resolved by node at runtime rather than read from a
	// path under the extension directory. This asserts that resolution works
	// inside the real extension host, which is where a packaging mistake would
	// otherwise only show up after install.
	test('book content loads inside the extension host', () => {
		const content = getBookContent();
		assert.strictEqual(content.books.length, 2, 'both books should load');
		assert.strictEqual(content.steps.length, 155, 'every prompt in the pinned content pack should load');
		assert.ok(content.steps.every(step => step.response.length > 0), 'every prompt should have code');
		assert.deepStrictEqual(
			[...new Set(content.steps.map(step => step.language))].sort(),
			['java', 'python']
		);
	});

	test('reader commands are registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		for (const id of [
			'ai-first-programming.findExample',
			'ai-first-programming.showExample',
			'ai-first-programming.focus',
			'ai-first-programming.copyManageModelsCommand',
		]) {
			assert.ok(commands.includes(id), `${id} should be registered`);
		}
	});

	test('the AI First model is discoverable through the language model API', async () => {
		const models = await vscode.lm.selectChatModels({ vendor: 'ai-first' });
		assert.strictEqual(models.length, 1, 'exactly one AI First model');
		assert.strictEqual(models[0].id, 'ai-first-programming', 'model id must stay stable so readers keep their selection');
	});

	test('the AI First model answers a book prompt with the exact book code', async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		const steps = getBookContent().steps;
		// With no editor open the provider matches without a language filter.
		const step = steps.find(s => findMatch(s.prompt, steps) === s);
		assert.ok(step, 'some step should resolve to itself with no language filter');

		const [model] = await vscode.lm.selectChatModels({ vendor: 'ai-first' });
		const response = await model.sendRequest(
			[vscode.LanguageModelChatMessage.User(step.prompt)],
			{ justification: 'Extension self-test' }
		);
		let text = '';
		for await (const chunk of response.text) {
			text += chunk;
		}
		assert.strictEqual(text, `\`\`\`${step.language}\n${step.response}\n\`\`\`\n`);
	});

	suite('Find Book Example insertion', () => {
		async function openUntitled(content: string, eol: vscode.EndOfLine = vscode.EndOfLine.LF) {
			const document = await vscode.workspace.openTextDocument({ content, language: 'python' });
			const editor = await vscode.window.showTextDocument(document);
			await editor.edit(builder => builder.setEndOfLine(eol));
			const end = document.positionAt(document.getText().length);
			editor.selection = new vscode.Selection(end, end);
			return editor;
		}

		test('inserts at the captured cursor of an untitled file, and Undo reverts it', async () => {
			const editor = await openUntitled('# start\n');
			const target = captureTarget(editor);
			assert.ok(target, 'an untitled file is a writable target');

			assert.strictEqual(await applyInsertion(target, 'print("hi")\n'), 'applied');
			assert.strictEqual(editor.document.getText(), '# start\nprint("hi")\n');

			await vscode.commands.executeCommand('undo');
			assert.strictEqual(editor.document.getText(), '# start\n');
		});

		test('replaces the captured selection', async () => {
			const editor = await openUntitled('keep\nREPLACE ME\nkeep\n');
			editor.selection = new vscode.Selection(1, 0, 1, 10);
			const target = captureTarget(editor)!;
			assert.strictEqual(await applyInsertion(target, 'print(1)'), 'applied');
			assert.strictEqual(editor.document.getText(), 'keep\nprint(1)\nkeep\n');
		});

		test('refuses to insert when the document changed after capture', async () => {
			const editor = await openUntitled('# start\n');
			const target = captureTarget(editor)!;
			await editor.edit(builder => builder.insert(new vscode.Position(0, 0), '# reader typed this\n'));

			assert.strictEqual(await applyInsertion(target, 'print("hi")\n'), 'stale');
			assert.strictEqual(editor.document.getText(), '# reader typed this\n# start\n', 'nothing inserted');
		});

		test('follows the document line endings', async () => {
			const editor = await openUntitled('# start\r\n', vscode.EndOfLine.CRLF);
			const target = captureTarget(editor)!;
			assert.strictEqual(await applyInsertion(target, 'a = 1\nb = 2\n'), 'applied');
			assert.strictEqual(editor.document.getText(), '# start\r\na = 1\r\nb = 2\r\n');
		});

		test('a read-only document is not an insertion target', async () => {
			const document = await vscode.workspace.openTextDocument(
				vscode.Uri.from({ scheme: 'aifirst-example', path: `/${getBookContent().steps[0].id}.py` })
			);
			const editor = await vscode.window.showTextDocument(document);
			assert.strictEqual(captureTarget(editor), undefined);
		});
	});
});
