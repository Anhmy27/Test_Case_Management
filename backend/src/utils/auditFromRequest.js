const { recordAuditLog } = require('../services/auditLogService');
const { getClientIp } = require('./clientIp');

function normalizeActor(user) {
  if (!user) {
    return {
      userId: '',
      userName: '',
      userEmail: '',
      userRole: '',
    };
  }

  return {
    userId: String(user.id || user._id || user.userId || ''),
    userName: String(user.name || user.userName || '').trim(),
    userEmail: String(user.email || user.userEmail || '').trim().toLowerCase(),
    userRole: String(user.role || user.userRole || '').trim(),
  };
}

async function auditFromRequest(req, {
  action,
  resourceType,
  resourceId = '',
  resourceLabel = '',
  projectId = '',
  metadata = null,
  actor = null,
}) {
  const resolvedActor = normalizeActor(actor || req.user);

  try {
    await recordAuditLog({
      action,
      resourceType,
      resourceId,
      resourceLabel,
      projectId,
      metadata,
      clientIp: getClientIp(req),
      ...resolvedActor,
    });
  } catch (error) {
    console.error('[auditLog] record failed:', error.message);
  }
}

function pickEntityAuditFields(entity, options = {}) {
  const idKeys = options.idKeys || ['entityId', '_id', 'id'];
  const labelKeys = options.labelKeys || ['name', 'title', 'caseKey', 'code', 'email'];
  const resourceId = idKeys.map((key) => entity?.[key]).find(Boolean) || '';
  const resourceLabel = labelKeys.map((key) => entity?.[key]).find(Boolean) || '';
  const projectRef = entity?.project;
  const projectId = typeof projectRef === 'object'
    ? String(projectRef?.entityId || projectRef?._id || '')
    : String(projectRef || options.projectId || '');

  return {
    resourceId: String(resourceId),
    resourceLabel: String(resourceLabel),
    projectId,
  };
}

module.exports = {
  auditFromRequest,
  normalizeActor,
  pickEntityAuditFields,
};
