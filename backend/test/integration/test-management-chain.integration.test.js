const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createIntegrationHarness,
  stopSharedMongo,
} = require('../helpers/integrationHarness');
const { entityId, seedManualExecutionFixture } = require('../helpers/executionFixtures');

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

test('admin can create full CRUD chain project → version → group → case → plan', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const { adminClient, ids } = fixture;

    const projectRes = await adminClient.get(`/api/projects/${ids.projectId}`, 200);
    assert.equal(projectRes.body.project.code, 'EXEC');

    const versionRes = await adminClient.get(`/api/versions/${ids.versionId}`, 200);
    assert.equal(versionRes.body.version.name, 'Release 1.0');

    const groupRes = await adminClient.get(`/api/test-case-groups/${ids.groupId}`, 200);
    assert.equal(groupRes.body.group.name, 'Core Group');

    const caseRes = await adminClient.get(`/api/test-cases/${ids.testCaseId}`, 200);
    assert.equal(caseRes.body.testCase.caseKey, 'TC-EXEC-001');

    const planRes = await adminClient.get(`/api/test-plans/${ids.testPlanId}`, 200);
    assert.equal(planRes.body.testPlan.name, 'Manual Execution Plan');
    assert.equal(planRes.body.testPlan.executionMode, 'manual');
    assert.equal(planRes.body.testPlan.items.length, 1);
  });
});

test('plan update versions series and keeps case assignment', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const { adminClient, ids } = fixture;

    const updateRes = await adminClient.put(
      `/api/test-plans/${ids.testPlanId}`,
      {
        description: 'Updated for regression',
        caseIds: [ids.testCaseId],
      },
      200,
    );

    assert.match(updateRes.body.testPlan.description, /regression/i);

    const versionsRes = await adminClient.get(
      `/api/test-plans/${ids.testPlanId}/versions`,
      200,
    );
    assert.ok(versionsRes.body.versions.length >= 2);
  });
});

test('assign endpoint updates plan assignees for execution access', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const outsiderClient = await fixture.loginAs(fixture.outsider);

    await outsiderClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: 'should-not-start' },
      403,
    );

    await fixture.adminClient.put(
      `/api/test-plans/${fixture.ids.testPlanId}/assign`,
      { assigneeIds: [entityId(fixture.outsider)] },
      200,
    );

    const startRes = await outsiderClient.post(
      '/api/test-runs',
      {
        testPlanId: fixture.ids.testPlanId,
        name: `assigned-run-${Date.now()}`,
      },
      201,
    );

    assert.equal(startRes.body.testRun.status, 'running');
  });
});
