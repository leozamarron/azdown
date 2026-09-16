import type MarkdownIt from 'markdown-it';
import katexPlugin from '@vscode/markdown-it-katex';

/**
 * KaTeX maths, as Azure DevOps renders them.
 *
 * Microsoft documents `$...$` for inline expressions and `$$...$$` for blocks,
 * and its own example writes the inline form with spaces inside the delimiters
 * (`$ A + B = C $`).
 *
 * Uses VS Code's own markdown-it-katex, which handles both, and -- more
 * importantly -- declines to treat prices like "$5 and $10" as maths. Getting
 * that wrong turns every price in a wiki into garbled formulae, and the
 * delimiter rules that avoid it are fiddly enough not to reimplement.
 *
 * Rendering happens here, at parse time, rather than in the preview webview:
 * KaTeX runs perfectly well without a DOM, so the extension ships a stylesheet
 * and fonts but no extra script.
 *
 * https://learn.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance
 */
export function mathPlugin(md: MarkdownIt): void {
	md.use(katexPlugin);
}
