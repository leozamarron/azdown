import * as vscode from 'vscode';
import { listPages, type WikiRoot } from './wiki.js';

/**
 * A page in the wiki tree.
 *
 * The label is the Azure DevOps display title -- `Build-And-Release.md` shows
 * as "Build And Release" -- so the tree reads like the real wiki rather than
 * like a folder of files.
 */
export class PageItem extends vscode.TreeItem {
	constructor(
		readonly file: string,
		title: string,
		readonly childrenDir: string | undefined
	) {
		super(
			title,
			childrenDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);
		this.resourceUri = vscode.Uri.file(file);
		// Keep the display title: without this VS Code would show the file name.
		this.label = title;
		this.iconPath = new vscode.ThemeIcon('file');
		this.tooltip = file;
		this.command = {
			// Open the built-in preview, which is where azdown does its work.
			command: 'markdown.showPreview',
			title: 'Open Preview',
			arguments: [this.resourceUri]
		};
	}
}

export class WikiTreeProvider implements vscode.TreeDataProvider<PageItem> {
	private readonly changed = new vscode.EventEmitter<PageItem | undefined>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly wiki: WikiRoot) {}

	refresh(): void {
		this.changed.fire(undefined);
	}

	getTreeItem(element: PageItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PageItem): PageItem[] {
		const dir = element ? element.childrenDir : this.wiki.root();
		if (!dir) {
			return [];
		}
		return listPages(dir).map((page) => new PageItem(page.file, page.title, page.childrenDir));
	}
}
