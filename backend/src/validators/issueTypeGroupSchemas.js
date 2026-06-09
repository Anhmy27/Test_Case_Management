const {
  z,
  objectIdString,
  nonEmptyString,
  optionalTrimmedString,
  includeDeletedQuerySchema,
  searchQuerySchema,
  paginationQuerySchema,
} = require('./commonSchemas');

const issueTypeIdParamsSchema = z.object({
  issueTypeId: objectIdString,
});

const groupIdParamsSchema = z.object({
  groupId: objectIdString,
});

const listIssueTypesQuerySchema = includeDeletedQuerySchema.merge(searchQuerySchema);

const createIssueTypeBodySchema = z.object({
  name: nonEmptyString(),
  idjira: nonEmptyString(),
}).passthrough();

const updateIssueTypeBodySchema = z.object({
  name: optionalTrimmedString(),
  idjira: optionalTrimmedString(),
}).passthrough();

const listTestCaseGroupsQuerySchema = includeDeletedQuerySchema
  .merge(searchQuerySchema)
  .merge(paginationQuerySchema)
  .merge(z.object({
    projectId: objectIdString.optional(),
  }))
  .passthrough();

const createTestCaseGroupBodySchema = z.object({
  projectId: objectIdString,
  name: nonEmptyString(),
  key: optionalTrimmedString(),
  description: optionalTrimmedString(),
}).passthrough();

const updateTestCaseGroupBodySchema = z.object({
  projectId: objectIdString.optional(),
  name: optionalTrimmedString(),
  key: optionalTrimmedString(),
  description: optionalTrimmedString(),
}).passthrough();

module.exports = {
  issueTypeIdParamsSchema,
  groupIdParamsSchema,
  listIssueTypesQuerySchema,
  createIssueTypeBodySchema,
  updateIssueTypeBodySchema,
  listTestCaseGroupsQuerySchema,
  createTestCaseGroupBodySchema,
  updateTestCaseGroupBodySchema,
};
