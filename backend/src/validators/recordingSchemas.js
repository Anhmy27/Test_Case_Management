const {
  z,
  objectIdString,
  nonEmptyString,
  optionalTrimmedString,
} = require('./commonSchemas');
const { RECORDED_EVENT_RAW_TYPES } = require('../config/recordingConfig');

const recordingSessionIdParamsSchema = z.object({
  sessionId: objectIdString,
});

const startRecordingSessionBodySchema = z.object({
  projectId: objectIdString,
  baseUrl: nonEmptyString().url('baseUrl must be a valid URL'),
  testCaseEntityId: optionalTrimmedString(),
});

const recordedEventInputSchema = z.object({
  eventId: optionalTrimmedString(),
  rawType: z.enum(RECORDED_EVENT_RAW_TYPES),
  occurredAt: z.union([z.string(), z.date()]).optional(),
  pageUrl: optionalTrimmedString(),
  payload: z.unknown().optional(),
});

const appendRecordingEventsBodySchema = z.object({
  events: z.array(recordedEventInputSchema).min(1, 'At least one event is required').max(100),
});

const discardRecordingSessionBodySchema = z.object({
  reason: optionalTrimmedString(),
}).optional();

module.exports = {
  recordingSessionIdParamsSchema,
  startRecordingSessionBodySchema,
  appendRecordingEventsBodySchema,
  discardRecordingSessionBodySchema,
};
