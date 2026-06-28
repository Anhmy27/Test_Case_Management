const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { CSRF_COOKIE, CSRF_HEADER } = require('../../src/utils/authCookies');
const { withIntegrationHarness } = require('../helpers/integrationHarness');
const {
  entityId,
  resultId,
  seedManualExecutionFixture,
  seedAutomationExecutionFixture,
} = require('../helpers/executionFixtures');

function uniqueRunName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function startManualRun(fixture, client, runName = uniqueRunName('ext-run')) {
  const startRes = await client.post(
    '/api/test-runs',
    { testPlanId: fixture.ids.testPlanId, name: runName },
    201,
  );
  return {
    runId: entityId(startRes.body.testRun),
    resultObjectId: resultId(startRes.body.testRun.results[0]),
    runName,
  };
}

test('manual run supports fail, blocked and skip statuses', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);

    for (const status of ['fail', 'blocked', 'skip']) {
      const { runId, resultObjectId } = await startManualRun(fixture, employeeClient);

      const patchRes = await employeeClient.patch(
        `/api/test-runs/${runId}/results/${resultObjectId}`,
        { status, notes: `Marked as ${status}` },
        200,
      );

      const updated = patchRes.body.testRun.results.find(
        (item) => String(item._id || item.id) === String(resultObjectId),
      );
      assert.equal(updated.status, status);

      await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);
    }
  });
});

test('run can end with untested cases remaining', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const { runId } = await startManualRun(fixture, employeeClient);

    const endRes = await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);
    assert.equal(endRes.body.testRun.status, 'completed');
    assert.equal(endRes.body.testRun.results[0].status, 'untested');
  });
});

test('admin and employee can export completed run as xlsx and csv', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const { runId, resultObjectId } = await startManualRun(fixture, employeeClient);

    await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass', notes: 'Export check' },
      200,
    );
    await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);

    for (const format of ['xlsx', 'csv']) {
      const cookies = employeeClient.cookies();
      const headers = {};
      const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookieHeader) headers.Cookie = cookieHeader;
      if (cookies[CSRF_COOKIE]) headers[CSRF_HEADER] = cookies[CSRF_COOKIE];

      const exportRes = await request(harness.app)
        .get(`/api/test-runs/${runId}/export?format=${format}`)
        .set(headers)
        .buffer(true)
        .expect(200);

      assert.ok(exportRes.headers['content-disposition']?.includes(format));
      assert.ok(Number(exportRes.headers['content-length']) > 0 || (exportRes.text?.length || 0) > 0);
    }

    const adminCookies = fixture.adminClient.cookies();
    const adminHeaders = {};
    const adminCookieHeader = Object.entries(adminCookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (adminCookieHeader) adminHeaders.Cookie = adminCookieHeader;
    if (adminCookies[CSRF_COOKIE]) adminHeaders[CSRF_HEADER] = adminCookies[CSRF_COOKIE];

    const adminExport = await request(harness.app)
      .get(`/api/test-runs/${runId}/export?format=xlsx`)
      .set(adminHeaders)
      .buffer(true)
      .expect(200);
    assert.ok(Number(adminExport.headers['content-length']) > 0 || (adminExport.text?.length || 0) > 0);
  });
});

test('employee test run list only includes their runs', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const outsiderClient = await fixture.loginAs(fixture.outsider);
    const runName = uniqueRunName('scoped-run');

    const { runId } = await startManualRun(fixture, employeeClient, runName);

    const employeeList = await employeeClient.get('/api/test-runs', 200);
    const employeeRunIds = employeeList.body.testRuns.map((run) => entityId(run));
    assert.ok(employeeRunIds.includes(runId));

    const outsiderList = await outsiderClient.get('/api/test-runs', 200);
    const outsiderRunIds = outsiderList.body.testRuns.map((run) => entityId(run));
    assert.equal(outsiderRunIds.includes(runId), false);
  });
});

test('invalid base URL is rejected when starting run', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);

    const res = await employeeClient.post(
      '/api/test-runs',
      {
        testPlanId: fixture.ids.testPlanId,
        name: uniqueRunName('bad-url'),
        baseUrl: 'not-a-valid-url',
      },
      400,
    );
    assert.match(res.body.message, /invalid/i);
  });
});

test('automation run without base URL is rejected', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);

    const caseRes = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      200,
    );
    const automation = caseRes.body.testCase.automation || {};
    await fixture.adminClient.put(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      {
        automation: {
          ...automation,
          enabled: true,
          baseUrl: '',
        },
      },
      200,
    );

    const res = await fixture.adminClient.post(
      '/api/test-runs',
      {
        testPlanId: fixture.ids.testPlanId,
        name: uniqueRunName('no-base-url'),
      },
      400,
    );
    assert.match(res.body.message, /base url/i);
  });
});

test('outsider cannot export run they did not start', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const outsiderClient = await fixture.loginAs(fixture.outsider);
    const { runId, resultObjectId } = await startManualRun(fixture, employeeClient);

    await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass' },
      200,
    );
    await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);

    await outsiderClient.get(`/api/test-runs/${runId}/export?format=csv`, 403);
  });
});

test('completed run status filter returns finished runs', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const { runId, resultObjectId } = await startManualRun(fixture, employeeClient);

    await employeeClient.patch(
      `/api/test-runs/${runId}/results/${resultObjectId}`,
      { status: 'pass' },
      200,
    );
    await employeeClient.patch(`/api/test-runs/${runId}/end`, {}, 200);

    const listRes = await fixture.adminClient.get(
      `/api/test-runs?projectId=${fixture.ids.projectId}&status=completed`,
      200,
    );
    const ids = listRes.body.testRuns.map((run) => entityId(run));
    assert.ok(ids.includes(runId));
  });
});
