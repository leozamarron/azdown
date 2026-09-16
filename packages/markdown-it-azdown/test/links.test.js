const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

/**
 * Stands in for the extension's on-disk resolver.
 *
 * Only these pages exist; anything else is unresolvable, which is what the
 * "left alone" cases rely on.
 */
const PAGES = new Set([
	'/wiki/Onboarding.md',
	'/wiki/Onboarding/Guia-rapida.md',
	'/wiki/Onboarding/Permisos.md',
	'/wiki/Build-And-Release.md',
	'/wiki/Azure%2DDevOps-Notas.md',
	'/wiki/diagrama.png'
]);

const wiki = {
	root: () => '/wiki',
	subpages: () => [],
	resolveLink(documentPath, target) {
		const absolute = target.startsWith('/');
		const base = absolute ? '/wiki' : documentPath.slice(0, documentPath.lastIndexOf('/'));
		const rel = absolute ? target.slice(1) : target;

		const spellings = new Set([rel]);
		try {
			spellings.add(decodeURIComponent(rel));
		} catch {
			/* malformed */
		}

		for (const spelling of spellings) {
			// Minimal normalisation: enough for ./ and ../ in these fixtures.
			const parts = `${base}/${spelling}`.split('/');
			const stack = [];
			for (const part of parts) {
				if (part === '.' || part === '') continue;
				if (part === '..') stack.pop();
				else stack.push(part);
			}
			const joined = `/${stack.join('/')}`;
			for (const candidate of [`${joined}.md`, joined]) {
				if (PAGES.has(candidate)) return candidate;
			}
		}
		return undefined;
	}
};

const DOC = '/wiki/Onboarding.md';
const NESTED = '/wiki/Onboarding/Guia-rapida.md';

const hrefOf = (src, currentDocument = { fsPath: DOC }) => {
	const md = new MarkdownIt().use(azdown, { wiki });
	const html = md.render(src, { currentDocument });
	const m = html.match(/<a href="([^"]*)"/);
	return m ? m[1] : undefined;
};

test('root-absolute page links resolve against the wiki root', () => {
	// Azure DevOps writes these relative to the wiki, not the workspace.
	assert.equal(hrefOf('[x](/Build-And-Release)'), './Build-And-Release.md');
});

test('root-absolute links reach nested pages', () => {
	assert.equal(hrefOf('[x](/Onboarding/Permisos)'), './Onboarding/Permisos.md');
});

test('relative links resolve against the current page', () => {
	assert.equal(hrefOf('[x](./Onboarding/Guia-rapida)'), './Onboarding/Guia-rapida.md');
});

test('relative links climb out of a nested page', () => {
	assert.equal(hrefOf('[x](../Build-And-Release)', { fsPath: NESTED }), '../Build-And-Release.md');
});

test('%2D is preserved, because it is part of the file name', () => {
	// "A-B" and "A%2DB" are different pages in Azure DevOps; decoding the
	// escape here would make the link point at a page that does not exist.
	assert.equal(hrefOf('[x](/Azure%2DDevOps-Notas)'), './Azure%252DDevOps-Notas.md');
});

test('a link that already names the .md file still resolves', () => {
	assert.equal(hrefOf('[x](/Build-And-Release.md)'), './Build-And-Release.md');
});

test('non-Markdown targets resolve without gaining an extension', () => {
	assert.equal(hrefOf('[x](/diagrama.png)'), './diagrama.png');
});

test('a heading fragment is carried across to the resolved link', () => {
	assert.equal(hrefOf('[x](/Build-And-Release#primer-paso)'), './Build-And-Release.md#primer-paso');
});

test('a fragment written with the heading casing is slugified', () => {
	// Authors write #Primer-Paso often enough, and it works in the real wiki.
	assert.equal(hrefOf('[x](/Build-And-Release#Primer-Paso)'), './Build-And-Release.md#primer-paso');
});

test('a same-page fragment is normalised without touching the path', () => {
	assert.equal(hrefOf('[x](#Primer-Paso)'), '#primer-paso');
});

test('a same-page fragment that is already a slug is unchanged', () => {
	assert.equal(hrefOf('[x](#primer-paso)'), '#primer-paso');
});

test('same-page fragments match the anchors the plugin emits', () => {
	const md = new MarkdownIt().use(azdown, { wiki });
	const html = md.render('[ir](#Primer-Paso)\n\n# Primer Paso\n', { currentDocument: { fsPath: DOC } });
	const href = html.match(/<a href="#([^"]+)"/)[1];
	const anchor = html.match(/<a class="azdown-anchor" id="([^"]+)"/)[1];
	assert.equal(href, anchor);
});

test('external links are left alone', () => {
	for (const url of ['https://example.test/x', 'http://example.test', 'mailto:a@b.test']) {
		assert.equal(hrefOf(`[x](${url})`), url);
	}
});

test('an unresolvable link is left exactly as written', () => {
	// Rewriting it to something wrong would be harder to debug than leaving it.
	assert.equal(hrefOf('[x](/No-Existe)'), '/No-Existe');
});

test('links are left alone when the document path is unknown', () => {
	// Rendering a string rather than a document: VS Code leaves currentDocument
	// unset, and without it there is nothing to resolve relative to.
	const md = new MarkdownIt().use(azdown, { wiki });
	const html = md.render('[x](/Build-And-Release)', {});
	assert.match(html, /href="\/Build-And-Release"/);
});

test('links inside other blocks are rewritten too', () => {
	const md = new MarkdownIt().use(azdown, { wiki });
	const html = md.render('> [x](/Build-And-Release)\n', { currentDocument: { fsPath: DOC } });
	assert.match(html, /href="\.\/Build-And-Release\.md"/);
});

test('wiki links can be disabled', () => {
	const md = new MarkdownIt().use(azdown, { wiki, wikiLinks: false });
	const html = md.render('[x](/Build-And-Release)', { currentDocument: { fsPath: DOC } });
	assert.match(html, /href="\/Build-And-Release"/);
});
