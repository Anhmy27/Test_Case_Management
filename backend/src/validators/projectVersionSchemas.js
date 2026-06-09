const {
  z,
  objectIdString,
  nonEmptyString,
  optionalTrimmedString,
  includeDeletedQuerySchema,
  searchQuerySchema,
} = require('./commonSchemas');

const projectIdParamsSchema = z.object({
  projectId: objectIdString,
});

const versionIdParamsSchema = z.object({
  versionId: objectIdString,
});

const listProjectsQuerySchema = includeDeletedQuerySchema.merge(searchQuerySchema);

const createProjectBodySchema = z.object({
  name: nonEmptyString(),
  code: nonEmptyString(),
  description: optionalTrimmedString(),
  pid: optionalTrimmedString(),
  jiraProjectKey: optionalTrimmedString(),
  jiraProductKey: optionalTrimmedString(),
}).passthrough();

const updateProjectBodySchema = z.object({
  name: optionalTrimmedString(),
  code: optionalTrimmedString(),
  description: optionalTrimmedString(),
  pid: optionalTrimmedString(),
  jiraProjectKey: optionalTrimmedString(),
  jiraProductKey: optionalTrimmedString(),
  status: z.enum(['active', 'archived']).optional(),
}).passthrough();

const listVersionsQuerySchema = includeDeletedQuerySchema
  .merge(searchQuerySchema)
  .merge(z.object({
    projectId: objectIdString.optional(),
  }))
  .passthrough();

const createVersionBodySchema = z.object({
  projectId: objectIdString,
  name: nonEmptyString(),
  releaseDate: z.union([z.string(), z.date()]).optional(),
  notes: optionalTrimmedString(),
}).passthrough();

const updateVersionBodySchema = z.object({
  name: optionalTrimmedString(),
  releaseDate: z.union([z.string(), z.date(), z.null()]).optional(),
  notes: optionalTrimmedString(),
}).passthrough();

module.exports = {
  projectIdParamsSchema,
  versionIdParamsSchema,
  listProjectsQuerySchema,
  createProjectBodySchema,
  updateProjectBodySchema,
  listVersionsQuerySchema,
  createVersionBodySchema,
  updateVersionBodySchema,
};
