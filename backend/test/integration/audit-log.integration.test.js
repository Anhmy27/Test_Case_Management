const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createIntegrationHarness,
  stopSharedMongo,
} = require('../helpers/integrationHarness');

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

async function loginAsAdmin(harness) {
  await harness.createUser({
    name: 'Audit Admin',
    email: 'audit-admin@integration.test',
    password: 'admin-pass',
    role: 'admin',
  });

  const client = harness.createClient();
  await client.post(
    '/api/auth/login',
    { email: 'audit-admin@integration.test', password: 'admin-pass' },
    200,
  );

  return client;
}

test('admin creating project writes audit log entry', async () => {
  await withHarness(async (harness) => {
    const client = await loginAsAdmin(harness);

    const projectRes = await client.post(
      '/api/projects',
      { name: 'Audit Demo', code: 'AUDIT' },
      201,
    );

    assert.ok(projectRes.body.project?.id || projectRes.body.project?._id);

    const logsRes = await client.get('/api/audit-logs?limit=20', 200);

    const actions = logsRes.body.logs.map((entry) => entry.action);
    assert.ok(actions.includes('auth.login'));
    assert.ok(actions.includes('project.create'));

    const projectLog = logsRes.body.logs.find((entry) => entry.action === 'project.create');
    assert.equal(projectLog.resourceLabel, 'Audit Demo');
    assert.equal(projectLog.userEmail, 'audit-admin@integration.test');
  });
});

test('employee cannot list audit logs', async () => {
  await withHarness(async (harness) => {
    await harness.createUser({
      name: 'Audit Employee',
      email: 'audit-employee@integration.test',
      password: 'employee-pass',
      role: 'employee',
    });

    const client = harness.createClient();
    await client.post(
      '/api/auth/login',
      { email: 'audit-employee@integration.test', password: 'employee-pass' },
      200,
    );

    const res = await client.get('/api/audit-logs', 403);
    assert.match(res.body.message, /permission/i);
  });
});
