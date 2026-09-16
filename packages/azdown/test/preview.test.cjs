const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');

const code = transformSync(fs.readFileSync(path.join(__dirname, '../src/preview/mermaid.ts'), 'utf8'), {
	loader: 'ts', format: 'cjs'
}).code;

test('slow Mermaid renders are serialized and cannot overwrite new source or theme', async () => {
	const attrs = new Map([['data-azdown-src', 'graph LR; A-->B']]);
	const element = {
		isConnected: true, innerHTML: '', textContent: '',
		hasAttribute: name => attrs.has(name), getAttribute: name => attrs.get(name) ?? null,
		setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name)
	};
	let theme = 'default';
	let observer, timer;
	const pending = [];
	const calls = [];
	const mermaid = {
		initialize: options => calls.push(['theme', options.theme]),
		render: (_id, source) => {
			calls.push(['render', source]);
			return new Promise(resolve => pending.push(resolve));
		}
	};
	const document = {
		body: { classList: { contains: value => value === 'vscode-dark' && theme === 'dark' } },
		querySelectorAll: () => [element]
	};
	const MutationObserver = class {
		constructor(callback) { observer = callback; }
		observe() {}
	};
	new Function('require', 'document', 'MutationObserver', 'setTimeout', 'clearTimeout', code)(
		() => mermaid, document, MutationObserver,
		callback => { timer = callback; return 1; }, () => { timer = undefined; }
	);
	assert.equal(pending.length, 1);
	attrs.set('data-azdown-src', 'graph LR; B-->C');
	theme = 'dark';
	observer();
	timer();
	assert.equal(pending.length, 1, 'a second render started while one was running');
	pending.shift()({ svg: '<svg>old</svg>' });
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(element.innerHTML, '', 'obsolete diagram was written into the new preview');
	assert.deepEqual(calls.at(-2), ['theme', 'dark']);
	assert.deepEqual(calls.at(-1), ['render', 'graph LR; B-->C']);
	pending.shift()({ svg: '<svg>new</svg>' });
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(element.innerHTML, '<svg>new</svg>');
	assert.equal(attrs.get('data-azdown-rendered'), 'dark graph LR; B-->C');
});
