const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

const render = (src) => new MarkdownIt().use(azdown).render(src);

test('inline maths render, in the spacing the docs use', () => {
	// The documented example writes the delimiters with inner spaces.
	assert.match(render('$ A + B = C $'), /class="katex"/);
});

test('inline maths render without inner spaces too', () => {
	assert.match(render('$E = mc^2$'), /class="katex"/);
});

test('block maths render as a display block', () => {
	assert.match(render('$$\nE = mc^2\n$$'), /katex-display/);
});

test('prices are not mistaken for maths', () => {
	// The failure this guards against turns every price in a wiki into a
	// garbled formula, and it is the reason for using a tested delimiter
	// implementation rather than a regex.
	const html = render('cuesta $5 y $10 en total');
	assert.doesNotMatch(html, /katex/);
	assert.match(html, /\$5 y \$10/);
});

test('::: math renders through KaTeX', () => {
	assert.match(render('::: math\n\\frac{a}{b}\n:::\n'), /class="katex"/);
});

test('a broken ::: math shows the parser error and keeps the source', () => {
	const html = render('::: math\n\\frac{roto\n:::\n');
	assert.match(html, /data-azdown-error="true"/);
	assert.match(html, /KaTeX parse error/);
	assert.match(html, /frac\{roto/);
});

test('a broken inline expression reports in place', () => {
	assert.match(render('$\\frac{roto$'), /katex-error/);
});

test('maths can be disabled', () => {
	const md = new MarkdownIt().use(azdown, { math: false });
	assert.doesNotMatch(md.render('$E = mc^2$'), /katex/);
});

test('code spans are left alone', () => {
	assert.match(render('`$E = mc^2$`'), /<code>\$E = mc\^2\$<\/code>/);
});
