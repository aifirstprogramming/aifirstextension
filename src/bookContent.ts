import { loadFromRaw, type Content, type RawBook } from '@aifirst/content';
import javaBook from '@aifirst/content/books/ai-first-java-programming.json';
import pythonBook from '@aifirst/content/books/ai-first-python-programming.json';

/**
 * The book content, loaded once from the shared `@aifirst/content` package.
 *
 * The books used to live in this repo under `book_content/` and were walked
 * separately by the language model provider and the tree view. They now come
 * from the same package the `aifirst` CLI consumes, so a prompt printed in the
 * book resolves to the same code in the terminal and in VS Code.
 *
 * The JSON is imported through the package's `./books/*` subpath export rather
 * than read from disk, so nothing has to resolve a runtime path inside the
 * packaged .vsix.
 */

const EMPTY_CONTENT: Content = { books: [], examples: [], steps: [] };

let cached: Content | undefined;

export function getBookContent(): Content {
	if (cached) {
		return cached;
	}

	try {
		cached = loadFromRaw([
			{ filename: 'ai-first-java-programming.json', book: javaBook as unknown as RawBook },
			{ filename: 'ai-first-python-programming.json', book: pythonBook as unknown as RawBook },
		]);
		console.log(`AI First Programming: Loaded ${cached.steps.length} prompts from ${cached.books.length} books`);
	} catch (error) {
		// loadFromRaw is strict by default and throws on malformed content, where
		// the old inlined loader logged and carried on. Keep degrading rather than
		// failing activation: a content bug should cost the Books panel, not the
		// whole extension.
		console.error('AI First Programming: Error loading book content:', error);
		cached = EMPTY_CONTENT;
	}

	return cached;
}
