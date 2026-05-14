const mongoose = require('mongoose');
const Project = require('../models/Project');
const Version = require('../models/Version');
const TestCase = require('../models/TestCase');
const TestCaseGroup = require('../models/TestCaseGroup');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const { asyncHandler } = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `${fieldName} is invalid`);
  }

  return new mongoose.Types.ObjectId(id);
};

const isPlanAssignedToUser = (testPlan, userId) => {
  const ownerMatch = testPlan.owner && String(testPlan.owner) === userId;
  const assigneeMatch = Array.isArray(testPlan.assignees)
    && testPlan.assignees.some((assignee) => String(assignee) === userId);
  return ownerMatch || assigneeMatch;
};

const createProject = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) {
    throw httpError(400, 'name and code are required');
  }

  const project = await Project.create({
    name,
    code,
    description: description || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ project });
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find().sort({ createdAt: -1 }).lean();
  res.json({ projects });
});

const createVersion = asyncHandler(async (req, res) => {
  const { projectId, name, releaseDate, notes } = req.body;
  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await Project.findById(toObjectId(projectId, 'projectId')).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const version = await Version.create({
    project: project._id,
    name,
    releaseDate,
    notes: notes || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ version });
});

const listVersions = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const query = {};
  if (projectId) {
    query.project = toObjectId(projectId, 'projectId');
  }

  const versions = await Version.find(query).sort({ createdAt: -1 }).lean();
  res.json({ versions });
});

const createTestCaseGroup = asyncHandler(async (req, res) => {
  const { projectId, name, description } = req.body;

  if (!projectId || !name) {
    throw httpError(400, 'projectId and name are required');
  }

  const project = await Project.findById(toObjectId(projectId, 'projectId')).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const group = await TestCaseGroup.create({
    project: project._id,
    name,
    description: description || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ group });
});

const listTestCaseGroups = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const query = {};

  if (projectId) {
    query.project = toObjectId(projectId, 'projectId');
  }

  const groups = await TestCaseGroup.find(query)
    .sort({ createdAt: -1 })
    .populate('project', 'name code')
    .lean();

  res.json({ groups });
});

const createTestCase = asyncHandler(async (req, res) => {
  const {
    projectId,
    groupId,
    caseKey,
    title,
    description,
    steps,
    priority,
    severity,
    type,
  } = req.body;

  if (!projectId || !groupId || !caseKey || !title) {
    throw httpError(400, 'projectId, groupId, caseKey and title are required');
  }

  const project = await Project.findById(toObjectId(projectId, 'projectId')).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const group = await TestCaseGroup.findById(toObjectId(groupId, 'groupId')).lean();
  if (!group || String(group.project) !== String(project._id)) {
    throw httpError(404, 'Test case group not found in selected project');
  }

  const normalizedSteps = Array.isArray(steps)
    ? steps
        .filter((step) => step && step.action && step.expected)
        .map((step, index) => ({
          order: index + 1,
          action: String(step.action),
          expected: String(step.expected),
        }))
    : [];

  const testCase = await TestCase.create({
    project: project._id,
    group: group._id,
    caseKey,
    title,
    description: description || '',
    steps: normalizedSteps,
    priority,
    severity,
    type,
    createdBy: req.user.id,
  });

  res.status(201).json({ testCase });
});

const listTestCases = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const query = {};
  if (projectId) {
    query.project = toObjectId(projectId, 'projectId');
  }

  const testCases = await TestCase.find(query)
    .sort({ createdAt: -1 })
    .populate('project', 'name code')
    .populate('group', 'name description')
    .lean();

  res.json({ testCases });
});

