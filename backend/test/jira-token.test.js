const test = require('node:test');
const assert = require('node:assert/strict');
const { extractAtlToken, extractFormToken, extractMetaContent } = require('../src/services/jiraService');

test('extractAtlToken reads Jira 9 meta atlassian-token', () => {
  const html = '<meta id="atlassian-token" name="atlassian-token" content="BLG3-24D2-R7JL-KWU5_example_lout">';
  assert.equal(extractAtlToken(html), 'BLG3-24D2-R7JL-KWU5_example_lout');
});

test('extractAtlToken still reads hidden atl_token input', () => {
  const html = '<input type="hidden" name="atl_token" value="abc123" />';
  assert.equal(extractAtlToken(html), 'abc123');
});

test('extractFormToken falls back to atlassian-token meta', () => {
  const html = '<meta name="atlassian-token" content="token-from-meta" />';
  assert.equal(extractFormToken(html), 'token-from-meta');
});

test('extractMetaContent supports reversed attribute order', () => {
  const html = '<meta content="reversed-token" name="ajs-atl-token" />';
  assert.equal(extractMetaContent(html, 'ajs-atl-token'), 'reversed-token');
});
