const esbuild = require("esbuild");
const path = require("node:path");

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

async function main() {
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
