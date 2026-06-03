const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCase = require('../models/TestCase');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const User = require('../models/User');
const { executeAutomationRun } = require('./playwrightAutomationService');
const { httpError } = require('../utils/httpError');

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `${fieldName} is invalid`);
  }

  return new mongoose.Types.ObjectId(id);
};

const isPlanAssignedToUser = (testPlan, userId) => {
  const getUserId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) return String(value._id || value.id || '');
    return String(value);
  };

  const ownerMatch = getUserId(testPlan.owner) === userId;
  const assigneeMatch = Array.isArray(testPlan.assignees)
    && testPlan.assignees.some((assignee) => getUserId(assignee) === userId);
  return ownerMatch || assigneeMatch;
};

const findTestPlanByReference = async (testPlanRef) => {
  if (!testPlanRef) return null;
  const objectId = toObjectId(testPlanRef, 'testPlanId');
  return TestPlan.findOne({
    $and: [
      { $or: [{ entityId: objectId }, { _id: objectId }] },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  }).lean();
};

const getTestPlanVersionIds = async (testPlan) => {
  if (!testPlan) return [];
  const planEntityId = testPlan.entityId || testPlan._id;
  const versionIds = await TestPlan.distinct('_id', { entityId: planEntityId, deletedAt: null });
  if (versionIds.length > 0) return versionIds;
  return testPlan._id ? [testPlan._id] : [];
};

const findLatestTestCaseByReference = async (testCaseRef) => {
  if (!testCaseRef) return null;
  const objectId = toObjectId(testCaseRef, 'testCaseId');
  const referencedCase = await TestCase.findOne({ $or: [{ _id: objectId }, { entityId: objectId }] }).lean();
  if (!referencedCase) return null;
  const entityId = referencedCase.entityId || referencedCase._id;
  const latestCase = await TestCase.findOne({
    entityId,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();
  return latestCase || referencedCase;
};

const findProjectByReference = async (projectRef) => {
  if (!projectRef) return null;
  const objectId = toObjectId(projectRef, 'projectId');
  return Project.findOne({
    $and: [
      { $or: [{ entityId: objectId }, { _id: objectId }] },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  }).lean();
};

const findVersionByReference = async (versionRef) => {
  if (!versionRef) return null;
  const objectId = toObjectId(versionRef, 'versionId');
  return Version.findOne({
    $and: [
      { $or: [{ entityId: objectId }, { _id: objectId }] },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  }).lean();
};

const attachRunTestPlan = async (testRun) => {
  const resolvedPlan = await findTestPlanByReference(testRun?.testPlan);
  return {
    ...testRun,
    testPlan: resolvedPlan
      ? {
          _id: resolvedPlan._id,
          entityId: resolvedPlan.entityId,
          name: resolvedPlan.name,
          executionMode: resolvedPlan.executionMode,
        }
      : testRun?.testPlan || null,
  };
};

const attachRunProjectAndVersion = async (testRun) => {
  const [project, version] = await Promise.all([
    findProjectByReference(testRun?.project),
    findVersionByReference(testRun?.version),
  ]);

  return {
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
      : testRun?.project || null,
    version: version
      ? {
          _id: version._id,
          entityId: version.entityId,
          name: version.name,
          idjira: version.idjira,
        }
      : testRun?.version || null,
  };
};

const emptyDashboardPayload = () => ({
  summary: {
    totalRuns: 0,
    runningRuns: 0,
    totalCases: 0,
    pass: 0,
    fail: 0,
    blocked: 0,
    untested: 0,
    executed: 0,
    passRate: 0,
    completionRate: 0,
  },
  runs: [],
  runningTestRuns: [],
  delayedTestPlans: [],
  mostFailedTestCases: [],
  testerActivity: [],
  projectOverview: [],
});

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
  if (!resolvedTestPlan) {
    throw httpError(404, 'Test plan not found');
  }

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
  const missingLatestCaseIndex = latestTestCases.findIndex((testCase) => !testCase);
  if (missingLatestCaseIndex !== -1) {
    throw httpError(404, 'A test case in this test plan could not be resolved to the latest version');
  }

  const latestGroups = await Promise.all(latestTestCases.map(async (tc) => {
    if (!tc || !tc.group) return null;
    const foundGroup = await TestCaseGroup.findOne({
      $and: [
        { $or: [{ _id: tc.group }, { entityId: tc.group }] },
        { deletedAt: null },
        { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      ],
    }).lean();
    return foundGroup || null;
  }));

  const results = resolvedTestPlan.items.map((item, index) => ({
    planItemId: item._id,
    testCase: latestTestCases[index]._id,
    group: latestGroups[index] ? latestGroups[index]._id : (latestTestCases[index] ? latestTestCases[index].group : null),
    owner: resolvedTestPlan.owner,
    assignees: resolvedTestPlan.assignees || [],
    tester: resolvedTestPlan.owner
      || (resolvedTestPlan.assignees && resolvedTestPlan.assignees.length > 0 ? resolvedTestPlan.assignees[0] : undefined),
    status: 'untested',
    note: '',
  }));

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
    results,
  });

  const populatedTestRun = await TestRun.findById(testRun._id).lean();
  const testRunPayload = await attachRunProjectAndVersion(await attachRunTestPlan(populatedTestRun));

  if (resolvedTestPlan.executionMode === 'automation') {
    const automationResult = await executeAutomationRun({
      testRunId: testRun._id,
      baseUrl: baseUrl || '',
      executedBy: user.id,
    });

    const populatedAutomationRun = await TestRun.findById(automationResult.testRun._id).lean();
    const automationRunPayload = await attachRunProjectAndVersion(await attachRunTestPlan(populatedAutomationRun));

    return {
      testRun: automationRunPayload,
      automationSummary: automationResult.summary,
      automationReport: automationResult.report,
    };
  }

  return { testRun: testRunPayload };
};

const applyAutomationResultsService = async ({
  runId, results, user, automationSecret,
}) => {
  if (!Array.isArray(results) || results.length === 0) {
    throw httpError(400, 'results[] is required');
  }

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) throw httpError(404, 'Test run not found');

  const parentPlan = await findTestPlanByReference(testRun.testPlan);
  if (parentPlan && parentPlan.executionMode === 'automation') {
    throw httpError(403, 'Manual updates are not allowed for automation test runs');
  }

  const testPlan = await findTestPlanByReference(testRun.testPlan);
  if (!testPlan) throw httpError(404, 'Test plan not found');
  if (testPlan.executionMode !== 'automation') {
    throw httpError(400, 'Test plan is not automation execution mode');
  }

  const allowedBySecret = process.env.AUTOMATION_SECRET && automationSecret === process.env.AUTOMATION_SECRET;
  const isAdmin = user && user.role === 'admin';
  if (!isAdmin && !allowedBySecret) {
    throw httpError(403, 'Not authorized to submit automation results');
  }

  for (const item of results) {
    const {
      planItemId, status, note, notes,
    } = item || {};
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
      projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
    ));
    query.project = { $in: projectIds.map((value) => toObjectId(value, 'projectId')) };
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
      versionRefs.flatMap((version) => [String(version._id), String(version.entityId || '')]).filter(Boolean),
    ));
    query.version = { $in: versionIds.map((value) => toObjectId(value, 'versionId')) };
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
    const withProjectVersion = await attachRunProjectAndVersion(withPlan);
    const results = Array.isArray(testRun.results) ? testRun.results : [];
    const total = results.length;
    const executed = results.filter((result) => !['untested', 'skip'].includes(result.status)).length;
    const passCount = results.filter((result) => result.status === 'pass').length;

    testRunsWithProgress.push({
      ...withProjectVersion,
      progress: total > 0 ? Number(((executed / total) * 100).toFixed(2)) : 0,
      passRate: executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0,
      totalResults: total,
      executedResults: executed,
    });
  }

  return { testRuns: testRunsWithProgress };
};

