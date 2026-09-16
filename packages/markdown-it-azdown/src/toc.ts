import type MarkdownIt from 'markdown-it';
import type { StateBlock, Token } from './types.js';
import { azdownEnv, plainText, type HeadingEntry } from './anchors.js';
import type { WikiProvider } from './wiki.js';
import { SlugBuilder } from './slug.js';
import { documentPath } from './paths.js';

const TOC = '[[_TOC_]]';
const TOSP = '[[_TOSP_]]';

const MIN_LEVEL = 1;
const MAX_LEVEL = 6;

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Matches `[[_TOC_]]` / `[[_TOSP_]]` sitting alone on a line.
 *
 * Azure DevOps requires the macro to be the only thing on its line; a macro
 * embedded in a sentence stays literal text.
 *
 * TODO(azdown): case sensitivity is unverified. Azure DevOps documents the
 * macro in upper case only, so that is all we match -- `[[_toc_]]` is left as
 * prose rather than guessing that it is an alias.
 */
function macroRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
	if (state.sCount[startLine] - state.blkIndent >= 4) {
		return false;
	}

	const start = state.bMarks[startLine] + state.tShift[startLine];
	const max = state.eMarks[startLine];
	const line = state.src.slice(start, max).trim();

	const type = line === TOC ? 'azdown_toc' : line === TOSP ? 'azdown_tosp' : undefined;
	if (!type) {
		return false;
	}
	if (silent) {
		return true;
	}

	const token = state.push(type, 'nav', 0);
	token.markup = line;
	token.block = true;
	token.map = [startLine, startLine + 1];

	state.line = startLine + 1;
	return true;
}

/**
 * Falls back to scanning tokens when the anchor pass did not populate `env`.
 *
 * Only reachable if `headingAnchors` was disabled while the TOC was left on.
 */
function scanHeadings(tokens: Token[]): HeadingEntry[] {
	const slugs = new SlugBuilder();
	const out: HeadingEntry[] = [];
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type !== 'heading_open') {
			continue;
		}
		const text = plainText(tokens[i + 1]);
		out.push({ level: Number(tokens[i].tag.slice(1)), text, slug: slugs.next(text) });
	}
	return out;
}

/**
 * Renders the entries as a nested list.
 *
 * Levels are normalised relative to the shallowest heading present, so a
 * document that starts at `##` does not render inside a pointless extra level.
 *
 * TODO(azdown): the exact markup Azure DevOps emits for its TOC is unverified.
 * The nesting and the links are right; class names and wrapper element are our
 * own, and the CSS pass may need to follow whatever Azure DevOps really uses.
 */
function renderEntries(all: HeadingEntry[]): string {
	const entries = all.filter((e) => e.level >= MIN_LEVEL && e.level <= MAX_LEVEL);
	if (entries.length === 0) {
		return '<nav class="azdown-toc"></nav>\n';
	}

	const base = Math.min(...entries.map((e) => e.level));
	let out = '<nav class="azdown-toc">\n<ul>\n';
	let current = base;

	for (const entry of entries) {
		const level = entry.level;

		if (level > current) {
			for (let l = current; l < level; l++) {
				out += '<ul>\n';
			}
		} else if (level < current) {
			for (let l = level; l < current; l++) {
				out += '</li>\n</ul>\n';
			}
			out += '</li>\n';
		} else if (out.endsWith('</a>\n')) {
			out += '</li>\n';
		}

		out += `<li><a href="#${encodeURIComponent(entry.slug)}">${escapeHtml(entry.text)}</a>\n`;
		current = level;
	}

	for (let l = base; l < current; l++) {
		out += '</li>\n</ul>\n';
	}
	out += '</li>\n</ul>\n</nav>\n';

	return out;
}

function renderSubpages(env: unknown, wiki: WikiProvider | undefined): string {
	const path = documentPath(env);
	const entries = wiki && path ? wiki.subpages(path) : [];

	if (entries.length === 0) {
		// Either no wiki context, or a genuine leaf page. A labelled empty nav
		// beats both silently dropping the macro and inventing a page list.
		return '<nav class="azdown-tosp" data-azdown-pending="subpages"></nav>\n';
	}

	let out = '<nav class="azdown-tosp">\n<ul>\n';
	for (const entry of entries) {
		out += `<li><a href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a></li>\n`;
	}
	out += '</ul>\n</nav>\n';
	return out;
}

export function tocPlugin(md: MarkdownIt, wiki?: WikiProvider): void {
	md.block.ruler.before(
		'paragraph',
		'azdown_macro',
		macroRule as unknown as Parameters<MarkdownIt['block']['ruler']['before']>[2],
		{ alt: ['paragraph', 'reference', 'blockquote', 'list'] }
	);

	md.renderer.rules.azdown_toc = (tokens, _idx, _options, env): string =>
		renderEntries(azdownEnv(env).headings ?? scanHeadings(tokens as Token[]));

	md.renderer.rules.azdown_tosp = (_tokens, _idx, _options, env): string =>
		renderSubpages(env, wiki);
}
