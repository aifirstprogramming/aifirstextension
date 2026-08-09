/*
 * Golden-fixture reconciliation for a new content release.
 *
 * The fixture (`src/unittest/matcher.golden.json`) records, for every authored
 * prompt, the sha256 and length of the exact response a reader is supposed to
 * see. When content is bumped to a new tag, we do NOT regenerate the fixture
 * from scratch: we carry surviving prompts forward (their recorded hash stays
 * a real assertion), refresh entries only when explicitly accepted, add fresh
 * entries for new prompts, and drop entries for prompts that went away. Cases
 * and freeCases refer to entries by index; those indices are remapped here so
 * they still address the same prompts after the entries array shifts.
 */

import { createHash } from 'node:crypto';
import { VARIANTS, scopes } from '../unittest/golden.fixtures.ts';

export interface FixtureEntry {
	language: string;
	prompt: string;
	responseSha256: string;
	responseLength: number;
}

export interface StepLike {
	language: string;
	prompt: string;
	response: string;
}

export type CaseTuple = [number, number, number, number | null];
export type FreeCaseTuple = [string, number, number | null];

export interface Fixture {
	_comment?: string;
	scopes: (string | null)[];
	variants: Record<string, string>;
	caseFormat: string;
	freeCaseFormat: string;
	entries: FixtureEntry[];
	cases: CaseTuple[];
	freeCases: FreeCaseTuple[];
}

export interface Delta {
	carried: string[];
	added: string[];
	changed: string[];
	retired: string[];
}

export interface ReconcileResult {
	fixture: Fixture;
	delta: Delta;
}

export type MatchFn = (prompt: string, steps: readonly StepLike[], scope: string | undefined) => StepLike | null;

export interface ReconcileOptions {
	acceptContentChanges: boolean;
	/** If provided, fresh cases are generated for newly added prompts. */
	findMatch?: MatchFn;
}

/** Standalone so tests and CLI agree on the exact hash function. */
export function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

export class ContentChangedError extends Error {
	readonly prompt: string;
	constructor(prompt: string) {
		super(`Prompt content changed for ${JSON.stringify(prompt)}. Rerun with --accept-content-changes to accept.`);
		this.name = 'ContentChangedError';
		this.prompt = prompt;
	}
}

export function reconcile(
	fixture: Fixture,
	newSteps: readonly StepLike[],
	opts: ReconcileOptions
): ReconcileResult {
	// Entries must come out in the SAME order as newSteps (pack order), not
	// fixture order with additions tacked on at the end. matchIndex() in the
	// golden test resolves a match via steps.indexOf(), a pack-order index,
	// and compares it against fixture indices produced here. If added prompts
	// landed at the tail instead of their true pack position, those two
	// coordinate systems would only agree by coincidence (and did, until the
	// first release that actually added prompts instead of just editing them).
	const oldByPrompt = new Map<string, { entry: FixtureEntry; oldIdx: number }>();
	fixture.entries.forEach((entry, oldIdx) => {
		oldByPrompt.set(entry.prompt, { entry, oldIdx });
	});

	const carried: string[] = [];
	const added: string[] = [];
	const changed: string[] = [];
	const retired: string[] = [];

	// remap[oldIdx] = newIdx (missing key means the entry was retired).
	const remap = new Map<number, number>();
	const reconciledEntries: FixtureEntry[] = [];
	const addedIndices: number[] = [];
	const seenOldIndices = new Set<number>();

	newSteps.forEach((step, newIdx) => {
		const existing = oldByPrompt.get(step.prompt);
		if (!existing) {
			addedIndices.push(newIdx);
			reconciledEntries.push({
				language: step.language,
				prompt: step.prompt,
				responseSha256: sha256(step.response),
				responseLength: step.response.length,
			});
			added.push(step.prompt);
			return;
		}

		seenOldIndices.add(existing.oldIdx);
		const newSha = sha256(step.response);
		const newLen = step.response.length;
		const contentChanged = newSha !== existing.entry.responseSha256 || newLen !== existing.entry.responseLength;

		if (contentChanged) {
			if (!opts.acceptContentChanges) {
				throw new ContentChangedError(existing.entry.prompt);
			}
			remap.set(existing.oldIdx, newIdx);
			reconciledEntries.push({
				language: step.language,
				prompt: existing.entry.prompt,
				responseSha256: newSha,
				responseLength: newLen,
			});
			changed.push(existing.entry.prompt);
			return;
		}

		remap.set(existing.oldIdx, newIdx);
		reconciledEntries.push(existing.entry);
		carried.push(existing.entry.prompt);
	});

	// Any fixture entry never matched against newSteps went away upstream.
	fixture.entries.forEach((entry, oldIdx) => {
		if (!seenOldIndices.has(oldIdx)) {
			retired.push(entry.prompt);
		}
	});

	const reconciledCases: CaseTuple[] = [];
	for (const tuple of fixture.cases) {
		const [entryIndex, variantId, scopeId, matched] = tuple;
		const newEntryIdx = remap.get(entryIndex);
		if (newEntryIdx === undefined) {
			continue;
		}
		let newMatched: number | null;
		if (matched === null) {
			newMatched = null;
		} else {
			const remapped = remap.get(matched);
			if (remapped === undefined) {
				continue;
			}
			newMatched = remapped;
		}
		reconciledCases.push([newEntryIdx, variantId, scopeId, newMatched]);
	}

	const reconciledFreeCases: FreeCaseTuple[] = [];
	for (const tuple of fixture.freeCases) {
		const [prompt, scopeId, matched] = tuple;
		let newMatched: number | null;
		if (matched === null) {
			newMatched = null;
		} else {
			const remapped = remap.get(matched);
			if (remapped === undefined) {
				continue;
			}
			newMatched = remapped;
		}
		reconciledFreeCases.push([prompt, scopeId, newMatched]);
	}

	// When a matcher is supplied, generate a fresh grid of cases for each
	// newly added entry so the fixture stays fully covered without the caller
	// having to hand-author them. Without a matcher we still emit the entry,
	// but its cases stay empty until the next reconcile.
	if (opts.findMatch && addedIndices.length > 0) {
		const findMatch = opts.findMatch;
		const entryByPromptLang = new Map<string, number>();
		reconciledEntries.forEach((e, i) => {
			entryByPromptLang.set(`${e.language}::${e.prompt}`, i);
		});
		for (const newIdx of addedIndices) {
			const entry = reconciledEntries[newIdx];
			for (const variantIdStr of Object.keys(VARIANTS)) {
				const variantId = Number(variantIdStr);
				const promptVariant = VARIANTS[variantId](entry.prompt);
				for (let scopeId = 0; scopeId < scopes.length; scopeId++) {
					const scope = scopes[scopeId];
					const match = findMatch(promptVariant, newSteps, scope);
					let matchedIdx: number | null;
					if (match === null) {
						matchedIdx = null;
					} else {
						const key = `${match.language}::${match.prompt}`;
						const idx = entryByPromptLang.get(key);
						matchedIdx = idx === undefined ? null : idx;
					}
					reconciledCases.push([newIdx, variantId, scopeId, matchedIdx]);
				}
			}
		}
	}

	const reconciledFixture: Fixture = {
		...fixture,
		entries: reconciledEntries,
		cases: reconciledCases,
		freeCases: reconciledFreeCases,
	};

	return { fixture: reconciledFixture, delta: { carried, added, changed, retired } };
}
