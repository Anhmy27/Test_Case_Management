/**
 * Dry-run: execute automation for one test case without creating a TestRun.
 * Also serves dry-run failure screenshots from the artifact store.
 */

let chromium = null;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const crypto = require('crypto');
const TestCase = require('../../models/TestCase');
const { httpError } = require('../../utils/httpError');
const { toObjectId } = require('../../utils/entityResolvers');
const { createAuthManager } = require('../auth/authManager');
const { executeSingleCaseAutomation } = require('./singleCaseExecutor');
const { captureFailureScreenshot } = require('./failureScreenshotCapture');
const { getArtifactStorage } = require('./artifactStorage');
const { assertAllowedBaseUrl } = require('../../utils/automationUrlPolicy');
const {
  DRY_RUN_ARTIFACT_NAMESPACE,
} = require('../../config/automationArtifacts');

const authManager = createAuthManager();
const artifactStorage = getArtifactStorage();

const { normalizeCaseTimeoutMs, normalizeTimeoutInputMs } = require('../../utils/automationTimeouts');

const normalizeAutomationSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step) => step && String(step.action || '').trim())
    .map((step, index) => {
      const optionalTimeoutMs = normalizeTimeoutInputMs(step.timeoutMs);
      const normalized = {
        stepId: String(step.stepId || '').trim() || String(index + 1),
        stepName: String(step.stepName || '').trim(),
        order: index + 1,
        action: String(step.action || 'goto').trim(),
        targetType: String(step.targetType || 'css').trim(),
        target: String(step.target || '').trim(),
        value: String(step.value || '').trim(),
        expected: String(step.expected || '').trim(),
      };

      if (optionalTimeoutMs !== null) {
        normalized.timeoutMs = optionalTimeoutMs;
      }

      return normalized;
    });
};

const normalizeAutomationConfig = (automation = {}) => {
  const timeoutMs = normalizeCaseTimeoutMs(automation.timeoutMs);

  return {
    enabled: Boolean(automation.enabled),
    webId: String(automation.webId || '').trim(),
    baseUrl: String(automation.baseUrl || '').trim(),
    userKey: String(automation.userKey || '').trim(),
    timeoutMs,
    steps: normalizeAutomationSteps(automation.steps),
  };
};

const dryRunAutomationService = async ({
  testCaseId,
  automation,
  baseUrl = '',
  user,
}) => {
  if (!automation || typeof automation !== 'object') {
    throw httpError(400, 'automation config is required');
  }

  const normalizedAutomation = normalizeAutomationConfig(automation);
  if (!normalizedAutomation.enabled) {
    throw httpError(400, 'Automation must be enabled for dry run');
  }
  if (normalizedAutomation.steps.length === 0) {
    throw httpError(400, 'At least one automation step is required');
  }

  const resolvedBaseUrl = String(baseUrl || normalizedAutomation.baseUrl || '').trim();
  if (!resolvedBaseUrl) {
    throw httpError(400, 'baseUrl is required for dry run');
  }

  try {
    assertAllowedBaseUrl(resolvedBaseUrl);
  } catch (error) {
    throw httpError(400, error.message || 'baseUrl is not allowed');
  }

  let caseKey = '';
  let title = 'Dry run';

  if (testCaseId) {
    const testCase = await TestCase.findOne({
      $and: [
        {
          $or: [
            { _id: toObjectId(testCaseId, 'testCaseId') },
            { entityId: toObjectId(testCaseId, 'testCaseId') },
          ],
        },
        { deletedAt: null },
        { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
      ],
    }).lean();

    if (!testCase) {
      throw httpError(404, 'Test case not found');
    }

    caseKey = testCase.caseKey || '';
    title = testCase.title || title;
  }

  if (!chromium) {
    throw httpError(503, 'Playwright is not installed. Run npm install in backend before executing automation.');
  }

  const dryRunId = crypto.randomUUID();
  const startedAt = Date.now();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    const authContext = await authManager.createContext({
      browser,
      baseUrl: resolvedBaseUrl,
      webId: normalizedAutomation.webId,
      userKey: normalizedAutomation.userKey,
    });
    const { context } = authContext;
    const page = await context.newPage();

    const {
      finalStatus,
      finalNote,
      logLines,
      failureScreenshot,
    } = await executeSingleCaseAutomation({
      page,
      automation: normalizedAutomation,
      baseUrl: resolvedBaseUrl,
      captureFailureScreenshot: async (activePage) => captureFailureScreenshot({
        page: activePage,
        runId: DRY_RUN_ARTIFACT_NAMESPACE,
        resultId: dryRunId,
      }),
    });

    await authManager
      .persistContext({ context, webKey: authContext.webKey, userKey: authContext.userKey })
      .catch(() => {});
    await page.close().catch(() => {});
    await context.close().catch(() => {});

    return {
      dryRunId,
      status: finalStatus,
      note: finalNote,
      logs: logLines,
      failureScreenshot: failureScreenshot || '',
      durationMs: Date.now() - startedAt,
      testCase: {
        id: testCaseId ? String(testCaseId) : '',
        caseKey,
        title,
      },
      executedBy: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

const getDryRunFailureScreenshotService = async (dryRunId) => {
  const normalizedId = String(dryRunId || '').trim();
  if (!normalizedId) {
    throw httpError(400, 'dryRunId is required');
  }

  const storageKey = artifactStorage.buildDryRunFailureScreenshotKey(normalizedId);
  const contentType = artifactStorage.getContentType(storageKey);

  if (artifactStorage.driver === 's3') {
    const payload = await artifactStorage.getReadablePayload(storageKey);
    return {
      stream: payload.stream,
      contentType: payload.contentType || contentType,
    };
  }

  const absolutePath = artifactStorage.resolveReadablePath(storageKey);
  if (!absolutePath) {
    throw httpError(404, 'Dry run screenshot not found');
  }

  return {
    absolutePath,
    contentType,
  };
};

module.exports = {
  dryRunAutomationService,
  getDryRunFailureScreenshotService,
};
