import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pageTitle, pageFileName, pathToHref, type SubpageEntry, type WikiProvider } from 'markdown-it-azdown';

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

/**
 * The Azure DevOps wiki path for a page, as it would be written in a link.
 *
 * Root-absolute and without the `.md`, matching how Azure DevOps writes links
 * between pages. `%2D` stays escaped because it is part of the page name.
 */
export function wikiPathOf(root: string, file: string): string {
	const rel = path.relative(root, file).replace(/\.md$/i, '');
	return `/${rel.split(path.sep).join('/')}`;
}

/**
 * Creates a new page and registers it in its folder's `.order`.
 *
 * Refuses to touch an existing file: this is the one place the extension
 * writes into the user's wiki, and silently overwriting a page would be the
 * worst possible bug to ship.
 *
 * Returns the path of the created file.
 */
export function createPage(parentDir: string, title: string): string {
	const name = pageFileName(title);
	if (name === '' || name.includes('/') || name.includes('\\') || name.startsWith('.')) {
		throw new Error(`not a usable page name: "${title}"`);
	}

	const file = path.join(parentDir, `${name}.md`);
	if (fs.existsSync(file)) {
		throw new Error(`a page called "${pageTitle(name)}" already exists here`);
	}

	fs.mkdirSync(parentDir, { recursive: true });
	fs.writeFileSync(file, `# ${title.trim()}\n`, { encoding: 'utf8', flag: 'wx' });
	try {
		addToOrder(parentDir, name);
	} catch (err) {
		// Leave no half-created page when registration fails.
		fs.unlinkSync(file);
		throw err;
	}
	return file;
}

/**
 * Appends a page to `.order`, leaving the existing contents untouched.
 *
 * A missing `.order` is created; a file without a trailing newline gets one,
 * so the new entry does not end up glued to the last page name.
 */
function addToOrder(dir: string, name: string): void {
	const orderFile = path.join(dir, ORDER_FILE);
	let existing = '';
	try {
		existing = fs.readFileSync(orderFile, 'utf8');
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
			throw err;
		}
		// No .order yet: this page becomes its first entry.
	}

	if (readOrder(dir).includes(name)) {
		return;
	}

	const newline = existing.includes('\r\n') ? '\r\n' : '\n';
	const separator = existing === '' || existing.endsWith('\n') ? '' : newline;
	fs.appendFileSync(orderFile, `${separator}${name}${newline}`, 'utf8');
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

	const ordered = new Set(readOrder(dir).filter((name) => files.has(name)));
	const rest = [...files.keys()].filter((name) => !ordered.has(name)).sort();

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
	private detection = 0;

	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChange = this.changed.event;

	constructor(private readonly log: vscode.OutputChannel) {}

	root(): string | undefined {
		return this.current;
	}

	/** Children of the page whose file is `documentPath`. Used by `[[_TOSP_]]`. */
	subpages(documentPath: string): SubpageEntry[] {
		if (!this.current || !this.within(documentPath)) {
			return [];
		}
		const dir = documentPath.replace(/\.md$/i, '');
		const pageDir = path.dirname(documentPath);

		return listPages(dir).map((page) => ({
			title: page.title,
			// Relative to the parent page, so the link works in the preview.
			href: pathToHref(`./${path.relative(pageDir, page.file).split(path.sep).join('/')}`)
		}));
	}

	/**
	 * Resolves a wiki link target to a file on disk.
	 *
	 * Azure DevOps omits the `.md` extension and writes root-absolute links
	 * relative to the *wiki* root, so both have to be tried. The target arrives
	 * still percent-encoded because `%2D` is part of the file name -- but an
	 * author may equally have written the decoded form, so both spellings are
	 * candidates.
	 */
	resolveLink(documentPath: string, target: string): string | undefined {
		if (target === '' || !this.current || !this.within(documentPath)) {
			return undefined;
		}

		const absolute = target.startsWith('/');
		const base = absolute ? this.current : path.dirname(documentPath);
		if (!base) {
			// A root-absolute link is meaningless without knowing the root, and
			// guessing the workspace folder is what breaks these links today.
			return undefined;
		}

		const spellings = new Set([absolute ? target.slice(1) : target]);
		try {
			spellings.add(decodeURIComponent(absolute ? target.slice(1) : target));
		} catch {
			// Malformed percent-encoding: the raw spelling is still worth trying.
		}

		for (const spelling of spellings) {
			const joined = path.resolve(base, spelling);
			if (!this.within(joined)) {
				// Never let `../../..` walk a link out of the wiki.
				continue;
			}
			for (const candidate of /\.md$/i.test(joined) ? [joined] : [`${joined}.md`, joined]) {
				try {
					if (fs.statSync(candidate).isFile()) {
						return candidate;
					}
				} catch {
					// Does not exist; try the next candidate.
				}
			}
		}

		return undefined;
	}

	/** True when `candidate` sits inside the wiki root, or no root is known. */
	private within(candidate: string): boolean {
		if (!this.current) {
			return true;
		}
		const rel = path.relative(this.current, candidate);
		return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
	}

	async detect(): Promise<void> {
		const detection = ++this.detection;
		const configured = await fromSetting();
		const detected = configured ? undefined : await fromOrderFiles();
		if (detection !== this.detection) {
			return;
		}
		let next = configured ?? detected;

		this.log.appendLine(
			`[detect] setting=${configured ?? '-'} order=${detected ?? '-'} -> ${next ?? 'none'}`
		);

		if (next && !fs.statSync(next, { throwIfNoEntry: false })?.isDirectory()) {
			// A stale setting pointing at a folder that no longer exists would
			// otherwise leave the tree mysteriously empty.
			this.log.appendLine(`[detect] wiki root is not an existing directory: ${next}`);
			void vscode.window.showWarningMessage(`azdown: wiki root is not an existing directory: ${next}`);
			next = undefined;
		}

		if (next === this.current) {
			return;
		}
		this.current = next;
		this.changed.fire();
	}

	dispose(): void {
		this.detection++;
		this.changed.dispose();
	}
}

async function fromSetting(): Promise<string | undefined> {
	const configured = vscode.workspace.getConfiguration('azdown').get<string>('wikiRoot')?.trim();
	if (!configured) {
		return undefined;
	}
	if (path.isAbsolute(configured)) {
		return path.normalize(configured);
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
