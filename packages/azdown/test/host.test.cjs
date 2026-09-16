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

function fixture(t) {
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
	const state = { root: dir, executed: [], opened: [], copied: '', errors: [], watchers: [], input: 'Child Page' };
	const vscode = {
		EventEmitter, Uri: { file: uri },
		TreeItem: class { constructor(label) { this.label = label; } },
		ThemeIcon: class {}, TreeItemCollapsibleState: { None: 0, Collapsed: 1 },
		RelativePattern: class { constructor(base, pattern) { this.baseUri = uri(base); this.pattern = pattern; } },
		workspace: {
			getConfiguration: () => ({ get: () => state.root }),
			getWorkspaceFolder: () => undefined,
			findFiles: async () => [],
			onDidChangeConfiguration: noopEvent, onDidChangeWorkspaceFolders: noopEvent,
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
