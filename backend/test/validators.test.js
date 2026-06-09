const test = require('node:test');
const assert = require('node:assert/strict');

const { createTestPlanBodySchema } = require('../src/validators/testPlanSchemas');
const { listUsersQuerySchema } = require('../src/validators/userSchemas');
const { runResultParamsSchema, dryRunAutomationBodySchema } = require('../src/validators/testRunSchemas');
const { updateUserBodySchema } = require('../src/validators/userSchemas');
const { validateRequest } = require('../src/middlewares/validateRequest');

test('createTestPlanBodySchema parses valid payload', () => {
  const parsed = createTestPlanBodySchema.parse({
    name: 'Smoke Plan',
    projectId: '507f1f77bcf86cd799439011',
    versionId: '507f1f77bcf86cd799439012',
    caseIds: ['507f1f77bcf86cd799439013'],
  });

  assert.equal(parsed.name, 'Smoke Plan');
  assert.equal(parsed.caseIds.length, 1);
});

test('createTestPlanBodySchema rejects empty caseIds', () => {
  const result = createTestPlanBodySchema.safeParse({
    name: 'Plan',
    projectId: '507f1f77bcf86cd799439011',
    versionId: '507f1f77bcf86cd799439012',
    caseIds: [],
  });

  assert.equal(result.success, false);
});

test('listUsersQuerySchema coerces includeInactive boolean from query string', () => {
  const parsed = listUsersQuerySchema.parse({
    status: 'all',
    includeInactive: 'true',
  });

  assert.equal(parsed.includeInactive, true);
});

test('runResultParamsSchema validates ObjectId params', () => {
  const parsed = runResultParamsSchema.parse({
    runId: '507f1f77bcf86cd799439011',
    resultId: '507f1f77bcf86cd799439012',
  });

  assert.equal(parsed.runId, '507f1f77bcf86cd799439011');
  assert.equal(parsed.resultId, '507f1f77bcf86cd799439012');
});

test('updateUserBodySchema allows blank password in edit payload', () => {
  const parsed = updateUserBodySchema.parse({
    name: 'Updated',
    password: '',
  });

  assert.equal(parsed.name, 'Updated');
  assert.equal(parsed.password, undefined);
});

test('dryRunAutomationBodySchema ignores empty testCaseId', () => {
  const parsed = dryRunAutomationBodySchema.parse({
    testCaseId: '',
    baseUrl: 'https://example.com',
    automation: {
      enabled: true,
      steps: [{ action: 'goto', target: '#id', value: '' }],
    },
  });

  assert.equal(parsed.testCaseId, undefined);
});

test('validateRequest returns httpError-style details on validation failure', async () => {
  const middleware = validateRequest({
    bodySchema: createTestPlanBodySchema,
  });

  const req = { body: { name: '', caseIds: [] } };
  const res = {};

  await new Promise((resolve) => {
    middleware(req, res, (err) => {
      assert.ok(err);
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, 'Validation failed');
      assert.ok(Array.isArray(err.details));
      resolve();
    });
  });
});
