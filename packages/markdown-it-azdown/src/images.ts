import type MarkdownIt from 'markdown-it';
import { onBeforeRender, walkTokens, originalAttr, attrDelete } from './prerender.js';
import { ATTACHMENTS_PREFIX, type WikiProvider } from './wiki.js';
import { documentPath, dirname, relativePath } from './paths.js';

/**
 * Rewrites Azure DevOps attachment links so the preview can find them.
 *
 * Azure DevOps links attachments root-absolutely (`/.attachments/img.png`),
 * where the root is the *wiki*. A Markdown preview resolves that leading slash
 * against the workspace folder instead, so the image 404s unless the wiki
 * happens to be the workspace root -- which is the bug users actually hit.
 *
 * !! Why this runs from onBeforeRender and not a core rule !!
 * A core rule runs during tokenization, and VS Code tokenizes with an env
 * whose `currentDocument` is explicitly undefined -- so a core rule cannot
 * know which file it is rendering, and this rewrite silently did nothing in
 * the real preview while passing every test. See prerender.ts.
 */
export function imagesPlugin(md: MarkdownIt, wiki: WikiProvider): void {
	onBeforeRender(md, (tokens, env) => {
		const root = wiki.root();
		const docPath = documentPath(env);

		walkTokens(tokens, (token) => {
			if (token.type !== 'image') {
				return;
			}
			const original = originalAttr(token, 'src');
			if (!original?.startsWith(ATTACHMENTS_PREFIX)) {
				return;
			}
			if (!root || !docPath) {
				// No wiki context: leave the author's path exactly as written.
				return;
			}

			const absolute = `${root.replace(/\/+$/, '')}${original}`;
			token.attrSet('src', relativePath(dirname(docPath), absolute));
			// Force VS Code to resolve the new value; it skips any image that
			// already carries a data-src from a previous render.
			attrDelete(token, 'data-src');
		});
	});
}
