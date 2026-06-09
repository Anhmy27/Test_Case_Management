const express = require('express');
const multer = require('multer');
const {
  createTestPlan,
  listTestPlans,
  getTestPlan,
  getTestPlanVersions,
  assignTestPlanItems,
  updateTestPlan,
  deleteTestPlan,
  restoreTestPlan,
} = require('../controllers/testPlanController');
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  restoreProject,
} = require('../controllers/projectController');
const {
  createVersion,
  listVersions,
  getVersion,
  updateVersion,
  deleteVersion,
  restoreVersion,
  createIssueType,
  listIssueTypes,
  getIssueType,
  updateIssueType,
  deleteIssueType,
} = require('../controllers/versionIssueTypeController');
const {
  createTestCaseGroup,
  listTestCaseGroups,
  getTestCaseGroup,
  getTestCaseGroupVersions,
  updateTestCaseGroup,
  deleteTestCaseGroup,
  restoreTestCaseGroup,
} = require('../controllers/testCaseGroupController');
const {
  createTestCase,
  listTestCases,
  listTestCaseDetails,
  importTestCases,
  getTestCase,
  getTestCaseVersions,
  updateTestCase,
  deleteTestCase,
  restoreTestCase,
} = require('../controllers/testCaseController');
const {
  startTestRun,
  listTestRuns,
  getMyRunItems,
  updateRunResult,
  endTestRun,
  getDashboard,
  getProjectDashboard,
  getVersionDashboard,
  getTestPlanStats,
  getTestPlanDetail,
  applyAutomationResults,
  getRunResultFailureScreenshot,
  cancelAutomationRun,
  retryFailedAutomationRun,
  dryRunAutomation,
  getDryRunFailureScreenshot,
} = require('../controllers/testManagementController');
const { authenticate, authenticateAutomationIngest, authorize } = require('../middlewares/authMiddleware');
const { httpError } = require('../utils/httpError');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  projectIdParamsSchema,
  versionIdParamsSchema,
  listProjectsQuerySchema,
  createProjectBodySchema,
  updateProjectBodySchema,
  listVersionsQuerySchema,
  createVersionBodySchema,
  updateVersionBodySchema,
} = require('../validators/projectVersionSchemas');
const {
  issueTypeIdParamsSchema,
  groupIdParamsSchema,
  listIssueTypesQuerySchema,
  createIssueTypeBodySchema,
  updateIssueTypeBodySchema,
  listTestCaseGroupsQuerySchema,
  createTestCaseGroupBodySchema,
  updateTestCaseGroupBodySchema,
} = require('../validators/issueTypeGroupSchemas');
const {
  testCaseIdParamsSchema,
  createTestCaseBodySchema,
  updateTestCaseBodySchema,
  listTestCasesQuerySchema,
  listTestCaseDetailsQuerySchema,
  importTestCasesBodySchema,
} = require('../validators/testCaseSchemas');
const {
  testPlanIdParamsSchema,
  createTestPlanBodySchema,
  updateTestPlanBodySchema,
  assignTestPlanItemsBodySchema,
  listTestPlansQuerySchema,
} = require('../validators/testPlanSchemas');
const {
  runIdParamsSchema,
  runResultParamsSchema,
  dryRunIdParamsSchema,
  startTestRunBodySchema,
  retryFailedRunBodySchema,
  updateRunResultBodySchema,
  applyAutomationResultsBodySchema,
  listTestRunsQuerySchema,
  dashboardQuerySchema,
  versionDashboardQuerySchema,
  testPlanStatsQuerySchema,
  dryRunAutomationBodySchema,
} = require('../validators/testRunSchemas');

const router = express.Router();
const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMPORT_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const ALLOWED_IMPORT_EXTENSIONS = new Set(['.xls', '.xlsx']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const normalizedName = String(file?.originalname || '').toLowerCase();
    const extension = normalizedName.slice(normalizedName.lastIndexOf('.'));
    const hasValidExtension = ALLOWED_IMPORT_EXTENSIONS.has(extension);
    const hasValidMimeType = ALLOWED_IMPORT_MIME_TYPES.has(String(file?.mimetype || ''));

    if (hasValidExtension && hasValidMimeType) {
      cb(null, true);
      return;
    }

    cb(httpError(400, 'Only Excel files (.xls, .xlsx) are allowed'));
  },
});

