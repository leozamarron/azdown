const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

const render = (src, opts = {}) => new MarkdownIt(opts).use(azdown).render(src);

test('[[_TOC_]] renders a nav with one entry per heading', () => {
	const html = render('[[_TOC_]]\n\n# Uno\n## Uno A\n# Dos\n');
	assert.match(html, /<nav class="azdown-toc">/);
	assert.match(html, /<a href="#uno">Uno<\/a>/);
	assert.match(html, /<a href="#uno-a">Uno A<\/a>/);
	assert.match(html, /<a href="#dos">Dos<\/a>/);
});

test('TOC links resolve to the anchors actually emitted on the headings', () => {
	// The whole point of the anchor pass: links and anchors must never disagree.
	const html = render('[[_TOC_]]\n\n# Uno\n## Uno A\n');
	const hrefs = [...html.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]);
	const anchors = [...html.matchAll(/<a class="azdown-anchor" id="([^"]+)"/g)].map((m) => m[1]);
	assert.deepEqual(hrefs, anchors);
});

test('repeated headings get de-duplicated ids that the TOC still matches', () => {
	const html = render('[[_TOC_]]\n\n# Overview\n# Overview\n');
	const hrefs = [...html.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]);
	const anchors = [...html.matchAll(/<a class="azdown-anchor" id="([^"]+)"/g)].map((m) => m[1]);
	assert.deepEqual(hrefs, ['overview', 'overview-1']);
	assert.deepEqual(hrefs, anchors);
});

test('nesting is balanced', () => {
	const html = render('[[_TOC_]]\n\n# Uno\n## A\n## B\n# Dos\n');
	const opens = (html.match(/<ul>/g) ?? []).length;
	const closes = (html.match(/<\/ul>/g) ?? []).length;
	const li = (html.match(/<li>/g) ?? []).length;
	const liClose = (html.match(/<\/li>/g) ?? []).length;
	assert.equal(opens, closes);
	assert.equal(li, liClose);
});

test('a heading level skip keeps the list balanced', () => {
	const html = render('[[_TOC_]]\n\n# Uno\n#### Hondo\n');
	const opens = (html.match(/<ul>/g) ?? []).length;
	const closes = (html.match(/<\/ul>/g) ?? []).length;
	assert.equal(opens, closes);
});

test('a document starting at h2 does not nest inside an empty level', () => {
	const html = render('[[_TOC_]]\n\n## A\n## B\n');
	assert.equal((html.match(/<ul>/g) ?? []).length, 1);
});

test('heading formatting is stripped from the TOC label', () => {
	const html = render('[[_TOC_]]\n\n# Hola **mundo**\n');
	assert.match(html, />Hola mundo</);
});

test('the macro must own its line', () => {
	// Embedded in a sentence it stays literal text, as in Azure DevOps.
	const html = render('Texto [[_TOC_]] mas texto\n\n# Uno\n');
	assert.doesNotMatch(html, /azdown-toc/);
	// It stays inline text; markdown-it then reads _TOC_ as emphasis, which is
	// exactly what Azure DevOps does with a macro that is not alone on its line.
	assert.match(html, /<p>Texto \[\[<em>TOC<\/em>\]\] mas texto<\/p>/);
});

test('lower-case [[_toc_]] is left as prose', () => {
	// Azure DevOps documents the upper-case form only; we do not invent aliases.
	const html = render('[[_toc_]]\n\n# Uno\n');
	assert.doesNotMatch(html, /azdown-toc/);
});

test('a TOC with no headings renders an empty nav rather than crashing', () => {
	const html = render('[[_TOC_]]\n');
	assert.match(html, /<nav class="azdown-toc"><\/nav>/);
});

test('[[_TOSP_]] renders a labelled placeholder', () => {
	// Subpages need the wiki tree, which a standalone .md does not carry.
	const html = render('[[_TOSP_]]\n');
	assert.match(html, /<nav class="azdown-tosp" data-azdown-pending="subpages"><\/nav>/);
});

test('heading anchors are added even without a TOC', () => {
	const html = render('# Uno\n');
	assert.match(html, /<a class="azdown-anchor" id="uno"><\/a>/);
});

test('the TOC can be disabled', () => {
	const html = new MarkdownIt().use(azdown, { toc: false }).render('[[_TOC_]]\n\n# Uno\n');
	assert.doesNotMatch(html, /azdown-toc/);
});

test('headings inside a TOC label are escaped', () => {
	const html = render('[[_TOC_]]\n\n# A `<b>` B\n');
	assert.match(html, /&lt;b&gt;/);
});
