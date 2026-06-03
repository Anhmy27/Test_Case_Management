const { createArtifactStore } = require('./artifactStore');

const defaultArtifactStore = createArtifactStore();

const captureFailureScreenshot = async ({
  page,
  runId,
  resultId,
  artifactStore = defaultArtifactStore,
  fullPage = true,
}) => {
  if (!page) {
    return { relativePath: '', error: 'Browser page is not available' };
  }

  try {
    artifactStore.ensureResultDirectory({ runId, resultId });
    const absolutePath = artifactStore.getFailureScreenshotAbsolutePath({ runId, resultId });
    await page.screenshot({ path: absolutePath, fullPage });

    return {
      relativePath: artifactStore.toRelativePath(absolutePath),
      error: '',
    };
  } catch (error) {
    return {
      relativePath: '',
      error: error?.message || 'Unable to capture failure screenshot',
    };
  }
};

module.exports = {
  captureFailureScreenshot,
};
