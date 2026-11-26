import * as vscode from 'vscode';
import { findMatch, unwrapPromptTag, type Step } from '@aifirst/content';
import { getBookContent } from './bookContent';
import { describeStep, toDocumentEol } from './insertText';
import { log } from './log';

/**
 * The Copilot-independent way for a reader to get book code into their editor.
 *
 * Native chat depends on Copilot, on the harness VS Code is running, and on an
 * experimental bridge setting. This path depends on none of them: no sign-in,
 * no network, no model calls. It is what the walkthrough leads with, and what
 * the language model provider points readers to when it cannot edit safely.
 *
 * Rules that make it safe to run against a reader's own file:
 * - The target (document, selection, version) is captured before any UI opens.
 * - Looking up, previewing and cancelling never modify a document.
 * - Insert re-checks the version and refuses if the document changed since.
 * - The edit is one WorkspaceEdit, so a single Undo reverts it.
 */

export const PREVIEW_SCHEME = 'aifirst-example';

export interface InsertionTarget {
	document: vscode.TextDocument;
	selection: vscode.Selection;
	version: number;
}

export type InsertResult = 'applied' | 'stale' | 'closed' | 'failed';

let lastWritableEditor: vscode.TextEditor | undefined;

function isWritable(document: vscode.TextDocument): boolean {
	if (document.isClosed) {
		return false;
	}
	if (document.uri.scheme === 'untitled') {
		return true;
	}
	return vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === true;
}

/**
 * Remember the last editor the reader could insert into. When the example
 * viewer (a webview) has focus there is no active text editor, so without this
 * its Insert button would have nowhere to go.
 */
export function trackEditors(context: vscode.ExtensionContext): void {
	const remember = (editor: vscode.TextEditor | undefined) => {
		if (editor && isWritable(editor.document)) {
			lastWritableEditor = editor;
		}
	};
	remember(vscode.window.activeTextEditor);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(remember));
}

function targetEditor(): vscode.TextEditor | undefined {
	const active = vscode.window.activeTextEditor;
	if (active && isWritable(active.document)) {
		return active;
	}
	if (lastWritableEditor && !lastWritableEditor.document.isClosed) {
		return lastWritableEditor;
	}
	return undefined;
}

export function captureTarget(editor: vscode.TextEditor | undefined): InsertionTarget | undefined {
	if (!editor || !isWritable(editor.document)) {
		return undefined;
	}
	return { document: editor.document, selection: editor.selection, version: editor.document.version };
}

/**
 * Replace the captured selection (or insert at the captured cursor) with `text`.
 * Exported for the extension-host tests; UI code goes through `offerStep`.
 */
export async function applyInsertion(target: InsertionTarget, text: string): Promise<InsertResult> {
	if (target.document.isClosed) {
		return 'closed';
	}
	if (target.document.version !== target.version) {
		return 'stale';
	}
	const eol = target.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
	const edit = new vscode.WorkspaceEdit();
	edit.replace(target.document.uri, target.selection, toDocumentEol(text, eol));
	return (await vscode.workspace.applyEdit(edit)) ? 'applied' : 'failed';
}

/** Read-only documents that show a matched response before the reader inserts it. */
export class ExamplePreviewProvider implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri): string {
		const id = uri.path.replace(/^\//, '').replace(/\.[^.]+$/, '');
		return getBookContent().steps.find(step => step.id === id)?.response ?? '';
	}
}

const EXTENSIONS: Record<string, string> = { python: 'py', java: 'java' };

function previewUri(step: Step): vscode.Uri {
	return vscode.Uri.from({ scheme: PREVIEW_SCHEME, path: `/${step.id}.${EXTENSIONS[step.language] ?? 'txt'}` });
}

function targetLabel(target: InsertionTarget): string {
	const name = target.document.isUntitled
		? target.document.uri.path
		: target.document.uri.path.split('/').pop() ?? target.document.uri.path;
	return `${name}, line ${target.selection.start.line + 1}`;
}

async function openInNewEditor(step: Step): Promise<void> {
	const document = await vscode.workspace.openTextDocument({ content: step.response, language: step.language });
	await vscode.window.showTextDocument(document);
}

/**
 * Tell the reader what matched and let them Insert, Copy or Open it.
 * `preview` opens the response beside the editor first; the example viewer
 * already shows the code, so it skips that.
 */
export async function offerStep(step: Step, target: InsertionTarget | undefined, preview: boolean): Promise<void> {
	const example = getBookContent().examples.find(e => e.id === step.exampleId);
	const where = describeStep(step, example);

	if (preview) {
		const document = await vscode.workspace.openTextDocument(previewUri(step));
		await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus: true });
	}

	const question = target
		? `Matched ${where} (${step.language}). Insert it into ${targetLabel(target)}?`
		: `Matched ${where} (${step.language}). There is no open file to insert into, so you can copy it or open it in a new editor.`;
	const actions = target ? ['Insert', 'Copy', 'Open in New Editor'] : ['Copy', 'Open in New Editor'];
	const choice = await vscode.window.showInformationMessage(question, ...actions);

	switch (choice) {
		case 'Insert': {
			const result = await applyInsertion(target!, step.response);
			log()?.info(`insert ${step.id}: ${result}`);
			if (result === 'applied') {
				await vscode.window.showTextDocument(target!.document);
				vscode.window.setStatusBarMessage(`AI First: inserted ${where}`, 4000);
			} else if (result === 'stale' || result === 'closed') {
				vscode.window.showWarningMessage(
					'The file changed after the example was matched, so nothing was inserted. Run AI First: Find Book Example again.'
				);
			} else {
				const retry = await vscode.window.showErrorMessage('The example could not be inserted into that file.', 'Open in New Editor');
				if (retry) {
					await openInNewEditor(step);
				}
			}
			return;
		}
		case 'Copy':
			await vscode.env.clipboard.writeText(step.response);
			vscode.window.setStatusBarMessage('AI First: example copied to the clipboard', 4000);
			return;
		case 'Open in New Editor':
			await openInNewEditor(step);
			return;
		default:
			return;
	}
}

/** Command: AI First: Find Book Example… */
export async function findBookExample(): Promise<void> {
	// Capture before the input box takes focus, so we insert where the reader was.
	const editor = targetEditor();
	const target = captureTarget(editor);
	const language = (editor ?? vscode.window.activeTextEditor)?.document.languageId;

	const prompt = await vscode.window.showInputBox({
		title: 'AI First: Find Book Example',
		prompt: 'Paste a prompt from the book to find its example code.',
		placeHolder: 'e.g. Write a program that prints Hello World',
		ignoreFocusOut: true,
	});
	if (!prompt?.trim()) {
		return;
	}

	// Same matcher and language rules as the chat model and the aifirst CLI.
	const step = findMatch(unwrapPromptTag(prompt.trim()), getBookContent().steps, language);
	if (!step) {
		const scope = language && language !== 'plaintext' ? ` for ${language} files` : '';
		const open = await vscode.window.showWarningMessage(
			`No book example matches that prompt${scope}. Check the wording against the book, or browse the AI First Books panel.`,
			'Open Books Panel'
		);
		if (open) {
			await vscode.commands.executeCommand('aiFirstBooks.focus');
		}
		return;
	}
	await offerStep(step, target, true);
}

/** Insert button in the example viewer. */
export async function insertStepById(stepId: string): Promise<void> {
	const target = captureTarget(targetEditor());
	const step = getBookContent().steps.find(s => s.id === stepId);
	if (!step) {
		vscode.window.showErrorMessage('That example could not be found in the book content.');
		return;
	}
	await offerStep(step, target, false);
}
