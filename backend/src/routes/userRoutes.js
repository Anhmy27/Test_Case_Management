const express = require('express');
const { listUsers, createUserByAdmin, updateUserByAdmin, deleteUserByAdmin } = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticate, authorize('admin'));
router.get('/', listUsers);
router.post('/', createUserByAdmin);
router.put('/:id', updateUserByAdmin);
router.delete('/:id', deleteUserByAdmin);

module.exports = router;
