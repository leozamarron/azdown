import type MarkdownIt from 'markdown-it';
import { relativePath, documentPath, dirname, pathToHref } from './paths.js';
import { onBeforeRender, walkTokens, originalAttr } from './prerender.js';
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
 * !! Why this runs from onBeforeRender and not a core rule !!
 * A core rule runs during tokenization, and VS Code tokenizes with an env
 * whose `currentDocument` is explicitly undefined. See prerender.ts.
 */
export function linksPlugin(md: MarkdownIt, wiki: WikiProvider): void {
	onBeforeRender(md, (tokens, env) => {
		const docPath = documentPath(env);
		walkTokens(tokens, (token) => {
			if (token.type !== 'link_open') {
				return;
			}

			const href = originalAttr(token, 'href');
			if (!href || isExternal(href)) {
				return;
			}
			// Cached tokens may still point at the previous wiki or at a page
			// that has since been deleted. Restore before attempting resolution.
			token.attrSet('href', href);
			if (!docPath) {
				return;
			}

			const { path, fragment } = splitTarget(href);
			const anchor = normaliseFragment(fragment);

			// A bare `#heading` stays on this page; only the anchor needs
			// normalising so it matches what the anchor pass emitted.
			if (path === '') {
				if (anchor !== '') {
					token.attrSet('href', `#${anchor}`);
				}
				return;
			}

			const target = wiki.resolveLink?.(docPath, path);
			if (!target) {
				// Unresolvable: leave it exactly as the author wrote it. A
				// rewritten-but-wrong link is harder to debug than an untouched
				// one, and diagnostics are a separate feature.
				return;
			}

			const rel = pathToHref(relativePath(dirname(docPath), target));
			token.attrSet('href', anchor === '' ? rel : `${rel}#${anchor}`);
		});
	});
}
