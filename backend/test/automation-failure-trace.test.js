const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createLocalArtifactStorage } = require('../src/services/automation/artifactStorage/localArtifactStorage');
const {
  startFailureTracing,
  discardFailureTracing,
  captureFailureTrace,
} = require('../src/services/automation/failureScreenshotCapture');
const { DRY_RUN_ARTIFACT_NAMESPACE } = require('../src/config/automationArtifacts');

const createMockContext = ({ tracing }) => ({
  tracing,
});

test('startFailureTracing starts Playwright tracing', async () => {
  let started = false;
  const context = createMockContext({
    tracing: {
      start: async () => {
        started = true;
      },
    },
  });

  const result = await startFailureTracing(context);
  assert.equal(result.started, true);
  assert.equal(started, true);
});

test('discardFailureTracing stops tracing without saving', async () => {
  let stopped = false;
  const context = createMockContext({
    tracing: {
      stop: async () => {
        stopped = true;
      },
    },
  });

  await discardFailureTracing(context);
  assert.equal(stopped, true);
});

test('captureFailureTrace saves trace zip for dry run', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcm-trace-'));
  const artifactStorage = createLocalArtifactStorage({ rootDir });
  const dryRunId = 'dry-run-trace-test';
  let stopPath = '';

  const context = createMockContext({
    tracing: {
      stop: async ({ path: tracePath } = {}) => {
        if (tracePath) {
          stopPath = tracePath;
          fs.writeFileSync(tracePath, 'trace-zip-content');
        }
      },
    },
  });

  const result = await captureFailureTrace({
    context,
    runId: DRY_RUN_ARTIFACT_NAMESPACE,
    resultId: dryRunId,
    artifactStorage,
  });

  assert.equal(result.error, '');
  assert.equal(result.storageKey, `dry-run/${dryRunId}/failure.trace.zip`);
  assert.equal(stopPath, path.join(rootDir, result.storageKey));
  assert.equal(fs.existsSync(stopPath), true);
});
