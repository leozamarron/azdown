const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildSync } = require('esbuild');

// Exercise the actual host implementation without downloading VS Code. Only
// the editor API is replaced; filesystem operations use isolated temp wikis.
const code = buildSync({
	stdin: {
		contents: "export * from './extension'; export * from './wiki'; export * from './tree';",
		resolveDir: path.join(__dirname, '../src'), loader: 'ts'
	},
	bundle: true, platform: 'node', format: 'cjs', write: false,
	external: ['vscode', 'markdown-it-azdown']
}).outputFiles[0].text;

function fixture(t, userSettings) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'azdown-test-'));
	const subscriptions = [];
	t.after(() => {
		for (const disposable of subscriptions.reverse()) disposable.dispose();
		fs.rmSync(dir, { recursive: true, force: true });
	});
	class EventEmitter {
		listeners = new Set();
		event = listener => {
			this.listeners.add(listener);
			return { dispose: () => this.listeners.delete(listener) };
		};
		fire(value) { for (const listener of this.listeners) listener(value); }
		dispose() { this.listeners.clear(); }
	}
	const uri = file => ({ fsPath: file, path: file.split(path.sep).join('/'), toString: () => pathToFileURL(file).href });
	const noopEvent = () => ({ dispose() {} });
	const commands = new Map();
	const configurationChanged = new EventEmitter();
	const settings = userSettings ?? { root: dir };
	const state = {
		get root() { return settings.root; },
		set root(value) { settings.root = value; },
		executed: [], opened: [], copied: '', errors: [], watchers: [], input: 'Child Page',
		updates: [], orderFiles: [], configurationChanged
	};
	const vscode = {
		EventEmitter, Uri: { file: uri },
		ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
		TreeItem: class { constructor(label) { this.label = label; } },
		ThemeIcon: class {}, TreeItemCollapsibleState: { None: 0, Collapsed: 1 },
		RelativePattern: class { constructor(base, pattern) { this.baseUri = uri(base); this.pattern = pattern; } },
		workspace: {
			getConfiguration: () => ({
				get: () => state.workspaceRoot ?? state.root,
				inspect: () => ({ globalValue: state.root, workspaceValue: state.workspaceRoot }),
				update: async (key, value, target) => {
					state.updates.push({ key, value, target });
					if (state.updateError) throw new Error(state.updateError);
					assert.equal(target, vscode.ConfigurationTarget.Global, 'must never write repository settings');
					settings.root = value;
					configurationChanged.fire({ affectsConfiguration: section => section === 'azdown.wikiRoot' });
				}
			}),
			getWorkspaceFolder: () => undefined,
			findFiles: async () => state.orderFiles.map(uri),
			onDidChangeConfiguration: configurationChanged.event, onDidChangeWorkspaceFolders: noopEvent,
			createFileSystemWatcher: pattern => {
				const create = new EventEmitter(), change = new EventEmitter(), remove = new EventEmitter();
				const watcher = {
					pattern, create, change, remove, disposed: false,
					onDidCreate: create.event, onDidChange: change.event, onDidDelete: remove.event,
					dispose() { this.disposed = true; create.dispose(); change.dispose(); remove.dispose(); }
				};
				state.watchers.push(watcher);
				return watcher;
			}
		},
		window: {
			createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
			createTreeView: (_id, options) => {
				state.tree = options.treeDataProvider;
				return { visible: false, onDidChangeVisibility: noopEvent, dispose() {} };
			},
			onDidChangeActiveTextEditor: noopEvent,
			showTextDocument: async target => { state.opened.push(target.fsPath); },
			showInputBox: async () => state.input,
			showOpenDialog: async () => state.picked ? [uri(state.picked)] : undefined,
			showInformationMessage() {}, showWarningMessage() {},
			showErrorMessage: message => { state.errors.push(message); }
		},
		commands: {
			registerCommand: (id, callback) => {
				commands.set(id, callback);
				return { dispose: () => commands.delete(id) };
			},
			executeCommand: async (id, ...args) => {
				state.executed.push([id, ...args]);
				return commands.get(id)?.(...args);
			}
		},
		env: { clipboard: { writeText: async value => { state.copied = value; } } }
	};
	const mod = { exports: {} };
	new Function('require', 'module', 'exports', code)(name => name === 'vscode' ? vscode : require(name), mod, mod.exports);
	return { ...mod.exports, dir, state, vscode, subscriptions, uri };
}

