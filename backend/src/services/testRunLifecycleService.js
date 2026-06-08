/**
 * Test run lifecycle service.
 * Handles all CRUD operations on TestRun documents:
 * creating runs, listing, updating individual results, and ending runs.
 * Dashboard/analytics queries live in testRunDashboardService.
 */

const Project = require('../models/Project');
const Version = require('../models/Version');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const TestCaseGroup = require('../models/TestCaseGroup');
const { httpError } = require('../utils/httpError');
const {
  toObjectId,
  isPlanAssignedToUser,
  resolvePlanItemAssignment,
  findTestPlanByReference,
  getTestPlanVersionIds,
  findLatestTestCaseByReference,
  findProjectByReference,
  findVersionByReference,
  attachRunTestPlan,
  attachRunProjectAndVersion,
} = require('../utils/entityResolvers');
const { scheduleAutomationRun, isAutomationRunActive } = require('./automation/automationJobRunner');

// ---------------------------------------------------------------------------
// Start run
// ---------------------------------------------------------------------------

const startTestRunService = async ({ testPlanId, name, baseUrl, user }) => {
  if (!testPlanId || !name) {
    throw httpError(400, 'testPlanId and name are required');
  }

  const resolvedTestPlan = await TestPlan.findOne({
    $and: [
      { $or: [{ entityId: toObjectId(testPlanId, 'testPlanId') }, { _id: toObjectId(testPlanId, 'testPlanId') }] },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  })
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  if (!resolvedTestPlan) throw httpError(404, 'Test plan not found');
  if (user.role !== 'admin' && !isPlanAssignedToUser(resolvedTestPlan, user.id)) {
    throw httpError(403, 'You are not assigned to this test plan');
  }

  const [resolvedProject, resolvedVersion] = await Promise.all([
    findProjectByReference(resolvedTestPlan.project),
    findVersionByReference(resolvedTestPlan.version),
  ]);
  if (!resolvedProject) throw httpError(404, 'Project not found');
  if (!resolvedVersion) throw httpError(404, 'Version not found');

  const relatedPlanIds = await getTestPlanVersionIds(resolvedTestPlan);
  const existingRun = await TestRun.findOne({
    testPlan: { $in: relatedPlanIds },
    name: name.trim(),
  }).lean();
  if (existingRun) {
    throw httpError(409, `A test run with name "${name}" already exists for this test plan`);
  }

  const latestTestCases = await Promise.all(
    resolvedTestPlan.items.map((item) => findLatestTestCaseByReference(item.testCase)),
  );
  const missingIndex = latestTestCases.findIndex((tc) => !tc);
  if (missingIndex !== -1) {
    throw httpError(404, 'A test case in this test plan could not be resolved to the latest version');
  }

  const latestGroups = await Promise.all(latestTestCases.map(async (tc) => {
    if (!tc || !tc.group) return null;
    return TestCaseGroup.findOne({
      $and: [
        { $or: [{ _id: tc.group }, { entityId: tc.group }] },
        { deletedAt: null },
        { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      ],
    }).lean();
  }));

  const results = resolvedTestPlan.items.map((item, index) => {
    const assignment = resolvePlanItemAssignment(item, resolvedTestPlan);
    return {
      planItemId: item._id,
      testCase: latestTestCases[index]._id,
      group: latestGroups[index]?._id || latestTestCases[index]?.group || null,
      owner: assignment.owner,
      assignees: assignment.assignees,
      tester: assignment.tester,
      status: 'untested',
      note: '',
    };
  });

  const ownerSnapshot = resolvedTestPlan.owner
    ? {
        _id: resolvedTestPlan.owner._id,
        name: resolvedTestPlan.owner.name,
        email: resolvedTestPlan.owner.email,
        role: resolvedTestPlan.owner.role,
      }
    : null;

  const assigneeSnapshot = Array.isArray(resolvedTestPlan.assignees)
    ? resolvedTestPlan.assignees.map((member) => ({
        _id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
      }))
    : [];

  const testRun = await TestRun.create({
    name,
    project: resolvedProject._id,
    version: resolvedVersion._id,
    testPlan: resolvedTestPlan._id,
    status: 'running',
    startedAt: new Date(),
    startedBy: user.id,
    ownerSnapshot,
    assigneeSnapshot,
    automationBaseUrl: baseUrl || '',
    automationProgress: {
      totalCases: results.length,
      currentCaseIndex: 0,
      currentStepIndex: 0,
      currentStepTotal: 0,
      currentCaseKey: '',
      cancelRequested: false,
    },
    results,
  });

  const populatedRun = await TestRun.findById(testRun._id).lean();
  const runPayload = await attachRunProjectAndVersion(await attachRunTestPlan(populatedRun));

  if (resolvedTestPlan.executionMode === 'automation') {
    scheduleAutomationRun({
      testRunId: testRun._id,
      baseUrl: baseUrl || '',
      executedBy: user.id,
    });

    return {
      testRun: runPayload,
      automationQueued: true,
    };
  }

  return { testRun: runPayload };
};

// ---------------------------------------------------------------------------
// Apply external automation results (CI/CD webhook)
// ---------------------------------------------------------------------------

const applyAutomationResultsService = async ({
  runId, results, user, ingestSource,
}) => {
  if (!ingestSource) {
    throw httpError(403, 'Not authorized to submit automation results');
  }

  if (!Array.isArray(results) || results.length === 0) {
    throw httpError(400, 'results[] is required');
  }

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) throw httpError(404, 'Test run not found');

  const testPlan = await findTestPlanByReference(testRun.testPlan);
  if (!testPlan) throw httpError(404, 'Test plan not found');
  if (testPlan.executionMode !== 'automation') {
    throw httpError(400, 'Test plan is not automation execution mode');
  }

  const isAdmin = ingestSource === 'admin' && user && user.role === 'admin';

  for (const item of results) {
    const { planItemId, status, note, notes } = item || {};
    if (!planItemId || !['pass', 'fail', 'blocked', 'skip'].includes(status)) continue;

    const match = testRun.results.find((r) => String(r.planItemId) === String(planItemId));
    if (!match) continue;

    match.status = status;
    match.note = note || '';
    match.notes = notes || '';
    match.executedAt = new Date();
    match.tester = isAdmin ? user.id : null;
  }

  testRun.status = 'completed';
  testRun.endedAt = new Date();
  testRun.endedBy = isAdmin ? user.id : null;
  await testRun.save();
  return { testRun };
};

// ---------------------------------------------------------------------------
// List runs
// ---------------------------------------------------------------------------

const listTestRunsService = async ({ projectId, versionId, status }, user) => {
  const query = {};

  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) return { testRuns: [] };

    const projectRefs = await Project.find({ entityId: projectDoc.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((p) => [String(p._id), String(p.entityId || '')]).filter(Boolean),
    ));
    query.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
  }

  if (versionId) {
    const versionDoc = await Version.findOne({
      entityId: toObjectId(versionId, 'versionId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!versionDoc) return { testRuns: [] };

    const versionRefs = await Version.find({ entityId: versionDoc.entityId }).select('_id entityId').lean();
    const versionIds = Array.from(new Set(
      versionRefs.flatMap((v) => [String(v._id), String(v.entityId || '')]).filter(Boolean),
    ));
    query.version = { $in: versionIds.map((v) => toObjectId(v, 'versionId')) };
  }

  if (status) query.status = status;
  if (user.role !== 'admin') query.startedBy = toObjectId(user.id, 'userId');

  const testRuns = await TestRun.find(query)
    .sort({ createdAt: -1 })
    .populate('startedBy', 'name email role')
    .populate('endedBy', 'name email role')
    .lean();

  const testRunsWithProgress = [];
  for (const testRun of testRuns) {
    const withPlan = await attachRunTestPlan(testRun);
    const withAll = await attachRunProjectAndVersion(withPlan);
    const results = Array.isArray(testRun.results) ? testRun.results : [];
    const total = results.length;
    const executed = results.filter((r) => !['untested', 'skip'].includes(r.status)).length;
    const passCount = results.filter((r) => r.status === 'pass').length;

    testRunsWithProgress.push({
      ...withAll,
      progress: total > 0 ? Number(((executed / total) * 100).toFixed(2)) : 0,
      passRate: executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0,
      totalResults: total,
      executedResults: executed,
    });
  }

  return { testRuns: testRunsWithProgress };
};

// ---------------------------------------------------------------------------
// My run items
// ---------------------------------------------------------------------------

const getMyRunItemsService = async (runId, user) => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'))
    .populate('results.testCase', 'caseKey title description expected steps priority severity automation')
    .populate('results.owner', 'name email role')
    .populate('results.assignees', 'name email role')
    .populate('results.tester', 'name email role')
    .lean();

  if (!testRun) return { testRun: null, results: [] };

  const isAdmin = user.role === 'admin';
  const results = isAdmin
    ? testRun.results
    : testRun.results.filter((result) => {
        const ownerMatch = result.owner && String(result.owner._id) === user.id;
        const assigneeMatch = Array.isArray(result.assignees)
          && result.assignees.some((member) => String(member._id) === user.id);
        return ownerMatch || assigneeMatch;
      });

  const [project, version, plan] = await Promise.all([
    findProjectByReference(testRun.project),
    findVersionByReference(testRun.version),
    findTestPlanByReference(testRun.testPlan),
  ]);

  return {
    testRun: {
      ...testRun,
      project: project
        ? {
            _id: project._id,
            entityId: project.entityId,
            name: project.name,
            code: project.code,
            pid: project.pid,
            jiraProjectKey: project.jiraProjectKey,
            jiraProductKey: project.jiraProductKey,
          }
        : testRun.project || null,
      version: version
        ? {
            _id: version._id,
            entityId: version.entityId,
            name: version.name,
          }
        : testRun.version || null,
      testPlan: plan
        ? {
            _id: plan._id,
            entityId: plan.entityId,
            name: plan.name,
            executionMode: plan.executionMode,
          }
        : testRun.testPlan || null,
    },
    results,
  };
};

// ---------------------------------------------------------------------------
// Update single result
// ---------------------------------------------------------------------------

const updateRunResultService = async (runId, resultId, payload, user) => {
  const { status, note, notes } = payload || {};
  if (!['pass', 'fail', 'blocked', 'skip'].includes(status)) {
    throw httpError(400, 'status must be one of pass/fail/blocked/skip');
  }

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) throw httpError(404, 'Test run not found');
  if (testRun.status !== 'running') throw httpError(400, 'Only running test run can be updated');

  const parentPlan = await findTestPlanByReference(testRun.testPlan);
  if (parentPlan && parentPlan.executionMode === 'automation') {
    throw httpError(403, 'Automation run results cannot be updated manually');
  }

  const result = testRun.results.id(resultId);
  if (!result) throw httpError(404, 'Run result not found');

  const isStarter = String(testRun.startedBy) === user.id;
  const isAdmin = user.role === 'admin';
  if (!isStarter && !isAdmin) {
    throw httpError(403, 'You do not have permission to update this test run');
  }

  result.status = status;
  result.note = note || '';
  result.notes = notes || '';
  result.executedAt = new Date();
  result.tester = user.id;
  await testRun.save();
  return { testRun };
};