const getMyRunItemsService = async (runId, user) => {
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'))
    .populate('results.testCase', 'caseKey title description steps priority severity')
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
            idjira: version.idjira,
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

const getDashboardService = async ({ projectId, versionId }) => {
  const match = {};
  let resolvedProjectEntityId = null;

  if (projectId) {
    const projectDoc = await Project.findOne({
      entityId: toObjectId(projectId, 'projectId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!projectDoc) return emptyDashboardPayload();
    resolvedProjectEntityId = projectDoc.entityId;
    const projectRefs = await Project.find({ entityId: projectDoc.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
    ));
    match.project = { $in: projectIds.map((value) => toObjectId(value, 'projectId')) };
  }

  if (versionId) {
    const versionDoc = await Version.findOne({
      entityId: toObjectId(versionId, 'versionId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
    if (!versionDoc) return emptyDashboardPayload();
    const versionRefs = await Version.find({ entityId: versionDoc.entityId }).select('_id entityId').lean();
    const versionIds = Array.from(new Set(
      versionRefs.flatMap((version) => [String(version._id), String(version.entityId || '')]).filter(Boolean),
    ));
    match.version = { $in: versionIds.map((value) => toObjectId(value, 'versionId')) };
  }

  const runs = await TestRun.aggregate([
    { $match: match },
    {
      $project: {
        status: 1,
        total: { $size: '$results' },
        passCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'pass'] } } } },
        failCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'fail'] } } } },
        blockedCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'blocked'] } } } },
        untestedCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $in: ['$$r.status', ['untested', 'skip']] } } } },
      },
    },
  ]);

  const summary = runs.reduce((acc, run) => {
    acc.totalRuns += 1;
    acc.totalCases += run.total;
    acc.pass += run.passCount;
    acc.fail += run.failCount;
    acc.blocked += run.blockedCount;
    acc.untested += run.untestedCount;
    if (run.status === 'running') acc.runningRuns += 1;
    return acc;
  }, {
    totalRuns: 0, runningRuns: 0, totalCases: 0, pass: 0, fail: 0, blocked: 0, untested: 0,
  });
  summary.executed = summary.pass + summary.fail + summary.blocked;
  summary.passRate = summary.executed > 0 ? Number(((summary.pass / summary.executed) * 100).toFixed(2)) : 0;
  summary.completionRate = summary.totalCases > 0
    ? Number(((summary.executed / summary.totalCases) * 100).toFixed(2))
    : 0;

  const runningTestRuns = await TestRun.find({ ...match, status: 'running' })
    .sort({ startedAt: -1 })
    .populate('startedBy', 'name email role')
    .populate('testPlan', 'name')
    .lean();

  const delayedTestPlans = await TestPlan.find(resolvedProjectEntityId
    ? { project: { $in: (await Project.find({ entityId: resolvedProjectEntityId }).select('_id entityId').lean()).flatMap((project) => [project._id, project.entityId].filter(Boolean)) }, deletedAt: null, $or: [{ isLatest: true }, { isLatest: { $exists: false } }] }
    : { deletedAt: null, $or: [{ isLatest: true }, { isLatest: { $exists: false } }] })
    .populate('project', 'name code')
    .populate('version', 'name')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  const plansWithRuns = await TestRun.find({ ...match }).select('testPlan').lean();
  const startedPlanIds = new Set(plansWithRuns.map((run) => String(run.testPlan)));
  const delayedPlans = delayedTestPlans
    .filter((plan) => (Array.isArray(plan.assignees) && plan.assignees.length > 0) || plan.owner)
    .filter((plan) => !startedPlanIds.has(String(plan._id)))
    .slice(0, 8)
    .map((plan) => ({
      _id: String(plan._id),
      name: plan.name,
      project: plan.project,
      version: plan.version,
      owner: plan.owner,
      assignees: plan.assignees,
      createdAt: plan.createdAt,
    }));

  const failedCases = await TestRun.aggregate([
    { $match: match },
    { $unwind: '$results' },
    { $match: { 'results.status': 'fail' } },
    {
      $group: {
        _id: '$results.testCase',
        failCount: { $sum: 1 },
        lastRunAt: { $max: '$startedAt' },
        lastTesterId: { $last: '$results.tester' },
      },
    },
    { $sort: { failCount: -1, lastRunAt: -1 } },
    { $limit: 8 },
  ]);

  const failedCaseIds = failedCases.map((item) => item._id);
  const failedCaseDocs = await TestCase.find({ _id: { $in: failedCaseIds } }).select('caseKey title priority').lean();
  const failedCaseMap = new Map(failedCaseDocs.map((item) => [String(item._id), item]));
  const mostFailedTestCases = failedCases.map((item) => {
    const testCase = failedCaseMap.get(String(item._id));
    return {
      testCaseId: String(item._id),
      caseKey: testCase?.caseKey || '',
      title: testCase?.title || 'Unknown test case',
      priority: testCase?.priority || 'medium',
      failCount: item.failCount,
    };
  });

  const testerActivityAgg = await TestRun.aggregate([
    { $match: match },
    { $unwind: '$results' },
    {
      $group: {
        _id: '$results.tester',
        totalTests: { $sum: { $cond: [{ $ifNull: ['$results.tester', false] }, 1, 0] } },
        passCount: { $sum: { $cond: [{ $eq: ['$results.status', 'pass'] }, 1, 0] } },
        failCount: { $sum: { $cond: [{ $eq: ['$results.status', 'fail'] }, 1, 0] } },
        blockedCount: { $sum: { $cond: [{ $eq: ['$results.status', 'blocked'] }, 1, 0] } },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $sort: { totalTests: -1 } },
    { $limit: 8 },
  ]);

  const testerIds = testerActivityAgg.map((item) => item._id);
  const testerDocs = await User.find({ _id: { $in: testerIds } }).select('name email role').lean();
  const testerMap = new Map(testerDocs.map((item) => [String(item._id), item]));
  const testerActivity = testerActivityAgg.map((item) => {
    const tester = testerMap.get(String(item._id));
    return {
      testerId: String(item._id),
      name: tester?.name || 'Unknown',
      email: tester?.email || '',
      totalTests: item.totalTests,
      passCount: item.passCount,
      failCount: item.failCount,
      blockedCount: item.blockedCount,
    };
  });

  const projectDocs = await Project.find(resolvedProjectEntityId ? { entityId: resolvedProjectEntityId, deletedAt: null } : { deletedAt: null }).lean();
  const projectOverview = await Promise.all(projectDocs.map(async (project) => {
    const projectRefs = await Project.find({ entityId: project.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
    ));
    const latestVersion = await Version.findOne({ entityId: project.entityId, deletedAt: null }).sort({ createdAt: -1 }).lean();
    const projectRuns = await TestRun.aggregate([
      { $match: { project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) } } },
      {
        $project: {
          total: { $size: '$results' },
          passCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'pass'] } } } },
          failCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'fail'] } } } },
        },
      },
    ]);

    const totalTests = projectRuns.reduce((acc, run) => acc + run.total, 0);
    const passCount = projectRuns.reduce((acc, run) => acc + run.passCount, 0);
    const failCount = projectRuns.reduce((acc, run) => acc + run.failCount, 0);
    const executed = passCount + failCount;
    const passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;
    const progress = totalTests > 0 ? Number(((executed / totalTests) * 100).toFixed(2)) : 0;
    return {
      _id: String(project._id),
      name: project.name,
      code: project.code,
      latestVersion: latestVersion ? latestVersion.name : 'N/A',
      passCount,
      failCount,
      passRate,
      progress,
    };
  }));

  return {
    summary,
    runs,
    runningTestRuns,
    delayedTestPlans: delayedPlans,
    mostFailedTestCases,
    testerActivity,
    projectOverview,
  };
};

