# AI First Programming Extension

A companion extension for the AI First Programming book series. It gives you every prompt and code example from the books, and puts the exact book code into your file when you ask for it. **Find Book Example** does that with no Copilot, no sign-in and no network. If you use VS Code's chat, the **AI First Programming** chat model answers book prompts with the book's code instead of an AI answer.

## Features

- **Find Book Example**: paste a prompt from the book and insert its exact code into your file. No Copilot, sign-in, network or AI credits needed
- **Book Content Browser**: navigate the books by section, chapter and example in a sidebar tree view
- **Example Viewer**: prompts and code with syntax highlighting, with Copy and Insert into Editor buttons
- **AI First Programming chat model**: pick it in VS Code's chat and a book prompt returns the book's code
- **Language-aware matching**: a Python file gets the Python book's code, a Java file the Java book's

## Requirements

- Visual Studio Code 1.104.0 or later
- For the chat model only: GitHub Copilot Chat, which is built into current VS Code (install the **GitHub Copilot Chat** extension on older versions). A GitHub sign-in is optional: the AI First model works signed out, and a personal Copilot Free account also works. The Books panel, the example viewer and Find Book Example need none of this.

## Installation

You can find the AI First Programming extension in the VS Code Extension Marketplace.

1. Open VS Code
2. Click on the **Extensions** icon in the left toolbar (represented by 4 squares)
3. Type **"ai first programming"** or **"ai first book"** in the search bar
4. Look for the extension published by **Stephen Chin, Cassandra Chin, and Jennifer Reif** (the authors of the AI First series)
5. Click **Install**

After installation, you'll see a new icon in the sidebar with a picture of a book that has "A" and "I" on the pages. Click this icon to open the extension.

