/*
 * Path helpers shared by the rules that need to know where the current
 * document lives.
 *
 * Hand-rolled rather than `node:path` so the package keeps working in a
 * browser bundle, which is the whole point of it being framework-agnostic.
 */

/**
 * Best-effort filesystem path out of whatever the host put in
 * `env.currentDocument`.
 *
 * VS Code passes a `vscode.Uri`; this stays duck-typed so the package never
 * has to import editor types.
 */
export function documentPath(env: unknown): string | undefined {
	const doc = (env as { currentDocument?: { fsPath?: string; path?: string } } | undefined)
		?.currentDocument;
	return doc?.fsPath ?? doc?.path;
}

export function dirname(p: string): string {
	const i = p.replace(/\\/g, '/').lastIndexOf('/');
	return i <= 0 ? '/' : p.slice(0, i);
}

/** Relative path from `fromDir` to `toPath`, in POSIX form. */
export function relativePath(fromDir: string, toPath: string): string {
	const from = fromDir.replace(/\\/g, '/').replace(/\/+$/, '').split('/');
	const to = toPath.replace(/\\/g, '/').split('/');
	const windows = /^[a-z]:/i.test(fromDir) || /^[\\/]{2}/.test(fromDir);
	const comparable = (part: string): string => windows ? part.toLowerCase() : part;

	let i = 0;
	while (i < from.length && i < to.length && comparable(from[i]) === comparable(to[i])) {
		i++;
	}

	const up = from.length - i;
	const segments = [...Array<string>(up).fill('..'), ...to.slice(i)];
	const rel = segments.join('/');
	// Only a leading `..` marks the path as already relative. Testing for a
	// leading "." would misread a dot-directory -- and ".attachments" is
	// exactly the directory this function exists to reach.
	return segments[0] === '..' ? rel : `./${rel}`;
}

/** Encode a filesystem path for a URL, including literal % escapes in names. */
export function pathToHref(file: string): string {
	return file.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}

/** Segment-aware containment, shared with hosts that do not use node:path. */
export function isWithinRoot(root: string, file: string): boolean {
	const windows = /^[a-z]:/i.test(root) || /^[\\/]{2}/.test(root);
	const normalise = (value: string): string => {
		const normal = value.replace(/\\/g, '/').replace(/\/+$/, '');
		return windows ? normal.toLowerCase() : normal;
	};
	const base = normalise(root);
	const target = normalise(file);
	return target === base || target.startsWith(`${base}/`);
}
