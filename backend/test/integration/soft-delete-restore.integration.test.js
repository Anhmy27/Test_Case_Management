const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createIntegrationHarness,
  stopSharedMongo,
} = require('../helpers/integrationHarness');
const {
  entityId,
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

test('empty project can be soft-deleted and restored', async () => {
  await withHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Delete Admin',
      email: 'delete-admin@integration.test',
      password: 'pass1234',
      role: 'admin',
    });

    const adminClient = harness.createClient();
    await adminClient.post(
      '/api/auth/login',
      { email: admin.email, password: 'pass1234' },
      200,
    );

    const createRes = await adminClient.post(
      '/api/projects',
      { name: 'Disposable Project', code: 'DISPOSE' },
      201,
    );
    const projectId = entityId(createRes.body.project);

    await adminClient.delete(`/api/projects/${projectId}`, 204);

    const hiddenRes = await adminClient.get(`/api/projects/${projectId}`, 200);
    assert.equal(hiddenRes.body.project, null);

    const deletedListRes = await adminClient.get('/api/projects?includeDeleted=true', 200);
    const deletedIds = deletedListRes.body.projects.map((project) => entityId(project));
    assert.ok(deletedIds.includes(projectId));

    await adminClient.patch(`/api/projects/${projectId}/restore`, {}, 200);

    const restoredRes = await adminClient.get(`/api/projects/${projectId}`, 200);
    assert.equal(restoredRes.body.project.code, 'DISPOSE');
  });
});

test('project with related records cannot be deleted', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const res = await fixture.adminClient.delete(
      `/api/projects/${fixture.ids.projectId}`,
      409,
    );

    assert.match(res.body.message, /related records/i);
  });
});

test('soft-deleted test case is hidden then restored for execution', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const runName = `restore-run-${Date.now()}`;

    await fixture.adminClient.delete(`/api/test-cases/${fixture.ids.testCaseId}`, 204);

    const hiddenCase = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      200,
    );
    assert.equal(hiddenCase.body.testCase, null);

    // Current resolver still falls back to the deleted snapshot when starting a run.
    const startAfterDelete = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );
    assert.equal(startAfterDelete.body.testRun.status, 'running');

    await fixture.adminClient.patch(`/api/test-cases/${fixture.ids.testCaseId}/restore`, {}, 200);

    const restoredCase = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      200,
    );
    assert.equal(restoredCase.body.testCase.caseKey, 'TC-EXEC-001');

    const startRes = await employeeClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: `${runName}-after-restore` },
      201,
    );
    assert.equal(startRes.body.testRun.status, 'running');
  });
});

test('soft-deleted test plan disappears for employee until restored', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);

    const beforeRes = await employeeClient.get('/api/test-plans', 200);
    assert.ok(
      beforeRes.body.testPlans.some((plan) => entityId(plan) === fixture.ids.testPlanId),
    );

    await fixture.adminClient.delete(`/api/test-plans/${fixture.ids.testPlanId}`, 204);

    const hiddenRes = await employeeClient.get('/api/test-plans', 200);
    assert.equal(
      hiddenRes.body.testPlans.some((plan) => entityId(plan) === fixture.ids.testPlanId),
      false,
    );

    await fixture.adminClient.patch(`/api/test-plans/${fixture.ids.testPlanId}/restore`, {}, 200);

    const afterRes = await employeeClient.get('/api/test-plans', 200);
    assert.ok(
      afterRes.body.testPlans.some((plan) => entityId(plan) === fixture.ids.testPlanId),
    );
  });
});
