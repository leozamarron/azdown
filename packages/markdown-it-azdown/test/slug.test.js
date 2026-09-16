const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, SlugBuilder } = require('../dist/index.js');

/*
 * The one case Microsoft publishes a worked answer for. Everything else in
 * this file is either a direct consequence of it, or a `todo` below.
 *
 *   #### Team #1 : Release Wiki!
 *   [Visit the Project Wiki](#team-1--release-wiki)
 *
 * https://learn.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance
 */
test("matches Microsoft's documented example exactly", () => {
	assert.equal(slugify('Team #1 : Release Wiki!'), 'team-1--release-wiki');
});

test('the double hyphen in the documented example is not collapsed', () => {
	// Guards the specific regression: a "tidy up consecutive hyphens" step
	// looks harmless and silently breaks every anchor containing punctuation
	// between two spaces.
	assert.match(slugify('Team #1 : Release Wiki!'), /1--release/);
});

test('lowercases and joins words with hyphens', () => {
	assert.equal(slugify('Hello World'), 'hello-world');
});

test('punctuation is removed rather than turned into a hyphen', () => {
	// The docs claim conversion; the documented example proves removal.
	assert.equal(slugify('Release Wiki!'), 'release-wiki');
	assert.equal(slugify('What? Why!'), 'what-why');
});

test('each space contributes its own hyphen', () => {
	assert.equal(slugify('a  b'), 'a--b');
});

test('trims surrounding whitespace', () => {
	assert.equal(slugify('  Hello World  '), 'hello-world');
});

test('keeps existing hyphens and underscores', () => {
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
 * Still unverified. The documentation's single example does not reach these,
 * and its prose ("remove or convert other special characters according to the
 * rendering engine's rules") explicitly declines to specify them.
 *
 * These stay `todo` on purpose: an earlier version of this file asserted that
 * trailing hyphens are trimmed and consecutive ones collapsed, described it as
 * a "safe normalisation", and it turned out to contradict the documented
 * example. Assertions here need evidence, not plausibility.
 *
 * To close one: put the heading on a real Azure DevOps wiki page, inspect the
 * rendered heading's id, and turn the todo into an assertion.
 */
test('a trailing hyphen from stripped punctuation', { todo: 'verify against a live wiki' }, () => {
	// Does Azure DevOps keep "c-guide-" or trim it to "c-guide"?
	assert.equal(slugify('C# Guide !'), 'c-guide');
});

test('non-Latin headings', { todo: 'verify against a live wiki' }, () => {
	// Azure DevOps may percent-encode these rather than preserve them.
	assert.equal(slugify('Configuración'), 'configuración');
});

test('headings starting with a digit', { todo: 'verify against a live wiki' }, () => {
	assert.equal(slugify('1. Setup'), '1-setup');
});

test('emoji in headings', { todo: 'verify against a live wiki' }, () => {
	assert.equal(slugify('Done ✅'), 'done');
});

test('the de-duplication suffix format', { todo: 'verify against a live wiki' }, () => {
	// Azure DevOps de-duplicates, but "-1" is an assumption.
	const slugs = new SlugBuilder();
	slugs.next('Overview');
	assert.equal(slugs.next('Overview'), 'overview-1');
});
