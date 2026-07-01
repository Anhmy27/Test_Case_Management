const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTestCaseBodySchema,
  updateTestCaseBodySchema,
} = require('../src/validators/testCaseSchemas');

test('updateTestCaseBodySchema accepts null step expected (legacy client payload)', () => {
  const parsed = updateTestCaseBodySchema.parse({
    steps: [{ action: 'Open menu', expected: null }],
    priority: 'highest',
  });

  assert.equal(parsed.priority, 'highest');
  assert.equal(parsed.steps[0].action, 'Open menu');
  assert.equal(parsed.steps[0].expected, undefined);
});

test('updateTestCaseBodySchema rejects legacy critical priority value', () => {
  const result = updateTestCaseBodySchema.safeParse({
    priority: 'critical',
  });

  assert.equal(result.success, false);
});

test('updateTestCaseBodySchema still allows critical severity', () => {
  const parsed = updateTestCaseBodySchema.parse({
    severity: 'critical',
  });

  assert.equal(parsed.severity, 'critical');
});

test('createTestCaseBodySchema accepts full priority ladder', () => {
  for (const priority of ['lowest', 'low', 'medium', 'high', 'highest']) {
    const parsed = createTestCaseBodySchema.parse({
      projectId: '507f1f77bcf86cd799439011',
      groupId: '507f1f77bcf86cd799439012',
      caseKey: 'TC-001',
      title: 'Sample',
      priority,
    });
    assert.equal(parsed.priority, priority);
  }
});
