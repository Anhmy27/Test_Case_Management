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
} = require('../controllers/testManagementController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { httpError } = require('../utils/httpError');

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

router.use(authenticate);

router.post('/test-runs/:runId/automation-results', applyAutomationResults);

router.get('/projects', listProjects);
router.get('/projects/:projectId', getProject);
router.post('/projects', authorize('admin'), createProject);
router.put('/projects/:projectId', authorize('admin'), updateProject);
router.delete('/projects/:projectId', authorize('admin'), deleteProject);
router.patch('/projects/:projectId/restore', authorize('admin'), restoreProject);

router.get('/versions', listVersions);
router.post('/versions', authorize('admin'), createVersion);
router.get('/versions/:versionId', getVersion);
router.put('/versions/:versionId', authorize('admin'), updateVersion);
router.delete('/versions/:versionId', authorize('admin'), deleteVersion);
router.patch('/versions/:versionId/restore', authorize('admin'), restoreVersion);

router.get('/issue-types', listIssueTypes);
router.post('/issue-types', authorize('admin'), createIssueType);
router.get('/issue-types/:issueTypeId', getIssueType);
router.put('/issue-types/:issueTypeId', authorize('admin'), updateIssueType);
router.delete('/issue-types/:issueTypeId', authorize('admin'), deleteIssueType);

router.get('/test-case-groups', listTestCaseGroups);
router.get('/test-case-groups/:groupId', getTestCaseGroup);
router.get('/test-case-groups/:groupId/versions', getTestCaseGroupVersions);
router.post('/test-case-groups', authorize('admin'), createTestCaseGroup);
router.put('/test-case-groups/:groupId', authorize('admin'), updateTestCaseGroup);
router.delete('/test-case-groups/:groupId', authorize('admin'), deleteTestCaseGroup);
router.patch('/test-case-groups/:groupId/restore', authorize('admin'), restoreTestCaseGroup);

router.get('/test-cases', listTestCases);
router.get('/test-cases/history', listTestCaseDetails);
router.post('/test-cases/import', authorize('admin'), upload.single('file'), importTestCases);
router.get('/test-cases/:testCaseId', getTestCase);
router.get('/test-cases/:testCaseId/versions', getTestCaseVersions);
router.post('/test-cases', authorize('admin'), createTestCase);
router.put('/test-cases/:testCaseId', authorize('admin'), updateTestCase);
router.delete('/test-cases/:testCaseId', authorize('admin'), deleteTestCase);
router.patch('/test-cases/:testCaseId/restore', authorize('admin'), restoreTestCase);

router.get('/test-plans', listTestPlans);
router.get('/test-plans/:testPlanId', getTestPlan);
router.get('/test-plans/:testPlanId/versions', getTestPlanVersions);
router.post('/test-plans', authorize('admin'), createTestPlan);
router.put('/test-plans/:testPlanId/assign', authorize('admin'), assignTestPlanItems);
router.put('/test-plans/:testPlanId', authorize('admin'), updateTestPlan);
router.delete('/test-plans/:testPlanId', authorize('admin'), deleteTestPlan);
router.patch('/test-plans/:testPlanId/restore', authorize('admin'), restoreTestPlan);

router.get('/test-runs', listTestRuns);
router.post('/test-runs', authorize('admin', 'employee'), startTestRun);
router.patch('/test-runs/:runId/end', authorize('admin', 'employee'), endTestRun);

router.get('/test-runs/:runId/my-items', getMyRunItems);
router.get('/test-runs/:runId/results/:resultId/failure-screenshot', getRunResultFailureScreenshot);
router.patch('/test-runs/:runId/results/:resultId', updateRunResult);

router.get('/dashboard', authorize('admin'), getDashboard);

// Dashboard routes
router.get('/dashboard/projects', authorize('admin'), getProjectDashboard);
router.get('/dashboard/versions', authorize('admin'), getVersionDashboard);
router.get('/dashboard/test-plans', authorize('admin'), getTestPlanStats);
router.get('/dashboard/test-plans/:testPlanId', authorize('admin'), getTestPlanDetail);

module.exports = router;

