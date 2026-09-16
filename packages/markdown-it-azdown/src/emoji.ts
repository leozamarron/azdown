import type MarkdownIt from 'markdown-it';
import { full as emojiPlugin } from 'markdown-it-emoji';

const BACKSLASH = 0x5c;
const COLON = 0x3a;

/**
 * Matches the `:shortcode:` that a backslash would be escaping.
 *
 * Kept deliberately narrow: the backslash is only swallowed when what follows
 * actually looks like emoji syntax, so `\:` anywhere else keeps CommonMark's
 * behaviour of rendering a literal backslash.
 */
const SHORTCODE_AHEAD = /^:[a-z0-9_+-]+:/i;

/**
 * `:shortcode:` emoji, as Azure DevOps renders them.
 *
 * Azure DevOps "supports most GitHub emoji graphics" but explicitly not
 * GitHub's Custom Emoji such as `:bowtie:`. markdown-it-emoji's full dataset
 * already draws that same line -- `:bowtie:` and `:octocat:` are absent from
 * it and therefore stay literal text -- so the documented behaviour falls out
 * without maintaining an exclusion list of our own.
 *
 * https://learn.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance
 */
export function emojiPluginAzdown(md: MarkdownIt): void {
	/*
	 * Azure DevOps lets a backslash escape emoji syntax: `\:smile:` publishes
	 * as the literal text `:smile:`.
	 *
	 * CommonMark does not consider `:` escapable, so without this the backslash
	 * survives into the output *and* the emoji still converts, giving `\😄` --
	 * the worst of both. Registered before `escape` so it sees the backslash
	 * first, and before the emoji rule runs at all.
	 */
	md.inline.ruler.before('escape', 'azdown_emoji_escape', (state, silent) => {
		if (state.src.charCodeAt(state.pos) !== BACKSLASH) {
			return false;
		}
		if (state.src.charCodeAt(state.pos + 1) !== COLON) {
			return false;
		}
		if (!SHORTCODE_AHEAD.test(state.src.slice(state.pos + 1, state.posMax))) {
			return false;
		}

		if (!silent) {
			/*
			 * Push the colon as a token type of our own, not as `text`.
			 *
			 * Two things have to be dodged at once. markdown-it-emoji is a *core*
			 * rule that rewrites finished text tokens, so consuming characters
			 * here cannot out-run it: ":smile:" would still be sitting whole in
			 * one token by the time it ran. And splitting it into two `text`
			 * tokens does not help either, because markdown-it's `text_collapse`
			 * rule merges adjacent text tokens back together first.
			 *
			 * A distinct token type survives both: nothing merges it, and the
			 * emoji rule never matches across a token boundary.
			 */
			const token = state.push('azdown_escaped_colon', '', 0);
			token.content = ':';
		}
		state.pos += 2;
		return true;
	});

	md.renderer.rules.azdown_escaped_colon = (): string => ':';

	md.use(emojiPlugin);
}
