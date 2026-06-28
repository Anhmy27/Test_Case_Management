const test = require('node:test');
const assert = require('node:assert/strict');
const { withIntegrationHarness } = require('../helpers/integrationHarness');
const { seedAutomationExecutionFixture } = require('../helpers/executionFixtures');

test('dry run rejects disallowed base URL (SSRF guard)', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);

    const res = await fixture.adminClient.post(
      '/api/automation/dry-run',
      {
        testCaseId: fixture.ids.testCaseId,
        baseUrl: 'http://169.254.169.254/',
        automation: {
          enabled: true,
          baseUrl: 'http://169.254.169.254/',
          steps: [{ action: 'goto', target: '/', expected: 'Blocked' }],
        },
      },
      400,
    );
    assert.match(res.body.message, /not allowed|blocked|invalid/i);
  });
});

test('dry run requires enabled automation with steps', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);

    const disabledRes = await fixture.adminClient.post(
      '/api/automation/dry-run',
      {
        baseUrl: 'http://localhost:3000',
        automation: {
          enabled: false,
          steps: [{ action: 'goto', target: '/', expected: 'x' }],
        },
      },
      400,
    );
    assert.match(disabledRes.body.message, /enabled/i);

    const noStepsRes = await fixture.adminClient.post(
      '/api/automation/dry-run',
      {
        baseUrl: 'http://localhost:3000',
        automation: {
          enabled: true,
          steps: [],
        },
      },
      400,
    );
    assert.match(noStepsRes.body.message, /step/i);
  });
});

test('employee cannot trigger automation dry run', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);
    const employeeClient = await fixture.loginAs(fixture.employee);

    await employeeClient.post(
      '/api/automation/dry-run',
      {
        baseUrl: 'http://localhost:3000',
        automation: {
          enabled: true,
          steps: [{ action: 'goto', target: '/', expected: 'x' }],
        },
      },
      403,
    );
  });
});

test('dry run requires baseUrl when automation has no default', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedAutomationExecutionFixture(harness);

    const res = await fixture.adminClient.post(
      '/api/automation/dry-run',
      {
        automation: {
          enabled: true,
          baseUrl: '',
          steps: [{ action: 'goto', target: '/', expected: 'Page loads' }],
        },
      },
      400,
    );
    assert.match(res.body.message, /baseUrl/i);
  });
});
