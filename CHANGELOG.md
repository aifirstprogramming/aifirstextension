# Change Log

All notable changes to the "AI First Programming" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-05-17

### Changed
- Renamed the language model from "AI First Book Examples" to "AI First Programming" everywhere it appears in the chat picker, walkthrough, and documentation. The model id is now `ai-first-programming` (previously `ai-first-book-examples`).

## [1.3.0] - 2026-05-16

### Added
- Full inline chat (`Ctrl+I` / `Cmd+I`) support — book examples now insert directly into your editor with the native Keep/X diff overlay, the same UX as Copilot's built-in models. Works for both saved files (uses Copilot's `replace_string_in_file` tool against the absolute path) and untitled buffers (inserts a placeholder and addresses the tool call against the `untitled:` URI form).
- Chat panel responses now render as fenced markdown code blocks with native **Insert at Cursor** / **Apply** actions instead of plain conversational text.

### Changed
- Advertised `toolCalling: true` capability so the model surfaces in the Copilot Chat picker (recent Copilot Chat builds filter out models without this).
- Increased `maxInputTokens` to 128000 and `maxOutputTokens` to 4096.
- Prompt matcher now strips the `<prompt>...</prompt>` wrapper Copilot Chat adds in inline chat, so fuzzy scoring sees the user's actual text.
- For plaintext / untitled buffers, the matcher exhausts Python entries entirely before falling through to Java, so a blank file defaults to Python examples.
- Documentation updated for the eye-icon UI in Manage Language Models (replaces the older checkbox) and for the new inline-chat workflow.

## [1.2.0] - 2025-12-06

### Fixed
- Fixed transparency on the icon

## [1.1.0] - 2025-12-06

### Added
- Added an icon for the plug-in

## [1.0.0] - 2025-12-06

### Added
- Initial release of AI First Programming extension
- Book content browser with hierarchical navigation (Books → Sections → Chapters → Examples)
- Example viewer with syntax highlighting using Prism.js
- Copy functionality for prompts and responses with visual feedback
- AI First Book Examples Language Model Chat Provider
- Language-aware prompt matching (filters by active editor language)
- Support for Python and Java book content
- Getting started walkthrough with 5 steps
- Sidebar tree view for browsing book content
- Webview panel for displaying example details
- Multiple matching strategies (exact, partial, fuzzy matching)
- Zero token cost when using AI First Book Examples model
- Support for both single prompt and multiple prompts per example

