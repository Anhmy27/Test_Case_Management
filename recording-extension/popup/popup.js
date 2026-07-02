import { getDefaultRecordingConfig, normalizeRecordingConfig } from '../lib/extensionConfig.js';
import { MESSAGE } from '../lib/messages.js';

const sessionIdLabel = (session) => session?.id || session?.sessionId || '';

const configForm = document.getElementById('configForm');
const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const projectIdInput = document.getElementById('projectId');
const testCaseEntityIdInput = document.getElementById('testCaseEntityId');
const baseUrlInput = document.getElementById('baseUrl');
const startButton = document.getElementById('startRecording');
const stopButton = document.getElementById('stopRecording');
const clearButton = document.getElementById('clearEvents');
const statusEl = document.getElementById('status');
const eventLogEl = document.getElementById('eventLog');

const sendMessage = (message) => chrome.runtime.sendMessage(message);

const readFormConfig = () => normalizeRecordingConfig({
  apiBaseUrl: apiBaseUrlInput.value,
  projectId: projectIdInput.value,
  testCaseEntityId: testCaseEntityIdInput.value,
  baseUrl: baseUrlInput.value,
});

const fillFormConfig = (config = {}) => {
  const defaults = getDefaultRecordingConfig();
  apiBaseUrlInput.value = config.apiBaseUrl || defaults.apiBaseUrl;
  projectIdInput.value = config.projectId || '';
  testCaseEntityIdInput.value = config.testCaseEntityId || '';
  baseUrlInput.value = config.baseUrl || defaults.baseUrl;
};

const setRecordingUi = (isRecording) => {
  startButton.disabled = isRecording;
  stopButton.disabled = !isRecording;
  apiBaseUrlInput.disabled = isRecording;
  projectIdInput.disabled = isRecording;
  testCaseEntityIdInput.disabled = isRecording;
  baseUrlInput.disabled = isRecording;
  stopButton.classList.toggle('recording', isRecording);
};

const renderStatus = ({ isRecording, session, pendingEventCount, error }) => {
  setRecordingUi(isRecording);
  statusEl.classList.toggle('error', Boolean(error || session?.lastError));

  if (error || session?.lastError) {
    statusEl.textContent = `Lỗi: ${error || session.lastError}`;
    return;
  }

  if (!isRecording) {
    const stoppedSessionId = sessionIdLabel(session);
    statusEl.textContent = stoppedSessionId
      ? `Đã dừng. Session ${stoppedSessionId} — ${session.status || 'ready_for_review'} (${session.eventCount || 0} event).`
      : 'Sẵn sàng. Nhập cấu hình rồi bấm Bắt đầu ghi.';
    return;
  }

  statusEl.textContent = `Đang ghi session ${sessionIdLabel(session) || '...'} — ${session?.eventCount || 0} event trên server, ${pendingEventCount || 0} chờ gửi.`;
};

const renderEvents = async () => {
  const response = await sendMessage({ type: MESSAGE.GET_LOCAL_EVENTS });
  const events = Array.isArray(response?.events) ? response.events : [];
  eventLogEl.textContent = JSON.stringify(events.slice(-20), null, 2);
};

const refresh = async () => {
  const [configResponse, stateResponse] = await Promise.all([
    sendMessage({ type: MESSAGE.GET_CONFIG }),
    sendMessage({ type: MESSAGE.GET_RECORDING_STATE }),
  ]);

  fillFormConfig(configResponse?.config);
  renderStatus({
    isRecording: Boolean(stateResponse?.isRecording),
    session: stateResponse?.session,
    pendingEventCount: stateResponse?.pendingEventCount,
  });
  await renderEvents();
};

configForm.addEventListener('change', async () => {
  if (startButton.disabled) {
    return;
  }
  await sendMessage({
    type: MESSAGE.SAVE_CONFIG,
    config: readFormConfig(),
  });
});

startButton.addEventListener('click', async () => {
  const config = readFormConfig();
  await sendMessage({ type: MESSAGE.SAVE_CONFIG, config });

  const response = await sendMessage({
    type: MESSAGE.START_RECORDING,
    config,
  });

  if (!response?.ok) {
    renderStatus({
      isRecording: false,
      session: response?.session,
      error: response?.error || 'Không bắt đầu được phiên ghi',
    });
    return;
  }

  await refresh();
});

stopButton.addEventListener('click', async () => {
  const response = await sendMessage({ type: MESSAGE.STOP_RECORDING });
  if (!response?.ok) {
    renderStatus({
      isRecording: false,
      session: response?.session,
      error: response?.error || 'Không dừng được phiên ghi',
    });
    return;
  }
  await refresh();
});

clearButton.addEventListener('click', async () => {
  await sendMessage({ type: MESSAGE.CLEAR_LOCAL_EVENTS });
  await renderEvents();
});

refresh();
