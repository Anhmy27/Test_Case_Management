/**
 * Playwright automation run orchestrator.
 * Responsible for executing an entire TestRun in automation mode:
 * iterates each result, runs Playwright steps, captures failure screenshots,
 * and persists results back to MongoDB.
 */

let chromium = null;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const TestCase = require('../../models/TestCase');
const TestRun = require('../../models/TestRun');
const { httpError } = require('../../utils/httpError');
const { createAuthManager } = require('../auth/authManager');
const { captureFailureScreenshot } = require('./failureScreenshotCapture');
const { executeSingleCaseAutomation } = require('./singleCaseExecutor');
const { assertAllowedBaseUrl } = require('../../utils/automationUrlPolicy');

const authManager = createAuthManager();

const ensureProgress = (testRun) => {
  if (!testRun.automationProgress) {
    testRun.automationProgress = {};
  }
  return testRun.automationProgress;
};

const updateAutomationProgress = async (testRun, partial) => {
  const progress = ensureProgress(testRun);
  Object.assign(progress, partial, { lastHeartbeatAt: new Date() });
  testRun.markModified('automationProgress');
  await testRun.save();
};

const isCancelRequested = async (testRunId) => {
  const doc = await TestRun.findById(testRunId).select('automationProgress.cancelRequested').lean();
  return Boolean(doc?.automationProgress?.cancelRequested);
};

const buildSummaryFromResults = (results) => {
  const summary = { total: results.length, pass: 0, fail: 0, blocked: 0, skip: 0 };
  for (const result of results) {
    if (Object.prototype.hasOwnProperty.call(summary, result.status)) {
      summary[result.status] += 1;
    }
  }
  return summary;
};

