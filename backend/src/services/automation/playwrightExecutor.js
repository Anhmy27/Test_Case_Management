const { resolveNavigationUrl, resolveSandboxedUploadPaths } = require('../../utils/automationUrlPolicy');

const ALLOWED_ACTIONS = new Set([
  'goto',
  'click',
  'type',
  'select',
  'wait',
  'waitfor',
  'asserttext',
  'assertvisible',
  'asserturl',
  'asserttitle',
  'asserthidden',
  'assertenabled',
  'assertchecked',
  'hover',
  'press',
  'upload',
  'dragto',
]);

const {
  DEFAULT_AUTOMATION_TIMEOUT_MS,
  normalizeCaseTimeoutMs,
  resolveStepTimeoutMs,
} = require('../../utils/automationTimeouts');

const toString = (value) => String(value || '').trim();

const escapeAttributeValue = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const parseFilePaths = (value) => resolveSandboxedUploadPaths(value);

const joinUrl = (baseUrl, pathOrUrl) => resolveNavigationUrl(baseUrl, pathOrUrl);

const resolveLocator = (page, step) => {
  const targetType = toString(step.targetType || 'css').toLowerCase();
  const target = toString(step.target);

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

const resolveClickLocator = (page, step) => {
  const targetType = toString(step.targetType || 'css').toLowerCase();
  const target = toString(step.target);

  if (targetType === 'text' && target) {
    return page.getByRole('button', { name: target, exact: false }).first();
  }

  return resolveLocator(page, step).first();
};

const describeStep = (step, stepIndex, page, caseTimeoutMs) => {
  const resolvedTimeoutMs = resolveStepTimeoutMs(step.timeoutMs, caseTimeoutMs, DEFAULT_AUTOMATION_TIMEOUT_MS);
  const fields = [
    `Step #${stepIndex + 1}`,
    `Action: ${toString(step.action) || '(empty)'}`,
    `Target type: ${toString(step.targetType) || 'css'}`,
    `Target: ${toString(step.target) || '(empty)'}`,
    `Value: ${toString(step.value) || '(empty)'}`,
    `Expected: ${toString(step.expected) || '(empty)'}`,
    `Timeout ms: ${resolvedTimeoutMs}`,
    `Page URL: ${page?.url?.() || '(unknown)'}`,
  ];

  return fields.join('\n');
};

const formatStepError = (step, stepIndex, page, error, caseTimeoutMs) => {
  const parts = [
    'Automation step failed',
    describeStep(step, stepIndex, page, caseTimeoutMs),
    `Error: ${error?.message || 'Unknown error'}`,
  ];

  return parts.join('\n');
};

const capturePostActionState = async (page, timeoutMs = DEFAULT_AUTOMATION_TIMEOUT_MS) => {
  const details = [];
  const settleTimeout = Math.min(Math.max(timeoutMs, 1000), 5000);

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: settleTimeout });
  } catch {
    // Continue with whatever state is available.
  }

  try {
    details.push(`After click URL: ${page.url()}`);
  } catch {
    details.push('After click URL: (unavailable)');
  }

  try {
    const bodyText = String(await page.locator('body').innerText({ timeout: settleTimeout }) || '');
    details.push(`After click body preview: ${bodyText.slice(0, 500) || '(empty)'}`);
  } catch {
    details.push('After click body preview: (unavailable)');
  }

  return details.join('\n');
};

const waitForPageSettle = async (page, timeoutMs) => {
  try {
    await page.waitForLoadState('load', { timeout: timeoutMs });
    return 'load';
  } catch {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });
      return 'domcontentloaded';
    } catch {
      return '';
    }
  }
};

