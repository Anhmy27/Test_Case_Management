const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { logBug, getAssignableUsers } = require('../controllers/jiraController');

const router = express.Router();

router.use(authenticate);

router.get('/assignable-users', getAssignableUsers);
router.post('/log-bug', logBug);

module.exports = router;