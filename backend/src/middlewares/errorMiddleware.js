function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle MongoDB E11000 duplicate key errors
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    
    // Map field names to user-friendly messages
    const fieldMessages = {
      code: 'Project code',
      email: 'Email address',
      caseKey: 'Test case key',
    };
    
    const fieldName = fieldMessages[field] || field;
    
    // Check if it's a compound index error from the duplicate key value
    const indexInfo = err.keyValue;
    if (indexInfo) {
      if (indexInfo.project && indexInfo.name && !indexInfo.group) {
        message = `Name already exists in this project`;
      } else if (indexInfo.project && indexInfo.name && indexInfo.group) {
        message = `Key already exists in this group`;
      } else if (indexInfo.project && indexInfo.version && indexInfo.name) {
        message = `Test plan name already exists in this version`;
      } else {
        message = `${fieldName} already exists`;
      }
    } else {
      message = `${fieldName} already exists`;
    }
  }

  // Handle MongoDB validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors)
      .map((error) => error.message)
      .join(', ');
    message = `Validation failed: ${errors}`;
  }

  // Handle Multer file upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds 50MB limit';
    } else {
      message = err.message || 'Invalid upload file';
    }
  }

  res.status(statusCode).json({
    message,
    ...(err.conflict && { conflict: err.conflict }),
    ...(err.details && { details: err.details }),
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}

module.exports = { errorMiddleware };
