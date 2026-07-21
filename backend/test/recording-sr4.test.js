const test = require('node:test');
const assert = require('node:assert/strict');
const {
  convertDraftStepsToAutomationSteps,
} = require('../src/services/recording/recordingMergeService');
const { buildLocatorCandidates } = require('../src/services/recording/locatorScoring');

test('SR-4.1 convertDraftStepsToAutomationSteps maps chosen locator into automation steps', () => {
  const candidates = buildLocatorCandidates({
    testid: 'login-btn',
    role: 'button',
    roleName: 'Đăng nhập',
  });

  const steps = convertDraftStepsToAutomationSteps([
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
      draftStepId: 'draft-click',
      order: 3,
      inferredAction: 'click',
      targetType: 'testid',
      target: 'login-btn',
      value: '',
      locatorCandidates: candidates,
      chosenLocatorIndex: 1,
      reviewStatus: 'pending',
    },
    {
      draftStepId: 'draft-drop',
      order: 4,
      inferredAction: 'click',
      targetType: 'css',
      target: '.noise',
      value: '',
      reviewStatus: 'rejected',
    },
  ]);

  assert.equal(steps.length, 3);
  assert.equal(steps[0].action, 'goto');
  assert.equal(steps[0].targetType, 'url');
  assert.equal(steps[0].value, 'http://localhost:3000/login');
  assert.equal(steps[1].action, 'type');
  assert.equal(steps[1].targetType, 'label');
  assert.equal(steps[1].value, 'admin@test.com');
  assert.equal(steps[2].action, 'click');
  assert.equal(steps[2].targetType, 'role');
  assert.equal(steps[2].target, 'button');
  assert.equal(steps[2].value, 'Đăng nhập');
});

test('SR-4.1 convertDraftStepsToAutomationSteps returns empty array when all steps rejected', () => {
  const steps = convertDraftStepsToAutomationSteps([
    {
      draftStepId: 'draft-drop',
      order: 1,
      inferredAction: 'click',
      targetType: 'css',
      target: '.noise',
      value: '',
      reviewStatus: 'rejected',
    },
  ]);

  assert.deepEqual(steps, []);
});