for (const workspaceCount of [0, 1, 2]) {
	test(`wiki picker saves globally with ${workspaceCount} workspace folders and ignores legacy project settings`, async t => {
		const f = fixture(t);
		f.vscode.workspace.workspaceFolders = workspaceCount
			? Array.from({ length: workspaceCount }, (_, i) => ({ uri: f.uri(path.join(f.dir, `project-${i}`)) }))
			: undefined;
		f.state.workspaceRoot = f.dir;
		f.state.picked = path.join(f.dir, 'Chosen Wiki');
		f.createPage(f.state.picked, 'Chosen Page');
		f.activate({ subscriptions: f.subscriptions });
		await f.vscode.commands.executeCommand('azdown.chooseWikiRoot');
		assert.deepEqual(f.state.updates, [{ key: 'wikiRoot', value: f.state.picked, target: f.vscode.ConfigurationTarget.Global }]);
		assert.equal(f.state.tree.getChildren()[0].file, path.join(f.state.picked, 'Chosen-Page.md'));
		assert.deepEqual(f.state.errors, []);
	});
}

test('global wiki selection survives another project and configuration changes refresh existing windows', async t => {
	const settings = {};
	const first = fixture(t, settings);
	const second = fixture(t, settings);
	first.state.picked = path.join(first.dir, 'wiki');
	first.createPage(first.state.picked, 'First');
	first.activate({ subscriptions: first.subscriptions });
	await first.vscode.commands.executeCommand('azdown.chooseWikiRoot');

	second.state.workspaceRoot = second.dir;
	second.vscode.workspace.workspaceFolders = [{ uri: second.uri(second.dir) }];
	second.activate({ subscriptions: second.subscriptions });
	await second.vscode.commands.executeCommand('azdown.refresh');
	assert.equal(second.state.tree.getChildren()[0].file, path.join(first.state.picked, 'First.md'));

	second.state.picked = path.join(second.dir, 'other-wiki');
	second.createPage(second.state.picked, 'Second');
	await second.vscode.commands.executeCommand('azdown.chooseWikiRoot');
	first.state.executed.length = 0;
	// VS Code broadcasts user-setting changes to other windows of the profile.
	first.state.configurationChanged.fire({ affectsConfiguration: section => section === 'azdown.wikiRoot' });
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(first.state.tree.getChildren()[0].file, path.join(second.state.picked, 'Second.md'));
	assert.ok(first.state.executed.some(([id]) => id === 'markdown.preview.refresh'));
	assert.deepEqual(first.state.errors, []);
	assert.deepEqual(second.state.errors, []);
});

test('cancelling the wiki picker or failing to save preserves the current wiki', async t => {
	const f = fixture(t);
	const page = f.createPage(f.dir, 'Original');
	f.activate({ subscriptions: f.subscriptions });
	await f.vscode.commands.executeCommand('azdown.refresh');
	await f.vscode.commands.executeCommand('azdown.chooseWikiRoot');
	assert.deepEqual(f.state.updates, []);
	f.state.picked = path.join(f.dir, 'different');
	f.state.updateError = 'Settings cannot be saved';
	await f.vscode.commands.executeCommand('azdown.chooseWikiRoot');
	assert.equal(f.state.root, f.dir);
	assert.equal(f.state.tree.getChildren()[0].file, page);
	assert.deepEqual(f.state.errors, ['azdown: Settings cannot be saved']);
});

test('empty or relative user settings use autodetection without importing legacy workspace paths', async t => {
	const f = fixture(t);
	const detected = path.join(f.dir, 'detected');
	f.createPage(detected, 'Page');
	f.state.workspaceRoot = f.dir;
	f.vscode.workspace.workspaceFolders = [{ uri: f.uri(f.dir) }];
	f.state.orderFiles = [path.join(detected, '.order')];
	const wiki = new f.WikiRoot({ appendLine() {} });
	f.subscriptions.push(wiki);
	for (const value of [undefined, '', 'detected']) {
		f.state.root = value;
		await wiki.detect();
		assert.equal(wiki.root(), detected);
	}
	f.state.orderFiles = [];
	await wiki.detect();
	assert.equal(wiki.root(), undefined);
	assert.deepEqual(f.state.updates, []);
});

