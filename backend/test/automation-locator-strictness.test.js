const test = require('node:test');
const assert = require('node:assert/strict');

const {
  appendLocatorWarnings,
  buildAmbiguousLocatorMessage,
  requireUniqueLocator,
  resolveLocator,
} = require('../src/services/automation/locatorResolution');

const mockLocator = (count) => ({
  count: async () => count,
  first: () => ({
    waitFor: async () => {
      if (count === 0) {
        throw new Error('Timeout waiting for locator');
      }
    },
  }),
});

test('requireUniqueLocator returns single match without warnings', async () => {
  const result = await requireUniqueLocator(mockLocator(1), {
    locatorAmbiguity: 'fail',
    targetType: 'css',
    target: '#submit',
    waitForAppearance: false,
  });

  assert.equal(result.warnings.length, 0);
});

test('requireUniqueLocator fails on ambiguous locator in fail mode', async () => {
  await assert.rejects(
    () => requireUniqueLocator(mockLocator(3), {
      locatorAmbiguity: 'fail',
      targetType: 'text',
      target: 'Lưu',
      waitForAppearance: false,
    }),
    (error) => {
      assert.match(error.message, /matched 3 elements/);
      assert.match(error.message, /text/);
      return true;
    },
  );
});

test('requireUniqueLocator warns on ambiguous locator in warn mode', async () => {
  const result = await requireUniqueLocator(mockLocator(2), {
    locatorAmbiguity: 'warn',
    targetType: 'css',
    target: '.btn',
    waitForAppearance: false,
  });

  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0], buildAmbiguousLocatorMessage(2, 'css', '.btn'));
});

test('requireUniqueLocator fails on zero matches after wait timeout', async () => {
  await assert.rejects(
    () =>
      requireUniqueLocator(mockLocator(0), {
        locatorAmbiguity: 'warn',
        targetType: 'id',
        target: 'missing',
        timeoutMs: 50,
      }),
    /matched 0 elements/,
  );
});

test('requireUniqueLocator waits for appearance before counting', async () => {
  let appeared = false;
  const locator = {
    first: () => ({
      waitFor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        appeared = true;
      },
    }),
    count: async () => (appeared ? 1 : 0),
  };

  const result = await requireUniqueLocator(locator, {
    locatorAmbiguity: 'fail',
    targetType: 'css',
    target: '#campus',
    timeoutMs: 500,
  });

  assert.equal(appeared, true);
  assert.equal(result.warnings.length, 0);
});

test('appendLocatorWarnings adds WARNING lines', () => {
  const message = appendLocatorWarnings('click #ok', ['Locator matched 2 elements']);
  assert.match(message, /^click #ok/);
  assert.match(message, /WARNING: Locator matched 2 elements/);
});

test('resolveLocator maps role targetType to page.getByRole(target, { name: value })', () => {
  const calls = [];
  const page = {
    getByRole: (role, options) => {
      calls.push({ role, options });
      return { role, options };
    },
  };

  resolveLocator(page, { targetType: 'role', target: 'button', value: 'Đăng nhập' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].role, 'button');
  assert.deepEqual(calls[0].options, { exact: false, name: 'Đăng nhập' });
});

test('resolveLocator omits name option for role targetType without a display name', () => {
  const calls = [];
  const page = {
    getByRole: (role, options) => {
      calls.push({ role, options });
      return { role, options };
    },
  };

  resolveLocator(page, { targetType: 'role', target: 'button', value: '' });

  assert.deepEqual(calls[0].options, { exact: false });
});

test('resolveLocator maps xpath targetType to page.locator with xpath= prefix (BL-1)', () => {
  const calls = [];
  const page = {
    locator: (selector) => {
      calls.push(selector);
      return { selector };
    },
  };

  resolveLocator(page, { targetType: 'xpath', target: '//*[@data-testid=\'login-btn\']' });
  assert.equal(calls[0], "xpath=//*[@data-testid='login-btn']");

  resolveLocator(page, { targetType: 'xpath', target: 'xpath=//button[@id="ok"]' });
  assert.equal(calls[1], 'xpath=//button[@id="ok"]');
});
