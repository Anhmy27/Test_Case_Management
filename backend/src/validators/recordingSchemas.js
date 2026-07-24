const {
  z,
  objectIdString,
  nonEmptyString,
  optionalTrimmedString,
} = require('./commonSchemas');
const { DRAFT_REVIEW_STATUSES, RECORDED_EVENT_RAW_TYPES } = require('../config/recordingConfig');
const automationStepSchema = require('../models/AutomationStep');

// Manual draft step insert must accept the same action/targetType vocabulary as
// TestCase.automation.steps (single source of truth: the Mongoose enum below).
const MANUAL_DRAFT_STEP_ACTIONS = automationStepSchema.path('action').enumValues;
const MANUAL_DRAFT_STEP_TARGET_TYPES = automationStepSchema.path('targetType').enumValues;

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
  screenshotBase64: optionalTrimmedString(),
  domHtml: optionalTrimmedString(),
});

const appendRecordingEventsBodySchema = z.object({
  events: z.array(recordedEventInputSchema).min(1, 'At least one event is required').max(100),
});

const discardRecordingSessionBodySchema = z.object({
  reason: optionalTrimmedString(),
}).optional();

const mergeRecordingSessionBodySchema = z.object({
  testCaseId: objectIdString.optional(),
}).optional();

const previewRecordingSessionBodySchema = z.object({
  baseUrl: optionalTrimmedString(),
  webId: optionalTrimmedString(),
  userKey: optionalTrimmedString(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
}).optional();

const draftStepPatchSchema = z.object({
  draftStepId: nonEmptyString(),
  value: z.string().optional(),
  expected: z.string().optional(),
  chosenLocatorIndex: z.number().int().min(0).optional(),
  reviewStatus: z.enum(DRAFT_REVIEW_STATUSES).optional(),
}).superRefine((patch, ctx) => {
  const hasField = patch.value !== undefined
    || patch.expected !== undefined
    || patch.chosenLocatorIndex !== undefined
    || patch.reviewStatus !== undefined;

  if (!hasField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one patch field is required per draft step',
      path: ['draftStepId'],
    });
  }
});

const patchRecordingDraftBodySchema = z.object({
  draftSteps: z
    .array(draftStepPatchSchema)
    .min(1, 'At least one draft step patch is required')
    .max(200),
});

/** Chèn 1 bước nháp thủ công (bất kỳ action nào) trước khi merge. */
const insertDraftStepBodySchema = z.object({
  insertAfterDraftStepId: optionalTrimmedString(),
  inferredAction: z.enum(MANUAL_DRAFT_STEP_ACTIONS),
  targetType: z.enum(MANUAL_DRAFT_STEP_TARGET_TYPES).optional(),
  target: z.string().optional(),
  value: z.string().optional(),
  expected: z.string().optional(),
});

module.exports = {
  recordingSessionIdParamsSchema,
  startRecordingSessionBodySchema,
  appendRecordingEventsBodySchema,
  discardRecordingSessionBodySchema,
  mergeRecordingSessionBodySchema,
  previewRecordingSessionBodySchema,
  patchRecordingDraftBodySchema,
  insertDraftStepBodySchema,
};
