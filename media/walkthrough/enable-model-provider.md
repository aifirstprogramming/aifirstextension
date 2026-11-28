## Optional: Make the AI First Model Visible in Chat

If you want to type book prompts into VS Code's chat, the **AI First Programming** model can answer them with the book's code instead of an AI answer. You don't need a GitHub sign-in for this. Skip this step if you only use Find Book Example.

### Make the model visible

1. Click the button to copy the command and open the Command Palette, paste it (`Ctrl+V` / `Cmd+V`) and press `Enter`. Or run **Chat: Manage Language Models** yourself.
2. Expand the **AI First** group and click the **eye icon** next to **AI First Programming**, so the row is bold.

### If it doesn't show up in chat

The default **Copilot** agent harness lists extension models only while the setting `chat.agentHost.byokModels.enabled` is on. It is on by default but experimental, so VS Code can turn it off. Use the **Check the setting** link to open it and turn it on. Restart VS Code if AI First still doesn't appear.
