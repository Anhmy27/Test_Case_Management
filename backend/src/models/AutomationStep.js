const mongoose = require('mongoose');

const automationStepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    action: {
      type: String,
      required: true,
      trim: true,
      enum: ['goto', 'click', 'type', 'select', 'waitFor', 'assertText', 'assertVisible'],
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
      enum: ['css', 'text', 'label', 'testid', 'url'],
      default: 'css',
    },
    target: {
      type: String,
      default: '',
      trim: true,
    },
    value: {
      type: String,
      default: '',
      trim: true,
    },
    expected: {
      type: String,
      default: '',
      trim: true,
    },
    timeoutMs: {
      type: Number,
      default: 15000,
      min: 0,
    },
  },
  { _id: false }
);

module.exports = automationStepSchema;