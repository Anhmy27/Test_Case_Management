const RecordingEvent = require('../../models/RecordingEvent');
const { RECORDING_EVENT_EXTERNALIZE_THRESHOLDS } = require('../../config/recordingConfig');

const toPlainEvent = (event) => {
  if (!event) return null;
  if (typeof event.toObject === 'function') {
    return event.toObject();
  }
  return { ...event };
};

const sortEventsBySequence = (events) =>
  [...events].sort((left, right) => left.sequence - right.sequence);

const insertExternalEvents = async (sessionId, events) => {
  if (!events.length) {
    return;
  }

  await RecordingEvent.insertMany(
    events.map((event) => ({
      session: sessionId,
      sequence: event.sequence,
      event,
    })),
  );
};

const loadSessionEvents = async (session) => {
  if (!session.eventsExternalized) {
    return sortEventsBySequence((session.events || []).map(toPlainEvent).filter(Boolean));
  }

  const rows = await RecordingEvent.find({ session: session._id })
    .sort({ sequence: 1 })
    .lean();

  return rows.map((row) => toPlainEvent(row.event)).filter(Boolean);
};

const estimateEmbeddedSessionBytes = (session, additionalEvents = []) => {
  const embeddedEvents = [
    ...(session.events || []).map(toPlainEvent).filter(Boolean),
    ...additionalEvents,
  ];
  const snapshot = {
    project: session.project,
    recordedBy: session.recordedBy,
    baseUrl: session.baseUrl,
    status: session.status,
    events: embeddedEvents,
    semanticActions: session.semanticActions || [],
    draftSteps: session.draftSteps || [],
    intentBlocks: session.intentBlocks || [],
    eventCount: embeddedEvents.length,
  };
  return Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
};

const shouldExternalizeSession = (session, additionalEvents = [], thresholds = RECORDING_EVENT_EXTERNALIZE_THRESHOLDS) => {
  if (session.eventsExternalized) {
    return false;
  }

  const embeddedCount = (session.events || []).length;
  const projectedCount = embeddedCount + additionalEvents.length;
  if (projectedCount > thresholds.maxEmbeddedEvents) {
    return true;
  }

  if (estimateEmbeddedSessionBytes(session, additionalEvents) > thresholds.maxDocumentBytes) {
    return true;
  }

  if (session.startedAt) {
    const elapsedMs = Date.now() - new Date(session.startedAt).getTime();
    if (elapsedMs > thresholds.maxContinuousRecordingMs) {
      return true;
    }
  }

  return false;
};

const externalizeSessionEvents = async (session) => {
  if (session.eventsExternalized) {
    return;
  }

  const events = sortEventsBySequence((session.events || []).map(toPlainEvent).filter(Boolean));
  await insertExternalEvents(session._id, events);

  session.events = [];
  session.eventsExternalized = true;
  session.eventCount = events.length;
};

const appendEventsToSession = async (session, normalizedEvents) => {
  if (!normalizedEvents.length) {
    return;
  }

  if (session.eventsExternalized) {
    await insertExternalEvents(session._id, normalizedEvents);
    session.eventCount = (session.eventCount || 0) + normalizedEvents.length;
    return;
  }

  session.events.push(...normalizedEvents);
  session.eventCount = session.events.length;

  if (shouldExternalizeSession(session)) {
    await externalizeSessionEvents(session);
  }
};

const replaceSessionEvents = async (session, events) => {
  const sortedEvents = sortEventsBySequence(events.map(toPlainEvent).filter(Boolean));
  await deleteSessionEvents(session._id);
  session.events = sortedEvents;
  session.eventsExternalized = false;
  session.eventCount = sortedEvents.length;
};

const deleteSessionEvents = async (sessionId) => {
  await RecordingEvent.deleteMany({ session: sessionId });
};

module.exports = {
  appendEventsToSession,
  deleteSessionEvents,
  externalizeSessionEvents,
  loadSessionEvents,
  replaceSessionEvents,
  shouldExternalizeSession,
  toPlainEvent,
};
