const User = require('../models/User');

function readTokenVersion(user) {
  return Number(user?.tokenVersion || 0);
}

async function revokeUserSessions(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' },
  ).lean();

  return readTokenVersion(user);
}

module.exports = {
  readTokenVersion,
  revokeUserSessions,
};