// ---------------------------------------------------------------------------
// End run
// ---------------------------------------------------------------------------

const endTestRunService = async (runId, user) => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) throw httpError(404, 'Test run not found');

  const isStarter = String(testRun.startedBy) === user.id;
  const isAdmin = user.role === 'admin';
  if (!isStarter && !isAdmin) {
    throw httpError(403, 'You do not have permission to end this test run');
  }
  if (testRun.status === 'completed') {
    throw httpError(409, 'Test run already completed');
  }

  const parentPlan = await findTestPlanByReference(testRun.testPlan);
  if (parentPlan && parentPlan.executionMode === 'automation') {
    throw httpError(403, 'Automation runs cannot be ended manually');
  }

  testRun.status = 'completed';
  testRun.endedAt = new Date();
  testRun.endedBy = user.id;
  await testRun.save();
  return { testRun };
};

// ---------------------------------------------------------------------------
// Cancel automation run
// ---------------------------------------------------------------------------

const assertAutomationRunPermission = (testRun, user) => {
  const isStarter = String(testRun.startedBy) === user.id;
  const isAdmin = user.role === 'admin';
  if (!isStarter && !isAdmin) {
    throw httpError(403, 'You do not have permission to control this automation run');
  }
};

const cancelAutomationRunService = async (runId, user) => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) throw httpError(404, 'Test run not found');
  if (testRun.status !== 'running') {
    throw httpError(400, 'Only running automation can be cancelled');
  }

  const parentPlan = await findTestPlanByReference(testRun.testPlan);
  if (!parentPlan || parentPlan.executionMode !== 'automation') {
    throw httpError(400, 'Test plan is not automation execution mode');
  }

  assertAutomationRunPermission(testRun, user);

  if (!testRun.automationProgress) {
    testRun.automationProgress = {};
  }
  testRun.automationProgress.cancelRequested = true;
  testRun.markModified('automationProgress');
  await testRun.save();

  return { testRun, cancelRequested: true };
};

