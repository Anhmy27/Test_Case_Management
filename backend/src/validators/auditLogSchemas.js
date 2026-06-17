const { z } = require('zod');
const { paginationQuerySchema } = require('./commonSchemas');

const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  action: z.string().trim().optional(),
  resourceType: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

module.exports = {
  listAuditLogsQuerySchema,
};
