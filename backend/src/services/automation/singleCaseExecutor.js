/**
 * Executes Playwright automation steps for a single test case.
 * Shared by full test runs and dry-run previews.
 */

const { runAutomationSteps, DEFAULT_TIMEOUT } = require('./playwrightExecutor');

const isCancelledError = (error) => error?.code === 'AUTOMATION_CANCELLED';

const executeSingleCaseAutomation = async ({
  page,
  automation,
  baseUrl,
  onStepStart,
  shouldAbort,
  captureFailureScreenshot,
}) => {
  const caseSteps = Array.isArray(automation?.steps) ? automation.steps : [];
  const logLines = [];
  let finalStatus = 'blocked';
  let finalNote = 'Automation spec is missing';
  let failureScreenshot = '';
  let cancelled = false;

  try {
    if (!automation?.enabled || caseSteps.length === 0) {
      finalStatus = 'blocked';
      finalNote = 'Automation spec is not configured for this test case';
      logLines.push(finalNote);
    } else {
      page.setDefaultTimeout(Number(automation.timeoutMs) > 0 ? Number(automation.timeoutMs) : DEFAULT_TIMEOUT);
      await page.setViewportSize({ width: 1440, height: 900 });

      const stepLogs = await runAutomationSteps({
        page,
        steps: caseSteps,
        baseUrl,
        onStepStart,
        shouldAbort,
      });
      logLines.push(...stepLogs);

      finalStatus = 'pass';
      finalNote = logLines.join(' | ') || 'Automation run passed';
    }
  } catch (error) {
    if (isCancelledError(error)) {
      cancelled = true;
      finalStatus = 'skip';
      finalNote = 'Run cancelled by user';
      logLines.push(finalNote);
    } else {
      finalStatus = 'fail';
      finalNote = [
        'Automation step failed',
        error?.message || 'Unknown error',
        'Execution log:',
        ...logLines,
      ].join('\n');
      logLines.push(error?.message || 'Unknown error');

      if (typeof captureFailureScreenshot === 'function') {
        const screenshotCapture = await captureFailureScreenshot(page);
        if (screenshotCapture.relativePath) {
          failureScreenshot = screenshotCapture.relativePath;
          logLines.push(`Failure screenshot saved: ${failureScreenshot}`);
        } else if (screenshotCapture.error) {
          logLines.push(`Failure screenshot capture failed: ${screenshotCapture.error}`);
        }
      }
    }
  }

  return { finalStatus, finalNote, logLines, failureScreenshot, cancelled };
};

module.exports = {
  executeSingleCaseAutomation,
  isCancelledError,
};
