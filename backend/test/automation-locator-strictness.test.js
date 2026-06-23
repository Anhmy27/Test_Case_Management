const test = require('node:test');
const assert = require('node:assert/strict');

const {
  appendLocatorWarnings,
  buildAmbiguousLocatorMessage,
  requireUniqueLocator,
} = require('../src/services/automation/locatorResolution');

const mockLocator = (count) => ({
  count: async () => count,
  first: () => ({ id: `first-of-${count}` }),
});

test('requireUniqueLocator returns single match without warnings', async () => {
  const result = await requireUniqueLocator(mockLocator(1), {
    locatorAmbiguity: 'fail',
    targetType: 'css',
    target: '#submit',
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.locator.id, 'first-of-1');
});

test('requireUniqueLocator fails on ambiguous locator in fail mode', async () => {
  await assert.rejects(
    () => requireUniqueLocator(mockLocator(3), {
      locatorAmbiguity: 'fail',
      targetType: 'text',
      target: 'Lưu',
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
  });

  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0], buildAmbiguousLocatorMessage(2, 'css', '.btn'));
});

test('requireUniqueLocator fails on zero matches', async () => {
  await assert.rejects(
    () => requireUniqueLocator(mockLocator(0), {
      locatorAmbiguity: 'warn',
      targetType: 'id',
      target: 'missing',
    }),
    /matched 0 elements/,
  );
});

test('appendLocatorWarnings adds WARNING lines', () => {
  const message = appendLocatorWarnings('click #ok', ['Locator matched 2 elements']);
  assert.match(message, /^click #ok/);
  assert.match(message, /WARNING: Locator matched 2 elements/);
});
