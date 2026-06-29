const { getArtifactStorage } = require('./artifactStorage');
const { DRY_RUN_ARTIFACT_NAMESPACE } = require('../../config/automationArtifacts');

const defaultArtifactStorage = getArtifactStorage();

const resolveFailureArtifactStorageKey = ({
  runId,
  resultId,
  artifactStorage = defaultArtifactStorage,
  dryRunKeyBuilder,
  runKeyBuilder,
}) => (
  String(runId) === DRY_RUN_ARTIFACT_NAMESPACE
    ? dryRunKeyBuilder(resultId)
    : runKeyBuilder(runId, resultId)
);

const captureFailureScreenshot = async ({
  page,
  runId,
  resultId,
  artifactStorage = defaultArtifactStorage,
  fullPage = true,
}) => {
  if (!page) {
    return { storageKey: '', error: 'Browser page is not available' };
  }

  try {
    const storageKey = resolveFailureArtifactStorageKey({
      runId,
      resultId,
      artifactStorage,
      dryRunKeyBuilder: artifactStorage.buildDryRunFailureScreenshotKey,
      runKeyBuilder: artifactStorage.buildRunFailureScreenshotKey,
    });

    if (artifactStorage.driver !== 'local') {
      throw new Error('Playwright screenshot capture requires local artifact storage');
    }

    const absolutePath = artifactStorage.ensureKeyDirectory(storageKey);
    await page.screenshot({ path: absolutePath, fullPage });

    return {
      storageKey,
      error: '',
    };
  } catch (error) {
    return {
      storageKey: '',
      error: error?.message || 'Unable to capture failure screenshot',
    };
  }
};

const startFailureTracing = async (context) => {
  if (!context?.tracing) {
    return { started: false, error: 'Browser context tracing is not available' };
  }

  try {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    return { started: true, error: '' };
  } catch (error) {
    return {
      started: false,
      error: error?.message || 'Unable to start Playwright tracing',
    };
  }
};

const discardFailureTracing = async (context) => {
  if (!context?.tracing) {
    return;
  }

  try {
    await context.tracing.stop();
  } catch {
    // Trace may already be stopped after a failure capture.
  }
};

const captureFailureTrace = async ({
  context,
  runId,
  resultId,
  artifactStorage = defaultArtifactStorage,
}) => {
  if (!context?.tracing) {
    return { storageKey: '', error: 'Browser context tracing is not available' };
  }

  try {
    const storageKey = resolveFailureArtifactStorageKey({
      runId,
      resultId,
      artifactStorage,
      dryRunKeyBuilder: artifactStorage.buildDryRunFailureTraceKey,
      runKeyBuilder: artifactStorage.buildRunFailureTraceKey,
    });

    if (artifactStorage.driver !== 'local') {
      throw new Error('Playwright trace capture requires local artifact storage');
    }

    const absolutePath = artifactStorage.ensureKeyDirectory(storageKey);
    await context.tracing.stop({ path: absolutePath });

    return {
      storageKey,
      error: '',
    };
  } catch (error) {
    await discardFailureTracing(context);
    return {
      storageKey: '',
      error: error?.message || 'Unable to capture failure trace',
    };
  }
};

module.exports = {
  captureFailureScreenshot,
  startFailureTracing,
  discardFailureTracing,
  captureFailureTrace,
};
