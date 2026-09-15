import type MarkdownIt from 'markdown-it';
import type { Token } from './types.js';
import { ATTACHMENTS_PREFIX, type WikiProvider } from './wiki.js';

/** Best-effort filesystem path out of whatever the host put in `currentDocument`. */
function documentPath(env: unknown): string | undefined {
	const doc = (env as { currentDocument?: { fsPath?: string; path?: string } } | undefined)
		?.currentDocument;
	return doc?.fsPath ?? doc?.path;
}

function dirname(p: string): string {
	const i = p.replace(/\\/g, '/').lastIndexOf('/');
	return i <= 0 ? '/' : p.slice(0, i);
}

/**
 * Relative path from `fromDir` to `toPath`, in POSIX form.
 *
 * Hand-rolled rather than `node:path` so the package keeps working in a
 * browser bundle, which is the whole point of it being framework-agnostic.
 */
export function relativePath(fromDir: string, toPath: string): string {
	const from = fromDir.replace(/\\/g, '/').replace(/\/+$/, '').split('/');
	const to = toPath.replace(/\\/g, '/').split('/');

	let i = 0;
	while (i < from.length && i < to.length && from[i] === to[i]) {
		i++;
	}

	const up = from.length - i;
	const segments = [...Array<string>(up).fill('..'), ...to.slice(i)];
	const rel = segments.join('/');
	// Only a leading `..` marks the path as already relative. Testing for a
	// leading "." would misread a dot-directory -- and ".attachments" is
	// exactly the directory this function exists to reach.
	return segments[0] === '..' ? rel : `./${rel}`;
}

/**
 * Rewrites Azure DevOps attachment links so the preview can find them.
 *
 * Azure DevOps links attachments root-absolutely (`/.attachments/img.png`),
 * where the root is the *wiki*. A Markdown preview resolves that leading slash
 * against the workspace folder instead, so the image 404s unless the wiki
 * happens to be the workspace root -- which is the bug users actually hit.
 *
 * !! Why this is a core rule and not a renderer rule !!
 * VS Code wraps `renderer.rules.image` and resolves `src` itself *before*
 * delegating to the previous rule, so a renderer rule of ours would only ever
 * see an already-resolved path. Rewriting during parsing puts our path in
 * place early enough for VS Code's own resolution to do the right thing.
 */
export function imagesPlugin(md: MarkdownIt, wiki: WikiProvider): void {
	md.core.ruler.push('azdown_attachments', (state) => {
		const root = wiki.root();
		const docPath = documentPath(state.env);
		if (!root || !docPath) {
			return;
		}

		const walk = (tokens: Token[]): void => {
			for (const token of tokens) {
				if (token.children?.length) {
					walk(token.children);
				}
				if (token.type !== 'image') {
					continue;
				}
				const src = token.attrGet('src');
				if (!src?.startsWith(ATTACHMENTS_PREFIX)) {
					continue;
				}
				const absolute = `${root.replace(/\/+$/, '')}${src}`;
				token.attrSet('src', relativePath(dirname(docPath), absolute));
			}
		};

		walk(state.tokens);
	});
}
