import { fileURLToPath } from 'node:url';
import { defineConfig } from '@vscode/test-cli';

// Anclado al propio archivo, no al cwd: la suite corre igual desde la raíz
// del monorepo que desde packages/azdown.
const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	files: `${here}out/test/**/*.test.js`
});
