const { request } = require('playwright');
const { httpError } = require('../utils/httpError');
const { isProduction, stripHtml } = require('../utils/runtimeEnv');
const {
  clearJiraSession,
  decryptJiraAccountSecrets,
  getEffectiveJiraAccount,
  storeJiraSession,
} = require('./jiraAccountService');

const throwJiraError = (statusCode, fallbackMessage, rawBody) => {
  if (!isProduction() && rawBody) {
    const excerpt = stripHtml(rawBody).slice(0, 500);
    throw httpError(statusCode, excerpt || fallbackMessage);
  }

  if (rawBody) {
    console.error('[Jira]', fallbackMessage, {
      preview: stripHtml(rawBody).slice(0, 200),
    });
  }

  throw httpError(statusCode, fallbackMessage);
};

const getJiraConfig = () => {
  const baseURL = String(
    process.env.JIRA_BASE_URL ||
    process.env.JIRA_URL ||
    'https://rd.cytech.ai',
  ).trim().replace(/\/$/, '');
  const username = String(process.env.JIRA_USERNAME || '').trim();
  const password = String(process.env.JIRA_PASSWORD || '').trim();
  const cookie = String(process.env.JIRA_COOKIE || '').trim();

  if (!baseURL) {
    throw httpError(500, 'Jira integration is not configured: missing JIRA_BASE_URL');
  }

  return { baseURL, username, password, cookie };
};

