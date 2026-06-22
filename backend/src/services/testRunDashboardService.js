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
const {
  toObjectId,
  findProjectByReference,
  findVersionByReference,
  getTestPlanVersionIds,
  repointVersionReferences,
} = require('../utils/entityResolvers');

const activeLatestFilter = () => ({
  deletedAt: null,
  $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
});

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
    activeUsers: 0,
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

  const [startedByUsers, testerUsersAgg] = await Promise.all([
    TestRun.distinct('startedBy', match),
    TestRun.aggregate([
      { $match: match },
      { $unwind: '$results' },
      { $match: { 'results.tester': { $ne: null } } },
      { $group: { _id: '$results.tester' } },
    ]),
  ]);
  const activeUserIds = new Set([
    ...startedByUsers.map((id) => String(id)),
    ...testerUsersAgg.map((item) => String(item._id)),
  ]);
  summary.activeUsers = activeUserIds.size;

  const runningTestRunsRaw = await TestRun.find({ ...match, status: 'running' })
    .sort({ startedAt: -1 })
    .populate('startedBy', 'name email role')
    .populate('testPlan', 'name')
    .lean();
  const runningTestRuns = await Promise.all(
    runningTestRunsRaw.map(async (run) => {
      const resolvedProject = await findProjectByReference(run.project);
      return {
        ...run,
        project: resolvedProject
          ? {
              _id: String(resolvedProject._id),
              entityId: String(resolvedProject.entityId || resolvedProject._id),
              name: resolvedProject.name,
              code: resolvedProject.code,
            }
          : run.project,
      };
    }),
  );

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

  const plansWithRuns = await TestRun.find({ ...match }).select('testPlan testPlanEntityId').lean();
  const startedPlanEntityIds = new Set(
    plansWithRuns
      .map((run) => String(run.testPlanEntityId || ''))
      .filter(Boolean),
  );
  const runsMissingEntityId = plansWithRuns.filter(
    (run) => !run.testPlanEntityId && run.testPlan,
  );
  if (runsMissingEntityId.length > 0) {
    const testPlanIds = Array.from(
      new Set(runsMissingEntityId.map((run) => String(run.testPlan)).filter(Boolean)),
    ).map((value) => toObjectId(value, 'testPlanId'));
    const planRefs = await TestPlan.find({ _id: { $in: testPlanIds } })
      .select('_id entityId')
      .lean();
    planRefs.forEach((planRef) => {
      startedPlanEntityIds.add(String(planRef.entityId || planRef._id));
    });
  }
  const delayedPlans = delayedTestPlans
    .filter((plan) => (Array.isArray(plan.assignees) && plan.assignees.length > 0) || plan.owner)
    .filter((plan) => !startedPlanEntityIds.has(String(plan.entityId || plan._id)))
    .slice(0, 8)
    .map((plan) => ({
      _id: String(plan._id),
      entityId: String(plan.entityId || plan._id),
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
  const failedCaseDocs = await TestCase.find({ _id: { $in: failedCaseIds } })
    .select('caseKey title priority project')
    .lean();
  const failedCaseMap = new Map(failedCaseDocs.map((item) => [String(item._id), item]));
  const mostFailedTestCases = await Promise.all(failedCases.map(async (item) => {
    const testCase = failedCaseMap.get(String(item._id)) || null;
    const project = testCase?.project ? await findProjectByReference(testCase.project) : null;
    return {
      testCaseId: String(item._id),
      caseKey: testCase?.caseKey || '',
      title: testCase?.title || 'Unknown test case',
      priority: testCase?.priority || 'medium',
      failCount: item.failCount,
      project: project
        ? {
            _id: String(project._id),
            entityId: String(project.entityId || project._id),
            name: project.name,
            code: project.code,
          }
        : null,
    };
  }));

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
      ? {
          entityId: resolvedProjectEntityId,
          deletedAt: null,
          $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
        }
      : {
          deletedAt: null,
          $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
        },
  ).lean();

  const projectOverview = await Promise.all(projectDocs.map(async (project) => {
    const projectRefs = await Project.find({ entityId: project.entityId }).select('_id entityId').lean();
    const projectIds = Array.from(new Set(
      projectRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
    ));
    const projectObjectIds = projectIds.map((v) => toObjectId(v, 'projectId'));
    const latestVersion = await Version.findOne({
      $and: [
        {
          $or: [
            { project: { $in: projectObjectIds } },
            { projectVersionId: { $in: projectObjectIds } },
          ],
        },
        { deletedAt: null },
        { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
    const latestRunWithVersion = latestVersion
      ? null
      : await TestRun.findOne({ project: { $in: projectObjectIds } })
        .sort({ startedAt: -1 })
        .populate('version', 'name')
        .lean();

    const projectRunMatch = { project: { $in: projectObjectIds } };
    if (match.version) {
      projectRunMatch.version = match.version;
    }

    const projectRuns = await TestRun.aggregate([
      { $match: projectRunMatch },
      {
        $project: {
          total: { $size: '$results' },
          passCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'pass'] } } } },
          failCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'fail'] } } } },
          blockedCount: { $size: { $filter: { input: '$results', as: 'r', cond: { $eq: ['$$r.status', 'blocked'] } } } },
        },
      },
    ]);

    const totalTests = projectRuns.reduce((acc, run) => acc + run.total, 0);
    const passCount = projectRuns.reduce((acc, run) => acc + run.passCount, 0);
    const failCount = projectRuns.reduce((acc, run) => acc + run.failCount, 0);
    const blockedCount = projectRuns.reduce((acc, run) => acc + (run.blockedCount || 0), 0);
    const executed = passCount + failCount + blockedCount;

    return {
      _id: String(project._id),
      entityId: String(project.entityId || project._id),
      name: project.name,
      code: project.code,
      latestVersion: latestVersion?.name || latestRunWithVersion?.version?.name || 'N/A',
      totalTests,
      passCount,
      failCount,
      blockedCount,
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
    const projectObjectIds = projectIds.map((v) => toObjectId(v, 'projectId'));
    const latestVersion = await Version.findOne({
      $and: [
        {
          $or: [
            { project: { $in: projectObjectIds } },
            { projectVersionId: { $in: projectObjectIds } },
          ],
        },
        { deletedAt: null },
        { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
    const latestRunWithVersion = latestVersion
      ? null
      : await TestRun.findOne({ project: { $in: projectObjectIds } })
        .sort({ startedAt: -1 })
        .populate('version', 'name')
        .lean();

    const runs = await TestRun.aggregate([
      { $match: { project: { $in: projectObjectIds } } },
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
      entityId: String(project.entityId || project._id),
      name: project.name,
      code: project.code,
      latestVersion: latestVersion?.name || latestRunWithVersion?.version?.name || 'N/A',
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
    ...activeLatestFilter(),
  })
    .sort({ createdAt: -1 })
    .lean();

  await Promise.all(
    versions.map((version) => repointVersionReferences(version.entityId || version._id, version)),
  );

  const versionStats = await Promise.all(versions.map(async (version) => {
    const versionRefs = await Version.find({ entityId: version.entityId }).select('_id entityId').lean();
    const versionIds = Array.from(new Set(
      versionRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
    ));

    const testPlans = await TestPlan.find({
      version: { $in: versionIds.map((v) => toObjectId(v, 'versionId')) },
      ...activeLatestFilter(),
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
      entityId: String(version.entityId || version._id),
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
  const versionDoc = await Version.findOne({
    entityId: toObjectId(versionId, 'versionId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();
  if (!versionDoc) return { testPlans: [] };

  const versionRefs = await Version.find({ entityId: versionDoc.entityId }).select('_id entityId').lean();
  const versionIds = Array.from(new Set(
    versionRefs.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean),
  ));

  const testPlans = await TestPlan.find({
    version: { $in: versionIds.map((v) => toObjectId(v, 'versionId')) },
    ...activeLatestFilter(),
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
// Test plan detail (history + per-case run timeline)
// ---------------------------------------------------------------------------

const countResultStatuses = (results) => {
  const counts = { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  for (const result of (Array.isArray(results) ? results : [])) {
    const status = result?.status;
    if (status === 'pass') counts.pass += 1;
    else if (status === 'fail') counts.fail += 1;
    else if (status === 'blocked') counts.blocked += 1;
    else if (['untested', 'skip'].includes(status)) counts.notRun += 1;
  }
  return counts;
};

const buildCaseRunTimeline = (runs, caseEntityId, refToEntityId) => runs.map((run) => {
  const match = (run.results || []).find((result) => {
    const refStr = String(result.testCase || '');
    return (refToEntityId.get(refStr) || refStr) === caseEntityId;
  });
  return {
    runId: String(run._id),
    runName: run.name,
    status: match?.status || 'untested',
    tester: match?.tester || null,
    executedAt: run.startedAt,
  };
});

const getTestPlanDetailService = async (testPlanId) => {
  const planRef = toObjectId(testPlanId, 'testPlanId');
  let testPlan = await TestPlan.findOne({
    $and: [
      { $or: [{ entityId: planRef }, { _id: planRef }] },
      activeLatestFilter(),
    ],
  }).lean();

  if (!testPlan) {
    const snapshot = await TestPlan.findOne({
      deletedAt: null,
      $or: [{ entityId: planRef }, { _id: planRef }],
    }).lean();
    if (snapshot) {
      const entityId = snapshot.entityId || snapshot._id;
      testPlan = await TestPlan.findOne({
        $and: [
          { entityId },
          activeLatestFilter(),
        ],
      }).lean();
    }
  }

  if (!testPlan) {
    return {
      testPlanId: null,
      testPlanName: null,
      version: null,
      project: null,
      summary: { totalTests: 0, passCount: 0, failCount: 0, notRunCount: 0, passRate: 0, progress: 0 },
      runHistory: [],
      testCases: [],
    };
  }

  // --- 1. Resolve project / version names safely ---
  const [resolvedProject, resolvedVersion] = await Promise.all([
    findProjectByReference(testPlan.project),
    findVersionByReference(testPlan.version),
  ]);

  // --- 2. Fetch all runs across every version of this plan ---
  const planEntityId = testPlan.entityId || testPlan._id;
  const relatedPlanIds = await getTestPlanVersionIds(testPlan);

  const runs = await TestRun.find({
    $or: [
      { testPlan: { $in: relatedPlanIds } },
      { testPlanEntityId: planEntityId },
    ],
  })
    .sort({ createdAt: 1 })
    .populate('results.tester', 'name email')
    .lean();

  const runHistory = runs.map((run) => {
    const counts = countResultStatuses(run.results);
    return {
      runId: String(run._id),
      runName: run.name,
      passCount: counts.pass,
      failCount: counts.fail,
      blockedCount: counts.blocked,
      notRunCount: counts.notRun,
      executedAt: run.startedAt,
    };
  });

  // Summary uses the last run's current state
  const latestRun = runs[runs.length - 1];
  const summary = { totalTests: 0, passCount: 0, failCount: 0, notRunCount: 0, passRate: 0, progress: 0 };
  if (latestRun) {
    const results = latestRun.results || [];
    const counts = countResultStatuses(results);
    summary.totalTests = results.length;
    summary.passCount = counts.pass;
    summary.failCount = counts.fail;
    summary.notRunCount = counts.notRun;
    const executed = counts.pass + counts.fail + counts.blocked;
    summary.passRate = executed > 0 ? Number(((summary.passCount / executed) * 100).toFixed(2)) : 0;
    summary.progress = summary.totalTests > 0 ? Number(((executed / summary.totalTests) * 100).toFixed(2)) : 0;
  }

  // --- 3. Build execution history keyed by canonical entityId ---
  // run results store testCase._id at run-start time; map those back to entityId
  const allRunResultRefs = Array.from(new Set(
    runs.flatMap((run) => (run.results || []).map((r) => String(r.testCase || '')).filter(Boolean)),
  ));

  const resultRefObjectIds = allRunResultRefs.map((ref) => toObjectId(ref, 'testCaseId'));
  const resultRefDocs = resultRefObjectIds.length
    ? await TestCase.find({
        $or: [
          { _id: { $in: resultRefObjectIds } },
          { entityId: { $in: resultRefObjectIds } },
        ],
      }).select('_id entityId').lean()
    : [];

  // Map any ref string → canonical entityId string
  const refToEntityId = new Map();
  resultRefDocs.forEach((doc) => {
    const eid = String(doc.entityId || doc._id);
    refToEntityId.set(String(doc._id), eid);
    if (doc.entityId) refToEntityId.set(String(doc.entityId), eid);
  });

  // --- 4. Resolve plan items WITHOUT Mongoose populate ---
  const rawItems = testPlan.items || [];

  const itemCaseRefs = rawItems
    .map((item) => String(item.testCase || ''))
    .filter((ref) => ref && ref.length === 24);

  let caseRefDocs = [];
  if (itemCaseRefs.length) {
    const caseRefObjectIds = itemCaseRefs.map((ref) => toObjectId(ref, 'testCaseId'));
    caseRefDocs = await TestCase.find({
      $or: [
        { _id: { $in: caseRefObjectIds } },
        { entityId: { $in: caseRefObjectIds } },
      ],
    }).select('_id entityId').lean();
  }

  // Find latest version for each referenced entityId
  const refEntityIds = Array.from(new Set(
    caseRefDocs.map((doc) => String(doc.entityId || doc._id)),
  ));
  const latestCaseDocs = refEntityIds.length
    ? await TestCase.find({
        entityId: { $in: refEntityIds.map((id) => toObjectId(id, 'testCaseId')) },
        deletedAt: null,
        $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      }).select('_id entityId caseKey title priority').lean()
    : [];

  // Build maps: any ref string → latest TestCase doc
  const latestByEntityId = new Map(latestCaseDocs.map((doc) => [String(doc.entityId || doc._id), doc]));
  const refToLatestCase = new Map();
  caseRefDocs.forEach((doc) => {
    const eid = String(doc.entityId || doc._id);
    const latest = latestByEntityId.get(eid) || doc;
    refToLatestCase.set(String(doc._id), latest);
    if (doc.entityId) refToLatestCase.set(String(doc.entityId), latest);
  });

  // --- 5. Build per-case run timeline ---
  const testCases = [];
  const seenEids = new Set();

  for (const item of rawItems) {
    const ref = String(item.testCase || '');
    if (!ref) continue;

    const testCase = refToLatestCase.get(ref);
    if (!testCase) continue;

    const caseEntityId = String(testCase.entityId || testCase._id);
    if (seenEids.has(caseEntityId)) continue;
    seenEids.add(caseEntityId);

    const runTimeline = buildCaseRunTimeline(runs, caseEntityId, refToEntityId);
    const latestEntry = runTimeline[runTimeline.length - 1];

    testCases.push({
      testCaseId: caseEntityId,
      caseKey: testCase.caseKey,
      title: testCase.title,
      priority: testCase.priority || 'medium',
      latestStatus: latestEntry?.status || 'untested',
      latestRunId: latestEntry?.runId,
      latestRunName: latestEntry?.runName,
      runExecutionHistory: runTimeline,
    });
  }

  return {
    testPlanId: String(testPlan._id),
    testPlanName: testPlan.name,
    version: resolvedVersion?.name || 'Unknown version',
    project: resolvedProject?.name || 'Unknown project',
    projectId: resolvedProject?._id
      ? String(resolvedProject._id)
      : (testPlan.project ? String(testPlan.project) : null),
    summary,
    runHistory: runHistory.slice().reverse(),
    testCases,
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
  updateTestRunService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
  cancelAutomationRunService,
  retryFailedRunService,
  exportTestRunService,
} = require('./testRunLifecycleService');

module.exports = {
  // lifecycle (re-exported for controller compatibility)
  startTestRunService,
  applyAutomationResultsService,
  listTestRunsService,
  updateTestRunService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
  cancelAutomationRunService,
  retryFailedRunService,
  exportTestRunService,
  // dashboard
  getDashboardService,
  getProjectDashboardService,
  getVersionDashboardService,
  getTestPlanStatsService,
  getTestPlanDetailService,
};
