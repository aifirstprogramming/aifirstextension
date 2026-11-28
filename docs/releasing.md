# Releasing

A release goes out in two stages, so the VSIX readers install is the exact file that passed acceptance. `.github/workflows/publish.yml` implements both.

## 1. Prepare

1. In a pull request, set `version` in `package.json` and rename `## Unreleased` in `CHANGELOG.md` to `## <version> - <date>`. The release notes are taken from that section.
2. Merge it once CI is green.
3. Tag the merge commit and push the tag:

   ```
   git tag v1.12.0 <merge commit>
   git push origin v1.12.0
   ```

The tag run repeats the full CI on the tagged commit, checks that the tag matches `package.json`, builds the VSIX once with a pinned `@vscode/vsce`, and attaches it with its SHA-256 to a **draft** GitHub Release. Nothing reaches the Marketplace.

## 2. Accept

Download the VSIX from the draft release and check its hash. Then, in the lab (see [testing/lab-handoff.md](testing/lab-handoff.md)), with that exact file:

- **C1:** it installs into a clean profile on the minimum build (1.104) and on certified Stable; both books load, the walkthrough opens, and checklist section A passes.
- **Native chat on certified Stable, Linux:** every path the README advertises, signed out and signed in with the test account, with the Copilot harness: chat panel with Insert At Cursor, inline chat in a saved and an empty saved file, the follow-up after an inline or Local-harness insert, and the Agents window.

Add a row per run to the results table in [testing/compat-checklist.md](testing/compat-checklist.md), with the VSIX SHA-256 in the run manifest. A failure in the core section blocks the release. A native-chat failure either blocks it or narrows what the README advertises; it is never recorded as a pass.

## 3. Publish

Run the **Release** workflow by hand (Actions → Release → Run workflow) with the tag. It downloads the same VSIX from the draft release, checks the SHA-256, publishes it to the Marketplace with `vsce publish --packagePath`, and publishes the GitHub Release. It needs the `VSCE_PAT` secret. The job runs in the `marketplace` environment; add required reviewers there to make publishing need a second approval.

If acceptance fails, delete the draft release and the tag, fix the problem in a pull request, and start again with a new version number.

## After a release

While `chat.agentHost.byokModels.enabled` is experimental, re-run the native-chat checks on each new VS Code Stable, and update `stable` in `.vscode-test.mjs` and the build table in the checklist when a new Stable is certified. The weekly CI canary (floating Stable and Insiders) keeps running after the Local harness is removed in February 2027.
