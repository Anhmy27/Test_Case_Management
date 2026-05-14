const express = require('express');
const {
  createProject,
  listProjects,
  createVersion,
  listVersions,
  createTestCaseGroup,
  listTestCaseGroups,
  createTestCase,
  listTestCases,
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

router.use(authenticate);

router.get('/projects', listProjects);
router.post('/projects', authorize('admin'), createProject);

router.get('/versions', listVersions);
router.post('/versions', authorize('admin'), createVersion);

router.get('/test-case-groups', listTestCaseGroups);
router.post('/test-case-groups', authorize('admin'), createTestCaseGroup);

router.get('/test-cases', listTestCases);
router.post('/test-cases', authorize('admin'), createTestCase);

router.get('/test-plans', listTestPlans);
router.post('/test-plans', authorize('admin'), createTestPlan);
router.put('/test-plans/:testPlanId/assign', authorize('admin'), assignTestPlanItems);

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
