# Lab run: 2026-11-27, Linux, VS Code 1.148.0, signed in (Copilot Free)

```
date:            2026-11-27
os / version:    Ubuntu 24.04.5 LTS (LXC container copilot-lab), XFCE on TigerVNC :1
vscode build:    1.148.0 (661626d0e72f97806550790a98fb87116c9db825)
copilot chat:    built in, 0.76.0
account state:   copilot-free (the picker offers Copilot Fusion; other models show Upgrade)
harness:         copilot (default), local, Agents window
bridge setting:  chat.agentHost.byokModels.enabled = true (default), then false, then true
extension vsix:  same build as the 2026-11-26 run, sha256 3db9f4c885d573a61465810eec8c2fd1a171ffc39617ffd6721aa218fc98c2a0
```

Book prompts: "Ask for the user's name and print it" (Python, `py-2-08`) and "Create a reminder by declaring a String variable and print the reminder." (Java, `java-2-01`). The trace confirmed each match.

## Files

Fixtures written by `aiFirst.captureFixtures`. Redacted: every system prompt and the Copilot SDK environment reminder are replaced by their length. User turns, tool calls, tool results and tool schemas are kept as captured.

- `copilot-harness-chat-panel-signed-in.json`: signed-in Copilot harness, 83 tools. The last user message has text **after** the prompt (`<system_reminder>` and `<tagged_files>` for an attached untitled editor).
- `copilot-harness-java-prompt.json`: the Java prompt with an empty saved `Reminder.java` open.
- `agents-window.json`: the Agents window, 79 tools.
- `local-harness-tool-result-success.json`: the follow-up request after `replace_string_in_file` applied an edit to `scratch.py`.
- `local-harness-tool-result-skipped.json`: the follow-up after the reader pressed Skip on the edit-outside-workspace confirmation.
- `inline-chat-empty-saved-file.json`: inline chat in an empty saved `Reminder.java` (Java prompt). With the Phase 2 build patched to allow empty files, `replace_string_in_file` with an empty `oldString` produced the exact book code with Keep/Undo.
- `local-harness-empty-file-tool-result.json`: the follow-up after the same empty-`oldString` edit in the Local harness: the usual "successfully edited" result, and the file holds the exact code.
- `local-harness-tool-result-read-only-file.json`: the follow-up after an edit to a read-only file. It reports success; only the save failed.

Screenshots. The Agents window's start page greets the account by name, so it is not included.

- 01: model picker, Copilot Free models plus the AI First vendor tab.
- 02: Copilot harness answer, signed in.
- 03: bridge off, signed in: AI First missing, chat switched to Copilot Fusion.
- 04: bridge on again after a restart: AI First selected again.
- 05: Local harness after switching: model reset to Auto, which answered the prompt itself.
- 06: Local harness edit with Keep/Undo, and the follow-up "Could not extract text from user message."
- 07: the edit-outside-workspace confirmation.
- 08: after Skip, the same follow-up error.
- 09: read-only file: edit shown, save failed.
- 10: Agents window answer.
- 11: Java answer in the Copilot harness.
- 12: the chat code block's **Apply in Editor**: a Copilot model merged the code and deleted the file's existing `# scratch` line.
- 13: inline chat signed in starts on **Auto** and answered the Java prompt with AI-written code.
- 14: inline chat with AI First in an empty saved `Reminder.java` (empty-`oldString` build): exact code with Keep/Undo.
