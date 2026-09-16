import type MarkdownIt from 'markdown-it';
import type { Token } from './types.js';
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
