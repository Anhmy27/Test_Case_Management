const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceId: {
      type: String,
      trim: true,
      default: '',
    },
    resourceLabel: {
      type: String,
      trim: true,
      default: '',
    },
    projectId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    userId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      default: '',
    },
    userEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    userRole: {
      type: String,
      trim: true,
      default: '',
    },
    clientIp: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
