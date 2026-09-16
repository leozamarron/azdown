import * as vscode from 'vscode';
import type MarkdownIt from 'markdown-it';
import { azdown } from 'markdown-it-azdown';
import * as path from 'node:path';
import { WikiRoot, createPage, wikiPathOf } from './wiki.js';
import { WikiTreeProvider, type PageItem } from './tree.js';

/**
 * The extension opens no preview of its own: it extends VS Code's built-in one
 * through `markdown.markdownItPlugins`, so Ctrl+K V, scroll sync and theme
 * integration keep working.
 *
 * The commands and the tree view exist only to supply the wiki *context* a
 * lone Markdown file cannot carry -- the wiki root -- which is what makes
 * `[[_TOSP_]]` and `/.attachments/` images resolvable at all.
 */
export function activate(context: vscode.ExtensionContext) {
	const log = vscode.window.createOutputChannel('azdown');
	const wiki = new WikiRoot(log);
	const tree = new WikiTreeProvider(wiki);
	const view = vscode.window.createTreeView('azdown.pages', {
		treeDataProvider: tree,
		showCollapseAll: true
	});

	/**
	 * Selects the page the user is editing.
	 *
	 * Without this the tree shows no relationship to the editor, which is the
	 * difference between a navigation aid and a list of files.
	 */
	const revealActive = async (): Promise<void> => {
		const file = vscode.window.activeTextEditor?.document.uri.fsPath;
		if (!file?.toLowerCase().endsWith('.md') || !view.visible) {
			return;
		}
		const item = await tree.find(file);
		if (item) {
			// `select` without `focus`: highlight the page, but never steal the
			// cursor away from the editor the user is typing in.
			await view.reveal(item, { select: true, focus: false, expand: true });
		}
	};

	/** The folder holding a page's children, creating nothing on disk yet. */
	const childrenDirOf = (item: PageItem): string => item.file.replace(/\.md$/i, '');

	/**
	 * Commands must never reject silently.
	 *
	 * VS Code discards a rejected command promise without telling anyone, so an
	 * unhandled failure shows up as "I clicked and nothing happened" -- which is
	 * exactly how the wiki-root picker failed before: it wrote the setting with
	 * ConfigurationTarget.Workspace, which throws when the window has no folder
	 * open, and the error went nowhere.
	 */
	const command = (id: string, run: () => Promise<void>): vscode.Disposable =>
		vscode.commands.registerCommand(id, async () => {
			try {
				await run();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log.appendLine(`[${id}] failed: ${message}`);
				void vscode.window.showErrorMessage(`azdown: ${message}`);
			}
		});

	/**
	 * Re-render every open preview.
	 *
	 * Previews only re-render when their *document* changes, but everything the
	 * wiki context feeds -- [[_TOSP_]], attachment paths, page links -- depends
	 * on files the preview never sees. Without this, changing the wiki root
	 * leaves every open preview showing stale output until the user happens to
	 * type in it.
	 */
	const refreshPreviews = (): void => {
		void vscode.commands.executeCommand('markdown.preview.refresh');
	};

	/** Shared by "New Page" (view title) and "New Subpage" (context menu). */
	async function newPage(item?: PageItem): Promise<void> {
		const root = wiki.root();
		if (!root) {
			throw new Error('set a wiki root before creating pages');
		}
		// From the view title there is no item: create at the wiki root.
		const parentDir = item ? childrenDirOf(item) : root;
		const where = item ? `under "${String(item.label)}"` : 'at the wiki root';

		const title = await vscode.window.showInputBox({
			title: `New page ${where}`,
			prompt: 'Page title, written the way it should appear in the wiki',
			validateInput: (value) => (value.trim() === '' ? 'A page needs a title' : undefined)
		});
		if (title === undefined) {
			return;
		}

		const file = createPage(parentDir, title);
		log.appendLine(`[newPage] ${file}`);

		await wiki.detect();
		tree.refresh();
		// Open it for editing: the point of creating a page is writing it.
		await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
	}

	context.subscriptions.push(
		log,
		wiki,
		view,
		wiki.onDidChange(() => {
			tree.refresh();
			refreshPreviews();
		}),

		command('azdown.refresh', async () => {
			await wiki.detect();
			tree.refresh();
		}),

		command('azdown.chooseWikiRoot', async () => {
			const picked = await vscode.window.showOpenDialog({
				canSelectFolders: true,
				canSelectFiles: false,
				canSelectMany: false,
				openLabel: 'Use as wiki root',
				title: 'Select the Azure DevOps wiki root'
			});
			if (!picked?.[0]) {
				return;
			}
			const root = picked[0].fsPath;

			// Workspace settings only exist when a folder or .code-workspace is
			// open. Fall back to the user profile so the picker still works in an
			// empty window -- notably the Extension Development Host.
			const target = vscode.workspace.workspaceFolders?.length
				? vscode.ConfigurationTarget.Workspace
				: vscode.ConfigurationTarget.Global;

			log.appendLine(`[chooseWikiRoot] ${root} -> ${vscode.ConfigurationTarget[target]}`);
			await vscode.workspace.getConfiguration('azdown').update('wikiRoot', root, target);

			await wiki.detect();
			tree.refresh();

			if (wiki.root() !== root) {
				throw new Error(`the setting was saved but the wiki root did not take effect (${root})`);
			}
		}),

		command('azdown.edit', async (item?: PageItem) => {
			const target = item?.resourceUri;
			if (target) {
				await vscode.window.showTextDocument(target, { preview: false });
			}
		}),

		command('azdown.openToSide', async (item?: PageItem) => {
			if (item?.resourceUri) {
				await vscode.commands.executeCommand('markdown.showPreviewToSide', item.resourceUri);
			}
		}),

		command('azdown.copyLink', async (item?: PageItem) => {
			const root = wiki.root();
			if (!item || !root) {
				throw new Error('no wiki root is set, so there is no wiki path to copy');
			}
			// The Azure DevOps form -- root-absolute, no .md -- so it can be
			// pasted straight into another wiki page.
			const link = wikiPathOf(root, item.file);
			await vscode.env.clipboard.writeText(link);
			void vscode.window.showInformationMessage(`Copied ${link}`);
		}),

		command('azdown.newPage', (item?: PageItem) => newPage(item)),
		command('azdown.newSubpage', (item?: PageItem) => newPage(item)),

		vscode.window.onDidChangeActiveTextEditor(() => void revealActive()),
		view.onDidChangeVisibility(() => void revealActive()),

		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e.affectsConfiguration('azdown.wikiRoot')) {
				await wiki.detect();
			}
		}),

		// A workspace folder appearing is the other way a wiki can show up.
		vscode.workspace.onDidChangeWorkspaceFolders(() => void wiki.detect())
	);

	// Keep the tree honest as pages come and go. `.order` matters as much as
	// the .md files themselves, since it drives both ordering and detection.
	const watcher = vscode.workspace.createFileSystemWatcher('**/{*.md,.order}');

	// A page appearing or disappearing changes other pages' output -- subpage
	// lists, and whether a link resolves -- so previews need re-rendering too.
	// Plain edits do not: VS Code already re-renders the document being edited.
	const structureChanged = (): void => {
		void wiki.detect().then(() => {
			tree.refresh();
			refreshPreviews();
		});
	};

	context.subscriptions.push(
		watcher,
		watcher.onDidCreate(structureChanged),
		watcher.onDidDelete(structureChanged),
		watcher.onDidChange(() => tree.refresh())
	);

	void wiki.detect().then(() => revealActive());

	return {
		extendMarkdownIt(md: MarkdownIt): MarkdownIt {
			// `wiki` is passed as a live object, not a snapshot: extendMarkdownIt
			// runs once per engine, but the root can change at any time.
			return md.use(azdown, { wiki });
		}
	};
}

export function deactivate() {}
