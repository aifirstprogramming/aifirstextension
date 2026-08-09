/*
 * Shared fixture constants for the golden matcher regression test and the
 * content-sync tool. Both need to agree on the variant transforms and language
 * scopes exercised in the fixture: the test replays every historical case,
 * and the sync tool generates fresh cases for newly authored prompts using the
 * same grid. Keep them here (not in the test file) so a drift is impossible.
 */

/** Prompt transforms applied to every authored prompt when building the fixture. */
export const VARIANTS: Record<number, (prompt: string) => string> = {
	0: p => p,
	1: p => p.toUpperCase(),
	2: p => `   ${p}\n `,
	3: p => `<prompt>${p}</prompt>`,
	4: p => p.split(/\s+/).slice(0, Math.ceil(p.split(/\s+/).length / 2)).join(' '),
	5: p => `${p} please`,
};

/** Language scopes probed for every prompt. `undefined` models "no active editor language". */
export const scopes: (string | undefined)[] = ['python', 'java', undefined, 'plaintext', 'javascript'];
