const path = require('path');
const {
  ARTIFACT_ROOT_DIR,
  LEGACY_ARTIFACT_NESTED_ROOT,
  LEGACY_ARTIFACT_RUN_ROOT,
  DRY_RUN_ARTIFACT_NAMESPACE,
} = require('../../config/automationArtifacts');

const RUN_PREFIX = 'run';
const LEGACY_RUNS_PREFIX = 'runs';
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
  return `${RUN_PREFIX}/${runId}/${resultId}/${FAILURE_BASENAME}.${ext}`;
};

const buildDryRunFailureScreenshotKey = (dryRunId) =>
  `${DRY_RUN_PREFIX}/${dryRunId}/${FAILURE_BASENAME}.png`;

const extensionFromMime = (mimeType) =>
  MIME_TO_EXTENSION[String(mimeType || '').toLowerCase()] || 'png';

const contentTypeFromKey = (key) => {
  const ext = path.extname(normalizeSlashes(key)).replace(/^\./, '').toLowerCase();
  return EXTENSION_TO_MIME[ext] || 'image/png';
};

const isRunArtifactKey = (normalized) =>
  normalized.startsWith(`${RUN_PREFIX}/`) || normalized.startsWith(`${LEGACY_RUNS_PREFIX}/`);

const isLogicalArtifactKey = (stored) => {
  const normalized = normalizeSlashes(stored);
  return isRunArtifactKey(normalized) || normalized.startsWith(`${DRY_RUN_PREFIX}/`);
};

const toCanonicalRunKey = (normalized) => {
  if (normalized.startsWith(`${LEGACY_RUNS_PREFIX}/`)) {
    return `${RUN_PREFIX}/${normalized.slice(LEGACY_RUNS_PREFIX.length + 1)}`;
  }
  return normalized;
};

const extractRunFailureScreenshotKey = (stored) => {
  const normalized = normalizeSlashes(stored);
  const logicalMatch = normalized.match(
    /(?:^|\/)(?:run|runs)\/[^/]+\/[^/]+\/failure\.(?:png|jpe?g|webp)$/i,
  );
  if (logicalMatch) {
    return toCanonicalRunKey(logicalMatch[0].replace(/^\//, ''));
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
    return toCanonicalRunKey(normalized);
  }

  const extracted = extractRunFailureScreenshotKey(normalized);
  if (extracted) {
    return extracted;
  }

  return normalized;
};

const legacyRunKeyVariants = (canonicalKey) => {
  const key = normalizeStoredArtifactKey(canonicalKey);
  if (!key || !key.startsWith(`${RUN_PREFIX}/`)) {
    return key ? [key] : [];
  }

  const suffix = key.slice(RUN_PREFIX.length + 1);
  return [
    key,
    `${LEGACY_RUNS_PREFIX}/${suffix}`,
  ];
};

const resolveLegacyLocalPaths = (stored) => {
  const normalized = normalizeSlashes(stored);
  const candidates = [];

  if (normalized) {
    candidates.push(path.resolve(process.cwd(), normalized));
  }

  const canonicalKey = normalizeStoredArtifactKey(stored);
  for (const keyVariant of legacyRunKeyVariants(canonicalKey)) {
    candidates.push(path.join(ARTIFACT_ROOT_DIR, keyVariant));
    candidates.push(path.join(LEGACY_ARTIFACT_NESTED_ROOT, keyVariant));
  }

  if (canonicalKey.startsWith(`${DRY_RUN_PREFIX}/`)) {
    candidates.push(path.join(LEGACY_ARTIFACT_NESTED_ROOT, canonicalKey));
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

  return [...new Set(candidates)];
};

module.exports = {
  RUN_PREFIX,
  LEGACY_RUNS_PREFIX,
  RUNS_PREFIX: RUN_PREFIX,
  DRY_RUN_PREFIX,
  buildRunFailureScreenshotKey,
  buildDryRunFailureScreenshotKey,
  extensionFromMime,
  contentTypeFromKey,
  normalizeStoredArtifactKey,
  resolveLegacyLocalPaths,
  isLogicalArtifactKey,
};
