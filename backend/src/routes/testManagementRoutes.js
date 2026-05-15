const express = require('express');
const {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
  createVersion,
  listVersions,
  createTestCaseGroup,
  listTestCaseGroups,
  createTestCase,
  listTestCases,
  updateTestCase,
  deleteTestCase,
  createTestPlan,
  listTestPlans,
  assignTestPlanItems,
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
} = require('../controllers/testManagementController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();
// Allow automation systems to POST results using a secret header without normal auth
router.post('/test-runs/:runId/automation-results', require('../controllers/testManagementController').applyAutomationResults);

router.use(authenticate);

router.get('/projects', listProjects);
router.post('/projects', authorize('admin'), createProject);
router.put('/projects/:projectId', authorize('admin'), updateProject);
router.delete('/projects/:projectId', authorize('admin'), deleteProject);

router.get('/versions', listVersions);
router.post('/versions', authorize('admin'), createVersion);

router.get('/test-case-groups', listTestCaseGroups);
router.post('/test-case-groups', authorize('admin'), createTestCaseGroup);

router.get('/test-cases', listTestCases);
router.post('/test-cases', authorize('admin'), createTestCase);
router.put('/test-cases/:testCaseId', authorize('admin'), updateTestCase);
router.delete('/test-cases/:testCaseId', authorize('admin'), deleteTestCase);

router.get('/test-plans', listTestPlans);
router.post('/test-plans', authorize('admin'), createTestPlan);
router.put('/test-plans/:testPlanId/assign', authorize('admin'), assignTestPlanItems);

router.get('/test-runs', listTestRuns);
router.post('/test-runs', authorize('admin', 'employee'), startTestRun);
router.patch('/test-runs/:runId/end', authorize('admin', 'employee'), endTestRun);

router.get('/test-runs/:runId/my-items', getMyRunItems);
router.patch('/test-runs/:runId/results/:resultId', updateRunResult);
router.post('/test-runs/:runId/automation-results', authorize('admin', 'employee'), applyAutomationResults);

router.get('/dashboard', getDashboard);

// Dashboard routes
router.get('/dashboard/projects', getProjectDashboard);
router.get('/dashboard/versions', getVersionDashboard);
router.get('/dashboard/test-plans', getTestPlanStats);
router.get('/dashboard/test-plans/:testPlanId', getTestPlanDetail);

module.exports = router;
