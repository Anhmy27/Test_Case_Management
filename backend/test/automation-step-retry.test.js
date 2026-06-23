const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_STEP_RETRY_COUNT,
  isTransientStepError,
  runStepWithRetries,
} = require('../src/services/automation/stepRetry');

test('isTransientStepError accepts timeout messages', () => {
  assert.equal(isTransientStepError(new Error('locator.click: Timeout 30000ms exceeded')), true);
  assert.equal(isTransientStepError(new Error('waiting for selector to be visible')), true);
});

test('isTransientStepError rejects assertion mismatch', () => {
  assert.equal(
    isTransientStepError(new Error('Expected text to include "OK" but got "FAIL"')),
    false,
  );
  assert.equal(
    isTransientStepError(new Error('Expected page url to include "/dash" but got "http://x"')),
    false,
  );
});

test('isTransientStepError rejects locator ambiguity and config errors', () => {
  assert.equal(isTransientStepError(new Error('Locator matched 3 elements (expected exactly 1)')), false);
  assert.equal(isTransientStepError(new Error('Locator matched 0 elements')), false);
  assert.equal(isTransientStepError(new Error('Authentication required: navigating')), false);
});

test('runStepWithRetries retries transient errors up to default count', async () => {
  let calls = 0;

  const result = await runStepWithRetries(async () => {
    calls += 1;
    if (calls < 3) {
      throw new Error('click: Timeout 30000ms exceeded');
    }
    return 'click ok';
  });

  assert.equal(calls, 3);
  assert.match(result, /step retried 2 time/);
});

test('runStepWithRetries does not retry assertion failures', async () => {
  let calls = 0;

  await assert.rejects(
    () =>
      runStepWithRetries(async () => {
        calls += 1;
        throw new Error('Expected text to include "pass" but got "fail"');
      }),
    /Expected text to include/,
  );

  assert.equal(calls, 1);
});

test('DEFAULT_STEP_RETRY_COUNT is 2', () => {
  assert.equal(DEFAULT_STEP_RETRY_COUNT, 2);
});
