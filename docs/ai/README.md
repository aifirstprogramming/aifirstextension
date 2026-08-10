# AI development artifacts

This extension was built with [Claude Code](https://claude.com/claude-code). Before each
substantial change, the agent wrote a plan — the problem, what it verified rather than assumed, the
design decisions and their alternatives, the steps, and how the result would be checked. Those plans
were reviewed and approved before any code was written.

They lived in the agent's session history, which is local to one machine and disappears with it.
This directory checks them into the repository so that anyone working on the project can read *why*
the code looks the way it does, not just what it does.

## How to read these

**They are history, not documentation.** Each plan describes the code as it was expected to become
at one moment. Where a plan and the code disagree, the code is right. For current behaviour read the
[README](../../README.md); for what changed in a release, read the [CHANGELOG](../../CHANGELOG.md).

Each file opens with a provenance block: the session it came from, the date it was approved, and
whether it shipped. The body below that block is **verbatim** — deliberately not cleaned up, because
an edited plan is no longer evidence of what was actually decided. The only alteration is that
absolute paths from the machine it ran on were replaced with `<scratch>/` and `~/`.

## Plans

| Plan | Date | Outcome |
| --- | --- | --- |
| [Migrate onto `@aifirst/content`](plans/2026-08-08-migrate-onto-aifirst-content.md) — retire the extension's own copy of the books and the matcher in favour of the package the CLI already uses, guarded by a 1,480-case golden regression test | 2026-08-08 | Shipped in 1.5.0 |
| [`@aifirst` in the chat pane](plans/2026-08-09-chat-pane-unit-test-chapters.md) — file-creating exercises for the unit-test chapters, which need two files (the code under test and the test) and so cannot work in a scratch buffer | 2026-08-09 | **Proposed — not implemented** |
| [Close the content-sync / publish loop](plans/2026-08-10-close-content-sync-publish-loop.md) — the sync bumped `package.json` and pushed, but never triggered `publish.yml`, so the Marketplace silently fell behind `main` | 2026-08-10 | Shipped |

The chat-pane plan is a design that has not been built. It is here because the analysis behind it —
which exercises need more than one file, and why a real model cannot produce the book's exact test
code repeatably — holds whether or not the design is the one eventually chosen.

## Earlier design documents

These predate this directory and stay where they are, because other documents link to them:

- [`IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md) — the original chat-provider design.
  Partly superseded by 1.5.0, and it says so at the top.
- [`PUBLICATION_PLAN.md`](../../PUBLICATION_PLAN.md) — how the extension gets to the Marketplace.

## Sessions behind this repository

| Session | When | What it produced |
| --- | --- | --- |
| `5ed30dd0` | 2026-08-08 → 08-09 | The 1.5.0 migration onto `@aifirst/content`, its golden baseline, and the chat-pane design above |

Work on the shared content package and the CLI that consumes it happened in session `62a2fb7f`;
see the [CLI repository](https://github.com/aifirstprogramming/aifirstcli/blob/main/docs/ai/README.md).

## Adding to this directory

When a plan is approved in a Claude Code session, save it here before the session ends — the
transcript is not a durable store. Keep the body verbatim, add the same provenance block, scrub any
absolute local paths, and add a row to the table above.
