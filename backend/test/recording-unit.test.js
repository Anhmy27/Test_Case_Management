const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  RECORDING_SESSION_RETENTION_MS,
  RECORDING_EVENT_EXTERNALIZE_THRESHOLDS,
} = require('../src/config/recordingConfig');
const RecordingSession = require('../src/models/RecordingSession');
const RecordingEvent = require('../src/models/RecordingEvent');
const {
  processRecordingEvents,
  filterNoise,
  mergeTypingEvents,
} = require('../src/services/recording/recordingPipeline');
const {
  buildRecordingStepScreenshotKey,
  buildRecordingDomSnapshotKey,
  isRecordingArtifactKey,
  createRecordingArtifactService,
  resetRecordingArtifactServiceForTests,
} = require('../src/services/recording/recordingArtifactService');

const baseEvent = (overrides = {}) => ({
  eventId: overrides.eventId || `evt-${overrides.sequence ?? 0}`,
  sequence: overrides.sequence ?? 0,
  rawType: overrides.rawType || 'click',
  occurredAt: overrides.occurredAt || new Date('2026-06-29T10:00:00.000Z'),
  pageUrl: overrides.pageUrl || 'http://localhost:3000/login',
  payload: overrides.payload ?? {},
});

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 120000 },
  });
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  const { collections } = mongoose.connection;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
});

test('RecordingSession persists core fields with default expiry', async () => {
  const projectId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const before = Date.now();

  const session = await RecordingSession.create({
    project: projectId,
    recordedBy: userId,
    baseUrl: 'https://demo.example.com',
    status: 'recording',
    startedAt: new Date(),
  });

  assert.equal(session.status, 'recording');
  assert.equal(session.eventCount, 0);
  assert.ok(session.expiresAt instanceof Date);

  const retentionMs = session.expiresAt.getTime() - before;
  assert.ok(retentionMs >= RECORDING_SESSION_RETENTION_MS - 5000);
  assert.ok(retentionMs <= RECORDING_SESSION_RETENTION_MS + 5000);
});

test('RecordingSession stores embedded events and draft steps', async () => {
  const session = await RecordingSession.create({
    project: new mongoose.Types.ObjectId(),
    recordedBy: new mongoose.Types.ObjectId(),
    baseUrl: 'https://demo.example.com',
    status: 'ready_for_review',
    events: [
      {
        eventId: 'evt-1',
        sequence: 0,
        rawType: 'click',
        occurredAt: new Date('2026-06-29T10:00:00.000Z'),
        pageUrl: 'https://demo.example.com/login',
        payload: { tagName: 'button' },
      },
    ],
    semanticActions: [
      {
        semanticId: 'CLICK_LOGIN',
        label: 'Click login button',
        sourceEventIds: ['evt-1'],
      },
    ],
    draftSteps: [
      {
        draftStepId: 'draft-1',
        order: 1,
        inferredAction: 'click',
        targetType: 'testid',
        target: 'login-btn',
        reviewStatus: 'pending',
        locatorCandidates: [
          {
            strategy: 'testid',
            value: 'login-btn',
            score: 100,
            uniqueOnPage: true,
          },
        ],
      },
    ],
  });

  const loaded = await RecordingSession.findById(session._id).lean();
  assert.equal(loaded.events.length, 1);
  assert.equal(loaded.draftSteps[0].target, 'login-btn');
  assert.equal(loaded.eventCount, 1);
});

test('merged session clears expiresAt so TTL does not delete it', async () => {
  const session = await RecordingSession.create({
    project: new mongoose.Types.ObjectId(),
    recordedBy: new mongoose.Types.ObjectId(),
    baseUrl: 'https://demo.example.com',
    status: 'ready_for_review',
  });

  session.status = 'merged';
  session.mergedAt = new Date();
  await session.save();

  const loaded = await RecordingSession.findById(session._id).lean();
  assert.equal(loaded.expiresAt, null);
});

