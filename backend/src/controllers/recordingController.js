const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest } = require('../utils/auditFromRequest');
const {
  startRecordingSessionService,
  appendRecordingEventsService,
  pauseRecordingSessionService,
  resumeRecordingSessionService,
  stopRecordingSessionService,
  getRecordingSessionService,
  discardRecordingSessionService,
} = require('../services/recording/recordingSessionService');
const { mergeRecordingSessionService } = require('../services/recording/recordingMergeService');
const { patchRecordingDraftService } = require('../services/recording/recordingDraftPatchService');
const { previewRecordingSessionService } = require('../services/recording/recordingPreviewService');

const startRecordingSession = asyncHandler(async (req, res) => {
  const session = await startRecordingSessionService({
    projectId: req.body.projectId,
    baseUrl: req.body.baseUrl,
    testCaseEntityId: req.body.testCaseEntityId || '',
    user: req.user,
  });

  await auditFromRequest(req, {
    action: 'recording.start',
    resourceType: 'recording_session',
    resourceId: session.id,
    projectId: session.projectId,
    metadata: { baseUrl: session.baseUrl },
  });

  res.status(201).json({ session });
});

const appendRecordingEvents = asyncHandler(async (req, res) => {
  const session = await appendRecordingEventsService({
    sessionId: req.params.sessionId,
    events: req.body.events,
    user: req.user,
  });

  res.json({ session });
});

const pauseRecordingSession = asyncHandler(async (req, res) => {
  const session = await pauseRecordingSessionService({
    sessionId: req.params.sessionId,
    user: req.user,
  });

  await auditFromRequest(req, {
    action: 'recording.pause',
    resourceType: 'recording_session',
    resourceId: session.id,
    projectId: session.projectId,
  });

  res.json({ session });
});

const resumeRecordingSession = asyncHandler(async (req, res) => {
  const session = await resumeRecordingSessionService({
    sessionId: req.params.sessionId,
    user: req.user,
  });

  await auditFromRequest(req, {
    action: 'recording.resume',
    resourceType: 'recording_session',
    resourceId: session.id,
    projectId: session.projectId,
  });

  res.json({ session });
});

const stopRecordingSession = asyncHandler(async (req, res) => {
  const session = await stopRecordingSessionService({
    sessionId: req.params.sessionId,
    user: req.user,
  });

  await auditFromRequest(req, {
    action: 'recording.stop',
    resourceType: 'recording_session',
    resourceId: session.id,
    projectId: session.projectId,
    metadata: { eventCount: session.eventCount, status: session.status },
  });

  res.json({ session });
});

const getRecordingSession = asyncHandler(async (req, res) => {
  const session = await getRecordingSessionService({
    sessionId: req.params.sessionId,
    user: req.user,
  });
  res.json({ session });
});

const discardRecordingSession = asyncHandler(async (req, res) => {
  const session = await discardRecordingSessionService({
    sessionId: req.params.sessionId,
    user: req.user,
    reason: req.body?.reason || '',
  });

  await auditFromRequest(req, {
    action: 'recording.discard',
    resourceType: 'recording_session',
    resourceId: session.id,
    projectId: session.projectId,
  });

  res.json({ session });
});

const patchRecordingDraft = asyncHandler(async (req, res) => {
  const session = await patchRecordingDraftService({
    sessionId: req.params.sessionId,
    draftSteps: req.body.draftSteps,
    user: req.user,
  });

  await auditFromRequest(req, {
    action: 'recording.patch_draft',
    resourceType: 'recording_session',
    resourceId: session.id,
    projectId: session.projectId,
    metadata: { patchedStepCount: req.body.draftSteps.length },
  });

  res.json({ session });
});

const previewRecordingSession = asyncHandler(async (req, res) => {
  const result = await previewRecordingSessionService({
    sessionId: req.params.sessionId,
    user: req.user,
    baseUrl: req.body?.baseUrl,
    webId: req.body?.webId,
    userKey: req.body?.userKey,
    timeoutMs: req.body?.timeoutMs,
  });

  await auditFromRequest(req, {
    action: 'recording.preview',
    resourceType: 'recording_session',
    resourceId: result.sessionId,
    projectId: result.projectId,
    metadata: {
      dryRunId: result.dryRunId,
      previewStepsCount: result.previewStepsCount,
      status: result.status,
    },
  });

  res.json({ preview: result });
});

const mergeRecordingSession = asyncHandler(async (req, res) => {
  const result = await mergeRecordingSessionService({
    sessionId: req.params.sessionId,
    testCaseId: req.body?.testCaseId,
    user: req.user,
  });

  await auditFromRequest(req, {
    action: 'recording.merge',
    resourceType: 'recording_session',
    resourceId: String(result.session._id),
    projectId: String(result.session.project),
    metadata: {
      testCaseEntityId: result.session.mergedTestCaseEntityId,
      testCaseVersionId: String(result.session.mergedTestCaseVersionId),
      mergedStepsCount: result.mergedStepsCount,
    },
  });

  res.json({
    session: {
      id: String(result.session._id),
      status: result.session.status,
      mergedAt: result.session.mergedAt,
      mergedTestCaseEntityId: result.session.mergedTestCaseEntityId,
      mergedTestCaseVersionId: String(result.session.mergedTestCaseVersionId),
      draftSteps: result.session.draftSteps || [],
      intentBlocks: result.session.intentBlocks || [],
    },
    testCase: {
      id: String(result.testCase._id),
      entityId: String(result.testCase.entityId || result.testCase._id),
      versionNumber: result.testCase.versionNumber,
      automation: result.testCase.automation,
    },
    mergedStepsCount: result.mergedStepsCount,
  });
});

module.exports = {
  startRecordingSession,
  appendRecordingEvents,
  pauseRecordingSession,
  resumeRecordingSession,
  stopRecordingSession,
  getRecordingSession,
  discardRecordingSession,
  patchRecordingDraft,
  previewRecordingSession,
  mergeRecordingSession,
};
