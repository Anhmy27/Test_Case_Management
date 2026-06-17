const AuditLog = require('../models/AuditLog');
const { buildSearchMatch, pickPagination } = require('../utils/versioning');

async function recordAuditLog({
  action,
  resourceType,
  resourceId = '',
  resourceLabel = '',
  projectId = '',
  userId = '',
  userName = '',
  userEmail = '',
  userRole = '',
  clientIp = '',
  metadata = null,
}) {
  return AuditLog.create({
    action: String(action || '').trim(),
    resourceType: String(resourceType || '').trim(),
    resourceId: String(resourceId || '').trim(),
    resourceLabel: String(resourceLabel || '').trim().slice(0, 200),
    projectId: String(projectId || '').trim(),
    userId: String(userId || '').trim(),
    userName: String(userName || '').trim(),
    userEmail: String(userEmail || '').trim().toLowerCase(),
    userRole: String(userRole || '').trim(),
    clientIp: String(clientIp || '').trim(),
    metadata: metadata && typeof metadata === 'object' ? metadata : null,
  });
}

async function listAuditLogsService(query = {}) {
  const { page, limit, skip } = pickPagination(query);
  const filters = [];

  if (query.action) {
    filters.push({ action: String(query.action).trim() });
  }

  if (query.resourceType) {
    filters.push({ resourceType: String(query.resourceType).trim() });
  }

  if (query.userId) {
    filters.push({ userId: String(query.userId).trim() });
  }

  if (query.projectId) {
    filters.push({ projectId: String(query.projectId).trim() });
  }

  if (query.search) {
    const searchMatch = buildSearchMatch(String(query.search), [
      'action',
      'resourceType',
      'resourceId',
      'resourceLabel',
      'userName',
      'userEmail',
    ]);
    if (Object.keys(searchMatch).length > 0) {
      filters.push(searchMatch);
    }
  }

  if (query.from || query.to) {
    const createdAt = {};
    if (query.from) {
      const fromDate = new Date(query.from);
      if (!Number.isNaN(fromDate.getTime())) {
        createdAt.$gte = fromDate;
      }
    }
    if (query.to) {
      const toDate = new Date(query.to);
      if (!Number.isNaN(toDate.getTime())) {
        createdAt.$lte = toDate;
      }
    }
    if (Object.keys(createdAt).length > 0) {
      filters.push({ createdAt });
    }
  }

  const match = filters.length === 0
    ? {}
    : filters.length === 1
      ? filters[0]
      : { $and: filters };

  const effectiveLimit = limit || 50;
  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(match),
    AuditLog.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(effectiveLimit)
      .lean(),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit: effectiveLimit,
      total,
      pages: Math.max(Math.ceil(total / effectiveLimit), 1),
    },
  };
}

module.exports = {
  listAuditLogsService,
  recordAuditLog,
};
