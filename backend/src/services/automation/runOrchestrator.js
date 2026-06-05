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
const { findTestPlanByReference } = require('../../utils/entityResolvers');
const { createAuthManager } = require('../auth/authManager');
const { captureFailureScreenshot } = require('./failureScreenshotCapture');
const { executeSingleCaseAutomation } = require('./singleCaseExecutor');

const authManager = createAuthManager();

const isCancelledError = (error) => error?.code === 'AUTOMATION_CANCELLED';

const ensureProgress = (testRun) => {
  if (!testRun.automationProgress) {
    testRun.automationProgress = {};
  }
  return testRun.automationProgress;
};

const updateAutomationProgress = async (testRun, partial) => {
  const progress = ensureProgress(testRun);
  Object.assign(progress, partial);
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

const buildBlockedResults = (testRun, message, executedBy) => {
  const summary = { total: testRun.results.length, pass: 0, fail: 0, blocked: 0, skip: 0 };
  const report = [];

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

  return { summary, report };
};

const finalizeCancelledRun = async (testRun, executedBy) => {
  for (const result of testRun.results) {
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

  testRun.status = 'completed';
  testRun.endedAt = new Date();
  testRun.endedBy = executedBy;
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

  const parentPlan = await findTestPlanByReference(testRun.testPlan);
  if (!parentPlan) throw httpError(404, 'Test plan not found');
  if (parentPlan.executionMode !== 'automation') {
    throw httpError(400, 'Test plan is not automation execution mode');
  }

  const resolvedBaseUrl = baseUrl || testRun.automationBaseUrl || '';
  if (resolvedBaseUrl && resolvedBaseUrl !== testRun.automationBaseUrl) {
    testRun.automationBaseUrl = resolvedBaseUrl;
  }

  const allowedResultIds = Array.isArray(resultIds) && resultIds.length > 0
    ? new Set(resultIds.map(String))
    : null;

  const testCaseIds = testRun.results
    .filter((result) => !allowedResultIds || allowedResultIds.has(String(result._id)))
    .map((result) => result.testCase)
    .filter(Boolean);

  const testCases = await TestCase.find({ _id: { $in: testCaseIds } }).lean();
  const testCaseMap = new Map(testCases.map((tc) => [String(tc._id), tc]));

  const report = [];
  let browser;
  let cancelled = false;
  const runCaseTotal = allowedResultIds ? allowedResultIds.size : testRun.results.length;

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
      const blocked = buildBlockedResults(testRun, message, executedBy);
      report.push(...blocked.report);
      testRun.status = 'completed';
      testRun.endedAt = new Date();
      testRun.endedBy = executedBy;
      await testRun.save();
      return { testRun, summary: buildSummaryFromResults(testRun.results), report };
    }

    browser = await chromium.launch({ headless: true });

    let processedCaseIndex = 0;
    for (const result of testRun.results) {
      if (allowedResultIds && !allowedResultIds.has(String(result._id))) {
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
      await finalizeCancelledRun(testRun, executedBy);
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

    testRun.status = 'completed';
    testRun.endedAt = new Date();
    testRun.endedBy = executedBy;
    await testRun.save();
  } catch (error) {
    const fatalNote = error?.message || 'Automation runner failed to start';

    for (const result of testRun.results) {
      if (!allowedResultIds || allowedResultIds.has(String(result._id))) {
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
    }

    testRun.status = 'completed';
    testRun.endedAt = new Date();
    testRun.endedBy = executedBy;
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
