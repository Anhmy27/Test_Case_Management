const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const {
  logBug,
  getAssignableUsers,
  getLabelSuggestions,
  getVersionSuggestions,
} = require('../controllers/jiraController');

const router = express.Router();

router.use(authenticate);

router.get('/assignable-users', getAssignableUsers);
router.get('/label-suggestions', getLabelSuggestions);
router.get('/version-suggestions', getVersionSuggestions);
router.post('/log-bug', logBug);

module.exports = router;