import {
  isLiveSessionStatus,
  MAX_LOCAL_EVENT_LOG,
  normalizeRecordingConfig,
} from '../lib/extensionConfig.js';
import { MESSAGE } from '../lib/messages.js';
import { EVENT_FLUSH_DEBOUNCE_MS } from '../lib/tcmApiConstants.js';
import {
  appendRecordingEvents,
  pauseRecordingSession,
  resumeRecordingSession,
  startRecordingSession,
  stopRecordingSession,
} from '../lib/tcmRecordingApi.js';

const LOCAL_EVENTS_KEY = 'tcmRecordingLocalEvents';
const CONFIG_KEY = 'tcmRecordingConfig';
const SESSION_KEY = 'tcmRecordingApiSession';

let isRecording = false;
let pendingEvents = [];
let flushTimer = null;
let flushPromise = null;

let runtimeSession = {
  sessionId: '',
  eventCount: 0,
  status: '',
  lastError: '',
};

const readConfig = async () => {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  return normalizeRecordingConfig(stored[CONFIG_KEY] || {});
};

const saveConfig = async (config) => {
  const nextConfig = normalizeRecordingConfig(config);
  await chrome.storage.local.set({ [CONFIG_KEY]: nextConfig });
  return nextConfig;
};

const readLocalEvents = async () => {
  const stored = await chrome.storage.session.get(LOCAL_EVENTS_KEY);
  const events = stored[LOCAL_EVENTS_KEY];
  return Array.isArray(events) ? events : [];
};

const writeLocalEvents = async (events) => {
  await chrome.storage.session.set({
    [LOCAL_EVENTS_KEY]: events.slice(-MAX_LOCAL_EVENT_LOG),
  });
};

const appendLocalEvent = async (event) => {
  const events = await readLocalEvents();
  events.push(event);
  await writeLocalEvents(events);
};

const persistRuntimeSession = async () => {
  await chrome.storage.session.set({ [SESSION_KEY]: runtimeSession });
};

const restoreRuntimeSession = async () => {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  runtimeSession = {
    sessionId: '',
    eventCount: 0,
    status: '',
    lastError: '',
    ...(stored[SESSION_KEY] || {}),
  };
};

const isSessionLive = () =>
  Boolean(runtimeSession.sessionId && isLiveSessionStatus(runtimeSession.status));

const buildStateSnapshot = () => ({
  isRecording,
  isPaused: runtimeSession.status === 'paused',
  sessionActive: isSessionLive(),
  session: runtimeSession,
  pendingEventCount: pendingEvents.length,
});

const respondSessionOk = (sendResponse, flags) => {
  sendResponse({
    ok: true,
    ...flags,
    session: runtimeSession,
  });
};

const applyApiSession = (apiSession, fallbackStatus) => {
  runtimeSession = {
    sessionId: String(apiSession?.id || runtimeSession.sessionId || ''),
    eventCount: Number(apiSession?.eventCount ?? runtimeSession.eventCount),
    status: String(apiSession?.status || fallbackStatus),
    lastError: '',
  };
  return apiSession || null;
};

const broadcastRecordingState = async (nextState) => {
  isRecording = Boolean(nextState);
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) {
        return;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE.SET_RECORDING_STATE,
          isRecording,
        });
      } catch {
        // Content script is not injected on restricted pages.
      }
    }),
  );
};

const clearFlushTimer = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
};

const flushPendingEvents = async ({ force = false } = {}) => {
  if (flushPromise) {
    return flushPromise;
  }

  if (!runtimeSession.sessionId || !pendingEvents.length) {
    return;
  }

  if (!force && !isRecording) {
    return;
  }

  const config = await readConfig();
  const batch = pendingEvents.splice(0, pendingEvents.length);

  flushPromise = (async () => {
    try {
      const response = await appendRecordingEvents({
        apiBaseUrl: config.apiBaseUrl,
        sessionId: runtimeSession.sessionId,
        events: batch,
      });
      applyApiSession(response?.session, runtimeSession.status);
      await persistRuntimeSession();
    } catch (error) {
      pendingEvents.unshift(...batch);
      runtimeSession.lastError = error?.message || 'Không gửi được event lên TCM';
      await persistRuntimeSession();
      throw error;
    } finally {
      flushPromise = null;
    }
  })();

  return flushPromise;
};

const scheduleFlush = () => {
  clearFlushTimer();

  flushTimer = setTimeout(() => {
    flushPendingEvents().catch(() => {
      // lastError already stored for popup display
    });
  }, EVENT_FLUSH_DEBOUNCE_MS);
};

const requireSessionStatus = (expectedStatus, actionLabel) => {
  if (!runtimeSession.sessionId) {
    throw new Error('Không có phiên ghi đang mở');
  }
  if (runtimeSession.status !== expectedStatus) {
    throw new Error(`Không thể ${actionLabel} khi trạng thái là ${runtimeSession.status || 'unknown'}`);
  }
};

