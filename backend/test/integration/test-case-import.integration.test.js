const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createIntegrationHarness,
  stopSharedMongo,
} = require('../helpers/integrationHarness');
const { seedManualExecutionFixture } = require('../helpers/executionFixtures');
const {
  buildDefaultImportBuffer,
  buildImportWorkbookBuffer,
} = require('../helpers/testCaseImportFixtures');

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

function importFile(client, projectId, buffer, expectedStatus = 200) {
  return client.postMultipart(
    '/api/test-cases/import',
    {
      projectId,
      strict: 'true',
    },
    {
      fieldName: 'file',
      buffer,
      filename: 'test-cases.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    expectedStatus,
  );
}

test('admin import creates manual test case from TestCases sheet', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const caseKey = `IMPORT-${Date.now()}`;
    const buffer = buildDefaultImportBuffer({ 'Case Key': caseKey });

    const response = await importFile(fixture.adminClient, fixture.ids.projectId, buffer);
    assert.equal(response.body.created.length, 1);
    assert.equal(response.body.errors.length, 0);
    assert.equal(response.body.created[0].caseKey, caseKey);

    const listRes = await fixture.adminClient.get(
      `/api/test-cases?projectId=${fixture.ids.projectId}`,
      200,
    );
    const imported = listRes.body.testCases.find((item) => item.caseKey === caseKey);
    assert.ok(imported);
    assert.equal(imported.title, 'Imported via Excel');
    assert.equal(imported.automation?.enabled, false);
    assert.equal(imported.steps.length, 1);
    assert.equal(imported.steps[0].action, 'Open page');
  });
});

test('import reads TestCases sheet even when guide tab is listed first', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const caseKey = `IMPORT-GUIDE-${Date.now()}`;
    const buffer = buildDefaultImportBuffer(
      { 'Case Key': caseKey },
      { sheetOrder: 'guide-first' },
    );

    const response = await importFile(fixture.adminClient, fixture.ids.projectId, buffer);
    assert.equal(response.body.created.length, 1);
    assert.equal(response.body.created[0].caseKey, caseKey);
  });
});

test('import with strict mode rejects invalid priority', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const buffer = buildDefaultImportBuffer({
      'Case Key': `IMPORT-BAD-PRI-${Date.now()}`,
      Priority: 'urgent',
    });

    const response = await importFile(fixture.adminClient, fixture.ids.projectId, buffer);
    assert.equal(response.body.created.length, 0);
    assert.equal(response.body.errors.length, 1);
    assert.match(response.body.errors[0].error, /invalid priority/i);
  });
});

test('import with strict mode rejects legacy critical priority', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const buffer = buildDefaultImportBuffer({
      'Case Key': `IMPORT-CRIT-PRI-${Date.now()}`,
      Priority: 'critical',
    });

    const response = await importFile(fixture.adminClient, fixture.ids.projectId, buffer);
    assert.equal(response.body.created.length, 0);
    assert.equal(response.body.errors.length, 1);
    assert.match(response.body.errors[0].error, /invalid priority/i);
  });
});

test('import rejects duplicate case key in group', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const caseKey = `IMPORT-DUP-${Date.now()}`;
    const buffer = buildDefaultImportBuffer({ 'Case Key': caseKey });

    await importFile(fixture.adminClient, fixture.ids.projectId, buffer);
    const second = await importFile(fixture.adminClient, fixture.ids.projectId, buffer);

    assert.equal(second.body.created.length, 0);
    assert.equal(second.body.errors.length, 1);
    assert.match(second.body.errors[0].error, /already exists/i);
  });
});

test('import requires group key or group name', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const buffer = buildDefaultImportBuffer({
      'Case Key': `IMPORT-NO-GROUP-${Date.now()}`,
      'Group Key': '',
      'Group Name': '',
    });

    const response = await importFile(fixture.adminClient, fixture.ids.projectId, buffer);
    assert.equal(response.body.created.length, 0);
    assert.equal(response.body.errors.length, 1);
    assert.match(response.body.errors[0].error, /group key or group name/i);
  });
});

test('import supports extra manual steps beyond template defaults', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const caseKey = `IMPORT-STEP6-${Date.now()}`;
    const buffer = buildImportWorkbookBuffer([
      {
        'Group Key': 'CORE',
        'Group Name': '',
        'Case Key': caseKey,
        Title: 'Six step import',
        Priority: 'low',
        Severity: 'minor',
        Type: 'regression',
        Description: 'Has a sixth step',
        'Step 1 Action': 'Step one',
        'Step 1 Expected': 'One ok',
        'Step 2 Action': 'Step two',
        'Step 2 Expected': '',
        'Step 3 Action': '',
        'Step 3 Expected': '',
        'Step 4 Action': '',
        'Step 4 Expected': '',
        'Step 5 Action': '',
        'Step 5 Expected': '',
        'Step 6 Action': 'Step six',
        'Step 6 Expected': 'Six ok',
        'Expected Result': 'All steps done',
      },
    ]);

    const response = await importFile(fixture.adminClient, fixture.ids.projectId, buffer);
    assert.equal(response.body.created.length, 1);

    const listRes = await fixture.adminClient.get(
      `/api/test-cases?projectId=${fixture.ids.projectId}`,
      200,
    );
    const imported = listRes.body.testCases.find((item) => item.caseKey === caseKey);
    assert.ok(imported);
    assert.equal(imported.steps.length, 3);
    assert.equal(imported.steps[0].action, 'Step one');
    assert.equal(imported.steps[2].action, 'Step six');
    assert.equal(imported.steps[2].expected, 'Six ok');
  });
});

test('employee cannot import test cases', async () => {
  await withHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);
    const buffer = buildDefaultImportBuffer({
      'Case Key': `IMPORT-FORBIDDEN-${Date.now()}`,
    });

    await employeeClient.postMultipart(
      '/api/test-cases/import',
      {
        projectId: fixture.ids.projectId,
        strict: 'true',
      },
      {
        fieldName: 'file',
        buffer,
        filename: 'test-cases.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      403,
    );
  });
});
