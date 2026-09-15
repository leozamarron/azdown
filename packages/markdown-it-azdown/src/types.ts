import type MarkdownIt from 'markdown-it';

/*
 * markdown-it v14 ships its internal types as ESM-only declarations
 * (`.d.mts`), so importing them by deep path from a CommonJS package needs a
 * `resolution-mode` attribute and still drifts from the types reachable
 * through the public entry point.
 *
 * Deriving them from `MarkdownIt` instead keeps a single source of truth: they
 * are by construction the exact types the methods we call expect.
 */

export type RuleBlock = Parameters<MarkdownIt['block']['ruler']['before']>[2];
export type StateBlock = Parameters<RuleBlock>[0];

export type RuleCore = Parameters<MarkdownIt['core']['ruler']['push']>[1];
export type StateCore = Parameters<RuleCore>[0];

export type RenderRule = NonNullable<MarkdownIt['renderer']['rules'][string]>;
export type Token = Parameters<RenderRule>[0][number];
