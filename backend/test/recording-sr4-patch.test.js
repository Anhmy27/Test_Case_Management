const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyDraftStepPatch,
  applyDraftStepPatches,
} = require('../src/services/recording/recordingDraftPatchService');
const { convertDraftStepsToAutomationSteps } = require('../src/services/recording/recordingMergeService');
const { buildLocatorCandidates } = require('../src/services/recording/locatorScoring');

const buildSampleDraftSteps = () => {
  const locatorCandidates = buildLocatorCandidates({
    testid: 'login-btn',
    role: 'button',
    roleName: 'Đăng nhập',
    selector: '.btn-login',
  });

  return [
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
      locatorCandidates,
      chosenLocatorIndex: 0,
      reviewStatus: 'pending',
    },
  ];
};

test('SR-4.2 applyDraftStepPatch updates value and marks step edited', () => {
  const draftStep = {
    draftStepId: 'draft-type',
    value: 'old-value',
    reviewStatus: 'pending',
  };

  applyDraftStepPatch(draftStep, { value: 'new-value@test.com' });

  assert.equal(draftStep.value, 'new-value@test.com');
  assert.equal(draftStep.reviewStatus, 'edited');
});

test('SR-4.2 applyDraftStepPatch respects explicit reviewStatus', () => {
  const draftStep = {
    draftStepId: 'draft-click',
    reviewStatus: 'pending',
    locatorCandidates: buildLocatorCandidates({ testid: 'login-btn' }),
    chosenLocatorIndex: 0,
  };

  applyDraftStepPatch(draftStep, { reviewStatus: 'rejected' });

  assert.equal(draftStep.reviewStatus, 'rejected');
});

test('SR-4.2 applyDraftStepPatch switches chosen locator candidate', () => {
  const draftStep = {
    draftStepId: 'draft-click',
    inferredAction: 'click',
    value: '',
    targetType: 'testid',
    target: 'login-btn',
    locatorCandidates: buildLocatorCandidates({
      testid: 'login-btn',
      role: 'button',
      roleName: 'Đăng nhập',
    }),
    chosenLocatorIndex: 0,
    reviewStatus: 'pending',
  };

  applyDraftStepPatch(draftStep, { chosenLocatorIndex: 1 });

  assert.equal(draftStep.chosenLocatorIndex, 1);
  assert.equal(draftStep.targetType, 'role');
  assert.equal(draftStep.target, 'button');
  assert.equal(draftStep.value, 'Đăng nhập');
  assert.equal(draftStep.reviewStatus, 'edited');
});

test('SR-4.2 applyDraftStepPatch rejects role locator for type action', () => {
  const draftStep = {
    draftStepId: 'draft-type',
    inferredAction: 'type',
    value: 'admin@test.com',
    targetType: 'label',
    target: 'Email',
    locatorCandidates: buildLocatorCandidates({
      label: 'Email',
      role: 'textbox',
      roleName: 'Email',
    }),
    chosenLocatorIndex: 0,
    reviewStatus: 'pending',
  };

  const roleIndex = draftStep.locatorCandidates.findIndex((c) => c.strategy === 'role');
  assert.ok(roleIndex >= 0);

  assert.throws(
    () => applyDraftStepPatch(draftStep, { chosenLocatorIndex: roleIndex }),
    (error) => error.statusCode === 400 && /incompatible with action type/.test(error.message),
  );
});

test('SR-4.2 applyDraftStepPatches rejects unknown draftStepId', () => {
  assert.throws(
    () => applyDraftStepPatches(buildSampleDraftSteps(), [{ draftStepId: 'missing', value: 'x' }]),
    (error) => error.statusCode === 404 && /Draft step not found/.test(error.message),
  );
});

test('SR-4.2 applyDraftStepPatches rejects duplicate draftStepId in payload', () => {
  assert.throws(
    () => applyDraftStepPatches(buildSampleDraftSteps(), [
      { draftStepId: 'draft-type', value: 'a' },
      { draftStepId: 'draft-type', value: 'b' },
    ]),
    (error) => error.statusCode === 400 && /Duplicate draftStepId/.test(error.message),
  );
});

test('SR-4.2 patched draft steps are reflected after merge conversion', () => {
  const draftSteps = buildSampleDraftSteps();

  applyDraftStepPatches(draftSteps, [
    { draftStepId: 'draft-type', value: 'patched-user@example.com' },
    { draftStepId: 'draft-click', chosenLocatorIndex: 1 },
    { draftStepId: 'draft-goto', reviewStatus: 'accepted' },
  ]);

  const mergedSteps = convertDraftStepsToAutomationSteps(draftSteps);

  assert.equal(mergedSteps.length, 3);
  assert.equal(mergedSteps[1].value, 'patched-user@example.com');
  assert.equal(mergedSteps[2].targetType, 'role');
  assert.equal(mergedSteps[2].target, 'button');
  assert.equal(mergedSteps[2].value, 'Đăng nhập');
});

test('SR-4.2 rejected draft step is excluded from merge conversion', () => {
  const draftSteps = buildSampleDraftSteps();

  applyDraftStepPatches(draftSteps, [
    { draftStepId: 'draft-click', reviewStatus: 'rejected' },
  ]);

  const mergedSteps = convertDraftStepsToAutomationSteps(draftSteps);

  assert.equal(mergedSteps.length, 2);
  assert.equal(mergedSteps[0].action, 'goto');
  assert.equal(mergedSteps[1].action, 'type');
});
