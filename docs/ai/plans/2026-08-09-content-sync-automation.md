<!-- Captured from a Claude Code session. Do not edit: this is a historical record. -->

> **AI development artifact: implementation plan.**
> This is the plan Claude Code proposed and worked from, captured verbatim from the session that
> produced it. It records the reasoning, the measurements and the trade-offs behind the change.
> It is *history, not documentation*: where it disagrees with the code, the code is right.
>
> | | |
> | --- | --- |
> | **Session** | `content-sync-automation` |
> | **Date approved** | 2026-08-09 |
> | **Outcome** | **Landed steps 1-4**. Step 7 (first real `workflow_dispatch` run against `v1.4.0`) is deferred to the independent verifier stage per the intake addendum; the runtime-generated CHANGELOG entry and dated plan file will appear once that run lands. |

---

# Automate content sync into the VS Code extension

## Context

The extension consumes book content through `@aifirst/content`, pinned by git tag in `package.json`.
Every release of that package needs three things updated here in lockstep: the pin bump, the count
assertion in `src/test/extension.test.ts`, and the golden fixture in `src/unittest/matcher.golden.json`.
Doing that by hand is error-prone in a specific way: stale npm caches produce a convincing "the pin
in package.json says v1.1.1" reading while `node_modules/@aifirst/content/package.json` is still
v1.1.0. The fixture and the count assertion can drift independently of each other too. So the goal is
a script that owns all four dimensions at once, plus a CI gate that fails loudly whenever they
disagree, plus a workflow that runs the whole cycle unattended when the content repo publishes a tag.

The card explicitly scopes this task to steps 1-4 (script, fixture reconciliation + shared fixtures
module, `ci.yml`, `content-sync.yml`). Step 7 - firing the first real `workflow_dispatch` at
`v1.4.0` - happens in the independent verifier stage, not here.

## Decisions

### Where the reconciliation code lives, and how the script runs

Node 22 ships native TypeScript type-stripping, so `node scripts/sync-content.ts` runs directly with
no bundler. That works for the CLI wrapper, but the reconciliation logic also needs to be reachable
from a compiled test under `out/unittest/`. Three options: duplicate the code, move it under `src/`
and have the script import the compiled JS, or move it under `src/` and have both consumers import
the `.ts` source. Duplication was the wrong answer for something this fiddly; the "compile first"
option chained on top of the sync workflow's own `rm -rf node_modules && npm install`, which fights
with the invocation order. The one I picked: enable `allowImportingTsExtensions` and
`rewriteRelativeImportExtensions` in `tsconfig.json`. That lets `src/sync/reconcile.ts` import from
`../unittest/golden.fixtures.ts` with an explicit `.ts` extension - which Node's type-stripping
follows verbatim, and which tsc rewrites to `.js` on emit. tsc still emits normal CommonJS under
`module: Node16`, so nothing in the extension host code path changes.

The one deviation forced by strip-only mode: TypeScript's "parameter property" shorthand
(`constructor(public readonly x: string) {}`) is not supported. `ContentChangedError` uses an
explicit field declaration and assignment instead.

### `--accept-content-changes` is never a default

Content churn between releases falls into two shapes. New prompts appearing, old prompts retiring
and cases getting remapped are structural changes we always accept. A surviving prompt whose response
text changed is the dangerous case: the fixture's whole job is to catch that so a reader is not
silently shown different code than the book. So the script refuses to rewrite a surviving prompt's
recorded hash unless `--accept-content-changes` was passed literally on the command line. There is no
env-var default, no package.json script that pre-supplies it. The sync workflow passes it explicitly
because it is running against a release the content repo has already signed off on; a human running
a bare `--tag v...` gets the strict mode.

### The four-way check

`--check` mode verifies four things against each other, and each disagreement prints the fix in the
form the spec dictated: `Run "node scripts/sync-content.ts --tag <tag> --accept-content-changes" and
commit the result.` The four values are the package.json pin tag, the actually-installed module
version (read from `node_modules/@aifirst/content/package.json` with `readFileSync`, not from
`require('@aifirst/content/package.json')` because the package's exports map has no
`./package.json` entry), the count literal in `extension.test.ts`, and the fixture's own
`entries.length`. Reading the installed module's own file is the anti-false-pass guard: if
`npm ci` restored an old node_modules from cache, the pin will look right but the on-disk version
will not.

### Reconciliation, index remapping, and generated cases

Reconciliation is the crux. For each old fixture entry, look up its prompt text in the new content:
if the prompt is gone, retire it; if the prompt is there and the response hash matches, carry the
entry unchanged; if the hash differs, refresh under `--accept-content-changes` or fail loudly
otherwise. Then walk the new content and add fresh entries for prompts not in the old fixture.

