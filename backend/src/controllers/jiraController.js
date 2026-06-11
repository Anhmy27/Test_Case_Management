const { asyncHandler } = require('../utils/asyncHandler');
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