test('RecordingEvent links externalized events to a session', async () => {
  const session = await RecordingSession.create({
    project: new mongoose.Types.ObjectId(),
    recordedBy: new mongoose.Types.ObjectId(),
    baseUrl: 'https://demo.example.com',
    status: 'recording',
    eventsExternalized: true,
    eventCount: 1,
  });

  await RecordingEvent.create({
    session: session._id,
    sequence: 0,
    event: {
      eventId: 'evt-ext-1',
      sequence: 0,
      rawType: 'input',
      occurredAt: new Date(),
      pageUrl: 'https://demo.example.com/login',
      payload: { value: 'admin' },
    },
  });

  const external = await RecordingEvent.find({ session: session._id }).lean();
  assert.equal(external.length, 1);
});

test('recording config exposes externalize thresholds from roadmap', () => {
  assert.equal(RECORDING_EVENT_EXTERNALIZE_THRESHOLDS.maxEmbeddedEvents, 300);
});

test('buildRecordingStepScreenshotKey uses recording namespace separate from dry-run', () => {
  const sessionId = '6a4355684942db76a02faa27';
  assert.equal(
    buildRecordingStepScreenshotKey(sessionId, 'draft-1'),
    'recording/6a4355684942db76a02faa27/steps/draft-1.png',
  );
  assert.equal(isRecordingArtifactKey('dry-run/abc/failure.png'), false);
});

test('recording artifact service saves and deletes session files', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcm-recording-artifacts-'));
  const service = createRecordingArtifactService({ rootDir });
  const sessionId = '6a4355684942db76a02faa27';
  const screenshotKey = buildRecordingStepScreenshotKey(sessionId, 'draft-1');
  const domKey = buildRecordingDomSnapshotKey(sessionId, 'evt-1');

  service.saveBuffer(screenshotKey, Buffer.from('fake-png'));
  service.saveText(domKey, '<html><body>login</body></html>');
  assert.equal(service.exists(screenshotKey), true);

  service.deleteSessionArtifacts(sessionId);
  assert.equal(service.exists(screenshotKey), false);

  resetRecordingArtifactServiceForTests();
  fs.rmSync(rootDir, { recursive: true, force: true });
});

test('filterNoise drops flagged noise and duplicate rapid clicks', () => {
  const events = [
    baseEvent({ sequence: 0, rawType: 'click', payload: { testid: 'login-btn' } }),
    baseEvent({
      sequence: 1,
      rawType: 'click',
      occurredAt: new Date('2026-06-29T10:00:00.200Z'),
      payload: { testid: 'login-btn' },
    }),
    baseEvent({ sequence: 2, rawType: 'input', payload: { noise: true, value: 'x' } }),
  ];

  const filtered = filterNoise(events);
  assert.equal(filtered.length, 1);
});

test('mergeTypingEvents merges per-character input into one fill', () => {
  const events = [
    baseEvent({ sequence: 0, rawType: 'input', payload: { name: 'username', value: 'a' } }),
    baseEvent({
      sequence: 1,
      rawType: 'keypress',
      payload: { name: 'username', value: 'dmin' },
    }),
    baseEvent({ sequence: 2, rawType: 'click', payload: { testid: 'login-btn' } }),
  ];

  const merged = mergeTypingEvents(events);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].payload.value, 'admin');
});

test('processRecordingEvents builds semantic labels and draft steps', () => {
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/login',
    events: [
      baseEvent({ sequence: 0, rawType: 'input', payload: { name: 'username', value: 'a' } }),
      baseEvent({
        sequence: 1,
        rawType: 'input',
        payload: { name: 'username', value: 'dmin' },
      }),
      baseEvent({
        sequence: 2,
        rawType: 'click',
        payload: { testid: 'login-btn' },
      }),
    ],
  });

  assert.equal(result.semanticActions[0].semanticId, 'FILL_USERNAME');
  assert.equal(result.draftSteps[1].value, 'admin');
  assert.equal(result.draftSteps[2].target, 'login-btn');
});
