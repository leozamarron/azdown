import type MarkdownIt from 'markdown-it';
import { containersPlugin } from './containers.js';
import { tocPlugin } from './toc.js';
import { anchorsPlugin } from './anchors.js';
import { imagesPlugin } from './images.js';
import { linksPlugin } from './links.js';
import { emojiPluginAzdown } from './emoji.js';
import type { WikiProvider } from './wiki.js';

export { slugify, SlugBuilder } from './slug.js';
export { containersPlugin } from './containers.js';
export { tocPlugin } from './toc.js';
export { anchorsPlugin } from './anchors.js';
export { imagesPlugin } from './images.js';
export { linksPlugin } from './links.js';
export { emojiPluginAzdown } from './emoji.js';
export { relativePath, dirname, documentPath } from './paths.js';
export { pageTitle, pageFileName, ATTACHMENTS_PREFIX } from './wiki.js';
export type { WikiProvider, SubpageEntry } from './wiki.js';

/**
 * Options for the azdown plugin.
 *
 * Every flag defaults to `true`: the point of the plugin is full Azure DevOps
 * Wiki fidelity, and callers opt *out* of pieces they do not want.
 */
export interface AzdownOptions {
	/** `::: mermaid` / `::: video` / `::: math` three-colon containers. */
	containers?: boolean;
	/** `[[_TOC_]]` and `[[_TOSP_]]` macros. */
	toc?: boolean;
	/** Heading anchors using Azure DevOps's slug algorithm. */
	headingAnchors?: boolean;
	/** KaTeX, inline and block. */
	math?: boolean;
	/** `:shortcode:` emoji. */
	emoji?: boolean;
	/** Relative wiki links, including Azure DevOps's `%2D` escaping. */
	wikiLinks?: boolean;
	/** `#123` work item and `!456` pull request refs, rendered as chips. */
	refs?: boolean;

	/**
	 * Supplies the wiki context a lone Markdown file cannot carry: the wiki
	 * root and the page tree.
	 *
	 * Without it `[[_TOSP_]]` stays an empty placeholder and `/.attachments/`
	 * images are left alone, because guessing either would be worse than doing
	 * nothing.
	 */
	wiki?: WikiProvider;
}

const defaults: Required<Omit<AzdownOptions, 'wiki'>> = {
	containers: true,
	toc: true,
	headingAnchors: true,
	math: true,
	emoji: true,
	wikiLinks: true,
	refs: true
};

/**
 * Applies Azure DevOps Wiki Markdown behaviour to a markdown-it instance.
 *
 * Framework-agnostic on purpose: this package knows nothing about VS Code, so
 * a CLI or a browser extension can reuse it unchanged.
 */
export function azdown(md: MarkdownIt, options: AzdownOptions = {}): void {
	const opts = { ...defaults, ...options };

	if (opts.containers) {
		containersPlugin(md);
	}

	// The TOC links to heading ids, so it needs the anchor pass regardless of
	// whether anchors were requested on their own.
	if (opts.headingAnchors || opts.toc) {
		anchorsPlugin(md);
	}

	if (opts.toc) {
		tocPlugin(md, options.wiki);
	}

	if (options.wiki) {
		imagesPlugin(md, options.wiki);
		if (opts.wikiLinks) {
			linksPlugin(md, options.wiki);
		}
	}

	// TODO(katex): inline `$...$` and block `$$...$$`, plus the `::: math`
	// container body, which containers.ts currently emits verbatim.
	void opts.math;

	if (opts.emoji) {
		emojiPluginAzdown(md);
	}

	// TODO(wiki-links): completions for page names and diagnostics for broken
	// links are still missing. Those are editor language features rather than
	// rendering, so they belong in the extension, not here.

	// TODO(refs): `#123` work items and `!456` pull requests as styled chips.
	// Render-only by design: no PAT, no org connection, so a chip shows the ref
	// itself and never resolves a title.
	void opts.refs;
}

export default azdown;
