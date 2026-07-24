const test = require('node:test');
const assert = require('node:assert/strict');
const { withIntegrationHarness } = require('../helpers/integrationHarness');

function withStubbedDryRunAutomation(stubFn, runTest) {
  const dryRunService = require('../../src/services/automation/dryRunService');
  const originalDryRun = dryRunService.dryRunAutomationService;
  dryRunService.dryRunAutomationService = stubFn;

  return runTest().finally(() => {
    dryRunService.dryRunAutomationService = originalDryRun;
  });
}

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

test('append can persist screenshot and dom artifacts for an event', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Artifact Admin',
      email: 'recording-artifacts@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Artifact Project', code: 'RAT' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000' },
      201,
    );
    const sessionId = startRes.body.session.id;
    const pngBase64 = Buffer.from('integration-png').toString('base64');

    const appendRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          {
            eventId: 'evt-artifact-1',
            rawType: 'click',
            pageUrl: 'http://localhost:3000/login',
            payload: { testid: 'login-btn' },
            screenshotBase64: `data:image/png;base64,${pngBase64}`,
            domHtml: '<html><body>artifact</body></html>',
          },
        ],
      },
      200,
    );

    assert.equal(appendRes.body.session.eventCount, 1);
    assert.ok(appendRes.body.session.events[0].payload.screenshotKey.includes('/steps/evt-artifact-1.png'));
    assert.ok(appendRes.body.session.events[0].payload.domSnapshotKey.includes('/dom/evt-artifact-1.html'));

    const stopRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/stop`,
      {},
      200,
    );
    assert.equal(stopRes.body.session.draftSteps[1].screenshotKey.includes('evt-artifact-1.png'), true);
  });
});

test('admin can pause and resume a recording session while appending events', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Pause Admin',
      email: 'recording-pause@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Pause Project', code: 'RPS' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000' },
      201,
    );
    const sessionId = startRes.body.session.id;

    const pauseRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/pause`,
      {},
      200,
    );
    assert.equal(pauseRes.body.session.status, 'paused');

    const appendRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [{ rawType: 'click', payload: { testid: 'btn' } }],
      },
      200,
    );
    assert.equal(appendRes.body.session.status, 'paused');
    assert.equal(appendRes.body.session.eventCount, 1);

    const resumeRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/resume`,
      {},
      200,
    );
    assert.equal(resumeRes.body.session.status, 'recording');
  });
});

test('recording session externalizes embedded events instead of rejecting append', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Externalize Admin',
      email: 'recording-externalize@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Externalize Project', code: 'REX' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000' },
      201,
    );
    const sessionId = startRes.body.session.id;

    const batch = Array.from({ length: 100 }, (_, index) => ({
      eventId: `evt-batch-${index}`,
      rawType: 'click',
      payload: { testid: `btn-${index}` },
    }));

    for (let offset = 0; offset < 300; offset += 100) {
      const events = batch.map((event, index) => ({
        ...event,
        eventId: `evt-batch-${offset + index}`,
        payload: { testid: `btn-${offset + index}` },
      }));
      const appendRes = await adminClient.post(
        `/api/recording/sessions/${sessionId}/events`,
        { events },
        200,
      );
      assert.equal(appendRes.body.session.eventCount, offset + 100);
    }

    const overflowRes = await adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [{ eventId: 'evt-overflow', rawType: 'click', payload: { testid: 'btn-overflow' } }],
      },
      200,
    );
    assert.equal(overflowRes.body.session.eventCount, 301);
    assert.equal(overflowRes.body.session.eventsExternalized, true);
    assert.equal(overflowRes.body.session.events.length, 0);

    const getRes = await adminClient.get(`/api/recording/sessions/${sessionId}`, 200);
    assert.equal(getRes.body.session.eventsExternalized, true);
    assert.equal(getRes.body.session.eventCount, 301);
    assert.equal(getRes.body.session.events.length, 0);

    const stopRes = await adminClient.post(`/api/recording/sessions/${sessionId}/stop`, {}, 200);
    assert.equal(stopRes.body.session.status, 'ready_for_review');
    assert.equal(stopRes.body.session.eventCount, 301);
    assert.equal(stopRes.body.session.eventsExternalized, false);
    assert.equal(stopRes.body.session.events.length, 301);
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

test('SR-4.1 merge writes draft steps into a new test case version', async () => {
  await withIntegrationHarness(async (harness) => {
    const { seedAutomationExecutionFixture } = require('../helpers/executionFixtures');
    const fixture = await seedAutomationExecutionFixture(harness);

    const caseBefore = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      200,
    );
    const versionBefore = caseBefore.body.testCase.versionNumber;
    const stepsBefore = caseBefore.body.testCase.automation.steps.length;

    const startRes = await fixture.adminClient.post(
      '/api/recording/sessions',
      {
        projectId: fixture.ids.projectId,
        baseUrl: 'http://localhost:3000/login',
        testCaseEntityId: fixture.ids.testCaseId,
      },
      201,
    );
    const sessionId = startRes.body.session.id;

    await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          {
            rawType: 'input',
            pageUrl: 'http://localhost:3000/login',
            payload: { name: 'username', value: 'admin' },
          },
          {
            rawType: 'click',
            pageUrl: 'http://localhost:3000/login',
            payload: { testid: 'login-btn', role: 'button', roleName: 'Đăng nhập' },
          },
        ],
      },
      200,
    );
    await fixture.adminClient.post(`/api/recording/sessions/${sessionId}/stop`, {}, 200);

    const mergeRes = await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/merge`,
      {},
      200,
    );

    assert.equal(mergeRes.body.session.status, 'merged');
    assert.equal(mergeRes.body.mergedStepsCount, 3);
    assert.equal(mergeRes.body.testCase.entityId, fixture.ids.testCaseId);
    assert.ok(mergeRes.body.testCase.versionNumber > versionBefore);
    assert.equal(mergeRes.body.testCase.automation.enabled, true);
    assert.equal(mergeRes.body.testCase.automation.steps.length, 3);
    assert.equal(mergeRes.body.testCase.automation.steps[0].action, 'goto');
    assert.equal(mergeRes.body.testCase.automation.steps[1].action, 'type');
    assert.equal(mergeRes.body.testCase.automation.steps[1].value, 'admin');
    assert.equal(mergeRes.body.testCase.automation.steps[2].targetType, 'testid');
    assert.equal(mergeRes.body.testCase.automation.steps[2].target, 'login-btn');

    const caseAfter = await fixture.adminClient.get(
      `/api/test-cases/${fixture.ids.testCaseId}`,
      200,
    );
    assert.equal(caseAfter.body.testCase.versionNumber, mergeRes.body.testCase.versionNumber);
    assert.equal(caseAfter.body.testCase.automation.steps.length, 3);
    assert.notEqual(caseAfter.body.testCase.automation.steps.length, stepsBefore);
  });
});

