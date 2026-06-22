const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createIntegrationHarness,
  stopSharedMongo,
} = require('../helpers/integrationHarness');
const {
  entityId,
  resultId,
  seedManualExecutionFixture,
} = require('../helpers/executionFixtures');

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

function uniqueRunName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test('admin seeds project chain and employee executes manual run end-to-end', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const runName = uniqueRunName('manual-run');

    const startRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );

    const runId = entityId(startRes.body.testRun);
    const firstResult = startRes.body.testRun?.results?.[0];
    assert.ok(runId, 'run id should be returned');
    assert.ok(firstResult, 'run should contain result items');

    const myItemsRes = await employeeClient.get(`/api/test-runs/${runId}/my-items`, 200);
    assert.equal(myItemsRes.body.results.length, 1);
    assert.equal(myItemsRes.body.results[0].status, 'untested');

    const resultObjectId = resultId(firstResult);
    await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass', notes: 'Checked on staging' },
      200,
    );

    const endRes = await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);
    assert.equal(endRes.body.testRun.status, 'completed');

    const historyRes = await fixture.adminClient.get(
      `/api/test-cases/history?projectId=${fixture.ids.projectId}`,
      200,
    );

    const historyCase = historyRes.body.testCases.find(
      (entry) => entityId(entry) === fixture.ids.testCaseId || entry.caseKey === 'TC-EXEC-001',
    );
    assert.ok(historyCase, 'execution history should include the test case');
    assert.ok(
      historyCase.executionHistory.some((entry) => entry.status === 'pass'),
      'history should record pass result',
    );
  });
});

test('employee not assigned to plan cannot start a run', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const outsiderClient = await fixture.loginAs(fixture.outsider);

    const res = await outsiderClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: uniqueRunName('blocked-run') },
      403,
    );

    assert.match(res.body.message, /not assigned/i);
  });
});

test('outsider cannot update run result they are not assigned to', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const outsiderClient = await fixture.loginAs(fixture.outsider);
    const runName = uniqueRunName('permission-run');

    const startRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );

    const runId = entityId(startRes.body.testRun);
    const resultObjectId = resultId(startRes.body.testRun.results[0]);

    const res = await outsiderClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'fail' },
      403,
    );

    assert.match(res.body.message, /permission/i);
  });
});

test('duplicate run name in same plan is rejected', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const runName = uniqueRunName('duplicate-run');

    await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );

    const duplicateRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      409,
    );

    assert.match(duplicateRes.body.message, /already exists/i);
  });
});

test('admin can rename test run in place without creating a new document', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const runName = uniqueRunName('rename-run');

    const startRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );

    const runId = entityId(startRes.body.testRun);
    const renamed = `${runName}-updated`;

    const updateRes = await fixture.adminClient.patch(
      `/api/test-runs/${runId}`,
      { name: renamed },
      200,
    );

    assert.equal(entityId(updateRes.body.testRun), runId);
    assert.equal(updateRes.body.testRun.name, renamed);

    const listRes = await fixture.adminClient.get('/api/test-runs', 200);
    const listed = (listRes.body.testRuns || []).find((run) => entityId(run) === runId);
    assert.ok(listed);
    assert.equal(listed.name, renamed);

    const duplicateRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: renamed },
      409,
    );
    assert.match(duplicateRes.body.message, /already exists/i);
  });
});

test('completed run rejects further result updates', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const runName = uniqueRunName('completed-run');

    const startRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );

    const runId = entityId(startRes.body.testRun);
    const resultObjectId = resultId(startRes.body.testRun.results[0]);

    await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass' },
      200,
    );
    await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);

    const res = await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'fail' },
      400,
    );

    assert.match(res.body.message, /running test run/i);
  });
});

test('admin can update results on completed run in place', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const runName = uniqueRunName('admin-edit-completed');

    const startRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );

    const runId = entityId(startRes.body.testRun);
    const resultObjectId = resultId(startRes.body.testRun.results[0]);

    await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'fail', notes: 'Initial fail' },
      200,
    );
    await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);

    const updateRes = await fixture.adminClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass', notes: 'Corrected after review' },
      200,
    );

    assert.equal(updateRes.body.testRun.status, 'completed');
    const updatedResult = updateRes.body.testRun.results.find(
      (item) => String(item._id || item.id) === String(resultObjectId),
    );
    assert.equal(updatedResult.status, 'pass');
    assert.match(updatedResult.notes, /Corrected after review/i);
  });
});

test('employee list test plans only returns assigned plans', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const outsiderClient = await fixture.loginAs(fixture.outsider);

    const assignedRes = await employeeClient.get('/api/test-plans', 200);
    const assignedIds = assignedRes.body.testPlans.map((plan) => entityId(plan));
    assert.ok(assignedIds.includes(fixture.ids.testPlanId));

    const outsiderRes = await outsiderClient.get('/api/test-plans', 200);
    const outsiderIds = outsiderRes.body.testPlans.map((plan) => entityId(plan));
    assert.equal(outsiderIds.includes(fixture.ids.testPlanId), false);
  });
});
