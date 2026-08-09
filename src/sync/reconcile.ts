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
	const newByPrompt = new Map<string, StepLike>();
	for (const step of newSteps) {
		newByPrompt.set(step.prompt, step);
	}

	const carried: string[] = [];
	const added: string[] = [];
	const changed: string[] = [];
	const retired: string[] = [];

	// remap[oldIdx] = newIdx (missing key means the entry was retired).
	const remap = new Map<number, number>();
	const reconciledEntries: FixtureEntry[] = [];

	fixture.entries.forEach((entry, oldIdx) => {
		const match = newByPrompt.get(entry.prompt);
		if (!match) {
			retired.push(entry.prompt);
			return;
		}

		const newSha = sha256(match.response);
		const newLen = match.response.length;
		const contentChanged = newSha !== entry.responseSha256 || newLen !== entry.responseLength;

		if (contentChanged) {
			if (!opts.acceptContentChanges) {
				throw new ContentChangedError(entry.prompt);
			}
			remap.set(oldIdx, reconciledEntries.length);
			reconciledEntries.push({
				language: match.language,
				prompt: entry.prompt,
				responseSha256: newSha,
				responseLength: newLen,
			});
			changed.push(entry.prompt);
			return;
		}

		remap.set(oldIdx, reconciledEntries.length);
		reconciledEntries.push(entry);
		carried.push(entry.prompt);
	});

	// New content steps whose prompt text is not already an entry become fresh entries.
	const oldPromptSet = new Set(fixture.entries.map(e => e.prompt));
	const addedIndices: number[] = [];
	for (const step of newSteps) {
		if (oldPromptSet.has(step.prompt)) {
			continue;
		}
		addedIndices.push(reconciledEntries.length);
		reconciledEntries.push({
			language: step.language,
			prompt: step.prompt,
			responseSha256: sha256(step.response),
			responseLength: step.response.length,
		});
		added.push(step.prompt);
	}

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
