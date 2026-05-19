const express = require('express');
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  restoreProject,
  createVersion,
  listVersions,
  getVersion,
  updateVersion,
  deleteVersion,
  restoreVersion,
  createTestCaseGroup,
  listTestCaseGroups,
  getTestCaseGroup,
  getTestCaseGroupVersions,
  updateTestCaseGroup,
  deleteTestCaseGroup,
  restoreTestCaseGroup,
  createTestCase,
  listTestCases,
  getTestCase,
  getTestCaseVersions,
  updateTestCase,
  deleteTestCase,
  restoreTestCase,
  createTestPlan,
  listTestPlans,
  getTestPlan,
  getTestPlanVersions,
  assignTestPlanItems,
  updateTestPlan,
  deleteTestPlan,
  restoreTestPlan,
} = require('../services/testManagementService');
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
} = require('../controllers/testManagementController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();
// Allow automation systems to POST results using a secret header without normal auth
router.post('/test-runs/:runId/automation-results', applyAutomationResults);

router.use(authenticate);

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

router.get('/test-case-groups', listTestCaseGroups);
router.get('/test-case-groups/:groupId', getTestCaseGroup);
router.get('/test-case-groups/:groupId/versions', getTestCaseGroupVersions);
router.post('/test-case-groups', authorize('admin'), createTestCaseGroup);
router.put('/test-case-groups/:groupId', authorize('admin'), updateTestCaseGroup);
router.delete('/test-case-groups/:groupId', authorize('admin'), deleteTestCaseGroup);
router.patch('/test-case-groups/:groupId/restore', authorize('admin'), restoreTestCaseGroup);

router.get('/test-cases', listTestCases);
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
router.patch('/test-runs/:runId/results/:resultId', updateRunResult);

router.get('/dashboard', getDashboard);

// Dashboard routes
router.get('/dashboard/projects', getProjectDashboard);
router.get('/dashboard/versions', getVersionDashboard);
router.get('/dashboard/test-plans', getTestPlanStats);
router.get('/dashboard/test-plans/:testPlanId', getTestPlanDetail);

module.exports = router;