router.post(
  '/test-runs/:runId/automation-results',
  authenticateAutomationIngest,
  validateRequest({ paramsSchema: runIdParamsSchema, bodySchema: applyAutomationResultsBodySchema }),
  applyAutomationResults,
);

router.use(authenticate);

router.get('/projects', validateRequest({ querySchema: listProjectsQuerySchema }), listProjects);
router.get('/projects/:projectId', validateRequest({ paramsSchema: projectIdParamsSchema }), getProject);
router.post('/projects', authorize('admin'), validateRequest({ bodySchema: createProjectBodySchema }), createProject);
router.put('/projects/:projectId', authorize('admin'), validateRequest({ paramsSchema: projectIdParamsSchema, bodySchema: updateProjectBodySchema }), updateProject);
router.delete('/projects/:projectId', authorize('admin'), validateRequest({ paramsSchema: projectIdParamsSchema }), deleteProject);
router.patch('/projects/:projectId/restore', authorize('admin'), validateRequest({ paramsSchema: projectIdParamsSchema }), restoreProject);

router.get('/versions', validateRequest({ querySchema: listVersionsQuerySchema }), listVersions);
router.post('/versions', authorize('admin'), validateRequest({ bodySchema: createVersionBodySchema }), createVersion);
router.get('/versions/:versionId', validateRequest({ paramsSchema: versionIdParamsSchema }), getVersion);
router.put('/versions/:versionId', authorize('admin'), validateRequest({ paramsSchema: versionIdParamsSchema, bodySchema: updateVersionBodySchema }), updateVersion);
router.delete('/versions/:versionId', authorize('admin'), validateRequest({ paramsSchema: versionIdParamsSchema }), deleteVersion);
router.patch('/versions/:versionId/restore', authorize('admin'), validateRequest({ paramsSchema: versionIdParamsSchema }), restoreVersion);

router.get('/issue-types', validateRequest({ querySchema: listIssueTypesQuerySchema }), listIssueTypes);
router.post('/issue-types', authorize('admin'), validateRequest({ bodySchema: createIssueTypeBodySchema }), createIssueType);
router.get('/issue-types/:issueTypeId', validateRequest({ paramsSchema: issueTypeIdParamsSchema }), getIssueType);
router.put('/issue-types/:issueTypeId', authorize('admin'), validateRequest({ paramsSchema: issueTypeIdParamsSchema, bodySchema: updateIssueTypeBodySchema }), updateIssueType);
router.delete('/issue-types/:issueTypeId', authorize('admin'), validateRequest({ paramsSchema: issueTypeIdParamsSchema }), deleteIssueType);

router.get('/test-case-groups', validateRequest({ querySchema: listTestCaseGroupsQuerySchema }), listTestCaseGroups);
router.get('/test-case-groups/:groupId', validateRequest({ paramsSchema: groupIdParamsSchema }), getTestCaseGroup);
router.get('/test-case-groups/:groupId/versions', validateRequest({ paramsSchema: groupIdParamsSchema }), getTestCaseGroupVersions);
router.post('/test-case-groups', authorize('admin'), validateRequest({ bodySchema: createTestCaseGroupBodySchema }), createTestCaseGroup);
router.put('/test-case-groups/:groupId', authorize('admin'), validateRequest({ paramsSchema: groupIdParamsSchema, bodySchema: updateTestCaseGroupBodySchema }), updateTestCaseGroup);
router.delete('/test-case-groups/:groupId', authorize('admin'), validateRequest({ paramsSchema: groupIdParamsSchema }), deleteTestCaseGroup);
router.patch('/test-case-groups/:groupId/restore', authorize('admin'), validateRequest({ paramsSchema: groupIdParamsSchema }), restoreTestCaseGroup);

