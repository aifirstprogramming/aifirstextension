<!-- Captured from a Hermes session. Do not edit: this is a historical record. -->

> **AI development artifact — infrastructure fix.**
> This records an automation gap found by testing the content-sync dispatch end to end, and
> the change made to close it. It is *history, not documentation*: where it disagrees with
> the code, the code is right.
>
> | | |
> | --- | --- |
> | **Date** | 2026-08-10 |
> | **Scope** | `.github/workflows/content-sync.yml`, `.github/workflows/publish.yml` |
> | **Outcome** | **Shipped** — committed directly to `main`, no pipeline card |

---

# Close the loop between content-sync.yml and publish.yml

## Symptom

`package.json` on `main` read **1.6.0**. The Marketplace served **1.5.0**. Git tags were
`v1.5.0` and `v1.3.0` — no `v1.6.0` existed. The entire v1.4.0 content sync
(48 -> 148 prompts) was therefore never published to users.

Nothing reported an error. The sync run that caused it was green.

## How it was found

Not by a failing build. The content-sync automation had never once run from a real
`repository_dispatch` — every prior run was a manual `workflow_dispatch`. Firing the actual
payload that `aifirstcontent`'s `release.yml` sends surfaced both this gap and a separate
idempotency bug in `scripts/sync-content.ts`.

## Root cause

`content-sync.yml` ends its bump step with:

```
git commit -F commit-message.txt
git push origin main
```

It bumps `package.json` via `npm version minor --no-git-tag-version`, commits, and stops.
`publish.yml` triggers on `push: tags: v*.*.*`. No tag is ever created, so publishing never
fires. The version drifts forward on `main` while the Marketplace stays put.

Commit `b32ab970` ("Sync content to v1.4.0") is the run that produced the stranded 1.6.0.

## Why not just push a tag

The obvious fix — `git tag v$NEW_VERSION && git push --tags` — does not work here. GitHub
deliberately suppresses workflow triggers for pushes made with the default `GITHUB_TOKEN`,
to prevent recursive workflow loops. A tag pushed by the sync job would appear in the repo
but would **not** start `publish.yml`, reproducing the same silent gap with an extra tag to
make it look fixed.

Pushing a *triggering* tag needs a PAT. This repo's only secret is `VSCE_PAT` (a Marketplace
token, not a GitHub one), so that route is unavailable without provisioning new credentials.

## The fix

Invoke `publish.yml` directly instead of relying on a tag:

1. Gave the bump step `id: commit` and had it emit `published_version` to `$GITHUB_OUTPUT`.
2. Added a final step running `gh workflow run publish.yml --ref main -f version=$VERSION`,
   guarded by `if: steps.commit.outputs.published_version != ''` so it is skipped whenever
   the bump step short-circuited on no content delta, and never publishes a version that was
   not actually created.
3. Added `actions: write` to the job's permissions; the dispatch is a write to the Actions
   API and fails without it.
4. Changed `publish.yml`'s `version` input from `type: choice` (patch/minor/major) to
   `type: string`. The workflow body already handled an explicit version — it strips a
   leading `v` and takes the `custom` branch — but the `choice` input made it impossible to
   pass one. That is the input-side half of the same gap.

The tag trigger is left in place. Publishing by pushing a tag by hand still works exactly as
before; this only adds an automatic path that does not depend on one.

## Not done here

The stranded 1.6.0 is not published by this commit. This change closes the loop for future
syncs. Publishing the current 1.6.0 is a one-time manual dispatch and a release decision,
not something to bundle into an infrastructure fix.
