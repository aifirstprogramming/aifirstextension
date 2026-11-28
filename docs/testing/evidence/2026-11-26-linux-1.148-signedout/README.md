# Lab run: 2026-11-26, Linux, VS Code 1.148.0, signed out

```
date:            2026-11-26
os / version:    Ubuntu 24.04.5 LTS (LXC container copilot-lab), XFCE on TigerVNC :1
vscode build:    1.148.0 (661626d0e72f97806550790a98fb87116c9db825)
copilot chat:    built in, 0.76.0
account state:   signed-out
harness:         copilot (default), local; inline chat uses neither
bridge setting:  chat.agentHost.byokModels.enabled = true (default), then false
extension vsix:  local build of branch lab-baseline-fixes (main 1b00451 + setting rename), sha256 3db9f4c885d573a61465810eec8c2fd1a171ffc39617ffd6721aa218fc98c2a0
```

Book prompt used throughout: "Ask for the user's name and print it" (Python, step `py-2-08`). The response was the exact book code in every surface that reached AI First.

## Files

- `*.json`: request fixtures written by `aiFirst.captureFixtures`. Redacted: VS Code's and Copilot's system prompts and the Copilot SDK environment reminder are replaced by their length. User turns and tool schemas are kept as captured.
- `01`–`09` screenshots, numbered as the checklist results table cites them:
  - 01: Language Models, signed out, showing AI First.
  - 02: a Copilot-harness chat answer.
  - 03: inline chat Keep/Undo in a saved file.
  - 04–06: inline chat in an untitled file (the diff, Save As, and the result after Cancel).
  - 07: bridge off, sign-in required.
  - 08: the harness picker.
  - 09: a Local-harness chat answer.
