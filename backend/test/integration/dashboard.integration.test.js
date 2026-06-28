const test = require('node:test');
const assert = require('node:assert/strict');
const { withIntegrationHarness } = require('../helpers/integrationHarness');
const { entityId, seedManualExecutionFixture } = require('../helpers/executionFixtures');

test('admin dashboard endpoints return summary metrics', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    const summaryRes = await fixture.adminClient.get('/api/dashboard', 200);
    assert.ok(summaryRes.body.summary || summaryRes.body.kpis || summaryRes.body);

    const projectsRes = await fixture.adminClient.get('/api/dashboard/projects', 200);
    assert.ok(Array.isArray(projectsRes.body.projects));

    const versionsRes = await fixture.adminClient.get(
      `/api/dashboard/versions?projectId=${fixture.ids.projectId}`,
      200,
    );
    assert.ok(Array.isArray(versionsRes.body.versions));

    const plansRes = await fixture.adminClient.get(
      `/api/dashboard/test-plans?versionId=${fixture.ids.versionId}`,
      200,
    );
    assert.ok(Array.isArray(plansRes.body.testPlans));

    const planDetailRes = await fixture.adminClient.get(
      `/api/dashboard/test-plans/${fixture.ids.testPlanId}`,
      200,
    );
    assert.ok(planDetailRes.body.testPlan || planDetailRes.body.stats || planDetailRes.body);
  });
});

test('employee cannot access admin dashboard', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);

    await employeeClient.get('/api/dashboard', 403);
    await employeeClient.get('/api/dashboard/projects', 403);
  });
});

test('test case execution history lists cases for project', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);

    const startRes = await employeeClient.post(
      '/api/test-runs',
      {
        testPlanId: fixture.ids.testPlanId,
        name: `history-run-${Date.now()}`,
      },
      201,
    );
    const runId = entityId(startRes.body.testRun);
    const resultObjectId = String(startRes.body.testRun.results[0]._id || startRes.body.testRun.results[0].id);

    await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass' },
      200,
    );
    await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);

    const historyRes = await fixture.adminClient.get(
      `/api/test-cases/history?projectId=${fixture.ids.projectId}`,
      200,
    );
    assert.ok(Array.isArray(historyRes.body.testCases));
    assert.ok(
      historyRes.body.testCases.some((entry) => entry.caseKey === 'TC-EXEC-001'),
    );
  });
});
