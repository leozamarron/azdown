/**
 * Azure DevOps Wiki heading-slug algorithm.
 *
 * !! FIDELITY WARNING !!
 * Azure DevOps does not document how it derives heading anchors, and this
 * implementation was NOT validated against a live wiki. The cases covered by
 * passing tests in test/slug.test.js are the ones we are confident about
 * (case folding, spaces, de-duplication); everything else -- punctuation,
 * non-Latin scripts, leading digits, emoji in headings -- is marked as a
 * `todo` test rather than asserted, so nobody mistakes a guess for a verified
 * behaviour. Resolve those against a real Azure DevOps page before release.
 */

/**
 * Converts a single heading's plain text into its anchor slug.
 *
 * Deliberately does no de-duplication: repeated headings are the caller's
 * problem, because uniqueness is per-document. Use {@link SlugBuilder}.
 */
export function slugify(text: string): string {
	return text
		.trim()
		.toLowerCase()
		// Whitespace runs collapse to a single dash.
		.replace(/\s+/g, '-')
		// Keep Unicode letters/numbers, dashes and underscores; drop the rest.
		.replace(/[^\p{L}\p{N}\-_]/gu, '')
		// Stripping punctuation can leave dash runs and dangling edges behind:
		// "C# Guide !" would otherwise slug to "c-guide-". No slug scheme emits
		// those, so collapsing them is a safe normalisation rather than a guess
		// about Azure DevOps -- what Azure DevOps does with the *punctuation*
		// itself is the open question, and stays a todo test.
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Generates slugs for one document, appending `-1`, `-2`, ... to repeats.
 *
 * Azure DevOps does de-duplicate repeated headings; the exact suffix format is
 * assumed, not verified.
 */
export class SlugBuilder {
	private readonly seen = new Map<string, number>();

	next(text: string): string {
		const base = slugify(text);
		const count = this.seen.get(base) ?? 0;
		this.seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count}`;
	}
}