const getProjectDashboardService = async () => {
  const projects = await Project.find({
    status: 'active',
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  }).lean();

  const projectStats = await Promise.all(projects.map(async (project) => {
    const projectRefs = await Project.find({ entityId: project.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
    ));
    const latestVersion = await Version.findOne({ entityId: project.entityId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();

    const runs = await TestRun.aggregate([
      { $match: { project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) } } },
      {
        $project: {
          total: { $size: '$results' },
          passCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'pass'] } } } },
          failCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'fail'] } } } },
          updatedAt: 1,
        },
      },
    ]);

    const totalTests = runs.reduce((acc, run) => acc + run.total, 0);
    const passCount = runs.reduce((acc, run) => acc + run.passCount, 0);
    const failCount = runs.reduce((acc, run) => acc + run.failCount, 0);
    const executed = passCount + failCount;
    const passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;

    const lastUpdated = runs.length > 0
      ? runs.reduce((latest, run) => (run.updatedAt && (!latest || new Date(run.updatedAt) > new Date(latest)) ? run.updatedAt : latest), null)
      : project.updatedAt;

    return {
      _id: String(project._id),
      name: project.name,
      code: project.code,
      latestVersion: latestVersion ? latestVersion.name : 'N/A',
      passRate,
      totalTests,
      failCount,
      lastUpdated,
    };
  }));

  return { projects: projectStats };
};

