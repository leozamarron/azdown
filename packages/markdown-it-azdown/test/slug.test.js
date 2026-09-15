const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, SlugBuilder } = require('../dist/index.js');

test('lowercases and joins words with dashes', () => {
	assert.equal(slugify('Hello World'), 'hello-world');
});

test('collapses whitespace runs into a single dash', () => {
	assert.equal(slugify('Hello    World'), 'hello-world');
	assert.equal(slugify('Hello\tWorld'), 'hello-world');
});

test('trims surrounding whitespace', () => {
	assert.equal(slugify('  Hello World  '), 'hello-world');
});

test('keeps existing dashes and underscores', () => {
	assert.equal(slugify('build-and_release'), 'build-and_release');
});

test('de-duplicates repeated headings in document order', () => {
	const slugs = new SlugBuilder();
	assert.equal(slugs.next('Overview'), 'overview');
	assert.equal(slugs.next('Overview'), 'overview-1');
	assert.equal(slugs.next('Overview'), 'overview-2');
});

test('de-duplication is per builder, not global', () => {
	assert.equal(new SlugBuilder().next('Overview'), 'overview');
	assert.equal(new SlugBuilder().next('Overview'), 'overview');
});

/*
 * Everything below is UNVERIFIED against a real Azure DevOps wiki.
 *
 * These are deliberately `todo` rather than asserted: the current
 * implementation produces *some* answer for each, but we have no evidence it
 * is Azure DevOps's answer, and a passing test would launder a guess into a
 * documented guarantee. Fill them in once someone can diff against a live
 * page -- that is the fidelity work item, and these are its checklist.
 */
test('punctuation handling matches Azure DevOps', { todo: 'verify against a live wiki' }, () => {
	// e.g. is "C# Guide" -> "c-guide", "c39-guide", or "c%23-guide"?
	assert.equal(slugify('C# Guide'), 'c-guide');
});

test('non-Latin headings match Azure DevOps', { todo: 'verify against a live wiki' }, () => {
	// Azure DevOps may percent-encode rather than preserve these.
	assert.equal(slugify('Configuración'), 'configuración');
});

test('headings starting with a digit match Azure DevOps', { todo: 'verify against a live wiki' }, () => {
	assert.equal(slugify('1. Setup'), '1-setup');
});

test('emoji in headings match Azure DevOps', { todo: 'verify against a live wiki' }, () => {
	assert.equal(slugify('Done ✅'), 'done');
});

test('never emits a leading or trailing dash', () => {
	// Structural invariant, independent of how punctuation itself is treated.
	for (const input of ['C# Guide !', '!!! Hola !!!', '- guion -', '   ']) {
		const slug = slugify(input);
		assert.doesNotMatch(slug, /^-/, `leading dash for ${JSON.stringify(input)}`);
		assert.doesNotMatch(slug, /-$/, `trailing dash for ${JSON.stringify(input)}`);
	}
});

test('never emits consecutive dashes', () => {
	assert.doesNotMatch(slugify('Uno !! Dos'), /--/);
});
