const { asyncHandler } = require('../utils/asyncHandler');
const {
  logBugService,
  getAssignableUsersService,
} = require('../services/jiraManagementService');

const logBug = asyncHandler(async (req, res) => {
  const result = await logBugService(req.body || {});
  res.status(201).json(result);
});

const getAssignableUsers = asyncHandler(async (req, res) => {
  const result = await getAssignableUsersService(req.query || {});
  res.json(result);
});

module.exports = {
  logBug,
  getAssignableUsers,
};