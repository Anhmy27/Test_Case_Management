const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { logBug } = require('../controllers/jiraController');

const router = express.Router();

router.use(authenticate);

router.post('/log-bug', logBug);

module.exports = router;