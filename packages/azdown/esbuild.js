const esbuild = require("esbuild");
const path = require("node:path");
const fs = require("node:fs");

// Anclado a __dirname: el build no depende del cwd desde el que se invoque.
const pkgRoot = __dirname;

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * Copies KaTeX's stylesheet and fonts into media/ so they ship in the VSIX.
 *
 * Only the woff2 files are taken. Every @font-face lists woff2 first and the
 * browser stops at the first format it supports, so the woff and ttf copies
 * never get requested -- carrying all three would quadruple the weight for
 * fallbacks no supported VS Code will ever reach.
 *
 * Copied at build time rather than committed: they are vendored artefacts, and
 * keeping them out of git means the version cannot drift from package.json.
 */
function copyKatexAssets() {
	const from = path.dirname(require.resolve('katex/package.json'));
	const to = path.join(pkgRoot, 'media/katex');

	fs.mkdirSync(path.join(to, 'fonts'), { recursive: true });
	fs.copyFileSync(path.join(from, 'dist/katex.min.css'), path.join(to, 'katex.min.css'));

	let count = 0;
	for (const file of fs.readdirSync(path.join(from, 'dist/fonts'))) {
		if (file.endsWith('.woff2')) {
			fs.copyFileSync(path.join(from, 'dist/fonts', file), path.join(to, 'fonts', file));
			count++;
		}
	}
	if (count === 0) {
		throw new Error('no KaTeX woff2 fonts found -- maths would render as boxes');
	}
}

async function main() {
	copyKatexAssets();
	const common = {
		bundle: true,
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	};

	const targets = [
		{
			// The extension host: Node, CommonJS, with the vscode API provided
			// by the runtime rather than bundled.
			...common,
			entryPoints: [path.join(pkgRoot, 'src/extension.ts')],
			format: 'cjs',
			platform: 'node',
			outfile: path.join(pkgRoot, 'dist/extension.js'),
			external: ['vscode'],
		},
		{
			// The preview webview: browser, IIFE, everything inlined. The
			// preview runs under a strict CSP that blocks external scripts, so
			// Mermaid has to travel inside this bundle -- there is no CDN option.
			...common,
			entryPoints: [path.join(pkgRoot, 'src/preview/mermaid.ts')],
			format: 'iife',
			platform: 'browser',
			outfile: path.join(pkgRoot, 'dist/preview.js'),
		},
	];

	const contexts = await Promise.all(targets.map((t) => esbuild.context(t)));

	if (watch) {
		await Promise.all(contexts.map((c) => c.watch()));
	} else {
		await Promise.all(contexts.map((c) => c.rebuild()));
		await Promise.all(contexts.map((c) => c.dispose()));
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
