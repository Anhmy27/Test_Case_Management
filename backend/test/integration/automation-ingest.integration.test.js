const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createIntegrationHarness,
  stopSharedMongo,
} = require('../helpers/integrationHarness');
const {
  entityId,
  planItemId,
  resultId,
  seedAutomationExecutionFixture,
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

test('CI automation ingest completes run via shared secret', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);
    const adminClient = fixture.adminClient;
    const runName = uniqueRunName('ci-ingest');

    const startRes = await adminClient.post(
      '/api/test-runs',
      { testPlanId: fixture.ids.testPlanId, name: runName },
      201,
    );

    assert.equal(startRes.body.automationQueued, true);
    const runId = entityId(startRes.body.testRun);
    const ingestItemId = planItemId(startRes.body.testRun.results[0]);
    assert.ok(ingestItemId, 'planItemId should be present on run results');

    const ingestRes = await adminClient.postWithHeaders(
      `/api/test-runs/${runId}/automation-results`,
      {
        results: [{
          planItemId: ingestItemId,
          status: 'pass',
          notes: 'CI pipeline reported pass',
        }],
      },
      { 'x-automation-secret': fixture.automationSecret },
      200,
    );

    assert.equal(ingestRes.body.testRun.status, 'completed');
    assert.equal(ingestRes.body.testRun.results[0].status, 'pass');

    const listRes = await adminClient.get(`/api/test-runs?projectId=${fixture.ids.projectId}`, 200);
    const savedRun = listRes.body.testRuns.find((run) => entityId(run) === runId);
    assert.equal(savedRun?.status, 'completed');
  });
});

test('automation ingest rejects invalid shared secret', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);
    const startRes = await fixture.adminClient.post(
      '/api/test-runs',
      {
        testPlanId: fixture.ids.testPlanId,
        name: uniqueRunName('bad-secret'),
      },
      201,
    );
    const runId = entityId(startRes.body.testRun);
    const ingestItemId = planItemId(startRes.body.testRun.results[0]);

    const anonymousClient = harness.createClient();
    const res = await anonymousClient.postWithHeaders(
      `/api/test-runs/${runId}/automation-results`,
      { results: [{ planItemId: ingestItemId, status: 'pass' }] },
      { 'x-automation-secret': 'wrong-secret-value' },
      401,
    );

    assert.match(res.body.message, /invalid automation secret|auth session/i);
  });
});

test('manual result update is blocked for automation-enabled cases', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);
    const startRes = await fixture.adminClient.post(
      '/api/test-runs',
      {
        testPlanId: fixture.ids.testPlanId,
        name: uniqueRunName('manual-blocked'),
      },
      201,
    );

    const runId = entityId(startRes.body.testRun);
    const resultObjectId = resultId(startRes.body.testRun.results[0]);

    const res = await fixture.adminClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass' },
      403,
    );

    assert.match(res.body.message, /automation-enabled|cannot be updated manually/i);
  });
});

test('automation ingest rejects runs without automation cases', async () => {
  await withHarness(async (harness) => {
    const manualFixture = await seedManualExecutionFixture(harness);
    const employeeClient = await manualFixture.loginAs(manualFixture.employee);

    const startRes = await employeeClient.post(
      '/api/test-runs',
      {
        testPlanId: manualFixture.ids.testPlanId,
        name: uniqueRunName('manual-only'),
      },
      201,
    );

    const runId = entityId(startRes.body.testRun);
    const fakePlanItemId = planItemId(startRes.body.testRun.results[0]);

    process.env.AUTOMATION_SECRET = 'integration-automation-ingest-secret-value';

    const res = await manualFixture.adminClient.postWithHeaders(
      `/api/test-runs/${runId}/automation-results`,
      { results: [{ planItemId: fakePlanItemId, status: 'pass' }] },
      { 'x-automation-secret': process.env.AUTOMATION_SECRET },
      400,
    );

    assert.match(res.body.message, /no automation-enabled cases/i);
  });
});
