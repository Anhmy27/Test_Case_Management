const { asyncHandler } = require('../utils/asyncHandler');
const { signAccessToken } = require('../middlewares/authMiddleware');
const { setAuthCookies, clearAuthCookies } = require('../utils/authCookies');
const {
  registerService,
  loginService,
  getMeService,
} = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const { user, userPayload } = await registerService(req.body || {});
  const token = signAccessToken(user);
  setAuthCookies(res, token);
  res.status(201).json({ user: userPayload });
});

const login = asyncHandler(async (req, res) => {
  const { user, userPayload } = await loginService(req.body || {});
  const token = signAccessToken(user);
  setAuthCookies(res, token);
  res.json({ user: userPayload });
});

const logout = asyncHandler(async (req, res) => {
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
