/**
 * Live smoke tests against the configured MONGO_URI (.env).
 * Creates isolated SMK_* entities and cleans them up — does not wipe the database.
 *
 * Usage: node scripts/liveDbSmoke.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { CSRF_COOKIE, CSRF_HEADER } = require('../src/utils/authCookies');
const { connectDatabase } = require('../src/config/db');
const { seedAdminIfNeeded } = require('../src/seedAdmin');
const { entityId, resultId } = require('../test/helpers/executionFixtures');

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[${mark}] ${name}${suffix}`);
}

function parseSetCookieHeaders(setCookieHeaders = []) {
  const cookies = {};
  for (const header of setCookieHeaders) {
    const [pair] = String(header).split(';');
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    cookies[pair.slice(0, separator).trim()] = pair.slice(separator + 1).trim();
  }
  return cookies;
}

function formatCookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function createApiClient(app) {
  const agent = request.agent(app);
  let cookies = {};

  function mergeResponseCookies(response) {
    cookies = { ...cookies, ...parseSetCookieHeaders(response.headers['set-cookie']) };
  }

  function withAuthHeaders() {
    const headers = {};
    const cookieHeader = formatCookieHeader(cookies);
    if (cookieHeader) headers.Cookie = cookieHeader;
    if (cookies[CSRF_COOKIE]) headers[CSRF_HEADER] = cookies[CSRF_COOKIE];
    return headers;
  }

  async function requestWith(method, path, body, expectedStatus) {
    let builder = agent[method](path).set(withAuthHeaders());
    if (body !== undefined) builder = builder.send(body);
    const response = await builder.expect(expectedStatus);
    mergeResponseCookies(response);
    return response;
  }

  return {
    get: (path, status) => requestWith('get', path, undefined, status),
    post: (path, body, status) => requestWith('post', path, body, status),
    put: (path, body, status) => requestWith('put', path, body, status),
    patch: (path, body, status) => requestWith('patch', path, body, status),
    delete: (path, status) => requestWith('delete', path, undefined, status),
  };
}

async function safeDelete(client, path) {
  try {
    await client.delete(path, 204);
  } catch {
    try {
      await client.delete(path, 200);
    } catch {
      // ignore cleanup failures
    }
  }
}

async function run() {
  console.log('=== Live DB Smoke Tests ===');
  console.log(`Mongo: ${process.env.MONGO_URI || '(missing)'}`);

  if (!process.env.MONGO_URI) {
    record('MONGO_URI configured', false, 'Set MONGO_URI in backend/.env');
    process.exit(1);
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    record('Admin credentials configured', false, 'Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
    process.exit(1);
  }

  try {
    await connectDatabase();
    record('MongoDB connection', mongoose.connection.readyState === 1, mongoose.connection.host);
  } catch (error) {
    record('MongoDB connection', false, error.message);
    process.exit(1);
  }

  await seedAdminIfNeeded();

  const app = require('../src/app');
  const admin = createApiClient(app);
  const cleanup = {
    projectId: '',
    versionId: '',
    groupId: '',
    testCaseId: '',
    testPlanId: '',
    runId: '',
    employeeUserId: '',
  };

  const stamp = Date.now();
  const smkCode = `SMK${String(stamp).slice(-6)}`;

  try {
    // --- Auth ---
    try {
      const loginRes = await admin.post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, 200);
      const role = loginRes.body?.user?.role;
      record('Admin login', role === 'admin', `role=${role || 'unknown'}`);
    } catch (error) {
      record('Admin login', false, error.message);
      return;
    }

    try {
      const meRes = await admin.get('/api/auth/me', 200);
      record('Auth /me', meRes.body?.user?.email === ADMIN_EMAIL, meRes.body?.user?.email);
    } catch (error) {
      record('Auth /me', false, error.message);
    }

    // --- Read-only catalog ---
    const readChecks = [
      ['List projects', '/api/projects', 'projects'],
      ['List users', '/api/users', 'users'],
      ['List issue types', '/api/issue-types', 'issueTypes'],
      ['List test plans', '/api/test-plans', 'testPlans'],
      ['List test runs', '/api/test-runs', 'testRuns'],
      ['Dashboard', '/api/dashboard', 'summary'],
      ['Audit logs', '/api/audit-logs?page=1&limit=5', 'logs'],
      ['Jira profile', '/api/jira/profile', 'profile'],
    ];

    for (const [label, path, key] of readChecks) {
      try {
        const res = await admin.get(path, 200);
        const payload = res.body?.[key];
        const ok = Array.isArray(payload) || (key === 'summary' && res.body) || (key === 'profile' && res.body);
        const count = Array.isArray(payload) ? payload.length : 'ok';
        record(label, Boolean(ok), `count=${count}`);
      } catch (error) {
        record(label, false, error.message);
      }
    }

    // --- Jira log-bugs (scoped) ---
    try {
      const projectsRes = await admin.get('/api/projects', 200);
      const projects = projectsRes.body.projects || [];
      let logBugsOk = false;
      let logBugsDetail = 'skipped — no projects';

      for (const project of projects) {
        const projectId = entityId(project);
        if (!projectId) continue;
        try {
          const logBugsRes = await admin.get(
            `/api/jira/log-bugs?projectId=${encodeURIComponent(projectId)}&page=1&limit=10`,
            200,
          );
          const total = logBugsRes.body?.pagination?.total ?? logBugsRes.body?.logBugs?.length ?? 0;
          logBugsOk = true;
          logBugsDetail = `project=${project.name}, total=${total}`;
          break;
        } catch {
          // try next project
        }
      }
      record('Jira log-bugs list', logBugsOk, logBugsDetail);
    } catch (error) {
      record('Jira log-bugs list', false, error.message);
    }

    // --- CSRF guard ---
    try {
      const bareAgent = request(app);
      await bareAgent.post('/api/projects').send({ name: 'csrf-probe', code: 'CSRF' }).expect(403);
      record('CSRF protection on mutating API', true);
    } catch (error) {
      record('CSRF protection on mutating API', false, error.message);
    }

    // --- Writable E2E chain (isolated + cleanup) ---
    const User = require('../src/models/User');
    const employeeEmail = `smk-employee-${stamp}@smoke.test`;
    const employeePassword = `SmkPass-${stamp}!`;

    try {
      const employeeUser = await User.create({
        name: 'SMK Smoke Employee',
        email: employeeEmail,
        passwordHash: await bcrypt.hash(employeePassword, 10),
        role: 'employee',
      });
      cleanup.employeeUserId = String(employeeUser._id);

      const meAdmin = await admin.get('/api/auth/me', 200);
      const adminId = entityId(meAdmin.body.user);

      const projectRes = await admin.post('/api/projects', { name: `SMK Project ${stamp}`, code: smkCode }, 201);
      cleanup.projectId = entityId(projectRes.body.project);

      const versionRes = await admin.post('/api/versions', { projectId: cleanup.projectId, name: 'SMK v1' }, 201);
      cleanup.versionId = entityId(versionRes.body.version);

      const groupRes = await admin.post(
        '/api/test-case-groups',
        { projectId: cleanup.projectId, name: 'SMK Group', key: `SMK${stamp}` },
        201,
      );
      cleanup.groupId = entityId(groupRes.body.group);

      const caseRes = await admin.post(
        '/api/test-cases',
        {
          projectId: cleanup.projectId,
          groupId: cleanup.groupId,
          caseKey: `TC-${smkCode}-001`,
          title: 'SMK smoke case',
          steps: [{ action: 'Open app', expected: 'App loads' }],
          automation: { enabled: false },
        },
        201,
      );
      cleanup.testCaseId = entityId(caseRes.body.testCase);

      const planRes = await admin.post(
        '/api/test-plans',
        {
          name: `SMK Plan ${stamp}`,
          projectId: cleanup.projectId,
          versionId: cleanup.versionId,
          caseIds: [cleanup.testCaseId],
          ownerId: adminId,
          assigneeIds: [cleanup.employeeUserId],
          executionMode: 'manual',
        },
        201,
      );
      cleanup.testPlanId = entityId(planRes.body.testPlan);
      record('Create project → plan chain', Boolean(cleanup.testPlanId), smkCode);

      const employee = createApiClient(app);
      await employee.post('/api/auth/login', { email: employeeEmail, password: employeePassword }, 200);

      const startRes = await employee.post(
        '/api/test-runs',
        { testPlanId: cleanup.testPlanId, name: `SMK-Run-${stamp}` },
        201,
      );
      cleanup.runId = entityId(startRes.body.testRun);
      const firstResult = startRes.body.testRun?.results?.[0];
      const resultObjectId = resultId(firstResult);

      await employee.patch(
        `/api/test-runs/${cleanup.runId}/results/${resultObjectId}`,
        { status: 'pass', notes: 'SMK smoke pass' },
        200,
      );
      const endRes = await employee.patch(`/api/test-runs/${cleanup.runId}/end`, {}, 200);
      record('Employee manual run execution', endRes.body?.testRun?.status === 'completed', cleanup.runId);

      const historyRes = await admin.get(
        `/api/test-cases/history?projectId=${encodeURIComponent(cleanup.projectId)}`,
        200,
      );
      const historyCases = historyRes.body?.testCases || [];
      const found = historyCases.some((item) => String(item.caseKey || '').includes(smkCode));
      record('Execution history reflects run', found, `cases=${historyCases.length}`);

      const scopedPlansRes = await admin.get(
        `/api/test-plans?projectId=${encodeURIComponent(cleanup.projectId)}`,
        200,
      );
      const scopedCount = (scopedPlansRes.body?.testPlans || []).length;
      record('Project scope filter on test plans', scopedCount >= 1, `scoped=${scopedCount}`);

      let cleanupOk = true;
      let cleanupDetail = '';
      const cleanupSteps = [
        ['test plan', `/api/test-plans/${cleanup.testPlanId}`, () => { cleanup.testPlanId = ''; }],
        ['test case', `/api/test-cases/${cleanup.testCaseId}`, () => { cleanup.testCaseId = ''; }],
        ['group', `/api/test-case-groups/${cleanup.groupId}`, () => { cleanup.groupId = ''; }],
        ['version', `/api/versions/${cleanup.versionId}`, () => { cleanup.versionId = ''; }],
      ];

      for (const [label, path, clear] of cleanupSteps) {
        try {
          await admin.delete(path, 204);
          clear();
        } catch (error) {
          cleanupOk = false;
          cleanupDetail = `failed deleting ${label}: ${error.message}`;
          break;
        }
      }

      try {
        await admin.delete(`/api/projects/${cleanup.projectId}`, 204);
        cleanup.projectId = '';
      } catch {
        cleanupDetail = cleanupDetail || `project kept (test run ${cleanup.runId} has no delete API)`;
      }

      await User.deleteOne({ _id: cleanup.employeeUserId });
      cleanup.employeeUserId = '';
      record('Cleanup SMK entities', cleanupOk, cleanupDetail || 'ok');
    } catch (error) {
      record('Writable E2E chain', false, error.message);
    }
  } finally {
    const admin = createApiClient(app);
    try {
      await admin.post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, 200);
      if (cleanup.testPlanId) await safeDelete(admin, `/api/test-plans/${cleanup.testPlanId}`);
      if (cleanup.testCaseId) await safeDelete(admin, `/api/test-cases/${cleanup.testCaseId}`);
      if (cleanup.groupId) await safeDelete(admin, `/api/test-case-groups/${cleanup.groupId}`);
      if (cleanup.versionId) await safeDelete(admin, `/api/versions/${cleanup.versionId}`);
      if (cleanup.projectId) await safeDelete(admin, `/api/projects/${cleanup.projectId}`);
      if (cleanup.employeeUserId) {
        const User = require('../src/models/User');
        await User.deleteOne({ _id: cleanup.employeeUserId });
      }
    } catch {
      // best-effort cleanup
    }

    await mongoose.connection.close();
  }

  const passed = results.filter((item) => item.passed).length;
  const failed = results.filter((item) => !item.passed).length;
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed scenarios:');
    for (const item of results.filter((row) => !row.passed)) {
      console.log(`  - ${item.name}: ${item.detail}`);
    }
    process.exit(1);
  }
}

run().catch(async (error) => {
  console.error('Smoke runner crashed:', error);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
