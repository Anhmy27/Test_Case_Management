const test = require('node:test');
const assert = require('node:assert/strict');

const { appendLocatorWarnings } = require('../src/services/automation/locatorResolution');
const {
  ASSERT_TEXT_BODY_SCOPE_WARNING,
  buildAssertTextScopeWarnings,
  executeAssertText,
} = require('../src/services/automation/assertTextStep');

test('buildAssertTextScopeWarnings warns only for dry-run body scope', () => {
  assert.deepEqual(buildAssertTextScopeWarnings('warn', ''), [ASSERT_TEXT_BODY_SCOPE_WARNING]);
  assert.deepEqual(buildAssertTextScopeWarnings('warn', '#toast'), []);
  assert.deepEqual(buildAssertTextScopeWarnings('fail', ''), []);
});

test('executeAssertText adds body-scope warning during dry run without target', async () => {
  const page = {
    waitForFunction: async () => {},
    locator: () => ({
      innerText: async () => 'Đăng nhập thành công',
    }),
  };

  const result = await executeAssertText({
    page,
    step: { expected: 'thành công' },
    timeoutMs: 5000,
    locatorAmbiguity: 'warn',
    resolveActionLocator: async () => {
      throw new Error('resolveActionLocator should not run for body scope');
    },
    appendLocatorWarnings,
    capturePageDiagnostics: async () => '',
  });

  assert.match(result, /assertText \(page\) contains thành công/);
  assert.match(result, /WARNING: assertText without target checks entire page body/);
});

test('executeAssertText asserts on locator when target is set', async () => {
  let resolvedTarget = '';

  const locator = {
    waitFor: async () => {},
    elementHandle: async () => ({ id: 'element-handle' }),
    innerText: async () => 'Saved successfully',
  };

  const page = {
    waitForFunction: async (_predicate, _handle, needle) => {
      assert.equal(needle, 'Saved');
    },
  };

  const result = await executeAssertText({
    page,
    step: { target: '#toast', targetType: 'css', expected: 'Saved' },
    timeoutMs: 5000,
    locatorAmbiguity: 'fail',
    resolveActionLocator: async (_page, step) => {
      resolvedTarget = step.target;
      return { locator, warnings: [] };
    },
    appendLocatorWarnings,
    capturePageDiagnostics: async () => '',
  });

  assert.equal(resolvedTarget, '#toast');
  assert.equal(result, 'assertText #toast contains Saved');
});

test('executeAssertText fails when scoped element text does not match', async () => {
  const locator = {
    waitFor: async () => {},
    elementHandle: async () => ({ id: 'element-handle' }),
    innerText: async () => 'Wrong message',
  };

  const page = {
    waitForFunction: async () => {
      throw new Error('Timed out waiting for text');
    },
  };

  await assert.rejects(
    () =>
      executeAssertText({
        page,
        step: { target: '#toast', expected: 'Saved' },
        timeoutMs: 1000,
        locatorAmbiguity: 'fail',
        resolveActionLocator: async () => ({ locator, warnings: [] }),
        appendLocatorWarnings,
        capturePageDiagnostics: async () => '',
      }),
    (error) => {
      assert.match(error.message, /Expected text "Saved" within #toast/);
      assert.match(error.message, /Wrong message/);
      return true;
    },
  );
});

test('executeAssertText requires expected text', async () => {
  await assert.rejects(
    () =>
      executeAssertText({
        page: {},
        step: { target: '#toast' },
        timeoutMs: 1000,
        locatorAmbiguity: 'fail',
        resolveActionLocator: async () => ({ locator: {}, warnings: [] }),
        appendLocatorWarnings,
        capturePageDiagnostics: async () => '',
      }),
    /assertText step requires expected text/,
  );
});
