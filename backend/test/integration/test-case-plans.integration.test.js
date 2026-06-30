const test = require('node:test');
const assert = require('node:assert/strict');
const { withIntegrationHarness } = require('../helpers/integrationHarness');
const { entityId, seedManualExecutionFixture } = require('../helpers/executionFixtures');

test('duplicate caseKey in same group is rejected', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    const dupRes = await fixture.adminClient.post(
      '/api/test-cases',
      {
        projectId: fixture.ids.projectId,
        groupId: fixture.ids.groupId,
        caseKey: 'TC-EXEC-001',
        title: 'Duplicate key case',
        automation: { enabled: false },
      },
      409,
    );
    assert.match(dupRes.body.message, /already|duplicate|exists/i);
  });
});

test('test case update accepts null step expected (legacy client payload)', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    const res = await fixture.adminClient.put(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      {
        priority: 'highest',
        steps: [{ order: 1, action: 'Open endpoint groups menu', expected: null }],
      },
      200,
    );
    assert.equal(res.body.testCase.priority, 'highest');
    assert.equal(res.body.testCase.steps[0].action, 'Open endpoint groups menu');
  });
});

test('test case update creates version history', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    await fixture.adminClient.put(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      { title: 'Updated checkout title', steps: [{ action: 'New step', expected: 'New result' }] },
      200,
    );

    const versionsRes = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}/versions`,
      200,
    );
    assert.ok(versionsRes.body.versions.length >= 2);
    assert.ok(
      versionsRes.body.versions.some((v) => /Updated checkout title/i.test(v.title || '')),
    );
  });
});

test('test plan requires at least one test case', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    const res = await fixture.adminClient.post(
      '/api/test-plans',
      {
        name: 'Empty Plan',
        projectId: fixture.ids.projectId,
        versionId: fixture.ids.versionId,
        caseIds: [],
        ownerId: entityId(fixture.admin),
        assigneeIds: [entityId(fixture.employee)],
      },
      400,
    );
    assert.ok(Array.isArray(res.body.details) || /case/i.test(res.body.message));
  });
});

test('duplicate test plan name in same project and version is rejected', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    const dupRes = await fixture.adminClient.post(
      '/api/test-plans',
      {
        name: 'Manual Execution Plan',
        projectId: fixture.ids.projectId,
        versionId: fixture.ids.versionId,
        caseIds: [fixture.ids.testCaseId],
        ownerId: entityId(fixture.admin),
        assigneeIds: [entityId(fixture.employee)],
      },
      409,
    );
    assert.match(dupRes.body.message, /already|duplicate|exists/i);
  });
});

test('assign endpoint requires at least one assignee', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);

    const res = await fixture.adminClient.put(
      `/api/test-plans/${fixture.ids.testPlanId}/assign`,
      { assigneeIds: [] },
      400,
    );
    assert.ok(Array.isArray(res.body.details) || /assignee/i.test(res.body.message));
  });
});

test('admin can create second test plan with different name', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const secondName = `Second Plan ${Date.now()}`;

    const createRes = await fixture.adminClient.post(
      '/api/test-plans',
      {
        name: secondName,
        projectId: fixture.ids.projectId,
        versionId: fixture.ids.versionId,
        caseIds: [fixture.ids.testCaseId],
        ownerId: entityId(fixture.admin),
        assigneeIds: [entityId(fixture.employee)],
      },
      201,
    );

    assert.equal(createRes.body.testPlan.name, secondName);
    assert.equal(createRes.body.testPlan.items.length, 1);
  });
});
