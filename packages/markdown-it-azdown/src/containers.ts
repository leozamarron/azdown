import type MarkdownIt from 'markdown-it';
import type { StateBlock, RuleBlock, RenderRule } from './types.js';

/** Container kinds Azure DevOps documents. Anything else is left as prose. */
const KINDS = ['mermaid', 'video', 'math'] as const;
type Kind = (typeof KINDS)[number];

const COLON = 0x3a;
const MIN_MARKERS = 3;

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
	const contentEnd = closed ? nextLine : endLine;

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
			// Mermaid reads textContent, so the source must be escaped. The
			// diagram itself is rendered client-side by media/mermaid-init.js.
			return `<div class="mermaid">\n${escape(token.content)}</div>\n`;

		case 'video':
			// Azure DevOps expects a pasted <iframe> embed here, so the content
			// is raw HTML by design. Respect md.options.html rather than forcing
			// passthrough: if the host disabled HTML, honour that.
			return options.html
				? `<div class="azdown-video">\n${token.content}</div>\n`
				: `<div class="azdown-video">\n${escape(token.content)}</div>\n`;

		case 'math':
			// TODO(katex): render with KaTeX. Until then the source is emitted
			// verbatim so nothing is lost, and the CSS pass can style the box.
			return `<div class="azdown-math" data-azdown-pending="katex">\n${escape(token.content)}</div>\n`;

		default:
			return '';
	}
}

export function containersPlugin(md: MarkdownIt): void {
	md.block.ruler.before('fence', 'azdown_container', containerRule as RuleBlock, {
		alt: ['paragraph', 'reference', 'blockquote', 'list']
	});
	md.renderer.rules.azdown_container = render as unknown as RenderRule;
}
