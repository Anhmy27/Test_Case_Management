const crypto = require('crypto');
const mongoose = require('mongoose');
const Project = require('../../models/Project');
const RecordingSession = require('../../models/RecordingSession');
const { READY_FOR_REVIEW_STATUS } = require('../../config/recordingConfig');
const { httpError } = require('../../utils/httpError');
const { assertAllowedBaseUrl } = require('../../utils/automationUrlPolicy');
const { findProjectByReference } = require('../../utils/entityResolvers');
const { getRecordingArtifactService } = require('./recordingArtifactService');
const { persistIncomingEventArtifacts } = require('./recordingEventArtifacts');
const {
  appendEventsToSession,
  deleteSessionEvents,
  loadSessionEvents,
  replaceSessionEvents,
  toPlainEvent,
} = require('./recordingEventStore');
const { processRecordingEvents } = require('./recordingPipeline');

const LIVE_RECORDING_STATUSES = new Set(['recording', 'paused']);
const STOPPABLE_STATUSES = new Set(['starting', 'recording', 'paused']);
const PAUSABLE_STATUSES = new Set(['recording']);
const RESUMABLE_STATUSES = new Set(['paused']);

const resolveUserId = (user) => String(user?._id || user?.id || '');

const serializeRecordingSession = (session) => {
  const includeEmbeddedEvents = !session.eventsExternalized
    || !LIVE_RECORDING_STATUSES.has(session.status);

  return {
    id: String(session._id),
    projectId: String(session.project),
    testCaseEntityId: session.testCaseEntityId || '',
    baseUrl: session.baseUrl,
    status: session.status,
    errorMessage: session.errorMessage || '',
    eventCount: session.eventCount,
    eventsExternalized: session.eventsExternalized,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    events: includeEmbeddedEvents
      ? (session.events || []).map(toPlainEvent).filter(Boolean)
      : [],
    semanticActions: session.semanticActions || [],
    draftSteps: session.draftSteps || [],
    intentBlocks: session.intentBlocks || [],
  };
};

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

const prepareIncomingEvents = ({ sessionId, events, startSequence }) => {
  const artifactService = getRecordingArtifactService();
  const prepared = [];
  let nextSequence = startSequence;

  for (const event of events) {
    prepared.push(persistIncomingEventArtifacts({
      sessionId,
      event: {
        ...normalizeIncomingEvent(event, nextSequence),
        screenshotBase64: event.screenshotBase64,
        domHtml: event.domHtml,
      },
      artifactService,
    }));
    nextSequence += 1;
  }

  return prepared;
};

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

  if (!LIVE_RECORDING_STATUSES.has(session.status)) {
    throw httpError(400, `Cannot append events while session status is ${session.status}`);
  }

  const preparedEvents = prepareIncomingEvents({
    sessionId,
    events,
    startSequence: session.eventCount,
  });

  await appendEventsToSession(session, preparedEvents);
  if (session.status === 'paused') {
    session.markModified('events');
  } else {
    session.status = 'recording';
  }
  await session.save();

  return serializeRecordingSession(session);
};

const pauseRecordingSessionService = async ({ sessionId, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);

  if (!PAUSABLE_STATUSES.has(session.status)) {
    throw httpError(400, `Cannot pause session with status ${session.status}`);
  }

  session.status = 'paused';
  await session.save();

  return serializeRecordingSession(session);
};

const resumeRecordingSessionService = async ({ sessionId, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);

  if (!RESUMABLE_STATUSES.has(session.status)) {
    throw httpError(400, `Cannot resume session with status ${session.status}`);
  }

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
  session.errorMessage = '';
  await session.save();

  try {
    const rawEvents = await loadSessionEvents(session);
    const processed = processRecordingEvents({
      events: rawEvents,
      baseUrl: session.baseUrl,
    });

    await replaceSessionEvents(session, processed.events);
    session.semanticActions = processed.semanticActions;
    session.draftSteps = processed.draftSteps;
    session.intentBlocks = processed.intentBlocks;
    session.status = READY_FOR_REVIEW_STATUS;
    session.errorMessage = '';
    await session.save();

    return serializeRecordingSession(session);
  } catch (error) {
    session.status = 'failed';
    session.errorMessage = String(error?.message || 'Recording pipeline failed').slice(0, 2000);
    await session.save();
    throw httpError(500, session.errorMessage || 'Recording pipeline failed');
  }
};

const getRecordingSessionService = async ({ sessionId, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);
  return serializeRecordingSession(session);
};

const LIST_SESSIONS_DEFAULT_LIMIT = 30;
const LIST_SESSIONS_MAX_LIMIT = 100;

/**
 * Recent recording sessions of the current user for one project (all project versions),
 * without heavy event payloads. Discarded sessions are hidden.
 */
const listRecordingSessionsService = async ({ projectId, user, limit }) => {
  const project = await findProjectByReference(projectId);
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const userId = resolveUserId(user);
  if (!userId) {
    throw httpError(401, 'Authentication required');
  }

  const projectEntityId = project.entityId || project._id;
  const projectVersionIds = await Project.find({
    $or: [{ entityId: projectEntityId }, { _id: projectEntityId }],
  }).select('_id').lean();

  const normalizedLimit = Math.min(
    Math.max(Number(limit) || LIST_SESSIONS_DEFAULT_LIMIT, 1),
    LIST_SESSIONS_MAX_LIMIT,
  );

  const sessions = await RecordingSession.aggregate([
    {
      $match: {
        project: { $in: projectVersionIds.map((item) => item._id) },
        recordedBy: new mongoose.Types.ObjectId(userId),
        status: { $ne: 'discarded' },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: normalizedLimit },
    {
      $project: {
        project: 1,
        baseUrl: 1,
        status: 1,
        eventCount: 1,
        startedAt: 1,
        stoppedAt: 1,
        createdAt: 1,
        mergedAt: 1,
        mergedTestCaseEntityId: 1,
        testCaseEntityId: 1,
        draftStepCount: { $size: { $ifNull: ['$draftSteps', []] } },
      },
    },
  ]);

  return sessions.map((session) => ({
    id: String(session._id),
    projectId: String(session.project),
    baseUrl: session.baseUrl,
    status: session.status,
    eventCount: session.eventCount || 0,
    draftStepCount: session.draftStepCount || 0,
    startedAt: session.startedAt || null,
    stoppedAt: session.stoppedAt || null,
    createdAt: session.createdAt || null,
    mergedAt: session.mergedAt || null,
    mergedTestCaseEntityId: session.mergedTestCaseEntityId || '',
    testCaseEntityId: session.testCaseEntityId || '',
  }));
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

  await deleteSessionEvents(sessionId);
  getRecordingArtifactService().deleteSessionArtifacts(sessionId);

  return serializeRecordingSession(session);
};

module.exports = {
  startRecordingSessionService,
  appendRecordingEventsService,
  pauseRecordingSessionService,
  resumeRecordingSessionService,
  stopRecordingSessionService,
  getRecordingSessionService,
  listRecordingSessionsService,
  discardRecordingSessionService,
  getRecordingSessionForUser,
  serializeRecordingSession,
};
