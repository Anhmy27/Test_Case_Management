const {
  z,
  objectIdString,
  optionalTrimmedString,
  nonEmptyString,
  includeDeletedQuerySchema,
  searchQuerySchema,
  paginationQuerySchema,
} = require('./commonSchemas');

const testCaseIdParamsSchema = z.object({
  testCaseId: objectIdString,
});

const manualStepSchema = z.object({
  order: z.number().int().positive().optional(),
  action: nonEmptyString(),
  expected: optionalTrimmedString(),
}).passthrough();

const automationStepSchema = z.object({
  stepId: optionalTrimmedString(),
  stepName: optionalTrimmedString(),
  order: z.number().int().positive().optional(),
  action: optionalTrimmedString(),
  targetType: optionalTrimmedString(),
  target: optionalTrimmedString(),
  value: optionalTrimmedString(),
  expected: optionalTrimmedString(),
  timeoutMs: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, z.number().int().positive().optional()),
}).passthrough();

const automationConfigSchema = z.object({
  enabled: z.boolean().optional(),
  runner: optionalTrimmedString(),
  webId: optionalTrimmedString(),
  baseUrl: optionalTrimmedString(),
  userKey: optionalTrimmedString(),
  timeoutMs: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, z.number().int().positive().optional()),
  steps: z.array(automationStepSchema).optional(),
}).passthrough();

const createTestCaseBodySchema = z.object({
  projectId: objectIdString,
  groupId: objectIdString,
  caseKey: nonEmptyString(),
  key: optionalTrimmedString(),
  title: nonEmptyString(),
  name: optionalTrimmedString(),
  description: optionalTrimmedString(),
  expected: optionalTrimmedString(),
  steps: z.array(manualStepSchema).optional(),
  automation: automationConfigSchema.optional(),
  // Accept legacy 'critical' and normalize to 'highest' in service layer.
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']).optional(),
  severity: z.enum(['minor', 'major', 'critical']).optional(),
  type: z.enum(['functional', 'api', 'ui', 'regression', 'security', 'other']).optional(),
}).passthrough();

const updateTestCaseBodySchema = z.object({
  projectId: objectIdString.optional(),
  groupId: objectIdString.optional(),
  caseKey: optionalTrimmedString(),
  key: optionalTrimmedString(),
  title: optionalTrimmedString(),
  name: optionalTrimmedString(),
  description: optionalTrimmedString(),
  expected: optionalTrimmedString(),
  steps: z.array(manualStepSchema).optional(),
  automation: automationConfigSchema.optional(),
  // Accept legacy 'critical' and normalize to 'highest' in service layer.
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest', 'critical']).optional(),
  severity: z.enum(['minor', 'major', 'critical']).optional(),
  type: z.enum(['functional', 'api', 'ui', 'regression', 'security', 'other']).optional(),
  status: z.enum(['active', 'deprecated']).optional(),
}).passthrough();

const listTestCasesQuerySchema = includeDeletedQuerySchema
  .merge(searchQuerySchema)
  .merge(paginationQuerySchema)
  .merge(z.object({
    projectId: objectIdString.optional(),
    groupId: objectIdString.optional(),
  }))
  .passthrough();

const listTestCaseDetailsQuerySchema = searchQuerySchema
  .merge(z.object({
    projectId: objectIdString.optional(),
    groupId: objectIdString.optional(),
  }))
  .passthrough();

const importTestCasesBodySchema = z.object({
  projectId: objectIdString,
  strict: z.union([z.boolean(), z.string()]).optional(),
}).passthrough();

module.exports = {
  testCaseIdParamsSchema,
  createTestCaseBodySchema,
  updateTestCaseBodySchema,
  listTestCasesQuerySchema,
  listTestCaseDetailsQuerySchema,
  importTestCasesBodySchema,
};
