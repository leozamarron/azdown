import * as vscode from 'vscode';
import type MarkdownIt from 'markdown-it';
import { azdown } from 'markdown-it-azdown';
import { WikiRoot } from './wiki.js';
import { WikiTreeProvider } from './tree.js';

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

	context.subscriptions.push(
		log,
		wiki,
		vscode.window.registerTreeDataProvider('azdown.pages', tree),
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

	void wiki.detect();

	return {
		extendMarkdownIt(md: MarkdownIt): MarkdownIt {
			// `wiki` is passed as a live object, not a snapshot: extendMarkdownIt
			// runs once per engine, but the root can change at any time.
			return md.use(azdown, { wiki });
		}
	};
}

export function deactivate() {}
