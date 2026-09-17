import type MarkdownIt from 'markdown-it';
import katex from 'katex';
import type { StateBlock, RuleBlock, RenderRule } from './types.js';

/*
 * Container kinds. Anything else is left as prose.
 *
 * `mermaid` and `video` are documented Azure DevOps syntax. `math` is NOT:
 * Microsoft documents mathematical notation as `$...$` inline and `$$...$$`
 * block, and its own FAQ mentions a ```math fenced block -- the two disagree
 * with each other, and neither is a three-colon container. `::: math` is kept
 * because it was asked for and may exist undocumented, but treat it as
 * speculative until someone confirms it on a real wiki.
 *
 * https://learn.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance
 */
const KINDS = ['mermaid', 'video', 'math'] as const;
type Kind = (typeof KINDS)[number];

const COLON = 0x3a;
const MIN_MARKERS = 3;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * The markup a Mermaid diagram gets, whichever syntax produced it.
 *
 * The source is kept in a data attribute because rendering replaces the
 * element's contents, and the preview script needs the original to re-draw
 * when the theme changes. The class is ours, not `mermaid`: VS Code's own
 * Mermaid support owns that one and would fight us for the same elements.
 *
 * A `<pre>` rather than a `<div>`, for both syntaxes, because markdown-it only
 * uses a `highlight` return verbatim when it starts with `<pre` -- anything
 * else gets wrapped in `<pre><code>`. VS Code's implementation returns a
 * `<pre>` for the same reason. Keeping the container on the same element means
 * both syntaxes produce identical markup and share one stylesheet rule.
 */
function renderMermaid(source: string): string {
	// A fence hands over a trailing newline and a container does not. Trimming
	// makes the two syntaxes produce byte-identical markup, which is what the
	// preview script and the stylesheet both assume.
	const escaped = escapeHtml(source.replace(/\s+$/, ''));
	return `<pre class="azdown-mermaid" data-azdown-src="${escaped}">${escaped}</pre>\n`;
}

function isKind(value: string): value is Kind {
	return (KINDS as readonly string[]).includes(value);
}

/**
 * Azure DevOps three-colon containers:
 *
 * ```
 * ::: mermaid
 * graph LR
 * :::
 * ```
 *
 * Note these are colons, not backticks: a ```` ```mermaid ```` fence is an
 * ordinary code block in Azure DevOps and must keep rendering as one, which is
 * why this rule is registered before `fence` but only claims `:::` lines.
 */
function containerRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
	// An indent of 4+ is a code block, not a container.
	if (state.sCount[startLine] - state.blkIndent >= 4) {
		return false;
	}

	let pos = state.bMarks[startLine] + state.tShift[startLine];
	const max = state.eMarks[startLine];

	if (pos + MIN_MARKERS > max) {
		return false;
	}
	for (let i = 0; i < MIN_MARKERS; i++) {
		if (state.src.charCodeAt(pos + i) !== COLON) {
			return false;
		}
	}
	pos += MIN_MARKERS;
	// Tolerate extra markers, e.g. ':::::' -- markdown-it-container does too.
	while (pos < max && state.src.charCodeAt(pos) === COLON) {
		pos++;
	}

	const kind = state.src.slice(pos, max).trim().toLowerCase();
	if (!isKind(kind)) {
		// Unknown kind: hand the line back so it renders as plain text. Azure
		// DevOps's behaviour for unrecognised containers is not documented, and
		// silently swallowing content would be the worse guess.
		return false;
	}

	if (silent) {
		return true;
	}

	// Scan for the closing fence.
	let nextLine = startLine;
	let closed = false;
	while (nextLine < endLine) {
		nextLine++;
		if (nextLine >= endLine) {
			break;
		}

		let start = state.bMarks[nextLine] + state.tShift[nextLine];
		const lineMax = state.eMarks[nextLine];

		if (start < lineMax && state.sCount[nextLine] < state.blkIndent) {
			// Container was closed by an enclosing block ending.
			break;
		}
		if (state.src.charCodeAt(start) !== COLON) {
			continue;
		}
		if (state.sCount[nextLine] - state.blkIndent >= 4) {
			continue;
		}

		let markers = 0;
		while (start < lineMax && state.src.charCodeAt(start) === COLON) {
			markers++;
			start++;
		}
		if (markers < MIN_MARKERS) {
			continue;
		}
		// Closing fence must hold nothing but colons and trailing whitespace.
		if (state.src.slice(start, lineMax).trim() !== '') {
			continue;
		}

		closed = true;
		break;
	}

	// An unclosed container runs to the end of the block, matching how
	// markdown-it treats an unclosed code fence.
	const contentEnd = nextLine;

	const oldParent = state.parentType;
	const oldLineMax = state.lineMax;
	state.parentType = 'reference';
	state.lineMax = contentEnd;

	const token = state.push('azdown_container', 'div', 0);
	token.info = kind;
	token.markup = ':'.repeat(MIN_MARKERS);
	token.block = true;
	token.map = [startLine, contentEnd];
	token.content = state.getLines(startLine + 1, contentEnd, state.blkIndent, false);

	state.parentType = oldParent;
	state.lineMax = oldLineMax;
	state.line = closed ? contentEnd + 1 : contentEnd;

	return true;
}

