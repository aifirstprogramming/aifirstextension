<!-- Captured from a Claude Code session. Do not edit: this is a historical record. -->

> **AI development artifact — implementation plan.**
> This is the plan Claude Code proposed and worked from, captured verbatim from the session that
> produced it. It records the reasoning, the measurements and the trade-offs behind the change.
> It is *history, not documentation*: where it disagrees with the code, the code is right.
>
> | | |
> | --- | --- |
> | **Session** | `5ed30dd0` |
> | **Date approved** | 2026-08-09 |
> | **Outcome** | **Proposed — not implemented.** No commit yet implements it; the latest release is 1.5.0 |

---

# `@aifirst` in the chat pane — file-creating exercises for the unit-test chapters

## Context

Every book exercise so far has been one file: paste a prompt, get one block of code, compare it
with the page. The unit-test chapters break that shape. **Python Chapter 7 "Unit Tests" (12
examples)** and **Java Chapter 6 "Testing with AI Confidence" (15 examples)** teach testing, and a
test needs *two* files — the code under test and the test that imports it. `py-7-04`'s response
opens `from pet_talents import RobotPet`; `java-6-03`'s `ThermostatTest` needs `Thermostat.java`
beside it. Neither can run pasted into a scratch buffer.

So this chapter needs the chat pane and the ability to create, edit, and run files. Two
requirements, met by two different mechanisms:

- **Repeatable** — the learner must end up with the code printed in the book. A real model asked to
  "write a unit test for the RobotPet class" invents a plausible variation every run.
- **Token-free** — a learner must be able to work through a chapter without burning AI credits.

## What is already true (verified, not assumed)

**The content pack already models multi-file exercises.** `scaffold` carries the whole thing:

```json
"scaffold": {
  "files": [
    { "path": "pet_talents.py", "fromExercise": "py-7-03" },
    { "path": "run_tests.py",   "content": "…" }
  ],
  "entrypoint": "run_tests.py"
}
```

53 of 148 steps have one. `fromExercise` reuses another exercise's response so the two cannot
drift; `entrypoint` says what to run. Also new since the pinned version: `kind`
(`program`/`class`/`test`/`snippet`), `status` (`retired`), and `explanation` — a summary plus
per-line commentary, present on **all 148 steps**.

**The extension is three releases behind.** It pins `@aifirst/content#v1.1.1`, where Python Ch7 and
Java Ch6 are both `"examples": []`. The pack is at v1.3.0: 48 steps → **148**, Python chapters 1–7
and Java 1–9 populated. The bump is not optional — the chapters do not exist without it.

**The LLM path already works and must not be rebuilt.** The `aifirst` CLI (0.3.1 installed) ships a
Claude Code skill at `~/.claude/skills/aifirst`, whose rule is already "fetch it from the CLI and
reproduce it verbatim — do not write the code yourself." VS Code 1.126 core references
`.claude/skills`, `.copilot/skills` and `.agents/skills` as agent-skill discovery paths
(`chat.agentSkillsLocations`), so **agent mode already discovers that skill**. The extension
contributes no competing `SKILL.md`, no `chatSkills` entry, and no duplicate language model tool.

**Stable API allows all of this except the diff UI.** `createChatParticipant`,
`contributes.chatParticipants`, `workspace.applyEdit` and `LanguageModelTool` are stable
(`remote-ssh` ships `chatParticipants` with no proposal flags). But `stream.textEdit`,
`codeblockUri` and `workspaceEdit` are `chatParticipantAdditions`-proposed, and `vsce` refuses to
publish proposed API. A participant therefore writes files with `workspace.applyEdit` and gets no
Keep/Undo overlay — designed around below, not worked around.

**A participant that never touches `request.model` costs zero credits.** That is what makes the
token-free path real.

## Decisions

