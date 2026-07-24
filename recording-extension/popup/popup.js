import { getDefaultRecordingConfig, normalizeRecordingConfig, sessionIdLabel } from '../lib/extensionConfig.js';
import { MESSAGE } from '../lib/messages.js';
import { listProjectTestCases } from '../lib/tcmRecordingApi.js';

const configForm = document.getElementById('configForm');
const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const projectIdInput = document.getElementById('projectId');
const testCaseEntityIdInput = document.getElementById('testCaseEntityId');
const baseUrlInput = document.getElementById('baseUrl');
const captureVisualsInput = document.getElementById('captureVisuals');
const startButton = document.getElementById('startRecording');
const pauseButton = document.getElementById('pauseRecording');
const resumeButton = document.getElementById('resumeRecording');
const stopButton = document.getElementById('stopRecording');
const clearButton = document.getElementById('clearEvents');
const statusEl = document.getElementById('status');
const eventLogEl = document.getElementById('eventLog');

const EMPTY_TEST_CASE_OPTION = { id: '', label: '— Không gắn sẵn —' };

const sendMessage = (message) => chrome.runtime.sendMessage(message);

const readFormConfig = () => normalizeRecordingConfig({
  apiBaseUrl: apiBaseUrlInput.value,
  projectId: projectIdInput.value,
  testCaseEntityId: testCaseEntityIdInput.value,
  baseUrl: baseUrlInput.value,
  captureVisuals: captureVisualsInput.checked,
});

const fillTestCaseOptions = (options, selectedId = '') => {
  const normalizedSelected = String(selectedId || '').trim();
  const rows = [EMPTY_TEST_CASE_OPTION, ...(Array.isArray(options) ? options : [])];
  testCaseEntityIdInput.innerHTML = '';
  for (const option of rows) {
    const element = document.createElement('option');
    element.value = option.id;
    element.textContent = option.label;
    testCaseEntityIdInput.appendChild(element);
  }
  testCaseEntityIdInput.value = rows.some((option) => option.id === normalizedSelected)
    ? normalizedSelected
    : '';
};

const refreshTestCaseOptions = async ({ selectedId } = {}) => {
  const apiBaseUrl = apiBaseUrlInput.value;
  const projectId = projectIdInput.value;
  const preferredSelected = selectedId !== undefined
    ? selectedId
    : testCaseEntityIdInput.value;

  if (!String(apiBaseUrl || '').trim() || !String(projectId || '').trim()) {
    fillTestCaseOptions([], preferredSelected);
    return;
  }

  try {
    const options = await listProjectTestCases({ apiBaseUrl, projectId });
    fillTestCaseOptions(options, preferredSelected);
  } catch {
    fillTestCaseOptions([], preferredSelected);
  }
};

const fillFormConfig = async (config = {}) => {
  const defaults = getDefaultRecordingConfig();
  apiBaseUrlInput.value = config.apiBaseUrl || defaults.apiBaseUrl;
  projectIdInput.value = config.projectId || '';
  baseUrlInput.value = config.baseUrl || defaults.baseUrl;
  captureVisualsInput.checked = Boolean(config.captureVisuals);
  await refreshTestCaseOptions({ selectedId: config.testCaseEntityId || '' });
};

const setRecordingUi = ({ isRecording, isPaused, sessionActive }) => {
  const liveSession = Boolean(sessionActive || isRecording || isPaused);

  startButton.disabled = liveSession;
  pauseButton.disabled = !isRecording;
  resumeButton.disabled = !isPaused;
  stopButton.disabled = !liveSession;

  apiBaseUrlInput.disabled = liveSession;
  projectIdInput.disabled = liveSession;
  testCaseEntityIdInput.disabled = liveSession;
  baseUrlInput.disabled = liveSession;
  captureVisualsInput.disabled = liveSession;

  stopButton.classList.toggle('recording', isRecording);
  pauseButton.classList.toggle('paused', isPaused);
};

const renderStatus = ({
  isRecording,
  isPaused,
  session,
  pendingEventCount,
  error,
}) => {
  const sessionActive = Boolean(isRecording || isPaused);
  setRecordingUi({ isRecording, isPaused, sessionActive });

  statusEl.classList.toggle('error', Boolean(error || session?.lastError));

  if (error || session?.lastError) {
    statusEl.textContent = `Lỗi: ${error || session.lastError}`;
    return;
  }

  if (isRecording || isPaused) {
    const label = isPaused ? 'Tạm dừng' : 'Đang ghi';
    statusEl.textContent = `${label} session ${sessionIdLabel(session) || '...'} — ${session?.eventCount || 0} event trên server, ${pendingEventCount || 0} chờ gửi.`;
    return;
  }

  const stoppedSessionId = sessionIdLabel(session);
  statusEl.textContent = stoppedSessionId
    ? `Đã dừng. Session ${stoppedSessionId} — ${session.status || 'ready_for_review'} (${session.eventCount || 0} event).`
    : 'Sẵn sàng. Nhập cấu hình rồi bấm Bắt đầu ghi.';
};

const renderEvents = async () => {
  const response = await sendMessage({ type: MESSAGE.GET_LOCAL_EVENTS });
  const events = Array.isArray(response?.events) ? response.events : [];
  eventLogEl.textContent = JSON.stringify(events.slice(-20), null, 2);
};

const applyStateResponse = (stateResponse, error) => {
  renderStatus({
    isRecording: Boolean(stateResponse?.isRecording),
    isPaused: Boolean(stateResponse?.isPaused),
    session: stateResponse?.session,
    pendingEventCount: stateResponse?.pendingEventCount,
    error,
  });
};

const refresh = async () => {
  const [configResponse, stateResponse] = await Promise.all([
    sendMessage({ type: MESSAGE.GET_CONFIG }),
    sendMessage({ type: MESSAGE.GET_RECORDING_STATE }),
  ]);

  await fillFormConfig(configResponse?.config);
  applyStateResponse(stateResponse);
  await renderEvents();
};

const runSessionAction = async (type, fallbackError) => {
  const response = await sendMessage({ type });
  if (!response?.ok) {
    applyStateResponse(response, response?.error || fallbackError);
    return;
  }
  await refresh();
};

const persistFormConfig = async () => {
  if (startButton.disabled) {
    return;
  }
  await sendMessage({
    type: MESSAGE.SAVE_CONFIG,
    config: readFormConfig(),
  });
};

configForm.addEventListener('change', async (event) => {
  const target = event.target;
  if (target === apiBaseUrlInput || target === projectIdInput) {
    await refreshTestCaseOptions();
  }
  await persistFormConfig();
});

startButton.addEventListener('click', async () => {
  const config = readFormConfig();
  await sendMessage({ type: MESSAGE.SAVE_CONFIG, config });

  const response = await sendMessage({
    type: MESSAGE.START_RECORDING,
    config,
  });

  if (!response?.ok) {
    applyStateResponse(response, response?.error || 'Không bắt đầu được phiên ghi');
    return;
  }

  await refresh();
});

pauseButton.addEventListener('click', () => runSessionAction(MESSAGE.PAUSE_RECORDING, 'Không tạm dừng được phiên ghi'));
resumeButton.addEventListener('click', () => runSessionAction(MESSAGE.RESUME_RECORDING, 'Không tiếp tục được phiên ghi'));
stopButton.addEventListener('click', () => runSessionAction(MESSAGE.STOP_RECORDING, 'Không dừng được phiên ghi'));

clearButton.addEventListener('click', async () => {
  await sendMessage({ type: MESSAGE.CLEAR_LOCAL_EVENTS });
  await renderEvents();
});

refresh();
