# AI First Programming Extension

A companion extension for the AI First Programming book series that provides easy access to book examples, prompts, and code responses. The extension includes a Language Model Chat Provider that returns exact code examples from the books, allowing you to practice with AI features in VS Code without using your Copilot token quota.

## Features

- **Book Content Browser**: Navigate through book content organized by book, section, chapter, and example in a convenient sidebar tree view
- **Example Viewer**: View detailed prompts and code responses with syntax highlighting
- **Copy Functionality**: Easily copy prompts and responses to use in your code editor
- **AI First Book Examples Model**: A custom language model that returns exact code examples from the books
- **Language-Aware Matching**: Automatically matches prompts based on your active editor's programming language
- **Zero Token Cost**: Use the AI First Book Examples model without consuming your Copilot token quota

## Requirements

- Visual Studio Code version 1.102.0 or later
- GitHub Copilot (Free or Pro plan) - Note: Enterprise licenses may not support the "Manage Models" feature

## Installation

You can find the AI First Programming extension in the VS Code Extension Marketplace.

1. Open VS Code
2. Click on the **Extensions** icon in the left toolbar (represented by 4 squares)
3. Type **"ai first programming"** or **"ai first book"** in the search bar
4. Look for the extension published by **Stephen Chin, Cassandra Chin, and Jennifer Reif** (the authors of the AI First series)
5. Click **Install**

After installation, you'll see a new icon in the sidebar with a picture of a book that has "A" and "I" on the pages. Click this icon to open the extension.

> **Note**: The extension will be available in the VS Code Marketplace. [Marketplace link will be added when available]

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

You can then:
1. Open a new editor (`Ctrl+N` / `Cmd+N`)
2. Paste the prompt into GitHub Copilot Chat (`Ctrl+Shift+I` / `Cmd+Shift+I`)
3. Use the generated code, or if it doesn't match the book example, paste the response from the plugin

> **Tip**: We recommend always trying the prompt first, but don't hesitate to use the book response if needed!

## Enabling the AI First Book Examples Model

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

### Step 4: Enable AI First Book Examples

1. In the Manage Language Models dialog, find **"AI First Book Examples"** (it should be near the top alphabetically)
2. Click on it to open the model settings
3. Check the checkbox to **enable** the model
4. Click **"OK"** to save your changes

### Step 5: Select the Model

1. Return to your AI prompt
2. Click the model selection drop-down again
3. You should now see **"AI First Book Examples"** as an available option
4. Select it to start using the book examples model

### Using the Model

Once enabled and selected, all your prompts will return the exact code responses that match the book text. Benefits include:

- ✅ **Exact book examples**: Get the same code as shown in the book
- ✅ **No token costs**: Complete all book exercises without using your Copilot quota
- ✅ **Language-aware**: Automatically matches prompts based on your active editor's language
- ✅ **Practice mode**: Perfect for learning AI-assisted coding without worrying about limits

> **Caution**: The AI First Book Model only works with individual GitHub plans like Free and Copilot Pro. If you have an enterprise GitHub license from your work, the "Manage Models…" menu item will be missing from the drop-down. To use the AI First Book Model, you will need to create a separate GitHub account and associate it with Copilot.

## Getting Started Walkthrough

When you first install the extension, VS Code will offer a getting started walkthrough that guides you through:
1. Enabling the AI First Book Examples model
2. Exploring the book content
3. Opening examples
4. Copying example code
5. Using examples with GitHub Copilot Chat

You can access this walkthrough anytime from the VS Code welcome page or by searching for "Get Started with AI First Programming" in the Command Palette.

## Keyboard Shortcuts

- **Open AI Prompt**: `Cmd+I` (Mac) / `Ctrl+I` (Windows/Linux)
- **Model Selection**: `Cmd+Alt+.` (Mac) / `Ctrl+Alt+.` (Windows/Linux)
- **Focus on AI First Books Panel**: Use the command `ai-first-programming.focus` or click the sidebar icon

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/aifirstprogramming/aifirstextension).

## Authors

This extension is created by the authors of the AI First Programming book series:
- **Stephen Chin** - [@steveonjava](https://github.com/steveonjava)
- **Cassandra Chin** - [@Tingsters](https://github.com/tingsters)
- **Jennifer Reif** - [@JMHReif](https://github.com/JMHReif)

## License

See the [LICENSE](LICENSE) file for details.

---

**Enjoy learning with AI First Programming!**
