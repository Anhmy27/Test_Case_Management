const { asyncHandler } = require('../utils/asyncHandler');
const { signAccessToken } = require('../middlewares/authMiddleware');
const {
  registerService,
  loginService,
  getMeService,
} = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const { user, userPayload } = await registerService(req.body || {});
  const token = signAccessToken(user);
  res.status(201).json({ token, user: userPayload });
});

const login = asyncHandler(async (req, res) => {
  const { user, userPayload } = await loginService(req.body || {});
  const token = signAccessToken(user);
  res.json({ token, user: userPayload });
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
  me,
};
