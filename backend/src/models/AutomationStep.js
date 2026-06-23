const mongoose = require('mongoose');

const automationStepSchema = new mongoose.Schema(
  {
    stepId: { type: String, default: '', trim: true },
    stepName: { type: String, default: '', trim: true },
    order: { type: Number, required: true },
    action: {
      type: String,
      required: true,
      trim: true,
      enum: [
        'goto',
        'click',
        'type',
        'select',
        'wait',
        'waitFor',
        'assertText',
        'assertVisible',
        'assertUrl',
        'assertTitle',
        'assertHidden',
        'assertEnabled',
        'assertChecked',
        'hover',
        'press',
        'upload',
        'dragTo',
      ],
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
      enum: ['css', 'id', 'placeholder', 'text', 'label', 'testid', 'url'],
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
      min: 1,
    },
    waitUntil: {
      type: String,
      trim: true,
      enum: ['load', 'domcontentloaded'],
    },
  },
  { _id: false }
);

module.exports = automationStepSchema;