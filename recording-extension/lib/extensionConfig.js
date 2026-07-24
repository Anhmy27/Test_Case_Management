import { DEFAULT_API_BASE_URL } from './tcmApiConstants.js';
import { toTrimmed } from './textUtils.js';

export const DEFAULT_TEST_BASE_URL = 'http://localhost:3000';
export const MAX_LOCAL_EVENT_LOG = 500;

const LIVE_SESSION_STATUSES = ['recording', 'paused'];

export const isLiveSessionStatus = (status) => LIVE_SESSION_STATUSES.includes(status);

export const sessionIdLabel = (session) => session?.id || session?.sessionId || '';

export const getDefaultRecordingConfig = () => ({
  apiBaseUrl: DEFAULT_API_BASE_URL,
  projectId: '',
  testCaseEntityId: '',
  baseUrl: DEFAULT_TEST_BASE_URL,
  // BL-2: off by default — screenshot + DOM snapshot cost extra bandwidth/CPU per event.
  captureVisuals: false,
});

export const normalizeApiBaseUrl = (apiBaseUrl) =>
  (toTrimmed(apiBaseUrl) || DEFAULT_API_BASE_URL).replace(/\/$/, '');

export const normalizeRecordingConfig = (config = {}) => ({
  ...getDefaultRecordingConfig(),
  ...config,
  apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
  projectId: toTrimmed(config.projectId),
  testCaseEntityId: toTrimmed(config.testCaseEntityId),
  baseUrl: toTrimmed(config.baseUrl) || DEFAULT_TEST_BASE_URL,
  captureVisuals: Boolean(config.captureVisuals),
});

/** scheme + host + port; empty string if URL is invalid. */
export const getUrlOrigin = (url) => {
  try {
    return new URL(toTrimmed(url)).origin;
  } catch {
    return '';
  }
};

/**
 * Only same-origin as session Base URL is recorded.
 * Path/query changes on that origin are allowed; other domains/tabs are ignored.
 */
export const isAllowedRecordingPageUrl = (pageUrl, baseUrl) => {
  const baseOrigin = getUrlOrigin(baseUrl);
  const pageOrigin = getUrlOrigin(pageUrl);
  return Boolean(baseOrigin && pageOrigin && baseOrigin === pageOrigin);
};