- Exercise files go in a **per-chapter folder** (`aifirst/python/ch07/`), because the chapter
  evolves one file: `py-7-04` takes `pet_talents.py` from `py-7-03`, `py-7-09` takes the same
  filename from `py-7-08`.
- The participant **runs** the exercise via a VS Code task/terminal — for a testing chapter that is
  the payoff (`py-7-05`'s printed response is literally `Ran 4 tests in 0.000s`).
- Scaffold materialization is **exported from `@aifirst/content`** (a coordinated v1.4.0), not
  reimplemented here.
- Progress is **shared with the CLI** via `~/.aifirst/progress.json`.

## Work item 1 — `@aifirst/content` v1.4.0: export materialization

`materialize(dir, example, step, scaffold, responseOf)` exists in `scripts/lib/verify.ts` and
resolves `fromExercise` across the whole pack. Lift it into `src/` and export it from `src/index.ts`
alongside the existing `suggestFilename`, `exercisePath` and `runCommand` in `src/filenames.ts`.

Refactor for a non-filesystem caller: the extension writes through `vscode.workspace.applyEdit`, not
`fs`. Split it into a pure planner and a thin writer —

```ts
export interface MaterializedFile { path: string; content: string; isEntrypoint: boolean; isResponse: boolean; }
export function planFiles(example, step, responseOf): { files: MaterializedFile[]; problems: string[] };
```

— and have the existing `materialize()` write `planFiles()`'s output, so `scripts/lib/verify.ts` and
CI keep their current behaviour. Cut v1.4.0 and repin the extension.

## Work item 2 — the `@aifirst` chat participant (full, no LLM)

New `src/AIFirstChatParticipant.ts`, registered in `src/extension.ts` beside the existing provider,
with `contributes.chatParticipants` (`name: "aifirst"`, `fullName: "AI First Programming"`,
`isSticky: true`). The handler **never reads `request.model`** — that is the token-free guarantee and
deserves a comment saying so.

Behaviours:

- **Bare prompt** — `@aifirst Write a unit test for the RobotPet class` → `findMatch` (reusing
  `findMatchingPrompt`'s no-fourth-argument rule from `AIFirstLanguageModelProvider.ts`), then set
  up the exercise.
- **`/setup <id>`** — materialize by exercise id via the pack's `resolve`/`parseId`.
- **`/run`** — run the current exercise.
- **`/explain`** — stream `step.explanation` (summary + per-line commentary). Pure content, zero
  cost, and the strongest part of the token-free story.
- **`/next`**, **`/progress`** — navigation and status from shared progress.

Writing files: `WorkspaceEdit.createFile(uri, { contents, overwrite })` via `workspace.applyEdit`
into the chapter folder. Report with `stream.filetree` (what was created), `stream.anchor`
(clickable files) and `stream.button` (Run / Next / Show diff). Because there is no Keep-Undo
overlay, **overwriting an existing file must not be silent**: when content differs, offer a
`vscode.diff` preview against a virtual document (`TextDocumentContentProvider`) and require the
button before replacing. Creating a new file writes directly.

Reuse `exercisePath`/`suggestFilename` for naming — Python snake_cases the title, Java must take the
name from the `public class`, which is not ours to choose.

Preserve the pack's central invariant: **the response is written byte-exact**. `kind: "snippet"`
responses contain a literal `…` (`py-7-09`) which is not valid Python; the authored scaffold ships a
`run_tests.py` that strips that line before executing. Fix nothing — materialize the scaffold and run
its `entrypoint`.

## Work item 3 — running

Use `runCommand(language, path)` and the scaffold `entrypoint` to build the command, and run it in a
dedicated terminal (or `vscode.tasks`) rooted at the chapter folder. Python needs `python3`; Java
needs the JUnit console launcher (the books deliberately need no `pom.xml`). Detect a missing
toolchain and say so in chat with the exact command, rather than failing opaquely.

On a clean run, record progress.

## Work item 4 — shared progress

Read/write `~/.aifirst/progress.json`, the CLI's format: keyed per **example** id,
`{ status, at, via, firstAt }`, `via ∈ run|agent`. Write only after a successful run (matching the
CLI, where `show` deliberately does not record), use `via: "run"`, write atomically, and tolerate the
file being absent or written by a newer CLI. Surface completion in the Books tree.

## Work item 5 — LLM path: point at the CLI, don't rebuild it

Add a command and a walkthrough step that detect whether `aifirst` is on PATH and whether
`~/.claude/skills/aifirst` exists, with install/update guidance (`aifirst update`; CLI 0.4.0 is
already available). No new skill, no new tool.

## Work item 6 — content bump fallout

- `src/test/extension.test.ts` asserts `content.steps.length === 48`. Replace the magic number with
  assertions that survive growth (both books load, known ids resolve, every response non-empty).
- `src/unittest/matcher.golden.json` pins all 48 entries by index and sha. **Regenerating it is not
  enough.** Tripling the corpus gives partial/fuzzy matching 100 new candidates, so an existing
  prompt can now resolve somewhere new. Before regenerating: replay the old 48 prompts against the
  v1.4.0 pack and produce a drift report of every prompt whose **response** changed. Review each
  one; a prompt that now finds a better exact match may be legitimate, but silent drift is the exact
  failure the fixture exists to catch. Regenerate only after that review, and record the outcome in
  `CHANGELOG.md`.

## Report upstream, do not patch here

Found while reading the new chapters; they belong in `aifirstcontent`:

- `py-7-05`'s prompt is `"Ran 4 tests in 0.000s"` — program output captured as a prompt. It will
  match badly and reads as a bug to a learner.
- `java-6-07`'s response has manuscript indentation damage (`private final int currentTemp;` at
  column 0).
- `java-6-13`'s scaffold references its own exercise id — probably intentional, worth confirming.
- `schema/content.schema.json`'s `promptStep` omits `scaffold` while `RawPromptStep` declares it;
  with `additionalProperties: false` a per-step scaffold would be rejected by `validate.ts`.

## Verification

1. **Unit tests** (`npm run test:unit`, plain `node --test`, no Electron): scaffold planning for
   `py-7-04` (one `fromExercise` file), `py-7-07` and `py-7-09` (`fromExercise` + inline content +
   entrypoint), and `java-6-03`; assert resolved contents are byte-identical to the referenced
   exercise's response, and that chapter-folder paths and Java class-derived filenames are correct.
2. **Matcher drift report**, then regenerate the golden fixture (above).
3. **Extension-host test** (`npm test`): the participant registers, and content loads in-host.
4. **End-to-end by hand**, the real proof — in a scratch workspace: `@aifirst /setup py-7-04` creates
   `aifirst/python/ch07/{pet_talents.py,test_robot_pet.py}`; the files match the book byte-for-byte;
   `/run` prints passing tests; progress appears in `~/.aifirst/progress.json` and in the tree;
   re-running offers a diff instead of silently overwriting. Repeat for `java-6-03`.
5. **Confirm zero credits**: exercise the whole flow with no model configured / signed out, and check
   the Copilot usage indicator does not move.
6. **`vsce package`** and inspect the `.vsix`, as in the 1.5.0 migration.

## Risks

- **No Keep/Undo diff UI** for participant-written files; that API is proposed and unpublishable.
  Mitigated by explicit buttons and a real `vscode.diff` before any overwrite.
- **`contributes.chatParticipants` has been dropped from the contribution-points reference** (still
  documented in the chat guide, still used by shipping extensions, no deprecation notice). It works
  today; it is not where Microsoft is investing. Worth re-checking before a major follow-up.
- **Chat view availability**: the learner needs either a Copilot plan (Free counts) or one BYOK model
  configured for the chat pane to exist at all. `@aifirst` itself needs neither.
- **Java execution** depends on the JUnit console launcher being present.