const createTestPlan = asyncHandler(async (req, res) => {
  const { name, description, projectId, versionId, caseIds } = req.body;

  if (!name || !projectId || !versionId || !Array.isArray(caseIds) || caseIds.length === 0) {
    throw httpError(400, 'name, projectId, versionId and caseIds[] are required');
  }

  const project = await Project.findById(toObjectId(projectId, 'projectId')).lean();
  if (!project) {
    throw httpError(404, 'Project not found');
  }

  const version = await Version.findById(toObjectId(versionId, 'versionId')).lean();
  if (!version || String(version.project) !== String(project._id)) {
    throw httpError(404, 'Version not found in selected project');
  }

  const validCaseIds = caseIds.map((id, index) => ({
    testCase: toObjectId(id, `caseIds[${index}]`),
    order: index + 1,
    assignees: [],
  }));

  const totalCases = await TestCase.countDocuments({
    _id: { $in: validCaseIds.map((item) => item.testCase) },
    project: project._id,
  });

  if (totalCases !== validCaseIds.length) {
    throw httpError(400, 'Some caseIds do not exist in selected project');
  }

  const testPlan = await TestPlan.create({
    name,
    description: description || '',
    project: project._id,
    version: version._id,
    createdBy: req.user.id,
    items: validCaseIds,
  });

  res.status(201).json({ testPlan });
});

const listTestPlans = asyncHandler(async (req, res) => {
  const { projectId, versionId } = req.query;
  const query = {};

  if (projectId) {
    query.project = toObjectId(projectId, 'projectId');
  }

  if (versionId) {
    query.version = toObjectId(versionId, 'versionId');
  }

  const testPlans = await TestPlan.find(query)
    .sort({ createdAt: -1 })
    .populate('project', 'name code')
    .populate('version', 'name')
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'caseKey title')
    .lean();

  const visiblePlans = req.user.role === 'admin'
    ? testPlans
    : testPlans.filter((plan) => isPlanAssignedToUser(plan, req.user.id));

  res.json({ testPlans: visiblePlans });
});