// ---------------------------------------------------------------------------
// Retry failed automation cases
// ---------------------------------------------------------------------------

const retryFailedAutomationRunService = async (runId, user, baseUrl = '') => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) throw httpError(404, 'Test run not found');
  if (testRun.status !== 'completed') {
    throw httpError(400, 'Only completed runs can retry failed cases');
  }

  const parentPlan = await findTestPlanByReference(testRun.testPlan);
  if (!parentPlan || parentPlan.executionMode !== 'automation') {
    throw httpError(400, 'Test plan is not automation execution mode');
  }

  assertAutomationRunPermission(testRun, user);

  if (isAutomationRunActive(runId)) {
    throw httpError(409, 'Automation is already running for this test run');
  }

  const failedResults = testRun.results.filter((result) => result.status === 'fail');
  if (failedResults.length === 0) {
    throw httpError(400, 'No failed cases to retry');
  }

  const resultIds = failedResults.map((result) => String(result._id));

  for (const result of failedResults) {
    result.status = 'untested';
    result.note = '';
    result.notes = '';
    result.automationLogs = [];
    result.failureScreenshot = '';
    result.executedAt = null;
  }

  if (baseUrl) {
    testRun.automationBaseUrl = baseUrl;
  }

  testRun.status = 'running';
  testRun.endedAt = undefined;
  testRun.endedBy = undefined;
  testRun.automationProgress = {
    totalCases: resultIds.length,
    currentCaseIndex: 0,
    currentStepIndex: 0,
    currentStepTotal: 0,
    currentCaseKey: '',
    cancelRequested: false,
  };

  await testRun.save();

  const queued = scheduleAutomationRun({
    testRunId: testRun._id,
    baseUrl: baseUrl || testRun.automationBaseUrl || '',
    executedBy: user.id,
    resultIds,
  });

  if (!queued) {
    throw httpError(409, 'Automation retry could not be queued');
  }

  const populatedRun = await TestRun.findById(testRun._id).lean();
  const runPayload = await attachRunProjectAndVersion(await attachRunTestPlan(populatedRun));

  return {
    testRun: runPayload,
    automationQueued: true,
    retryCount: resultIds.length,
  };
};

module.exports = {
  startTestRunService,
  applyAutomationResultsService,
  listTestRunsService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
  cancelAutomationRunService,
  retryFailedAutomationRunService,
};
