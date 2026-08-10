/*
 * Consistency checks that gate CI. The four things being reconciled - the
 * package.json pin, the actually-installed module version, the count literal
 * in `extension.test.ts`, and the golden fixture entries - can each be edited
 * or updated independently and diverge silently. This code reads them all and
 * fails loudly when they don't agree, naming the exact fix.
 *
 * The install-time version is read from the module's own package.json rather
 * than trusted from the pin, because a stale npm cache is a real-world source
 * of "package.json says v1.1.1 but node_modules is still v1.1.0" false passes.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const CONTENT_DEP = '@aifirst/content';
const COUNT_RE = /content\.steps\.length\s*,\s*(\d+)/;
const PIN_RE = /#(v?[^"'\s]+)$/;

export interface CheckPaths {
	repoRoot: string;
	packageJson?: string;
	installedPackageJson?: string;
	extensionTest?: string;
	fixture?: string;
}

export interface CheckSuccess {
	ok: true;
	message: string;
	pinTag: string;
	installedVersion: string;
	countLiteral: number;
	fixtureEntries: number;
}

export interface CheckFailure {
	ok: false;
	message: string;
	fix: string;
}

export type CheckResult = CheckSuccess | CheckFailure;

export function resolvePaths(paths: CheckPaths): Required<CheckPaths> {
	const repoRoot = paths.repoRoot;
	return {
		repoRoot,
		packageJson: paths.packageJson ?? path.join(repoRoot, 'package.json'),
		installedPackageJson: paths.installedPackageJson ?? path.join(repoRoot, 'node_modules', '@aifirst', 'content', 'package.json'),
		extensionTest: paths.extensionTest ?? path.join(repoRoot, 'src', 'test', 'extension.test.ts'),
		fixture: paths.fixture ?? path.join(repoRoot, 'src', 'unittest', 'matcher.golden.json'),
	};
}

export function readPinTag(packageJsonPath: string): string {
	const raw = readFileSync(packageJsonPath, 'utf8');
	const pkg = JSON.parse(raw);
	const dep: string | undefined = pkg.dependencies?.[CONTENT_DEP];
	if (!dep) {
		throw new Error(`${packageJsonPath} has no ${CONTENT_DEP} dependency.`);
	}
	const match = dep.match(PIN_RE);
	if (!match) {
		throw new Error(`Could not parse tag from ${CONTENT_DEP} pin ${JSON.stringify(dep)}.`);
	}
	return match[1];
}

export function readInstalledVersion(installedPackageJsonPath: string): string {
	// Reading the installed module's own package.json - NOT the pin - is what
	// catches an out-of-date node_modules that would otherwise pass silently.
	const raw = readFileSync(installedPackageJsonPath, 'utf8');
	const pkg = JSON.parse(raw);
	if (typeof pkg.version !== 'string') {
		throw new Error(`${installedPackageJsonPath} has no version field.`);
	}
	return pkg.version;
}

export function readCountLiteral(extensionTestPath: string): number {
	const raw = readFileSync(extensionTestPath, 'utf8');
	const match = raw.match(COUNT_RE);
	if (!match) {
		throw new Error(`Could not find "content.steps.length, <N>" literal in ${extensionTestPath}.`);
	}
	return Number(match[1]);
}

export function readFixtureCount(fixturePath: string): number {
	const raw = readFileSync(fixturePath, 'utf8');
	const fixture = JSON.parse(raw);
	if (!Array.isArray(fixture.entries)) {
		throw new Error(`${fixturePath} has no entries array.`);
	}
	return fixture.entries.length;
}

/** Strip the leading v from a tag so it can be compared to a semver version. */
export function stripV(tag: string): string {
	return tag.startsWith('v') ? tag.slice(1) : tag;
}

const COUNT_REPLACE_RE = /(content\.steps\.length\s*,\s*)(\d+)/;

/**
 * Write newCount into the extension.test.ts count literal. A missing pattern
 * always throws; a pattern already equal to newCount is a no-op, not a throw,
 * so re-running a sync at an unchanged count stays quiet.
 */
export function updateCountLiteral(extensionTestPath: string, newCount: number): void {
	const raw = readFileSync(extensionTestPath, 'utf8');
	const match = raw.match(COUNT_REPLACE_RE);
	if (!match) {
		throw new Error(`Could not find count literal in ${extensionTestPath}.`);
	}
	if (Number(match[2]) === newCount) {
		return;
	}
	writeFileSync(extensionTestPath, raw.replace(COUNT_REPLACE_RE, `$1${newCount}`));
}

export function check(paths: CheckPaths): CheckResult {
	const p = resolvePaths(paths);
	const pinTag = readPinTag(p.packageJson);
	const installedVersion = readInstalledVersion(p.installedPackageJson);
	const countLiteral = readCountLiteral(p.extensionTest);
	const fixtureEntries = readFixtureCount(p.fixture);

	if (stripV(pinTag) !== installedVersion) {
		return {
			ok: false,
			message: `package.json pin is ${pinTag} but node_modules/@aifirst/content is ${installedVersion}.`,
			fix: `Run "npm ci" (or "node scripts/sync-content.ts --tag ${pinTag} --accept-content-changes") and commit the result.`,
		};
	}

	if (countLiteral !== fixtureEntries) {
		return {
			ok: false,
			message: `extension.test.ts asserts content.steps.length === ${countLiteral} but the golden fixture has ${fixtureEntries} entries.`,
			fix: `Run "node scripts/sync-content.ts --tag v${installedVersion} --accept-content-changes" and commit the result.`,
		};
	}

	return {
		ok: true,
		pinTag,
		installedVersion,
		countLiteral,
		fixtureEntries,
		message: `✓ content in sync (pack ${installedVersion}, ${fixtureEntries} prompts).`,
	};
}
