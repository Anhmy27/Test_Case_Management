const mongoose = require('mongoose');

const jiraAccountSchema = new mongoose.Schema(
  {
    profileKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    profileType: {
      type: String,
      enum: ['service', 'user'],
      default: 'user',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    jiraUsername: {
      type: String,
      default: '',
      trim: true,
    },
    jiraPasswordEncrypted: {
      type: String,
      default: '',
    },
    jiraCookieHeaderEncrypted: {
      type: String,
      default: '',
    },
    sessionExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

jiraAccountSchema.index({ profileType: 1, userId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('JiraAccount', jiraAccountSchema);
