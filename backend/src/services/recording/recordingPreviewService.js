const { httpError } = require('../../utils/httpError');
const dryRunService = require('../automation/dryRunService');
const { convertDraftStepsToAutomationSteps } = require('./recordingMergeService');
const { getRecordingSessionForUser } = require('./recordingSessionService');

const PREVIEWABLE_SESSION_STATUS = 'ready_for_review';

const assertPreviewableSessionStatus = (session) => {
  if (session.status === 'merged') {
    throw httpError(400, 'Cannot preview a merged recording session');
  }

  if (session.status !== PREVIEWABLE_SESSION_STATUS) {
    throw httpError(400, `Cannot preview session with status ${session.status}`);
  }
};

const buildPreviewAutomationFromSession = (session, {
  webId = '',
  userKey = '',
  timeoutMs,
} = {}) => {
  const steps = convertDraftStepsToAutomationSteps(session.draftSteps);
  if (steps.length === 0) {
    throw httpError(400, 'No draft steps available to preview');
  }

  const automation = {
    enabled: true,
    runner: 'playwright',
    baseUrl: String(session.baseUrl || '').trim(),
    webId: String(webId || '').trim(),
    userKey: String(userKey || '').trim(),
    steps,
  };

  if (timeoutMs !== undefined) {
    automation.timeoutMs = timeoutMs;
  }

  return automation;
};

const previewRecordingSessionService = async ({
  sessionId,
  user,
  baseUrl,
  webId,
  userKey,
  timeoutMs,
}) => {
  const session = await getRecordingSessionForUser(sessionId, user);
  assertPreviewableSessionStatus(session);

  const automation = buildPreviewAutomationFromSession(session, { webId, userKey, timeoutMs });
  const resolvedBaseUrl = String(baseUrl || session.baseUrl || '').trim();

  const dryRunResult = await dryRunService.dryRunAutomationService({
    testCaseId: session.testCaseEntityId || '',
    automation,
    baseUrl: resolvedBaseUrl,
    user,
  });

  return {
    sessionId: String(session._id),
    projectId: String(session.project),
    previewStepsCount: automation.steps.length,
    baseUrl: resolvedBaseUrl,
    ...dryRunResult,
  };
};

module.exports = {
  assertPreviewableSessionStatus,
  buildPreviewAutomationFromSession,
  previewRecordingSessionService,
};
