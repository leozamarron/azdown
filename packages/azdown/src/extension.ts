import * as vscode from 'vscode';
import type MarkdownIt from 'markdown-it';
import { azdown } from 'markdown-it-azdown';
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
	const background = (action: string, task: PromiseLike<unknown>): void => {
		void Promise.resolve(task).catch((err: unknown) => {
			log.appendLine(`[${action}] failed: ${err instanceof Error ? err.message : String(err)}`);
		});
	};

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
	const command = (id: string, run: (item?: PageItem) => Promise<void>): vscode.Disposable =>
		vscode.commands.registerCommand(id, async (item?: PageItem) => {
			try {
				await run(item);
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
		background('refresh previews', vscode.commands.executeCommand('markdown.preview.refresh'));
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
		refreshPreviews();
		// Open it for editing: the point of creating a page is writing it.
		await vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
	}

	context.subscriptions.push(
		log,
		wiki,
		tree,
		view,
		wiki.onDidChange(() => {
			tree.refresh();
			refreshPreviews();
		}),

		command('azdown.refresh', async () => {
			await wiki.detect();
			tree.refresh();
			refreshPreviews();
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

			// A local wiki belongs to the user, not the open repository. Always
			// share the selection across projects without writing workspace files.
			log.appendLine(`[chooseWikiRoot] ${root} -> Global`);
			await vscode.workspace.getConfiguration('azdown').update(
				'wikiRoot', root, vscode.ConfigurationTarget.Global
			);

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

		vscode.window.onDidChangeActiveTextEditor(() => background('reveal active page', revealActive())),
		view.onDidChangeVisibility(() => background('reveal active page', revealActive())),

		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('azdown.wikiRoot')) {
				background('detect wiki', wiki.detect());
			}
		}),

		// A workspace folder appearing is the other way a wiki can show up.
		vscode.workspace.onDidChangeWorkspaceFolders(() => background('detect wiki', wiki.detect()))
	);

	// Keep the tree honest as pages come and go. `.order` matters as much as
	// the .md files themselves, since it drives both ordering and detection.
	// Watch the selected root as well as workspace folders: the picker can
	// select a wiki outside the workspace, including in an empty window.
	let rootWatcher: vscode.FileSystemWatcher | undefined;

	// A page appearing or disappearing changes other pages' output -- subpage
	// lists, and whether a link resolves -- so previews need re-rendering too.
	// Plain edits do not: VS Code already re-renders the document being edited.
	const structureChanged = (): void => {
		background('refresh wiki', wiki.detect().then(() => {
			tree.refresh();
			refreshPreviews();
		}));
	};

	const watch = (pattern: vscode.GlobPattern): vscode.FileSystemWatcher => {
		const watcher = vscode.workspace.createFileSystemWatcher(pattern);
		watcher.onDidCreate(structureChanged);
		watcher.onDidDelete(structureChanged);
		watcher.onDidChange((uri) => {
			if (uri.path.endsWith('/.order')) {
				structureChanged();
			}
		});
		return watcher;
	};
	context.subscriptions.push(
		watch('**/{*.md,*.MD,.order}'),
		wiki.onDidChange(() => {
			rootWatcher?.dispose();
			const root = wiki.root();
			rootWatcher = root && !vscode.workspace.getWorkspaceFolder(vscode.Uri.file(root))
				? watch(new vscode.RelativePattern(root, '**/{*.md,*.MD,.order}'))
				: undefined;
		}),
		{ dispose: () => rootWatcher?.dispose() }
	);

	background('initialize wiki', wiki.detect().then(() => revealActive()));

	return {
		extendMarkdownIt(md: MarkdownIt): MarkdownIt {
			/*
			 * Azure DevOps renders Mermaid from both ```mermaid fences and
			 * ::: mermaid containers, so azdown does too -- except that VS Code
			 * has rendered the fenced form itself since 1.121, by replacing
			 * markdown-it's `highlight`. Claiming the same fence twice makes the
			 * two implementations fight over one element, so step aside when the
			 * built-in is there and take the fences when it is not.
			 */
			const builtInMermaid =
				vscode.extensions.getExtension('vscode.mermaid-markdown-features') !== undefined;
			log.appendLine(`[extendMarkdownIt] built-in Mermaid: ${builtInMermaid ? 'yes' : 'no'}`);

			// `wiki` is passed as a live object, not a snapshot: extendMarkdownIt
			// runs once per engine, but the root can change at any time.
			return md.use(azdown, { wiki, mermaidFences: !builtInMermaid });
		}
	};
}

export function deactivate() {}
