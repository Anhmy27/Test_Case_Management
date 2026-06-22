const {
  z,
  objectIdString,
  nonEmptyString,
  optionalTrimmedString,
  optionalPositiveIntFromQuery,
} = require('./commonSchemas');

const optionalObjectIdString = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value;
}, objectIdString.optional());

const getAssignableUsersQuerySchema = z.object({
  projectKeys: optionalTrimmedString(),
  projectKey: optionalTrimmedString(),
  username: optionalTrimmedString(),
  maxResults: optionalPositiveIntFromQuery,
}).passthrough();

const getLabelSuggestionsQuerySchema = z.object({
  query: optionalTrimmedString(),
}).passthrough();

const getVersionSuggestionsQuerySchema = z.object({
  projectId: objectIdString,
  query: optionalTrimmedString(),
  maxResults: optionalPositiveIntFromQuery,
  startAt: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, z.number().int().nonnegative().optional()),
}).passthrough();

const logBugBodySchema = z.object({
  projectId: objectIdString,
  runId: optionalObjectIdString,
  resultId: optionalObjectIdString,
  caseKey: optionalTrimmedString(),
  caseTitle: optionalTrimmedString(),
  summary: nonEmptyString(),
  description: nonEmptyString(),
  issueType: nonEmptyString(),
  priority: optionalTrimmedString(),
  assignee: optionalTrimmedString(),
  timetracking_originalestimate: optionalTrimmedString(),
  originalEstimate: optionalTrimmedString(),
  labels: z.union([z.string(), z.array(z.string())]).optional(),
  versions: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough();

const getLogBugsQuerySchema = z.object({
  projectId: objectIdString,
  search: optionalTrimmedString(),
  priority: optionalTrimmedString(),
  issueType: optionalTrimmedString(),
  page: optionalPositiveIntFromQuery,
  limit: optionalPositiveIntFromQuery,
}).passthrough();

const jiraProfileBodySchema = z.object({
  jiraUsername: optionalTrimmedString(),
  jiraPassword: optionalTrimmedString(),
}).passthrough();

module.exports = {
  getAssignableUsersQuerySchema,
  getLabelSuggestionsQuerySchema,
  getVersionSuggestionsQuerySchema,
  logBugBodySchema,
  getLogBugsQuerySchema,
  jiraProfileBodySchema,
};
