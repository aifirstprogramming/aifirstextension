/**
 * Text helpers for inserting book code into a reader's editor.
 *
 * Kept free of the `vscode` import so they can be unit tested under plain Node.
 */

/**
 * Convert the book response to the target document's line endings.
 *
 * The books store code with `\n`. Inserting that into a CRLF document gives a
 * file with mixed endings, so insertion follows the document. Copy and "Open in
 * New Editor" use the response unchanged.
 */
export function toDocumentEol(text: string, eol: '\n' | '\r\n'): string {
	const normalized = text.replace(/\r\n/g, '\n');
	return eol === '\r\n' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

/** Short, human-readable location of a matched step, e.g. "Chapter 3 › Fizz Buzz (step 2 of 3)". */
export function describeStep(
	step: { index: number; total: number },
	example: { title: string; chapterNumber: number; bookTitle: string } | undefined
): string {
	const stepPart = step.total > 1 ? ` (step ${step.index} of ${step.total})` : '';
	if (!example) {
		return `Book example${stepPart}`;
	}
	return `${example.bookTitle}, Chapter ${example.chapterNumber} › ${example.title}${stepPart}`;
}
