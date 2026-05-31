function httpError(statusCode, message, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details && typeof details === 'object') {
    Object.assign(error, details);
  }
  return error;
}

module.exports = { httpError };