const assignTestPlanItems = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  const { ownerId, assigneeIds } = req.body;

  if (!ownerId && !Array.isArray(assigneeIds)) {
    throw httpError(400, 'ownerId or assigneeIds[] is required');
  }

  const testPlan = await TestPlan.findById(toObjectId(testPlanId, 'testPlanId'));
  if (!testPlan) {
    throw httpError(404, 'Test plan not found');
  }

  if (ownerId !== undefined) {
    testPlan.owner = ownerId ? toObjectId(ownerId, 'ownerId') : undefined;
  }

  if (Array.isArray(assigneeIds)) {
    testPlan.assignees = assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`));
  }

  await testPlan.save();

  const populated = await TestPlan.findById(testPlan._id)
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .populate('items.testCase', 'caseKey title')
    .lean();

  res.json({ testPlan: populated });
});

const startTestRun = asyncHandler(async (req, res) => {
  const { testPlanId, name } = req.body;
  if (!testPlanId || !name) {
    throw httpError(400, 'testPlanId and name are required');
  }

  const testPlan = await TestPlan.findById(toObjectId(testPlanId, 'testPlanId')).lean();
  if (!testPlan) {
    throw httpError(404, 'Test plan not found');
  }

  if (req.user.role !== 'admin' && !isPlanAssignedToUser(testPlan, req.user.id)) {
    throw httpError(403, 'You are not assigned to this test plan');
  }

  const results = testPlan.items.map((item) => ({
    planItemId: item._id,
    testCase: item.testCase,
    owner: testPlan.owner,
    assignees: testPlan.assignees || [],
    tester: testPlan.owner || (testPlan.assignees && testPlan.assignees.length > 0 ? testPlan.assignees[0] : undefined),
    status: 'untested',
    note: '',
  }));

  const testRun = await TestRun.create({
    name,
    project: testPlan.project,
    version: testPlan.version,
    testPlan: testPlan._id,
    status: 'running',
    startedAt: new Date(),
    startedBy: req.user.id,
    results,
  });

  res.status(201).json({ testRun });
});

const listTestRuns = asyncHandler(async (req, res) => {
  const { projectId, versionId, status } = req.query;
  const query = {};

  if (projectId) {
    query.project = toObjectId(projectId, 'projectId');
  }

  if (versionId) {
    query.version = toObjectId(versionId, 'versionId');
  }

  if (status) {
    query.status = status;
  }

  const testRuns = await TestRun.find(query)
    .sort({ createdAt: -1 })
    .populate('project', 'name code')
    .populate('version', 'name')
    .populate('testPlan', 'name')
    .populate('startedBy', 'name email role')
    .populate('endedBy', 'name email role')
    .lean();

  res.json({ testRuns });
});

const getMyRunItems = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'))
    .populate('results.testCase', 'caseKey title steps priority severity')
    .populate('results.owner', 'name email role')
    .populate('results.assignees', 'name email role')
    .populate('results.tester', 'name email role')
    .lean();

  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const isAdmin = req.user.role === 'admin';

  const results = isAdmin
    ? testRun.results
    : testRun.results.filter((result) => {
        const ownerMatch = result.owner && String(result.owner._id) === req.user.id;
        const assigneeMatch = Array.isArray(result.assignees)
          && result.assignees.some((user) => String(user._id) === req.user.id);

        return ownerMatch || assigneeMatch;
      });

  res.json({
    testRun: {
      id: String(testRun._id),
      name: testRun.name,
      status: testRun.status,
    },
    results,
  });
});

const updateRunResult = asyncHandler(async (req, res) => {
  const { runId, resultId } = req.params;
  const { status, note } = req.body;

  if (!['pass', 'fail', 'blocked'].includes(status)) {
    throw httpError(400, 'status must be one of pass/fail/blocked');
  }

  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  if (testRun.status !== 'running') {
    throw httpError(400, 'Only running test run can be updated');
  }

  const result = testRun.results.id(resultId);
  if (!result) {
    throw httpError(404, 'Run result not found');
  }

  const isAdmin = req.user.role === 'admin';
  const isOwner = result.owner && String(result.owner) === req.user.id;
  const isAssignee = Array.isArray(result.assignees)
    && result.assignees.some((userId) => String(userId) === req.user.id);

  if (!isAdmin && !isOwner && !isAssignee) {
    throw httpError(403, 'You are not assigned for this test case');
  }

  result.status = status;
  result.note = note || '';
  result.executedAt = new Date();
  result.tester = req.user.id;

  await testRun.save();

  res.json({ testRun });
});

const endTestRun = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const testRun = await TestRun.findById(toObjectId(runId, 'runId'));
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const isAdmin = req.user.role === 'admin';
  const isStarter = String(testRun.startedBy) === req.user.id;

  if (!isAdmin && !isStarter) {
    throw httpError(403, 'You do not have permission to end this test run');
  }

  if (testRun.status === 'completed') {
    throw httpError(409, 'Test run already completed');
  }

  testRun.status = 'completed';
  testRun.endedAt = new Date();
  testRun.endedBy = req.user.id;
  await testRun.save();

  res.json({ testRun });
});

const getDashboard = asyncHandler(async (req, res) => {
  const { projectId, versionId } = req.query;
  const match = {};

  if (projectId) {
    match.project = toObjectId(projectId, 'projectId');
  }

  if (versionId) {
    match.version = toObjectId(versionId, 'versionId');
  }

  const runs = await TestRun.aggregate([
    { $match: match },
    {
      $project: {
        status: 1,
        total: { $size: '$results' },
        passCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $eq: ['$$r.status', 'pass'] },
            },
          },
        },
        failCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $eq: ['$$r.status', 'fail'] },
            },
          },
        },
        blockedCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $eq: ['$$r.status', 'blocked'] },
            },
          },
        },
        untestedCount: {
          $size: {
            $filter: {
              input: '$results',
              as: 'r',
              cond: { $eq: ['$$r.status', 'untested'] },
            },
          },
        },
      },
    },
  ]);

  const summary = runs.reduce(
    (acc, run) => {
      acc.totalRuns += 1;
      acc.totalCases += run.total;
      acc.pass += run.passCount;
      acc.fail += run.failCount;
      acc.blocked += run.blockedCount;
      acc.untested += run.untestedCount;
      if (run.status === 'running') {
        acc.runningRuns += 1;
      }
      return acc;
    },
    {
      totalRuns: 0,
      runningRuns: 0,
      totalCases: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
      untested: 0,
    }
  );

  summary.executed = summary.pass + summary.fail + summary.blocked;
  summary.passRate = summary.executed > 0 ? Number(((summary.pass / summary.executed) * 100).toFixed(2)) : 0;
  summary.completionRate = summary.totalCases > 0
    ? Number(((summary.executed / summary.totalCases) * 100).toFixed(2))
    : 0;

  res.json({ summary, runs });
});

// Dashboard API endpoints
const getProjectDashboard = asyncHandler(async (req, res) => {
  const projects = await Project.find({ status: 'active' }).lean();
  
  const projectStats = await Promise.all(
    projects.map(async (project) => {
      const latestVersion = await Version.findOne({ project: project._id })
        .sort({ createdAt: -1 })
        .lean();
      
      const runs = await TestRun.aggregate([
        { $match: { project: project._id } },
        {
          $project: {
            total: { $size: '$results' },
            passCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'pass'] },
                },
              },
            },
            failCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'fail'] },
                },
              },
            },
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
        ? runs.reduce((latest, run) => 
            run.updatedAt && (!latest || new Date(run.updatedAt) > new Date(latest)) 
              ? run.updatedAt 
              : latest, null)
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
    })
  );

  res.json({ projects: projectStats });
});

const getVersionDashboard = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  
  if (!projectId) {
    throw httpError(400, 'projectId is required');
  }

  const versions = await Version.find({ project: toObjectId(projectId, 'projectId') })
    .sort({ createdAt: -1 })
    .lean();

  const versionStats = await Promise.all(
    versions.map(async (version) => {
      const testPlans = await TestPlan.find({ version: version._id }).lean();
      const totalTestPlans = testPlans.length;
      
      const testPlanIds = testPlans.map(tp => tp._id);
      const runs = await TestRun.aggregate([
        { $match: { version: version._id } },
        {
          $project: {
            total: { $size: '$results' },
            passCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'pass'] },
                },
              },
            },
            failCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'fail'] },
                },
              },
            },
            notRunCount: {
              $size: {
                $filter: {
                  input: '$results',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'untested'] },
                },
              },
            },
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
    })
  );

  res.json({ versions: versionStats });
});

const getTestPlanStats = asyncHandler(async (req, res) => {
  const { versionId } = req.query;
  
  if (!versionId) {
    throw httpError(400, 'versionId is required');
  }

  const testPlans = await TestPlan.find({ version: toObjectId(versionId, 'versionId') })
    .populate('owner', 'name email role')
    .populate('assignees', 'name email role')
    .lean();

  const testPlanStats = await Promise.all(
    testPlans.map(async (testPlan) => {
      const runs = await TestRun.find({ testPlan: testPlan._id })
        .sort({ createdAt: -1 })
        .lean();

      const latestRun = runs[0];
      let progress = 0;
      let passRate = 0;
      let lastRunTime;

      if (latestRun) {
        const total = latestRun.results.length;
        const passCount = latestRun.results.filter(r => r.status === 'pass').length;
        const executed = latestRun.results.filter(r => r.status !== 'untested').length;
        
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
    })
  );

  res.json({ testPlans: testPlanStats });
});

const getTestPlanDetail = asyncHandler(async (req, res) => {
  const { testPlanId } = req.params;
  
  const testPlan = await TestPlan.findById(toObjectId(testPlanId, 'testPlanId'))
    .populate('project', 'name code')
    .populate('version', 'name')
    .lean();

  if (!testPlan) {
    throw httpError(404, 'Test plan not found');
  }

  const runs = await TestRun.find({ testPlan: testPlan._id })
    .sort({ createdAt: 1 })
    .populate('startedBy', 'name email')
    .populate('endedBy', 'name email')
    .populate('results.tester', 'name email')
    .lean();

  const runHistory = runs.map(run => {
    const passCount = run.results.filter(r => r.status === 'pass').length;
    const failCount = run.results.filter(r => r.status === 'fail').length;
    const blockedCount = run.results.filter(r => r.status === 'blocked').length;
    const notRunCount = run.results.filter(r => r.status === 'untested').length;

    return {
      runId: String(run._id),
      runName: run.name,
      passCount,
      failCount,
      blockedCount,
      notRunCount,
      executedAt: run.startedAt,
    };
  });

  const latestRun = runs[runs.length - 1];
  let summary = {
    totalTests: 0,
    passCount: 0,
    failCount: 0,
    notRunCount: 0,
    passRate: 0,
    progress: 0,
  };

  if (latestRun) {
    summary.totalTests = latestRun.results.length;
    summary.passCount = latestRun.results.filter(r => r.status === 'pass').length;
    summary.failCount = latestRun.results.filter(r => r.status === 'fail').length;
    summary.notRunCount = latestRun.results.filter(r => r.status === 'untested').length;
    const executed = summary.passCount + summary.failCount + latestRun.results.filter(r => r.status === 'blocked').length;
    summary.passRate = executed > 0 ? Number(((summary.passCount / executed) * 100).toFixed(2)) : 0;
    summary.progress = summary.totalTests > 0 ? Number(((executed / summary.totalTests) * 100).toFixed(2)) : 0;
  }

  // Build execution history for each test case
  const testCaseExecutions = {};
  
  runs.forEach(run => {
    run.results.forEach(result => {
      const testCaseId = String(result.testCase);
      if (!testCaseExecutions[testCaseId]) {
        testCaseExecutions[testCaseId] = [];
      }
      testCaseExecutions[testCaseId].push(result.status);
    });
  });

  // Categorize test cases into insights
  const insights = {
    stillFailing: [],
    failedThenPassed: [],
    flakyTests: [],
    notRun: [],
  };

  const testCases = await TestPlan.findById(testPlan._id)
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
    const failCount = history.filter(s => s === 'fail').length;

    const testCaseDetail = {
      testCaseId,
      caseKey: testCase.caseKey,
      title: testCase.title,
      priority: testCase.priority || 'medium',
      currentStatus,
      failCount,
      executionHistory: history,
      lastTester: latestRun?.results.find(r => String(r.testCase) === testCaseId)?.tester,
      lastRunTime: latestRun?.startedAt,
    };

    testCaseDetails.push(testCaseDetail);

    // Categorize into insights
    if (currentStatus === 'fail') {
      insights.stillFailing.push(testCaseDetail);
    } else if (currentStatus === 'pass' && failCount > 0) {
      // Check if it failed then passed (pattern: fail...pass)
      const hasFailThenPass = history.some((s, i) => s === 'fail' && i < history.length - 1 && history.slice(i + 1).includes('pass'));
      if (hasFailThenPass) {
        insights.failedThenPassed.push(testCaseDetail);
      }
    } else if (failCount >= 2 && currentStatus !== 'fail') {
      // Flaky: failed at least twice but not currently failing
      insights.flakyTests.push(testCaseDetail);
    } else if (currentStatus === 'untested') {
      insights.notRun.push(testCaseDetail);
    }
  }

  const response = {
    testPlanId: String(testPlan._id),
    testPlanName: testPlan.name,
    version: testPlan.version.name,
    project: testPlan.project.name,
    summary,
    runHistory,
    insights,
    testCases: testCaseDetails,
  };

  res.json(response);
});

module.exports = {
  createProject,
  listProjects,
  createVersion,
  listVersions,
  createTestCaseGroup,
  listTestCaseGroups,
  createTestCase,
  listTestCases,
  createTestPlan,
  listTestPlans,
  assignTestPlanItems,
  startTestRun,
  listTestRuns,
  getMyRunItems,
  updateRunResult,
  endTestRun,
  getDashboard,
  getProjectDashboard,
  getVersionDashboard,
  getTestPlanStats,
  getTestPlanDetail,
};
