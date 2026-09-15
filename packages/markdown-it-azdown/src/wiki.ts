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
