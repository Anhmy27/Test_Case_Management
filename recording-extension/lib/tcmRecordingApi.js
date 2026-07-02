import {
  DEFAULT_TEST_BASE_URL,
  normalizeApiBaseUrl,
} from './extensionConfig.js';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
} from './tcmApiConstants.js';
import { chunkEvents } from './eventBatcher.js';
import { toTrimmed } from './textUtils.js';

const readApiCookies = async (apiBaseUrl) => {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  const cookieUrl = `${base}/`;

  const [accessTokenCookie, csrfCookie] = await Promise.all([
    chrome.cookies.get({ url: cookieUrl, name: ACCESS_TOKEN_COOKIE }),
    chrome.cookies.get({ url: cookieUrl, name: CSRF_COOKIE }),
  ]);

  return { accessTokenCookie, csrfCookie };
};

const buildCookieHeader = ({ accessTokenCookie, csrfCookie }) => {
  const parts = [];
  if (accessTokenCookie?.value) {
    parts.push(`${ACCESS_TOKEN_COOKIE}=${accessTokenCookie.value}`);
  }
  if (csrfCookie?.value) {
    parts.push(`${CSRF_COOKIE}=${csrfCookie.value}`);
  }
  return parts.join('; ');
};

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const apiRequest = async (apiBaseUrl, path, { method = 'GET', body } = {}) => {
  const cookies = await readApiCookies(apiBaseUrl);
  const cookieHeader = buildCookieHeader(cookies);

  if (!cookies.accessTokenCookie?.value) {
    throw new Error(`Chưa đăng nhập TCM. Mở ${DEFAULT_TEST_BASE_URL} và đăng nhập admin trước.`);
  }

  const headers = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  if (cookies.csrfCookie?.value && method !== 'GET' && method !== 'HEAD') {
    headers[CSRF_HEADER] = cookies.csrfCookie.value;
  }

  const response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await parseResponseBody(response);
  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return data;
};

export const startRecordingSession = async ({
  apiBaseUrl,
  projectId,
  baseUrl,
  testCaseEntityId = '',
}) => apiRequest(apiBaseUrl, '/api/recording/sessions', {
  method: 'POST',
  body: {
    projectId: toTrimmed(projectId),
    baseUrl: toTrimmed(baseUrl),
    testCaseEntityId: toTrimmed(testCaseEntityId),
  },
});

export const appendRecordingEvents = async ({ apiBaseUrl, sessionId, events }) => {
  const batches = chunkEvents(events);
  let lastResponse = null;

  for (const batch of batches) {
    lastResponse = await apiRequest(apiBaseUrl, `/api/recording/sessions/${sessionId}/events`, {
      method: 'POST',
      body: { events: batch },
    });
  }

  return lastResponse;
};

export const stopRecordingSession = async ({ apiBaseUrl, sessionId }) =>
  apiRequest(apiBaseUrl, `/api/recording/sessions/${sessionId}/stop`, {
    method: 'POST',
  });
