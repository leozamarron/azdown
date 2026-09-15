import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pageTitle, type SubpageEntry, type WikiProvider } from 'markdown-it-azdown';

/**
 * Azure DevOps wiki repositories carry a `.order` file in every directory that
 * has pages, listing the page names (without `.md`) in display order. It is the
 * only reliable on-disk marker that a folder *is* a wiki, which is why we
 * detect the root by looking for the shallowest one.
 */
const ORDER_FILE = '.order';

export interface WikiPage {
	/** Absolute path of the page's `.md` file. */
	file: string;
	/** Display title: dashes become spaces, `%2D` stays a dash. */
	title: string;
	/** Absolute path of the folder holding this page's children, if any. */
	childrenDir: string | undefined;
}

/** Reads a `.order` file, returning page names in order. Missing file -> []. */
function readOrder(dir: string): string[] {
	try {
		return fs
			.readFileSync(path.join(dir, ORDER_FILE), 'utf8')
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
	} catch {
		return [];
	}
}

/**
 * Lists the pages in a wiki directory.
 *
 * `.order` wins where it applies; anything on disk but absent from `.order` is
 * appended alphabetically rather than hidden, so a page never silently
 * disappears from the tree just because someone forgot to update the file.
 */
export function listPages(dir: string): WikiPage[] {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}

	const files = new Map<string, string>();
	for (const entry of entries) {
		if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
			files.set(entry.name.replace(/\.md$/i, ''), entry.name);
		}
	}

	const ordered = readOrder(dir).filter((name) => files.has(name));
	const rest = [...files.keys()].filter((name) => !ordered.includes(name)).sort();

	return [...ordered, ...rest].map((name) => {
		const childrenDir = path.join(dir, name);
		return {
			file: path.join(dir, files.get(name) as string),
			title: pageTitle(name),
			childrenDir: fs.existsSync(childrenDir) && fs.statSync(childrenDir).isDirectory()
				? childrenDir
				: undefined
		};
	});
}

/**
 * Tracks which folder is the wiki root and tells everyone when it changes.
 *
 * Detection order: the `azdown.wikiRoot` setting wins, then the shallowest
 * folder containing a `.order` file, then nothing. "Nothing" is a legitimate
 * outcome -- the plugin degrades to leaving attachments and `[[_TOSP_]]` alone
 * rather than guessing a root and silently rewriting links to the wrong place.
 */
export class WikiRoot implements WikiProvider {
	private current: string | undefined;

	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChange = this.changed.event;

	constructor(private readonly log: vscode.OutputChannel) {}

	root(): string | undefined {
		return this.current;
	}

	/** Children of the page whose file is `documentPath`. Used by `[[_TOSP_]]`. */
	subpages(documentPath: string): SubpageEntry[] {
		if (!this.current) {
			return [];
		}
		const dir = documentPath.replace(/\.md$/i, '');
		const pageDir = path.dirname(documentPath);

		return listPages(dir).map((page) => ({
			title: page.title,
			// Relative to the parent page, so the link works in the preview.
			href: `./${path.relative(pageDir, page.file).split(path.sep).join('/')}`
		}));
	}

	async detect(): Promise<void> {
		const configured = await fromSetting();
		const detected = configured ? undefined : await fromOrderFiles();
		const next = configured ?? detected;

		this.log.appendLine(
			`[detect] setting=${configured ?? '-'} order=${detected ?? '-'} -> ${next ?? 'none'}`
		);

		if (next && !fs.existsSync(next)) {
			// A stale setting pointing at a folder that no longer exists would
			// otherwise leave the tree mysteriously empty.
			this.log.appendLine(`[detect] configured wiki root does not exist: ${next}`);
			void vscode.window.showWarningMessage(`azdown: wiki root does not exist: ${next}`);
		}

		if (next === this.current) {
			return;
		}
		this.current = next;
		this.changed.fire();
	}

	dispose(): void {
		this.changed.dispose();
	}
}

async function fromSetting(): Promise<string | undefined> {
	const configured = vscode.workspace.getConfiguration('azdown').get<string>('wikiRoot')?.trim();
	if (!configured) {
		return undefined;
	}
	if (path.isAbsolute(configured)) {
		return configured;
	}
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? path.join(folder.uri.fsPath, configured) : undefined;
}

async function fromOrderFiles(): Promise<string | undefined> {
	const found = await vscode.workspace.findFiles(`**/${ORDER_FILE}`, '**/node_modules/**', 50);
	if (found.length === 0) {
		return undefined;
	}
	// Shallowest wins: nested .order files mark subtrees, not the root.
	const dirs = found.map((uri) => path.dirname(uri.fsPath));
	return dirs.reduce((a, b) => (b.split(path.sep).length < a.split(path.sep).length ? b : a));
}
