const { asyncHandler } = require('../utils/asyncHandler');
const {
  createTestPlanService,
  listTestPlansService,
  getTestPlanService,
  getTestPlanVersionsService,
  assignTestPlanItemsService,
  updateTestPlanService,
  deleteTestPlanService,
  restoreTestPlanService,
} = require('../services/testManagementService');

const createTestPlan = asyncHandler(async (req, res) => {
  const testPlan = await createTestPlanService({
    ...req.body,
    createdBy: req.user.id,
  });
  res.status(201).json({ testPlan });
});

const listTestPlans = asyncHandler(async (req, res) => {
  const result = await listTestPlansService(req.query || {}, req.user);
  res.json(result);
});

const getTestPlan = asyncHandler(async (req, res) => {
  const testPlan = await getTestPlanService(req.params.testPlanId);
  res.json({ testPlan: testPlan || null });
});

const getTestPlanVersions = asyncHandler(async (req, res) => {
  const versions = await getTestPlanVersionsService(req.params.testPlanId);
  res.json({ versions });
});

const assignTestPlanItems = asyncHandler(async (req, res) => {
  const testPlan = await assignTestPlanItemsService(
    req.params.testPlanId,
    req.body || {},
    req.user.id,
  );
  res.json({ testPlan });
});

const updateTestPlan = asyncHandler(async (req, res) => {
  const testPlan = await updateTestPlanService(
    req.params.testPlanId,
    req.body || {},
    req.user.id,
  );
  res.json({ testPlan });
});

const deleteTestPlan = asyncHandler(async (req, res) => {
  await deleteTestPlanService(req.params.testPlanId);
  res.status(204).send();
});

const restoreTestPlan = asyncHandler(async (req, res) => {
  const testPlan = await restoreTestPlanService(req.params.testPlanId);
  res.json({ testPlan });
});

module.exports = {
  createTestPlan,
  listTestPlans,
  getTestPlan,
  getTestPlanVersions,
  assignTestPlanItems,
  updateTestPlan,
  deleteTestPlan,
  restoreTestPlan,
};
