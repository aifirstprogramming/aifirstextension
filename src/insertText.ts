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

/**
 * End the inserted code's line.
 *
 * Book responses don't end with a newline. Inserted before other text on the
 * same line, the next line would run into the code's last line (`}// c1`), and
 * at the end of a file the file would end without a newline. Nothing is added
 * when the code already ends a line or the text after it starts a new one.
 */
export function endLine(code: string, textAfter: string): string {
	if (code.endsWith('\n') || textAfter.startsWith('\n') || textAfter.startsWith('\r\n')) {
		return code;
	}
	return `${code}\n`;
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
