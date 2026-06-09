const { z } = require('zod');

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const trimString = () => z.string().trim();

const nonEmptyString = () => z.string().trim().min(1, 'Required');

const optionalTrimmedString = () => z.union([z.string(), z.number(), z.boolean()])
  .transform((value) => String(value).trim())
  .optional();

const objectIdString = z
  .string()
  .trim()
  .regex(objectIdRegex, 'Invalid ObjectId');

const stringToOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const stringToOptionalBoolean = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'inactive'].includes(normalized)) return false;
  return value;
};

const optionalBooleanFromQuery = z.preprocess(stringToOptionalBoolean, z.boolean().optional());

const optionalIntFromQuery = z.preprocess(
  stringToOptionalNumber,
  z.number().int('Must be an integer').optional(),
);

const optionalPositiveIntFromQuery = z.preprocess(
  stringToOptionalNumber,
  z.number().int('Must be an integer').positive('Must be greater than 0').optional(),
);

const optionalDateLike = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return value;
  const normalized = String(value).trim();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}, z.date().optional());

const searchQuerySchema = z.object({
  search: optionalTrimmedString(),
}).passthrough();

const paginationQuerySchema = z.object({
  page: optionalPositiveIntFromQuery,
  limit: optionalPositiveIntFromQuery,
}).passthrough();

const includeDeletedQuerySchema = z.object({
  includeDeleted: z.preprocess((value) => {
    if (value === true || value === false) return value ? 'true' : 'false';
    if (value === undefined || value === null || value === '') return undefined;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === 'false') return normalized;
    return value;
  }, z.enum(['true', 'false']).optional()),
}).passthrough();

module.exports = {
  z,
  objectIdString,
  nonEmptyString,
  optionalTrimmedString,
  optionalBooleanFromQuery,
  optionalIntFromQuery,
  optionalPositiveIntFromQuery,
  optionalDateLike,
  searchQuerySchema,
  paginationQuerySchema,
  includeDeletedQuerySchema,
};
