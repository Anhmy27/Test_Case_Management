const {
  z,
  objectIdString,
  nonEmptyString,
  optionalTrimmedString,
} = require('./commonSchemas');

const runIdParamsSchema = z.object({
  runId: objectIdString,
});

const runResultParamsSchema = z.object({
  runId: objectIdString,
  resultId: objectIdString,
});

const dryRunIdParamsSchema = z.object({
  dryRunId: nonEmptyString(),
});

const startTestRunBodySchema = z.object({
  testPlanId: objectIdString,
  name: nonEmptyString(),
  baseUrl: optionalTrimmedString(),
}).passthrough();

const retryFailedRunBodySchema = z.object({
  baseUrl: optionalTrimmedString(),
}).passthrough();

const updateTestRunBodySchema = z.object({
  name: nonEmptyString(),
}).passthrough();

const updateRunResultBodySchema = z.object({
  status: z.enum(['pass', 'fail', 'blocked', 'skip']),
  note: optionalTrimmedString(),
  notes: optionalTrimmedString(),
}).passthrough();

const applyAutomationResultsBodySchema = z.object({
  results: z.array(
    z.object({
      planItemId: objectIdString,
      status: z.enum(['pass', 'fail', 'blocked', 'skip']),
      note: optionalTrimmedString(),
      notes: optionalTrimmedString(),
    }).passthrough(),
  ).min(1, 'results must not be empty'),
}).passthrough();

const listTestRunsQuerySchema = z.object({
  projectId: objectIdString.optional(),
  versionId: objectIdString.optional(),
  status: z.enum(['running', 'completed']).optional(),
}).passthrough();

const exportTestRunQuerySchema = z.object({
  format: z.enum(['xlsx', 'csv']).optional(),
}).passthrough();

const dashboardQuerySchema = z.object({
  projectId: objectIdString.optional(),
  versionId: objectIdString.optional(),
}).passthrough();

const versionDashboardQuerySchema = z.object({
  projectId: objectIdString,
}).passthrough();

const testPlanStatsQuerySchema = z.object({
  versionId: objectIdString,
}).passthrough();

const dryRunAutomationBodySchema = z.object({
  testCaseId: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim() === '') return undefined;
      return value;
    },
    objectIdString.optional(),
  ),
  baseUrl: optionalTrimmedString(),
  automation: z.object({
    enabled: z.boolean().optional(),
    steps: z.array(z.object({
      action: optionalTrimmedString(),
      target: optionalTrimmedString(),
      value: optionalTrimmedString(),
    }).passthrough()).optional(),
  }).passthrough(),
}).passthrough();

module.exports = {
  runIdParamsSchema,
  runResultParamsSchema,
  dryRunIdParamsSchema,
  startTestRunBodySchema,
  retryFailedRunBodySchema,
  updateTestRunBodySchema,
  updateRunResultBodySchema,
  applyAutomationResultsBodySchema,
  listTestRunsQuerySchema,
  exportTestRunQuerySchema,
  dashboardQuerySchema,
  versionDashboardQuerySchema,
  testPlanStatsQuerySchema,
  dryRunAutomationBodySchema,
};
