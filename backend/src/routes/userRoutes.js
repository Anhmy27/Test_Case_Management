const express = require('express');
const { listUsers, createUserByAdmin } = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticate, authorize('admin'));
router.get('/', listUsers);
router.post('/', createUserByAdmin);

module.exports = router;
