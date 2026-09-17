import type MarkdownIt from 'markdown-it';
import { onBeforeRender, walkTokens, originalAttr, attrDelete } from './prerender.js';
import { ATTACHMENTS_PREFIX, type WikiProvider } from './wiki.js';
import { documentPath, dirname, relativePath, pathToHref, isWithinRoot } from './paths.js';

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
			if (!original || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(original)) {
				return;
			}
			const attachment = original.startsWith(ATTACHMENTS_PREFIX);
			if (original.startsWith('/') && !attachment) {
				return;
			}
			token.attrSet('src', original);
			attrDelete(token, 'data-src');
			if (!root || !docPath || !isWithinRoot(root, docPath)) {
				// No wiki context: leave the author's path exactly as written.
				return;
			}

			let source = original;
			if (attachment) {
				// The root is a filesystem path; the suffix is already a URL.
				const attachments = `${root.replace(/[\\/]+$/, '')}/.attachments`;
				const folder = pathToHref(relativePath(dirname(docPath), attachments));
				source = `${folder}/${original.slice(ATTACHMENTS_PREFIX.length)}`;
			}
			// Include ordinary relative images: they also break when the preview
			// keeps its old <base> after navigating to a page at another depth.
			token.attrSet('src', wiki.imageUri?.(docPath, source) ?? source);
		});
	});
}
