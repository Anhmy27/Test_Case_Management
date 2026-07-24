const crypto = require('crypto');
const {
  DRAFT_REVIEW_STATUSES,
  READY_FOR_REVIEW_STATUS,
  LOCATOR_STRATEGIES,
} = require('../../config/recordingConfig');
const { httpError } = require('../../utils/httpError');
const {
  applyChosenLocatorToStepFields,
  filterCandidatesForAction,
} = require('./locatorScoring');
const {
  getRecordingSessionForUser,
  serializeRecordingSession,
} = require('./recordingSessionService');

const assertPatchableSessionStatus = (session) => {
  if (session.status === 'merged') {
    throw httpError(400, 'Cannot patch draft on a merged recording session');
  }

  if (session.status !== READY_FOR_REVIEW_STATUS) {
    throw httpError(400, `Cannot patch draft on session with status ${session.status}`);
  }
};

const assertValidReviewStatus = (reviewStatus) => {
  if (!DRAFT_REVIEW_STATUSES.includes(reviewStatus)) {
    throw httpError(400, `Invalid reviewStatus: ${reviewStatus}`);
  }
};

const assertValidChosenLocatorIndex = (draftStep, chosenLocatorIndex) => {
  if (!Number.isInteger(chosenLocatorIndex) || chosenLocatorIndex < 0) {
    throw httpError(400, `Invalid chosenLocatorIndex for draft step ${draftStep.draftStepId}`);
  }

  const candidates = Array.isArray(draftStep.locatorCandidates)
    ? draftStep.locatorCandidates
    : [];

  if (candidates.length === 0) {
    throw httpError(
      400,
      `Draft step ${draftStep.draftStepId} has no locator candidates to choose from`,
    );
  }

  if (chosenLocatorIndex >= candidates.length) {
    throw httpError(
      400,
      `chosenLocatorIndex out of range for draft step ${draftStep.draftStepId}`,
    );
  }

  const compatible = filterCandidatesForAction(candidates, draftStep.inferredAction);
  const chosen = candidates[chosenLocatorIndex];
  if (!compatible.includes(chosen)) {
    throw httpError(
      400,
      `chosenLocatorIndex is incompatible with action ${draftStep.inferredAction || '(empty)'} for draft step ${draftStep.draftStepId}`,
    );
  }
};

/**
 * Apply one patch object onto a draft step subdocument (mutates in place).
 * @returns {boolean} whether step content (not just reviewStatus) changed
 */
const applyDraftStepPatch = (draftStep, patch) => {
  let contentChanged = false;

  if (patch.value !== undefined) {
    draftStep.value = String(patch.value);
    contentChanged = true;
  }

  if (patch.expected !== undefined) {
    draftStep.expected = String(patch.expected);
    contentChanged = true;
  }

  if (patch.chosenLocatorIndex !== undefined) {
    assertValidChosenLocatorIndex(draftStep, patch.chosenLocatorIndex);
    draftStep.chosenLocatorIndex = patch.chosenLocatorIndex;
    const resolved = applyChosenLocatorToStepFields(draftStep);
    draftStep.targetType = resolved.targetType;
    draftStep.target = resolved.target;
    draftStep.value = resolved.value;
    draftStep.chosenLocatorIndex = resolved.chosenLocatorIndex;
    contentChanged = true;
  }

  if (patch.reviewStatus !== undefined) {
    assertValidReviewStatus(patch.reviewStatus);
    draftStep.reviewStatus = patch.reviewStatus;
  } else if (contentChanged) {
    draftStep.reviewStatus = 'edited';
  }

  return contentChanged;
};

const buildDraftStepIndex = (draftSteps = []) => {
  const index = new Map();
  for (const step of draftSteps) {
    if (step?.draftStepId) {
      index.set(String(step.draftStepId), step);
    }
  }
  return index;
};

