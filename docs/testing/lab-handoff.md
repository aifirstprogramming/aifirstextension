# Lab handoff: compatibility testing for the Copilot harness

The goal is to test the AI First extension against VS Code's Copilot harness before the Local harness is removed in February 2027. The checklist this lab supports is [compat-checklist.md](compat-checklist.md).

## The short version

- **Automated, no lab needed:** all automated testing runs on CI.
  - The repo is public on GitHub, so GitHub Actions gives free hosted Linux, Windows and macOS runners.
  - That covers the core reader workflow on all three OSes, plus packaging.
  - This means **no Windows or macOS lab machines**.
- **Needs a lab:** one **Linux VM**. It's only for what CI can't do: native Copilot chat, which needs a real GitHub sign-in and a desktop session.
- **Needs a person:** about 10 minutes, to sign in to GitHub once in the VM.
- **Decided:** native chat is checked on Linux only, with no README caveat. A native-chat problem that appears only on Windows or macOS, beyond what CI covers, is treated as a VS Code issue, not ours.

## What runs where

| Check | Where | Why |
|---|---|---|
| Unit tests, content gate, lint | GitHub Actions, Linux | Already in `ci.yml` |
| Extension-host tests on VS Code 1.104 and 1.148 (startup, commands, model found, exact book answer, insert/undo/stale/line endings) | GitHub Actions, Linux + Windows + macOS | Hosted runners; no sign-in needed |
| Weekly floating Stable + Insiders canary | GitHub Actions, 3 OSes | Scheduled in `ci.yml` |
| Package contents | GitHub Actions, Linux | `package` job in `ci.yml` |
| Install the built package into a clean profile and run checks (C1) | GitHub Actions | To add: install the CI build of the extension with `code --install-extension`, then run tests against it |
| Viewer has no remote resources (offline, A2) | GitHub Actions (static) + one lab check | To add: a test that the viewer page only references local resources |
| Native chat: model picker, chat panel, inline chat, Agents window, bridge setting on/off, Local vs Copilot harness (section B) | **Lab Linux VM** | Needs a real Copilot sign-in and a desktop. CI can't hold a Copilot session in a supported way. |
| Native chat on Windows/macOS | Not tested | Decided: the Linux check stands for all OSes. The core workflow is still CI-tested on all three. |

**About GitLab CI:** this repo is on GitHub and its pipelines are GitHub Actions, which already include hosted Windows and macOS runners for free on a public repo. I'd keep it there rather than mirror to GitLab. If you want GitLab anyway, the same jobs translate directly. macOS runners on GitLab SaaS need a paid tier.

## The Linux VM

**Use a VM, not an LXC.** VS Code is an Electron app that needs a desktop session, D-Bus, a keyring (where GitHub sign-in is stored) and user namespaces for its sandbox. That's all routine in a VM and awkward in an unprivileged container.

| Item | Spec |
|---|---|
| Name | `aifirst-ubuntu` |
| OS | Ubuntu 24.04 LTS, with any lightweight desktop (XFCE is fine) |
| Size | 4 vCPU, 8 GB RAM, 60 GB disk, no GPU |
| Display | A persistent X session on `:1` (TigerVNC or xrdp), so it survives SSH disconnects and I can target it with `DISPLAY=:1` |
| Human access | VNC or RDP (or noVNC in the Proxmox console), for the one-time GitHub sign-in |
| My access | SSH key login as a normal user (e.g. `lab`), reachable from this machine. Send me the host and user. |
| Snapshot | Take one after setup and before sign-in (`clean`), and one after sign-in (`signed-in`) |

### Software

```bash
# packages
sudo apt-get install -y git curl unzip jq python3.12 openjdk-21-jdk \
  xdotool imagemagick scrot gnome-keyring dbus-x11 libsecret-1-0 \
  libnss3 libasound2t64 libgbm1 libgtk-3-0
# Node 24 (NodeSource or nvm)
```

Install VS Code builds side by side as **portable** installs. Unpack the `.tar.gz`, then create a `data/` folder inside it. Each copy then keeps its own settings, extensions and sign-in, so the profiles can't mix.