const getVersionDashboardService = async ({ projectId }) => {
  if (!projectId) throw httpError(400, 'projectId is required');

  const projectDoc = await Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!projectDoc) return { versions: [] };

  const projectRefs = await Project.find({ entityId: projectDoc.entityId }).select('_id entityId').lean();
  const projectIds = Array.from(new Set(
    projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
  ));

  const versions = await Version.find({ project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) }, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean();

  const versionStats = await Promise.all(versions.map(async (version) => {
    const versionRefs = await Version.find({ entityId: version.entityId }).select('_id entityId').lean();
    const versionIds = Array.from(new Set(
      versionRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
    ));

    const testPlans = await TestPlan.find({ version: { $in: versionIds.map((value) => toObjectId(value, 'versionId')) } }).lean();
    const totalTestPlans = testPlans.length;

    const runs = await TestRun.aggregate([
      { $match: { version: { $in: versionIds.map((value) => toObjectId(value, 'versionId')) } } },
      {
        $project: {
          total: { $size: '$results' },
          passCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'pass'] } } } },
          failCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'fail'] } } } },
          notRunCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $in: ['$$r.status', ['untested', 'skip']] } } } },
        },
      },
    ]);

    const totalTests = runs.reduce((acc, run) => acc + run.total, 0);
    const passCount = runs.reduce((acc, run) => acc + run.passCount, 0);
    const failCount = runs.reduce((acc, run) => acc + run.failCount, 0);
    const notRunCount = runs.reduce((acc, run) => acc + run.notRunCount, 0);
    const executed = passCount + failCount;
    const passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;
    const progress = totalTests > 0 ? Number((((totalTests - notRunCount) / totalTests) * 100).toFixed(2)) : 0;

    return {
      _id: String(version._id),
      name: version.name,
      project: String(version.project),
      totalTestPlans,
      totalTests,
      passCount,
      failCount,
      notRunCount,
      progress,
      passRate,
    };
  }));

  return { versions: versionStats };
};

