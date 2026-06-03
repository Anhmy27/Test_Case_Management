let chromium = null;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}
const TestCase = require('../models/TestCase');
const TestPlan = require('../models/TestPlan');
const TestRun = require('../models/TestRun');
const { httpError } = require('../utils/httpError');
const { createAuthManager } = require('./auth/authManager');
const { runAutomationSteps, DEFAULT_TIMEOUT } = require('./automation/playwrightExecutor');

const authManager = createAuthManager();

const findTestPlanByReference = async (testPlanRef) => {
  if (!testPlanRef) {
    return null;
  }

  const objectId = new (require('mongoose')).Types.ObjectId(String(testPlanRef));
  return TestPlan.findOne({
    $and: [
      { $or: [{ entityId: objectId }, { _id: objectId }] },
      { deletedAt: null },
      { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
    ],
  }).lean();
};

const executeAutomationRun = async ({ testRunId, baseUrl = '', executedBy }) => {
  const testRun = await TestRun.findById(testRunId);
  if (!testRun) {
    throw httpError(404, 'Test run not found');
  }

  const parentPlan = await findTestPlanByReference(testRun.testPlan);
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
      const authContext = await authManager.createContext({
        browser,
        baseUrl: caseBaseUrl,
        webId: automation.webId,
        userKey: automation.userKey,
      });
      const { context } = authContext;
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
          page.setDefaultTimeout(Number(automation.timeoutMs) > 0 ? Number(automation.timeoutMs) : DEFAULT_TIMEOUT);
          await page.setViewportSize({ width: 1440, height: 900 });

          const stepLogs = await runAutomationSteps({ page, steps: caseSteps, baseUrl: caseBaseUrl });
          logLines.push(...stepLogs);

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
        await authManager
          .persistContext({
            context,
            webKey: authContext.webKey,
            userKey: authContext.userKey,
          })
          .catch(() => {});
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }

      result.status = finalStatus;
      result.note = finalNote.slice(0, 5000);
      result.automationLogs = logLines.slice(0, 200);
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
        result.note = fatalNote.slice(0, 5000);
        result.automationLogs = [fatalNote];
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