router.get('/test-cases', validateRequest({ querySchema: listTestCasesQuerySchema }), listTestCases);
router.get('/test-cases/history', validateRequest({ querySchema: listTestCaseDetailsQuerySchema }), listTestCaseDetails);
router.post('/test-cases/import', authorize('admin'), upload.single('file'), validateRequest({ bodySchema: importTestCasesBodySchema }), importTestCases);
router.get('/test-cases/:testCaseId', validateRequest({ paramsSchema: testCaseIdParamsSchema }), getTestCase);
router.get('/test-cases/:testCaseId/versions', validateRequest({ paramsSchema: testCaseIdParamsSchema }), getTestCaseVersions);
router.post('/test-cases', authorize('admin'), validateRequest({ bodySchema: createTestCaseBodySchema }), createTestCase);
router.put('/test-cases/:testCaseId', authorize('admin'), validateRequest({ paramsSchema: testCaseIdParamsSchema, bodySchema: updateTestCaseBodySchema }), updateTestCase);
router.delete('/test-cases/:testCaseId', authorize('admin'), validateRequest({ paramsSchema: testCaseIdParamsSchema }), deleteTestCase);
router.patch('/test-cases/:testCaseId/restore', authorize('admin'), validateRequest({ paramsSchema: testCaseIdParamsSchema }), restoreTestCase);

router.get('/test-plans', validateRequest({ querySchema: listTestPlansQuerySchema }), listTestPlans);
router.get('/test-plans/:testPlanId', validateRequest({ paramsSchema: testPlanIdParamsSchema }), getTestPlan);
router.get('/test-plans/:testPlanId/versions', validateRequest({ paramsSchema: testPlanIdParamsSchema }), getTestPlanVersions);
router.post('/test-plans', authorize('admin'), validateRequest({ bodySchema: createTestPlanBodySchema }), createTestPlan);
router.put('/test-plans/:testPlanId/assign', authorize('admin'), validateRequest({ paramsSchema: testPlanIdParamsSchema, bodySchema: assignTestPlanItemsBodySchema }), assignTestPlanItems);
router.put('/test-plans/:testPlanId', authorize('admin'), validateRequest({ paramsSchema: testPlanIdParamsSchema, bodySchema: updateTestPlanBodySchema }), updateTestPlan);
router.delete('/test-plans/:testPlanId', authorize('admin'), validateRequest({ paramsSchema: testPlanIdParamsSchema }), deleteTestPlan);
router.patch('/test-plans/:testPlanId/restore', authorize('admin'), validateRequest({ paramsSchema: testPlanIdParamsSchema }), restoreTestPlan);

router.get('/test-runs', validateRequest({ querySchema: listTestRunsQuerySchema }), listTestRuns);
router.post('/test-runs', authorize('admin', 'employee'), validateRequest({ bodySchema: startTestRunBodySchema }), startTestRun);
router.post('/test-runs/:runId/cancel', authorize('admin', 'employee'), validateRequest({ paramsSchema: runIdParamsSchema }), cancelAutomationRun);
router.post('/test-runs/:runId/retry-failed', authorize('admin', 'employee'), validateRequest({ paramsSchema: runIdParamsSchema, bodySchema: retryFailedRunBodySchema }), retryFailedAutomationRun);
router.patch('/test-runs/:runId/end', authorize('admin', 'employee'), validateRequest({ paramsSchema: runIdParamsSchema }), endTestRun);

router.get('/test-runs/:runId/my-items', validateRequest({ paramsSchema: runIdParamsSchema }), getMyRunItems);
router.get('/test-runs/:runId/results/:resultId/failure-screenshot', validateRequest({ paramsSchema: runResultParamsSchema }), getRunResultFailureScreenshot);
router.patch('/test-runs/:runId/results/:resultId', validateRequest({ paramsSchema: runResultParamsSchema, bodySchema: updateRunResultBodySchema }), updateRunResult);

router.post('/automation/dry-run', authorize('admin'), validateRequest({ bodySchema: dryRunAutomationBodySchema }), dryRunAutomation);
router.get('/automation/dry-runs/:dryRunId/failure-screenshot', authorize('admin'), validateRequest({ paramsSchema: dryRunIdParamsSchema }), getDryRunFailureScreenshot);

router.get('/dashboard', authorize('admin'), validateRequest({ querySchema: dashboardQuerySchema }), getDashboard);

// Dashboard routes
router.get('/dashboard/projects', authorize('admin'), getProjectDashboard);
router.get('/dashboard/versions', authorize('admin'), validateRequest({ querySchema: versionDashboardQuerySchema }), getVersionDashboard);
router.get('/dashboard/test-plans', authorize('admin'), validateRequest({ querySchema: testPlanStatsQuerySchema }), getTestPlanStats);
router.get('/dashboard/test-plans/:testPlanId', authorize('admin'), validateRequest({ paramsSchema: testPlanIdParamsSchema }), getTestPlanDetail);

module.exports = router;