const extractToken = (html, tokenName) => {
  const escapedTokenName = String(tokenName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`name=["']${escapedTokenName}["'][^>]*value=["']([^"']+)["']`, 'i'),
    new RegExp(`value=["']([^"']+)["'][^>]*name=["']${escapedTokenName}["']`, 'i'),
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

const extractMetaContent = (html, metaName) => {
  const escapedMetaName = String(metaName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escapedMetaName}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedMetaName}["']`, 'i'),
    new RegExp(`<meta[^>]+id=["']${escapedMetaName}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
};

const extractAtlToken = (html) =>
  extractToken(html, 'atl_token')
  || extractMetaContent(html, 'atlassian-token')
  || extractMetaContent(html, 'ajs-atl-token')
  || extractMetaContent(html, 'atl-token')
  || extractToken(html, 'atlassian.xsrf.token');

const extractFormToken = (html) =>
  extractToken(html, 'formToken')
  || extractToken(html, 'form_token')
  || extractMetaContent(html, 'atlassian-token')
  || extractMetaContent(html, 'ajs-atl-token');

const getXsrfTokenFromContext = async (context) => {
  const state = await context.storageState();
  const cookies = Array.isArray(state?.cookies) ? state.cookies : [];
  const xsrfCookie = cookies.find((cookie) => cookie?.name === 'atlassian.xsrf.token');
  return xsrfCookie?.value ? String(xsrfCookie.value) : '';
};

const isAuthenticatedHtml = (html) => {
  const remoteUser = extractMetaContent(html, 'ajs-remote-user');
  return Boolean(remoteUser);
};

const verifyJiraSession = async (context) => {
  const myselfResponse = await context.get('/rest/api/2/myself', {
    headers: {
      Accept: 'application/json',
      'X-Atlassian-Token': 'no-check',
    },
  });

  if (myselfResponse.ok()) {
    const user = await myselfResponse.json();
    if (user?.name || user?.key) {
      return user;
    }
  }

  const dashboardResponse = await context.get('/secure/Dashboard.jspa');
  const dashboardHtml = await dashboardResponse.text();

  if (!dashboardResponse.ok() || !isAuthenticatedHtml(dashboardHtml)) {
    throwJiraError(502, 'Jira session verification failed', dashboardHtml);
  }

  return dashboardResponse;
};

const getContextCookieHeader = async (context, baseURL) => {
  const state = await context.storageState();
  const cookies = Array.isArray(state?.cookies) ? state.cookies : [];
  if (cookies.length === 0) {
    return '';
  }

  let host = '';
  try {
    host = new URL(baseURL).hostname;
  } catch {
    host = '';
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const scoped = cookies.filter((cookie) => {
    if (!cookie?.name) {
      return false;
    }
    if (typeof cookie.expires === 'number' && cookie.expires > 0 && cookie.expires < nowSec) {
      return false;
    }

    if (!host) {
      return true;
    }

    const domain = String(cookie.domain || '').replace(/^\./, '');
    return Boolean(domain) && (host === domain || host.endsWith(`.${domain}`));
  });

  return scoped.map((cookie) => `${cookie.name}=${cookie.value || ''}`).join('; ');
};

const getContextCookieSnapshot = async (context, baseURL) => {
  const state = await context.storageState();
  const cookies = Array.isArray(state?.cookies) ? state.cookies : [];
  const cookieHeader = await getContextCookieHeader(context, baseURL);
  const expiresAtCandidates = cookies
    .map((cookie) => (typeof cookie.expires === 'number' && cookie.expires > 0 ? new Date(cookie.expires * 1000) : null))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime());

  return {
    cookieHeader,
    expiresAt: expiresAtCandidates[0] || null,
  };
};

const createLoggedInContext = async ({ userId } = {}) => {
  const { baseURL } = getJiraConfig();
  const resolvedAccount = decryptJiraAccountSecrets(await getEffectiveJiraAccount(userId));
  if (!resolvedAccount) {
    throw httpError(400, 'Jira profile is not configured. Open Jira Profile tab and set your Jira account.');
  }
  const account = resolvedAccount;

  if (!account.jiraUsername && !account.jiraPassword && !account.jiraCookieHeader) {
    throw httpError(400, 'Jira profile is missing credentials. Open Jira Profile tab and update it.');
  }

  const context = await request.newContext({
    baseURL,
    extraHTTPHeaders: account.jiraCookieHeader
      ? {
          Cookie: account.jiraCookieHeader,
        }
      : undefined,
  });

  const persistSession = async (cookieHeader = account.jiraCookieHeader) => {
    const snapshot = await getContextCookieSnapshot(context, baseURL);
    await storeJiraSession({
      profileKey: account.profileKey,
      userId: account.userId,
      profileType: account.profileType,
      jiraCookieHeader: snapshot.cookieHeader || cookieHeader,
      sessionExpiresAt: snapshot.expiresAt,
    });
  };

  if (account.jiraCookieHeader) {
    try {
      await verifyJiraSession(context);
      await persistSession(account.jiraCookieHeader);
      console.log('[Jira] session verified via stored cookie');
      return context;
    } catch (cookieErr) {
      if (!account.jiraUsername || !account.jiraPassword) {
        throw cookieErr;
      }
      console.log('[Jira] stored Jira cookie invalid, fallback to username/password login');
    }
  }

  console.log('[Jira] login start', {
    baseURL,
    username: account.jiraUsername ? `${account.jiraUsername.slice(0, 2)}***` : '',
  });

  const loginPage = await context.get('/login.jsp');
  if (!loginPage.ok()) {
    throw httpError(502, 'Unable to open Jira login page');
  }

  const loginHtml = await loginPage.text();
  const atlToken = extractAtlToken(loginHtml);

  console.log('[Jira] login page loaded', {
    hasAtlToken: Boolean(atlToken),
    loginPageStatus: loginPage.status(),
  });

  const loginResponse = await context.post('/login.jsp', {
    form: {
      os_username: account.jiraUsername,
      os_password: account.jiraPassword,
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
    await clearJiraSession({
      profileKey: account.profileKey,
      userId: account.userId,
      profileType: account.profileType,
    }).catch(() => {});
    throwJiraError(502, 'Jira login failed', body);
  }

  console.log('[Jira] login response ok', {
    status: loginResponse.status(),
    loginReason: loginReason || 'OK',
  });

  await verifyJiraSession(context);
  await persistSession();

  console.log('[Jira] session verified and cached');

  return context;
};

const loadCreateIssuePage = async (context, { pid, issueTypeId }) => {
  const urls = [
    `/secure/CreateIssue!default.jspa?decorator=none&pid=${encodeURIComponent(pid)}&issuetype=${encodeURIComponent(issueTypeId)}`,
    `/secure/CreateIssue!default.jspa?pid=${encodeURIComponent(pid)}&issuetype=${encodeURIComponent(issueTypeId)}`,
  ];

  let lastError = null;

  for (const url of urls) {
    const createPage = await context.get(url);
    const createHtml = await createPage.text();

    if (!createPage.ok()) {
      lastError = { status: createPage.status(), body: createHtml };
      continue;
    }

    const atlToken = extractAtlToken(createHtml) || await getXsrfTokenFromContext(context);
    const formToken = extractFormToken(createHtml) || atlToken;

    console.log('[Jira] create issue page ok', {
      status: createPage.status(),
      url,
      hasAtlToken: Boolean(atlToken),
      hasFormToken: Boolean(formToken),
    });

    return {
      atlToken,
      formToken,
      createHtml,
    };
  }

  if (lastError) {
    console.log('[Jira] create issue page failed', {
      status: lastError.status,
    });
    throwJiraError(502, 'Unable to open Jira create issue page', lastError.body);
  }

  throw httpError(502, 'Unable to open Jira create issue page');
};

const createBugIssue = async ({
  pid,
  issueTypeId,
  summary,
  description,
  priority,
  assignee,
  originalEstimate,
  labels,
  versions,
  userId,
}) => {
  const context = await createLoggedInContext({ userId });

  try {
    console.log('[Jira] create issue start', {
      pid,
      issueTypeId,
      hasAssignee: Boolean(assignee),
      labels: labels || '',
    });

    const { atlToken, formToken } = await loadCreateIssuePage(context, { pid, issueTypeId });

    if (!atlToken) {
      throw httpError(
        502,
        'Unable to read Jira CSRF token for issue creation. Re-save your Jira profile and try again.',
      );
    }

    const response = await context.post('/secure/QuickCreateIssue.jspa?decorator=none', {
      headers: {
        'X-Atlassian-Token': 'no-check',
      },
      form: {
        pid,
        issuetype: issueTypeId,
        atl_token: atlToken,
        formToken: formToken || atlToken,
        isCreateIssue: 'true',
        hasWorkStarted: 'true',
        summary,
        timetracking_originalestimate: String(originalEstimate || '').trim() || '0',
        customfield_10106: '',
        assignee: assignee || '',
        duedate: '',
        customfield_10105: '',
        description,
        'dnd-dropzone': '',
        priority: priority || '3',
        labels: labels || '',
        versions: Array.isArray(versions) ? versions.join(',') : (versions || ''),
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
      if (response.status() === 403) {
        throw httpError(
          403,
          'Jira rejected issue creation (403). Check your Jira account permission for this project or re-save your Jira profile.',
        );
      }
      throwJiraError(502, 'Jira issue creation failed', result.body);
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

const suggestLabels = async ({ query = '', userId } = {}) => {
  const context = await createLoggedInContext({ userId });
  const { baseURL } = getJiraConfig();

  try {
    const params = new URLSearchParams();
    params.set('query', String(query || ''));
    const cookieHeader = await getContextCookieHeader(context, baseURL);

    const response = await context.get(`/rest/api/1.0/labels/suggest?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throwJiraError(502, 'Unable to load Jira label suggestions', body);
    }

    const rawBody = await response.text();
    const body = String(rawBody || '').trim();

    // Jira may return JSON (preferred) or XML based on gateway/proxy behavior.
    if (body.startsWith('{') || body.startsWith('[')) {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw httpError(502, 'Jira labels response is not valid JSON');
      }

      const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
      return suggestions
        .map((item) => String(item?.label || '').trim())
        .filter(Boolean);
    }

    const xmlMatches = [...body.matchAll(/<label>([^<]+)<\/label>/gi)];
    if (xmlMatches.length > 0) {
      return xmlMatches
        .map((match) => String(match[1] || '').trim())
        .filter(Boolean);
    }

    throw httpError(502, 'Unable to parse Jira label suggestions response');
  } finally {
    await context.dispose();
  }
};

