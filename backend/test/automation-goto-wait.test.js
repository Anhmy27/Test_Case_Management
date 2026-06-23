const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_GOTO_WAIT_UNTIL,
  normalizeGotoWaitUntil,
} = require('../src/utils/automationTimeouts');
const { normalizeAutomationSteps } = require('../src/services/shared/versioningCore');

test('normalizeGotoWaitUntil defaults to load', () => {
  assert.equal(normalizeGotoWaitUntil(undefined), DEFAULT_GOTO_WAIT_UNTIL);
  assert.equal(normalizeGotoWaitUntil(''), 'load');
  assert.equal(normalizeGotoWaitUntil('load'), 'load');
  assert.equal(normalizeGotoWaitUntil('networkidle'), 'load');
});

test('normalizeGotoWaitUntil accepts domcontentloaded only as alternate', () => {
  assert.equal(normalizeGotoWaitUntil('domcontentloaded'), 'domcontentloaded');
  assert.equal(normalizeGotoWaitUntil('DOMContentLoaded'), 'domcontentloaded');
});

test('normalizeAutomationSteps omits waitUntil when goto uses default load', () => {
  const [step] = normalizeAutomationSteps([
    { action: 'goto', value: '/login', waitUntil: 'load' },
  ]);

  assert.equal(step.waitUntil, undefined);
});

test('normalizeAutomationSteps keeps domcontentloaded for goto', () => {
  const [step] = normalizeAutomationSteps([
    { action: 'goto', value: '/fast', waitUntil: 'domcontentloaded' },
  ]);

  assert.equal(step.waitUntil, 'domcontentloaded');
});
