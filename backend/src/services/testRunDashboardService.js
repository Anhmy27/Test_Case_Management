/**
 * Test run dashboard and analytics service.
 * Contains reporting queries only — no run creation or result mutation.
 * Lifecycle operations (create, update, end) live in testRunLifecycleService.
 */

const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCase = require('../models/TestCase');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const {
  toObjectId,
  findTestPlanByReference,
} = require('../utils/entityResolvers');

// ---------------------------------------------------------------------------
// Empty payload shape (used on early exits)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

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
      projectRefs.flatMap((p) => [String(p._id), String(p.entityId || '')]).filter(Boolean),
    ));
    match.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
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
      versionRefs.flatMap((v) => [String(v._id), String(v.entityId || '')]).filter(Boolean),
    ));
    match.version = { $in: versionIds.map((v) => toObjectId(v, 'versionId')) };
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
  }, { totalRuns: 0, runningRuns: 0, totalCases: 0, pass: 0, fail: 0, blocked: 0, untested: 0 });

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

  const planFilter = resolvedProjectEntityId
    ? {
        project: {
          $in: (await Project.find({ entityId: resolvedProjectEntityId }).select('_id entityId').lean())
            .flatMap((p) => [p._id, p.entityId].filter(Boolean)),
        },
        deletedAt: null,
        $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      }
    : { deletedAt: null, $or: [{ isLatest: true }, { isLatest: { $exists: false } }] };

  const delayedTestPlans = await TestPlan.find(planFilter)
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

  const projectDocs = await Project.find(
    resolvedProjectEntityId
      ? { entityId: resolvedProjectEntityId, deletedAt: null }
      : { deletedAt: null },
  ).lean();

  const projectOverview = await Promise.all(projectDocs.map(async (project) => {
    const projectRefs = await Project.find({ entityId: project.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
    ));
    const latestVersion = await Version.findOne({ entityId: project.entityId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();

    const projectRuns = await TestRun.aggregate([
      { $match: { project: { $in: projectIds.map((v) => toObjectId(v, 'projectId')) } } },
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

    return {
      _id: String(project._id),
      name: project.name,
      code: project.code,
      latestVersion: latestVersion ? latestVersion.name : 'N/A',
      passCount,
      failCount,
      passRate: executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0,
      progress: totalTests > 0 ? Number(((executed / totalTests) * 100).toFixed(2)) : 0,
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

// ---------------------------------------------------------------------------
// Per-project dashboard
// ---------------------------------------------------------------------------

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
      { $match: { project: { $in: projectIds.map((v) => toObjectId(v, 'projectId')) } } },
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

    const lastUpdated = runs.length > 0
      ? runs.reduce((latest, run) =>
          run.updatedAt && (!latest || new Date(run.updatedAt) > new Date(latest)) ? run.updatedAt : latest,
        null)
      : project.updatedAt;

    return {
      _id: String(project._id),
      name: project.name,
      code: project.code,
      latestVersion: latestVersion ? latestVersion.name : 'N/A',
      passRate: executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0,
      totalTests,
      failCount,
      lastUpdated,
    };
  }));

  return { projects: projectStats };
};

// ---------------------------------------------------------------------------
// Per-version dashboard
// ---------------------------------------------------------------------------

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
    projectRefs.flatMap((p) => [String(p._id), String(p.entityId || '')]).filter(Boolean),
  ));

  const versions = await Version.find({
    project: { $in: projectIds.map((v) => toObjectId(v, 'projectId')) },
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();

  const versionStats = await Promise.all(versions.map(async (version) => {
    const versionRefs = await Version.find({ entityId: version.entityId }).select('_id entityId').lean();
    const versionIds = Array.from(new Set(
      versionRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
    ));

    const testPlans = await TestPlan.find({
      version: { $in: versionIds.map((v) => toObjectId(v, 'versionId')) },
    }).lean();

    const runs = await TestRun.aggregate([
      { $match: { version: { $in: versionIds.map((v) => toObjectId(v, 'versionId')) } } },
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

    return {
      _id: String(version._id),
      name: version.name,
      project: String(version.project),
      totalTestPlans: testPlans.length,
      totalTests,
      passCount,
      failCount,
      notRunCount,
      progress: totalTests > 0 ? Number((((totalTests - notRunCount) / totalTests) * 100).toFixed(2)) : 0,
      passRate: executed > 0 ? Number(((passCount / executed) * 100).toFixed(2)) : 0,
    };
  }));

  return { versions: versionStats };
};

// ---------------------------------------------------------------------------
// Test plan stats (list for a version)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test plan detail (history + insights)
// ---------------------------------------------------------------------------

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
      summary: { totalTests: 0, passCount: 0, failCount: 0, notRunCount: 0, passRate: 0, progress: 0 },
      runHistory: [],
      insights: { stillFailing: [], failedThenPassed: [], flakyTests: [], notRun: [] },
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
  const summary = { totalTests: 0, passCount: 0, failCount: 0, notRunCount: 0, passRate: 0, progress: 0 };

  if (latestRun) {
    summary.totalTests = latestRun.results.length;
    summary.passCount = latestRun.results.filter((r) => r.status === 'pass').length;
    summary.failCount = latestRun.results.filter((r) => r.status === 'fail').length;
    summary.notRunCount = latestRun.results.filter((r) => ['untested', 'skip'].includes(r.status)).length;
    const executed = summary.passCount + summary.failCount
      + latestRun.results.filter((r) => r.status === 'blocked').length;
    summary.passRate = executed > 0 ? Number(((summary.passCount / executed) * 100).toFixed(2)) : 0;
    summary.progress = summary.totalTests > 0 ? Number(((executed / summary.totalTests) * 100).toFixed(2)) : 0;
  }

  const testCaseExecutions = {};
  runs.forEach((run) => {
    run.results.forEach((result) => {
      const id = String(result.testCase);
      if (!testCaseExecutions[id]) testCaseExecutions[id] = [];
      testCaseExecutions[id].push(result.status);
    });
  });

  const testCasesWithItems = await TestPlan.findOne({ _id: testPlan._id })
    .populate('items.testCase', 'caseKey title priority')
    .populate('items.owner', 'name email')
    .populate('items.assignees', 'name email')
    .lean();

  const insights = { stillFailing: [], failedThenPassed: [], flakyTests: [], notRun: [] };
  const testCaseDetails = [];

  for (const item of testCasesWithItems.items || []) {
    const testCase = item.testCase;
    if (!testCase) continue;

    const testCaseId = String(testCase._id);
    const history = testCaseExecutions[testCaseId] || [];
    const currentStatus = history.length > 0 ? history[history.length - 1] : 'untested';
    const failCount = history.filter((s) => s === 'fail').length;

    const detail = {
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
    testCaseDetails.push(detail);

    if (currentStatus === 'fail') {
      insights.stillFailing.push(detail);
    } else if (currentStatus === 'pass' && failCount > 0) {
      const hasFailThenPass = history.some(
        (s, i) => s === 'fail' && i < history.length - 1 && history.slice(i + 1).includes('pass'),
      );
      if (hasFailThenPass) insights.failedThenPassed.push(detail);
    } else if (failCount >= 2 && currentStatus !== 'fail') {
      insights.flakyTests.push(detail);
    } else if (['untested', 'skip'].includes(currentStatus)) {
      insights.notRun.push(detail);
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

// ---------------------------------------------------------------------------
// Re-export lifecycle services so the controller doesn't need to change
// its import path (backward-compatible shim)
// ---------------------------------------------------------------------------

const {
  startTestRunService,
  applyAutomationResultsService,
  listTestRunsService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
} = require('./testRunLifecycleService');

module.exports = {
  // lifecycle (re-exported for controller compatibility)
  startTestRunService,
  applyAutomationResultsService,
  listTestRunsService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
  // dashboard
  getDashboardService,
  getProjectDashboardService,
  getVersionDashboardService,
  getTestPlanStatsService,
  getTestPlanDetailService,
};
