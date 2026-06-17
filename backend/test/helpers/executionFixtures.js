function entityId(entity) {
  if (!entity) {
    return '';
  }

  if (entity.entityId) {
    return String(entity.entityId);
  }

  return String(entity.id || entity._id || '');
}

function resultId(result) {
  return String(result?.id || result?._id || '');
}

const DEFAULT_PASSWORD = 'pass1234';

async function seedManualExecutionFixture(harness) {
  const admin = await harness.createUser({
    name: 'Exec Admin',
    email: 'exec-admin@integration.test',
    password: DEFAULT_PASSWORD,
    role: 'admin',
  });

  const employee = await harness.createUser({
    name: 'Exec Employee',
    email: 'exec-employee@integration.test',
    password: DEFAULT_PASSWORD,
    role: 'employee',
  });

  const outsider = await harness.createUser({
    name: 'Exec Outsider',
    email: 'exec-outsider@integration.test',
    password: DEFAULT_PASSWORD,
    role: 'employee',
  });

  const adminClient = harness.createClient();
  await adminClient.post(
    '/api/auth/login',
    { email: admin.email, password: DEFAULT_PASSWORD },
    200,
  );

  const projectRes = await adminClient.post(
    '/api/projects',
    { name: 'Execution Project', code: 'EXEC' },
    201,
  );
  const projectId = entityId(projectRes.body.project);

  const versionRes = await adminClient.post(
    '/api/versions',
    { projectId, name: 'Release 1.0' },
    201,
  );
  const versionId = entityId(versionRes.body.version);

  const groupRes = await adminClient.post(
    '/api/test-case-groups',
    { projectId, name: 'Core Group', key: 'CORE' },
    201,
  );
  const groupId = entityId(groupRes.body.group);

  const testCaseRes = await adminClient.post(
    '/api/test-cases',
    {
      projectId,
      groupId,
      caseKey: 'TC-EXEC-001',
      title: 'Verify checkout flow',
      steps: [{ action: 'Open checkout', expected: 'Checkout page loads' }],
      automation: { enabled: false },
    },
    201,
  );
  const testCaseId = entityId(testCaseRes.body.testCase);

  const planRes = await adminClient.post(
    '/api/test-plans',
    {
      name: 'Manual Execution Plan',
      projectId,
      versionId,
      caseIds: [testCaseId],
      ownerId: entityId(admin),
      assigneeIds: [entityId(employee)],
      executionMode: 'manual',
    },
    201,
  );
  const testPlanId = entityId(planRes.body.testPlan);

  async function loginAs(user) {
    const client = harness.createClient();
    await client.post(
      '/api/auth/login',
      { email: user.email, password: DEFAULT_PASSWORD },
      200,
    );
    return client;
  }

  return {
    admin,
    employee,
    outsider,
    adminClient,
    loginAs,
    ids: {
      projectId,
      versionId,
      groupId,
      testCaseId,
      testPlanId,
    },
  };
}

module.exports = {
  DEFAULT_PASSWORD,
  entityId,
  resultId,
  seedManualExecutionFixture,
};
