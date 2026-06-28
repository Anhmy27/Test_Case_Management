const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createIntegrationHarness,
  withIntegrationHarness,
} = require('../helpers/integrationHarness');
const { entityId } = require('../helpers/executionFixtures');

test('register rejects password shorter than 6 characters', async () => {
  await withIntegrationHarness(async (harness) => {
    const client = harness.createClient();
    const res = await client.post(
      '/api/auth/register',
      { name: 'Short Pass', email: 'short@integration.test', password: '12345' },
      400,
    );
    assert.ok(Array.isArray(res.body.details) || /password/i.test(res.body.message));
  });
});

test('deactivated user cannot access authenticated routes', async () => {
  await withIntegrationHarness(async (harness) => {
    const employee = await harness.createUser({
      name: 'Soon Inactive',
      email: 'inactive@integration.test',
      password: 'pass1234',
      role: 'employee',
    });

    const admin = await harness.createUser({
      name: 'Auth Admin',
      email: 'auth-admin@integration.test',
      password: 'pass1234',
      role: 'admin',
    });

    const adminClient = harness.createClient();
    await adminClient.post(
      '/api/auth/login',
      { email: admin.email, password: 'pass1234' },
      200,
    );

    await adminClient.put(
      `/api/users/${entityId(employee)}`,
      { isActive: false },
      200,
    );

    const employeeClient = harness.createClient();
    await employeeClient.post(
      '/api/auth/login',
      { email: employee.email, password: 'pass1234' },
      401,
    );
  });
});

test('password change revokes existing session', async () => {
  await withIntegrationHarness(async (harness) => {
    const user = await harness.createUser({
      name: 'Revoke Target',
      email: 'revoke@integration.test',
      password: 'old-pass-1234',
      role: 'employee',
    });

    const admin = await harness.createUser({
      name: 'Revoke Admin',
      email: 'revoke-admin@integration.test',
      password: 'admin-pass-1234',
      role: 'admin',
    });

    const userClient = harness.createClient();
    await userClient.post(
      '/api/auth/login',
      { email: user.email, password: 'old-pass-1234' },
      200,
    );
    await userClient.get('/api/auth/me', 200);

    const adminClient = harness.createClient();
    await adminClient.post(
      '/api/auth/login',
      { email: admin.email, password: 'admin-pass-1234' },
      200,
    );
    await adminClient.put(
      `/api/users/${entityId(user)}`,
      { password: 'new-pass-5678' },
      200,
    );

    await userClient.get('/api/auth/me', 401);
  });
});

test('employee cannot create projects', async () => {
  await withIntegrationHarness(async (harness) => {
    await harness.createUser({
      name: 'Employee Only',
      email: 'employee-only@integration.test',
      password: 'pass1234',
      role: 'employee',
    });

    const client = harness.createClient();
    await client.post(
      '/api/auth/login',
      { email: 'employee-only@integration.test', password: 'pass1234' },
      200,
    );

    const res = await client.post(
      '/api/projects',
      { name: 'Blocked Project', code: 'BLOCK' },
      403,
    );
    assert.match(res.body.message, /permission|admin/i);
  });
});

test('unauthenticated request to /api/auth/me returns 401', async () => {
  await withIntegrationHarness(async (harness) => {
    const client = harness.createClient();
    await client.get('/api/auth/me', 401);
  });
});
