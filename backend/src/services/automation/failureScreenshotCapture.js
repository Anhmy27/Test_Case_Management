const { getArtifactStorage } = require('./artifactStorage');
const { DRY_RUN_ARTIFACT_NAMESPACE } = require('../../config/automationArtifacts');

const defaultArtifactStorage = getArtifactStorage();

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
    const storageKey = String(runId) === DRY_RUN_ARTIFACT_NAMESPACE
      ? artifactStorage.buildDryRunFailureScreenshotKey(resultId)
      : artifactStorage.buildRunFailureScreenshotKey(runId, resultId);

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

module.exports = {
  captureFailureScreenshot,
};
