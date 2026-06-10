const path = require('path');
const fs = require('fs');
const { AUTOMATION_UPLOAD_DIR } = require('../config/automationArtifacts');

const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
]);

const parseAllowedHostEntries = () => {
  const raw = String(process.env.AUTOMATION_ALLOWED_HOSTS || '').trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const hostMatchesEntry = (hostname, entry) => {
  const host = String(hostname || '').trim().toLowerCase();
  const pattern = String(entry || '').trim().toLowerCase();

  if (!host || !pattern) {
    return false;
  }

  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    const bare = pattern.slice(2);
    return host === bare || host.endsWith(suffix);
  }

  return host === pattern;
};

const isBlockedMetadataHost = (hostname) =>
  BLOCKED_METADATA_HOSTS.has(String(hostname || '').trim().toLowerCase());

const isHostExplicitlyAllowed = (hostname) => {
  const entries = parseAllowedHostEntries();
  if (!entries.length) {
    return false;
  }

  return entries.some((entry) => hostMatchesEntry(hostname, entry));
};

const parseHttpUrl = (urlString, label) => {
  const trimmed = String(urlString || '').trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid http(s) URL`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https`);
  }

  if (isBlockedMetadataHost(parsed.hostname)) {
    throw new Error(`${label} host is not allowed`);
  }

  return parsed;
};

const isSameOrigin = (left, right) =>
  left.protocol === right.protocol
  && left.hostname === right.hostname
  && left.port === right.port;

const assertAllowedBaseUrl = (urlString) => {
  const parsed = parseHttpUrl(urlString, 'baseUrl');
  const entries = parseAllowedHostEntries();

  if (entries.length > 0 && !isHostExplicitlyAllowed(parsed.hostname)) {
    throw new Error(`baseUrl host "${parsed.hostname}" is not listed in AUTOMATION_ALLOWED_HOSTS`);
  }

  return parsed.toString();
};

const assertAllowedNavigationUrl = (urlString, baseUrl = '') => {
  const parsed = parseHttpUrl(urlString, 'Navigation URL');
  const normalizedBase = String(baseUrl || '').trim();

  if (normalizedBase) {
    const baseParsed = parseHttpUrl(normalizedBase, 'baseUrl');
    if (isSameOrigin(parsed, baseParsed)) {
      return parsed.toString();
    }
  }

  if (isHostExplicitlyAllowed(parsed.hostname)) {
    return parsed.toString();
  }

  throw new Error(
    `Navigation to "${parsed.hostname}" is not allowed. Use URLs under baseUrl origin or add the host to AUTOMATION_ALLOWED_HOSTS.`,
  );
};

const resolveNavigationUrl = (baseUrl, pathOrUrl) => {
  const value = String(pathOrUrl || '').trim();

  if (!value) {
    return assertAllowedBaseUrl(baseUrl);
  }

  if (/^https?:\/\//i.test(value)) {
    return assertAllowedNavigationUrl(value, baseUrl);
  }

  const normalizedBase = String(baseUrl || '').trim();
  if (!normalizedBase) {
    throw new Error('Relative navigation requires baseUrl');
  }

  const joined = new URL(
    value.startsWith('/') ? value : `/${value}`,
    normalizedBase,
  ).toString();

  return assertAllowedNavigationUrl(joined, baseUrl);
};

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveSandboxedUploadPaths = (rawValue) => {
  const uploadRoot = path.resolve(AUTOMATION_UPLOAD_DIR);
  ensureDirectory(uploadRoot);

  const entries = String(rawValue || '')
    .split(/[\n,]+/)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  if (!entries.length) {
    throw new Error('upload step requires at least one file path in value or target');
  }

  return entries.map((filePath) => {
    const absolutePath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(uploadRoot, filePath);

    if (
      absolutePath !== uploadRoot
      && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)
    ) {
      throw new Error(`Upload path must stay under ${uploadRoot}`);
    }

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Upload file not found: ${filePath}`);
    }

    return absolutePath;
  });
};

module.exports = {
  assertAllowedBaseUrl,
  assertAllowedNavigationUrl,
  resolveNavigationUrl,
  resolveSandboxedUploadPaths,
};
