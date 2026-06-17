const { asyncHandler } = require('../utils/asyncHandler');
const { signAccessToken } = require('../middlewares/authMiddleware');
const { setAuthCookies, clearAuthCookies } = require('../utils/authCookies');
const { auditFromRequest, pickEntityAuditFields } = require('../utils/auditFromRequest');
const { getClientIp } = require('../utils/clientIp');
const { revokeUserSessions } = require('../utils/authTokens');
const {
  registerService,
  loginService,
  getMeService,
} = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const { user, userPayload } = await registerService(req.body || {}, {
    clientIp: getClientIp(req),
  });
  const token = signAccessToken(user);
  setAuthCookies(res, token);
  await auditFromRequest(req, {
    action: 'auth.register',
    resourceType: 'user',
    actor: userPayload,
    ...pickEntityAuditFields(userPayload, { labelKeys: ['email', 'name'] }),
    metadata: { role: userPayload.role },
  });
  res.status(201).json({ user: userPayload });
});

const login = asyncHandler(async (req, res) => {
  const { user, userPayload } = await loginService(req.body || {});
  const token = signAccessToken(user);
  setAuthCookies(res, token);
  await auditFromRequest(req, {
    action: 'auth.login',
    resourceType: 'user',
    actor: userPayload,
    ...pickEntityAuditFields(userPayload, { labelKeys: ['email', 'name'] }),
  });
  res.json({ user: userPayload });
});

const logout = asyncHandler(async (req, res) => {
  if (req.user?.id) {
    await revokeUserSessions(req.user.id);
  }
  await auditFromRequest(req, {
    action: 'auth.logout',
    resourceType: 'user',
    ...pickEntityAuditFields(req.user, { labelKeys: ['email', 'name'] }),
  });
  clearAuthCookies(res);
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  const user = await getMeService(req.user.id);
  if (!user) {
    res.json({ user: null });
    return;
  }

  res.json({ user });
});

module.exports = {
  register,
  login,
  logout,
  me,
};
