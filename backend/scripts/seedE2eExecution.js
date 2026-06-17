const bcrypt = require('bcryptjs');
const request = require('supertest');
const User = require('../src/models/User');
const TestPlan = require('../src/models/TestPlan');
const { CSRF_COOKIE, CSRF_HEADER } = require('../src/utils/authCookies');
const { entityId } = require('../test/helpers/executionFixtures');

function parseSetCookieHeaders(setCookieHeaders = []) {
  const cookies = {};

  for (const header of setCookieHeaders) {
    const [pair] = String(header).split(';');
    const separator = pair.indexOf('=');
    if (separator === -1) {
      continue;
    }

    cookies[pair.slice(0, separator).trim()] = pair.slice(separator + 1).trim();
  }

  return cookies;
}

function formatCookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function createAuthClient(app) {
  const agent = request.agent(app);
  let cookies = {};

  function mergeResponseCookies(response) {
    cookies = {
      ...cookies,
      ...parseSetCookieHeaders(response.headers['set-cookie']),
    };
  }

  function withAuthHeaders() {
    const headers = {};
    const cookieHeader = formatCookieHeader(cookies);

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    if (cookies[CSRF_COOKIE]) {
      headers[CSRF_HEADER] = cookies[CSRF_COOKIE];
    }

    return headers;
  }

  return {
    async post(path, body, expectedStatus) {
      const response = await agent
        .post(path)
        .set(withAuthHeaders())
        .send(body)
        .expect(expectedStatus);
      mergeResponseCookies(response);
      return response;
    },
  };
}

const E2E_EMPLOYEE_EMAIL = 'e2e-employee@test.local';
const E2E_EMPLOYEE_PASSWORD = 'e2e-employee-password-123456';
const E2E_MANUAL_PLAN_NAME = 'E2E Manual Execution Plan';
const E2E_PASSWORD = 'e2e-employee-password-123456';

async function seedE2eExecution(app) {
  const existingPlan = await TestPlan.findOne({
    name: E2E_MANUAL_PLAN_NAME,
    deletedAt: null,
    isLatest: true,
  }).lean();

  if (existingPlan) {
    console.log('[e2e-seed] Execution fixture already present');
    return {
      employeeEmail: E2E_EMPLOYEE_EMAIL,
      employeePassword: E2E_EMPLOYEE_PASSWORD,
      planName: E2E_MANUAL_PLAN_NAME,
      planEntityId: String(existingPlan.entityId || existingPlan._id),
    };
  }

  let employee = await User.findOne({ email: E2E_EMPLOYEE_EMAIL.toLowerCase() }).lean();
  if (!employee) {
    const passwordHash = await bcrypt.hash(E2E_EMPLOYEE_PASSWORD, 10);
    employee = await User.create({
      name: 'E2E Employee',
      email: E2E_EMPLOYEE_EMAIL,
      passwordHash,
      role: 'employee',
    });
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  const adminClient = createAuthClient(app);
  await adminClient.post('/api/auth/login', {
    email: adminEmail,
    password: adminPassword,
  }, 200);

  const projectRes = await adminClient.post('/api/projects', {
    name: 'E2E Execution Project',
    code: 'E2ERUN',
  }, 201);
  const projectId = entityId(projectRes.body.project);

  const versionRes = await adminClient.post('/api/versions', {
    projectId,
    name: 'E2E Release',
  }, 201);
  const versionId = entityId(versionRes.body.version);

  const groupRes = await adminClient.post('/api/test-case-groups', {
    projectId,
    name: 'E2E Group',
    key: 'E2EGRP',
  }, 201);
  const groupId = entityId(groupRes.body.group);

  const testCaseRes = await adminClient.post('/api/test-cases', {
    projectId,
    groupId,
    caseKey: 'TC-E2E-001',
    title: 'E2E checkout verification',
    steps: [{ action: 'Open page', expected: 'Page visible' }],
    automation: { enabled: false },
  }, 201);
  const testCaseId = entityId(testCaseRes.body.testCase);

  const admin = await User.findOne({ email: adminEmail });
  const planRes = await adminClient.post('/api/test-plans', {
    name: E2E_MANUAL_PLAN_NAME,
    projectId,
    versionId,
    caseIds: [testCaseId],
    ownerId: entityId(admin),
    assigneeIds: [entityId(employee)],
    executionMode: 'manual',
  }, 201);

  console.log('[e2e-seed] Seeded employee execution fixture');

  return {
    employeeEmail: E2E_EMPLOYEE_EMAIL,
    employeePassword: E2E_EMPLOYEE_PASSWORD,
    planName: E2E_MANUAL_PLAN_NAME,
    planEntityId: entityId(planRes.body.testPlan),
  };
}

module.exports = {
  E2E_EMPLOYEE_EMAIL,
  E2E_EMPLOYEE_PASSWORD,
  E2E_MANUAL_PLAN_NAME,
  seedE2eExecution,
};
