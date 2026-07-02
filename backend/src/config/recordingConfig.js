/** Smart recording — thresholds & retention (AUTOMATION_SMART_RECORD_ROADMAP §4.3, §4.2). */

const RECORDING_SESSION_STATUSES = [
  'starting',
  'recording',
  'paused',
  'processing',
  'ready_for_review',
  'merged',
  'discarded',
  'failed',
];

const RECORDED_EVENT_RAW_TYPES = [
  'click',
  'input',
  'change',
  'submit',
  'navigation',
  'file_upload',
  'select_change',
  'keypress',
];

const LOCATOR_STRATEGIES = [
  'testid',
  'role',
  'id',
  'label',
  'placeholder',
  'text',
  'css',
  'xpath',
];

const DRAFT_REVIEW_STATUSES = ['pending', 'accepted', 'rejected', 'edited'];

/** Move events to RecordingEvent collection when any threshold is hit. */
const RECORDING_EVENT_EXTERNALIZE_THRESHOLDS = {
  maxEmbeddedEvents: 300,
  maxDocumentBytes: 4 * 1024 * 1024,
  maxContinuousRecordingMs: 15 * 60 * 1000,
};

/** Per-event artifact limits when appending recording events (roadmap §4.5). */
const RECORDING_EVENT_ARTIFACT_LIMITS = {
  maxScreenshotBytes: 2 * 1024 * 1024,
  maxDomBytes: 1 * 1024 * 1024,
};

/** Auto-delete sessions that were not merged into a test case. */
const RECORDING_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Logical paths under ARTIFACT_ROOT_DIR (default uploads/). See roadmap §4.5. */
const RECORDING_ARTIFACT_PREFIX = 'recording';
const RECORDING_STEP_SCREENSHOT_SUBDIR = 'steps';
const RECORDING_DOM_SNAPSHOT_SUBDIR = 'dom';

const buildRecordingSessionExpiresAt = (fromDate = new Date()) =>
  new Date(fromDate.getTime() + RECORDING_SESSION_RETENTION_MS);

module.exports = {
  RECORDING_SESSION_STATUSES,
  RECORDED_EVENT_RAW_TYPES,
  LOCATOR_STRATEGIES,
  DRAFT_REVIEW_STATUSES,
  RECORDING_EVENT_EXTERNALIZE_THRESHOLDS,
  RECORDING_EVENT_ARTIFACT_LIMITS,
  RECORDING_SESSION_RETENTION_MS,
  RECORDING_ARTIFACT_PREFIX,
  RECORDING_STEP_SCREENSHOT_SUBDIR,
  RECORDING_DOM_SNAPSHOT_SUBDIR,
  buildRecordingSessionExpiresAt,
};
