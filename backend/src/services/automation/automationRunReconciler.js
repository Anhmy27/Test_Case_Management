const TestRun = require('../../models/TestRun');
const { scheduleAutomationRun, isAutomationRunActive } = require('./automationJobRunner');
const {
  loadTestCaseMapForResults,
  getPendingAutomationResultIds,
  runHasAutomationCases,
} = require('../../utils/runAutomationPartition');

const reconcileOrphanedAutomationRuns = async () => {
  const runningRuns = await TestRun.find({ status: 'running' }).lean();
  if (!runningRuns.length) {
    return { resumed: 0, finalized: 0, skipped: 0 };
  }

  let resumed = 0;
  let finalized = 0;
  let skipped = 0;

  for (const run of runningRuns) {
    const testCaseMap = await loadTestCaseMapForResults(run.results || []);
    if (!runHasAutomationCases(run.results || [], testCaseMap)) {
      skipped += 1;
      continue;
    }

    if (isAutomationRunActive(run._id)) {
      skipped += 1;
      continue;
    }

    const pendingAutomationResultIds = getPendingAutomationResultIds(run.results || [], testCaseMap);

    if (!pendingAutomationResultIds.length) {
      const allDone = (run.results || []).every((result) => result.status !== 'untested');
      if (allDone) {
        await TestRun.findByIdAndUpdate(run._id, {
          $set: {
            status: 'completed',
            endedAt: run.endedAt || new Date(),
            endedBy: run.endedBy || run.startedBy,
          },
        });
        finalized += 1;
        console.log(`[automationReconciler] Finalized orphaned run ${run._id} with no pending cases`);
      } else {
        skipped += 1;
      }
      continue;
    }

    const queued = scheduleAutomationRun({
      testRunId: run._id,
      baseUrl: run.automationBaseUrl || '',
      executedBy: run.startedBy,
      resultIds: pendingAutomationResultIds,
    });

    if (queued) {
      resumed += 1;
      console.log(
        `[automationReconciler] Resumed orphaned run ${run._id} (${pendingAutomationResultIds.length} pending automation case(s))`,
      );
    } else {
      skipped += 1;
    }
  }

  return { resumed, finalized, skipped };
};

module.exports = {
  reconcileOrphanedAutomationRuns,
};
