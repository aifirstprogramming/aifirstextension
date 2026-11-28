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
| 1.148.0 `661626d` (current Stable, confirmed 2026-11-25) | Native certification | Section A via CI on all 3 OSes; sections B and C in the Linux lab, signed out and signed in with Copilot Free, bridge off and on, Local vs Copilot harness while Local exists |
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
- `aiFirst.captureFixtures: true` (lab only) also writes the full request, prompt text included, as JSON under the extension's global storage `fixtures/` folder. Use only book prompts in empty or throwaway files. These files become unit-test fixtures for the provider hardening work.

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
| 1 | Does native chat need GitHub sign-in under the Copilot harness? (The migration docs say to sign in; the Agents window docs allow BYOK signed out.) | No, not for AI First. Signed out, the chat panel (Copilot and Local harness) and inline chat all reached AI First and returned the exact book code. With the bridge **off**, the Copilot harness hides AI First and a prompt fails with "Authentication is required to start a session." The Local harness still works signed out with the bridge off. **Signed in** (Copilot Free) with the bridge off, AI First is also missing from the Copilot harness, and VS Code silently switches the chat to Copilot Fusion: a reader gets AI-written answers and uses free quota without any warning. Screenshot 03 in [evidence/2026-11-27-linux-1.148-signedin](evidence/2026-11-27-linux-1.148-signedin). | 1.148.0 Linux, signed out and signed in |
| 2 | Does the bridge expose AI First in released Stable, and in which surfaces (chat panel, inline chat, Agents window)? | Yes. `chat.agentHost.byokModels.enabled` defaults to **true** in released builds (1.142.0, 1.148.0 and 1.149.0-insider). It is still tagged experimental, with `experiment: {mode: "startup"}`, so an experiment can turn it off. Chat panel: yes. Inline chat doesn't depend on it (see 3). Agents window: yes when signed in; AI First is listed as its own vendor and returns the exact code (79 tools offered, same `edit`/`create`). Its model choice is separate from the chat panel and defaults to Copilot Fusion. The Agents window passes the **main window's** active-editor language to the provider. Screenshots 02 and 07 in [evidence/2026-11-26-linux-1.148-signedout](evidence/2026-11-26-linux-1.148-signedout); screenshot 10 in [evidence/2026-11-27-linux-1.148-signedin](evidence/2026-11-27-linux-1.148-signedin). | 1.148.0 Linux, signed out and signed in |
| 3 | Does inline chat go through the Agent Host, and does it force untitled files to be saved? | **No Agent Host.** Inline chat uses the old path: a short system prompt ("GitHub Copilot"), a single `replace_string_in_file` tool and no agent-host activity. In a **saved** file the book code appears as a diff with Keep/Undo; Keep writes the exact code. In an **untitled** file the edit opens a diff between `Untitled-1` and a new `Untitled-2`. Accepting it opens a **Save As** dialog. Cancelling leaves the code in `Untitled-2` (with an extra blank line from the provider's `\n` placeholder), and the reader's `Untitled-1` stays empty. Screenshots 03–06. | 1.148.0 Linux, signed out |
| 4 | Which edit tools, schemas and `toolMode` values does the Copilot harness send? What do accepted, rejected and failed tool results look like? | **Copilot harness:** about 67 tools, including `edit` (`path`, `old_str`, `new_str`; only `path` required) and `create` (`path`, `file_text`). There is **no** `replace_string_in_file`, so the provider streams markdown. `toolMode` is auto. **Local harness:** the familiar tool set, including `replace_string_in_file`; `toolMode` auto. **Inline chat:** only `replace_string_in_file` (`filePath`, `oldString`, `newString`, all required); `toolMode` auto. After Keep in inline chat, no follow-up request arrives. Signed in, the Copilot harness adds 18 `github-mcp-server-*` tools (83 in all); `edit`/`create` are unchanged. **Tool results (Local harness, chat panel):** the follow-up request arrives **immediately after the tool runs, before the reader chooses Keep or Undo**, so it can't say whether the edit was kept. Its newest message is a user message with only a `LanguageModelToolResultPart` whose single text part is `The following files were successfully edited:\n<path>\n` (applied) or `The user chose to skip the tool call, they want to proceed without running it` (the reader pressed Skip on the edit-outside-workspace confirmation). An edit to a read-only file still reports success: the edit lands in the buffer and only the save fails. A true tool failure wasn't produced. Keep and Undo send no request. In every case the current provider answers the follow-up with "Could not extract text from user message." Screenshots 06–09 in [evidence/2026-11-27-linux-1.148-signedin](evidence/2026-11-27-linux-1.148-signedin). | 1.148.0 Linux, signed out and signed in |
| 5 | How are prompts wrapped, and what parts does a message contain? | Every message is a single text part, and the prompt is always in the last user message. **Copilot harness:** a system prompt (about 23.6k characters), a user message with the Copilot SDK's environment reminder, then `<current_datetime>…</current_datetime>` followed by a blank line and the prompt. An attached current file lengthens that last message. Later turns resend the earlier user and assistant messages. **Local harness:** `<context>…</context><reminderInstructions>…</reminderInstructions><userRequest>prompt</userRequest>`. **Inline chat:** `<file>…</file><file-cursor-context>…</file-cursor-context><reminder>…</reminder>` then `<prompt>prompt</prompt>`. The matcher found the right step under all three wrappers. Text can also **follow** the prompt: when an editor is attached as context, the Copilot harness appends a `<system_reminder>` about read-only attachments and a `<tagged_files>` list after the prompt. Redacted fixtures are in the evidence folders. | 1.148.0 Linux, signed out and signed in |
| 6 | Does the model selection persist across a reload and when a session is reopened? | **Not reliably.** Signed in, a restart kept AI First, and it came back after the bridge was turned off and on again. But the choice is per harness and per surface: switching a chat to Local resets it to Copilot Auto (which then answered the book prompt itself, routed to another model), the Agents window starts on Copilot Fusion, and after moving between harnesses a new Copilot-harness chat had fallen back to Copilot Fusion. Readers should check the model chip in every new chat. Screenshots 04 and 05 in [evidence/2026-11-27-linux-1.148-signedin](evidence/2026-11-27-linux-1.148-signedin). | 1.148.0 Linux, signed out and signed in |
| 7 | Which build is current Stable? | 1.148.0 (update API, 2026-11-25) | update.code.visualstudio.com |

## Results

Evidence for each run is under [`evidence/`](evidence/), one folder per run. One row per run. Mark combinations that aren't supported as **unsupported**, never as passing.

| Date | OS | Build | Account | Harness | Bridge | Section | Result | Notes / evidence |
|---|---|---|---|---|---|---|---|---|
| 2026-11-26 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | signed out | Copilot | on (default) | B1, B2, B3, B11 | pass: AI First is listed and selectable, and the chat panel returns the exact `py-2-08` code | Apply/Insert at Cursor not yet tried. Screenshots 01, 02 |
| 2026-11-26 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | signed out | Copilot | off | B2, B3 | AI First hidden; prompt requires sign-in | Screenshot 07 |
| 2026-11-26 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | signed out | Local | off | B3 | pass: exact code as markdown | Screenshot 09 |
| 2026-11-26 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | signed out | inline (no harness) | on | B4 | pass: the saved file got the exact code, with Keep/Undo | Screenshot 03 |
| 2026-11-26 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | signed out | inline (no harness) | on | B5 | **fail (UX)**: the untitled file forces Save As, and Cancel strands the code in `Untitled-2` | Phase 2: drop the untitled path and point to Find Book Example. Screenshots 04–06 |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Copilot | on (default) | B1, B2, B3 | pass: AI First listed next to Copilot Fusion; exact `py-2-08` code; Java prompt matched `java-2-01` | A Copilot model writes the session title in the background. Screenshots 01, 02, 11 in [evidence/2026-11-27-linux-1.148-signedin](evidence/2026-11-27-linux-1.148-signedin) |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Copilot | off | B2 | AI First missing; chat silently switches to Copilot Fusion | Screenshot 03 |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Copilot / Local | on | B9 | **partial**: survives restart; lost on harness switch and in the Agents window | Screenshots 04, 05 |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Local | on | B6, B7 | **fail**: the edit applies with Keep/Undo, but the follow-up turn answers "Could not extract text from user message." (also after Skip) | Phase 2 item 1. Screenshots 06–09 |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Agents window (Copilot) | on | B8 | pass: exact code after choosing AI First | Screenshot 10 |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Local | on | B6 | pass with the Phase 2 build (branch `provider-hardening`, VSIX sha256 `e171ec6f…`): the edit applies (+2 −0) and the follow-up says "Inserted the book example. Choose Keep to accept it or Undo to remove it." | Trace: `tool-result {"outcome":"applied"}` |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Copilot | on | B3 | pass with the Phase 2 build: exact code plus the Find Book Example hint | |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | Copilot | on | B3 | **Insert At Cursor** (code block toolbar, `Ctrl+Enter`) inserts the exact code. **Apply in Editor** is not exact: a Copilot model merges the block and deleted an existing line. There is no Insert at Cursor in the block's "…" menu. | Don't recommend Apply. Screenshot 12 |
| 2026-11-27 | Ubuntu 24.04 (LXC) | 1.148.0 `661626d` | Copilot Free | inline (no harness) | on | B4, B9 | inline chat keeps its own model choice and starts on **Auto**, which answered with AI-written code; after choosing AI First, an empty saved file gets the exact code with Keep/Undo (empty `oldString`) | Screenshots 13, 14 |
