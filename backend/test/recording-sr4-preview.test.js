const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertPreviewableSessionStatus,
  buildPreviewAutomationFromSession,
} = require('../src/services/recording/recordingPreviewService');
const { buildLocatorCandidates } = require('../src/services/recording/locatorScoring');

const buildReadySession = () => ({
  baseUrl: 'http://localhost:3000/login',
  draftSteps: [
    {
      draftStepId: 'draft-goto',
      order: 1,
      inferredAction: 'goto',
      targetType: 'url',
      target: 'http://localhost:3000/login',
      value: 'http://localhost:3000/login',
      reviewStatus: 'pending',
    },
    {
      draftStepId: 'draft-type',
      order: 2,
      inferredAction: 'type',
      targetType: 'label',
      target: 'Email',
      value: 'admin@test.com',
      locatorCandidates: buildLocatorCandidates({ label: 'Email' }),
      chosenLocatorIndex: 0,
      reviewStatus: 'pending',
    },
    {
      draftStepId: 'draft-drop',
      order: 3,
      inferredAction: 'click',
      targetType: 'css',
      target: '.noise',
      value: '',
      reviewStatus: 'rejected',
    },
  ],
});

test('SR-4.3 assertPreviewableSessionStatus rejects merged session', () => {
  assert.throws(
    () => assertPreviewableSessionStatus({ status: 'merged' }),
    (error) => error.statusCode === 400 && /merged/.test(error.message),
  );
});

test('SR-4.3 assertPreviewableSessionStatus rejects recording session', () => {
  assert.throws(
    () => assertPreviewableSessionStatus({ status: 'recording' }),
    (error) => error.statusCode === 400 && /Cannot preview session/.test(error.message),
  );
});

test('SR-4.3 buildPreviewAutomationFromSession maps draft steps like merge', () => {
  const automation = buildPreviewAutomationFromSession(buildReadySession(), {
    webId: 'demo-web',
    userKey: 'admin',
    timeoutMs: 45000,
  });

  assert.equal(automation.enabled, true);
  assert.equal(automation.runner, 'playwright');
  assert.equal(automation.baseUrl, 'http://localhost:3000/login');
  assert.equal(automation.webId, 'demo-web');
  assert.equal(automation.userKey, 'admin');
  assert.equal(automation.timeoutMs, 45000);
  assert.equal(automation.steps.length, 2);
  assert.equal(automation.steps[0].action, 'goto');
  assert.equal(automation.steps[1].action, 'type');
  assert.equal(automation.steps[1].value, 'admin@test.com');
});

test('SR-4.3 buildPreviewAutomationFromSession rejects when all draft steps rejected', () => {
  assert.throws(
    () => buildPreviewAutomationFromSession({
      baseUrl: 'http://localhost:3000',
      draftSteps: [{
        draftStepId: 'draft-drop',
        order: 1,
        inferredAction: 'click',
        reviewStatus: 'rejected',
      }],
    }),
    (error) => error.statusCode === 400 && /No draft steps available to preview/.test(error.message),
  );
});
