const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  createIntegrationHarness,
  stopSharedMongo,
} = require('../helpers/integrationHarness');
const {
  entityId,
  resultId,
  seedManualExecutionFixture,
} = require('../helpers/executionFixtures');
const { createLogBugRecord, listLogBugsByProject } = require('../../src/services/logBugHistoryService');

async function withHarness(run) {
  const harness = await createIntegrationHarness();
  try {
    await run(harness);
  } finally {
    await harness.clearDatabase();
    await harness.close();
    await stopSharedMongo();
  }
}

async function setProjectJiraPid(projectId, pid = '12345') {
  const Project = require('../../src/models/Project');
  const objectId = new mongoose.Types.ObjectId(projectId);
  await Project.updateOne(
    {
      $or: [{ entityId: objectId }, { _id: objectId }],
    },
    {
      $set: {
        pid: String(pid),
        jiraProjectKey: 'CED',
      },
    },
  );
}

async function getProjectDocumentId(projectId) {
  const Project = require('../../src/models/Project');
  const objectId = new mongoose.Types.ObjectId(projectId);
  const project = await Project.findOne({
    $or: [{ entityId: objectId }, { _id: objectId }],
  }).lean();
  assert.ok(project, 'project should exist');
  return project._id;
}

function uniqueRunName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function seedRunWithFailResult(fixture) {
  const employeeClient = await fixture.loginAs(fixture.employee);
  const startRes = await employeeClient.post(
    '/api/test-runs',
    { testPlanId: fixture.ids.testPlanId, name: uniqueRunName('log-bug-run') },
    201,
  );

  const runId = entityId(startRes.body.testRun);
  const runResultObjectId = resultId(startRes.body.testRun.results[0]);
  assert.ok(runId);
  assert.ok(runResultObjectId);

  await employeeClient.patch(
    `/api/test-runs/${runId}/results/${runResultObjectId}`,
    { status: 'fail', notes: 'Failed for Jira log test' },
    200,
  );

  return { runId, runResultObjectId, employeeClient };
}

test('createLogBugRecord stores run context and case metadata', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    await setProjectJiraPid(fixture.ids.projectId);
    const projectObjectId = await getProjectDocumentId(fixture.ids.projectId);
    const { runId, runResultObjectId } = await seedRunWithFailResult(fixture);

    const logBug = await createLogBugRecord({
      projectObjectId,
      testRunId: runId,
      runResultId: runResultObjectId,
      issueKeyJira: 'ced-1777',
      summary: '[TC-EXEC-001] Verify checkout flow',
      description: 'Checkout failed',
      issueType: '10001',
      priority: '3',
      assignee: 'qa.user',
      labels: 'regression',
      versions: ['v1'],
      loggedByUserId: entityId(fixture.admin),
    });

    assert.equal(String(logBug.project), String(projectObjectId));
    assert.equal(String(logBug.testRun), runId);
    assert.equal(String(logBug.runResult), runResultObjectId);
    assert.equal(logBug.issueKeyJira, 'CED-1777');
    assert.equal(logBug.caseKey, 'TC-EXEC-001');
    assert.equal(logBug.caseTitle, 'Verify checkout flow');
  });
});

test('createLogBugRecord falls back to provided case metadata', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    await setProjectJiraPid(fixture.ids.projectId);
    const projectObjectId = await getProjectDocumentId(fixture.ids.projectId);

    const logBug = await createLogBugRecord({
      projectObjectId,
      issueKeyJira: 'CED-1778',
      summary: '[TC-FALLBACK] Fallback case title',
      description: 'No run linked',
      issueType: '10002',
      priority: '2',
      caseKey: 'TC-FALLBACK',
      caseTitle: 'Fallback case title',
      loggedByUserId: entityId(fixture.admin),
    });

    assert.equal(logBug.caseKey, 'TC-FALLBACK');
    assert.equal(logBug.caseTitle, 'Fallback case title');
    assert.equal(logBug.testRun, null);
    assert.equal(logBug.runResult, null);
  });
});

