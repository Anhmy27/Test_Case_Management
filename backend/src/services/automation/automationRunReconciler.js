const TestRun = require('../../models/TestRun');
const TestPlan = require('../../models/TestPlan');
const { scheduleAutomationRun, isAutomationRunActive } = require('./automationJobRunner');

const reconcileOrphanedAutomationRuns = async () => {
  const runningRuns = await TestRun.find({ status: 'running' }).lean();
  if (!runningRuns.length) {
    return { resumed: 0, finalized: 0, skipped: 0 };
  }

  let resumed = 0;
  let finalized = 0;
  let skipped = 0;

  for (const run of runningRuns) {
    const plan = await TestPlan.findById(run.testPlan).select('executionMode').lean();
    if (!plan || plan.executionMode !== 'automation') {
      skipped += 1;
      continue;
    }

    if (isAutomationRunActive(run._id)) {
      skipped += 1;
      continue;
    }

    const pendingResultIds = (run.results || [])
      .filter((result) => !result.executedAt)
      .map((result) => String(result._id));

    if (!pendingResultIds.length) {
      await TestRun.findByIdAndUpdate(run._id, {
        $set: {
          status: 'completed',
          endedAt: run.endedAt || new Date(),
          endedBy: run.endedBy || run.startedBy,
        },
      });
      finalized += 1;
      console.log(`[automationReconciler] Finalized orphaned run ${run._id} with no pending cases`);
      continue;
    }

    const queued = scheduleAutomationRun({
      testRunId: run._id,
      baseUrl: run.automationBaseUrl || '',
      executedBy: run.startedBy,
      resultIds: pendingResultIds,
    });

    if (queued) {
      resumed += 1;
      console.log(
        `[automationReconciler] Resumed orphaned run ${run._id} (${pendingResultIds.length} pending case(s))`,
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
