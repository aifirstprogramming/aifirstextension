# Compatibility checklist: VS Code Copilot harness

VS Code 1.146 deprecated the **Local** agent harness. It is removed in **February 2027**, leaving the **Copilot** harness (Agent Host), which has been the default for new sessions since 1.143. Nothing official says how the Copilot harness treats a model supplied by an extension, so this checklist establishes it with evidence from released builds.

## Support commitments

| Tier | Builds | Promise |
|---|---|---|
| Core (guaranteed) | 1.104+, Windows, macOS, Linux desktop | Browse, find, copy, preview and insert exact book code with no Copilot, no sign-in, no network, no AI credits. |
| Native chat (certified) | Current Stable, checked on Linux | AI First is selectable and returns exact book code in each surface the README *advertises*. Keep/Undo is claimed only for verified combinations. |
| Early warning | Insiders | Advisory. Failures trigger investigation, never block a release. |
| Out of scope | | Remote, browser VS Code, Codespaces, Business/Enterprise policy certification, Copilot Pro, multi-file exercises. |

**Release rule:** the core workflow passes on every supported OS, and every advertised native configuration passes on current Stable with the Copilot harness. An upstream limitation can narrow what the README advertises. It never excuses a core failure.

## What each build is for

Only these combinations are tested. Don't expand the matrix without a reason.

| Build | Purpose | Checks |
|---|---|---|
| 1.104.0 | Declared minimum | CI host tests (`--label min`), plus the core section by hand on each OS |
| 1.142.0 | Diagnostic: Local harness is the default | Baseline trace capture only; not a release gate |
| 1.148.0 (current Stable, confirmed 2026-11-25) | Native certification | Section A via CI on all 3 OSes; sections B and C in the Linux lab, signed out and signed in with Copilot Free, bridge off and on, Local vs Copilot harness while Local exists |
| Insiders | Early warning | Weekly CI canary; one native smoke run per release cycle on Linux |

When a new Stable is certified, update `stable` in `.vscode-test.mjs` and this table together.

## Lab setup

| Resource | Requirement |
|---|---|
| Linux | `aifirst-ubuntu` on Proxmox, the only lab machine. Full spec in [lab-handoff.md](lab-handoff.md). |
| Windows, macOS | No lab machines. The core workflow runs on GitHub-hosted runners. Native chat is checked on Linux only and the README carries no caveat; a native-chat problem specific to Windows or macOS beyond what CI covers is treated as a VS Code issue. |
| Toolchain | Node 24, Git, Python 3.12, JDK 21. |
| Editors | The four builds above, side by side as zip or portable installs. Record each build's commit (`code --version`). |
| Profiles | Launch every build with its own `--user-data-dir` and `--extensions-dir`. Settings Sync off, no other extensions. Two account states: **signed-out**, and **Copilot Free** on the dedicated test account. Authenticated profiles never leave the lab. |
| Network | npm, GitHub, VS Code downloads, Marketplace, GitHub/Copilot sign-in and service traffic. The offline check needs a way to cut the VM's network. |
| Extension | The `ci-vsix` artifact from the CI run under test, installed with `code --install-extension`. Never a dev checkout. |

### Tracing

- `aiFirst.trace: true` logs each chat request's shape to **Output → AI First Programming**: roles, part kinds, offered tool names and schema keys, tool mode, matched step id, and the path taken. No prompt text.
- `aiFirst.trace.captureFixtures: true` (lab only) also writes the full request, prompt text included, as JSON under the extension's global storage `fixtures/` folder. Use only book prompts in empty or throwaway files. These files become unit-test fixtures for the provider hardening work.

### Run manifest

Record this for every run and attach it with the evidence:

```
date:            
os / version:    
vscode build:     (version + commit)
copilot chat:     (version, or "none")
account state:    signed-out | copilot-free
harness:          local | copilot | n/a
bridge setting:   chat.agentHost.byokModels.enabled = true | false
extension vsix:   (CI run id + sha256)
```

Evidence: screenshots, the trace output, captured fixtures, and the SHA-256 of any inserted code compared with the book response. Never attach credentials or profile folders.

## Checklist

### A. Core (every build and OS in scope; Copilot disabled, signed out)

- [ ] A1. The Books panel lists both books; examples open in the viewer with syntax highlighting.
- [ ] A2. With the network cut, A1 still works (highlighting included).
- [ ] A3. Copy Prompt and Copy Response put the exact text on the clipboard.
- [ ] A4. Find Book Example in a saved `.py` file: a Python prompt previews, and Insert adds the exact code at the cursor. One Undo removes it.
- [ ] A5. The same in a saved `.java` file with a Java prompt.
- [ ] A6. An untitled file: Insert works.
- [ ] A7. A selection is replaced by Insert.
- [ ] A8. Type in the file after matching but before choosing Insert: nothing is inserted, and a warning appears.
- [ ] A9. No file open: Copy and Open in New Editor are offered; Insert is not.
- [ ] A10. A prompt that isn't in the book: the warning offers Open Books Panel.
- [ ] A11. The viewer's Insert into Editor button inserts into the last file edited, after confirmation.
- [ ] A12. A CRLF file gets CRLF line endings (also covered by the host tests on all 3 OSes).

### B. Native chat (current Stable; Insiders smoke)

Run each item with the Copilot harness, bridge **off** then **on**. While the Local harness exists, repeat with Local for comparison. Confirm in the trace that a request actually reached AI First.

- [ ] B1. AI First Programming appears in Chat: Manage Language Models, and the eye icon toggles it.
- [ ] B2. AI First can be chosen in the chat panel's model picker.
- [ ] B3. Chat panel: a book prompt returns the exact book code as a fenced block; Insert at Cursor / Apply work.
- [ ] B4. Inline chat (`Ctrl+I`) in a **saved** file: is the code inserted, with Keep/Undo? Record the edit tool and schema from the trace.
- [ ] B5. Inline chat in an **untitled** file: is a save forced? Record what happens if the save is accepted, and if it's cancelled.
- [ ] B6. The turn after an insert: what appears in chat? Is the edit repeated?
- [ ] B7. Reject the inserted edit (Undo/X): what does the next request contain?
- [ ] B8. Agents window (desktop): is AI First listed, and does it answer?
- [ ] B9. Reload the window and reopen the session: is AI First still selected?
- [ ] B10. Switch target file between the prompt and the response: where does the edit go?
- [ ] B11. Signed out: repeat B1–B4.

### C. Packaging (each release candidate)

- [ ] C1. The CI VSIX installs into a clean profile; both books load; the walkthrough opens; section A passes.

## Open questions

Fill in each answer with the build it was observed on.

| # | Question | Answer | Observed on |
|---|---|---|---|
| 1 | Does native chat need GitHub sign-in under the Copilot harness? (The migration docs say to sign in; the Agents window docs allow BYOK signed out.) | | |
| 2 | Does the bridge expose AI First in released Stable, and in which surfaces (chat panel, inline chat, Agents window)? | | |
| 3 | Does inline chat go through the Agent Host, and does it force untitled files to be saved? | | |
| 4 | Which edit tools, schemas and `toolMode` values does the Copilot harness send? What do accepted, rejected and failed tool results look like? | | |
| 5 | How are prompts wrapped, and what parts does a message contain? | | |
| 6 | Does the model selection persist across a reload and when a session is reopened? | | |
| 7 | Which build is current Stable? | 1.148.0 (update API, 2026-11-25) | update.code.visualstudio.com |

## Results

One row per run. Mark combinations that aren't supported as **unsupported**, never as passing.

| Date | OS | Build | Account | Harness | Bridge | Section | Result | Notes / evidence |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |
