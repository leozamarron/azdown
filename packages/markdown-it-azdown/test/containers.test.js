const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

const render = (src, opts = {}) => new MarkdownIt(opts).use(azdown).render(src);

test('::: mermaid emits a .azdown-mermaid for client-side rendering', () => {
	const html = render('::: mermaid\ngraph LR\n  A-->B\n:::\n');
	assert.match(html, /<pre class="azdown-mermaid"[^>]*>/);
	assert.doesNotMatch(html, /class="mermaid"/, 'the native Mermaid renderer must not claim our container');
	assert.match(html, /graph LR/);
});

test('mermaid source is HTML-escaped so Mermaid reads it as text', () => {
	const html = render('::: mermaid\nA-->B\n:::\n');
	assert.match(html, /A--&gt;B/);
	assert.doesNotMatch(html, /A-->B/);
});

test('a ```mermaid code fence also renders as a diagram', () => {
	// Azure DevOps documents both forms: "the ::: container syntax with the
	// mermaid keyword" and "a standard fenced code block with the mermaid
	// language identifier". An earlier version of this file asserted the
	// opposite, citing a document that says this two lines further down.
	const html = render('```mermaid\ngraph LR\n```\n');
	assert.match(html, /class="azdown-mermaid"/);
});

test('fences in other languages are untouched', () => {
	const html = render('```js\nconst x = 1;\n```\n');
	assert.match(html, /<code class="language-js">/);
	assert.doesNotMatch(html, /azdown-mermaid/);
});

test('mermaid fences can be handed to the host instead', () => {
	// VS Code has rendered them itself since 1.121; claiming the fence twice
	// makes both implementations fight over one element.
	const md = new MarkdownIt().use(azdown, { mermaidFences: false });
	const html = md.render('```mermaid\ngraph LR\n```\n');
	assert.doesNotMatch(html, /azdown-mermaid/);
});

test('both syntaxes produce identical markup', () => {
	const fromContainer = render('::: mermaid\ngraph LR\n:::\n');
	const fromFence = render('```mermaid\ngraph LR\n```\n');
	assert.equal(fromFence.trim(), fromContainer.trim());
});

test('::: math renders through KaTeX', () => {
	const html = render('::: math\nx^2\n:::\n');
	assert.match(html, /<div class="azdown-math">/);
	assert.match(html, /class="katex"/);
});

test('::: video passes the embed through when HTML is enabled', () => {
	const html = render('::: video\n<iframe src="https://example.test"></iframe>\n:::\n', { html: true });
	assert.match(html, /<div class="azdown-video">/);
	assert.match(html, /<iframe src="https:\/\/example\.test"><\/iframe>/);
});

test('::: video escapes the embed when HTML is disabled', () => {
	// Honour the host's sanitisation choice instead of forcing passthrough.
	const html = render('::: video\n<iframe src="https://example.test"></iframe>\n:::\n', { html: false });
	assert.match(html, /&lt;iframe/);
	assert.doesNotMatch(html, /<iframe/);
});

test('an unknown container kind stays prose', () => {
	// Azure DevOps does not document unrecognised kinds, so we must not swallow
	// the content.
	const html = render('::: wat\nhello\n:::\n');
	assert.doesNotMatch(html, /azdown-container/);
	assert.match(html, /hello/);
});

test('extra colons are tolerated on the fence', () => {
	const html = render(':::: mermaid\ngraph LR\n::::\n');
	assert.match(html, /<pre class="azdown-mermaid"[^>]*>/);
});

test('an unclosed container runs to the end of the document', () => {
	const html = render('::: mermaid\ngraph LR\n');
	assert.match(html, /<pre class="azdown-mermaid"[^>]*>/);
	assert.match(html, /graph LR/);
});

test('a four-space indented fence is a code block, not a container', () => {
	const html = render('    ::: mermaid\n    graph LR\n    :::\n');
	assert.match(html, /<pre>/);
	assert.doesNotMatch(html, /class="azdown-mermaid"/);
});

test('content after a closed container keeps parsing', () => {
	const html = render('::: mermaid\ngraph LR\n:::\n\n# Despues\n');
	assert.match(html, /<pre class="azdown-mermaid"[^>]*>/);
	assert.match(html, /<h1><a class="azdown-anchor" id="despues"><\/a>Despues<\/h1>/);
});

test('containers can be disabled', () => {
	const html = new MarkdownIt().use(azdown, { containers: false }).render('::: mermaid\ngraph LR\n:::\n');
	assert.doesNotMatch(html, /class="azdown-mermaid"/);
});
