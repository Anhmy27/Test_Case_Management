const mongoose = require('mongoose');
const {
  RECORDED_EVENT_RAW_TYPES,
  LOCATOR_STRATEGIES,
  DRAFT_REVIEW_STATUSES,
} = require('../config/recordingConfig');

const locatorCandidateSchema = new mongoose.Schema(
  {
    strategy: {
      type: String,
      required: true,
      trim: true,
      enum: LOCATOR_STRATEGIES,
    },
    value: {
      type: String,
      default: '',
      trim: true,
    },
    roleName: {
      type: String,
      default: '',
      trim: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    uniqueOnPage: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const recordedEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    sequence: {
      type: Number,
      required: true,
      min: 0,
    },
    rawType: {
      type: String,
      required: true,
      trim: true,
      enum: RECORDED_EVENT_RAW_TYPES,
    },
    occurredAt: {
      type: Date,
      required: true,
    },
    pageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false },
);

const semanticActionSchema = new mongoose.Schema(
  {
    semanticId: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    sourceEventIds: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const recordedStepDraftSchema = new mongoose.Schema(
  {
    draftStepId: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    inferredAction: {
      type: String,
      default: '',
      trim: true,
    },
    targetType: {
      type: String,
      default: '',
      trim: true,
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
    locatorCandidates: {
      type: [locatorCandidateSchema],
      default: [],
    },
    chosenLocatorIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewStatus: {
      type: String,
      enum: DRAFT_REVIEW_STATUSES,
      default: 'pending',
    },
    screenshotKey: {
      type: String,
      default: '',
      trim: true,
    },
    autoWaitSuggestion: {
      type: String,
      default: '',
      trim: true,
    },
    sourceSemanticId: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const intentBlockSchema = new mongoose.Schema(
  {
    blockId: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    draftStepIds: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

module.exports = {
  locatorCandidateSchema,
  recordedEventSchema,
  semanticActionSchema,
  recordedStepDraftSchema,
  intentBlockSchema,
};
