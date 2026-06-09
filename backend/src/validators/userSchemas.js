const {
  z,
  objectIdString,
  optionalBooleanFromQuery,
  optionalTrimmedString,
} = require('./commonSchemas');

const userIdParamsSchema = z.object({
  id: objectIdString,
});

const listUsersQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).optional(),
  includeInactive: optionalBooleanFromQuery,
}).passthrough();

const createUserBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'employee']).optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
}).passthrough();

const updateUserBodySchema = z.object({
  name: optionalTrimmedString(),
  email: z.string().trim().email('Invalid email').optional(),
  password: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim() === '') return undefined;
      return value;
    },
    z.string().min(6, 'Password must be at least 6 characters').optional(),
  ),
  role: z.enum(['admin', 'employee']).optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
}).passthrough();

module.exports = {
  userIdParamsSchema,
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
};
