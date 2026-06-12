/**
 * Test run lifecycle service.
 * Handles all CRUD operations on TestRun documents:
 * creating runs, listing, updating individual results, and ending runs.
 * Dashboard/analytics queries live in testRunDashboardService.
 */

const XLSX = require('xlsx');
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
const { assertAllowedBaseUrl } = require('../utils/automationUrlPolicy');

const withAutomationActive = (testRun) => {
  if (!testRun) {
    return testRun;
  }

  const runId = String(testRun._id || testRun.id || '');
  return {
    ...testRun,
    automationActive: runId ? isAutomationRunActive(runId) : false,
  };
};
const {
  isAutomationEnabledCase,
  loadTestCaseMapForResults,
  getAutomationResultIds,
  runHasAutomationCases,
  isAutomationRunResult,
} = require('../utils/runAutomationPartition');

const isValidHttpUrl = (value) => {
  try {
    assertAllowedBaseUrl(value);
    return true;
  } catch {
    return false;
  }
};

// NOTE: Formula must stay in sync with summarizeRunResults() in frontendnext/lib/api.ts.
// Both compute { pass, fail, blocked, skip, untested, done, progress, passRate } from the same algorithm.
const computeRunProgress = (results) => {
  const items = Array.isArray(results) ? results : [];
  const summary = {
    total: items.length,
    pass: 0,
    fail: 0,
    blocked: 0,
    skip: 0,
    untested: 0,
    done: 0,
    progress: 0,
    passRate: 0,
  };

  for (const item of items) {
    const status = String(item?.status || 'untested').toLowerCase();
    if (status === 'pass') summary.pass += 1;
    else if (status === 'fail') summary.fail += 1;
    else if (status === 'blocked') summary.blocked += 1;
    else if (status === 'skip') summary.skip += 1;
    else summary.untested += 1;
  }

  summary.done = summary.pass + summary.fail + summary.blocked + summary.skip;
  summary.progress = summary.total > 0
    ? Number(((summary.done / summary.total) * 100).toFixed(2))
    : 0;

  const verdictCount = summary.pass + summary.fail + summary.blocked;
  summary.passRate = verdictCount > 0
    ? Number(((summary.pass / verdictCount) * 100).toFixed(2))
    : 0;

  return summary;
};

// ---------------------------------------------------------------------------
// Start run
// ---------------------------------------------------------------------------

const normalizeRunName = (value) => String(value || '').trim();

const resultHasUserAssignment = (result, userId) => {
  const normalizedUserId = String(userId || '');
  const ownerId = String(result?.owner || '');
  const assigneeIds = Array.isArray(result?.assignees)
    ? result.assignees.map((assignee) => String(assignee || ''))
    : [];
  return ownerId === normalizedUserId || assigneeIds.includes(normalizedUserId);
};

