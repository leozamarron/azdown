import type MarkdownIt from 'markdown-it';
import type { Token } from './types.js';
import { SlugBuilder } from './slug.js';

export interface HeadingEntry {
	level: number;
	text: string;
	slug: string;
}

/** Per-render state the plugin hangs off markdown-it's `env`. */
export interface AzdownEnv {
	headings?: HeadingEntry[];
	/** Azure DevOps renders only the first [[_TOC_]] / [[_TOSP_]] on a page. */
	tocRendered?: boolean;
	tospRendered?: boolean;
}

export function azdownEnv(env: unknown): AzdownEnv {
	const holder = (env ?? {}) as { azdown?: AzdownEnv };
	holder.azdown ??= {};
	return holder.azdown;
}

/**
 * Flattens an inline token to the plain text a heading anchor is built from.
 *
 * Formatting markup is dropped -- `## Hello **world**` slugs from
 * "Hello world" -- and code spans contribute their literal text.
 */
export function plainText(inline: Token | undefined): string {
	if (!inline?.children) {
		return inline?.content ?? '';
	}
	let out = '';
	for (const child of inline.children) {
		// `emoji` is included to match VS Code's own heading slugifier, which
		// flattens text, emoji and code spans and nothing else.
		if (child.type === 'text' || child.type === 'code_inline' || child.type === 'emoji') {
			out += child.content;
		}
	}
	return out.length > 0 ? out : inline.content;
}

function escapeAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Adds an Azure DevOps-style anchor to every heading.
 *
 * !! Why an element and not the heading's `id` !!
 * VS Code's built-in Markdown preview wraps `renderer.rules.heading_open` and
 * calls `attrSet("id", ...)` unconditionally with its own GitHub-style
 * slugifier. Plugins run *before* that wrapper is installed, so any id we put
 * on the heading token is silently overwritten in the real preview -- which
 * broke every TOC link while unit tests against bare markdown-it stayed green.
 *
 * Emitting our own `<a id="...">` as the heading's first child survives it:
 * VS Code rewrites the heading's own id attribute and never touches children,
 * so its anchor (scroll sync) and ours (Azure DevOps fidelity) coexist.
 */
export function anchorsPlugin(md: MarkdownIt): void {
	md.core.ruler.push('azdown_heading_anchors', (state) => {
		const slugs = new SlugBuilder();
		const headings: HeadingEntry[] = [];
		const tokens = state.tokens;

		for (let i = 0; i < tokens.length; i++) {
			const open = tokens[i];
			if (open.type !== 'heading_open') {
				continue;
			}

			const inline = tokens[i + 1];
			const text = plainText(inline);
			const slug = slugs.next(text);
			const level = Number(open.tag.slice(1));

			headings.push({ level, text, slug });

			if (!inline?.children) {
				continue;
			}

			// Prepend the anchor as an inline HTML child. Tokens we build are
			// rendered verbatim regardless of md.options.html, which only governs
			// *parsing* of author-supplied HTML -- and the slug is our own output,
			// escaped for attribute context here.
			const anchor = new (inline.constructor as new (
				type: string,
				tag: string,
				nesting: number
			) => Token)('html_inline', '', 0);
			anchor.content = `<a class="azdown-anchor" id="${escapeAttr(slug)}"></a>`;
			inline.children.unshift(anchor);
		}

		azdownEnv(state.env).headings = headings;
	});
}
