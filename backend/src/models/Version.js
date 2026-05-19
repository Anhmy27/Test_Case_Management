const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    releaseDate: {
      type: Date,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
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

versionSchema.index({ project: 1, name: 1 }, {
  unique: true,
  partialFilterExpression: { deletedAt: null },
});

module.exports = mongoose.model('Version', versionSchema);
