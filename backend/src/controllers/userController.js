const { asyncHandler } = require('../utils/asyncHandler');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const {
  listUsersService,
  createUserByAdminService,
  updateUserByAdminService,
  deleteUserByAdminService,
} = require('../services/userAdminService');

const listUsers = asyncHandler(async (req, res) => {
  const users = await listUsersService(req.query || {});
  res.json({ users });
});

const createUserByAdmin = asyncHandler(async (req, res) => {
  const user = await createUserByAdminService(req.body || {});
  await auditFromRequest(req, {
    action: 'user.create',
    resourceType: 'user',
    ...pickEntityAuditFields(user, { labelKeys: ['email', 'name'] }),
    metadata: { role: user.role, isActive: user.isActive },
  });
  res.status(201).json({ user });
});

const updateUserByAdmin = asyncHandler(async (req, res) => {
  const user = await updateUserByAdminService(req.params.id, req.body || {});
  await auditFromRequest(req, {
    action: 'user.update',
    resourceType: 'user',
    ...pickEntityAuditFields(user, { labelKeys: ['email', 'name'] }),
    metadata: { role: user.role, isActive: user.isActive },
  });
  res.json({ user });
});

const deleteUserByAdmin = asyncHandler(async (req, res) => {
  await deleteUserByAdminService(req.params.id, req.user.id);
  await auditFromRequest(req, {
    action: 'user.deactivate',
    resourceType: 'user',
    resourceId: req.params.id,
    metadata: { targetUserId: req.params.id },
  });
  res.json({ message: 'User deactivated' });
});

module.exports = {
  listUsers,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
};