const suggestVersions = async ({
  projectIds,
  query = '',
  maxResults = 100,
  startAt = 0,
  userId,
} = {}) => {
  const context = await createLoggedInContext({ userId });
  const { baseURL } = getJiraConfig();

  try {
    const params = new URLSearchParams();
    params.set('maxResults', String(maxResults || 100));
    params.set('startAt', String(startAt || 0));
    params.set('projectIds', String(projectIds || ''));
    params.set('query', String(query || ''));
    const cookieHeader = await getContextCookieHeader(context, baseURL);

    const response = await context.get(`/rest/api/2/version?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throwJiraError(502, 'Unable to load Jira version suggestions', body);
    }

    const rawBody = await response.text();
    const body = String(rawBody || '').trim();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw httpError(502, 'Jira versions response is not valid JSON');
    }

    const values = Array.isArray(parsed?.values) ? parsed.values : [];
    return values
      .map((item) => ({
        id: String(item?.id || '').trim(),
        name: String(item?.name || '').trim(),
        description: String(item?.description || '').trim(),
      }))
      .filter((item) => item.id && item.name);
  } finally {
    await context.dispose();
  }
};

const searchAssignableUsers = async ({
  projectKeys,
  username = '',
  maxResults = 100,
  userId,
}) => {
  const context = await createLoggedInContext({ userId });

  try {
    const query = new URLSearchParams();
    query.set('maxResults', String(maxResults || 100));
    query.set('projectKeys', String(projectKeys || ''));
    query.set('username', String(username || ''));

    const response = await context.get(`/rest/api/latest/user/assignable/multiProjectSearch?${query.toString()}`);

    if (!response.ok()) {
      const body = await response.text();
      throwJiraError(502, 'Unable to load Jira assignable users', body);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } finally {
    await context.dispose();
  }
};

module.exports = {
  createBugIssue,
  suggestLabels,
  suggestVersions,
  searchAssignableUsers,
  extractAtlToken,
  extractFormToken,
  extractMetaContent,
};