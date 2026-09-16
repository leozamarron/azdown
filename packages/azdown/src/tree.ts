import * as vscode from 'vscode';
import * as path from 'node:path';
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
		readonly childrenDir: string | undefined,
		readonly parent: PageItem | undefined
	) {
		super(
			title,
			childrenDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);
		this.resourceUri = vscode.Uri.file(file);
		this.id = this.resourceUri.toString();
		// Keep the display title: without this VS Code would show the file name.
		this.label = title;
		this.iconPath = new vscode.ThemeIcon('file');
		this.tooltip = file;
		// Drives which context-menu entries apply; see the `menus` contribution.
		this.contextValue = 'azdownPage';
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

	/**
	 * Every item handed out, by file path.
	 *
	 * `reveal` needs the exact object the tree is holding -- a freshly built
	 * equivalent will not match -- so items are remembered rather than rebuilt
	 * when we need to select the active page.
	 */
	private readonly items = new Map<string, PageItem>();

	constructor(private readonly wiki: WikiRoot) {}

	refresh(): void {
		this.items.clear();
		this.changed.fire(undefined);
	}

	dispose(): void {
		this.items.clear();
		this.changed.dispose();
	}

	getTreeItem(element: PageItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PageItem): PageItem[] {
		const dir = element ? element.childrenDir : this.wiki.root();
		if (!dir) {
			return [];
		}
		return listPages(dir).map((page) => {
			const known = this.items.get(page.file);
			if (known) {
				return known;
			}
			const item = new PageItem(page.file, page.title, page.childrenDir, element);
			this.items.set(page.file, item);
			return item;
		});
	}

	/** Required for `TreeView.reveal`, which walks up from the target item. */
	getParent(element: PageItem): PageItem | undefined {
		return element.parent;
	}

	/**
	 * Finds the item for a file, expanding ancestors as needed.
	 *
	 * The tree is lazy: a nested page has no item until its parent has been
	 * expanded at least once, so walking down from the root is what makes
	 * "reveal the active page" work for a page the user has never opened in
	 * the tree.
	 */
	async find(file: string): Promise<PageItem | undefined> {
		const known = this.items.get(file);
		if (known) {
			return known;
		}

		const walk = (parent?: PageItem): PageItem | undefined => {
			for (const item of this.getChildren(parent)) {
				if (item.file === file) {
					return item;
				}
				// Only descend where the target could actually live.
				if (item.childrenDir && file.startsWith(`${item.childrenDir}${path.sep}`)) {
					return walk(item);
				}
			}
			return undefined;
		};

		return walk();
	}
}
