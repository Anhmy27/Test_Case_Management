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
} = require('../services/testRunDashboardService');
const { getRunResultFailureScreenshotService } = require('../services/testRunArtifactService');

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
    automationSecret: req.headers['x-automation-secret'],
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

const getRunResultFailureScreenshot = asyncHandler(async (req, res) => {
  const { absolutePath, contentType } = await getRunResultFailureScreenshotService(
    req.params.runId,
    req.params.resultId,
  );

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
  getDashboard,
  getProjectDashboard,
  getVersionDashboard,
  getTestPlanStats,
  getTestPlanDetail,
  getRunResultFailureScreenshot,
};
