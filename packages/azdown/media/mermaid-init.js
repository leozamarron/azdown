// @ts-check
'use strict';

/*
 * Client-side Mermaid bootstrap for the built-in Markdown preview.
 *
 * The `::: mermaid` container plugin emits <div class="mermaid">...</div>; the
 * actual diagram has to be rendered here, in the webview, because Mermaid needs
 * a DOM. Loaded via the `markdown.previewScripts` contribution point.
 *
 * TODO(mermaid): bundle Mermaid and render. Open questions to settle first:
 *   - Mermaid must be bundled, not CDN-loaded: the preview webview runs under a
 *     strict CSP that blocks external scripts.
 *   - Re-render on every preview update, not just DOMContentLoaded -- VS Code
 *     patches the DOM in place as you type.
 *   - Theme: pick Mermaid's dark/default theme from the VS Code body class.
 */

(function () {
	// Intentionally inert until the Mermaid pass.
})();
