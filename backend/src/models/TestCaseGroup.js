const mongoose = require('mongoose');
const { applyVersioning } = require('../utils/versioning');

const testCaseGroupSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
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
    description: {
      type: String,
      default: '',
      trim: true,
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

applyVersioning(testCaseGroupSchema, {
  scopeIndexes: [
    { fields: { project: 1, key: 1 } },
    { fields: { project: 1, name: 1 } },
  ],
});

module.exports = mongoose.model('TestCaseGroup', testCaseGroupSchema);