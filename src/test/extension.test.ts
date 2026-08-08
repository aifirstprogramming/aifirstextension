import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';
import { getBookContent } from '../bookContent';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	// The books are imported from @aifirst/content through its ./books/* subpath
	// export, so they are resolved by node at runtime rather than read from a
	// path under the extension directory. This asserts that resolution works
	// inside the real extension host, which is where a packaging mistake would
	// otherwise only show up after install.
	test('book content loads inside the extension host', () => {
		const content = getBookContent();
		assert.strictEqual(content.books.length, 2, 'both books should load');
		assert.strictEqual(content.steps.length, 48, 'all 48 prompts should load');
		assert.ok(content.steps.every(step => step.response.length > 0), 'every prompt should have code');
		assert.deepStrictEqual(
			[...new Set(content.steps.map(step => step.language))].sort(),
			['java', 'python']
		);
	});
});
