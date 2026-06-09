const express = require('express');
const { listUsers, createUserByAdmin, updateUserByAdmin, deleteUserByAdmin } = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  userIdParamsSchema,
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
} = require('../validators/userSchemas');

const router = express.Router();

router.use(authenticate, authorize('admin'));
router.get('/', validateRequest({ querySchema: listUsersQuerySchema }), listUsers);
router.post('/', validateRequest({ bodySchema: createUserBodySchema }), createUserByAdmin);
router.put('/:id', validateRequest({ paramsSchema: userIdParamsSchema, bodySchema: updateUserBodySchema }), updateUserByAdmin);
router.delete('/:id', validateRequest({ paramsSchema: userIdParamsSchema }), deleteUserByAdmin);

module.exports = router;
