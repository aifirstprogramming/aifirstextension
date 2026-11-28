## Optional: Use the AI First Model in Chat

### Choose AI First every time

The model button at the bottom of the chat input shows which model will answer. Click it (or press `Ctrl+Alt+.` / `Cmd+Alt+.`) and choose **AI First Programming**. VS Code remembers a separate choice for each place you chat, so check it whenever you start a new chat. **Auto** and **Copilot Fusion** are AI models: they write their own code, not the book's.

### Inline chat (inserts into your file)

1. Save your file first as a `.py` or `.java` file. An empty file is fine.
2. Press `Ctrl+I` (`Cmd+I` on Mac), paste the prompt and press `Enter`.
3. The book code is inserted at your cursor. Choose **Keep** or **Undo**.

In an untitled file the code is shown in the inline chat instead.

### Chat panel

1. Open the chat panel, paste the prompt and press `Enter`.
2. Hover over the code and click **Insert At Cursor** (or press `Ctrl+Enter`, `Cmd+Enter` on Mac). Avoid **Apply in Editor**: it asks a Copilot model to merge the code, which can change your existing lines.

With the **Local** agent harness (until VS Code removes it in February 2027) the code is inserted into your open saved file instead, with **Keep** and **Undo**.
