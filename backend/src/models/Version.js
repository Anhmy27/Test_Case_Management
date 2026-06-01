const mongoose = require('mongoose');
const { applyVersioning } = require('../utils/versioning');

const versionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    projectVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    idjira: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    releaseDate: {
      type: Date,
    },
    notes: {
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

applyVersioning(versionSchema, {
  scopeIndexes: [
    { fields: { project: 1, name: 1 } },
  ],
});

module.exports = mongoose.model('Version', versionSchema);