const waitForUrlChange = async (page, initialUrl, timeoutMs) => {
  try {
    await page.waitForURL((currentUrl) => currentUrl.href !== initialUrl, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
};

const capturePageDiagnostics = async (page) => {
  const diagnostics = [];

  try {
    diagnostics.push(`Page title: ${await page.title()}`);
  } catch {
    diagnostics.push('Page title: (unavailable)');
  }

  try {
    const bodyText = String(await page.locator('body').innerText({ timeout: 1000 }) || '');
    diagnostics.push(`Body text preview: ${bodyText.slice(0, 500) || '(empty)'}`);
  } catch {
    diagnostics.push('Body text preview: (unavailable)');
  }

  return diagnostics.join('\n');
};

const assertWithDiagnostics = async (page, checkFn, successMessage, errorMessage) => {
  try {
    await checkFn();
    return successMessage;
  } catch (error) {
    const diagnostics = await capturePageDiagnostics(page);
    throw new Error([
      error?.message || errorMessage,
      diagnostics,
    ].join('\n'));
  }
};

const executeStep = async (page, step, baseUrl, caseTimeoutMs) => {
  const action = toString(step.action).toLowerCase();
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`Unsupported automation action: ${step.action}`);
  }

  const timeoutMs = resolveStepTimeoutMs(step.timeoutMs, caseTimeoutMs, DEFAULT_AUTOMATION_TIMEOUT_MS);
  const targetType = toString(step.targetType || 'css').toLowerCase();
  const target = toString(step.target);
  const value = toString(step.value);
  const expected = toString(step.expected);

  if (action === 'goto') {
    const nextUrl = joinUrl(baseUrl, value || target);
    if (!nextUrl) {
      throw new Error('goto step requires a URL or path in value');
    }

    await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    const finalUrl = page.url();
    const isAuthRedirect = /\/(auth\/login|login|signin|sign-in)([\/?#]|$)/i.test(finalUrl);
    if (isAuthRedirect && !nextUrl.toLowerCase().includes('login') && !nextUrl.toLowerCase().includes('signin')) {
      throw new Error(
        `Authentication required: navigating to "${nextUrl}" redirected to login page "${finalUrl}".\n` +
        `The saved session has no valid auth credentials. ` +
        `Add login steps (goto login page → type username/password → click submit) at the beginning of your test case to authenticate first.`,
      );
    }

    return `goto ${nextUrl} → landed on ${finalUrl}`;
  }

  if (action === 'click') {
    const locator = resolveClickLocator(page, step);
    const initialUrl = page.url();

    await locator.click({ timeout: timeoutMs });

    let navigated = await waitForUrlChange(page, initialUrl, timeoutMs);

    if (!navigated && targetType === 'text') {
      try {
        await locator.evaluate((element) => {
          const form = element.closest('form');
          if (form && typeof form.requestSubmit === 'function') {
            form.requestSubmit();
          }
        });
      } catch {
        // Ignore and fall through to diagnostics.
      }

      navigated = await waitForUrlChange(page, initialUrl, timeoutMs);
    }

    if (navigated) {
      await waitForPageSettle(page, timeoutMs);
    }

    const state = await capturePostActionState(page, timeoutMs);
    return `click ${target}\n${state}\nNavigation detected: ${page.url() !== initialUrl ? 'yes' : 'no'}`;
  }

  const locator = resolveLocator(page, step).first();

  if (action === 'type') {
    await locator.fill(value, { timeout: timeoutMs });
    return `type ${target} = ${value}`;
  }

  if (action === 'select') {
    await locator.selectOption(value, { timeout: timeoutMs });
    return `select ${target} = ${value}`;
  }

  if (action === 'hover') {
    await locator.hover({ timeout: timeoutMs });
    return `hover ${target}`;
  }

  if (action === 'press') {
    const keyCombination = value || target;

    if (!keyCombination) {
      throw new Error('press step requires a key combination in value or target');
    }

    if (target) {
      await locator.press(keyCombination, { timeout: timeoutMs });
      return `press ${target} -> ${keyCombination}`;
    }

    await page.keyboard.press(keyCombination);
    return `press page -> ${keyCombination}`;
  }

  if (action === 'upload') {
    const filePaths = parseFilePaths(value || target);

    if (filePaths.length === 0) {
      throw new Error('upload step requires at least one file path in value or target');
    }

    await locator.setInputFiles(filePaths, { timeout: timeoutMs });
    return `upload ${target || '(file input)'} = ${filePaths.join(', ')}`;
  }

  if (action === 'dragto') {
    const destinationSelector = value;

    if (!target || !destinationSelector) {
      throw new Error('dragTo step requires source target and destination selector in value');
    }

    const source = resolveLocator(page, step).first();
    const destinationStep = { ...step, target: destinationSelector };
    const destination = resolveLocator(page, destinationStep).first();

    await source.dragTo(destination, { timeout: timeoutMs });
    return `dragTo ${target} -> ${destinationSelector}`;
  }

  if (action === 'wait') {
    const settled = await waitForPageSettle(page, timeoutMs);
    if (!settled) {
      throw new Error(
        `wait step timed out after ${timeoutMs}ms — page did not reach load or domcontentloaded. Prefer waitFor with a target selector.`,
      );
    }
    return `wait page ${settled} (timeout ${timeoutMs}ms)`;
  }

  if (action === 'waitfor') {
    if (!target) {
      throw new Error(
        'waitFor step requires a target selector. Do not sleep — wait for a specific element to become visible.',
      );
    }

    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return `waitFor visible ${target}`;
  }

  if (action === 'assertvisible') {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });

    return `assertVisible ${target}`;
  }

  if (action === 'asserthidden') {
    await locator.waitFor({ state: 'hidden', timeout: timeoutMs });

    return `assertHidden ${target}`;
  }

  if (action === 'assertenabled') {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });

    return assertWithDiagnostics(
      page,
      async () => {
        const enabled = await locator.isEnabled();
        if (!enabled) {
          throw new Error(`Expected element to be enabled: ${target}`);
        }
      },
      `assertEnabled ${target}`,
      `Expected element to be enabled: ${target}`,
    );
  }

  if (action === 'assertchecked') {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });

    return assertWithDiagnostics(
      page,
      async () => {
        const checked = await locator.isChecked();
        if (!checked) {
          throw new Error(`Expected element to be checked: ${target}`);
        }
      },
      `assertChecked ${target}`,
      `Expected element to be checked: ${target}`,
    );
  }

  if (action === 'asserturl') {
    const normalizedExpected = expected || value || target;

    if (!normalizedExpected) {
      throw new Error('assertUrl step requires expected url text');
    }

    return assertWithDiagnostics(
      page,
      async () => {
        await page.waitForURL((currentUrl) => String(currentUrl.href).includes(normalizedExpected), {
          timeout: timeoutMs,
        });

        if (!String(page.url()).includes(normalizedExpected)) {
          throw new Error(`Expected page url to include "${normalizedExpected}" but got "${page.url()}"`);
        }
      },
      `assertUrl contains ${normalizedExpected}`,
      `Expected page url to include "${normalizedExpected}"`,
    );
  }

  if (action === 'asserttitle') {
    const normalizedExpected = expected || value || target;

    if (!normalizedExpected) {
      throw new Error('assertTitle step requires expected title text');
    }

    return assertWithDiagnostics(
      page,
      async () => {
        await page.waitForFunction(
          (needle) => String(document.title || '').includes(String(needle || '')),
          normalizedExpected,
          { timeout: timeoutMs },
        );

        const title = await page.title();
        if (!String(title).includes(normalizedExpected)) {
          throw new Error(`Expected page title to include "${normalizedExpected}" but got "${title}"`);
        }
      },
      `assertTitle contains ${normalizedExpected}`,
      `Expected page title to include "${normalizedExpected}"`,
    );
  }

  if (action === 'asserttext') {
    const normalizedExpected = expected || value;

    if (!normalizedExpected) {
      throw new Error('assertText step requires expected text');
    }

    let normalizedText = '';

    try {
      await page.waitForFunction(
        (needle) => String(document.body?.innerText || '').includes(String(needle || '')),
        normalizedExpected,
        { timeout: timeoutMs },
      );

      normalizedText = String(await page.locator('body').innerText({ timeout: timeoutMs }) || '');
    } catch (error) {
      const diagnostics = await capturePageDiagnostics(page);
      throw new Error([
        error?.message || 'assertText timed out',
        `Expected text: ${normalizedExpected}`,
        diagnostics,
      ].join('\n'));
    }

    if (!normalizedText.includes(normalizedExpected)) {
      throw new Error(`Expected text to include "${normalizedExpected}" but got "${normalizedText}"`);
    }

    return `assertText ${target || '(page)'} contains ${normalizedExpected}`;
  }

  throw new Error(`Unsupported automation action: ${step.action}`);
};

const runAutomationSteps = async ({ page, steps, baseUrl, caseTimeoutMs, onStepStart, shouldAbort }) => {
  const resolvedCaseTimeout = normalizeCaseTimeoutMs(caseTimeoutMs, DEFAULT_AUTOMATION_TIMEOUT_MS);
  const sortedSteps = [...steps].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const logLines = [];

  for (const [stepIndex, step] of sortedSteps.entries()) {
    if (typeof shouldAbort === 'function' && (await shouldAbort())) {
      const error = new Error('Automation run cancelled');
      error.code = 'AUTOMATION_CANCELLED';
      throw error;
    }

    if (typeof onStepStart === 'function') {
      await onStepStart(stepIndex + 1, sortedSteps.length, step);
    }

    try {
      const stepLog = await executeStep(page, step, baseUrl, resolvedCaseTimeout);
      logLines.push(stepLog);
    } catch (error) {
      throw new Error(formatStepError(step, stepIndex, page, error, resolvedCaseTimeout));
    }
  }

  return logLines;
};

module.exports = {
  runAutomationSteps,
};
