const mongoose = require('mongoose');
const { applyVersioning } = require('../utils/versioning');
const automationStepSchema = require('./AutomationStep');

const stepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    action: { type: String, required: true, trim: true },
    expected: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const testCaseSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestCaseGroup',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    caseKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    steps: {
      type: [stepSchema],
      default: [],
    },
    automation: {
      enabled: {
        type: Boolean,
        default: false,
      },
      runner: {
        type: String,
        enum: ['playwright'],
        default: 'playwright',
      },
      baseUrl: {
        type: String,
        default: '',
        trim: true,
      },
      steps: {
        type: [automationStepSchema],
        default: [],
      },
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    severity: {
      type: String,
      enum: ['minor', 'major', 'critical'],
      default: 'major',
      index: true,
    },
    type: {
      type: String,
      enum: ['functional', 'api', 'ui', 'regression', 'security', 'other'],
      default: 'functional',
    },
    status: {
      type: String,
      enum: ['active', 'deprecated'],
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

applyVersioning(testCaseSchema, {
  scopeIndexes: [
    { fields: { project: 1, group: 1, key: 1 } },
    { fields: { project: 1, group: 1, name: 1 } },
  ],
});

module.exports = mongoose.model('TestCase', testCaseSchema);
