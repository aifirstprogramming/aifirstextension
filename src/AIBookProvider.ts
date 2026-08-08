import * as vscode from 'vscode';
import type { Book, Chapter, Example, Section } from '@aifirst/content';
import { getBookContent } from './bookContent';

/**
 * The shape `AIBookWebViewProvider` renders: an example flattened to a uniform
 * list of prompt/response pairs. The package models the same thing as `steps`,
 * so the two are bridged here rather than in the webview, which is untouched.
 */
interface WebViewExample {
  title: string;
  description: string;
  prompts: { prompt: string; response: string }[];
}

function toWebViewExample(example: Example): WebViewExample {
  return {
    title: example.title,
    description: example.description ?? '',
    prompts: example.steps.map(step => ({ prompt: step.prompt, response: step.response }))
  };
}

export class AIBookProvider implements vscode.TreeDataProvider<BookItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<BookItem | undefined | null | void> = new vscode.EventEmitter<BookItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<BookItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BookItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BookItem): Thenable<BookItem[]> {
    if (!element) {
      // Root level - return books
      return Promise.resolve(this.getBooks());
    } else if (element.contextValue === 'book') {
      // Return sections for this book
      return Promise.resolve(this.getSections(element.data as Book));
    } else if (element.contextValue === 'section') {
      // Return chapters for this section
      return Promise.resolve(this.getChapters(element.data as Section));
    } else if (element.contextValue === 'chapter') {
      // Return topics for this chapter
      return Promise.resolve(this.getExamples(element.data as Chapter));
    }
    return Promise.resolve([]);
  }

  private getBooks(): BookItem[] {
    return getBookContent().books.map(book => {
      const bookItem = new BookItem(
        book.title,
        vscode.TreeItemCollapsibleState.Collapsed,
        'book',
        book
      );
      bookItem.iconPath = new vscode.ThemeIcon('book');
      bookItem.tooltip = `${book.title} - ${book.sections.length} sections`;
      return bookItem;
    });
  }

  private getSections(bookData: Book): BookItem[] {
    return bookData.sections.map(section => {
      const sectionItem = new BookItem(
        section.title,
        vscode.TreeItemCollapsibleState.Expanded,
        'section',
        section
      );
      sectionItem.iconPath = new vscode.ThemeIcon('folder');
      sectionItem.tooltip = `${section.title} - ${section.chapters.length} chapters`;
      return sectionItem;
    });
  }

  private getChapters(sectionData: Section): BookItem[] {
    return sectionData.chapters.map(chapter => {
      const chapterItem = new BookItem(
        chapter.title,
        vscode.TreeItemCollapsibleState.Collapsed,
        'chapter',
        chapter
      );
      chapterItem.iconPath = new vscode.ThemeIcon('file-text');
      chapterItem.tooltip = chapter.goal;
      chapterItem.description = `${chapter.examples.length} topics`;
      return chapterItem;
    });
  }

  private getExamples(chapterData: Chapter): BookItem[] {
    return chapterData.examples.map(example => {
      const exampleItem = new BookItem(
        example.title,
        vscode.TreeItemCollapsibleState.None,
        'example',
        example
      );
      exampleItem.iconPath = new vscode.ThemeIcon('notebook-mimetype');
      exampleItem.tooltip = example.description;
      exampleItem.command = {
        command: 'ai-first-programming.showExample',
        title: 'Show Example',
        arguments: [toWebViewExample(example)]
      };
      return exampleItem;
    });
  }
}

class BookItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly data: unknown
  ) {
    super(label, collapsibleState);
  }
}
