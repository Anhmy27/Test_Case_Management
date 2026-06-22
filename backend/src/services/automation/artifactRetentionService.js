const fs = require('fs');
const path = require('path');
const TestRun = require('../../models/TestRun');
const {
  ARTIFACT_ROOT_DIR,
  LEGACY_ARTIFACT_NESTED_ROOT,
  LEGACY_ARTIFACT_RUN_ROOT,
  DRY_RUN_ARTIFACT_NAMESPACE,
  getArtifactRetentionConfig,
} = require('../../config/automationArtifacts');
const { RUN_PREFIX, LEGACY_RUNS_PREFIX } = require('./artifactKeys');

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

const removeFirstExistingDirectory = (candidates) => {
  for (const dirPath of candidates) {
    if (removeDirectoryIfExists(dirPath)) {
      return true;
    }
  }
  return false;
};

const cleanupDryRunArtifacts = (dryRunRetentionHours) => {
  const dryRunRoots = [
    path.join(ARTIFACT_ROOT_DIR, DRY_RUN_ARTIFACT_NAMESPACE),
    path.join(LEGACY_ARTIFACT_NESTED_ROOT, DRY_RUN_ARTIFACT_NAMESPACE),
  ];

  const cutoffMs = Date.now() - (dryRunRetentionHours * 60 * 60 * 1000);
  let removed = 0;

  for (const dryRunRoot of dryRunRoots) {
    if (!fs.existsSync(dryRunRoot)) {
      continue;
    }

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
    const runId = String(run._id);
    const candidateRoots = [
      [ARTIFACT_ROOT_DIR, RUN_PREFIX],
      [LEGACY_ARTIFACT_NESTED_ROOT, RUN_PREFIX],
      [LEGACY_ARTIFACT_NESTED_ROOT, LEGACY_RUNS_PREFIX],
    ];

    const candidates = candidateRoots
      .map(([root, prefix]) => path.join(root, prefix, runId))
      .filter((dirPath) => candidateRoots.some(([root]) => isPathInsideRoot(dirPath, root)));

    candidates.push(path.join(LEGACY_ARTIFACT_RUN_ROOT, runId));

    if (removeFirstExistingDirectory(candidates)) {
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
