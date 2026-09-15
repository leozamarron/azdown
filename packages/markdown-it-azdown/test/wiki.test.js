const test = require('node:test');
const assert = require('node:assert/strict');
const { pageTitle, relativePath } = require('../dist/index.js');

test('page titles turn dashes into spaces', () => {
	assert.equal(pageTitle('Build-And-Release.md'), 'Build And Release');
});

test('%2D survives as a literal dash', () => {
	// Azure DevOps escapes real dashes precisely because "A-B" and "A%2DB" are
	// different pages; un-escaping in the wrong order would merge them.
	assert.equal(pageTitle('Build%2DAnd%2DRelease.md'), 'Build-And-Release');
});

test('mixed escaped and unescaped dashes round-trip correctly', () => {
	assert.equal(pageTitle('Azure%2DDevOps-Wiki.md'), 'Azure-DevOps Wiki');
});

test('the .md extension is optional', () => {
	assert.equal(pageTitle('Onboarding'), 'Onboarding');
});

test('relative paths climb out of nested pages', () => {
	assert.equal(relativePath('/wiki/Equipo', '/wiki/.attachments/x.png'), '../.attachments/x.png');
});

test('relative paths stay local for siblings', () => {
	assert.equal(relativePath('/wiki', '/wiki/.attachments/x.png'), './.attachments/x.png');
});

test('relative paths climb multiple levels', () => {
	assert.equal(relativePath('/wiki/a/b/c', '/wiki/.attachments/x.png'), '../../../.attachments/x.png');
});
