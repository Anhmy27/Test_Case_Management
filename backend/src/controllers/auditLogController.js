const { asyncHandler } = require('../utils/asyncHandler');
const { listAuditLogsService } = require('../services/auditLogService');

const listAuditLogs = asyncHandler(async (req, res) => {
  const result = await listAuditLogsService(req.query || {});
  res.json(result);
});

module.exports = {
  listAuditLogs,
};
