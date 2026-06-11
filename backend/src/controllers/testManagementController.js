const { asyncHandler } = require('../utils/asyncHandler');
const fs = require('fs');
const {
  startTestRunService,
  applyAutomationResultsService,
  listTestRunsService,
  getMyRunItemsService,
  updateRunResultService,
  endTestRunService,
  getDashboardService,
  getProjectDashboardService,
  getVersionDashboardService,
  getTestPlanStatsService,
  getTestPlanDetailService,
  cancelAutomationRunService,
  retryFailedAutomationRunService,
  exportTestRunService,
} = require('../services/testRunDashboardService');
const { getRunResultFailureScreenshotService } = require('../services/testRunArtifactService');
const {
  dryRunAutomationService,
  getDryRunFailureScreenshotService,
} = require('../services/automation/dryRunService');

const startTestRun = asyncHandler(async (req, res) => {
  const result = await startTestRunService({
    ...req.body,
    user: req.user,
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
  res.json(result);
});

const listTestRuns = asyncHandler(async (req, res) => {
  const result = await listTestRunsService(req.query || {}, req.user);
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
  res.json(result);
});

const endTestRun = asyncHandler(async (req, res) => {
  const result = await endTestRunService(req.params.runId, req.user);
  res.json(result);
});

const cancelAutomationRun = asyncHandler(async (req, res) => {
  const result = await cancelAutomationRunService(req.params.runId, req.user);
  res.json(result);
});

const retryFailedAutomationRun = asyncHandler(async (req, res) => {
  const result = await retryFailedAutomationRunService(
    req.params.runId,
    req.user,
    req.body?.baseUrl || '',
  );
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
  res.setHeader('Content-Type', payload.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
  res.send(payload.body);
});

const getRunResultFailureScreenshot = asyncHandler(async (req, res) => {
  const { absolutePath, contentType } = await getRunResultFailureScreenshotService(
    req.params.runId,
    req.params.resultId,
    req.user,
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(absolutePath).pipe(res);
});

const dryRunAutomation = asyncHandler(async (req, res) => {
  const result = await dryRunAutomationService({
    testCaseId: req.body?.testCaseId || '',
    automation: req.body?.automation,
    baseUrl: req.body?.baseUrl || '',
    user: req.user,
  });
  res.status(200).json(result);
});

const getDryRunFailureScreenshot = asyncHandler(async (req, res) => {
  const { absolutePath, contentType } = await getDryRunFailureScreenshotService(req.params.dryRunId);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(absolutePath).pipe(res);
});

module.exports = {
  startTestRun,
  listTestRuns,
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
  dryRunAutomation,
  getDryRunFailureScreenshot,
};
