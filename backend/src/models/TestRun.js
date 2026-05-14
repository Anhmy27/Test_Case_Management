const mongoose = require('mongoose');

const runResultSchema = new mongoose.Schema(
  {
    planItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    testCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestCase',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    tester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['untested', 'pass', 'fail', 'blocked'],
      default: 'untested',
      index: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    executedAt: {
      type: Date,
    },
  },
  {
    _id: true,
  }
);

const testRunSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    version: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Version',
      required: true,
      index: true,
    },
    testPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestPlan',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['running', 'completed'],
      default: 'running',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    results: {
      type: [runResultSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TestRun', testRunSchema);
