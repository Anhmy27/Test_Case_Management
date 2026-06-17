const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAutomationEnabledCase,
  partitionResultsByAutomation,
  getAutomationResultIds,
} = require('../src/utils/runAutomationPartition');

test('partitionResultsByAutomation splits by testCase.automation.enabled', () => {
  const results = [
    { _id: 'r1', testCase: 'c1' },
    { _id: 'r2', testCase: 'c2' },
    { _id: 'r3', testCase: 'c3' },
  ];
  const testCaseMap = new Map([
    ['c1', { automation: { enabled: true } }],
    ['c2', { automation: { enabled: false } }],
    ['c3', { automation: { enabled: true } }],
  ]);

  const { automationResults, manualResults } = partitionResultsByAutomation(results, testCaseMap);
  assert.equal(automationResults.length, 2);
  assert.equal(manualResults.length, 1);
  assert.deepEqual(getAutomationResultIds(results, testCaseMap), ['r1', 'r3']);
});

test('isAutomationEnabledCase requires enabled flag', () => {
  assert.equal(isAutomationEnabledCase({ automation: { enabled: true } }), true);
  assert.equal(isAutomationEnabledCase({ automation: { enabled: false } }), false);
  assert.equal(isAutomationEnabledCase({ automation: {} }), false);
});
