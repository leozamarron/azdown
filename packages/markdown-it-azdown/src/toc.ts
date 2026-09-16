import type MarkdownIt from 'markdown-it';
import type { StateBlock, Token } from './types.js';
import { azdownEnv, plainText, type HeadingEntry } from './anchors.js';
import type { WikiProvider } from './wiki.js';
import { SlugBuilder } from './slug.js';
import { documentPath } from './paths.js';
import { onBeforeRender } from './prerender.js';

const TOC = '[[_TOC_]]';
const TOSP = '[[_TOSP_]]';

const MIN_LEVEL = 1;
const MAX_LEVEL = 6;

/*
 * Azure DevOps titles these tables, and the titles are documented verbatim:
 * "The TOC title on the page is 'Contents'" and "The title of the table on the
 * page is 'Child Pages'".
 *
 * Rendered as a <p>, not a heading: a heading here would join the document
 * outline and feed itself back into the very table it labels. The element is
 * our choice; the wording is not.
 */
const TOC_TITLE = 'Contents';
const TOSP_TITLE = 'Child Pages';

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
 * Recover the anchor pass's headings from cached tokens. VS Code supplies a
 * different env at render time, so the parse env is not a reliable source.
 */
function scanHeadings(tokens: Token[]): HeadingEntry[] {
	const slugs = new SlugBuilder();
	const out: HeadingEntry[] = [];
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type !== 'heading_open') {
			continue;
		}
		const text = plainText(tokens[i + 1]);
		const fallback = { level: Number(tokens[i].tag.slice(1)), text, slug: slugs.next(text) };
		out.push(tokens[i].meta?.azdownHeading ?? fallback);
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

	const title = `<p class="azdown-toc-title">${TOC_TITLE}</p>\n`;

	// Nest beneath the nearest preceding shallower heading. Skipped levels
	// must not introduce <ul> directly inside <ul> or unmatched </li> tags.
	interface Node { entry: HeadingEntry; children: Node[] }
	const roots: Node[] = [];
	const stack: Node[] = [];
	for (const entry of entries) {
		while (stack.length && stack[stack.length - 1].entry.level >= entry.level) {
			stack.pop();
		}
		const node: Node = { entry, children: [] };
		(stack.length ? stack[stack.length - 1].children : roots).push(node);
		stack.push(node);
	}
	const list = (nodes: Node[]): string => '<ul>\n' + nodes.map(({ entry, children }) =>
		`<li><a href="#${encodeURIComponent(entry.slug)}">${escapeHtml(entry.text)}</a>\n` +
		(children.length ? list(children) : '') + '</li>\n'
	).join('') + '</ul>\n';
	return `<nav class="azdown-toc">\n${title}${list(roots)}</nav>\n`;
}

function renderSubpages(env: unknown, wiki: WikiProvider | undefined): string {
	const path = documentPath(env);
	const entries = wiki && path ? wiki.subpages(path) : [];

	if (entries.length === 0) {
		// Only missing context needs a setup hint; a leaf page is already valid.
		return wiki?.root() && path
			? '<nav class="azdown-tosp"></nav>\n'
			: '<nav class="azdown-tosp" data-azdown-pending="subpages"></nav>\n';
	}

	let out = `<nav class="azdown-tosp">\n<p class="azdown-tosp-title">${TOSP_TITLE}</p>\n<ul>\n`;
	for (const entry of entries) {
		out += `<li><a href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a></li>\n`;
	}
	out += '</ul>\n</nav>\n';
	return out;
}

export function tocPlugin(md: MarkdownIt, wiki?: WikiProvider): void {
	// Each render is independent, even when the host reuses tokens or env.
	onBeforeRender(md, (tokens, env) => {
		const state = azdownEnv(env);
		state.tocRendered = false;
		state.tospRendered = false;
		state.headings = scanHeadings(tokens);
	});
	md.block.ruler.before(
		'paragraph',
		'azdown_macro',
		macroRule as unknown as Parameters<MarkdownIt['block']['ruler']['before']>[2],
		{ alt: ['paragraph', 'reference', 'blockquote', 'list'] }
	);

	/*
	 * Only the first instance of each macro renders; later ones are dropped.
	 * Documented for both tags: "The publishing system renders the TOC for the
	 * first instance ... It ignores other instances of the tag on the same
	 * page." Rendering runs in document order, so the first token reached is
	 * the first in the page.
	 */
	md.renderer.rules.azdown_toc = (tokens, _idx, _options, env): string => {
		const state = azdownEnv(env);
		if (state.tocRendered) {
			return '';
		}
		state.tocRendered = true;
		return renderEntries(state.headings ?? scanHeadings(tokens as Token[]));
	};

	md.renderer.rules.azdown_tosp = (_tokens, _idx, _options, env): string => {
		const state = azdownEnv(env);
		if (state.tospRendered) {
			return '';
		}
		state.tospRendered = true;
		return renderSubpages(env, wiki);
	};
}
