const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

const render = (src) => new MarkdownIt().use(azdown).renderInline(src);

test('shortcodes become emoji', () => {
	assert.equal(render(':smile:'), '😄');
	assert.equal(render(':rocket:'), '🚀');
});

test('shortcodes convert back to back', () => {
	// The documented example: "The code review received :+1::+1:"
	assert.equal(render(':+1::+1:'), '👍👍');
});

test("GitHub's custom emoji stay literal, as Azure DevOps documents", () => {
	// "It doesn't support the Custom Emoji like :bowtie:"
	assert.equal(render(':bowtie:'), ':bowtie:');
	assert.equal(render(':octocat:'), ':octocat:');
});

test('a backslash escapes the shortcode', () => {
	// Documented: "escape emoji syntax by using the backslash \ character".
	assert.equal(render('\\:smile:'), ':smile:');
	assert.equal(render('\\:angry:'), ':angry:');
});

test('escaping survives inside emphasis', () => {
	assert.equal(render('**\\:smile:**'), '<strong>:smile:</strong>');
});

test('a backslash before something that is not a shortcode is untouched', () => {
	// The rule must not change CommonMark behaviour for an ordinary `\:`.
	const base = new MarkdownIt();
	for (const src of ['\\: solo', 'a\\:no_shortcode', 'texto \\: aqui']) {
		assert.equal(render(src), base.renderInline(src), `changed behaviour for ${src}`);
	}
});

test('code spans are left alone', () => {
	assert.equal(render('`:smile:`'), '<code>:smile:</code>');
});

test('emoji can be disabled', () => {
	const md = new MarkdownIt().use(azdown, { emoji: false });
	assert.equal(md.renderInline(':smile:'), ':smile:');
});

test('emoji in a heading reaches the table of contents entry', () => {
	const md = new MarkdownIt().use(azdown);
	const html = md.render('[[_TOC_]]\n\n# Listo :smile:\n');
	const nav = html.match(/<nav class="azdown-toc">[\s\S]*?<\/nav>/)[0];
	assert.match(nav, /Listo 😄/);
});
