const test = require('node:test');
const assert = require('node:assert/strict');

const { logBugBodySchema, getLogBugsQuerySchema } = require('../src/validators/jiraSchemas');

const PROJECT_ID = '507f1f77bcf86cd799439011';
const RUN_ID = '507f1f77bcf86cd799439012';
const RESULT_ID = '507f1f77bcf86cd799439013';

test('logBugBodySchema accepts optional run context and case metadata', () => {
  const parsed = logBugBodySchema.parse({
    projectId: PROJECT_ID,
    runId: RUN_ID,
    resultId: RESULT_ID,
    caseKey: 'TC-001',
    caseTitle: 'Verify login',
    summary: '[TC-001] Verify login',
    description: 'Steps failed at checkout',
    issueType: '10001',
    priority: '3',
    assignee: 'john.doe',
    labels: 'regression, smoke',
    versions: ['10010'],
  });

  assert.equal(parsed.projectId, PROJECT_ID);
  assert.equal(parsed.runId, RUN_ID);
  assert.equal(parsed.resultId, RESULT_ID);
  assert.equal(parsed.caseKey, 'TC-001');
  assert.equal(parsed.caseTitle, 'Verify login');
  assert.equal(parsed.issueType, '10001');
});

test('logBugBodySchema rejects invalid projectId', () => {
  const result = logBugBodySchema.safeParse({
    projectId: 'not-an-object-id',
    summary: 'Bug summary',
    description: 'Bug description',
    issueType: '10001',
  });

  assert.equal(result.success, false);
});

test('getLogBugsQuerySchema accepts search and filter params', () => {
  const parsed = getLogBugsQuerySchema.parse({
    projectId: PROJECT_ID,
    search: 'CED-100',
    priority: '3',
    issueType: '10001',
    page: '2',
    limit: '25',
  });

  assert.equal(parsed.projectId, PROJECT_ID);
  assert.equal(parsed.search, 'CED-100');
  assert.equal(parsed.priority, '3');
  assert.equal(parsed.issueType, '10001');
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 25);
});
