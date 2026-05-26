const { request } = require('playwright');
const { httpError } = require('../utils/httpError');

const getJiraConfig = () => {
  const baseURL = String(
    process.env.JIRA_BASE_URL ||
    process.env.JIRA_URL ||
    'https://rd.cytech.ai',
  ).trim().replace(/\/$/, '');
  const username = String(process.env.JIRA_USERNAME || '').trim();
  const password = String(process.env.JIRA_PASSWORD || '').trim();

  const missingFields = [];
  if (!baseURL) {
    missingFields.push('JIRA_BASE_URL');
  }
  if (!username) {
    missingFields.push('JIRA_USERNAME');
  }
  if (!password) {
    missingFields.push('JIRA_PASSWORD');
  }

  if (missingFields.length > 0) {
    throw httpError(500, `Jira integration is not configured: missing ${missingFields.join(', ')}`);
  }

  return { baseURL, username, password };
};

const extractToken = (html, tokenName) => {
  const escapedTokenName = String(tokenName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`name=["']${escapedTokenName}["'][^>]*value=["']([^"']+)["']`, 'i'),
    new RegExp(`${escapedTokenName}=([A-Za-z0-9_:.\-]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
};

const verifyJiraSession = async (context) => {
  const dashboardResponse = await context.get('/secure/Dashboard.jspa');

  if (!dashboardResponse.ok()) {
    const body = await dashboardResponse.text();
    throw httpError(502, body || 'Jira session verification failed');
  }

  return dashboardResponse;
};

const createLoggedInContext = async () => {
  const { baseURL, username, password } = getJiraConfig();
  const context = await request.newContext({ baseURL });

  console.log('[Jira] login start', {
    baseURL,
    username: username ? `${username.slice(0, 2)}***` : '',
  });

  const loginPage = await context.get('/login.jsp');
  if (!loginPage.ok()) {
    throw httpError(502, 'Unable to open Jira login page');
  }

  const loginHtml = await loginPage.text();
  const atlToken = extractToken(loginHtml, 'atl_token') || extractToken(loginHtml, 'atlassian.xsrf.token');

  console.log('[Jira] login page loaded', {
    hasAtlToken: Boolean(atlToken),
    loginPageStatus: loginPage.status(),
  });

  const loginResponse = await context.post('/login.jsp', {
    form: {
      os_username: username,
      os_password: password,
      os_destination: '/',
      atl_token: atlToken,
      login: 'Log In',
    },
  });

  const loginReason = loginResponse.headers()['x-seraph-loginreason'];
  if (!(loginResponse.status() === 200 || loginResponse.status() === 302) || (loginReason && loginReason !== 'OK')) {
    const body = await loginResponse.text();
    console.log('[Jira] login failed', {
      status: loginResponse.status(),
      loginReason: loginReason || '',
    });
    throw httpError(502, body || 'Jira login failed');
  }

  console.log('[Jira] login response ok', {
    status: loginResponse.status(),
    loginReason: loginReason || 'OK',
  });

  await verifyJiraSession(context);

  console.log('[Jira] session verified');

  return context;
};

const createBugIssue = async ({
  pid,
  issueTypeId,
  summary,
  description,
  priority,
  assignee,
  labels,
}) => {
  const context = await createLoggedInContext();

  try {
    console.log('[Jira] create issue start', {
      pid,
      issueTypeId,
      hasAssignee: Boolean(assignee),
      labels: labels || '',
    });

    const createPage = await context.get(
      `/secure/CreateIssue!default.jspa?decorator=none&pid=${encodeURIComponent(pid)}&issuetype=${encodeURIComponent(issueTypeId)}`,
    );

    if (!createPage.ok()) {
      const body = await createPage.text();
      console.log('[Jira] create issue page failed', {
        status: createPage.status(),
      });
      throw httpError(502, body || 'Unable to open Jira create issue page');
    }

    const createHtml = await createPage.text();
    const atlToken = extractToken(createHtml, 'atl_token');
    const formToken = extractToken(createHtml, 'formToken') || extractToken(createHtml, 'form_token');

    console.log('[Jira] create issue page ok', {
      status: createPage.status(),
      hasAtlToken: Boolean(atlToken),
      hasFormToken: Boolean(formToken),
    });

    const response = await context.post('/secure/QuickCreateIssue.jspa?decorator=none', {
      form: {
        pid,
        issuetype: issueTypeId,
        atl_token: atlToken,
        formToken: formToken || atlToken,
        isCreateIssue: 'true',
        hasWorkStarted: 'true',
        summary,
        timetracking_originalestimate: '0',
        customfield_10106: '',
        assignee: assignee || '',
        duedate: '',
        customfield_10105: '',
        description,
        'dnd-dropzone': '',
        priority: priority || '3',
        labels: labels || '',
        issuelinks: '',
        'issuelinks-linktype': '',
      },
    });

    const result = {
      status: response.status(),
      headers: response.headers(),
      body: await response.text(),
    };

    console.log('[Jira] create issue response', {
      status: result.status,
      location: result.headers.location || result.headers.Location || '',
      hasIssueKey: Boolean(result.body.match(/([A-Z][A-Z0-9_]+-\d+)/)?.[1]),
    });

    const location = result.headers.location || result.headers.Location || '';
    const issueKey = location.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/)?.[1] || result.body.match(/([A-Z][A-Z0-9_]+-\d+)/)?.[1] || '';

    if (!(response.status() === 200 || response.status() === 302)) {
      const textOnly = String(result.body || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      throw httpError(502, textOnly || 'Jira issue creation failed');
    }

    return {
      issueKey,
      location,
      status: response.status(),
    };
  } finally {
    await context.dispose();
  }
};

module.exports = {
  createBugIssue,
};