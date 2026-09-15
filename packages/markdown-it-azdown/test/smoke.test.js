const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

test('plugin loads and leaves plain Markdown structurally untouched', () => {
	// Headings gain an anchor child -- that is the anchor pass, not a change
	// of shape. The heading's own id is deliberately left alone; see anchors.ts.
	const md = new MarkdownIt().use(azdown);
	assert.equal(
		md.render('# hola\n').trim(),
		'<h1><a class="azdown-anchor" id="hola"></a>hola</h1>'
	);
});

test('ordinary paragraphs are untouched', () => {
	const md = new MarkdownIt().use(azdown);
	assert.equal(md.render('hola mundo\n').trim(), '<p>hola mundo</p>');
});

test('GFM-ish basics still render', () => {
	const md = new MarkdownIt().use(azdown);
	const html = md.render('- uno\n- dos\n');
	assert.match(html, /<ul>/);
	assert.match(html, /<li>uno<\/li>/);
});