Cases and freeCases both reference entries by index. When entries retire, indices shift. The remap
runs alongside the entry reconciliation: I build an old-index-to-new-index map, then rewrite every
case tuple's `entryIndex` and `matchedEntryIndex` through it. Cases that referenced a retired entry
in either slot get dropped entirely (they were testing an exercise that no longer exists). This is
tested directly in `src/unittest/sync-content.test.ts`; it is the subtle part.

For newly added entries the reconciler generates fresh cases when a matcher function is supplied,
using the `VARIANTS` and `scopes` from the shared `src/unittest/golden.fixtures.ts` module. That is
what "reuse from one shared module" means in practice: the test file and the sync script pull from
the same source of truth, and cannot drift.

## Work

New files:

- `src/unittest/golden.fixtures.ts`: VARIANTS and scopes, hardcoded (no JSON import, so it also
  works under Node type-stripping which does not accept JSON without an assertion).
- `src/sync/reconcile.ts`: pure reconciliation function, `sha256`, `ContentChangedError`, types.
- `src/sync/check.ts`: the four-way `--check` logic, as small pure readers so the tests can drive
  each one directly.
- `scripts/sync-content.ts`: the CLI wrapper. It parses args, bumps the pin, reinstalls (`rm -rf
  node_modules && rm -f package-lock.json && npm cache clean --force && npm install`), asserts the
  runtime version, calls `reconcile`, writes the fixture, updates the count literal, prints the
  human summary plus a `DELTA_JSON:` line the workflow parses.
- `src/unittest/sync-content.test.ts`: 11 test cases exercising `reconcile` (carry, carry-changed
  strict / carry-changed-accept / add / retire-with-remap / mixed) and `check` (all-agree pass, pin
  vs installed mismatch, count vs fixture mismatch, individual readers, and a sanity check against
  the actual worktree).
- `.github/workflows/ci.yml`: the gate. Checkout, setup-node 22, `npm ci`, compile, lint,
  `test:unit`, `node scripts/sync-content.ts --check`, then `xvfb-run -a npm test` after installing
  xvfb explicitly (ubuntu-latest ships it today but that is not part of the setup-node contract).
- `.github/workflows/content-sync.yml`: `repository_dispatch: [content-released]` and
  `workflow_dispatch` with a required `tag` input. Runs the script with `--accept-content-changes`,
  reads the emitted DELTA_JSON, then runs the full CI gate. On success, if the delta shows any
  change, it bumps the extension's own minor version, writes a CHANGELOG entry, writes a runtime
  build-record plan file, commits and pushes to main. On failure it opens a GitHub issue naming the
  tag and pointing at the workflow run.
- `docs/ai/plans/2026-08-09-content-sync-automation.md`: this file.

Modified files:

- `src/unittest/matcher.golden.test.ts`: VARIANTS and scopes now import from `./golden.fixtures`.
  Nothing else changed; all four existing tests still pass verbatim.
- `tsconfig.json`: added `allowImportingTsExtensions: true` and `rewriteRelativeImportExtensions:
  true`, and an explicit `include: ["src/**/*"]` so tsc does not try to compile `scripts/` (which
  runs via type-stripping instead).

Deliberately not touched:

- `src/test/extension.test.ts`: the count literal update runs when the sync script executes for
  real, which is step 7's job in the verifier stage, not this task.
- `package.json`'s `@aifirst/content` dependency pin: same reason. It stays at v1.1.1 until the
  first `workflow_dispatch` run lands.

## Verification

- `npm run compile`: passes.
- `npm run lint`: passes, no warnings.
- `npm run test:unit`: 19 tests total (4 pre-existing golden matcher tests, 15 new sync-content
  tests), all pass.
- `node scripts/sync-content.ts --check`: passes with `✓ content in sync (pack 1.1.1, 48 prompts).`
  against the current v1.1.1 pin, confirming the gate is green today.
- `npm test` (Electron host tests): not run here. That path needs a display and runs in CI under
  `xvfb-run`.
- The real `content-sync.yml` run against `v1.4.0`: deferred to the independent verifier stage per
  the intake addendum. When that run lands, it will produce a `docs/ai/plans/2026-08-XX-content-sync-v1.4.0.md`
  plan file and a CHANGELOG entry naming the retired prompts.

## Notes for the verifier

- Type-stripping mode chose to warn `MODULE_TYPELESS_PACKAGE_JSON` because `package.json` has no
  `"type"` field. Adding `"type": "module"` would break the existing CommonJS emit the extension
  host loads, so I left it. The warning is informational and can be suppressed on the workflow side
  with `NODE_NO_WARNINGS=1` if it becomes noisy.
- `git worktree list` at session start showed only the main worktree; the `feat/content-sync-automation`
  branch and worktree had to be recreated from `upstream/main`. If the verifier picks up from a
  fresh checkout, that step is a no-op.
