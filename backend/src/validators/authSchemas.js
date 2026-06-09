const { z, nonEmptyString } = require('./commonSchemas');

const registerBodySchema = z.object({
  name: nonEmptyString(),
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).passthrough();

const loginBodySchema = z.object({
  email: z.string().trim().email('Invalid email'),
  password: nonEmptyString(),
}).passthrough();

module.exports = {
  registerBodySchema,
  loginBodySchema,
};
