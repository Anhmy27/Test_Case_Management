const { DRAFT_REVIEW_STATUSES } = require('../../config/recordingConfig');
const { httpError } = require('../../utils/httpError');
const {
  getRecordingSessionForUser,
  serializeRecordingSession,
} = require('./recordingSessionService');

const PATCHABLE_SESSION_STATUS = 'ready_for_review';

const assertPatchableSessionStatus = (session) => {
  if (session.status === 'merged') {
    throw httpError(400, 'Cannot patch draft on a merged recording session');
  }

  if (session.status !== PATCHABLE_SESSION_STATUS) {
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

  const candidateCount = Array.isArray(draftStep.locatorCandidates)
    ? draftStep.locatorCandidates.length
    : 0;

  if (candidateCount === 0) {
    throw httpError(
      400,
      `Draft step ${draftStep.draftStepId} has no locator candidates to choose from`,
    );
  }

  if (chosenLocatorIndex >= candidateCount) {
    throw httpError(
      400,
      `chosenLocatorIndex out of range for draft step ${draftStep.draftStepId}`,
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

module.exports = {
  PATCHABLE_SESSION_STATUS,
  applyDraftStepPatch,
  applyDraftStepPatches,
  patchRecordingDraftService,
};
