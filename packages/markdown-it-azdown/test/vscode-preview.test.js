const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const { azdown } = require('../dist/index.js');

/*
 * Regression suite for how VS Code's built-in preview actually behaves.
 *
 * VS Code applies `extendMarkdownIt` FIRST and only then wraps
 * `renderer.rules.heading_open`, `image` and `link_open` around whatever the
 * plugins installed. Testing against bare markdown-it therefore misses a whole
 * class of breakage: an earlier version of this plugin put the Azure DevOps
 * slug on the heading's `id`, VS Code overwrote it with its own slugifier, and
 * every TOC link in the real preview pointed at nothing -- while the unit
 * tests stayed green.
 *
 * `applyVsCodeOverrides` reproduces those wrappers faithfully enough to catch
 * that, transcribed from markdown-language-features/dist/extension.js.
 *
 * `previewRender` reproduces something subtler that this file originally got
 * wrong. VS Code tokenizes and renders with two DIFFERENT envs:
 *
 *   o = this.#o(document, ...)                   // tokenize: currentDocument
 *                                                // is explicitly undefined
 *   a = { currentDocument: document.uri, ... }   // built afterwards
 *   i.renderer.render(o, options, a)             // render: has the document
 *
 * Calling md.render(src, env) -- which passes one env to both phases -- hid a
 * bug where attachment and link rewriting, implemented as core rules, never
 * saw the document in the real preview and silently did nothing. Every test
 * here passed while both features were broken for every user.
 */
function applyVsCodeOverrides(md) {
	const prevHeading = md.renderer.rules.heading_open;
	md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
		const plain = (t) =>
			t.children
				? t.children.map(plain).join('')
				: t.type === 'text' || t.type === 'code_inline' || t.type === 'emoji'
					? t.content
					: '';
		const text = plain(tokens[idx + 1]);
		// Unconditional: this is the line that clobbers a plugin-set id.
		tokens[idx].attrSet('id', `vscode-${text.toLowerCase().replace(/\s+/g, '-')}`);
		return prevHeading
			? prevHeading(tokens, idx, options, env, self)
			: self.renderToken(tokens, idx, options);
	};

	const prevImage = md.renderer.rules.image;
	md.renderer.rules.image = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const src = token.attrGet('src');
		if (src && !token.attrGet('data-src')) {
			env.containingImages?.add(src);
			// Stands in for VS Code's webview-URI resolution.
			token.attrSet('src', `https://vscode-resource.test${src.startsWith('/') ? '' : '/'}${src}`);
			token.attrSet('data-src', src);
		}
		return prevImage
			? prevImage(tokens, idx, options, env, self)
			: self.renderToken(tokens, idx, options);
	};

	return md;
}

const previewRender = (src, { wiki, currentDocument } = {}) => {
	const md = applyVsCodeOverrides(new MarkdownIt({ html: true }).use(azdown, { wiki }));

	// Two envs, exactly as VS Code does it. Never collapse these into one
	// md.render() call: that is what made this suite blind.
	const tokens = md.parse(src, { containingImages: new Set(), currentDocument: undefined });
	return md.renderer.render(tokens, md.options, {
		containingImages: new Set(),
		currentDocument
	});
};

test('TOC links survive VS Code overwriting the heading id', () => {
	const html = previewRender('[[_TOC_]]\n\n# Uno\n## Dos\n');

	const hrefs = [...html.matchAll(/<a href="#([^"]+)"/g)].map((m) => m[1]);
	const anchors = [...html.matchAll(/<a class="azdown-anchor" id="([^"]+)"/g)].map((m) => m[1]);

	assert.deepEqual(hrefs, ['uno', 'dos']);
	assert.deepEqual(hrefs, anchors, 'every TOC link must resolve to an anchor we emitted');
});

