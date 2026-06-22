const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const fs = require('fs');
const {
  startTestRunService,
  applyAutomationResultsService,
  listTestRunsService,
  updateTestRunService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
  getDashboardService,
  getProjectDashboardService,
  getVersionDashboardService,
  getTestPlanStatsService,
  getTestPlanDetailService,
  cancelAutomationRunService,
  retryFailedRunService,
  exportTestRunService,
} = require('../services/testRunDashboardService');
const {
  getRunResultFailureScreenshotService,
  uploadRunResultFailureScreenshotService,
} = require('../services/testRunArtifactService');
const {
  dryRunAutomationService,
  getDryRunFailureScreenshotService,
} = require('../services/automation/dryRunService');

function auditTestRun(req, action, testRun, metadata = null) {
  const fields = pickEntityAuditFields(testRun, { labelKeys: ['name', 'title'] });
  return auditFromRequest(req, {
    action,
    resourceType: 'test_run',
    ...fields,
    projectId: String(testRun?.project?.entityId || testRun?.project?._id || testRun?.project || fields.projectId || ''),
    metadata,
  });
}

const startTestRun = asyncHandler(async (req, res) => {
  const result = await startTestRunService({
    ...req.body,
    user: req.user,
  });
  await auditTestRun(req, 'test_run.start', result?.testRun, {
    testPlanId: req.body?.testPlanId,
    baseUrl: req.body?.baseUrl || '',
  });
  res.status(201).json(result);
});

const applyAutomationResults = asyncHandler(async (req, res) => {
  const result = await applyAutomationResultsService({
    runId: req.params.runId,
    results: req.body?.results,
    user: req.user,
    ingestSource: req.automationIngest?.source,
  });
  await auditTestRun(req, 'test_run.automation_results', result?.testRun, {
    ingestSource: req.automationIngest?.source || 'unknown',
    resultCount: Array.isArray(req.body?.results) ? req.body.results.length : 0,
  });
  res.json(result);
});

const listTestRuns = asyncHandler(async (req, res) => {
  const result = await listTestRunsService(req.query || {}, req.user);
  res.json(result);
});

const updateTestRun = asyncHandler(async (req, res) => {
  const result = await updateTestRunService(req.params.runId, req.body || {}, req.user);
  await auditTestRun(req, 'test_run.update', result?.testRun, {
    name: req.body?.name,
  });
  res.json(result);
});

const getMyRunItems = asyncHandler(async (req, res) => {
  const result = await getMyRunItemsService(req.params.runId, req.user);
  res.json(result);
});

const updateRunResult = asyncHandler(async (req, res) => {
  const result = await updateRunResultService(
    req.params.runId,
    req.params.resultId,
    req.body || {},
    req.user,
  );
  await auditTestRun(req, 'test_run.result_update', result?.testRun, {
    resultId: req.params.resultId,
    status: req.body?.status,
  });
  res.json(result);
});

const endTestRun = asyncHandler(async (req, res) => {
  const result = await endTestRunService(req.params.runId, req.user);
  await auditTestRun(req, 'test_run.end', result?.testRun);
  res.json(result);
});

const cancelAutomationRun = asyncHandler(async (req, res) => {
  const result = await cancelAutomationRunService(req.params.runId, req.user);
  await auditTestRun(req, 'test_run.cancel', result?.testRun);
  res.json(result);
});

const retryFailedAutomationRun = asyncHandler(async (req, res) => {
  const result = await retryFailedRunService(
    req.params.runId,
    req.user,
    req.body?.baseUrl || '',
  );
  await auditTestRun(req, 'test_run.retry_failed', result?.testRun);
  res.json(result);
});

const getDashboard = asyncHandler(async (req, res) => {
  const result = await getDashboardService(req.query || {});
  res.json(result);
});

const getProjectDashboard = asyncHandler(async (req, res) => {
  const result = await getProjectDashboardService();
  res.json(result);
});

const getVersionDashboard = asyncHandler(async (req, res) => {
  const result = await getVersionDashboardService(req.query || {});
  res.json(result);
});

const getTestPlanStats = asyncHandler(async (req, res) => {
  const result = await getTestPlanStatsService(req.query || {});
  res.json(result);
});

const getTestPlanDetail = asyncHandler(async (req, res) => {
  const result = await getTestPlanDetailService(req.params.testPlanId);
  res.json(result);
});

const exportTestRun = asyncHandler(async (req, res) => {
  const payload = await exportTestRunService(req.params.runId, req.query || {}, req.user);
  await auditFromRequest(req, {
    action: 'test_run.export',
    resourceType: 'test_run',
    resourceId: req.params.runId,
    metadata: { format: req.query?.format || 'xlsx' },
  });
  res.setHeader('Content-Type', payload.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
  res.send(payload.body);
});

const getRunResultFailureScreenshot = asyncHandler(async (req, res) => {
  const payload = await getRunResultFailureScreenshotService(
    req.params.runId,
    req.params.resultId,
    req.user,
  );

  res.setHeader('Content-Type', payload.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (payload.stream) {
    payload.stream.pipe(res);
    return;
  }

  fs.createReadStream(payload.absolutePath).pipe(res);
});

const uploadRunResultFailureScreenshot = asyncHandler(async (req, res) => {
  const result = await uploadRunResultFailureScreenshotService(
    req.params.runId,
    req.params.resultId,
    req.user,
    req.file,
  );
  await auditFromRequest(req, {
    action: 'test_run.upload_screenshot',
    resourceType: 'test_run',
    resourceId: req.params.runId,
    metadata: { resultId: req.params.resultId },
  });
  res.json(result);
});

const dryRunAutomation = asyncHandler(async (req, res) => {
  const result = await dryRunAutomationService({
    testCaseId: req.body?.testCaseId || '',
    automation: req.body?.automation,
    baseUrl: req.body?.baseUrl || '',
    user: req.user,
  });
  await auditFromRequest(req, {
    action: 'automation.dry_run',
    resourceType: 'test_case',
    resourceId: req.body?.testCaseId || '',
    metadata: { success: result?.success, dryRunId: result?.dryRunId },
  });
  res.status(200).json(result);
});

const getDryRunFailureScreenshot = asyncHandler(async (req, res) => {
  const payload = await getDryRunFailureScreenshotService(req.params.dryRunId);

  res.setHeader('Content-Type', payload.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (payload.stream) {
    payload.stream.pipe(res);
    return;
  }

  fs.createReadStream(payload.absolutePath).pipe(res);
});

module.exports = {
  startTestRun,
  listTestRuns,
  updateTestRun,
  getMyRunItems,
  updateRunResult,
  applyAutomationResults,
  endTestRun,
  cancelAutomationRun,
  retryFailedAutomationRun,
  getDashboard,
  getProjectDashboard,
  getVersionDashboard,
  getTestPlanStats,
  getTestPlanDetail,
  exportTestRun,
  getRunResultFailureScreenshot,
  uploadRunResultFailureScreenshot,
  dryRunAutomation,
  getDryRunFailureScreenshot,
};
