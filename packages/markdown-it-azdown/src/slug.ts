/**
 * Azure DevOps Wiki heading-slug algorithm.
 *
 * Microsoft documents the rules, and -- more usefully -- gives one worked
 * example, which is the only hard evidence available:
 *
 *   #### Team #1 : Release Wiki!   ->   #team-1--release-wiki
 *
 * That example settles a question the prose gets wrong. The docs say special
 * characters are "converted to hyphens", but converting them would give
 * `team--1---release-wiki-`; the published anchor only makes sense if
 * punctuation is *removed* and every space becomes a hyphen. Note the double
 * hyphen: it is what is left where `:` stood between two spaces, and it
 * survives into the anchor. Nothing collapses it.
 *
 * Anything the example does not exercise stays a `todo` test in
 * test/slug.test.js rather than an assertion, so a guess never gets recorded
 * as a guarantee.
 *
 * Source: https://learn.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance
 */

/**
 * Converts a single heading's plain text into its anchor slug.
 *
 * Deliberately does no de-duplication: repeated headings are the caller's
 * problem, because uniqueness is per-document. Use {@link SlugBuilder}.
 */
export function slugify(text: string): string {
	return (
		text
			.trim()
			.toLowerCase()
			// Every space becomes its own hyphen. Collapsing runs here would
			// erase the double hyphen the documented example depends on.
			.replace(/\s/g, '-')
			// Punctuation is dropped, not converted. Unicode letters and numbers
			// survive, as do hyphens and underscores.
			.replace(/[^\p{L}\p{N}\-_]/gu, '')
	);
}

/**
 * Generates slugs for one document, appending `-1`, `-2`, ... to repeats.
 *
 * Azure DevOps does de-duplicate repeated headings; the exact suffix format is
 * assumed, not verified -- the documentation does not cover it.
 */
export class SlugBuilder {
	private readonly seen = new Map<string, number>();
	private readonly used = new Set<string>();

	next(text: string): string {
		const base = slugify(text);
		let count = this.seen.get(base) ?? 0;
		let slug = count === 0 ? base : `${base}-${count}`;
		while (this.used.has(slug)) {
			slug = `${base}-${++count}`;
		}
		this.seen.set(base, count + 1);
		this.used.add(slug);
		return slug;
	}
}
