const path = require('path');

const ARTIFACT_ROOT_DIR = path.resolve(
  process.cwd(),
  String(process.env.ARTIFACT_ROOT_DIR || 'uploads').trim() || 'uploads',
);

/** @deprecated Old layout: uploads/artifacts/{dry-run,runs}/... */
const LEGACY_ARTIFACT_NESTED_ROOT = path.resolve(
  process.cwd(),
  String(process.env.LEGACY_ARTIFACT_NESTED_ROOT || 'uploads/artifacts').trim() || 'uploads/artifacts',
);

/** @deprecated Old flat layout: uploads/runs/{runId}/{resultId}/... */
const LEGACY_ARTIFACT_RUN_ROOT = path.resolve(
  process.cwd(),
  String(process.env.LEGACY_ARTIFACT_RUN_ROOT || 'uploads/runs').trim() || 'uploads/runs',
);

const ARTIFACT_STORAGE_DRIVER = String(process.env.ARTIFACT_STORAGE || 'local').trim().toLowerCase();

const AUTOMATION_UPLOAD_DIR = path.resolve(
  process.cwd(),
  String(process.env.AUTOMATION_UPLOAD_DIR || 'uploads/test-files').trim() || 'uploads/test-files',
);

const DRY_RUN_ARTIFACT_NAMESPACE = 'dry-run';
const FAILURE_SCREENSHOT_FILENAME = 'failure.png';
const FAILURE_SCREENSHOT_CONTENT_TYPE = 'image/png';

const getArtifactRetentionConfig = () => ({
  retentionDays: Math.max(1, Number(process.env.ARTIFACT_RETENTION_DAYS || 30)),
  dryRunRetentionHours: Math.max(1, Number(process.env.DRY_RUN_ARTIFACT_RETENTION_HOURS || 24)),
});

module.exports = {
  ARTIFACT_ROOT_DIR,
  LEGACY_ARTIFACT_NESTED_ROOT,
  LEGACY_ARTIFACT_RUN_ROOT,
  ARTIFACT_STORAGE_DRIVER,
  AUTOMATION_UPLOAD_DIR,
  DRY_RUN_ARTIFACT_NAMESPACE,
  FAILURE_SCREENSHOT_FILENAME,
  FAILURE_SCREENSHOT_CONTENT_TYPE,
  getArtifactRetentionConfig,
};
