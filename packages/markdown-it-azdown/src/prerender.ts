import type MarkdownIt from 'markdown-it';
import type { Token } from './types.js';

/**
 * Runs a pass over the token stream at *render* time, with the render env.
 *
 * !! Why this exists !!
 * VS Code's Markdown preview tokenizes and renders with two different envs.
 * Tokenizing gets `{ currentDocument: undefined, ... }` -- explicitly
 * undefined -- and only the render call is handed the real document:
 *
 *   o = this.#o(document, ...)                      // tokenize, no document
 *   a = { currentDocument: document.uri, ... }      // built afterwards
 *   i.renderer.render(o, options, a)                // render, has document
 *
 * So a `core` rule, which runs during tokenization, can never learn which file
 * it is rendering. Anything that rewrites paths relative to the current
 * document has to happen here instead.
 *
 * It still has to run before the per-token rules: VS Code wraps
 * `renderer.rules.image` and `renderer.rules.link_open` to resolve URLs into
 * webview URIs, and those wrappers run outside ours. Hooking `renderer.render`
 * puts this pass ahead of all of them.
 */
export type RenderPass = (tokens: Token[], env: unknown) => void;

export function onBeforeRender(md: MarkdownIt, pass: RenderPass): void {
	const renderer = md.renderer;
	const original = renderer.render.bind(renderer);

	renderer.render = (tokens, options, env): string => {
		pass(tokens as Token[], env);
		return original(tokens, options, env);
	};
}

/** Visits every token, including those nested inside inline tokens. */
export function walkTokens(tokens: Token[], visit: (token: Token) => void): void {
	for (const token of tokens) {
		if (token.children?.length) {
			walkTokens(token.children, visit);
		}
		visit(token);
	}
}

/**
 * Remembers a token attribute's original value the first time it is seen.
 *
 * Token streams are cached and re-rendered, and both we and VS Code rewrite
 * these attributes in place. Without an untouched copy to work from, the
 * second render would resolve an already-resolved path.
 *
 * Stored as a property on the token rather than an attribute, so it never
 * reaches the HTML.
 */
export function originalAttr(token: Token, name: string): string | undefined {
	const store = token as Token & { azdownOriginal?: Record<string, string | undefined> };
	store.azdownOriginal ??= {};

	if (!(name in store.azdownOriginal)) {
		store.azdownOriginal[name] = token.attrGet(name) ?? undefined;
	}
	return store.azdownOriginal[name];
}

/**
 * Drops an attribute. markdown-it's Token has no attrDelete.
 *
 * Needed because VS Code skips resolving an image whose `data-src` is already
 * set: leaving a stale one behind means our freshly rewritten `src` is never
 * turned into a webview URI, and the image silently fails to load.
 */
export function attrDelete(token: Token, name: string): void {
	if (!token.attrs) {
		return;
	}
	token.attrs = token.attrs.filter(([key]) => key !== name);
}
