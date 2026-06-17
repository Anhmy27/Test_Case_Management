const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const {
  createTestPlanService,
  listTestPlansService,
  getTestPlanService,
  getTestPlanVersionsService,
  assignTestPlanItemsService,
  updateTestPlanService,
  deleteTestPlanService,
  restoreTestPlanService,
} = require('../services/testPlanServices');

const createTestPlan = asyncHandler(async (req, res) => {
  const testPlan = await createTestPlanService({
    ...req.body,
    createdBy: req.user.id,
  });
  await auditFromRequest(req, {
    action: 'test_plan.create',
    resourceType: 'test_plan',
    ...pickEntityAuditFields(testPlan),
    projectId: String(req.body?.projectId || testPlan?.project || ''),
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
  await auditFromRequest(req, {
    action: 'test_plan.assign',
    resourceType: 'test_plan',
    ...pickEntityAuditFields(testPlan),
    metadata: { itemCount: Array.isArray(testPlan?.items) ? testPlan.items.length : undefined },
  });
  res.json({ testPlan });
});

const updateTestPlan = asyncHandler(async (req, res) => {
  const testPlan = await updateTestPlanService(
    req.params.testPlanId,
    req.body || {},
    req.user.id,
  );
  await auditFromRequest(req, {
    action: 'test_plan.update',
    resourceType: 'test_plan',
    ...pickEntityAuditFields(testPlan),
  });
  res.json({ testPlan });
});

const deleteTestPlan = asyncHandler(async (req, res) => {
  await deleteTestPlanService(req.params.testPlanId);
  await auditFromRequest(req, {
    action: 'test_plan.delete',
    resourceType: 'test_plan',
    resourceId: req.params.testPlanId,
  });
  res.status(204).send();
});

const restoreTestPlan = asyncHandler(async (req, res) => {
  const testPlan = await restoreTestPlanService(req.params.testPlanId);
  await auditFromRequest(req, {
    action: 'test_plan.restore',
    resourceType: 'test_plan',
    ...pickEntityAuditFields(testPlan),
  });
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
