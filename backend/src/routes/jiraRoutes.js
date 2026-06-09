const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  logBug,
  getAssignableUsers,
  getLabelSuggestions,
  getVersionSuggestions,
} = require('../controllers/jiraController');
const {
  getAssignableUsersQuerySchema,
  getLabelSuggestionsQuerySchema,
  getVersionSuggestionsQuerySchema,
  logBugBodySchema,
} = require('../validators/jiraSchemas');

const router = express.Router();

router.use(authenticate);

router.get('/assignable-users', validateRequest({ querySchema: getAssignableUsersQuerySchema }), getAssignableUsers);
router.get('/label-suggestions', validateRequest({ querySchema: getLabelSuggestionsQuerySchema }), getLabelSuggestions);
router.get('/version-suggestions', validateRequest({ querySchema: getVersionSuggestionsQuerySchema }), getVersionSuggestions);
router.post('/log-bug', validateRequest({ bodySchema: logBugBodySchema }), logBug);

module.exports = router;