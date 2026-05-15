const mongoose = require('mongoose');

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
    caseKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
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

testCaseSchema.index({ project: 1, group: 1, caseKey: 1 }, { unique: true });

module.exports = mongoose.model('TestCase', testCaseSchema);
