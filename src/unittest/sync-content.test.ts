/*
 * Tests for the sync-content reconciliation and --check gate.
 *
 * These exercise the pure `reconcile()` function with synthetic fixtures and
 * synthetic "new content" step arrays, so no real network fetch or npm install
 * is triggered. The --check path is tested against a real installed module
 * (whatever the current node_modules provides) plus temp-file scenarios that
 * induce each specific disagreement the gate must catch.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';

import {
	reconcile,
	sha256,
	ContentChangedError,
	type Fixture,
	type StepLike,
} from '../sync/reconcile';
import { check, readCountLiteral, readFixtureCount, readInstalledVersion, readPinTag, stripV, updateCountLiteral } from '../sync/check';

function makeFixture(entries: { language: string; prompt: string; response: string }[], extras: Partial<Fixture> = {}): Fixture {
	return {
		_comment: 'test',
		scopes: ['python', 'java', null, 'plaintext', 'javascript'],
		variants: { '0': 'exact' },
		caseFormat: '[entryIndex, variantId, scopeId, matchedEntryIndex|null]',
		freeCaseFormat: '[promptText, scopeId, matchedEntryIndex|null]',
		entries: entries.map(e => ({
			language: e.language,
			prompt: e.prompt,
			responseSha256: sha256(e.response),
			responseLength: e.response.length,
		})),
		cases: [],
		freeCases: [],
		...extras,
	};
}

function makeStep(language: string, prompt: string, response: string): StepLike {
	return { language, prompt, response };
}

test('surviving prompt with unchanged response is carried forward', () => {
	const fixture = makeFixture([{ language: 'java', prompt: 'A', response: 'code-a' }]);
	const originalSha = fixture.entries[0].responseSha256;
	const newSteps = [makeStep('java', 'A', 'code-a')];

	const { fixture: reconciled, delta } = reconcile(fixture, newSteps, { acceptContentChanges: false });

	assert.equal(reconciled.entries.length, 1);
	assert.equal(reconciled.entries[0].responseSha256, originalSha);
	assert.deepEqual(delta.carried, ['A']);
	assert.deepEqual(delta.changed, []);
	assert.deepEqual(delta.added, []);
	assert.deepEqual(delta.retired, []);
});

test('surviving prompt with changed response fails without --accept-content-changes', () => {
	const fixture = makeFixture([{ language: 'java', prompt: 'A', response: 'code-a' }]);
	const newSteps = [makeStep('java', 'A', 'code-a-modified')];

	assert.throws(
		() => reconcile(fixture, newSteps, { acceptContentChanges: false }),
		(err: unknown) => err instanceof ContentChangedError && err.prompt === 'A'
	);
});

test('surviving prompt with changed response records under changed with accept flag', () => {
	const fixture = makeFixture([{ language: 'java', prompt: 'A', response: 'code-a' }]);
	const newSteps = [makeStep('java', 'A', 'code-a-modified')];

	const { fixture: reconciled, delta } = reconcile(fixture, newSteps, { acceptContentChanges: true });

	assert.equal(reconciled.entries.length, 1);
	assert.equal(reconciled.entries[0].responseSha256, sha256('code-a-modified'));
	assert.equal(reconciled.entries[0].responseLength, 'code-a-modified'.length);
	assert.deepEqual(delta.changed, ['A']);
	assert.deepEqual(delta.carried, []);
});

test('new prompt is captured under added with fresh entry', () => {
	const fixture = makeFixture([{ language: 'java', prompt: 'A', response: 'code-a' }]);
	const newSteps = [
		makeStep('java', 'A', 'code-a'),
		makeStep('python', 'B', 'code-b'),
	];

	const { fixture: reconciled, delta } = reconcile(fixture, newSteps, { acceptContentChanges: false });

	assert.equal(reconciled.entries.length, 2);
	assert.equal(reconciled.entries[1].prompt, 'B');
	assert.equal(reconciled.entries[1].responseSha256, sha256('code-b'));
	assert.deepEqual(delta.added, ['B']);
});

test('absent prompt is retired and referencing cases are dropped with index remapping', () => {
	// Old fixture: 3 entries (A, B, C) with cases referencing them.
	const fixture = makeFixture([
		{ language: 'java', prompt: 'A', response: 'code-a' },
		{ language: 'java', prompt: 'B', response: 'code-b' },
		{ language: 'python', prompt: 'C', response: 'code-c' },
	], {
		cases: [
			[0, 0, 0, 0],       // A -> A (survives, remap 0 -> 0)
			[1, 0, 0, 1],       // B -> B (B retires, whole tuple dropped)
			[2, 0, 0, 0],       // C -> A (A survives, C survives, remap C 2 -> 1)
			[0, 0, 0, 1],       // A -> B (matched B retired, drop)
			[2, 0, 0, null],    // C -> null (survives, C 2 -> 1)
		],
		freeCases: [
			['freeform-1', 0, 0],   // -> A (survives 0 -> 0)
			['freeform-2', 0, 1],   // -> B (retired, drop)
			['freeform-3', 0, null],
		],
	});

	// New content: A and C survive, B is gone.
	const newSteps = [
		makeStep('java', 'A', 'code-a'),
		makeStep('python', 'C', 'code-c'),
	];

	const { fixture: reconciled, delta } = reconcile(fixture, newSteps, { acceptContentChanges: false });

	assert.equal(reconciled.entries.length, 2);
	assert.deepEqual(delta.retired, ['B']);
	assert.deepEqual(delta.carried.sort(), ['A', 'C']);

	// Surviving cases remapped: [A -> A], [C -> A remapped to 0 -> 0? no C is at 1 now]
	assert.deepEqual(reconciled.cases, [
		[0, 0, 0, 0],       // A -> A
		[1, 0, 0, 0],       // C (was 2) -> A (was 0)
		[1, 0, 0, null],    // C -> null
	]);

	assert.deepEqual(reconciled.freeCases, [
		['freeform-1', 0, 0],
		['freeform-3', 0, null],
	]);
});

test('reconcile handles a mixed scenario with carry, change, add, and retire', () => {
	const fixture = makeFixture([
		{ language: 'java', prompt: 'A', response: 'code-a' },
		{ language: 'java', prompt: 'B', response: 'code-b' },
		{ language: 'python', prompt: 'C', response: 'code-c' },
	]);
	const newSteps = [
		makeStep('java', 'A', 'code-a'),          // carried
		makeStep('java', 'B', 'code-b-changed'),  // changed
		makeStep('python', 'D', 'code-d'),        // added; C retires
	];

	const { delta } = reconcile(fixture, newSteps, { acceptContentChanges: true });

	assert.deepEqual(delta.carried, ['A']);
	assert.deepEqual(delta.changed, ['B']);
	assert.deepEqual(delta.added, ['D']);
	assert.deepEqual(delta.retired, ['C']);
});

// --check gate: 4 induced-disagreement scenarios, each must exit with a
// clear message naming the specific fix. We stage a synthetic repo layout
// in a tmpdir and vary one dimension per scenario.

function stageRepo(setup: {
	pinTag: string;
	installedVersion: string;
	countLiteral: number;
	fixtureEntries: number;
}): string {
	const root = mkdtempSync(path.join(tmpdir(), 'sync-check-'));
	mkdirSync(path.join(root, 'node_modules', '@aifirst', 'content'), { recursive: true });
	mkdirSync(path.join(root, 'src', 'test'), { recursive: true });
	mkdirSync(path.join(root, 'src', 'unittest'), { recursive: true });
	writeFileSync(path.join(root, 'package.json'), JSON.stringify({
		name: 'test',
		dependencies: {
			'@aifirst/content': `github:aifirstprogramming/aifirstcontent#${setup.pinTag}`,
		},
	}));
	writeFileSync(path.join(root, 'node_modules', '@aifirst', 'content', 'package.json'), JSON.stringify({
		name: '@aifirst/content',
		version: setup.installedVersion,
	}));
	writeFileSync(path.join(root, 'src', 'test', 'extension.test.ts'),
		`content.steps.length, ${setup.countLiteral}, 'ok'`);
	const entries = Array.from({ length: setup.fixtureEntries }, (_, i) => ({
		language: 'java',
		prompt: `p${i}`,
		responseSha256: sha256(`r${i}`),
		responseLength: `r${i}`.length,
	}));
	writeFileSync(path.join(root, 'src', 'unittest', 'matcher.golden.json'),
		JSON.stringify({ entries, cases: [], freeCases: [] }));
	return root;
}

test('check passes when pin, installed version, count literal, and fixture entries all agree', () => {
	const root = stageRepo({ pinTag: 'v1.2.3', installedVersion: '1.2.3', countLiteral: 5, fixtureEntries: 5 });
	try {
		const result = check({ repoRoot: root });
		assert.equal(result.ok, true, `expected ok, got: ${JSON.stringify(result)}`);
		if (result.ok) {
			assert.equal(result.installedVersion, '1.2.3');
			assert.equal(result.fixtureEntries, 5);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('check fails when the package.json pin does not match the installed module version', () => {
	const root = stageRepo({ pinTag: 'v1.2.3', installedVersion: '1.1.9', countLiteral: 5, fixtureEntries: 5 });
	try {
		const result = check({ repoRoot: root });
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.match(result.message, /pin is v1\.2\.3.*is 1\.1\.9/);
			assert.match(result.fix, /npm ci|sync-content\.ts/);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('check fails when the count literal disagrees with fixture entries', () => {
	const root = stageRepo({ pinTag: 'v1.2.3', installedVersion: '1.2.3', countLiteral: 5, fixtureEntries: 7 });
	try {
		const result = check({ repoRoot: root });
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.match(result.message, /content\.steps\.length === 5 .* 7 entries/);
			assert.match(result.fix, /sync-content\.ts --tag v1\.2\.3/);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('individual readers work in isolation for edge inputs', () => {
	// stripV handles both prefixed and bare versions.
	assert.equal(stripV('v1.2.3'), '1.2.3');
	assert.equal(stripV('1.2.3'), '1.2.3');

	const root = stageRepo({ pinTag: 'v2.0.0', installedVersion: '2.0.0', countLiteral: 3, fixtureEntries: 3 });
	try {
		assert.equal(readPinTag(path.join(root, 'package.json')), 'v2.0.0');
		assert.equal(readInstalledVersion(path.join(root, 'node_modules', '@aifirst', 'content', 'package.json')), '2.0.0');
		assert.equal(readCountLiteral(path.join(root, 'src', 'test', 'extension.test.ts')), 3);
		assert.equal(readFixtureCount(path.join(root, 'src', 'unittest', 'matcher.golden.json')), 3);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('check against the current worktree passes (sanity: matches whatever is installed right now)', () => {
	// npm run test:unit invokes node from the repo root, so process.cwd() is
	// the repo root. Use that rather than import.meta.url, which the CJS emit
	// does not expose.
	const result = check({ repoRoot: process.cwd() });
	assert.equal(result.ok, true, `expected ok, got: ${JSON.stringify(result)}`);
});

// updateCountLiteral: a re-run at an unchanged count must be a no-op, not a
// throw. The three cases below keep that boundary from collapsing back into
// a single raw === updated string comparison.

function stageExtensionTest(literal: string): { root: string; file: string } {
	const root = mkdtempSync(path.join(tmpdir(), 'sync-update-count-'));
	const file = path.join(root, 'extension.test.ts');
	writeFileSync(file, literal);
	return { root, file };
}

test('updateCountLiteral is a no-op when the literal already matches the requested count', () => {
	const { root, file } = stageExtensionTest("assert.equal(content.steps.length, 148, 'ok');");
	try {
		const before = readFileSync(file, 'utf8');
		assert.doesNotThrow(() => updateCountLiteral(file, 148));
		assert.equal(readFileSync(file, 'utf8'), before);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('updateCountLiteral rewrites the literal when the count genuinely changes', () => {
	const { root, file } = stageExtensionTest("assert.equal(content.steps.length, 148, 'ok');");
	try {
		updateCountLiteral(file, 151);
		assert.match(readFileSync(file, 'utf8'), /content\.steps\.length, 151/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('updateCountLiteral throws when the count-literal pattern is not found', () => {
	const { root, file } = stageExtensionTest("assert.equal(renamedSteps.length, 148, 'ok');");
	try {
		assert.throws(() => updateCountLiteral(file, 148), /Could not find count literal/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('updateCountLiteral distinguishes no-match from already-correct at the boundary', () => {
	const absent = stageExtensionTest("assert.equal(renamedSteps.length, 148, 'ok');");
	const present = stageExtensionTest("assert.equal(content.steps.length, 148, 'ok');");
	try {
		assert.throws(() => updateCountLiteral(absent.file, 148), /Could not find count literal/);
		assert.doesNotThrow(() => updateCountLiteral(present.file, 148));
	} finally {
		rmSync(absent.root, { recursive: true, force: true });
		rmSync(present.root, { recursive: true, force: true });
	}
});
