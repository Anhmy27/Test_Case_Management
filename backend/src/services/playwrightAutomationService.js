let chromium = null;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}
const path = require('path');
const TestCase = require('../models/TestCase');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const { httpError } = require('../utils/httpError');

const ALLOWED_ACTIONS = new Set([
  'goto',
  'click',
  'type',
  'select',
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
const DEFAULT_TIMEOUT = 15000;

const toString = (value) => String(value || '').trim();

const escapeAttributeValue = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const parseFilePaths = (value) =>
  String(value || '')
    .split(/[\n,]+/)
    .map((entry) => toString(entry))
    .filter(Boolean)
    .map((filePath) => (path.isAbsolute(filePath) ? filePath : path.resolve(filePath)));

const joinUrl = (baseUrl, pathOrUrl) => {
  const value = toString(pathOrUrl);
  if (!value) {
    return toString(baseUrl);
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalizedBase = toString(baseUrl);
  if (!normalizedBase) {
    return value;
  }

  return new URL(value.startsWith('/') ? value : `/${value}`, normalizedBase).toString();
};

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

const describeStep = (step, stepIndex, page) => {
  const fields = [
    `Step #${stepIndex + 1}`,
    `Action: ${toString(step.action) || '(empty)'}`,
    `Target type: ${toString(step.targetType) || 'css'}`,
    `Target: ${toString(step.target) || '(empty)'}`,
    `Value: ${toString(step.value) || '(empty)'}`,
    `Expected: ${toString(step.expected) || '(empty)'}`,
    `Timeout ms: ${Number(step.timeoutMs || DEFAULT_TIMEOUT)}`,
    `Page URL: ${page?.url?.() || '(unknown)'}`,
  ];

  return fields.join('\n');
};

const formatStepError = (step, stepIndex, page, error) => {
  const parts = [
    'Automation step failed',
    describeStep(step, stepIndex, page),
    `Error: ${error?.message || 'Unknown error'}`,
  ];

  return parts.join('\n');
};

const capturePostActionState = async (page) => {
  const initialUrl = page.url();
  const details = [];

  try {
    await page.waitForURL((currentUrl) => currentUrl.href !== initialUrl, { timeout: 2500 });
  } catch {
    // Keep going: some clicks do not navigate, and we still want the snapshot.
  }

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 1000 });
  } catch {
    // Ignore and capture whatever state is available.
  }

  try {
    details.push(`After click URL: ${page.url()}`);
  } catch {
    details.push('After click URL: (unavailable)');
  }

  try {
    const bodyText = String(await page.locator('body').innerText({ timeout: 1000 }) || '');
    details.push(`After click body preview: ${bodyText.slice(0, 500) || '(empty)'}`);
  } catch {
    details.push('After click body preview: (unavailable)');
  }

  return details.join('\n');
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

const executeStep = async (page, step, baseUrl) => {
  const action = toString(step.action).toLowerCase();
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`Unsupported automation action: ${step.action}`);
  }

  const timeoutMs = Number(step.timeoutMs || DEFAULT_TIMEOUT);
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
    await page.waitForLoadState('load', { timeout: timeoutMs });
    return `goto ${nextUrl}`;
  }

  if (action === 'click') {
    const locator = resolveClickLocator(page, step);
    const initialUrl = page.url();

    await locator.click({ timeout: timeoutMs });

    const navigated = await waitForUrlChange(page, initialUrl, 2500);

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

      await waitForUrlChange(page, initialUrl, 5000);
    }

    const state = await capturePostActionState(page);
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
    const destination = page.locator(destinationSelector).first();

    await source.dragTo(destination, { timeout: timeoutMs });
    return `dragTo ${target} -> ${destinationSelector}`;
  }

  if (action === 'waitfor') {
    if (target) {
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });
      return `waitFor visible ${target}`;
    }

    await page.waitForTimeout(timeoutMs);
    return `waitFor timeout ${timeoutMs}ms`;
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