test('listLogBugsByProject filters by search, priority, and issueType', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    await setProjectJiraPid(fixture.ids.projectId);
    const projectObjectId = await getProjectDocumentId(fixture.ids.projectId);
    const adminId = entityId(fixture.admin);

    await createLogBugRecord({
      projectObjectId,
      issueKeyJira: 'CED-2001',
      summary: '[TC-A] Alpha bug',
      description: 'Alpha',
      issueType: '10001',
      priority: '1',
      caseKey: 'TC-A',
      caseTitle: 'Alpha bug',
      loggedByUserId: adminId,
    });

    await createLogBugRecord({
      projectObjectId,
      issueKeyJira: 'CED-2002',
      summary: '[TC-B] Beta bug',
      description: 'Beta',
      issueType: '10002',
      priority: '3',
      caseKey: 'TC-B',
      caseTitle: 'Beta bug',
      loggedByUserId: adminId,
    });

    const all = await listLogBugsByProject({ projectObjectId });
    assert.equal(all.pagination.total, 2);

    const bySearch = await listLogBugsByProject({
      projectObjectId,
      search: 'CED-2002',
    });
    assert.equal(bySearch.pagination.total, 1);
    assert.equal(bySearch.logBugs[0].issueKeyJira, 'CED-2002');

    const byPriority = await listLogBugsByProject({
      projectObjectId,
      priority: '1',
    });
    assert.equal(byPriority.pagination.total, 1);
    assert.equal(byPriority.logBugs[0].priority, '1');

    const byIssueType = await listLogBugsByProject({
      projectObjectId,
      issueType: '10002',
    });
    assert.equal(byIssueType.pagination.total, 1);
    assert.equal(byIssueType.logBugs[0].issueType, '10002');

    assert.match(all.logBugs[0].jiraBrowseUrl, /\/browse\/CED-200/);
    assert.match(all.logBugs[1].jiraBrowseUrl, /\/browse\/CED-200/);
    assert.equal(all.logBugs[0].jiraLocation, undefined);
    assert.equal(all.logBugs[1].jiraLocation, undefined);
  });
});

test('GET /api/jira/log-bugs returns project bug history for authenticated user', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    await setProjectJiraPid(fixture.ids.projectId);
    const projectObjectId = await getProjectDocumentId(fixture.ids.projectId);
    const { runId, runResultObjectId } = await seedRunWithFailResult(fixture);

    await createLogBugRecord({
      projectObjectId,
      testRunId: runId,
      runResultId: runResultObjectId,
      issueKeyJira: 'CED-3001',
      summary: '[TC-EXEC-001] Verify checkout flow',
      description: 'API list test',
      issueType: '10001',
      priority: '3',
      loggedByUserId: entityId(fixture.admin),
    });

    const res = await fixture.adminClient.get(
      `/api/jira/log-bugs?projectId=${encodeURIComponent(fixture.ids.projectId)}`,
      200,
    );

    assert.equal(res.body.pagination.total, 1);
    assert.equal(res.body.logBugs.length, 1);
    assert.equal(res.body.logBugs[0].issueKeyJira, 'CED-3001');
    assert.match(res.body.logBugs[0].jiraBrowseUrl, /\/browse\/CED-3001$/);
    assert.equal(res.body.logBugs[0].jiraLocation, undefined);
    assert.equal(res.body.logBugs[0].testRun._id, runId);
    assert.equal(res.body.logBugs[0].runResult, runResultObjectId);
    assert.equal(res.body.logBugs[0].caseKey, 'TC-EXEC-001');
  });
});

test('GET /api/jira/log-bugs requires authentication', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    await setProjectJiraPid(fixture.ids.projectId);

    const client = harness.createClient();
    const res = await client.get(
      `/api/jira/log-bugs?projectId=${encodeURIComponent(fixture.ids.projectId)}`,
      401,
    );

    assert.match(res.body.message, /auth session/i);
  });
});

test('GET /api/jira/log-bugs rejects project missing Jira pid', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    const res = await fixture.adminClient.get(
      `/api/jira/log-bugs?projectId=${encodeURIComponent(fixture.ids.projectId)}`,
      400,
    );

    assert.match(res.body.message, /missing jira pid/i);
  });
});
