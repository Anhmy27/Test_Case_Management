const TestCase = require('../../models/TestCase');
const { READY_FOR_REVIEW_STATUS } = require('../../config/recordingConfig');
const { httpError } = require('../../utils/httpError');
const { findLatestTestCaseByReference, findProjectByReference } = require('../../utils/entityResolvers');
const { updateVersionedDocument, normalizeAutomationSteps } = require('../shared/versioningCore');
const { applyChosenLocatorToStepFields } = require('./locatorScoring');
const { getRecordingSessionForUser } = require('./recordingSessionService');

const isRejectedDraftStep = (draftStep) => String(draftStep?.reviewStatus || '').trim() === 'rejected';

const convertDraftStepToAutomationStep = (draftStep, order) => {
  const action = String(draftStep.inferredAction || '').trim();
  const { targetType, target, value } = applyChosenLocatorToStepFields(draftStep);

  if (action === 'goto') {
    const url = value || target;
    return {
      stepId: String(draftStep.draftStepId || order),
      stepName: '',
      order,
      action: 'goto',
      targetType: 'url',
      target: url,
      value: url,
      expected: String(draftStep.expected || '').trim(),
    };
  }

  return {
    stepId: String(draftStep.draftStepId || order),
    stepName: '',
    order,
    action,
    targetType,
    target,
    value,
    expected: String(draftStep.expected || '').trim(),
  };
};

const convertDraftStepsToAutomationSteps = (draftSteps = []) => {
  const kept = (Array.isArray(draftSteps) ? draftSteps : [])
    .filter((step) => step && !isRejectedDraftStep(step))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

  return normalizeAutomationSteps(
    kept.map((draftStep, index) => convertDraftStepToAutomationStep(draftStep, index + 1)),
  );
};

const resolveMergeTestCaseRef = (session, testCaseId) => {
  const fromBody = String(testCaseId || '').trim();
  const fromSession = String(session.testCaseEntityId || '').trim();
  const resolved = fromBody || fromSession;
  if (!resolved) {
    throw httpError(400, 'testCaseId is required when the recording session has no testCaseEntityId');
  }
  return resolved;
};

const assertSameProject = async (session, testCase) => {
  const [sessionProject, testCaseProject] = await Promise.all([
    findProjectByReference(session.project),
    findProjectByReference(testCase.project),
  ]);

  if (!sessionProject || !testCaseProject) {
    throw httpError(404, 'Project not found');
  }

  if (String(sessionProject._id) !== String(testCaseProject._id)) {
    throw httpError(400, 'Test case project does not match recording session project');
  }
};

const mergeRecordingSessionService = async ({ sessionId, testCaseId, user }) => {
  const session = await getRecordingSessionForUser(sessionId, user);

  if (session.status === 'merged') {
    throw httpError(400, 'Recording session has already been merged');
  }

  if (session.status !== READY_FOR_REVIEW_STATUS) {
    throw httpError(400, `Cannot merge session with status ${session.status}`);
  }

  const testCaseRef = resolveMergeTestCaseRef(session, testCaseId);
  const latestTestCase = await findLatestTestCaseByReference(testCaseRef);
  if (!latestTestCase) {
    throw httpError(404, 'Test case not found');
  }

  await assertSameProject(session, latestTestCase);

  const mergedSteps = convertDraftStepsToAutomationSteps(session.draftSteps);
  if (mergedSteps.length === 0) {
    throw httpError(400, 'No draft steps available to merge');
  }

  const nextTestCase = await updateVersionedDocument(
    TestCase,
    latestTestCase.entityId || latestTestCase._id,
    async (current) => {
      const currentAutomation = current.automation || {};
      return {
        project: current.project,
        projectVersionId: current.projectVersionId,
        group: current.group,
        groupVersionId: current.groupVersionId,
        key: current.key,
        name: current.name,
        caseKey: current.caseKey,
        title: current.title,
        description: current.description,
        expected: current.expected,
        steps: current.steps,
        priority: current.priority,
        severity: current.severity,
        type: current.type,
        status: current.status,
        automation: {
          ...currentAutomation,
          enabled: true,
          runner: 'playwright',
          baseUrl: String(currentAutomation.baseUrl || session.baseUrl || '').trim(),
          steps: mergedSteps,
        },
        createdBy: current.createdBy,
      };
    },
  );

  session.status = 'merged';
  session.mergedAt = new Date();
  session.mergedTestCaseEntityId = String(nextTestCase.entityId || nextTestCase._id);
  session.mergedTestCaseVersionId = nextTestCase._id;
  session.expiresAt = null;
  if (!session.testCaseEntityId) {
    session.testCaseEntityId = session.mergedTestCaseEntityId;
  }
  await session.save();

  return {
    session,
    testCase: nextTestCase,
    mergedStepsCount: mergedSteps.length,
  };
};

module.exports = {
  convertDraftStepsToAutomationSteps,
  mergeRecordingSessionService,
};
