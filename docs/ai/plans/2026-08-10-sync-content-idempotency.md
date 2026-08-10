<!-- Captured from a Claude Code session. Do not edit: this is a historical record. -->

> **AI development artifact: implementation plan.**
> This is the plan the agent worked from, captured verbatim from the session that produced it.
> It is *history, not documentation*: where it disagrees with the code, the code is right.
>
> | | |
> | --- | --- |
> | **Session** | `sync-content-idempotency` |
> | **Date approved** | 2026-08-10 |
> | **Outcome** | Shipped. |

---

# Fix updateCountLiteral to distinguish "already correct" from "not found"

## Problem

`updateCountLiteral` in `scripts/sync-content.ts` decided whether it had succeeded by comparing
the file content before and after a regex replace: `if (updated === raw) throw`. That comparison
is true in two different situations: the pattern never matched the file at all, or the pattern
matched but the count was already the requested value. The function threw in both cases, so
re-running `node scripts/sync-content.ts --tag <tag>` against a tag that was already synced failed
loudly even though nothing was wrong. `node scripts/sync-content.ts --check` reported the repo as
fully in sync at the same time `--tag` would hard-fail, which is the idempotency gap this fix
closes.

## What I verified rather than assumed

- Reproduced the bug against the current worktree before touching any code: ran the exact
  `updateCountLiteral` logic against `src/test/extension.test.ts`, which already has the count set
  to the currently pinned tag's value, and confirmed it threw.
- Confirmed `content-sync --check` passes on the same worktree at the same time, proving the two
  code paths disagree about whether the repo needs work.
- Checked that the new regression tests actually exercise the pre-fix bug: I staged the fixed test
  file against the unmodified `check.ts` first. It failed to compile (`updateCountLiteral` had no
  exported member of that name), because the pre-fix function lived in the script and wasn't
  unit-testable at all without shelling out. That confirms the bug was previously untestable in
  isolation, not just untested.
- Read `docs/ai/README.md` and the two plans covering this file before writing any code, per the
  `docs_ai_required` convention. Neither plan anticipated this bug; the automation plan explicitly
  deferred the first real `--tag` run to a later verification stage, and that deferred run is what
  tripped the bug in the first place.

## Decisions

### Move updateCountLiteral into src/sync/check.ts

The function previously lived in `scripts/sync-content.ts`, which runs via Node's TypeScript
type-stripping and isn't imported by the compiled test suite. `check.ts` already exports the other
pure functions this script depends on (`check`, `readCountLiteral`, `stripV`) and is already
imported by `src/unittest/sync-content.test.ts`, so this keeps the count-literal logic next to the
code that reads it and makes it unit-testable without spawning a subprocess. `scripts/sync-content.ts`
now just calls the exported function with the extension-test path and the new count.

Alternative considered: leave it in the script and test it via the `runSync` integration path
end to end. Rejected because it would mean paying for a fake `npm install` per test to reach that
line, and the spec's own sketch pointed at the `src/sync/` relocation as the preferred path.

### Match first, then compare the captured number, not the string

The fix checks `raw.match(pattern)` before anything else. No match throws immediately. A match
whose captured digits already equal the target count returns without writing. Only a match with a
different number triggers the replace and write. This keeps the two failure/no-op cases
structurally separate, so a future edit can't accidentally merge them back into a single
`raw === updated` check the way the original code did.

## How I checked the result

Full 5-step CI gate run locally against the fix, matching `.github/workflows/ci.yml`:

- `npm ci`
- `npm run compile`: pass
- `npm run lint`: pass
- `npm run test:unit`: 19/19 pass (15 pre-existing plus 4 new regression tests covering no-op on
  already-correct, rewrite on genuine change, throw on missing pattern, and the no-match-vs-already-
  correct boundary with two adjacent fixtures)
- `node scripts/sync-content.ts --check`: passes, reports pack 1.4.0 at 148 prompts
- `xvfb-run -a npm test`: 2/2 extension host tests pass (`xvfb-run` was available in this
  devcontainer, so I ran the full gate rather than deferring to CI)

The already-correct regression test is the one this bug was about: I confirmed it fails to even
compile against the pre-fix code (missing export), then confirmed all four new cases pass once the
fix and the relocation landed together.

## Deliberately not touched

- The hardcoded `148` count literal itself. It's out of scope per the card even though a manual
  count of the v1.4.0 content pack suggests a different total; that's the sync script's own
  mechanism to update, not something to hand-edit here.
- `.github/workflows/content-sync.yml`'s `delta.json` handling. That was already fixed in `cabc477`
  on `main` before this branch was cut.
