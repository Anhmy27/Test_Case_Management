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

test('register → me → logout auth cookie flow', async () => {
  await withHarness(async (harness) => {
    const client = harness.createClient();

    const registerRes = await client.post(
      '/api/auth/register',
      {
        name: 'Integration User',
        email: 'employee@integration.test',
        password: 'secret123',
      },
      201,
    );

    assert.equal(registerRes.body.user.email, 'employee@integration.test');
    assert.equal(registerRes.body.user.role, 'employee');
    assert.ok(registerRes.body.csrfToken, 'register should return CSRF token');
    assert.ok(client.getCsrfToken(), 'register should set CSRF cookie');
    assert.ok(client.cookies().tcm_access_token, 'register should set access cookie');

    const meRes = await client.get('/api/auth/me', 200);
    assert.equal(meRes.body.user.email, 'employee@integration.test');
    assert.ok(meRes.body.csrfToken, 'me should return CSRF token for cross-origin clients');

    await client.post('/api/auth/logout', {}, 204);

    await client.get('/api/auth/me', 401);
  });
});

test('login rejects invalid credentials', async () => {
  await withHarness(async (harness) => {
    await harness.createUser({
      name: 'Known User',
      email: 'known@integration.test',
      password: 'correct-pass',
    });

    const client = harness.createClient();
    const res = await client.post(
      '/api/auth/login',
      { email: 'known@integration.test', password: 'wrong-pass' },
      401,
    );

    assert.match(res.body.message, /invalid email or password/i);
  });
});

test('mutating API without CSRF token is rejected', async () => {
  await withHarness(async (harness) => {
    await harness.createUser({
      name: 'Admin User',
      email: 'admin@integration.test',
      password: 'admin-pass',
      role: 'admin',
    });

    const agent = require('supertest').agent(harness.app);
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: 'admin@integration.test', password: 'admin-pass' })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] || [];
    const accessCookie = cookies.find((entry) => entry.startsWith('tcm_access_token='));
    assert.ok(accessCookie, 'login should set access cookie');

    const res = await agent
      .post('/api/projects')
      .set('Cookie', accessCookie.split(';')[0])
      .send({ name: 'No CSRF', code: 'NOCSRF' })
      .expect(403);

    assert.match(res.body.message, /csrf/i);
  });
});

test('register duplicate email does not consume success quota', async () => {
  process.env.AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_EMAIL = '1';

  await withHarness(async (harness) => {
    const client = harness.createClient();
    const payload = {
      name: 'First User',
      email: 'duplicate@integration.test',
      password: 'secret123',
    };

    await client.post('/api/auth/register', payload, 201);

    const duplicateRes = await client.post(
      '/api/auth/register',
      { ...payload, name: 'Second User' },
      409,
    );

    assert.match(duplicateRes.body.message, /already in use/i);

    const thirdClient = harness.createClient();
    const thirdRes = await thirdClient.post(
      '/api/auth/register',
      {
        name: 'Third User',
        email: 'another@integration.test',
        password: 'secret123',
      },
      201,
    );

    assert.equal(thirdRes.body.user.email, 'another@integration.test');
  });

  delete process.env.AUTH_REGISTER_SUCCESS_LIMIT_MAX_PER_EMAIL;
});
