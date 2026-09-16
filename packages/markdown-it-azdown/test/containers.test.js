const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

const render = (src, opts = {}) => new MarkdownIt(opts).use(azdown).render(src);

test('::: mermaid emits a div.mermaid for client-side rendering', () => {
	const html = render('::: mermaid\ngraph LR\n  A-->B\n:::\n');
	assert.match(html, /<div class="mermaid">/);
	assert.match(html, /graph LR/);
});

test('mermaid source is HTML-escaped so Mermaid reads it as text', () => {
	const html = render('::: mermaid\nA-->B\n:::\n');
	assert.match(html, /A--&gt;B/);
	assert.doesNotMatch(html, /A-->B/);
});

test('a ```mermaid code fence stays an ordinary code block', () => {
	// Azure DevOps only treats the three-colon form as a diagram; backtick
	// fences must keep rendering as code.
	const html = render('```mermaid\ngraph LR\n```\n');
	assert.match(html, /<pre><code class="language-mermaid">/);
	assert.doesNotMatch(html, /class="mermaid"/);
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
	assert.match(html, /<div class="mermaid">/);
});

test('an unclosed container runs to the end of the document', () => {
	const html = render('::: mermaid\ngraph LR\n');
	assert.match(html, /<div class="mermaid">/);
	assert.match(html, /graph LR/);
});

test('a four-space indented fence is a code block, not a container', () => {
	const html = render('    ::: mermaid\n    graph LR\n    :::\n');
	assert.match(html, /<pre>/);
	assert.doesNotMatch(html, /class="mermaid"/);
});

test('content after a closed container keeps parsing', () => {
	const html = render('::: mermaid\ngraph LR\n:::\n\n# Despues\n');
	assert.match(html, /<div class="mermaid">/);
	assert.match(html, /<h1><a class="azdown-anchor" id="despues"><\/a>Despues<\/h1>/);
});

test('containers can be disabled', () => {
	const html = new MarkdownIt().use(azdown, { containers: false }).render('::: mermaid\ngraph LR\n:::\n');
	assert.doesNotMatch(html, /class="mermaid"/);
});
