const express = require('express');
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const { registerBodySchema, loginBodySchema } = require('../validators/authSchemas');

const router = express.Router();

router.post('/register', validateRequest({ bodySchema: registerBodySchema }), register);
router.post('/login', validateRequest({ bodySchema: loginBodySchema }), login);
router.get('/me', authenticate, me);

module.exports = router;
