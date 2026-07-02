const { httpError } = require('../../utils/httpError');
const {
  RECORDING_EVENT_ARTIFACT_LIMITS,
} = require('../../config/recordingConfig');
const {
  buildRecordingDomSnapshotKey,
  buildRecordingStepScreenshotKey,
} = require('./recordingArtifactService');

const DATA_URL_BASE64_RE = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i;

const decodeBase64Payload = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return { buffer: null, extension: 'png' };
  }

  const dataUrlMatch = raw.match(DATA_URL_BASE64_RE);
  if (dataUrlMatch) {
    const extension = dataUrlMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : dataUrlMatch[1].toLowerCase();
    return {
      buffer: Buffer.from(dataUrlMatch[2], 'base64'),
      extension,
    };
  }

  return {
    buffer: Buffer.from(raw, 'base64'),
    extension: 'png',
  };
};

const stripTransientArtifactFields = (payload = {}) => {
  const next = { ...(payload || {}) };
  delete next.screenshotBase64;
  delete next.domHtml;
  return next;
};

/**
 * Persist optional screenshot/DOM from an incoming event payload to recording artifacts.
 * @param {{ sessionId: string, event: object, artifactService: object }} input
 */
const persistIncomingEventArtifacts = ({ sessionId, event, artifactService }) => {
  const payload = stripTransientArtifactFields(event.payload);
  const incomingPayload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const eventId = String(event.eventId || '').trim();

  const screenshotBase64 = String(
    event.screenshotBase64 || incomingPayload.screenshotBase64 || '',
  ).trim();
  if (screenshotBase64) {
    if (!eventId) {
      throw httpError(400, 'eventId is required when uploading a recording screenshot');
    }
    const { buffer, extension } = decodeBase64Payload(screenshotBase64);
    if (!buffer || !buffer.length) {
      throw httpError(400, 'screenshotBase64 is empty or invalid');
    }
    if (buffer.length > RECORDING_EVENT_ARTIFACT_LIMITS.maxScreenshotBytes) {
      throw httpError(
        413,
        `Recording screenshot exceeds ${RECORDING_EVENT_ARTIFACT_LIMITS.maxScreenshotBytes} bytes`,
      );
    }
    const screenshotKey = buildRecordingStepScreenshotKey(sessionId, eventId, extension);
    artifactService.saveBuffer(screenshotKey, buffer);
    payload.screenshotKey = screenshotKey;
  }

  const domHtml = String(event.domHtml || incomingPayload.domHtml || '').trim();
  if (domHtml) {
    if (!eventId) {
      throw httpError(400, 'eventId is required when uploading a recording DOM snapshot');
    }
    const domBytes = Buffer.byteLength(domHtml, 'utf8');
    if (domBytes > RECORDING_EVENT_ARTIFACT_LIMITS.maxDomBytes) {
      throw httpError(
        413,
        `Recording DOM snapshot exceeds ${RECORDING_EVENT_ARTIFACT_LIMITS.maxDomBytes} bytes`,
      );
    }
    const domSnapshotKey = buildRecordingDomSnapshotKey(sessionId, eventId);
    artifactService.saveText(domSnapshotKey, domHtml);
    payload.domSnapshotKey = domSnapshotKey;
  }

  return {
    eventId,
    sequence: event.sequence,
    rawType: event.rawType,
    occurredAt: event.occurredAt,
    pageUrl: event.pageUrl,
    payload,
  };
};

module.exports = {
  decodeBase64Payload,
  persistIncomingEventArtifacts,
};