> **Note**: The extension is available in the [VS Code Extension Marketplace](https://marketplace.visualstudio.com/items?itemName=AIFirstProgramming.ai-first-programming).

## Getting Book Code into Your File

### Find Book Example (always works)

This works whatever your Copilot setup, and never uses AI credits:

1. Open the file you want the code in (a new untitled file is fine) and place your cursor, or select code to replace
2. Run **AI First: Find Book Example…** from the Command Palette, the editor's right-click menu, or with `Ctrl+Alt+Shift+B` (`Cmd+Alt+Shift+B` on Mac)
3. Paste the prompt from the book and press Enter
4. The matching book code opens beside your file. Choose **Insert** to add it at your cursor, **Copy**, or **Open in New Editor**

Matching uses your file's language, so a Python file gets the Python book's code. Insert is a normal edit: `Ctrl+Z` / `Cmd+Z` undoes it. If the file changed after the example was matched, nothing is inserted and you'll be asked to run the command again.

### Browsing the Books

1. Click the **AI First Programming** icon in the sidebar (the book icon with "A" and "I")
2. Navigate **Books** → **Sections** → **Chapters** → **Examples**
3. Click an example to open it beside your editor, with its prompts and code responses

Each example has **Copy Prompt** and **Copy Response** buttons, and each response has an **Insert into Editor** button that puts the code into the last file you were editing after you confirm.

> **Tip**: We recommend always trying the prompt first, but don't hesitate to use the book response if needed!

## Using the AI First Model in VS Code Chat

VS Code's chat can send your prompt to the **AI First Programming** model instead of an AI model. You then practice the book's workflow, typing prompts into chat, and get exactly the code the book shows.

### 1. Make the model visible

1. Run **Chat: Manage Language Models** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Expand the **AI First** group and click the **eye icon** next to **AI First Programming**, so the row is bold

### 2. Choose AI First wherever you chat

The model button at the bottom of each chat input shows which model will answer. Click it (or press `Ctrl+Alt+.` / `Cmd+Alt+.`) and choose **AI First Programming**.

Check that button whenever you start a chat. VS Code remembers a separate choice for the chat panel in each agent harness, for inline chat and for the Agents window, and a new chat can start on **Auto** or **Copilot Fusion**. Those are AI models: they write their own code instead of the book's, and with a Copilot account they count against your Copilot usage.

### 3. Send the book prompt

**Chat panel** (`Ctrl+Alt+I` / `Ctrl+Cmd+I`, or the chat icon in the title bar):

- With the default **Copilot** agent harness, the book code appears in the chat. Hover over it and click **Insert At Cursor** (or press `Ctrl+Enter`, `Cmd+Enter` on Mac) to put it at your cursor exactly as printed. Avoid **Apply in Editor**: it asks a Copilot model to merge the code into your file, which can change or delete your existing lines.
- With the **Local** harness (chosen at the bottom of the chat input; VS Code is removing it in February 2027), the book code is inserted into your open saved file. Choose **Keep** or **Undo**.

**Inline chat** (`Ctrl+I` / `Cmd+I` in the editor): save your file first, as a `.py` or `.java` file (an empty file is fine). The book code is inserted at your cursor; choose **Keep** or **Undo**. In an untitled file the code is shown in the inline chat instead, with a reminder to use Find Book Example.

### If AI First isn't in the model list

The Copilot agent harness only lists models from extensions while the VS Code setting [`chat.agentHost.byokModels.enabled`](vscode://settings/chat.agentHost.byokModels.enabled) is on. It is on by default, but it is marked experimental, so VS Code can turn it off. When it is off:

- signed out, a prompt fails with "Authentication is required to start a session"
- signed in, chat quietly switches to Copilot Fusion, which answers with AI-written code

Turn the setting on (restart VS Code if AI First still doesn't appear), or switch the chat to the **Local** harness while it exists. Find Book Example always works.

### Things to know

- **AI usage**: the AI First model never calls an AI service. If you are signed in to GitHub, VS Code can still use Copilot models for its own background tasks, such as naming a chat. Use Find Book Example if you need a path that makes no AI calls at all.
- **Copilot Business or Enterprise**: if your Copilot access comes from an employer, your administrator's policies may hide models supplied by extensions, including this one. We have not tested those plans. Find Book Example works regardless.

### Compatibility

| | Needs | Tested on |
|---|---|---|
| Books panel, example viewer, Find Book Example | VS Code 1.104 or later | 1.104 and 1.148 on Windows, macOS and Linux |
| AI First model in the chat panel and inline chat | VS Code with Copilot Chat; signed out or a personal Copilot plan | 1.148 |
| AI First model in the Agents window | A personal Copilot plan | 1.148 |

## Getting Started Walkthrough

When you first install the extension, VS Code will offer a getting started walkthrough that guides you through:
1. Inserting book code with Find Book Example
2. Exploring the book content
3. Opening examples
4. Copying example prompts
5. Making the AI First model visible in chat (optional)
6. Using the AI First model in chat (optional)

You can access this walkthrough anytime from the VS Code welcome page or by searching for "Get Started with AI First Programming" in the Command Palette.

## Keyboard Shortcuts

- **Inline chat**: `Cmd+I` (Mac) / `Ctrl+I` (Windows/Linux)
- **Model Selection**: `Cmd+Alt+.` (Mac) / `Ctrl+Alt+.` (Windows/Linux)
- **Find Book Example**: `Cmd+Alt+Shift+B` (Mac) / `Ctrl+Alt+Shift+B` (Windows/Linux)
- **Focus on AI First Books Panel**: Use the command `ai-first-programming.focus` or click the sidebar icon

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/aifirstprogramming/aifirstextension).

## Authors

This extension is created by the authors of the AI First Programming book series:
- **Stephen Chin** - [@steveonjava](https://github.com/steveonjava)
- **Cassandra Chin** - [@Tingsters](https://github.com/tingsters)
- **Jennifer Reif** - [@JMHReif](https://github.com/JMHReif)

## License

The extension source, documentation, generated artifacts, and distributable
examples are released under the [Apache License 2.0](LICENSE). See
[NOTICE](NOTICE) for attribution.

The license does not grant rights to the AI First names or logos. See
[TRADEMARKS.md](TRADEMARKS.md).

---

**Enjoy learning with AI First Programming!**
