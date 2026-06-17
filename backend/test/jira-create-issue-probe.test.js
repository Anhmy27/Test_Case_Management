/**
 * Live probe: company Jira quick-create flow (Dashboard tokens + QuickCreateIssue JSON/POST path).
 *
 * Run only this file:
 *   node --test test/jira-create-issue-probe.test.js
 */
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('playwright');
const {
  extractAtlToken,
  extractFormToken,
  extractMetaContent,
} = require('../src/services/jiraService');
const { stripHtml } = require('../src/utils/runtimeEnv');

const hasJiraEnv = Boolean(
  String(process.env.JIRA_BASE_URL || process.env.JIRA_URL || '').trim()
  && String(process.env.JIRA_USERNAME || '').trim()
  && String(process.env.JIRA_PASSWORD || '').trim(),
);

const QUICK_CREATE_GET_URL = '/secure/QuickCreateIssue!default.jspa?decorator=none';

function summarizeDashboardHtml(html) {
  return {
    length: html.length,
    preview: stripHtml(html).slice(0, 200),
    hasAtlassianTokenMeta: /name=["']atlassian-token["']/i.test(html),
    remoteUser: extractMetaContent(html, 'ajs-remote-user') || null,
    atlToken: extractAtlToken(html) || null,
    formToken: extractFormToken(html) || null,
  };
}

async function loginJiraContext() {
  const baseURL = String(process.env.JIRA_BASE_URL || process.env.JIRA_URL || '').trim().replace(/\/$/, '');
  const username = String(process.env.JIRA_USERNAME || '').trim();
  const password = String(process.env.JIRA_PASSWORD || '').trim();

  const context = await request.newContext({ baseURL });

  const loginPage = await context.get('/login.jsp');
  assert.ok(loginPage.ok(), `login.jsp failed with status ${loginPage.status()}`);

  const loginHtml = await loginPage.text();
  const loginAtlToken = extractAtlToken(loginHtml);

  const loginResponse = await context.post('/login.jsp', {
    form: {
      os_username: username,
      os_password: password,
      os_destination: '/',
      atl_token: loginAtlToken,
      login: 'Log In',
    },
  });

  const loginReason = loginResponse.headers()['x-seraph-loginreason'];
  assert.ok(
    (loginResponse.status() === 200 || loginResponse.status() === 302)
    && (!loginReason || loginReason === 'OK'),
    `login failed: status=${loginResponse.status()} reason=${loginReason || ''}`,
  );

  return { context, baseURL };
}

test('live probe: quick-create uses Dashboard tokens and QuickCreateIssue JSON', {
  skip: !hasJiraEnv || process.env.CI === 'true',
}, async () => {
  const { context, baseURL } = await loginJiraContext();

  try {
    console.log('[probe] baseURL:', baseURL);

    const dashboardResponse = await context.get('/secure/Dashboard.jspa');
    const dashboardHtml = await dashboardResponse.text();
    const dashboardSummary = summarizeDashboardHtml(dashboardHtml);

    console.log('[probe] GET /secure/Dashboard.jspa');
    console.log('[probe]   status:', dashboardResponse.status());
    console.log('[probe]   summary:', dashboardSummary);

    assert.equal(dashboardResponse.status(), 200);
    assert.ok(dashboardSummary.atlToken, 'Dashboard should expose quick-create CSRF token');

    const quickCreateResponse = await context.get(QUICK_CREATE_GET_URL);
    const quickCreateBody = await quickCreateResponse.text();
    const contentType = quickCreateResponse.headers()['content-type'] || '';

    console.log('[probe] GET', QUICK_CREATE_GET_URL);
    console.log('[probe]   status:', quickCreateResponse.status());
    console.log('[probe]   content-type:', contentType);
    console.log('[probe]   final-url:', quickCreateResponse.url());
    console.log('[probe]   body-preview:', quickCreateBody.slice(0, 220));

    assert.equal(quickCreateResponse.status(), 200);
    assert.match(contentType, /json/i, 'QuickCreate GET should return JSON field schema');
    assert.doesNotMatch(quickCreateBody, /name=["']atl_token["']/i, 'QuickCreate JSON should not contain atl_token input');
    assert.ok(quickCreateBody.includes('"fields"'), 'QuickCreate JSON should include fields array');

    const quickCreateJson = JSON.parse(quickCreateBody);
    assert.ok(quickCreateJson.formToken, 'QuickCreate JSON should expose formToken for POST');
    assert.ok(quickCreateJson.atl_token, 'QuickCreate JSON should expose atl_token for POST');
    assert.notEqual(
      quickCreateJson.formToken,
      dashboardSummary.atlToken,
      'formToken must come from QuickCreate JSON, not Dashboard atl_token',
    );
  } finally {
    await context.dispose();
  }
});