test("VS Code's own heading ids still get applied, for scroll sync", () => {
	const html = previewRender('# Uno\n');
	// Both must coexist: theirs on the heading, ours as its first child.
	assert.match(html, /<h1 id="vscode-uno">/);
	assert.match(html, /<a class="azdown-anchor" id="uno"><\/a>/);
});

test('the anchor does not leak into the slug VS Code computes', () => {
	// VS Code flattens text/code_inline/emoji children only, so our html_inline
	// anchor must not contribute characters to its slug.
	const html = previewRender('# Uno\n');
	assert.match(html, /id="vscode-uno"/);
});

const wiki = {
	root: () => '/wiki',
	subpages: () => []
};

test('/.attachments/ images resolve against the wiki root, not the workspace', () => {
	const html = previewRender('![x](/.attachments/foto.png)\n', {
		wiki,
		currentDocument: { fsPath: '/wiki/Equipo/Onboarding.md' }
	});
	// Rewritten to a document-relative path before VS Code resolved it.
	assert.match(html, /data-src="\.\.\/\.attachments\/foto\.png"/);
});

test('attachment rewriting reaches images nested in other blocks', () => {
	const html = previewRender('> ![x](/.attachments/foto.png)\n', {
		wiki,
		currentDocument: { fsPath: '/wiki/Equipo/Onboarding.md' }
	});
	assert.match(html, /data-src="\.\.\/\.attachments\/foto\.png"/);
});

test('ordinary image paths are left untouched', () => {
	const html = previewRender('![x](./img/foto.png)\n', {
		wiki,
		currentDocument: { fsPath: '/wiki/Equipo/Onboarding.md' }
	});
	assert.match(html, /data-src="\.\/img\/foto\.png"/);
});

test('without wiki context attachments are left alone rather than guessed at', () => {
	const html = previewRender('![x](/.attachments/foto.png)\n', {
		currentDocument: { fsPath: '/wiki/Equipo/Onboarding.md' }
	});
	assert.match(html, /data-src="\/\.attachments\/foto\.png"/);
});

test('[[_TOSP_]] lists real subpages when the wiki provides them', () => {
	const html = previewRender('[[_TOSP_]]\n', {
		wiki: {
			root: () => '/wiki',
			subpages: () => [
				{ title: 'Build And Release', href: './Onboarding/Build-And-Release' },
				{ title: 'Guia rapida', href: './Onboarding/Guia-rapida' }
			]
		},
		currentDocument: { fsPath: '/wiki/Onboarding.md' }
	});
	assert.match(html, /<nav class="azdown-tosp">/);
	assert.match(html, /Build And Release/);
	assert.doesNotMatch(html, /data-azdown-pending/);
});

test('page links resolve under VS Code\'s two-env render', () => {
	// The same blindness that hid the attachment bug hid this one: links are
	// rewritten from the same document path, which tokenization never sees.
	const html = previewRender('[y](/Build-And-Release)\n', {
		wiki: {
			root: () => '/wiki',
			subpages: () => [],
			resolveLink: (_doc, target) =>
				target === '/Build-And-Release' ? '/wiki/Build-And-Release.md' : undefined
		},
		currentDocument: { fsPath: '/wiki/Onboarding.md' }
	});
	assert.match(html, /href="\.\/Build-And-Release\.md"/);
});

test('rendering the same cached tokens twice is stable', () => {
	// Token streams are cached and re-rendered, and both we and VS Code mutate
	// these attributes in place.
	const md = applyVsCodeOverrides(new MarkdownIt({ html: true }).use(azdown, { wiki }));
	const tokens = md.parse('![x](/.attachments/foto.png)\n', { currentDocument: undefined });
	const env = () => ({ containingImages: new Set(), currentDocument: { fsPath: '/wiki/Equipo/Onboarding.md' } });

	const first = md.renderer.render(tokens, md.options, env());
	const second = md.renderer.render(tokens, md.options, env());
	assert.equal(second, first, 're-rendering cached tokens changed the output');
	assert.match(first, /data-src="\.\.\/\.attachments\/foto\.png"/);
});
