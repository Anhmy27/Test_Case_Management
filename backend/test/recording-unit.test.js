const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  RECORDING_SESSION_RETENTION_MS,
  RECORDING_EVENT_EXTERNALIZE_THRESHOLDS,
  RECORDED_EVENT_RAW_TYPES,
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
const {
  appendEventsToSession,
  externalizeSessionEvents,
  shouldExternalizeSession,
} = require('../src/services/recording/recordingEventStore');
const {
  decodeBase64Payload,
  persistIncomingEventArtifacts,
} = require('../src/services/recording/recordingEventArtifacts');
const { appendRecordingEventsBodySchema } = require('../src/validators/recordingSchemas');

const extensionRoot = path.resolve(__dirname, '../../recording-extension/lib');
const importExtensionModule = async (fileName) => import(pathToFileURL(path.join(extensionRoot, fileName)).href);

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

test('shouldExternalizeSession triggers when embedded event count exceeds threshold', () => {
  const session = {
    eventsExternalized: false,
    events: Array.from({ length: 300 }, (_, index) => baseEvent({ sequence: index })),
    startedAt: new Date(),
  };

  assert.equal(
    shouldExternalizeSession(session, [baseEvent({ sequence: 300 })], { maxEmbeddedEvents: 300, maxDocumentBytes: 99999999, maxContinuousRecordingMs: 99999999 }),
    true,
  );
});

test('externalizeSessionEvents moves embedded events to RecordingEvent collection', async () => {
  const session = await RecordingSession.create({
    project: new mongoose.Types.ObjectId(),
    recordedBy: new mongoose.Types.ObjectId(),
    baseUrl: 'https://demo.example.com',
    status: 'recording',
    events: [
      baseEvent({ eventId: 'evt-a', sequence: 0 }),
      baseEvent({ eventId: 'evt-b', sequence: 1, rawType: 'input', payload: { value: 'x' } }),
    ],
    eventCount: 2,
  });

  await externalizeSessionEvents(session);
  await session.save();

  const loaded = await RecordingSession.findById(session._id).lean();
  assert.equal(loaded.eventsExternalized, true);
  assert.equal(loaded.events.length, 0);
  assert.equal(loaded.eventCount, 2);

  const external = await RecordingEvent.find({ session: session._id }).sort({ sequence: 1 }).lean();
  assert.equal(external.length, 2);
  assert.equal(external[1].event.eventId, 'evt-b');
});

test('appendEventsToSession externalizes when threshold is exceeded', async () => {
  const session = await RecordingSession.create({
    project: new mongoose.Types.ObjectId(),
    recordedBy: new mongoose.Types.ObjectId(),
    baseUrl: 'https://demo.example.com',
    status: 'recording',
    startedAt: new Date(),
    events: Array.from({ length: 299 }, (_, index) => baseEvent({ sequence: index })),
    eventCount: 299,
  });

  await appendEventsToSession(session, [
    baseEvent({ eventId: 'evt-last-a', sequence: 299 }),
    baseEvent({ eventId: 'evt-last-b', sequence: 300 }),
  ]);
  await session.save();

  assert.equal(session.eventsExternalized, true);
  assert.equal(session.events.length, 0);
  assert.equal(session.eventCount, 301);

  const externalCount = await RecordingEvent.countDocuments({ session: session._id });
  assert.equal(externalCount, 301);
});

test('persistIncomingEventArtifacts stores screenshot and dom keys without inline blobs', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcm-recording-event-artifacts-'));
  const artifactService = createRecordingArtifactService({ rootDir });
  const sessionId = '6a4355684942db76a02faa27';
  const pngBuffer = Buffer.from('fake-png');
  const screenshotBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;

  const stored = persistIncomingEventArtifacts({
    sessionId,
    artifactService,
    event: {
      eventId: 'evt-shot-1',
      sequence: 0,
      rawType: 'click',
      occurredAt: new Date(),
      pageUrl: 'https://demo.example.com',
      payload: { testid: 'login-btn' },
      screenshotBase64,
      domHtml: '<html><body>login</body></html>',
    },
  });

  assert.ok(stored.payload.screenshotKey.includes('/steps/evt-shot-1.png'));
  assert.ok(stored.payload.domSnapshotKey.includes('/dom/evt-shot-1.html'));
  assert.equal(stored.payload.screenshotBase64, undefined);
  assert.equal(stored.payload.domHtml, undefined);
  assert.equal(artifactService.exists(stored.payload.screenshotKey), true);

  resetRecordingArtifactServiceForTests();
  fs.rmSync(rootDir, { recursive: true, force: true });
});

