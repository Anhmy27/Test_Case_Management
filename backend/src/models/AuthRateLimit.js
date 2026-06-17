const mongoose = require('mongoose');

const authRateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    action: {
      type: String,
      enum: ['login', 'register'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['ip', 'email'],
      required: true,
    },
    clientIp: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    windowStartedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuthRateLimit', authRateLimitSchema);