const startTestRunService = async ({ testPlanId, name, baseUrl, user }) => {
  const trimmedName = normalizeRunName(name);

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

  if (!Array.isArray(resolvedTestPlan.items) || resolvedTestPlan.items.length === 0) {
    throw httpError(400, 'Plan has no test cases');
  }

  const testPlanEntityId = resolvedTestPlan.entityId || resolvedTestPlan._id;
  const relatedPlanIds = await getTestPlanVersionIds(resolvedTestPlan);
  const existingRun = await TestRun.findOne({
    name: trimmedName,
    $or: [
      { testPlanEntityId },
      { testPlan: { $in: relatedPlanIds } },
    ],
  })
    .collation({ locale: 'en', strength: 2 })
    .lean();
  if (existingRun) {
    throw httpError(409, 'Run name already exists in this plan');
  }

  const latestTestCases = await Promise.all(
    resolvedTestPlan.items.map((item) => findLatestTestCaseByReference(item.testCase)),
  );
  const missingIndex = latestTestCases.findIndex((tc) => !tc);
  if (missingIndex !== -1) {
    throw httpError(404, 'A test case in this test plan could not be resolved to the latest version');
  }

  if (latestTestCases.some((testCase) => isAutomationEnabledCase(testCase)) && !isValidHttpUrl(baseUrl)) {
    throw httpError(400, 'Base URL is invalid');
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
    name: trimmedName,
    project: resolvedProject._id,
    version: resolvedVersion._id,
    testPlan: resolvedTestPlan._id,
    testPlanEntityId,
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
  const testCaseMap = new Map(latestTestCases.map((testCase) => [String(testCase._id), testCase]));
  const automationResultIds = getAutomationResultIds(testRun.results, testCaseMap);

  if (automationResultIds.length > 0) {
    scheduleAutomationRun({
      testRunId: testRun._id,
      baseUrl: baseUrl || '',
      executedBy: user.id,
      resultIds: automationResultIds,
    });

    return {
      testRun: withAutomationActive(runPayload),
      automationQueued: true,
      automationCaseCount: automationResultIds.length,
      manualCaseCount: testRun.results.length - automationResultIds.length,
    };
  }

  return { testRun: withAutomationActive(runPayload) };
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

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) throw httpError(404, 'Test run not found');

  const testPlan = await findTestPlanByReference(testRun.testPlan);
  if (!testPlan) throw httpError(404, 'Test plan not found');

  const testCaseMap = await loadTestCaseMapForResults(testRun.results);
  if (!runHasAutomationCases(testRun.results, testCaseMap)) {
    throw httpError(400, 'Test run has no automation-enabled cases');
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
  if (user.role !== 'admin') {
    const userObjectId = toObjectId(user.id, 'userId');
    query.$or = [
      { startedBy: userObjectId },
      { 'results.owner': userObjectId },
      { 'results.assignees': userObjectId },
      { 'results.tester': userObjectId },
    ];
  }

  const testRuns = await TestRun.find(query)
    .sort({ createdAt: -1 })
    .populate('startedBy', 'name email role')
    .populate('endedBy', 'name email role')
    .lean();

  const testRunsWithProgress = [];
  for (const testRun of testRuns) {
    const withPlan = await attachRunTestPlan(testRun);
    const withAll = await attachRunProjectAndVersion(withPlan);
    const progressSummary = computeRunProgress(testRun.results);

    testRunsWithProgress.push(withAutomationActive({
      ...withAll,
      progress: progressSummary.progress,
      passRate: progressSummary.passRate,
      totalResults: progressSummary.total,
      executedResults: progressSummary.done,
      doneResults: progressSummary.done,
      untestedResults: progressSummary.untested,
    }));
  }

  return { testRuns: testRunsWithProgress };
};

// ---------------------------------------------------------------------------
// My run items
// ---------------------------------------------------------------------------

const getMyRunItemsService = async (runId, user) => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'))
    .populate('startedBy', 'name email role')
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
    testRun: withAutomationActive({
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
          }
        : testRun.testPlan || null,
    }),
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

  const result = testRun.results.id(resultId);
  if (!result) throw httpError(404, 'Run result not found');

  const testCaseMap = await loadTestCaseMapForResults(testRun.results);
  if (isAutomationRunResult(result, testCaseMap)) {
    throw httpError(403, 'Automation-enabled cases cannot be updated manually');
  }

  const isStarter = String(testRun.startedBy) === user.id;
  const isAdmin = user.role === 'admin';
  const isAssigned = resultHasUserAssignment(result, user.id);
  if (!isStarter && !isAdmin && !isAssigned) {
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
  const hasAssignedItems = Array.isArray(testRun.results)
    && testRun.results.some((result) => resultHasUserAssignment(result, user.id));
  if (!isStarter && !isAdmin && !hasAssignedItems) {
    throw httpError(403, 'You do not have permission to end this test run');
  }
  if (testRun.status === 'completed') {
    throw httpError(409, 'Test run already completed');
  }

  if (isAutomationRunActive(runId)) {
    throw httpError(409, 'Automation is still running. Cancel automation before ending the run.');
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

  const testCaseMap = await loadTestCaseMapForResults(testRun.results);
  if (!runHasAutomationCases(testRun.results, testCaseMap)) {
    throw httpError(400, 'Test run has no automation-enabled cases');
  }

  if (!isAutomationRunActive(runId)) {
    throw httpError(400, 'No automation job is currently running for this test run');
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

  const testCaseMap = await loadTestCaseMapForResults(testRun.results);
  if (!runHasAutomationCases(testRun.results, testCaseMap)) {
    throw httpError(400, 'Test run has no automation-enabled cases');
  }

  assertAutomationRunPermission(testRun, user);

  if (isAutomationRunActive(runId)) {
    throw httpError(409, 'Automation is already running for this test run');
  }

  const failedResults = testRun.results.filter(
    (result) => result.status === 'fail' && isAutomationRunResult(result, testCaseMap),
  );
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
  const runPayload = withAutomationActive(
    await attachRunProjectAndVersion(await attachRunTestPlan(populatedRun)),
  );

  return {
    testRun: runPayload,
    automationQueued: true,
    retryCount: resultIds.length,
  };
};

const formatUserLabel = (userRef) => {
  if (!userRef) {
    return '';
  }

  if (typeof userRef === 'object') {
    return String(userRef.name || userRef.email || '');
  }

  return String(userRef);
};

const exportTestRunService = async (runId, { format = 'xlsx' } = {}, user) => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'))
    .populate('startedBy', 'name email')
    .populate('endedBy', 'name email')
    .populate('results.testCase', 'caseKey title key name')
    .populate('results.tester', 'name email')
    .lean();

  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const isAdmin = user.role === 'admin';
  const isStarter = String(testRun.startedBy?._id || testRun.startedBy) === user.id;
  const hasAssignedItems = Array.isArray(testRun.results)
    && testRun.results.some((result) => resultHasUserAssignment(result, user.id));
  if (!isAdmin && !isStarter && !hasAssignedItems) {
    throw httpError(403, 'You do not have permission to export this test run');
  }

  const [project, version, plan] = await Promise.all([
    findProjectByReference(testRun.project),
    findVersionByReference(testRun.version),
    findTestPlanByReference(testRun.testPlan),
  ]);

  const normalizedFormat = String(format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  const runLabel = String(testRun.name || 'test-run').replace(/[^\w.-]+/g, '_').slice(0, 80);
  const filename = `${runLabel}-results.${normalizedFormat}`;

  const rows = (testRun.results || []).map((result, index) => {
    const testCase = result.testCase || {};
    return {
      '#': index + 1,
      'Case Key': testCase.caseKey || testCase.key || '',
      Title: testCase.title || testCase.name || '',
      Status: result.status || 'untested',
      'Actual Result': result.note || '',
      Notes: result.notes || '',
      Tester: formatUserLabel(result.tester),
      'Executed At': result.executedAt ? new Date(result.executedAt).toISOString() : '',
    };
  });

  const metaRows = [
    { Field: 'Run Name', Value: testRun.name || '' },
    { Field: 'Project', Value: project?.name || '' },
    { Field: 'Version', Value: version?.name || '' },
    { Field: 'Test Plan', Value: plan?.name || '' },
    { Field: 'Status', Value: testRun.status || '' },
    { Field: 'Started By', Value: formatUserLabel(testRun.startedBy) },
    { Field: 'Started At', Value: testRun.startedAt ? new Date(testRun.startedAt).toISOString() : '' },
    { Field: 'Ended At', Value: testRun.endedAt ? new Date(testRun.endedAt).toISOString() : '' },
  ];

  const resultsSheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No results' }]);

  if (normalizedFormat === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(resultsSheet);
    return {
      filename,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(`\uFEFF${csv}`, 'utf8'),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(metaRows), 'Run Info');
  XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Results');

  return {
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
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
  exportTestRunService,
};
