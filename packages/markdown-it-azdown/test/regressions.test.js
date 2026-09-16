const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown, SlugBuilder } = require('../dist/index.js');

test('cached tokens and reused env render both navigation macros on every pass', () => {
	const wiki = { root: () => '/wiki', subpages: () => [{ title: 'Child', href: './Child.md' }] };
	const md = new MarkdownIt().use(azdown, { wiki });
	const tokens = md.parse('[[_TOC_]]\n\n[[_TOSP_]]\n\n# Hello\n', {});
	const env = { currentDocument: { fsPath: '/wiki/Page.md' } };
	const first = md.renderer.render(tokens, md.options, env);
	assert.match(first, /Child/);
	assert.match(first, /href="#hello"/);
	assert.equal(md.renderer.render(tokens, md.options, env), first);
	const next = md.parse('[[_TOC_]]\n\n# Goodbye\n', {});
	const html = md.renderer.render(next, md.options, env);
	assert.match(html, /href="#goodbye"/);
	assert.doesNotMatch(html, /hello/);
});

test('emoji headings produce identical TOC targets with separate parse/render envs', () => {
	const md = new MarkdownIt().use(azdown);
	const tokens = md.parse('[[_TOC_]]\n\n# Hello :smile:\n# \\:smile:\n', {});
	const html = md.renderer.render(tokens, md.options, {});
	const links = [...html.matchAll(/href="#([^"]*)"/g)].map(m => decodeURIComponent(m[1]));
	const ids = [...html.matchAll(/azdown-anchor" id="([^"]*)"/g)].map(m => m[1]);
	assert.deepEqual(links, ids);
	assert.match(html, /Hello 😄/);
});

test('suffix-like heading names never collide with generated ids', () => {
	for (const headings of [['A', 'A', 'A-1', 'A'], ['A-1', 'A', 'A', 'A-2']]) {
		const builder = new SlugBuilder();
		const slugs = headings.map(heading => builder.next(heading));
		assert.equal(new Set(slugs).size, headings.length);
	}
});

test('skipped or decreasing heading levels create structurally valid lists', () => {
	const md = new MarkdownIt().use(azdown);
	for (const headings of ['# A\n#### B\n## C', '#### A\n# B\n### C\n## D']) {
		const nav = md.render(`[[_TOC_]]\n\n${headings}`).match(/<nav[\s\S]*?<\/nav>/)[0];
		const stack = [];
		for (const [, close, tag] of nav.matchAll(/<(\/?)(ul|li)>/g)) {
			if (close) assert.equal(stack.pop(), tag);
			else {
				if (tag === 'ul' && stack.length) assert.equal(stack.at(-1), 'li');
				if (tag === 'li') assert.equal(stack.at(-1), 'ul');
				stack.push(tag);
			}
		}
		assert.deepEqual(stack, []);
	}
});

test('a leaf page does not tell users to configure an already configured root', () => {
	const wiki = { root: () => '/wiki', subpages: () => [] };
	const html = new MarkdownIt().use(azdown, { wiki }).render('[[_TOSP_]]', {
		currentDocument: { fsPath: '/wiki/Leaf.md' }
	});
	assert.doesNotMatch(html, /data-azdown-pending/);
});

test('links restore their source when a cached target becomes unresolvable', () => {
	let target = '/wiki/A%2DB #1.md';
	const wiki = { root: () => '/wiki', subpages: () => [], resolveLink: () => target };
	const md = new MarkdownIt().use(azdown, { wiki });
	const tokens = md.parse('[page](/A%2DB)', {});
	const env = { currentDocument: { fsPath: '/wiki/Page.md' } };
	const html = md.renderer.render(tokens, md.options, env);
	const href = html.match(/href="([^"]+)"/)[1];
	assert.equal(decodeURIComponent(href), './A%2DB #1.md');
	target = undefined;
	assert.match(md.renderer.render(tokens, md.options, env), /href="\/A%2DB"/);
});

test('attachment rewriting clears cached VS Code attributes when the root is removed', () => {
	let root = '/wiki';
	const wiki = { root: () => root, subpages: () => [] };
	const md = new MarkdownIt().use(azdown, { wiki });
	const tokens = md.parse('![x](/.attachments/a.png)', {});
	const env = { currentDocument: { fsPath: '/wiki/Page.md' } };
	assert.match(md.renderer.render(tokens, md.options, env), /src="\.\/.attachments\/a.png"/);
	const image = tokens.find(t => t.type === 'inline').children.find(t => t.type === 'image');
	image.attrSet('data-src', './.attachments/a.png');
	root = undefined;
	const html = md.renderer.render(tokens, md.options, env);
	assert.match(html, /src="\/.attachments\/a.png"/);
	assert.doesNotMatch(html, /data-src/);
});

test('an unrelated Markdown document does not inherit wiki attachments', () => {
	const wiki = { root: () => '/wiki', subpages: () => [] };
	const html = new MarkdownIt().use(azdown, { wiki }).render('![x](/.attachments/a.png)', {
		currentDocument: { fsPath: '/wiki-other/Page.md' }
	});
	assert.match(html, /src="\/.attachments\/a.png"/);
});

test('Windows roots and document drive letters can differ in case', () => {
	const wiki = { root: () => 'C:\\Wiki', subpages: () => [] };
	const html = new MarkdownIt().use(azdown, { wiki }).render('![x](/.attachments/a.png)', {
		currentDocument: { fsPath: 'c:\\wiki\\Section\\Page.md' }
	});
	assert.match(html, /src="\.\.\/\.attachments\/a.png"/);
});

test('an unclosed container in a list does not consume the following heading', () => {
	const html = new MarkdownIt().use(azdown).render('- ::: mermaid\n  graph LR\n\n# Outside\n');
	assert.match(html, /<h1>.*Outside<\/h1>/);
	assert.doesNotMatch(html.match(/<div class="mermaid"[^>]*>[\s\S]*?<\/div>/)[0], /Outside/);
});
