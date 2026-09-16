/**
 * The context an Azure DevOps wiki has but a lone Markdown file does not.
 *
 * The plugin stays framework-agnostic: it declares what it needs and the host
 * (the VS Code extension, a CLI, whatever) supplies it. Everything is a method
 * rather than a snapshot because the host's idea of the wiki root can change
 * at runtime -- `extendMarkdownIt` is called once per engine, not per render.
 */
export interface WikiProvider {
	/** Absolute path of the wiki root, or undefined while unknown. */
	root(): string | undefined;

	/**
	 * Immediate child pages of the page at `documentPath`, in wiki order.
	 * Used by `[[_TOSP_]]`.
	 */
	subpages(documentPath: string): SubpageEntry[];

	/**
	 * Resolves a wiki link target to an absolute file path on disk, or
	 * `undefined` when nothing matches.
	 *
	 * `target` is the href as the author wrote it, minus any `#fragment`, and
	 * still percent-encoded: `%2D` is part of the file name, not an escape to
	 * undo. Azure DevOps omits the `.md` extension and writes root-absolute
	 * paths relative to the wiki root, so both have to be tried.
	 *
	 * Optional: a host with no filesystem (a browser bundle) simply leaves
	 * links untouched.
	 */
	resolveLink?(documentPath: string, target: string): string | undefined;
}

export interface SubpageEntry {
	/** Display title, already un-escaped (`%2D` -> `-`, dashes -> spaces). */
	title: string;
	/** Href to use in the rendered list. */
	href: string;
}

/**
 * Azure DevOps stores page attachments in a `.attachments` folder at the wiki
 * root, and links them with a root-absolute path: `/.attachments/img.png`.
 *
 * A Markdown preview has no notion of "wiki root", so it resolves that leading
 * slash against the workspace folder and the image 404s whenever the wiki is
 * not itself the workspace root.
 */
export const ATTACHMENTS_PREFIX = '/.attachments/';

/** Turns an Azure DevOps page file name into its display title. */
export function pageTitle(fileName: string): string {
	const base = fileName.replace(/\.md$/i, '');
	return (
		base
			// %2D is a literal dash in the page name, so it must survive the
			// dash-to-space step below. Azure DevOps escapes it precisely because
			// "A-B" and "A%2DB" are different pages.
			.split('%2D')
			.map((part) => part.replace(/-/g, ' '))
			.join('-')
	);
}
