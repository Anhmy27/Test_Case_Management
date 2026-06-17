const express = require('express');
const { listAuditLogs } = require('../controllers/auditLogController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const { listAuditLogsQuerySchema } = require('../validators/auditLogSchemas');

const router = express.Router();

router.use(authenticate, authorize('admin'));
router.get('/', validateRequest({ querySchema: listAuditLogsQuerySchema }), listAuditLogs);

module.exports = router;
