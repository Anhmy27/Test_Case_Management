const mongoose = require('mongoose');
const { recordedEventSchema } = require('./recordingSubSchemas');

const recordingEventSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecordingSession',
      required: true,
      index: true,
    },
    sequence: {
      type: Number,
      required: true,
      min: 0,
    },
    event: {
      type: recordedEventSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

recordingEventSchema.index({ session: 1, sequence: 1 }, { unique: true });

module.exports = mongoose.model('RecordingEvent', recordingEventSchema);
