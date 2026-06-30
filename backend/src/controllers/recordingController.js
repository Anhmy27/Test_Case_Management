const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest } = require('../utils/auditFromRequest');
const {
  startRecordingSessionService,
  appendRecordingEventsService,
  stopRecordingSessionService,
  getRecordingSessionService,
  discardRecordingSessionService,
} = require('../services/recording/recordingSessionService');

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

module.exports = {
  startRecordingSession,
  appendRecordingEvents,
  stopRecordingSession,
  getRecordingSession,
  discardRecordingSession,
};