test('wiki root is declared as a machine setting so repositories and Settings Sync cannot override it', () => {
	const manifest = require('../package.json');
	assert.equal(manifest.contributes.configuration.properties['azdown.wikiRoot'].scope, 'machine');
});

test('context commands edit, preview, copy and create under the selected page', async t => {
	const f = fixture(t);
	const parent = f.createPage(f.dir, 'Parent');
	f.activate({ subscriptions: f.subscriptions });
	await f.vscode.commands.executeCommand('azdown.refresh');
	const item = f.state.tree.getChildren()[0];
	await f.vscode.commands.executeCommand('azdown.edit', item);
	assert.deepEqual(f.state.opened, [parent]);
	await f.vscode.commands.executeCommand('azdown.openToSide', item);
	assert.ok(f.state.executed.some(([id, target]) => id === 'markdown.showPreviewToSide' && target.fsPath === parent));
	await f.vscode.commands.executeCommand('azdown.copyLink', item);
	assert.equal(f.state.copied, '/Parent');
	await f.vscode.commands.executeCommand('azdown.newSubpage', item);
	assert.ok(fs.existsSync(path.join(f.dir, 'Parent', 'Child-Page.md')));
	assert.equal(fs.readFileSync(path.join(f.dir, 'Parent', '.order'), 'utf8'), 'Child-Page\n');
	assert.deepEqual(f.state.errors, []);
});

test('a selected external wiki is watched and .order edits refresh previews', async t => {
	const f = fixture(t);
	f.activate({ subscriptions: f.subscriptions });
	await f.vscode.commands.executeCommand('azdown.refresh');
	const watcher = f.state.watchers.find(w => w.pattern.baseUri?.fsPath === f.dir);
	assert.ok(watcher);
	f.state.executed.length = 0;
	watcher.change.fire(f.uri(path.join(f.dir, '.order')));
	await new Promise(resolve => setImmediate(resolve));
	assert.ok(f.state.executed.some(([id]) => id === 'markdown.preview.refresh'));
	f.state.root = undefined;
	await f.vscode.commands.executeCommand('azdown.refresh');
	assert.equal(watcher.disposed, true);
});

test('page creation preserves existing content and rolls back on .order failure', t => {
	const f = fixture(t);
	const page = f.createPage(f.dir, 'Existing');
	fs.writeFileSync(page, 'Do not replace');
	assert.throws(() => f.createPage(f.dir, 'Existing'), /already exists/);
	assert.equal(fs.readFileSync(page, 'utf8'), 'Do not replace');
	const broken = path.join(f.dir, 'broken');
	fs.mkdirSync(path.join(broken, '.order'), { recursive: true });
	assert.throws(() => f.createPage(broken, 'New'));
	assert.equal(fs.existsSync(path.join(broken, 'New.md')), false);
	for (const title of ['../escape', 'a/b', 'a\\b', '']) {
		assert.throws(() => f.createPage(f.dir, title));
	}
});

test('order files retain CRLF and duplicate entries do not duplicate pages', t => {
	const f = fixture(t);
	f.createPage(f.dir, 'A');
	fs.writeFileSync(path.join(f.dir, '.order'), 'A\r\nA\r\nMissing\r\n');
	f.createPage(f.dir, 'B');
	assert.equal(fs.readFileSync(path.join(f.dir, '.order'), 'utf8'), 'A\r\nA\r\nMissing\r\nB\r\n');
	assert.deepEqual(f.listPages(f.dir).map(p => p.title), ['A', 'B']);
});

test('tree item identity is stable across discovery and child loading', async t => {
	const f = fixture(t);
	f.createPage(f.dir, 'Parent');
	const child = f.createPage(path.join(f.dir, 'Parent'), 'Child');
	const tree = new f.WikiTreeProvider({ root: () => f.dir });
	f.subscriptions.push(tree);
	const item = await tree.find(child);
	assert.ok(item);
	assert.equal(tree.getChildren()[0], tree.getParent(item));
	assert.equal(tree.getChildren(tree.getParent(item))[0], item);
	const id = item.id;
	tree.refresh();
	assert.equal((await tree.find(child)).id, id);
});

