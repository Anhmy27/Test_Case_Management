const test = require('node:test');
const assert = require('node:assert/strict');
const { withIntegrationHarness } = require('../helpers/integrationHarness');

function entityId(entity) {
  return String(entity?.id || entity?._id || '');
}

test('admin can start, append events, stop, and view a recording session', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Admin',
      email: 'recording-admin@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post(
      '/api/auth/login',
      { email: admin.email, password: 'pass1234' },
      200,
    );

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Project', code: 'REC' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      {
        projectId,
        baseUrl: 'http://localhost:3000',
        testCaseEntityId: 'TC_DEMO',
      },
      201,
    );

    const sessionId = startRes.body.session.id;
    assert.equal(startRes.body.session.status, 'recording');
    assert.equal(startRes.body.session.baseUrl, 'http://localhost:3000/');

    const appendRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          {
            rawType: 'click',
            pageUrl: 'http://localhost:3000/login',
            payload: { tagName: 'button' },
          },
          {
            rawType: 'input',
            pageUrl: 'http://localhost:3000/login',
            payload: { value: 'admin' },
          },
        ],
      },
      200,
    );
    assert.equal(appendRes.body.session.eventCount, 2);

    const stopRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/stop`,
      {},
      200,
    );
    assert.equal(stopRes.body.session.status, 'ready_for_review');
    assert.equal(stopRes.body.session.events.length, 2);
    assert.equal(stopRes.body.session.eventCount, 2);
    assert.equal(stopRes.body.session.semanticActions.length, 2);
    assert.equal(stopRes.body.session.draftSteps.length, 3);
    assert.equal(stopRes.body.session.draftSteps[0].inferredAction, 'goto');

    const getRes = await adminClient.get(
      `/api/recording/sessions/${sessionId}`,
      200,
    );
    assert.equal(getRes.body.session.id, sessionId);
    assert.equal(getRes.body.session.events[0].rawType, 'click');

    const discardRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/discard`,
      { reason: 'integration cleanup' },
      200,
    );
    assert.equal(discardRes.body.session.status, 'discarded');
  });
});

test('employee cannot use recording APIs', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Admin 2',
      email: 'recording-admin2@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const employee = await harness.createUser({
      name: 'Recording Employee',
      email: 'recording-employee@integration.test',
      password: 'pass1234',
      role: 'employee',
    });

    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);
    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Project 2', code: 'RC2' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const employeeClient = harness.createClient();
    await employeeClient.post('/api/auth/login', { email: employee.email, password: 'pass1234' }, 200);

    await employeeClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000' },
      403,
    );
  });
});

test('eventCount stays in sync with events length across batched appends', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Counter Admin',
      email: 'recording-counter@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Counter Project', code: 'RCC' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000' },
      201,
    );
    const sessionId = startRes.body.session.id;

    const firstBatch = await adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          { rawType: 'click', payload: { n: 1 } },
          { rawType: 'input', payload: { n: 2 } },
        ],
      },
      200,
    );
    assert.equal(firstBatch.body.session.eventCount, 2);
    assert.equal(firstBatch.body.session.events.length, 2);
    assert.deepEqual(
      firstBatch.body.session.events.map((event) => event.sequence),
      [0, 1],
    );

    const secondBatch = await adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          { rawType: 'navigation', payload: { n: 3 } },
        ],
      },
      200,
    );
    assert.equal(secondBatch.body.session.eventCount, 3);
    assert.equal(secondBatch.body.session.events.length, 3);
    assert.deepEqual(
      secondBatch.body.session.events.map((event) => event.sequence),
      [0, 1, 2],
    );

    const stopRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/stop`,
      {},
      200,
    );
    assert.equal(stopRes.body.session.eventCount, stopRes.body.session.events.length);

    const getRes = await adminClient.get(
      `/api/recording/sessions/${sessionId}`,
      200,
    );
    assert.equal(getRes.body.session.eventCount, 3);
    assert.equal(getRes.body.session.events.length, 3);
  });
});

test('stop runs SR-1 pipeline: merge typing, semantic, draft steps', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Pipeline Admin',
      email: 'recording-pipeline@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Pipeline Project', code: 'RPL' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000/login' },
      201,
    );
    const sessionId = startRes.body.session.id;

    await adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          { rawType: 'input', pageUrl: 'http://localhost:3000/login', payload: { name: 'username', value: 'a' } },
          { rawType: 'keypress', pageUrl: 'http://localhost:3000/login', payload: { name: 'username', value: 'd' } },
          { rawType: 'input', pageUrl: 'http://localhost:3000/login', payload: { name: 'username', value: 'min' } },
          { rawType: 'click', pageUrl: 'http://localhost:3000/login', payload: { testid: 'login-btn' } },
          {
            rawType: 'click',
            pageUrl: 'http://localhost:3000/login',
            payload: { testid: 'login-btn' },
          },
        ],
      },
      200,
    );

    const stopRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/stop`,
      {},
      200,
    );

    assert.equal(stopRes.body.session.events.length, 2);
    assert.equal(stopRes.body.session.eventCount, 2);
    assert.equal(stopRes.body.session.semanticActions[0].semanticId, 'FILL_USERNAME');
    assert.equal(stopRes.body.session.draftSteps[1].inferredAction, 'type');
    assert.equal(stopRes.body.session.draftSteps[1].value, 'admin');
    assert.equal(stopRes.body.session.draftSteps[2].target, 'login-btn');
  });
});

test('recording session flow does not change saved test case automation steps', async () => {
  await withIntegrationHarness(async (harness) => {
    const { seedAutomationExecutionFixture } = require('../helpers/executionFixtures');
    const fixture = await seedAutomationExecutionFixture(harness);

    const caseBefore = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      200,
    );
    const stepsBefore = caseBefore.body.testCase.automation.steps.length;
    const firstAction = caseBefore.body.testCase.automation.steps[0]?.action;

    const startRes = await fixture.adminClient.post(
      '/api/recording/sessions',
      {
        projectId: fixture.ids.projectId,
        baseUrl: 'http://localhost:3000',
        testCaseEntityId: fixture.ids.testCaseId,
      },
      201,
    );
    const sessionId = startRes.body.session.id;

    await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [{ rawType: 'click', payload: { button: 'login' } }],
      },
      200,
    );
    await fixture.adminClient.post(`/api/recording/sessions/${sessionId}/stop`, {}, 200);

    const caseAfter = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      200,
    );
    assert.equal(caseAfter.body.testCase.automation.steps.length, stepsBefore);
    assert.equal(caseAfter.body.testCase.automation.steps[0].action, firstAction);
  });
});
