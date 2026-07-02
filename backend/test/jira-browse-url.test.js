const test = require('node:test');
const assert = require('node:assert/strict');
const { buildJiraBrowseUrl } = require('../src/services/jiraService');

function withJiraBaseUrl(baseURL, run) {
  const previousBase = process.env.JIRA_BASE_URL;
  const previousUrl = process.env.JIRA_URL;

  if (baseURL === undefined) {
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_URL;
  } else {
    process.env.JIRA_BASE_URL = baseURL;
    delete process.env.JIRA_URL;
  }

  try {
    run();
  } finally {
    if (previousBase === undefined) {
      delete process.env.JIRA_BASE_URL;
    } else {
      process.env.JIRA_BASE_URL = previousBase;
    }

    if (previousUrl === undefined) {
      delete process.env.JIRA_URL;
    } else {
      process.env.JIRA_URL = previousUrl;
    }
  }
}

test('buildJiraBrowseUrl returns empty string when issue key is missing', () => {
  withJiraBaseUrl('https://jira.example.com', () => {
    assert.equal(buildJiraBrowseUrl(''), '');
    assert.equal(buildJiraBrowseUrl(null), '');
    assert.equal(buildJiraBrowseUrl(undefined), '');
  });
});

test('buildJiraBrowseUrl composes browse path from JIRA_BASE_URL', () => {
  withJiraBaseUrl('https://jira.example.com/', () => {
    assert.equal(buildJiraBrowseUrl('CED-1607'), 'https://jira.example.com/browse/CED-1607');
  });
});

test('buildJiraBrowseUrl encodes special characters in issue key', () => {
  withJiraBaseUrl('https://jira.example.com', () => {
    assert.equal(buildJiraBrowseUrl('CED 1607'), 'https://jira.example.com/browse/CED%201607');
  });
});

test('buildJiraBrowseUrl falls back to default base when env is unset', () => {
  withJiraBaseUrl(undefined, () => {
    assert.match(buildJiraBrowseUrl('BLG3-99'), /^https:\/\/.+\/browse\/BLG3-99$/);
  });
});