const applyDraftStepPatches = (draftSteps = [], patches = []) => {
  const index = buildDraftStepIndex(draftSteps);
  const seenPatchIds = new Set();

  for (const patch of patches) {
    const draftStepId = String(patch.draftStepId || '').trim();
    if (!draftStepId) {
      throw httpError(400, 'draftStepId is required for each patch');
    }

    if (seenPatchIds.has(draftStepId)) {
      throw httpError(400, `Duplicate draftStepId in patch payload: ${draftStepId}`);
    }
    seenPatchIds.add(draftStepId);

    const draftStep = index.get(draftStepId);
    if (!draftStep) {
      throw httpError(404, `Draft step not found: ${draftStepId}`);
    }

    applyDraftStepPatch(draftStep, patch);
  }

  return draftSteps;
};

const patchRecordingDraftService = async ({ sessionId, draftSteps: patches, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);
  assertPatchableSessionStatus(session);

  applyDraftStepPatches(session.draftSteps, patches);
  session.markModified('draftSteps');
  await session.save();

  return serializeRecordingSession(session);
};

/**
 * Manual insert has no recorded DOM, so it carries no scored locatorCandidates. Without a
 * synthetic candidate, `applyChosenLocatorToStepFields` (SR-2) would fall back to an empty
 * css target on merge (locatorScoring.resolveChosenLocator with 0 candidates) and silently
 * drop whatever the tester typed. One candidate mirroring the typed targetType/target keeps
 * that value through merge, same as a recorded step would.
 */
const buildManualLocatorCandidate = (targetType, target, value) => {
  const strategy = String(targetType || '').trim().toLowerCase();
  const targetValue = String(target || '').trim();
  if (!strategy || !targetValue || !LOCATOR_STRATEGIES.includes(strategy)) {
    return [];
  }
  return [{
    strategy,
    value: targetValue,
    roleName: strategy === 'role' ? String(value || '').trim() : '',
    score: 100,
    uniqueOnPage: true,
  }];
};

/**
 * Insert one manually-authored draft step (mutates + returns `draftSteps`). Pulled out of
 * `insertDraftStepService` so it can be unit-tested without a DB-backed session, same split
 * as `applyDraftStepPatches` / `patchRecordingDraftService`.
 */
const insertDraftStep = (draftSteps = [], {
  insertAfterDraftStepId,
  inferredAction,
  targetType,
  target,
  value,
  expected,
} = {}) => {
  let insertIndex = draftSteps.length;
  const afterId = String(insertAfterDraftStepId || '').trim();
  if (afterId) {
    const afterIndex = draftSteps.findIndex((step) => String(step.draftStepId) === afterId);
    if (afterIndex === -1) {
      throw httpError(404, `Draft step not found: ${afterId}`);
    }
    insertIndex = afterIndex + 1;
  }

  const newStep = {
    draftStepId: crypto.randomUUID(),
    order: insertIndex + 1,
    inferredAction: String(inferredAction || '').trim(),
    targetType: String(targetType || '').trim(),
    target: String(target || '').trim(),
    value: String(value || '').trim(),
    expected: String(expected || '').trim(),
    locatorCandidates: buildManualLocatorCandidate(targetType, target, value),
    chosenLocatorIndex: 0,
    reviewStatus: 'edited',
    screenshotKey: '',
    autoWaitSuggestion: '',
    sourceSemanticId: 'MANUAL_STEP',
  };

  draftSteps.splice(insertIndex, 0, newStep);
  draftSteps.forEach((step, index) => {
    step.order = index + 1;
  });

  return draftSteps;
};

const insertDraftStepService = async ({ sessionId, user, ...stepFields }) => {
  const session = await getRecordingSessionForUser(sessionId, user);
  assertPatchableSessionStatus(session);

  insertDraftStep(session.draftSteps, stepFields);
  session.markModified('draftSteps');
  await session.save();

  return serializeRecordingSession(session);
};

module.exports = {
  applyDraftStepPatch,
  applyDraftStepPatches,
  patchRecordingDraftService,
  insertDraftStep,
  insertDraftStepService,
};
