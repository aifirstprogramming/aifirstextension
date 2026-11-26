import { defineConfig } from '@vscode/test-cli';

// One configuration per VS Code build the extension is tested against. Each
// build has a defined job; see docs/testing/compat-checklist.md.
//   min      - the declared engines minimum: core features must work here.
//   stable   - pinned current Stable: native chat is certified on this build.
//              Bump it deliberately when a new Stable is certified.
//   latest   - floating Stable, for the weekly canary.
//   insiders - early warning only; failures never block a release.
// Run one with `npx vscode-test --label <name>`; with no label, all run.
const shared = {
	files: 'out/test/**/*.test.js',
	mocha: { timeout: 20000 },
};

export default defineConfig([
	{ ...shared, label: 'min', version: '1.104.0' },
	{ ...shared, label: 'stable', version: '1.148.0' },
	{ ...shared, label: 'latest', version: 'stable' },
	{ ...shared, label: 'insiders', version: 'insiders' },
]);