const executeAutomationRun = async ({ testRunId, baseUrl = '', executedBy }) => {
  const testRun = await TestRun.findById(testRunId);
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const parentPlan = await TestPlan.findById(testRun.testPlan).lean();
  if (!parentPlan) {
    throw httpError(404, 'Test plan not found');
  }

  if (parentPlan.executionMode !== 'automation') {
    throw httpError(400, 'Test plan is not automation execution mode');
  }

  const testCaseIds = testRun.results.map((result) => result.testCase).filter(Boolean);
  const testCases = await TestCase.find({ _id: { $in: testCaseIds } }).lean();
  const testCaseMap = new Map(testCases.map((testCase) => [String(testCase._id), testCase]));

  let browser;
  const summary = {
    total: testRun.results.length,
    pass: 0,
    fail: 0,
    blocked: 0,
    skip: 0,
  };
  const report = [];

  try {
    if (!chromium) {
      const message = 'Playwright is not installed. Run npm install in backend before executing automation.';
      for (const result of testRun.results) {
        result.status = 'blocked';
        result.note = message;
        result.executedAt = new Date();
        result.tester = executedBy;
        summary.blocked += 1;
        report.push({
          planItemId: String(result.planItemId),
          testCaseId: String(result.testCase),
          caseKey: '',
          title: 'Playwright not installed',
          status: 'blocked',
          note: message,
          logs: [message],
        });
      }

      testRun.status = 'completed';
      testRun.endedAt = new Date();
      testRun.endedBy = executedBy;
      await testRun.save();

      return {
        testRun,
        summary,
        report,
      };
    }

    browser = await chromium.launch({ headless: true });

    for (const result of testRun.results) {
      const testCase = testCaseMap.get(String(result.testCase));
      const automation = testCase?.automation || {};
      const caseSteps = Array.isArray(automation.steps) ? automation.steps : [];
      const caseBaseUrl = baseUrl || automation.baseUrl || '';
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const logLines = [];
      let finalStatus = 'blocked';
      let finalNote = 'Automation spec is missing';

      try {
        if (!automation.enabled || caseSteps.length === 0) {
          finalStatus = 'blocked';
          finalNote = 'Automation spec is not configured for this test case';
          logLines.push(finalNote);
        } else {
          page.setDefaultTimeout(Number(automation.timeoutMs || DEFAULT_TIMEOUT));
          await page.setViewportSize({ width: 1440, height: 900 });

          const sortedSteps = [...caseSteps].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

          for (const [stepIndex, step] of sortedSteps.entries()) {
            try {
              const stepLog = await executeStep(page, step, caseBaseUrl);
              logLines.push(stepLog);
            } catch (error) {
              throw new Error(formatStepError(step, stepIndex, page, error));
            }
          }

          finalStatus = 'pass';
          finalNote = logLines.join(' | ') || 'Automation run passed';
        }
      } catch (error) {
        finalStatus = 'fail';
        finalNote = [
          'Automation step failed',
          error?.message || 'Unknown error',
          'Execution log:',
          ...logLines,
        ].join('\n');
        logLines.push(error?.message || 'Unknown error');
      } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }

      result.status = finalStatus;
      result.note = finalNote.slice(0, 2000);
      result.executedAt = new Date();
      result.tester = executedBy;

      summary[finalStatus] += 1;
      report.push({
        planItemId: String(result.planItemId),
        testCaseId: String(result.testCase),
        caseKey: testCase?.caseKey || '',
        title: testCase?.title || 'Untitled',
        status: finalStatus,
        note: finalNote,
        logs: logLines,
      });
    }

    testRun.status = 'completed';
    testRun.endedAt = new Date();
    testRun.endedBy = executedBy;
    await testRun.save();
  } catch (error) {
    const fatalNote = error?.message || 'Automation runner failed to start';

    for (const result of testRun.results) {
      if (!result.executedAt) {
        result.status = 'blocked';
        result.note = fatalNote.slice(0, 2000);
        result.executedAt = new Date();
        result.tester = executedBy;
        summary.blocked += 1;
        report.push({
          planItemId: String(result.planItemId),
          testCaseId: String(result.testCase),
          caseKey: '',
          title: 'Automation runner failed',
          status: 'blocked',
          note: fatalNote,
          logs: [fatalNote],
        });
      }
    }

    testRun.status = 'completed';
    testRun.endedAt = new Date();
    testRun.endedBy = executedBy;
    await testRun.save();
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return {
    testRun,
    summary,
    report,
  };
};

module.exports = {
  executeAutomationRun,
};