const mutateSession = async ({ expectedStatus, actionLabel, apiCall, fallbackStatus, captureEnabled }) => {
  requireSessionStatus(expectedStatus, actionLabel);

  const config = await readConfig();
  if (expectedStatus === 'recording') {
    await flushPendingEvents({ force: true });
  }

  const response = await apiCall({
    apiBaseUrl: config.apiBaseUrl,
    sessionId: runtimeSession.sessionId,
  });

  applyApiSession(response?.session, fallbackStatus);
  await persistRuntimeSession();
  await broadcastRecordingState(captureEnabled);
  return response?.session || null;
};

const startApiRecording = async (configOverride = {}) => {
  const config = await saveConfig({
    ...(await readConfig()),
    ...configOverride,
  });

  if (!config.projectId) {
    throw new Error('Project ID là bắt buộc');
  }
  if (!config.baseUrl) {
    throw new Error('Base URL trang test là bắt buộc');
  }

  const response = await startRecordingSession({
    apiBaseUrl: config.apiBaseUrl,
    projectId: config.projectId,
    baseUrl: config.baseUrl,
    testCaseEntityId: config.testCaseEntityId,
  });

  applyApiSession(response?.session, 'recording');

  if (!runtimeSession.sessionId) {
    throw new Error('API start không trả về session id');
  }

  clearFlushTimer();
  pendingEvents = [];
  await persistRuntimeSession();
  await broadcastRecordingState(true);
};

const pauseApiRecording = () => mutateSession({
  expectedStatus: 'recording',
  actionLabel: 'tạm dừng',
  fallbackStatus: 'paused',
  captureEnabled: false,
  apiCall: pauseRecordingSession,
});

const resumeApiRecording = () => mutateSession({
  expectedStatus: 'paused',
  actionLabel: 'tiếp tục',
  fallbackStatus: 'recording',
  captureEnabled: true,
  apiCall: resumeRecordingSession,
});

const stopApiRecording = async () => {
  clearFlushTimer();

  if (!runtimeSession.sessionId) {
    await broadcastRecordingState(false);
    return null;
  }

  const config = await readConfig();
  await flushPendingEvents({ force: true });

  const response = await stopRecordingSession({
    apiBaseUrl: config.apiBaseUrl,
    sessionId: runtimeSession.sessionId,
  });

  applyApiSession(response?.session, 'ready_for_review');
  await persistRuntimeSession();
  await broadcastRecordingState(false);
  return response?.session || null;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MESSAGE.GET_RECORDING_STATE:
        sendResponse(buildStateSnapshot());
        return;
      case MESSAGE.GET_CONFIG:
        sendResponse({ config: await readConfig() });
        return;
      case MESSAGE.SAVE_CONFIG:
        sendResponse({ config: await saveConfig(message.config || {}) });
        return;
      case MESSAGE.START_RECORDING:
        await startApiRecording(message.config || {});
        respondSessionOk(sendResponse, {
          isRecording: true,
          isPaused: false,
          sessionActive: true,
        });
        return;
      case MESSAGE.STOP_RECORDING:
        await stopApiRecording();
        respondSessionOk(sendResponse, {
          isRecording: false,
          isPaused: false,
          sessionActive: false,
        });
        return;
      case MESSAGE.PAUSE_RECORDING:
        await pauseApiRecording();
        respondSessionOk(sendResponse, {
          isRecording: false,
          isPaused: true,
          sessionActive: true,
        });
        return;
      case MESSAGE.RESUME_RECORDING:
        await resumeApiRecording();
        respondSessionOk(sendResponse, {
          isRecording: true,
          isPaused: false,
          sessionActive: true,
        });
        return;
      case MESSAGE.RECORDED_EVENT:
        if (isRecording && message.event) {
          await appendLocalEvent(message.event);
          if (runtimeSession.sessionId) {
            pendingEvents.push(message.event);
            scheduleFlush();
          }
        }
        sendResponse({ ok: true, pendingEventCount: pendingEvents.length });
        return;
      case MESSAGE.GET_LOCAL_EVENTS:
        sendResponse({ events: await readLocalEvents() });
        return;
      case MESSAGE.CLEAR_LOCAL_EVENTS:
        await writeLocalEvents([]);
        sendResponse({ ok: true });
        return;
      default:
        sendResponse({ ok: false });
    }
  })().catch(async (error) => {
    clearFlushTimer();
    runtimeSession.lastError = error?.message || 'Recording failed';
    await persistRuntimeSession();
    sendResponse({
      ok: false,
      error: runtimeSession.lastError,
      ...buildStateSnapshot(),
    });
  });

  return true;
});

restoreRuntimeSession().then(async () => {
  isRecording = runtimeSession.status === 'recording';
  if (isSessionLive()) {
    await broadcastRecordingState(isRecording);
  }
});
