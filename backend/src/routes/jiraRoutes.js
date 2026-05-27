const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { logBug, getAssignableUsers } = require('../controllers/jiraController');

const router = express.Router();

// public route: frontend can search Jira assignable users without app auth
router.get('/assignable-users', getAssignableUsers);

router.use(authenticate);

router.post('/log-bug', logBug);

module.exports = router;