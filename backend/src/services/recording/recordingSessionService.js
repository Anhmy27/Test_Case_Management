const crypto = require('crypto');
const RecordingSession = require('../../models/RecordingSession');
const { httpError } = require('../../utils/httpError');
const { assertAllowedBaseUrl } = require('../../utils/automationUrlPolicy');
const { findProjectByReference } = require('../../utils/entityResolvers');
const {
  RECORDING_EVENT_EXTERNALIZE_THRESHOLDS,
} = require('../../config/recordingConfig');
const { getRecordingArtifactService } = require('./recordingArtifactService');
const { processRecordingEvents } = require('./recordingPipeline');

const APPEND_EVENT_STATUSES = new Set(['recording', 'paused']);
const STOPPABLE_STATUSES = new Set(['starting', 'recording', 'paused']);

const resolveUserId = (user) => String(user?._id || user?.id || '');

const serializeRecordingSession = (session) => ({
  id: String(session._id),
  projectId: String(session.project),
  testCaseEntityId: session.testCaseEntityId || '',
  baseUrl: session.baseUrl,
  status: session.status,
  eventCount: session.eventCount,
  eventsExternalized: session.eventsExternalized,
  startedAt: session.startedAt,
  stoppedAt: session.stoppedAt,
  expiresAt: session.expiresAt,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  events: session.events || [],
  semanticActions: session.semanticActions || [],
  draftSteps: session.draftSteps || [],
  intentBlocks: session.intentBlocks || [],
});

const getRecordingSessionForUser = async (sessionId, user) => {
  const session = await RecordingSession.findById(sessionId);
  if (!session) {
    throw httpError(404, 'Recording session not found');
  }

  const userId = resolveUserId(user);
  if (!userId || String(session.recordedBy) !== userId) {
    throw httpError(403, 'Not allowed to access this recording session');
  }

  return session;
};

const normalizeIncomingEvent = (event, sequence) => ({
  eventId: String(event.eventId || crypto.randomUUID()).trim(),
  sequence,
  rawType: event.rawType,
  occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
  pageUrl: String(event.pageUrl || '').trim(),
  payload: event.payload ?? null,
});

const startRecordingSessionService = async ({ projectId, baseUrl, testCaseEntityId, user }) => {
  const project = await findProjectByReference(projectId);
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const normalizedBaseUrl = assertAllowedBaseUrl(baseUrl);
  const userId = resolveUserId(user);
  if (!userId) {
    throw httpError(401, 'Authentication required');
  }

  const session = await RecordingSession.create({
    project: project._id,
    recordedBy: userId,
    baseUrl: normalizedBaseUrl,
    testCaseEntityId: String(testCaseEntityId || '').trim(),
    status: 'recording',
    startedAt: new Date(),
  });

  return serializeRecordingSession(session);
};

const appendRecordingEventsService = async ({ sessionId, events, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);

  if (!APPEND_EVENT_STATUSES.has(session.status)) {
    throw httpError(400, `Cannot append events while session status is ${session.status}`);
  }

  const normalizedEvents = [];
  let nextSequence = session.eventCount;

  for (const event of events) {
    normalizedEvents.push(normalizeIncomingEvent(event, nextSequence));
    nextSequence += 1;
  }

  if (
    !session.eventsExternalized
    && nextSequence > RECORDING_EVENT_EXTERNALIZE_THRESHOLDS.maxEmbeddedEvents
  ) {
    throw httpError(
      413,
      `Recording session cannot hold more than ${RECORDING_EVENT_EXTERNALIZE_THRESHOLDS.maxEmbeddedEvents} embedded events`,
    );
  }

  session.events.push(...normalizedEvents);
  session.status = 'recording';
  await session.save();

  return serializeRecordingSession(session);
};

const stopRecordingSessionService = async ({ sessionId, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);

  if (!STOPPABLE_STATUSES.has(session.status)) {
    throw httpError(400, `Cannot stop session with status ${session.status}`);
  }

  session.status = 'processing';
  session.stoppedAt = new Date();
  await session.save();

  const processed = processRecordingEvents({
    events: session.events.map((event) => (
      typeof event.toObject === 'function' ? event.toObject() : event
    )),
    baseUrl: session.baseUrl,
  });

  session.events = processed.events;
  session.semanticActions = processed.semanticActions;
  session.draftSteps = processed.draftSteps;
  session.status = 'ready_for_review';
  await session.save();

  return serializeRecordingSession(session);
};

const getRecordingSessionService = async ({ sessionId, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);
  return serializeRecordingSession(session);
};

const discardRecordingSessionService = async ({ sessionId, user, reason }) => {
  const session = await getRecordingSessionForUser(sessionId, user);

  if (session.status === 'merged') {
    throw httpError(400, 'Cannot discard a merged recording session');
  }

  session.status = 'discarded';
  session.discardReason = String(reason || '').trim();
  session.stoppedAt = session.stoppedAt || new Date();
  await session.save();

  getRecordingArtifactService().deleteSessionArtifacts(sessionId);

  return serializeRecordingSession(session);
};

module.exports = {
  startRecordingSessionService,
  appendRecordingEventsService,
  stopRecordingSessionService,
  getRecordingSessionService,
  discardRecordingSessionService,
};
