import {
  MAX_LOCAL_EVENT_LOG,
  normalizeRecordingConfig,
} from '../lib/extensionConfig.js';
import { MESSAGE } from '../lib/messages.js';
import { EVENT_FLUSH_DEBOUNCE_MS } from '../lib/tcmApiConstants.js';
import {
  appendRecordingEvents,
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
      runtimeSession.eventCount = response?.session?.eventCount ?? runtimeSession.eventCount;
      runtimeSession.lastError = '';
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

  runtimeSession = {
    sessionId: String(response?.session?.id || ''),
    eventCount: Number(response?.session?.eventCount || 0),
    status: String(response?.session?.status || 'recording'),
    lastError: '',
  };

  if (!runtimeSession.sessionId) {
    throw new Error('API start không trả về session id');
  }

  clearFlushTimer();
  pendingEvents = [];
  await persistRuntimeSession();
  await broadcastRecordingState(true);
};

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

  runtimeSession = {
    sessionId: runtimeSession.sessionId,
    eventCount: Number(response?.session?.eventCount || runtimeSession.eventCount),
    status: String(response?.session?.status || 'ready_for_review'),
    lastError: '',
  };

  await persistRuntimeSession();
  await broadcastRecordingState(false);
  return response?.session || null;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MESSAGE.GET_RECORDING_STATE:
        sendResponse({
          isRecording,
          session: runtimeSession,
          pendingEventCount: pendingEvents.length,
        });
        return;
      case MESSAGE.GET_CONFIG:
        sendResponse({ config: await readConfig() });
        return;
      case MESSAGE.SAVE_CONFIG:
        sendResponse({ config: await saveConfig(message.config || {}) });
        return;
      case MESSAGE.START_RECORDING:
        await startApiRecording(message.config || {});
        sendResponse({
          ok: true,
          isRecording: true,
          session: runtimeSession,
        });
        return;
      case MESSAGE.STOP_RECORDING: {
        const apiSession = await stopApiRecording();
        sendResponse({
          ok: true,
          isRecording: false,
          session: apiSession
            ? {
              ...runtimeSession,
              sessionId: apiSession.id || runtimeSession.sessionId,
              status: apiSession.status || runtimeSession.status,
              eventCount: apiSession.eventCount ?? runtimeSession.eventCount,
            }
            : runtimeSession,
        });
        return;
      }
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
    await broadcastRecordingState(false);
    sendResponse({
      ok: false,
      error: runtimeSession.lastError,
      session: runtimeSession,
    });
  });

  return true;
});

restoreRuntimeSession().then(async () => {
  isRecording = Boolean(runtimeSession.sessionId && runtimeSession.status === 'recording');
});
