import type MarkdownIt from 'markdown-it';
import type { Token } from './types.js';
import { relativePath, documentPath, dirname } from './paths.js';
import { slugify } from './slug.js';
import type { WikiProvider } from './wiki.js';

/** Anything with a scheme (http:, mailto:, vscode:) is not a wiki page. */
const HAS_SCHEME = /^[a-z][a-z0-9+.\-]*:/i;

interface SplitTarget {
	path: string;
	fragment: string;
}

/**
 * Splits `Page#heading` into its parts, leaving the path percent-encoded.
 *
 * `%2D` must survive: Azure DevOps uses it for a literal dash in a page name,
 * and the file on disk is named with the escape intact, so decoding here would
 * make "Azure%2DDevOps-Notas" stop matching its own file.
 */
export function splitTarget(href: string): SplitTarget {
	const hash = href.indexOf('#');
	return hash === -1
		? { path: href, fragment: '' }
		: { path: href.slice(0, hash), fragment: href.slice(hash + 1) };
}

/**
 * Normalises a heading fragment to the anchor form we emit.
 *
 * Azure DevOps links to headings by their slug, but authors write the fragment
 * with the original casing often enough (`#Primer-Paso`) that matching it
 * literally would break links that work in the real wiki. Slugifying is
 * idempotent for fragments that are already slugs.
 *
 * TODO(azdown): this loses the ability to target a hand-written `id` that is
 * not a slug. No Azure DevOps syntax produces one, but an author writing raw
 * HTML could.
 */
function normaliseFragment(fragment: string): string {
	if (fragment === '') {
		return '';
	}
	try {
		return slugify(decodeURIComponent(fragment));
	} catch {
		// Malformed percent-encoding: better to pass it through untouched than
		// to throw in the middle of rendering a document.
		return slugify(fragment);
	}
}

function isExternal(path: string): boolean {
	return HAS_SCHEME.test(path) || path.startsWith('//');
}

/**
 * Rewrites links between wiki pages so they resolve on disk.
 *
 * Azure DevOps writes page links without a `.md` extension, and writes
 * root-absolute ones (`/Team/Onboarding`) relative to the *wiki* root. Neither
 * survives being opened locally: the preview resolves the leading slash
 * against the workspace folder, and a path with no extension matches no file.
 *
 * !! Why this is a core rule and not a renderer rule !!
 * VS Code wraps `renderer.rules.link_open` and resolves the href itself before
 * delegating, exactly as it does for images. A renderer rule of ours would
 * only ever see an already-resolved path.
 */
export function linksPlugin(md: MarkdownIt, wiki: WikiProvider): void {
	md.core.ruler.push('azdown_wiki_links', (state) => {
		const docPath = documentPath(state.env);
		if (!docPath) {
			return;
		}

		const walk = (tokens: Token[]): void => {
			for (const token of tokens) {
				if (token.children?.length) {
					walk(token.children);
				}
				if (token.type !== 'link_open') {
					continue;
				}

				const href = token.attrGet('href');
				if (!href || isExternal(href)) {
					continue;
				}

				const { path, fragment } = splitTarget(href);
				const anchor = normaliseFragment(fragment);

				// A bare `#heading` stays on this page; only the anchor needs
				// normalising so it matches what the anchor pass emitted.
				if (path === '') {
					if (anchor !== '') {
						token.attrSet('href', `#${anchor}`);
					}
					continue;
				}

				const target = wiki.resolveLink?.(docPath, path);
				if (!target) {
					// Unresolvable: leave it exactly as the author wrote it. A
					// rewritten-but-wrong link is harder to debug than an
					// untouched one, and diagnostics are a separate feature.
					continue;
				}

				const rel = relativePath(dirname(docPath), target);
				token.attrSet('href', anchor === '' ? rel : `${rel}#${anchor}`);
			}
		};

		walk(state.tokens);
	});
}