const buildBlockedResults = (testRun, message, executedBy, allowedResultIds = null) => {
  const summary = { total: 0, pass: 0, fail: 0, blocked: 0, skip: 0 };
  const report = [];
  const allowedIds = allowedResultIds ? new Set(allowedResultIds.map(String)) : null;

  for (const result of testRun.results) {
    if (allowedIds && !allowedIds.has(String(result._id))) {
      continue;
    }

    summary.total += 1;
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

  return { summary, report };
};

const finalizeCancelledRun = async (testRun, executedBy, allowedResultIds = null) => {
  const allowedIds = allowedResultIds ? new Set(allowedResultIds.map(String)) : null;

  for (const result of testRun.results) {
    if (allowedIds && !allowedIds.has(String(result._id))) {
      continue;
    }

    if (result.status === 'untested') {
      result.status = 'skip';
      result.note = 'Run cancelled by user';
      result.automationLogs = ['Run cancelled by user'];
      result.executedAt = new Date();
      result.tester = executedBy;
    }
  }

  const progress = ensureProgress(testRun);
  progress.cancelRequested = false;
  progress.currentCaseIndex = 0;
  progress.currentStepIndex = 0;
  progress.currentStepTotal = 0;
  progress.currentCaseKey = '';

  testRun.markModified('automationProgress');
  await testRun.save();
};

const executeAutomationRun = async ({
  testRunId,
  baseUrl = '',
  executedBy,
  resultIds = null,
}) => {
  const testRun = await TestRun.findById(testRunId);
  if (!testRun) throw httpError(404, 'Test run not found');

  const allowedResultIds = Array.isArray(resultIds) && resultIds.length > 0
    ? resultIds.map(String)
    : null;

  if (!allowedResultIds || allowedResultIds.length === 0) {
    throw httpError(400, 'Automation run requires at least one result id');
  }

  const resolvedBaseUrl = baseUrl || testRun.automationBaseUrl || '';
  if (resolvedBaseUrl) {
    try {
      assertAllowedBaseUrl(resolvedBaseUrl);
    } catch (error) {
      throw httpError(400, error.message || 'automation baseUrl is not allowed');
    }
  }

  if (resolvedBaseUrl && resolvedBaseUrl !== testRun.automationBaseUrl) {
    testRun.automationBaseUrl = resolvedBaseUrl;
  }

  const allowedIds = new Set(allowedResultIds);

  const testCaseIds = testRun.results
    .filter((result) => allowedIds.has(String(result._id)))
    .map((result) => result.testCase)
    .filter(Boolean);

  const testCases = await TestCase.find({ _id: { $in: testCaseIds } }).lean();
  const testCaseMap = new Map(testCases.map((tc) => [String(tc._id), tc]));

  const report = [];
  let browser;
  let cancelled = false;
  const runCaseTotal = allowedIds.size;

  await updateAutomationProgress(testRun, {
    totalCases: runCaseTotal,
    currentCaseIndex: 0,
    currentStepIndex: 0,
    currentStepTotal: 0,
    currentCaseKey: '',
    cancelRequested: false,
  });

  try {
    if (!chromium) {
      const message = 'Playwright is not installed. Run npm install in backend before executing automation.';
      const blocked = buildBlockedResults(testRun, message, executedBy, allowedResultIds);
      report.push(...blocked.report);
      await testRun.save();
      return { testRun, summary: buildSummaryFromResults(testRun.results), report };
    }

    browser = await chromium.launch({ headless: true });

    let processedCaseIndex = 0;
    for (const result of testRun.results) {
      if (!allowedIds.has(String(result._id))) {
        continue;
      }

      if (await isCancelRequested(testRunId)) {
        cancelled = true;
        break;
      }

      const testCase = testCaseMap.get(String(result.testCase));
      const automation = testCase?.automation || {};
      const caseSteps = Array.isArray(automation.steps) ? automation.steps : [];
      const caseBaseUrl = resolvedBaseUrl || automation.baseUrl || '';
      if (caseBaseUrl) {
        try {
          assertAllowedBaseUrl(caseBaseUrl);
        } catch (error) {
          throw httpError(400, error.message || 'test case automation baseUrl is not allowed');
        }
      }
      processedCaseIndex += 1;

      await updateAutomationProgress(testRun, {
        currentCaseIndex: processedCaseIndex,
        totalCases: runCaseTotal,
        currentStepIndex: 0,
        currentStepTotal: caseSteps.length,
        currentCaseKey: testCase?.caseKey || '',
      });

      const authContext = await authManager.createContext({
        browser,
        baseUrl: caseBaseUrl,
        webId: automation.webId,
        userKey: automation.userKey,
      });
      const { context } = authContext;
      const page = await context.newPage();

      const shouldAbort = () => isCancelRequested(testRunId);
      const onStepStart = async (stepIndex, stepTotal) => {
        await updateAutomationProgress(testRun, {
          currentStepIndex: stepIndex,
          currentStepTotal: stepTotal,
        });
      };

      const {
        finalStatus,
        finalNote,
        logLines,
        failureScreenshot,
        cancelled: caseCancelled,
      } = await executeSingleCaseAutomation({
        page,
        automation,
        baseUrl: caseBaseUrl,
        onStepStart,
        shouldAbort,
        captureFailureScreenshot: async (activePage) => captureFailureScreenshot({
          page: activePage,
          runId: testRun._id,
          resultId: result._id,
        }),
      });

      await authManager
        .persistContext({ context, webKey: authContext.webKey, userKey: authContext.userKey })
        .catch(() => {});
      await page.close().catch(() => {});
      await context.close().catch(() => {});

      result.status = finalStatus;
      result.note = finalNote.slice(0, 5000);
      result.automationLogs = logLines.slice(0, 200);
      result.failureScreenshot = failureScreenshot || '';
      result.executedAt = new Date();
      result.tester = executedBy;

      report.push({
        planItemId: String(result.planItemId),
        testCaseId: String(result.testCase),
        caseKey: testCase?.caseKey || '',
        title: testCase?.title || 'Untitled',
        status: finalStatus,
        note: finalNote,
        logs: logLines,
      });

      await testRun.save();

      if (caseCancelled || await isCancelRequested(testRunId)) {
        cancelled = true;
        break;
      }
    }

    if (cancelled) {
      await finalizeCancelledRun(testRun, executedBy, allowedResultIds);
      return {
        testRun,
        summary: buildSummaryFromResults(testRun.results),
        report,
        cancelled: true,
      };
    }

    await updateAutomationProgress(testRun, {
      currentCaseIndex: 0,
      currentStepIndex: 0,
      currentStepTotal: 0,
      currentCaseKey: '',
    });

    await testRun.save();
  } catch (error) {
    const fatalNote = error?.message || 'Automation runner failed to start';

    for (const result of testRun.results) {
      if (!allowedIds.has(String(result._id))) {
        continue;
      }

      if (!result.executedAt || result.status === 'untested') {
        result.status = 'blocked';
        result.note = fatalNote.slice(0, 5000);
        result.automationLogs = [fatalNote];
        result.executedAt = new Date();
        result.tester = executedBy;
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

    await testRun.save();
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return {
    testRun,
    summary: buildSummaryFromResults(testRun.results),
    report,
  };
};

module.exports = { executeAutomationRun };