test('resolved and generated links decode to real filenames including literal percent escapes', async t => {
	const f = fixture(t);
	const page = f.createPage(f.dir, 'A-B');
	const parent = f.createPage(f.dir, 'Parent');
	const child = f.createPage(path.join(f.dir, 'Parent'), 'C-D');
	const wiki = new f.WikiRoot({ appendLine() {} });
	f.subscriptions.push(wiki);
	await wiki.detect();
	assert.equal(wiki.resolveLink(parent, '/A%2DB'), page);
	assert.equal(wiki.resolveLink(parent, '/A%252DB.md'), page);
	fs.writeFileSync(`${page}.md`, 'different page');
	assert.equal(wiki.resolveLink(parent, '/A%252DB.md'), page);
	assert.equal(path.resolve(f.dir, decodeURIComponent(wiki.subpages(parent)[0].href)), child);
	assert.equal(wiki.resolveLink(path.join(f.dir, '..', 'Other.md'), '/A%2DB'), undefined);
	assert.deepEqual(wiki.subpages(path.join(f.dir, '..', 'Other.md')), []);
});

test('a missing root or a file used as a root is not treated as a wiki', async t => {
	const f = fixture(t);
	const wiki = new f.WikiRoot({ appendLine() {} });
	f.subscriptions.push(wiki);
	f.state.root = path.join(f.dir, 'missing');
	await wiki.detect();
	assert.equal(wiki.root(), undefined);
	f.state.root = f.createPage(f.dir, 'File');
	await wiki.detect();
	assert.equal(wiki.root(), undefined);
});

test('wiki image URLs survive navigation while the preview keeps the first page base', async t => {
	const f = fixture(t);
	const wiki = new f.WikiRoot({ appendLine() {} });
	f.subscriptions.push(wiki);
	await wiki.detect();
	const MarkdownIt = require('markdown-it');
	const { azdown } = require('markdown-it-azdown');
	const md = new MarkdownIt().use(azdown, { wiki });
	const originalImage = md.renderer.rules.image;
	// VS Code turns absolute file URIs into webview resource URLs, but leaves
	// relative URLs for the browser to resolve against the existing <base>.
	md.renderer.rules.image = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const src = token.attrGet('src');
		if (src && !token.attrGet('data-src')) {
			token.attrSet('data-src', src);
			if (src.startsWith('file:')) {
				const url = new URL(src);
				token.attrSet('src', `https://file.vscode-resource.test${url.pathname}${url.search}${url.hash}`);
			}
		}
		return originalImage(tokens, idx, options, env, self);
	};
	const initialBase = `https://file.vscode-resource.test${f.dir}/Onboarding.md`;
	for (const name of ['Onboarding.md', 'Section/Page.md', 'Section/Deep/Page.md']) {
		const documentPath = path.join(f.dir, name);
		const relative = path.relative(path.dirname(documentPath), path.join(f.dir, '.attachments', 'diagram sample.svg')).split(path.sep).join('/');
		for (const src of ['/.attachments/diagram%20sample.svg', relative.replace(/ /g, '%20')]) {
			const tokens = md.parse(`![test](${src})`, {});
			for (let render = 0; render < 2; render++) {
				const html = md.renderer.render(tokens, md.options, { currentDocument: { fsPath: documentPath } });
				const actual = new URL(html.match(/<img src="([^"]+)"/)[1], initialBase);
				assert.equal(decodeURIComponent(actual.pathname), `${f.dir}/.attachments/diagram sample.svg`);
				assert.equal(actual.origin, 'https://file.vscode-resource.test');
			}
		}
	}
});

test('image URIs preserve percent escapes, queries and SVG fragments', async t => {
	const f = fixture(t);
	const wiki = new f.WikiRoot({ appendLine() {} });
	f.subscriptions.push(wiki);
	await wiki.detect();
	const documentPath = path.join(f.dir, 'Section/Page.md');
	const uri = new URL(wiki.imageUri(documentPath, '../.attachments/A%252DB%20image.svg?v=2#icon'));
	assert.equal(decodeURIComponent(uri.pathname), `${f.dir}/.attachments/A%2DB image.svg`);
	assert.equal(uri.search, '?v=2');
	assert.equal(uri.hash, '#icon');
	assert.equal(wiki.imageUri(path.join(f.dir, '..', 'outside.md'), './image.png'), undefined);
	assert.equal(wiki.imageUri(documentPath, 'https://example.test/image.png'), undefined);
});
