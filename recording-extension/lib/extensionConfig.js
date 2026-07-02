import { DEFAULT_API_BASE_URL } from './tcmApiConstants.js';
import { toTrimmed } from './textUtils.js';

export const DEFAULT_TEST_BASE_URL = 'http://localhost:3000';
export const MAX_LOCAL_EVENT_LOG = 500;

export const getDefaultRecordingConfig = () => ({
  apiBaseUrl: DEFAULT_API_BASE_URL,
  projectId: '',
  testCaseEntityId: '',
  baseUrl: DEFAULT_TEST_BASE_URL,
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
});