| Folder | Build | Account |
|---|---|---|
| `/opt/vscode/1.142.0-free` | 1.142.0 (Local harness is the default) | Copilot Free |
| `/opt/vscode/1.148.0-free` | 1.148.0 (current Stable) | Copilot Free |
| `/opt/vscode/1.148.0-signedout` | 1.148.0 | none |
| `/opt/vscode/insiders-free` | Insiders | Copilot Free |
| `/opt/vscode/1.104.0-signedout` | 1.104.0 (minimum) | none |

Download URLs follow the pattern `https://update.code.visualstudio.com/<version>/linux-x64/stable`, and `.../latest/linux-x64/insider` for Insiders. I can do this part myself once I have SSH.

- **Settings Sync** off in every copy.
- **Playwright** (`npx playwright install-deps` once, as root). This is my fallback for driving the chat UI if VS Code's `code chat` command-line entry point doesn't cover what I need. It runs only inside the lab, never in CI, and never with credentials outside the VM.

### Network

- Outbound HTTPS to:
  - `github.com`, `api.github.com`, `*.githubusercontent.com`, `*.githubcopilot.com`
  - `copilot-proxy.githubusercontent.com`
  - `update.code.visualstudio.com`, `*.vscode-cdn.net`
  - `marketplace.visualstudio.com`, `*.gallery.vsassets.io`
  - `registry.npmjs.org`
- **An offline switch for me:** a script such as `/usr/local/bin/lab-net on|off` that adds or removes a drop-all-outbound nftables rule. Give the `lab` user permission to run that one script with sudo and nothing else. This is for the offline check (A2).

### Accounts (the one part only a person can do)

1. Create a **dedicated GitHub account** for testing, not a personal one, and turn on **Copilot Free**. Keep its credentials in your password manager. I never need them.
2. Over VNC, open each `*-free` VS Code copy and sign in to GitHub with that account (MFA included). About 10 minutes in total.
3. Take the `signed-in` snapshot.

If a sign-in expires during testing, I'll stop and ask you to sign in again. I won't try to get around it.

## What I'll do once I have access

1. Install the CI-built extension package into each copy, and turn on `aiFirst.trace` and `aiFirst.trace.captureFixtures`.
2. **Baseline** on 1.142 and 1.148. The same Java and Python book prompts, through:
   - the chat panel, inline chat (saved and untitled files) and the Agents window
   - the Local harness and the Copilot harness
   - the bridge setting `chat.agentHost.byokModels.enabled` off and on
   - signed in and signed out
3. Collect evidence: screenshots (`import -window root` on `:1`), trace logs, captured request fixtures, and a SHA-256 of any inserted code compared with the book. Evidence goes into the repo. Profiles and anything holding credentials never leave the VM.
4. Answer open questions 1–6 in the checklist and fill in the results table.
5. Turn the captured fixtures into unit tests, then do the chat model fixes from the plan (edit tools, the turn after an insert, `toolMode`), then update the native-chat walkthrough.
6. Re-run section B on Insiders once per release cycle, and on each new Stable until February.

## Asks, in order

| # | Ask | Who | Blocks |
|---|---|---|---|
| 1 | OK to commit the `copilot-harness-compat` branch and open a PR, so CI runs the new tests on all three OSes | You | All CI results |
| 2 | Create the `aifirst-ubuntu` VM to the spec above, with SSH access for me | Lab admin | Native testing |
| 3 | The `lab-net` offline script with a matching sudo rule | Lab admin | Offline check (A2) only |
| 4 | Dedicated GitHub test account with Copilot Free | You | Signed-in native testing |
| 5 | One-time sign-in in each `*-free` copy, then the snapshot | You, after I install the builds | Signed-in native testing |
| 6 | ~~Native chat on Mac/Windows~~ Decided: Linux only, no caveat | Done | — |

The signed-out and Local-vs-Copilot comparisons can start as soon as asks 1 and 2 are done. Asks 4 and 5 only gate the signed-in runs.
