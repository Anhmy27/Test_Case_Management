/**
 * Schedules Playwright automation runs in the background so HTTP requests
 * return immediately after creating the TestRun document.
 */

const TestRun = require('../../models/TestRun');
const { executeAutomationRun } = require('./runOrchestrator');
const {
  loadTestCaseMapForResults,
  isAutomationRunResult,
} = require('../../utils/runAutomationPartition');

const activeRunIds = new Set();

const isAutomationRunActive = (testRunId) => activeRunIds.has(String(testRunId));

const finalizeUnexpectedFailure = async (testRunId, executedBy, error) => {
  const testRun = await TestRun.findById(testRunId);
  if (!testRun || testRun.status !== 'running') {
    return;
  }

  const message = error?.message || 'Automation runner failed unexpectedly';
  const testCaseMap = await loadTestCaseMapForResults(testRun.results);

  for (const result of testRun.results) {
    if (!isAutomationRunResult(result, testCaseMap)) {
      continue;
    }

    if (!result.executedAt) {
      result.status = 'blocked';
      result.note = message.slice(0, 5000);
      result.automationLogs = [message];
      result.executedAt = new Date();
      result.tester = executedBy;
    }
  }

  await testRun.save();
};

/**
 * Queue automation for a running TestRun. Returns false if already queued/running.
 */
const scheduleAutomationRun = ({ testRunId, baseUrl = '', executedBy, resultIds = null }) => {
  const runKey = String(testRunId);
  if (activeRunIds.has(runKey)) {
    return false;
  }

  activeRunIds.add(runKey);

  setImmediate(async () => {
    try {
      const existing = await TestRun.findById(testRunId).lean();
      if (!existing || existing.status !== 'running') {
        return;
      }

      await executeAutomationRun({
        testRunId,
        baseUrl,
        executedBy,
        resultIds,
      });
    } catch (error) {
      console.error(`[automationJobRunner] Run ${runKey} failed:`, error);
      try {
        await finalizeUnexpectedFailure(testRunId, executedBy, error);
      } catch (finalizeError) {
        console.error(`[automationJobRunner] Failed to finalize run ${runKey}:`, finalizeError);
      }
    } finally {
      activeRunIds.delete(runKey);
    }
  });

  return true;
};

module.exports = {
  scheduleAutomationRun,
  isAutomationRunActive,
};
