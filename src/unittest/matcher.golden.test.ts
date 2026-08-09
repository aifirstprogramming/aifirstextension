/*
 * Golden regression test for prompt -> code matching.
 *
 * The books promise that a printed prompt yields the printed code. That promise
 * is now kept by `@aifirst/content`, shared with the `aifirst` CLI, rather than
 * by a matcher inlined in this extension.
 *
 * `matcher.golden.json` was captured from the OLD inlined matcher (commit
 * 9b47d76, v1.4.0) before that migration. This test replays every case through
 * the shared implementation and asserts nothing moved. If it fails, a reader is
 * being shown different code than before. Treat that as a bug unless the change
 * was deliberate, in which case regenerate the fixture and say so in CHANGELOG.
 *
 * Runs under plain `node --test` (see `npm run test:unit`); it deliberately does
 * not touch the `vscode` API, which is why it lives outside `src/test/`.
 */

import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMatch, unwrapPromptTag, type Step } from '@aifirst/content';
import { getBookContent } from '../bookContent';
import { VARIANTS, scopes } from './golden.fixtures';
import golden from './matcher.golden.json';

const steps: readonly Step[] = getBookContent().steps;

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

/** Index of the matched step, or null: the identity the fixture records. */
function matchIndex(prompt: string, language: string | undefined): number | null {
	// No fourth argument: findMatch's default preference is this extension's
	// python -> java -> other fallthrough. Passing one changes what readers see.
	const match = findMatch(unwrapPromptTag(prompt), steps, language);
	return match === null ? null : steps.indexOf(match);
}

test('the prompt index is unchanged: same entries, same order, byte-identical responses', () => {
	assert.equal(steps.length, golden.entries.length);

	golden.entries.forEach((expected, i) => {
		const step = steps[i];
		assert.equal(step.prompt, expected.prompt, `prompt ${i} differs`);
		assert.equal(step.language, expected.language, `language of entry ${i} differs`);
		assert.equal(step.response.length, expected.responseLength, `response length of entry ${i} differs`);
		assert.equal(sha256(step.response), expected.responseSha256, `response of entry ${i} is not byte-identical`);
	});
});

test('every authored prompt resolves exactly as it did before the migration', () => {
	const cases = golden.cases as number[][];
	assert.ok(cases.length > 0);

	for (const [entryIndex, variantId, scopeId, expected] of cases) {
		const prompt = VARIANTS[variantId](golden.entries[entryIndex].prompt);
		const language = scopes[scopeId];
		assert.equal(
			matchIndex(prompt, language),
			expected,
			`entry ${entryIndex} (${golden.variants[String(variantId) as keyof typeof golden.variants]}) ` +
			`in scope ${String(language)} now resolves differently`
		);
	}
});

test('free-form and non-matching prompts resolve exactly as they did before', () => {
	const freeCases = golden.freeCases as (string | number | null)[][];
	assert.ok(freeCases.length > 0);

	for (const [prompt, scopeId, expected] of freeCases) {
		const language = scopes[scopeId as number];
		assert.equal(
			matchIndex(prompt as string, language),
			expected,
			`free-form prompt ${JSON.stringify(prompt)} in scope ${String(language)} now resolves differently`
		);
	}
});

test('a known language never falls through to the other book', () => {
	for (const step of steps) {
		const other = step.language === 'python' ? 'java' : 'python';
		const match = findMatch(step.prompt, steps, other);
		assert.notEqual(match?.language, step.language,
			`prompt ${JSON.stringify(step.prompt)} leaked across the ${other} scope`);
	}
});