function render(tokens: { info: string; content: string }[], idx: number, options: MarkdownIt.Options): string {
	const token = tokens[idx];
	const kind = token.info as Kind;
	const escape = (s: string): string => {
		// markdown-it exposes escapeHtml on its utils; inline it to keep this
		// module free of deep imports.
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	};

	switch (kind) {
		case 'mermaid':
			return renderMermaid(token.content);

		case 'video':
			// Azure DevOps expects a pasted <iframe> embed here, so the content
			// is raw HTML by design. Respect md.options.html rather than forcing
			// passthrough: if the host disabled HTML, honour that.
			return options.html
				? `<div class="azdown-video">\n${token.content}</div>\n`
				: `<div class="azdown-video">\n${escape(token.content)}</div>\n`;

		case 'math':
			try {
				return `<div class="azdown-math">\n${katex.renderToString(token.content.trim(), {
					displayMode: true,
					throwOnError: true
				})}</div>\n`;
			} catch (err) {
				// Show KaTeX's own complaint rather than an empty box, and keep
				// the source so nothing the author wrote is lost.
				return (
					`<div class="azdown-math" data-azdown-error="true">\n` +
					`${escape(err instanceof Error ? err.message : String(err))}\n` +
					`${escape(token.content)}</div>\n`
				);
			}

		default:
			return '';
	}
}

/**
 * Renders a ```mermaid fenced code block as a diagram.
 *
 * Azure DevOps documents BOTH forms -- "the `:::` container syntax with the
 * `mermaid` keyword" and "a standard fenced code block with the `mermaid`
 * language identifier" -- so treating the fence as ordinary code, which this
 * plugin used to do deliberately, was wrong.
 *
 * Wraps `options.highlight`, which is where markdown-it lets a fence decide
 * its own markup, and is also what VS Code's own Mermaid support hooks. When
 * that support is present the host disables this via `mermaidFences: false`,
 * so the two never render the same fence twice.
 */
function mermaidFences(md: MarkdownIt): void {
	const previous = md.options.highlight;

	md.set({
		highlight: (code, lang, attrs) => {
			if (lang.trim().toLowerCase() === 'mermaid') {
				return renderMermaid(code);
			}
			return previous ? previous(code, lang, attrs) : '';
		}
	});
}

export function containersPlugin(md: MarkdownIt, options: { mermaidFences?: boolean } = {}): void {
	if (options.mermaidFences) {
		mermaidFences(md);
	}

	md.block.ruler.before('fence', 'azdown_container', containerRule as RuleBlock, {
		alt: ['paragraph', 'reference', 'blockquote', 'list']
	});
	md.renderer.rules.azdown_container = render as unknown as RenderRule;
}
