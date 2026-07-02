const mongoose = require('mongoose');

const logBugSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    testRun: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestRun',
      default: null,
      index: true,
    },
    runResult: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    issueKeyJira: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    issueType: {
      type: String,
      default: '',
      trim: true,
    },
    priority: {
      type: String,
      default: '',
      trim: true,
    },
    assignee: {
      type: String,
      default: '',
      trim: true,
    },
    labels: {
      type: String,
      default: '',
      trim: true,
    },
    versions: {
      type: [String],
      default: [],
    },
    caseKey: {
      type: String,
      default: '',
      trim: true,
    },
    caseTitle: {
      type: String,
      default: '',
      trim: true,
    },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

logBugSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('LogBug', logBugSchema);
