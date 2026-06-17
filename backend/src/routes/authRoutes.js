const express = require('express');
const { register, login, logout, me } = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { loginRateLimit, registerRateLimit } = require('../middlewares/authRateLimitMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const { registerBodySchema, loginBodySchema } = require('../validators/authSchemas');

const router = express.Router();

router.post('/register', registerRateLimit, validateRequest({ bodySchema: registerBodySchema }), register);
router.post('/login', loginRateLimit, validateRequest({ bodySchema: loginBodySchema }), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
