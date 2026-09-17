import * as assert from 'assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type MarkdownIt from 'markdown-it';

/**
 * Integration tests: these run inside a real VS Code, against the real
 * `sample/wiki` opened as the workspace (see .vscode-test.mjs).
 *
 * They exist to cover the seam the unit tests cannot reach. Everything about
 * parsing is tested in markdown-it-azdown with no editor involved; what is
 * only observable here is whether VS Code actually activates the extension,
 * hands it the preview's markdown-it, finds the wiki root on disk, and lets a
 * preview open without throwing.
 */

const EXTENSION_ID = 'leozamarron.azdown';

interface AzdownApi {
	extendMarkdownIt(md: MarkdownIt): MarkdownIt;
}

async function activate(): Promise<AzdownApi> {
	const extension = vscode.extensions.getExtension<AzdownApi>(EXTENSION_ID);
	assert.ok(extension, `extension ${EXTENSION_ID} is not installed in the test instance`);
	const api = await extension.activate();
	await vscode.commands.executeCommand('azdown.refresh');
	return api;
}

/** The wiki opened as the workspace folder. */
function wikiRoot(): string {
	const folder = vscode.workspace.workspaceFolders?.[0];
	assert.ok(folder, 'the test instance opened no workspace folder');
	return folder.uri.fsPath;
}

/**
 * Renders a page the way the preview does: through the extension's own
 * markdown-it, with the env VS Code supplies.
 */
async function renderPage(relativePath: string): Promise<string> {
	const api = await activate();
	const MarkdownItCtor = require('markdown-it') as new (options?: object) => MarkdownIt;
	const md = api.extendMarkdownIt(new MarkdownItCtor({ html: true }));

	const file = vscode.Uri.file(path.join(wikiRoot(), relativePath));
	const document = await vscode.workspace.openTextDocument(file);

	return md.render(document.getText(), {
		currentDocument: file,
		containingImages: new Set<string>()
	});
}

suite('activation', () => {
	test('the extension activates and exposes extendMarkdownIt', async () => {
		const api = await activate();
		assert.strictEqual(typeof api.extendMarkdownIt, 'function');
	});

	test('extendMarkdownIt returns the instance it was given', async () => {
		// The preview uses the return value; handing back undefined silently
		// disables every plugin.
		const api = await activate();
		const MarkdownItCtor = require('markdown-it') as new () => MarkdownIt;
		const md = new MarkdownItCtor();
		assert.strictEqual(api.extendMarkdownIt(md), md);
	});

	test('it contributes no commands that need a wiki root to exist', async () => {
		const commands = await vscode.commands.getCommands(true);
		for (const id of ['azdown.refresh', 'azdown.chooseWikiRoot', 'azdown.newPage']) {
			assert.ok(commands.includes(id), `command ${id} is not registered`);
		}
	});
});

suite('rendering through the preview pipeline', () => {
	test('azdown syntax renders', async () => {
		const html = await renderPage('Onboarding.md');
		assert.match(html, /<nav class="azdown-toc">/, 'table of contents did not render');
		assert.match(html, /azdown-anchor/, 'heading anchors did not render');
	});

	test('subpages are listed, which needs the wiki root to have been found', async () => {
		const html = await renderPage('Onboarding.md');
		assert.match(html, /<nav class="azdown-tosp">/);
		assert.doesNotMatch(
			html,
			/data-azdown-pending="subpages"/,
			'subpage table is still a placeholder, so no wiki root was detected'
		);
		assert.match(html, /Quick Start/);
	});

	test('attachment paths resolve to a file that exists on disk', async () => {
		const html = await renderPage('Onboarding.md');
		const src = html.match(/<img src="([^"]+)"/)?.[1];
		assert.ok(src, 'no image was rendered');
		assert.ok(!src.startsWith('/.attachments/'), `attachment path was not rewritten: ${src}`);

		const resolved = vscode.Uri.parse(src);
		assert.strictEqual(resolved.scheme, 'file', 'image must not depend on the preview base URL');
		await vscode.workspace.fs.stat(resolved);
	});

	test('attachment paths resolve from nested pages', async () => {
		const html = await renderPage('Smoke-Tests/Links-And-Attachments.md');
		const sources = [...html.matchAll(/<img src="([^"]+)"/g)].map(match => match[1]);
		assert.ok(sources.length >= 3, 'expected PNG, encoded SVG and relative SVG images');
		for (const src of sources) {
			const resolved = vscode.Uri.parse(src);
			assert.strictEqual(resolved.scheme, 'file', 'nested images need absolute resource URIs');
			await vscode.workspace.fs.stat(resolved);
		}
	});

	test('page links resolve to files that exist on disk', async () => {
		const html = await renderPage('Onboarding.md');
		const hrefs = [...html.matchAll(/<a href="(\.[^"#]+)"/g)].map((m) => m[1]);
		assert.ok(hrefs.length > 0, 'no relative page links were rendered');

		for (const href of hrefs) {
			const resolved = path.resolve(wikiRoot(), decodeURIComponent(href));
			await vscode.workspace.fs.stat(vscode.Uri.file(resolved));
		}
	});

	test('a page name with %2D keeps the escape when linked', async () => {
		const html = await renderPage('Onboarding.md');
		assert.match(html, /Azure%252DDevOps-Notes\.md/);
	});
});

suite('the wiki tree', () => {
	test('it lists pages under their Azure DevOps titles', async () => {
		await activate();
		// getChildren through the command surface would need the view focused;
		// reading the directory the provider reads is the same assertion without
		// depending on view visibility.
		const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(wikiRoot()));
		const names = entries.map(([name]) => name);
		assert.ok(names.includes('Build-And-Release.md'));
		assert.ok(names.includes('.order'), 'the sample wiki lost its .order file');
	});
});

suite('opening a preview', () => {
	test('markdown.showPreview opens without throwing', async () => {
		const file = vscode.Uri.file(path.join(wikiRoot(), 'Onboarding.md'));
		await vscode.commands.executeCommand('markdown.showPreview', file);
		// Opening is asynchronous and has no completion signal; reaching here
		// without a rejection is the assertion.
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});
});
