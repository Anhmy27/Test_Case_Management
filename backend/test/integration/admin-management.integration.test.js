const test = require('node:test');
const assert = require('node:assert/strict');
const { withIntegrationHarness } = require('../helpers/integrationHarness');
const { entityId, seedManualExecutionFixture } = require('../helpers/executionFixtures');

async function loginAdmin(harness, email = 'mgmt-admin@integration.test') {
  const admin = await harness.createUser({
    name: 'Mgmt Admin',
    email,
    password: 'pass1234',
    role: 'admin',
  });

  const client = harness.createClient();
  await client.post(
    '/api/auth/login',
    { email: admin.email, password: 'pass1234' },
    200,
  );

  return { admin, client };
}

test('admin CRUD for versions, groups and issue types', async () => {
  await withIntegrationHarness(async (harness) => {
    const { client } = await loginAdmin(harness);

    const projectRes = await client.post(
      '/api/projects',
      { name: 'Mgmt Project', code: 'MGMT' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    const versionRes = await client.post(
      '/api/versions',
      { projectId, name: 'v1.0.0', notes: 'Initial release' },
      201,
    );
    const versionId = entityId(versionRes.body.version);

    await client.put(
      `/api/versions/${versionId}`,
      { notes: 'Updated notes' },
      200,
    );

    const groupRes = await client.post(
      '/api/test-case-groups',
      { projectId, name: 'Smoke Group', key: 'SMOKE' },
      201,
    );
    const groupId = entityId(groupRes.body.group);

    const issueTypeRes = await client.post(
      '/api/issue-types',
      { name: 'Bug', idjira: '1' },
      201,
    );
    const issueTypeId = entityId(issueTypeRes.body.issueType);

    const versionsList = await client.get(`/api/versions?projectId=${projectId}`, 200);
    assert.ok(versionsList.body.versions.some((v) => entityId(v) === versionId));

    const groupsList = await client.get(`/api/test-case-groups?projectId=${projectId}`, 200);
    assert.ok(groupsList.body.groups.some((g) => entityId(g) === groupId));

    const issueTypesList = await client.get('/api/issue-types', 200);
    assert.ok(issueTypesList.body.issueTypes.some((t) => entityId(t) === issueTypeId));

    await client.delete(`/api/issue-types/${issueTypeId}`, 204);
    await client.delete(`/api/test-case-groups/${groupId}`, 204);
    await client.delete(`/api/versions/${versionId}`, 204);
  });
});

test('duplicate project code is rejected', async () => {
  await withIntegrationHarness(async (harness) => {
    const { client } = await loginAdmin(harness, 'dup-admin@integration.test');

    await client.post(
      '/api/projects',
      { name: 'First Project', code: 'DUPCODE' },
      201,
    );

    const dupRes = await client.post(
      '/api/projects',
      { name: 'Second Project', code: 'DUPCODE' },
      409,
    );
    assert.match(dupRes.body.message, /already|duplicate|exists/i);
  });
});

test('duplicate group key in same project is rejected', async () => {
  await withIntegrationHarness(async (harness) => {
    const { client } = await loginAdmin(harness, 'grp-admin@integration.test');

    const projectRes = await client.post(
      '/api/projects',
      { name: 'Group Dup Project', code: 'GRPDUP' },
      201,
    );
    const projectId = entityId(projectRes.body.project);

    await client.post(
      '/api/test-case-groups',
      { projectId, name: 'Group A', key: 'KEYA' },
      201,
    );

    const dupRes = await client.post(
      '/api/test-case-groups',
      { projectId, name: 'Group B', key: 'KEYA' },
      409,
    );
    assert.match(dupRes.body.message, /already|duplicate|exists/i);
  });
});

test('admin can create and list users; cannot delete own account', async () => {
  await withIntegrationHarness(async (harness) => {
    const { admin, client } = await loginAdmin(harness, 'users-admin@integration.test');

    const createRes = await client.post(
      '/api/users',
      {
        name: 'New Employee',
        email: 'new-employee@integration.test',
        password: 'pass1234',
        role: 'employee',
      },
      201,
    );
    assert.equal(createRes.body.user.role, 'employee');

    const listRes = await client.get('/api/users', 200);
    const emails = listRes.body.users.map((u) => u.email);
    assert.ok(emails.includes('new-employee@integration.test'));

    const selfDelete = await client.delete(`/api/users/${entityId(admin)}`, 400);
    assert.match(selfDelete.body.message, /cannot delete your own account/i);
  });
});

test('employee cannot list or mutate users', async () => {
  await withIntegrationHarness(async (harness) => {
    await loginAdmin(harness, 'users-guard-admin@integration.test');
    await harness.createUser({
      name: 'Guard Employee',
      email: 'guard-employee@integration.test',
      password: 'pass1234',
      role: 'employee',
    });

    const employeeClient = harness.createClient();
    await employeeClient.post(
      '/api/auth/login',
      { email: 'guard-employee@integration.test', password: 'pass1234' },
      200,
    );

    await employeeClient.get('/api/users', 403);
    await employeeClient.post(
      '/api/users',
      { name: 'Hack', email: 'hack@integration.test', password: 'pass1234' },
      403,
    );
  });
});

test('project update persists Jira metadata fields', async () => {
  await withIntegrationHarness(async (harness) => {
    const { client } = await loginAdmin(harness, 'jira-meta-admin@integration.test');

    const createRes = await client.post(
      '/api/projects',
      { name: 'Jira Meta', code: 'JIRA' },
      201,
    );
    const projectId = entityId(createRes.body.project);

    await client.put(
      `/api/projects/${projectId}`,
      {
        pid: '12345',
        jiraProjectKey: 'TCM',
        jiraProductKey: 'PROD',
      },
      200,
    );

    const getRes = await client.get(`/api/projects/${projectId}`, 200);
    assert.equal(getRes.body.project.pid, '12345');
    assert.equal(getRes.body.project.jiraProjectKey, 'TCM');
  });
});

test('cannot delete project that has related records', async () => {
  await withIntegrationHarness(async (harness) => {
    const fixture = await seedManualExecutionFixture(harness);
    const res = await fixture.adminClient.delete(
      `/api/projects/${fixture.ids.projectId}`,
      409,
    );
    assert.match(res.body.message, /related records/i);
  });
});

test('admin can recreate user when email belongs to inactive account', async () => {
  await withIntegrationHarness(async (harness) => {
    const { client } = await loginAdmin(harness, 'users-reactivate-admin@integration.test');
    const email = 'reactivate-employee@integration.test';

    const firstCreate = await client.post(
      '/api/users',
      {
        name: 'Old Employee',
        email,
        password: 'old-pass1234',
        role: 'employee',
      },
      201,
    );
    const userId = entityId(firstCreate.body.user);

    await client.delete(`/api/users/${userId}`, 200);

    const recreate = await client.post(
      '/api/users',
      {
        name: 'New Employee',
        email,
        password: 'new-pass1234',
        role: 'employee',
        isActive: true,
      },
      201,
    );
    assert.equal(recreate.body.user.id, userId);
    assert.equal(recreate.body.user.name, 'New Employee');
    assert.equal(recreate.body.user.isActive, true);

    const loginClient = harness.createClient();
    await loginClient.post('/api/auth/login', { email, password: 'new-pass1234' }, 200);
    await loginClient.post('/api/auth/login', { email, password: 'old-pass1234' }, 401);
  });
});

test('admin cannot create user when email belongs to active account', async () => {
  await withIntegrationHarness(async (harness) => {
    const { client } = await loginAdmin(harness, 'users-dup-active-admin@integration.test');
    const email = 'dup-active-employee@integration.test';

    await client.post(
      '/api/users',
      {
        name: 'Active Employee',
        email,
        password: 'pass1234',
        role: 'employee',
      },
      201,
    );

    const dupRes = await client.post(
      '/api/users',
      {
        name: 'Duplicate Employee',
        email,
        password: 'pass1234',
        role: 'employee',
      },
      409,
    );
    assert.match(dupRes.body.message, /email is already in use/i);
  });
});
