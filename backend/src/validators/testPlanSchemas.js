const {
  z,
  objectIdString,
  optionalTrimmedString,
  nonEmptyString,
  includeDeletedQuerySchema,
  searchQuerySchema,
  paginationQuerySchema,
} = require('./commonSchemas');

const testPlanIdParamsSchema = z.object({
  testPlanId: objectIdString,
});

const createTestPlanBodySchema = z.object({
  name: nonEmptyString(),
  key: optionalTrimmedString(),
  description: optionalTrimmedString(),
  projectId: objectIdString,
  versionId: objectIdString,
  caseIds: z.array(objectIdString).min(1, 'caseIds must not be empty'),
  executionMode: z.enum(['manual', 'automation']).optional(),
  ownerId: objectIdString.optional(),
  assigneeIds: z.array(objectIdString).optional(),
}).passthrough();

const updateTestPlanBodySchema = z.object({
  name: optionalTrimmedString(),
  key: optionalTrimmedString(),
  description: optionalTrimmedString(),
  projectId: objectIdString.optional(),
  versionId: objectIdString.optional(),
  caseIds: z.array(objectIdString).optional(),
  executionMode: z.enum(['manual', 'automation']).optional(),
  ownerId: objectIdString.optional(),
  assigneeIds: z.array(objectIdString).optional(),
}).passthrough();

const assignTestPlanItemsBodySchema = z.object({
  ownerId: objectIdString.optional(),
  assigneeIds: z.array(objectIdString).min(1, 'assigneeIds must not be empty'),
}).passthrough();

const listTestPlansQuerySchema = includeDeletedQuerySchema
  .merge(searchQuerySchema)
  .merge(paginationQuerySchema)
  .merge(z.object({
    projectId: objectIdString.optional(),
    versionId: objectIdString.optional(),
  }))
  .passthrough();

module.exports = {
  testPlanIdParamsSchema,
  createTestPlanBodySchema,
  updateTestPlanBodySchema,
  assignTestPlanItemsBodySchema,
  listTestPlansQuerySchema,
};
