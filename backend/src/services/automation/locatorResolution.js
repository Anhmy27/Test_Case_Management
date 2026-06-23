/**
 * Locator resolution for Playwright automation steps (P3 — strict uniqueness).
 */

const toString = (value) => String(value || '').trim();

const escapeAttributeValue = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const buildLocator = (page, targetType, target) => {
  switch (targetType) {
    case 'id':
      return page.locator(`[id="${escapeAttributeValue(target)}"]`);
    case 'placeholder':
      return page.getByPlaceholder(target);
    case 'text':
      return page.getByText(target, { exact: false });
    case 'label':
      return page.getByLabel(target);
    case 'testid':
      return page.getByTestId(target);
    case 'url':
    case 'css':
    default:
      return page.locator(target);
  }
};

const resolveLocator = (page, step) => {
  const targetType = toString(step.targetType || 'css').toLowerCase();
  const target = toString(step.target);
  return buildLocator(page, targetType, target);
};

/** click + Text: button, link, and elements with button role — not button-only */
const resolveTextClickLocator = (page, target) => {
  const name = toString(target);
  const button = page.getByRole('button', { name, exact: false });
  const link = page.getByRole('link', { name, exact: false });
  return button.or(link);
};

const buildAmbiguousLocatorMessage = (count, targetType, target) =>
  `Locator matched ${count} elements (expected exactly 1). ` +
  `Target type: ${targetType}, target: "${target}". ` +
  'Use a more specific selector (unique id, data-testid, or narrower CSS).';

const buildZeroMatchMessage = (targetType, target) =>
  `Locator matched 0 elements. Target type: ${targetType}, target: "${target}". ` +
  'Check selector spelling or wait for the element to appear.';

/**
 * @param {import('playwright').Locator} locator
 * @param {{
 *   locatorAmbiguity?: 'fail'|'warn',
 *   targetType: string,
 *   target: string,
 *   timeoutMs?: number,
 *   waitForAppearance?: boolean,
 * }} options
 * @returns {Promise<{ locator: import('playwright').Locator, warnings: string[] }>}
 */
const requireUniqueLocator = async (
  locator,
  {
    locatorAmbiguity = 'fail',
    targetType,
    target,
    timeoutMs = 30000,
    waitForAppearance = true,
  },
) => {
  if (waitForAppearance && timeoutMs > 0) {
    try {
      await locator.first().waitFor({ state: 'attached', timeout: timeoutMs });
    } catch {
      throw new Error(buildZeroMatchMessage(targetType, target));
    }
  }

  let count;

  try {
    count = await locator.count();
  } catch (error) {
    throw new Error(
      `Failed to count locator matches for ${targetType} "${target}": ${error?.message || 'Unknown error'}`,
    );
  }

  if (count === 0) {
    throw new Error(buildZeroMatchMessage(targetType, target));
  }

  if (count > 1) {
    const message = buildAmbiguousLocatorMessage(count, targetType, target);
    if (locatorAmbiguity === 'warn') {
      return { locator: locator.first(), warnings: [message] };
    }
    throw new Error(message);
  }

  return { locator: locator.first(), warnings: [] };
};

const appendLocatorWarnings = (message, warnings = []) => {
  if (!warnings.length) {
    return message;
  }
  return [message, ...warnings.map((warning) => `WARNING: ${warning}`)].join('\n');
};

module.exports = {
  appendLocatorWarnings,
  buildAmbiguousLocatorMessage,
  buildZeroMatchMessage,
  requireUniqueLocator,
  resolveLocator,
  resolveTextClickLocator,
};