test('SR-4.1 merge rejects session that is not ready_for_review', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Merge Guard Admin',
      email: 'recording-merge-guard@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Merge Guard Project', code: 'RMG' },
      201,
    );
    const projectId = projectRes.body.project.entityId || projectRes.body.project.id;

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000/login' },
      201,
    );

    await adminClient.post(
      `/api/recording/sessions/${startRes.body.session.id}/merge`,
      { testCaseId: '507f1f77bcf86cd799439011' },
      400,
    );
  });
});

test('SR-4.2 patch draft updates value, locator, and reviewStatus before merge', async () => {
  await withIntegrationHarness(async (harness) => {
    const { seedAutomationExecutionFixture } = require('../helpers/executionFixtures');
    const fixture = await seedAutomationExecutionFixture(harness);

    const startRes = await fixture.adminClient.post(
      '/api/recording/sessions',
      {
        projectId: fixture.ids.projectId,
        baseUrl: 'http://localhost:3000/login',
        testCaseEntityId: fixture.ids.testCaseId,
      },
      201,
    );
    const sessionId = startRes.body.session.id;

    await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          {
            rawType: 'input',
            pageUrl: 'http://localhost:3000/login',
            payload: { name: 'username', value: 'admin' },
          },
          {
            rawType: 'click',
            pageUrl: 'http://localhost:3000/login',
            payload: { testid: 'login-btn', role: 'button', roleName: 'Đăng nhập' },
          },
        ],
      },
      200,
    );
    await fixture.adminClient.post(`/api/recording/sessions/${sessionId}/stop`, {}, 200);

    const stopped = await fixture.adminClient.get(`/api/recording/sessions/${sessionId}`, 200);
    const typeStep = stopped.body.session.draftSteps.find((step) => step.inferredAction === 'type');
    const clickStep = stopped.body.session.draftSteps.find((step) => step.inferredAction === 'click');
    assert.ok(typeStep);
    assert.ok(clickStep);
    assert.ok(clickStep.locatorCandidates.length >= 2);

    const patchRes = await fixture.adminClient.patch(
      `/api/recording/sessions/${sessionId}/draft`,
      {
        draftSteps: [
          {
            draftStepId: typeStep.draftStepId,
            value: 'patched-admin@example.com',
          },
          {
            draftStepId: clickStep.draftStepId,
            chosenLocatorIndex: 1,
          },
        ],
      },
      200,
    );

    const patchedType = patchRes.body.session.draftSteps.find(
      (step) => step.draftStepId === typeStep.draftStepId,
    );
    const patchedClick = patchRes.body.session.draftSteps.find(
      (step) => step.draftStepId === clickStep.draftStepId,
    );
    assert.equal(patchedType.value, 'patched-admin@example.com');
    assert.equal(patchedType.reviewStatus, 'edited');
    assert.equal(patchedClick.chosenLocatorIndex, 1);
    assert.equal(patchedClick.reviewStatus, 'edited');

    const mergeRes = await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/merge`,
      {},
      200,
    );

    assert.equal(mergeRes.body.mergedStepsCount, 3);
    assert.equal(mergeRes.body.testCase.automation.steps[1].value, 'patched-admin@example.com');
    assert.equal(mergeRes.body.testCase.automation.steps[2].targetType, 'role');
    assert.equal(mergeRes.body.testCase.automation.steps[2].target, 'button');
    assert.equal(mergeRes.body.testCase.automation.steps[2].value, 'Đăng nhập');
  });
});

test('SR-4.2 patch draft rejects session that is not ready_for_review', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Patch Guard Admin',
      email: 'recording-patch-guard@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Patch Guard Project', code: 'RPG' },
      201,
    );
    const projectId = projectRes.body.project.entityId || projectRes.body.project.id;

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000/login' },
      201,
    );

    await adminClient.patch(
      `/api/recording/sessions/${startRes.body.session.id}/draft`,
      { draftSteps: [{ draftStepId: 'missing', value: 'x' }] },
      400,
    );
  });
});

test('manual draft step insert lands in the right position and survives merge', async () => {
  await withIntegrationHarness(async (harness) => {
    const { seedAutomationExecutionFixture } = require('../helpers/executionFixtures');
    const fixture = await seedAutomationExecutionFixture(harness);

    const startRes = await fixture.adminClient.post(
      '/api/recording/sessions',
      {
        projectId: fixture.ids.projectId,
        baseUrl: 'http://localhost:3000/login',
        testCaseEntityId: fixture.ids.testCaseId,
      },
      201,
    );
    const sessionId = startRes.body.session.id;

    await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/events`,
      {
        events: [
          {
            rawType: 'input',
            pageUrl: 'http://localhost:3000/login',
            payload: { name: 'username', value: 'admin' },
          },
          {
            rawType: 'click',
            pageUrl: 'http://localhost:3000/login',
            payload: { testid: 'login-btn' },
          },
        ],
      },
      200,
    );
    await fixture.adminClient.post(`/api/recording/sessions/${sessionId}/stop`, {}, 200);

    const stopped = await fixture.adminClient.get(`/api/recording/sessions/${sessionId}`, 200);
    const typeStep = stopped.body.session.draftSteps.find((step) => step.inferredAction === 'type');
    assert.ok(typeStep);

    const insertRes = await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/draft/steps`,
      {
        insertAfterDraftStepId: typeStep.draftStepId,
        inferredAction: 'hover',
        targetType: 'text',
        target: 'Chương trình học',
      },
      201,
    );

    const insertedSteps = insertRes.body.session.draftSteps;
    assert.equal(insertedSteps.length, 4);
    assert.equal(insertedSteps[2].inferredAction, 'hover');
    assert.equal(insertedSteps[2].target, 'Chương trình học');
    assert.equal(insertedSteps[2].reviewStatus, 'edited');
    assert.equal(insertedSteps[3].inferredAction, 'click');

    const mergeRes = await fixture.adminClient.post(
      `/api/recording/sessions/${sessionId}/merge`,
      {},
      200,
    );

    assert.equal(mergeRes.body.mergedStepsCount, 4);
    assert.equal(mergeRes.body.testCase.automation.steps[2].action, 'hover');
    assert.equal(mergeRes.body.testCase.automation.steps[2].targetType, 'text');
    assert.equal(mergeRes.body.testCase.automation.steps[2].target, 'Chương trình học');
  });
});

test('manual draft step insert rejects session that is not ready_for_review', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Insert Guard Admin',
      email: 'recording-insert-guard@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Insert Guard Project', code: 'RIG' },
      201,
    );
    const projectId = projectRes.body.project.entityId || projectRes.body.project.id;

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000/login' },
      201,
    );

    await adminClient.post(
      `/api/recording/sessions/${startRes.body.session.id}/draft/steps`,
      { inferredAction: 'click', targetType: 'css', target: '#ok' },
      400,
    );
  });
});

test('SR-4.3 preview dry-runs draft steps without merging test case', async () => {
  await withStubbedDryRunAutomation(
    async ({ testCaseId, user }) => ({
      dryRunId: 'integration-preview-dry-run',
      status: 'fail',
      note: 'Mock preview dry run',
      logs: ['goto ok', 'type failed: element not found'],
      failureScreenshot: '',
      failureTrace: '',
      durationMs: 15,
      testCase: {
        id: testCaseId ? String(testCaseId) : '',
        caseKey: 'TC-AUTO-001',
        title: 'Automation smoke check',
      },
      executedBy: {
        id: user?.id || '',
        name: user?.name || '',
        email: user?.email || '',
      },
    }),
    () => withIntegrationHarness(async (harness) => {
      const { seedAutomationExecutionFixture } = require('../helpers/executionFixtures');
      const fixture = await seedAutomationExecutionFixture(harness);

      const caseBefore = await fixture.adminClient.get(
        `/api/test-cases/${fixture.ids.testCaseId}`,
        200,
      );
      const versionBefore = caseBefore.body.testCase.versionNumber;

      const startRes = await fixture.adminClient.post(
        '/api/recording/sessions',
        {
          projectId: fixture.ids.projectId,
          baseUrl: 'http://localhost:3000/login',
          testCaseEntityId: fixture.ids.testCaseId,
        },
        201,
      );
      const sessionId = startRes.body.session.id;

      await fixture.adminClient.post(
        `/api/recording/sessions/${sessionId}/events`,
        {
          events: [
            {
              rawType: 'input',
              pageUrl: 'http://localhost:3000/login',
              payload: { name: 'username', value: 'admin' },
            },
          ],
        },
        200,
      );
      await fixture.adminClient.post(`/api/recording/sessions/${sessionId}/stop`, {}, 200);

      const previewRes = await fixture.adminClient.post(
        `/api/recording/sessions/${sessionId}/preview`,
        {},
        200,
      );

      assert.equal(previewRes.body.preview.sessionId, sessionId);
      assert.equal(previewRes.body.preview.previewStepsCount, 2);
      assert.ok(previewRes.body.preview.dryRunId);
      assert.ok(['pass', 'fail', 'blocked', 'skip'].includes(previewRes.body.preview.status));
      assert.ok(Array.isArray(previewRes.body.preview.logs));

      const sessionAfter = await fixture.adminClient.get(
        `/api/recording/sessions/${sessionId}`,
        200,
      );
      assert.equal(sessionAfter.body.session.status, 'ready_for_review');

      const caseAfter = await fixture.adminClient.get(
        `/api/test-cases/${fixture.ids.testCaseId}`,
        200,
      );
      assert.equal(caseAfter.body.testCase.versionNumber, versionBefore);
    }),
  );
});

test('SR-4.3 preview rejects session that is not ready_for_review', async () => {
  await withIntegrationHarness(async (harness) => {
    const admin = await harness.createUser({
      name: 'Recording Preview Guard Admin',
      email: 'recording-preview-guard@integration.test',
      password: 'pass1234',
      role: 'admin',
    });
    const adminClient = harness.createClient();
    await adminClient.post('/api/auth/login', { email: admin.email, password: 'pass1234' }, 200);

    const projectRes = await adminClient.post(
      '/api/projects',
      { name: 'Recording Preview Guard Project', code: 'RPG2' },
      201,
    );
    const projectId = projectRes.body.project.entityId || projectRes.body.project.id;

    const startRes = await adminClient.post(
      '/api/recording/sessions',
      { projectId, baseUrl: 'http://localhost:3000/login' },
      201,
    );

    await adminClient.post(
      `/api/recording/sessions/${startRes.body.session.id}/preview`,
      {},
      400,
    );
  });
});
