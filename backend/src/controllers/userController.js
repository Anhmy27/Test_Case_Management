const { asyncHandler } = require('../utils/asyncHandler');
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
  res.status(201).json({ user });
});

const updateUserByAdmin = asyncHandler(async (req, res) => {
  const user = await updateUserByAdminService(req.params.id, req.body || {});
  res.json({ user });
});

const deleteUserByAdmin = asyncHandler(async (req, res) => {
  await deleteUserByAdminService(req.params.id, req.user.id);
  res.json({ message: 'User deactivated' });
});

module.exports = {
  listUsers,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
};
