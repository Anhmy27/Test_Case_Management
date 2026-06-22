const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  logBug,
  getAssignableUsers,
  getLabelSuggestions,
  getVersionSuggestions,
  getJiraProfile,
  upsertJiraProfile,
  listLogBugs,
} = require('../controllers/jiraController');
const {
  getAssignableUsersQuerySchema,
  getLabelSuggestionsQuerySchema,
  jiraProfileBodySchema,
  getVersionSuggestionsQuerySchema,
  logBugBodySchema,
  getLogBugsQuerySchema,
} = require('../validators/jiraSchemas');

const router = express.Router();

router.use(authenticate);

router.get('/assignable-users', validateRequest({ querySchema: getAssignableUsersQuerySchema }), getAssignableUsers);
router.get('/label-suggestions', validateRequest({ querySchema: getLabelSuggestionsQuerySchema }), getLabelSuggestions);
router.get('/version-suggestions', validateRequest({ querySchema: getVersionSuggestionsQuerySchema }), getVersionSuggestions);
router.get('/profile', getJiraProfile);
router.put('/profile', validateRequest({ bodySchema: jiraProfileBodySchema }), upsertJiraProfile);
router.get('/log-bugs', validateRequest({ querySchema: getLogBugsQuerySchema }), listLogBugs);
router.post('/log-bug', validateRequest({ bodySchema: logBugBodySchema }), logBug);

module.exports = router;