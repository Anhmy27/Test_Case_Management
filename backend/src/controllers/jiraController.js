const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest } = require('../utils/auditFromRequest');
const {
  logBugService,
  getAssignableUsersService,
  getLabelSuggestionsService,
  getVersionSuggestionsService,
  getJiraProfileService,
  upsertJiraProfileService,
} = require('../services/jiraManagementService');

const logBug = asyncHandler(async (req, res) => {
  const result = await logBugService({
    ...req.body,
    user: req.user,
  });
  await auditFromRequest(req, {
    action: 'jira.log_bug',
    resourceType: 'jira_issue',
    resourceId: String(result?.issueKey || result?.issueId || ''),
    resourceLabel: String(result?.issueKey || req.body?.summary || ''),
    projectId: String(req.body?.projectId || ''),
    metadata: {
      runId: req.body?.runId,
      resultId: req.body?.resultId,
    },
  });
  res.status(201).json(result);
});

const getAssignableUsers = asyncHandler(async (req, res) => {
  const result = await getAssignableUsersService({
    ...req.query,
    user: req.user,
  });
  res.json(result);
});

const getLabelSuggestions = asyncHandler(async (req, res) => {
  const result = await getLabelSuggestionsService({
    ...req.query,
    user: req.user,
  });
  res.json(result);
});

const getVersionSuggestions = asyncHandler(async (req, res) => {
  const result = await getVersionSuggestionsService({
    ...req.query,
    user: req.user,
  });
  res.json(result);
});

const getJiraProfile = asyncHandler(async (req, res) => {
  const result = await getJiraProfileService(req.user);
  res.json(result);
});

const upsertJiraProfile = asyncHandler(async (req, res) => {
  const result = await upsertJiraProfileService(req.user, req.body || {});
  await auditFromRequest(req, {
    action: 'jira.profile_update',
    resourceType: 'jira_profile',
    resourceId: String(req.user?.id || ''),
    resourceLabel: String(req.user?.email || ''),
    metadata: { hasPassword: Boolean(req.body?.jiraPassword) },
  });
  res.json(result);
});

module.exports = {
  logBug,
  getAssignableUsers,
  getLabelSuggestions,
  getVersionSuggestions,
  getJiraProfile,
  upsertJiraProfile,
};
