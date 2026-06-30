const mongoose = require('mongoose');
const {
  RECORDING_SESSION_STATUSES,
  buildRecordingSessionExpiresAt,
} = require('../config/recordingConfig');
const {
  recordedEventSchema,
  semanticActionSchema,
  recordedStepDraftSchema,
  intentBlockSchema,
} = require('./recordingSubSchemas');

const recordingSessionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    testCaseEntityId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: RECORDING_SESSION_STATUSES,
      default: 'starting',
      index: true,
    },
    events: {
      type: [recordedEventSchema],
      default: [],
    },
    semanticActions: {
      type: [semanticActionSchema],
      default: [],
    },
    draftSteps: {
      type: [recordedStepDraftSchema],
      default: [],
    },
    intentBlocks: {
      type: [intentBlockSchema],
      default: [],
    },
    eventCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    eventsExternalized: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    stoppedAt: {
      type: Date,
      default: null,
    },
    mergedAt: {
      type: Date,
      default: null,
    },
    mergedTestCaseEntityId: {
      type: String,
      default: '',
      trim: true,
    },
    mergedTestCaseVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestCase',
      default: null,
    },
    discardReason: {
      type: String,
      default: '',
      trim: true,
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

recordingSessionSchema.pre('validate', function setDefaultExpiry() {
  if (!this.expiresAt && this.status !== 'merged') {
    this.expiresAt = buildRecordingSessionExpiresAt();
  }
});

recordingSessionSchema.pre('save', function syncEventCount() {
  if (!this.eventsExternalized) {
    this.eventCount = Array.isArray(this.events) ? this.events.length : 0;
  }
  if (this.status === 'merged') {
    this.expiresAt = null;
  }
});

recordingSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
recordingSessionSchema.index({ project: 1, status: 1, createdAt: -1 });
recordingSessionSchema.index({ recordedBy: 1, createdAt: -1 });

module.exports = mongoose.model('RecordingSession', recordingSessionSchema);
