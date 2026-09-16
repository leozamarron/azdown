import { fileURLToPath } from 'node:url';
import { defineConfig } from '@vscode/test-cli';

// Anchored to this file rather than the cwd, so the suite runs the same from
// the monorepo root as from packages/azdown.
const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	files: `${here}out/test/**/*.test.js`,
	// The tests need a wiki to find. Opening sample/wiki as the workspace gives
	// root autodetection a .order file to land on, and gives the tree real
	// pages to list, instead of asserting against an empty window.
	workspaceFolder: `${here}../../sample/wiki`,
	mocha: {
		// Activating the extension and opening a preview is slower than Mocha's
		// 2s default, and a timeout here looks like a failure rather than a
		// slow machine.
		timeout: 20000
	}
});