const getTestPlanStatsService = async ({ versionId }) => {
  if (!versionId) throw httpError(400, 'versionId is required');
  const versionDoc = await Version.findOne({
    entityId: toObjectId(versionId, 'versionId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!versionDoc) return { testPlans: [] };

  const testPlans = await TestPlan.find({
    version: versionDoc._id,
    deletedAt: null,
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
  })
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  const testPlanStats = await Promise.all(testPlans.map(async (testPlan) => {
    const runs = await TestRun.find({ testPlan: testPlan._id }).sort({ createdAt: -1 }).lean();
    const latestRun = runs[0];
    let progress = 0;
    let passRate = 0;
    let lastRunTime;

    if (latestRun) {
      const total = latestRun.results.length;
      const passCount = latestRun.results.filter((r) => r.status === 'pass').length;
      const executed = latestRun.results.filter((r) => !['untested', 'skip'].includes(r.status)).length;
      progress = total > 0 ? Number(((executed / total) * 100).toFixed(2)) : 0;
      passRate = executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0;
      lastRunTime = latestRun.startedAt;
    }

    return {
      _id: String(testPlan._id),
      name: testPlan.name,
      owner: testPlan.owner,
      assignees: testPlan.assignees,
      progress,
      passRate,
      lastRunTime,
      status: latestRun ? latestRun.status : 'not_started',
    };
  }));

  return { testPlans: testPlanStats };
};

const getTestPlanDetailService = async (testPlanId) => {
  const testPlan = await TestPlan.findOne({ entityId: toObjectId(testPlanId, 'testPlanId') })
    .populate('project', 'name code')
    .populate('version', 'name')
    .lean();

  if (!testPlan) {
    return {
      testPlanId: null,
      testPlanName: null,
      version: null,
      project: null,
      summary: {
        totalTests: 0, passCount: 0, failCount: 0, notRunCount: 0, passRate: 0, progress: 0,
      },
      runHistory: [],
      insights: {
        stillFailing: [], failedThenPassed: [], flakyTests: [], notRun: [],
      },
      testCases: [],
    };
  }

  const runs = await TestRun.find({ testPlan: testPlan._id })
    .sort({ createdAt: 1 })
    .populate('startedBy', 'name email')
    .populate('endedBy', 'name email')
    .populate('results.tester', 'name email')
    .lean();

  const runHistory = runs.map((run) => ({
    runId: String(run._id),
    runName: run.name,
    passCount: run.results.filter((r) => r.status === 'pass').length,
    failCount: run.results.filter((r) => r.status === 'fail').length,
    blockedCount: run.results.filter((r) => r.status === 'blocked').length,
    notRunCount: run.results.filter((r) => ['untested', 'skip'].includes(r.status)).length,
    executedAt: run.startedAt,
  }));

  const latestRun = runs[runs.length - 1];
  const summary = {
    totalTests: 0, passCount: 0, failCount: 0, notRunCount: 0, passRate: 0, progress: 0,
  };

  if (latestRun) {
    summary.totalTests = latestRun.results.length;
    summary.passCount = latestRun.results.filter((r) => r.status === 'pass').length;
    summary.failCount = latestRun.results.filter((r) => r.status === 'fail').length;
    summary.notRunCount = latestRun.results.filter((r) => ['untested', 'skip'].includes(r.status)).length;
    const executed = summary.passCount + summary.failCount + latestRun.results.filter((r) => r.status === 'blocked').length;
    summary.passRate = executed > 0 ? Number(((summary.passCount / executed) * 100).toFixed(2)) : 0;
    summary.progress = summary.totalTests > 0 ? Number(((executed / summary.totalTests) * 100).toFixed(2)) : 0;
  }

  const testCaseExecutions = {};
  runs.forEach((run) => {
    run.results.forEach((result) => {
      const testCaseId = String(result.testCase);
      if (!testCaseExecutions[testCaseId]) testCaseExecutions[testCaseId] = [];
      testCaseExecutions[testCaseId].push(result.status);
    });
  });

  const insights = {
    stillFailing: [], failedThenPassed: [], flakyTests: [], notRun: [],
  };
  const testCases = await TestPlan.findOne({ _id: testPlan._id })
    .populate('items.testCase', 'caseKey title priority')
    .populate('items.owner', 'name email')
    .populate('items.assignees', 'name email')
    .lean();

  const testCaseDetails = [];
  for (const item of testCases.items || []) {
    const testCase = item.testCase;
    if (!testCase) continue;

    const testCaseId = String(testCase._id);
    const history = testCaseExecutions[testCaseId] || [];
    const currentStatus = history.length > 0 ? history[history.length - 1] : 'untested';
    const failCount = history.filter((s) => s === 'fail').length;

    const testCaseDetail = {
      testCaseId,
      caseKey: testCase.caseKey,
      title: testCase.title,
      priority: testCase.priority || 'medium',
      currentStatus,
      failCount,
      executionHistory: history,
      lastTester: latestRun?.results.find((r) => String(r.testCase) === testCaseId)?.tester,
      lastRunTime: latestRun?.startedAt,
    };
    testCaseDetails.push(testCaseDetail);

    if (currentStatus === 'fail') {
      insights.stillFailing.push(testCaseDetail);
    } else if (currentStatus === 'pass' && failCount > 0) {
      const hasFailThenPass = history.some((s, i) => s === 'fail' && i < history.length - 1 && history.slice(i + 1).includes('pass'));
      if (hasFailThenPass) insights.failedThenPassed.push(testCaseDetail);
    } else if (failCount >= 2 && currentStatus !== 'fail') {
      insights.flakyTests.push(testCaseDetail);
    } else if (['untested', 'skip'].includes(currentStatus)) {
      insights.notRun.push(testCaseDetail);
    }
  }

  return {
    testPlanId: String(testPlan._id),
    testPlanName: testPlan.name,
    version: testPlan.version.name,
    project: testPlan.project.name,
    summary,
    runHistory,
    insights,
    testCases: testCaseDetails,
  };
};

module.exports = {
  startTestRunService,
  applyAutomationResultsService,
  listTestRunsService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
  getDashboardService,
  getProjectDashboardService,
  getVersionDashboardService,
  getTestPlanStatsService,
  getTestPlanDetailService,
};
