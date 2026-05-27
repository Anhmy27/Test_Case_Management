const mongoose = require('mongoose');

const issueTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    idjira: {
      type: String,
      required: true,
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

issueTypeSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);

issueTypeSchema.index(
  { idjira: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
);

module.exports = mongoose.model('IssueType', issueTypeSchema);
