const { httpError } = require('../utils/httpError');

const formatIssues = (issues = []) => issues.map((issue) => ({
  path: Array.isArray(issue.path) ? issue.path.join('.') : '',
  message: issue.message,
  code: issue.code,
}));

const validateRequest = ({
  paramsSchema,
  querySchema,
  bodySchema,
} = {}) => (req, res, next) => {
  try {
    if (paramsSchema) {
      const parsedParams = paramsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        throw httpError(400, 'Validation failed', {
          details: formatIssues(parsedParams.error.issues),
        });
      }
      req.params = parsedParams.data;
    }

    if (querySchema) {
      const parsedQuery = querySchema.safeParse(req.query || {});
      if (!parsedQuery.success) {
        throw httpError(400, 'Validation failed', {
          details: formatIssues(parsedQuery.error.issues),
        });
      }
      req.query = parsedQuery.data;
    }

    if (bodySchema) {
      const parsedBody = bodySchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        throw httpError(400, 'Validation failed', {
          details: formatIssues(parsedBody.error.issues),
        });
      }
      req.body = parsedBody.data;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateRequest,
};
