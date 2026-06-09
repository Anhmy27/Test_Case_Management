const mongoose = require('mongoose');
const { applyVersioning } = require('../utils/versioning');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    pid: {
      type: String,
      default: '',
      trim: true,
    },
    jiraProjectKey: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    jiraProductKey: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for uniqueness are created by applyVersioning() to include `isLatest` scope.
// Removed explicit schema-level unique partial indexes to avoid duplicate index conflicts
// when versioning adds its own scoped indexes.

applyVersioning(projectSchema, {
  scopeIndexes: [
    { fields: { code: 1 } },
    { fields: { name: 1 } },
  ],
});

module.exports = mongoose.model('Project', projectSchema);
