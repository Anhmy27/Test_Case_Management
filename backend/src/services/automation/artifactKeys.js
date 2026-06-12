const path = require('path');
const {
  ARTIFACT_ROOT_DIR,
  LEGACY_ARTIFACT_RUN_ROOT,
  DRY_RUN_ARTIFACT_NAMESPACE,
} = require('../../config/automationArtifacts');

const RUNS_PREFIX = 'runs';
const DRY_RUN_PREFIX = DRY_RUN_ARTIFACT_NAMESPACE;
const FAILURE_BASENAME = 'failure';

const MIME_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

const EXTENSION_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const normalizeSlashes = (value) => String(value || '').replace(/\\/g, '/').trim();

const buildRunFailureScreenshotKey = (runId, resultId, extension = 'png') => {
  const ext = String(extension || 'png').replace(/^\./, '').toLowerCase();
  return `${RUNS_PREFIX}/${runId}/${resultId}/${FAILURE_BASENAME}.${ext}`;
};

const buildDryRunFailureScreenshotKey = (dryRunId) =>
  `${DRY_RUN_PREFIX}/${dryRunId}/${FAILURE_BASENAME}.png`;

const extensionFromMime = (mimeType) =>
  MIME_TO_EXTENSION[String(mimeType || '').toLowerCase()] || 'png';

const contentTypeFromKey = (key) => {
  const ext = path.extname(normalizeSlashes(key)).replace(/^\./, '').toLowerCase();
  return EXTENSION_TO_MIME[ext] || 'image/png';
};

const isLogicalArtifactKey = (stored) => {
  const normalized = normalizeSlashes(stored);
  return normalized.startsWith(`${RUNS_PREFIX}/`) || normalized.startsWith(`${DRY_RUN_PREFIX}/`);
};

const extractRunFailureScreenshotKey = (stored) => {
  const normalized = normalizeSlashes(stored);
  const logicalMatch = normalized.match(
    /(?:^|\/)(runs\/[^/]+\/[^/]+\/failure\.(?:png|jpe?g|webp))$/i,
  );
  if (logicalMatch) {
    return logicalMatch[1];
  }

  const legacyMatch = normalized.match(/([^/]+)\/([^/]+)\/failure\.(?:png|jpe?g|webp)$/i);
  if (legacyMatch) {
    return buildRunFailureScreenshotKey(
      legacyMatch[1],
      legacyMatch[2],
      path.extname(normalized).replace(/^\./, '') || 'png',
    );
  }

  return '';
};

const normalizeStoredArtifactKey = (stored) => {
  const normalized = normalizeSlashes(stored);
  if (!normalized) {
    return '';
  }

  if (isLogicalArtifactKey(normalized)) {
    return normalized;
  }

  const extracted = extractRunFailureScreenshotKey(normalized);
  if (extracted) {
    return extracted;
  }

  return normalized;
};

const resolveLegacyLocalPaths = (stored) => {
  const normalized = normalizeSlashes(stored);
  const candidates = [];

  if (normalized) {
    candidates.push(path.resolve(process.cwd(), normalized));
  }

  const key = normalizeStoredArtifactKey(stored);
  if (key) {
    candidates.push(path.join(ARTIFACT_ROOT_DIR, key));
  }

  const legacyMatch = normalized.match(/([^/]+)\/([^/]+)\/failure\.(?:png|jpe?g|webp)$/i);
  if (legacyMatch) {
    candidates.push(path.join(
      LEGACY_ARTIFACT_RUN_ROOT,
      legacyMatch[1],
      legacyMatch[2],
      path.basename(normalized),
    ));
  }

  return candidates;
};

module.exports = {
  RUNS_PREFIX,
  DRY_RUN_PREFIX,
  buildRunFailureScreenshotKey,
  buildDryRunFailureScreenshotKey,
  extensionFromMime,
  contentTypeFromKey,
  normalizeStoredArtifactKey,
  resolveLegacyLocalPaths,
  isLogicalArtifactKey,
};
