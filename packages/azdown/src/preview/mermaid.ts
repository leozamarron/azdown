import mermaid from 'mermaid';

/*
 * Mermaid rendering for VS Code's built-in Markdown preview.
 *
 * The `::: mermaid` container plugin emits <div class="mermaid">SOURCE</div>;
 * the diagram has to be drawn here, in the webview, because Mermaid needs a
 * DOM. Loaded through the `markdown.previewScripts` contribution point.
 *
 * Mermaid is bundled, not fetched: the preview webview runs under a strict
 * Content Security Policy that blocks external scripts outright.
 */

/** Holds the original diagram source, since rendering replaces the content. */
const SOURCE_ATTR = 'data-azdown-src';
/** The source that produced what is on screen, to avoid pointless re-renders. */
const RENDERED_ATTR = 'data-azdown-rendered';
const ERROR_ATTR = 'data-azdown-error';

/** The subset of Mermaid's theme union that maps onto VS Code's theme kinds. */
type Theme = 'default' | 'dark' | 'neutral';

let counter = 0;
let currentTheme: Theme | '' = '';

/**
 * VS Code stamps the active theme kind on <body>. High contrast is grouped
 * with dark because Mermaid has no high-contrast theme of its own and its
 * light palette is unreadable on a black background.
 */
function themeName(): Theme {
	const list = document.body.classList;
	if (list.contains('vscode-high-contrast-light')) {
		return 'neutral';
	}
	if (list.contains('vscode-dark') || list.contains('vscode-high-contrast')) {
		return 'dark';
	}
	return 'default';
}

function configure(theme: Theme): void {
	currentTheme = theme;
	mermaid.initialize({
		startOnLoad: false,
		theme,
		// Sanitises diagram text. The Markdown being previewed is the user's
		// own, but a wiki page can come from anywhere.
		securityLevel: 'strict'
	});
}

/**
 * Renders one diagram.
 *
 * Deliberately one call per element rather than `mermaid.run` over the whole
 * list: a single malformed diagram would otherwise abort the batch and leave
 * every later diagram on the page unrendered.
 */
async function renderOne(el: HTMLElement, theme: Theme): Promise<void> {
	if (!el.hasAttribute(SOURCE_ATTR)) {
		el.setAttribute(SOURCE_ATTR, el.textContent ?? '');
	}
	const source = el.getAttribute(SOURCE_ATTR) ?? '';
	const stamp = theme + ' ' + source;
	const isCurrent = (): boolean => el.isConnected &&
		el.getAttribute(SOURCE_ATTR) === source && themeName() === theme;

	if (el.getAttribute(RENDERED_ATTR) === stamp) {
		return; // already showing exactly this
	}
	if (source.trim() === '') {
		return;
	}

	try {
		const { svg } = await mermaid.render('azdown-mermaid-' + counter++, source);
		if (!isCurrent()) {
			return;
		}
		el.innerHTML = svg;
		el.removeAttribute(ERROR_ATTR);
	} catch (err) {
		if (!isCurrent()) {
			return;
		}
		// Show the parser's complaint in place. Silently leaving the raw source
		// would look like the extension simply did not run.
		el.textContent = err instanceof Error ? err.message : String(err);
		el.setAttribute(ERROR_ATTR, 'true');
	}
	el.setAttribute(RENDERED_ATTR, stamp);
}

let rendering = false;
let requested = false;

async function renderAll(): Promise<void> {
	requested = true;
	if (rendering) {
		return;
	}
	rendering = true;
	try {
		do {
			requested = false;
			const theme = themeName();
			if (theme !== currentTheme) {
				configure(theme);
			}
			const nodes = document.querySelectorAll<HTMLElement>('div.mermaid');
			for (const node of nodes) {
				await renderOne(node, theme);
			}
		} while (requested);
	} finally {
		rendering = false;
	}
}

let queued: ReturnType<typeof setTimeout> | undefined;

/**
 * VS Code patches the preview DOM on every keystroke, so re-render on a short
 * debounce rather than once per mutation.
 */
function schedule(): void {
	if (queued !== undefined) {
		clearTimeout(queued);
	}
	queued = setTimeout(() => {
		queued = undefined;
		void renderAll();
	}, 60);
}

configure(themeName());
void renderAll();

// Content updates as the user types, and the <body> class changes when the
// theme switches. Both need a re-render, and both land here.
new MutationObserver(schedule).observe(document.body, {
	childList: true,
	subtree: true,
	attributes: true,
	attributeFilter: ['class', SOURCE_ATTR]
});
