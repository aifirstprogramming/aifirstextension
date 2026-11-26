# AI First Programming Extension

A companion extension for the AI First Programming book series that provides easy access to book examples, prompts, and code responses. The extension includes a Language Model Chat Provider that returns exact code examples from the books, allowing you to practice with AI features in VS Code without using your Copilot token quota.

## Features

- **Book Content Browser**: Navigate through book content organized by book, section, chapter, and example in a convenient sidebar tree view
- **Example Viewer**: View detailed prompts and code responses with syntax highlighting
- **Copy Functionality**: Easily copy prompts and responses to use in your code editor
- **Find Book Example**: Paste a prompt from the book and insert its exact code into your file, with no Copilot, sign-in, or network needed
- **AI First Programming Model**: A custom language model that returns exact code examples from the books
- **Language-Aware Matching**: Automatically matches prompts based on your active editor's programming language
- **No AI Credits for Book Code**: Find Book Example never calls a model, and the AI First Programming model answers from the book instead of an AI service

## Requirements

- Visual Studio Code version 1.104.0 or later
- Optional: GitHub Copilot (the Free plan works), only for using the AI First Programming model in VS Code's chat. The Books panel, the example viewer, and Find Book Example work without it.

## Installation

You can find the AI First Programming extension in the VS Code Extension Marketplace.

1. Open VS Code
2. Click on the **Extensions** icon in the left toolbar (represented by 4 squares)
3. Type **"ai first programming"** or **"ai first book"** in the search bar
4. Look for the extension published by **Stephen Chin, Cassandra Chin, and Jennifer Reif** (the authors of the AI First series)
5. Click **Install**

After installation, you'll see a new icon in the sidebar with a picture of a book that has "A" and "I" on the pages. Click this icon to open the extension.

> **Note**: The extension is available in the [VS Code Extension Marketplace](https://marketplace.visualstudio.com/items?itemName=AIFirstProgramming.ai-first-programming).

## Using the Plugin

### Browsing Book Content

1. Click the **AI First Programming** icon in the sidebar (the book icon with "A" and "I")
2. Navigate through the hierarchical structure:
   - **Books** → **Sections** → **Chapters** → **Examples**
3. Click on any example to view its details in a webview panel

### Viewing Examples

When you click on an example, a panel will open showing:
- **Example Title and Description**
- **Prompts**: The exact prompts used in the book
- **Responses**: The corresponding code responses with syntax highlighting

### Copying Prompts and Responses

Each example view includes copy buttons:
- **Copy Prompt**: Copies the prompt text to your clipboard
- **Copy Response**: Copies the code response to your clipboard

You can then use the prompt in either of two ways:

**Inline chat (recommended for inserting code directly):**
1. Open a new editor (`Ctrl+N` / `Cmd+N`)
2. Press `Ctrl+I` / `Cmd+I` to open the inline chat above your cursor
3. Paste the prompt and press Enter — the book example is inserted with a native Keep/X review overlay

**Chat panel (recommended for reading and comparing):**
1. Open GitHub Copilot Chat with `Ctrl+Shift+I` / `Cmd+Shift+I`
2. Paste the prompt and press Enter
3. The response appears as a code block with **Insert at Cursor** / **Apply** buttons

> **Tip**: We recommend always trying the prompt first, but don't hesitate to use the book response if needed!

Each response in the example view also has an **Insert into Editor** button, which puts the code into the last file you were editing after you confirm.

### Finding a Book Example (no Copilot needed)

This always works, whatever your Copilot setup, and doesn't use any AI credits:

1. Open the file you want the code in (a new untitled file is fine) and place your cursor, or select code to replace
2. Run **AI First: Find Book Example…** from the Command Palette, the editor's right-click menu, or with `Ctrl+Alt+Shift+B` (`Cmd+Alt+Shift+B` on Mac)
3. Paste the prompt from the book and press Enter
4. The matching book code opens beside your file. Choose **Insert** to add it at your cursor, **Copy**, or **Open in New Editor**

Matching uses your file's language, so a Python file gets the Python book's code. Insert is a normal edit: `Ctrl+Z` / `Cmd+Z` undoes it. If the file changed after the example was matched, nothing is inserted and you'll be asked to run the command again.

## Enabling the AI First Programming Model

The AI First Programming extension includes a custom language model that returns exact code examples from the books. This feature allows you to practice using AI features in VS Code without using your Copilot token quota.

### Step 1: Open an AI Prompt

1. Open any file in VS Code
2. Bring up an AI prompt by typing:
   - **Mac**: `Cmd+I`
   - **Windows/Linux**: `Ctrl+I`

### Step 2: Access Model Selection

1. Click on the **model drop-down** dialog in the chat interface, or
2. Type the keyboard shortcut:
   - **Mac**: `Cmd+Alt+.`
   - **Windows/Linux**: `Ctrl+Alt+.`

This will bring up a pick list of available models.

### Step 3: Open Manage Models

1. In the model selection drop-down, click on **"Manage Models…"** (usually the last item)
2. This opens the Manage Language Models dialog

### Step 4: Enable AI First Programming

1. In the Manage Language Models dialog, expand the **"AI First"** provider group (it should be near the top alphabetically)
2. Locate the **"AI First Programming"** model row
3. Click the **eye icon** next to the model — when the row appears in bold, the model is visible in the chat picker. (The older "checkbox" UI was replaced in recent Copilot Chat builds.)
4. Close the Manage Models dialog — your selection is saved automatically

### Step 5: Select the Model

1. Return to your AI prompt
2. Click the model selection drop-down again
3. You should now see **"AI First Programming"** as an available option
4. Select it to start using the book examples model

### Using the Model

Once enabled and selected, all your prompts will return the exact code responses that match the book text. Benefits include:

- ✅ **Exact book examples**: Get the same code as shown in the book
- ✅ **Book answers, not AI answers**: The AI First Programming model answers from the book rather than an AI service. VS Code may still use its own models for background tasks such as naming chats; use Find Book Example if you need a path that makes no AI calls at all
- ✅ **Language-aware**: Automatically matches prompts based on your active editor's language
- ✅ **Inline editing**: Use `Ctrl+I` / `Cmd+I` to insert book examples directly into your file with the native Keep/X diff review
- ✅ **Practice mode**: Perfect for learning AI-assisted coding without worrying about limits

> **Caution**: If your GitHub Copilot access comes from an employer (Copilot Business or Enterprise), your administrator's policies may hide models supplied by extensions, including this one. We have not tested those plans. Find Book Example works regardless of your Copilot plan.

## Getting Started Walkthrough

When you first install the extension, VS Code will offer a getting started walkthrough that guides you through:
1. Enabling the AI First Programming model
2. Exploring the book content
3. Opening examples
4. Copying example code
5. Using examples with GitHub Copilot Chat

You can access this walkthrough anytime from the VS Code welcome page or by searching for "Get Started with AI First Programming" in the Command Palette.

## Keyboard Shortcuts

- **Open AI Prompt**: `Cmd+I` (Mac) / `Ctrl+I` (Windows/Linux)
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
