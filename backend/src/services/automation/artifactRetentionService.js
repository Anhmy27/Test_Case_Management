const fs = require('fs');
const path = require('path');
const TestRun = require('../../models/TestRun');
const {
  ARTIFACT_ROOT_DIR,
  LEGACY_ARTIFACT_RUN_ROOT,
  DRY_RUN_ARTIFACT_NAMESPACE,
  getArtifactRetentionConfig,
} = require('../../config/automationArtifacts');
const { RUNS_PREFIX } = require('./artifactKeys');

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const removeDirectoryIfExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  fs.rmSync(dirPath, { recursive: true, force: true });
  return true;
};

const isPathInsideRoot = (targetPath, rootPath) => {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  return resolvedTarget === resolvedRoot
    || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
};

const cleanupDryRunArtifacts = (dryRunRetentionHours) => {
  const dryRunRoot = path.join(ARTIFACT_ROOT_DIR, DRY_RUN_ARTIFACT_NAMESPACE);
  if (!fs.existsSync(dryRunRoot)) {
    return 0;
  }

  const cutoffMs = Date.now() - (dryRunRetentionHours * 60 * 60 * 1000);
  let removed = 0;

  for (const entry of fs.readdirSync(dryRunRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dirPath = path.join(dryRunRoot, entry.name);
    const stats = fs.statSync(dirPath);
    if (stats.mtimeMs <= cutoffMs) {
      removeDirectoryIfExists(dirPath);
      removed += 1;
    }
  }

  return removed;
};

const cleanupCompletedRunArtifacts = async (retentionDays) => {
  const cutoff = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
  const completedRuns = await TestRun.find({
    status: 'completed',
    endedAt: { $lt: cutoff },
  }).select('_id').lean();

  let removed = 0;

  for (const run of completedRuns) {
    const runDir = path.join(ARTIFACT_ROOT_DIR, RUNS_PREFIX, String(run._id));
    if (!isPathInsideRoot(runDir, ARTIFACT_ROOT_DIR)) {
      continue;
    }

    if (removeDirectoryIfExists(runDir)) {
      removed += 1;
      continue;
    }

    const legacyRunDir = path.join(LEGACY_ARTIFACT_RUN_ROOT, String(run._id));
    if (isPathInsideRoot(legacyRunDir, LEGACY_ARTIFACT_RUN_ROOT) && removeDirectoryIfExists(legacyRunDir)) {
      removed += 1;
    }
  }

  return removed;
};

const runArtifactRetentionCleanup = async () => {
  ensureDirectory(ARTIFACT_ROOT_DIR);

  const { retentionDays, dryRunRetentionHours } = getArtifactRetentionConfig();
  const dryRunsRemoved = cleanupDryRunArtifacts(dryRunRetentionHours);
  const runDirsRemoved = await cleanupCompletedRunArtifacts(retentionDays);

  if (dryRunsRemoved > 0 || runDirsRemoved > 0) {
    console.log(
      `[artifactRetention] Removed ${runDirsRemoved} run artifact folder(s) and ${dryRunsRemoved} dry-run folder(s)`,
    );
  }

  return {
    dryRunsRemoved,
    runDirsRemoved,
  };
};

module.exports = {
  runArtifactRetentionCleanup,
};