test('decodeBase64Payload supports data URLs and raw base64', () => {
  const raw = decodeBase64Payload(Buffer.from('abc').toString('base64'));
  assert.equal(raw.buffer.toString(), 'abc');

  const dataUrl = decodeBase64Payload('data:image/jpeg;base64,YWJj');
  assert.equal(dataUrl.extension, 'jpg');
  assert.equal(dataUrl.buffer.toString(), 'abc');
});

test('processRecordingEvents copies screenshotKey into draft steps', () => {
  const screenshotKey = 'recording/6a4355684942db76a02faa27/steps/evt-1.png';
  const result = processRecordingEvents({
    baseUrl: 'http://localhost:3000/login',
    events: [
      baseEvent({
        sequence: 0,
        rawType: 'click',
        payload: { testid: 'login-btn', screenshotKey },
      }),
    ],
  });

  assert.equal(result.draftSteps[1].screenshotKey, screenshotKey);
});

test('extension buildRecordedEvent matches backend append schema', async () => {
  const { buildRecordedEvent } = await importExtensionModule('buildRecordedEvent.js');

  const event = buildRecordedEvent({
    rawType: 'click',
    pageUrl: 'http://localhost:3000/login',
    payload: {
      testid: 'login-btn',
      tagName: 'button',
      text: 'Đăng nhập',
    },
  });

  appendRecordingEventsBodySchema.parse({ events: [event] });
  assert.equal(event.payload.testid, 'login-btn');
});

test('extension elementPayloadFromDescriptor keeps locator fields', async () => {
  const { elementPayloadFromDescriptor } = await importExtensionModule('elementPayloadFromDescriptor.js');

  const payload = elementPayloadFromDescriptor({
    tagName: 'button',
    testid: 'login-btn',
    role: 'button',
    roleName: 'Đăng nhập',
  });

  assert.equal(payload.testid, 'login-btn');
  assert.match(payload.selector, /data-testid="login-btn"/);
});

test('extension raw event types match backend config', async () => {
  const { RECORDED_EVENT_RAW_TYPES: extensionTypes } = await importExtensionModule('recordedEventConstants.js');
  assert.deepEqual(extensionTypes, RECORDED_EVENT_RAW_TYPES);
});

test('extension chunkEvents splits batches for API append limit', async () => {
  const { chunkEvents } = await importExtensionModule('eventBatcher.js');
  const events = Array.from({ length: 205 }, (_, index) => ({ n: index }));
  const chunks = chunkEvents(events, 100);

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 100);
  assert.equal(chunks[1].length, 100);
  assert.equal(chunks[2].length, 5);
});

test('extension normalizeRecordingConfig trims and applies defaults', async () => {
  const {
    DEFAULT_TEST_BASE_URL,
    getDefaultRecordingConfig,
    normalizeRecordingConfig,
  } = await importExtensionModule('extensionConfig.js');

  const defaults = getDefaultRecordingConfig();
  assert.equal(defaults.baseUrl, DEFAULT_TEST_BASE_URL);

  const normalized = normalizeRecordingConfig({
    apiBaseUrl: 'http://localhost:5000/',
    projectId: '  proj ',
    baseUrl: '',
  });

  assert.equal(normalized.apiBaseUrl, 'http://localhost:5000');
  assert.equal(normalized.projectId, 'proj');
  assert.equal(normalized.baseUrl, DEFAULT_TEST_BASE_URL);

  const { normalizeApiBaseUrl } = await importExtensionModule('extensionConfig.js');
  assert.equal(normalizeApiBaseUrl('http://localhost:5000/'), 'http://localhost:5000');
});
