/*
 * Content sync CLI. Two modes:
 *
 *   node scripts/sync-content.ts --check
 *     Verify the package.json pin, the actually-installed module version, the
 *     count assertion in extension.test.ts, and the golden fixture all agree.
 *     Exits non-zero and names the fix if any pair disagrees. This is the CI gate.
 *
 *   node scripts/sync-content.ts --tag <tag> [--accept-content-changes]
 *     Bump the @aifirst/content pin to <tag>, reinstall cleanly, verify the
 *     installed module's own package.json now reports <tag>, then reconcile
 *     the golden fixture: carry surviving prompts forward (fail loudly if a
 *     prompt's response changed unless --accept-content-changes was passed),
 *     add new prompts, drop retired ones, and remap case indices.
 *
 * --accept-content-changes is deliberately NOT a default and has no env-var or
 * package.json escape hatch. A bare `--tag <tag>` invocation is strict and will
 * refuse to silently rewrite a surviving prompt's expected hash.
 *
 * Runs under `node script.ts` via Node 22 type-stripping (no bun/ts-node).
 * Relative imports carry the .ts extension for that mode; the same modules
 * also compile via tsc when tests import them from `out/`.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import {
	reconcile,
	ContentChangedError,
	type Fixture,
	type StepLike,
	type MatchFn,
} from '../src/sync/reconcile.ts';
import { check, stripV, updateCountLiteral } from '../src/sync/check.ts';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const FIXTURE_PATH = path.join(REPO_ROOT, 'src', 'unittest', 'matcher.golden.json');
const EXTENSION_TEST = path.join(REPO_ROOT, 'src', 'test', 'extension.test.ts');
const CONTENT_DEP = '@aifirst/content';
const REQUIRE = createRequire(path.join(REPO_ROOT, 'package.json'));

interface ParsedArgs {
	check: boolean;
	tag: string | null;
	accept: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
	let checkMode = false;
	let tag: string | null = null;
	let accept = false;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--check') {
			checkMode = true;
		} else if (arg === '--tag') {
			tag = argv[++i] ?? null;
		} else if (arg.startsWith('--tag=')) {
			tag = arg.slice('--tag='.length);
		} else if (arg === '--accept-content-changes') {
			accept = true;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return { check: checkMode, tag, accept };
}

function readContentSteps(): StepLike[] {
	// require.resolve honours the package's subpath exports; that is why we can
	// load the two book JSONs even though the package has no `./package.json`
	// export. The module's runtime package.json is read from disk explicitly.
	const javaBook = REQUIRE('@aifirst/content/books/ai-first-java-programming.json');
	const pythonBook = REQUIRE('@aifirst/content/books/ai-first-python-programming.json');
	const { loadFromRaw } = REQUIRE('@aifirst/content');
	const content = loadFromRaw([
		{ filename: 'ai-first-java-programming.json', book: javaBook },
		{ filename: 'ai-first-python-programming.json', book: pythonBook },
	]);
	return content.steps;
}

function loadFindMatch(): MatchFn {
	const { findMatch, unwrapPromptTag } = REQUIRE('@aifirst/content');
	return (prompt, steps, scope) => findMatch(unwrapPromptTag(prompt), steps, scope);
}

function bumpPin(tag: string): void {
	const raw = readFileSync(PACKAGE_JSON, 'utf8');
	const pkg = JSON.parse(raw);
	if (!pkg.dependencies) {
		pkg.dependencies = {};
	}
	pkg.dependencies[CONTENT_DEP] = `github:aifirstprogramming/aifirstcontent#${tag}`;
	writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
}

function reinstall(): void {
	rmSync(path.join(REPO_ROOT, 'node_modules'), { recursive: true, force: true });
	rmSync(path.join(REPO_ROOT, 'package-lock.json'), { force: true });
	execSync('npm cache clean --force', { cwd: REPO_ROOT, stdio: 'inherit' });
	execSync('npm install', { cwd: REPO_ROOT, stdio: 'inherit' });
}

function readInstalledVersion(): string {
	// Cannot use REQUIRE('@aifirst/content/package.json'): the package's exports
	// map has no ./package.json entry, so subpath resolution errors. Reading the
	// file directly bypasses that and is the "no false pass" guarantee.
	const installedPkgPath = path.join(REPO_ROOT, 'node_modules', '@aifirst', 'content', 'package.json');
	const raw = readFileSync(installedPkgPath, 'utf8');
	return JSON.parse(raw).version;
}

function runCheck(): void {
	const result = check({ repoRoot: REPO_ROOT });
	if (result.ok) {
		console.log(result.message);
		return;
	}
	console.error(result.message);
	console.error(result.fix);
	process.exit(1);
}

function runSync(tag: string, accept: boolean): void {
	console.log(`Bumping ${CONTENT_DEP} pin to ${tag}...`);
	bumpPin(tag);

	console.log('Reinstalling...');
	reinstall();

	const installed = readInstalledVersion();
	const requested = stripV(tag);
	if (installed !== requested) {
		console.error(`Requested ${tag} but node_modules/@aifirst/content resolved to ${installed}. Aborting.`);
		process.exit(1);
	}
	console.log(`Installed ${CONTENT_DEP}@${installed} confirmed at runtime.`);

	const newSteps = readContentSteps();
	const fixtureRaw = readFileSync(FIXTURE_PATH, 'utf8');
	const fixture: Fixture = JSON.parse(fixtureRaw);

	let result;
	try {
		result = reconcile(fixture, newSteps, {
			acceptContentChanges: accept,
			findMatch: loadFindMatch(),
		});
	} catch (err) {
		if (err instanceof ContentChangedError) {
			console.error(err.message);
			console.error(`Run "node scripts/sync-content.ts --tag ${tag} --accept-content-changes" and commit the result.`);
			process.exit(1);
		}
		throw err;
	}

	const { fixture: reconciled, delta } = result;

	writeFileSync(FIXTURE_PATH, JSON.stringify(reconciled, null, '\t') + '\n');
	updateCountLiteral(EXTENSION_TEST, reconciled.entries.length);

	console.log(`Content sync to ${tag}: ${fixture.entries.length} -> ${reconciled.entries.length} prompts.`);
	console.log(`  carried:  ${delta.carried.length}`);
	console.log(`  changed:  ${delta.changed.length}`);
	console.log(`  added:    ${delta.added.length}`);
	console.log(`  retired:  ${delta.retired.length}`);
	if (delta.retired.length > 0) {
		console.log('Retired prompts:');
		for (const p of delta.retired) {
			console.log(`  - ${p}`);
		}
	}
	// Machine-readable single line so a calling workflow can jq the summary out.
	console.log('DELTA_JSON:' + JSON.stringify({ tag, oldCount: fixture.entries.length, newCount: reconciled.entries.length, ...delta }));

	// Sanity-check the just-written fixture and the just-updated count literal
	// against the just-installed module. This is the same gate CI will run.
	const finalCheck = check({ repoRoot: REPO_ROOT });
	if (!finalCheck.ok) {
		console.error('Post-sync check failed:');
		console.error(finalCheck.message);
		console.error(finalCheck.fix);
		process.exit(1);
	}
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));

	if (args.check) {
		runCheck();
		return;
	}

	if (!args.tag) {
		console.error('Usage: node scripts/sync-content.ts --check');
		console.error('       node scripts/sync-content.ts --tag <tag> [--accept-content-changes]');
		process.exit(1);
	}

	runSync(args.tag, args.accept);
}

main();
