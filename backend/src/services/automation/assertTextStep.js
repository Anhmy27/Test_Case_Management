const toString = (value) => String(value || '').trim();

const ASSERT_TEXT_BODY_SCOPE_WARNING =
  'assertText without target checks entire page body — add a selector to assert on a specific element.';

const buildAssertTextScopeWarnings = (locatorAmbiguity, target) => {
  if (target || locatorAmbiguity !== 'warn') {
    return [];
  }
  return [ASSERT_TEXT_BODY_SCOPE_WARNING];
};

const waitForBodyContainsText = async (page, normalizedExpected, timeoutMs, capturePageDiagnostics) => {
  try {
    await page.waitForFunction(
      (needle) => String(document.body?.innerText || '').includes(String(needle || '')),
      normalizedExpected,
      { timeout: timeoutMs },
    );

    return String(await page.locator('body').innerText({ timeout: timeoutMs }) || '');
  } catch (error) {
    const diagnostics = await capturePageDiagnostics(page);
    throw new Error([
      error?.message || 'assertText timed out',
      `Expected text: ${normalizedExpected}`,
      diagnostics,
    ].join('\n'));
  }
};

const assertLocatorContainsText = async (locator, page, normalizedExpected, timeoutMs, scopeLabel) => {
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });

  const handle = await locator.elementHandle({ timeout: timeoutMs });
  if (!handle) {
    throw new Error(`assertText target not found: ${scopeLabel}`);
  }

  try {
    await page.waitForFunction(
      (element, needle) => Boolean(element && String(element.innerText || '').includes(String(needle || ''))),
      handle,
      normalizedExpected,
      { timeout: timeoutMs },
    );
  } catch (error) {
    let elementText = '';

    try {
      elementText = String(await locator.innerText({ timeout: 1000 }) || '');
    } catch {
      // Continue with empty preview.
    }

    throw new Error([
      error?.message || 'assertText timed out',
      `Expected text "${normalizedExpected}" within ${scopeLabel}`,
      `Element text: ${elementText.slice(0, 500) || '(empty)'}`,
    ].join('\n'));
  }
};

/**
 * @param {{
 *   page: import('playwright').Page,
 *   step: object,
 *   timeoutMs: number,
 *   locatorAmbiguity?: 'fail'|'warn',
 *   resolveActionLocator: Function,
 *   appendLocatorWarnings: Function,
 *   capturePageDiagnostics: Function,
 * }} options
 */
const executeAssertText = async ({
  page,
  step,
  timeoutMs,
  locatorAmbiguity = 'fail',
  resolveActionLocator,
  appendLocatorWarnings,
  capturePageDiagnostics,
}) => {
  const normalizedExpected = toString(step.expected) || toString(step.value);
  const target = toString(step.target);

  if (!normalizedExpected) {
    throw new Error('assertText step requires expected text');
  }

  if (target) {
    const { locator, warnings } = await resolveActionLocator(page, step, 'asserttext', locatorAmbiguity);
    await assertLocatorContainsText(locator, page, normalizedExpected, timeoutMs, target);
    return appendLocatorWarnings(`assertText ${target} contains ${normalizedExpected}`, warnings);
  }

  const scopeWarnings = buildAssertTextScopeWarnings(locatorAmbiguity, target);
  const normalizedText = await waitForBodyContainsText(
    page,
    normalizedExpected,
    timeoutMs,
    capturePageDiagnostics,
  );

  if (!normalizedText.includes(normalizedExpected)) {
    throw new Error(`Expected text to include "${normalizedExpected}" but got "${normalizedText}"`);
  }

  return appendLocatorWarnings(`assertText (page) contains ${normalizedExpected}`, scopeWarnings);
};

module.exports = {
  ASSERT_TEXT_BODY_SCOPE_WARNING,
  buildAssertTextScopeWarnings,
  executeAssertText,
};
