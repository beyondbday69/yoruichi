import './mobile.css';
import { MyraaAudioSession, type LiveState } from '../lib/audio';
import { MobileLiveTransport } from './LiveTransport';
import { parseMobileAction } from './actions';
import { CharacterSystem } from '../character/core/CharacterSystem';
import { evelynConfig } from '../character/config/characters/evelyn';
import { qualityProfile, withQuality } from '../character/core/quality';
import { setCharacterRealism } from '../character/materials/AnimeMaterial';
import { parseCharacterCommand } from '../../shared/character/commands';
import { Yoruichi3DAvatar } from './Yoruichi3DAvatar';

interface Bridge {
  getState(): string;
  configure(json: string): void;
  checkConnection(json: string): void;
  chat(text: string, id: string): void;
  cancel(): void;
  startLive(id: string): void;
  endLive(): void;
  speak(text: string): void;
  stopSpeech(): void;
  clearHistory(): void;
  clearKey(): void;
  openSettings(): void;
  mobileAction(id: string, name: string, args: string): void;
  openFloatingSettings(): void;
  cancelMobileAction(id: string): void;
}

declare global {
  interface Window {
    YoruichiNative?: Bridge;
    MyraaNative?: Bridge;
    YoruichiEvents?: (event: any) => void;
    MyraaEvents?: (event: any) => void;
    __mobileDiagnostics?: () => unknown;
  }
}

const bridge = window.YoruichiNative || window.MyraaNative;
let state: any = bridge ? JSON.parse(bridge.getState()) : {
  history: [],
  model: 'gemini-2.5-flash',
  quality: 'balanced',
  language: 'hi-IN',
  keyConfigured: false,
};

let system: CharacterSystem | null = null;
let avatar3d: Yoruichi3DAvatar | null = null;
let generation = 0;
let busy = false;
let requestId = '';
let lastReply = '';
let pendingText = '';
let foreground = true;
let backgroundLive = false;
let permissionPrompt = false;
const actionRequests = new Map<string, { resolve: (result: any) => void; timer: ReturnType<typeof setTimeout> }>();

function runMobileAction(name: string, args: unknown): Promise<any> {
  if (!bridge?.mobileAction) {
    return Promise.resolve({ status: 'unavailable', message: 'Mobile actions require the updated Android app.' });
  }
  const id = crypto.randomUUID();
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      actionRequests.delete(id);
      bridge.cancelMobileAction(id);
      resolve({ status: 'timeout', message: 'The action timed out. Check permission and try again.' });
    }, 60000);
    actionRequests.set(id, { resolve, timer });
    bridge.mobileAction(id, name, JSON.stringify(args));
  });
}

let fullBody = true;
let liveSession: MyraaAudioSession | null = null;
let liveCaption: { role: string; body: HTMLElement } | null = null;

function cancelMobileActions() {
  for (const [id, request] of actionRequests) {
    clearTimeout(request.timer);
    bridge?.cancelMobileAction(id);
    request.resolve({ status: 'cancelled', message: 'Action cancelled.' });
  }
  actionRequests.clear();
}

function stopVoice() {
  backgroundLive = false;
  const session = liveSession;
  liveSession = null;
  if (session) cancelMobileActions();
  session?.disconnect();
  bridge?.endLive();
}

function liveState(value: LiveState) {
  const active = value !== 'disconnected';
  if (value === 'listening') notice('Live voice connected. Speak naturally.');
  el('voice').setAttribute('aria-pressed', String(active));
  el('voice').querySelector('span')!.textContent = active ? 'End' : 'Talk';
  el('presence').textContent = value === 'connecting' ? 'Connecting live…'
    : value === 'speaking' ? 'Yoruichi speaking'
    : value === 'listening' ? 'Listening to you…'
    : 'Online';

  const frameInput = {
    activity: (value === 'speaking' ? 'talking' : value === 'listening' ? 'listening' : 'idle') as any,
    outputAnalyser: liveSession?.outputAnalyser ?? null,
    inputAnalyser: liveSession?.inputAnalyser ?? null,
  };
  system?.setFrameInput(frameInput);
  avatar3d?.setFrameInput(frameInput);
}

function liveTranscription(role: 'user' | 'model', text: string) {
  if (!liveCaption || liveCaption.role !== role) {
    append(role, '');
    liveCaption = { role, body: el('messages').lastElementChild!.querySelector('p')! };
  }
  liveCaption.body.textContent = ((liveCaption.body.textContent || '') + text).slice(-8000);
  el('messages').scrollTop = el('messages').scrollHeight;
  if (role === 'model') lastReply = liveCaption.body.textContent;
}

const app = document.querySelector('#app')!;
app.innerHTML = `
  <header>
    <div class="brand">
      <span class="brand-mark">Y</span>
      <div class="brand-text">
        <div class="brand-title">YORUICHI <span class="version">AI</span></div>
        <small>3D Mobile Assistant</small>
      </div>
    </div>
    <button id="settings" aria-label="Open settings">⚙</button>
  </header>
  <main>
    <section class="portrait" aria-label="Yoruichi 3D Assistant">
      <div class="halo"></div>
      <div id="avatar"></div>
      <div class="avatar-status" id="avatar-status" role="status">Initializing 3D assistant…</div>
      <span class="presence"><i></i> <span id="presence">Online</span></span>
      <div class="gestures">
        <button id="wave">Wave</button>
        <button id="sit">Sit</button>
        <button id="stand">Stand</button>
        <button id="happy">Smile</button>
        <button id="view">Portrait</button>
      </div>
    </section>
    <section class="conversation">
      <div class="section-heading">
        <span>CONVERSATION</span>
        <button id="history-toggle">History</button>
      </div>
      <div id="messages" role="log" aria-live="polite"></div>
      <div id="notice" class="notice" role="status"></div>
    </section>
  </main>
  <footer>
    <div class="composer">
      <button id="voice" aria-label="Voice conversation" aria-pressed="false" title="Start voice conversation">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="9" y="2" width="6" height="12" rx="3"/>
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>
        </svg>
        <span>Talk</span>
      </button>
      <textarea id="input" rows="1" maxlength="8000" placeholder="Talk to Yoruichi (Hindi/Hinglish/English)…" aria-label="Message"></textarea>
      <button id="send" aria-label="Send message">↑</button>
    </div>
    <div class="footer-actions">
      <span id="connection">Secured on device · Gemini AI</span>
      <button id="stop">Stop</button>
      <button id="speak" aria-label="Read aloud">Read aloud</button>
    </div>
  </footer>
  <dialog id="settings-panel">
    <form method="dialog">
      <div class="dialog-heading">
        <h2>Yoruichi Settings</h2>
        <button aria-label="Close settings">×</button>
      </div>
    </form>
    <p class="muted">Your API key and conversations remain securely on this phone. Responses are generated directly via Google Gemini.</p>
    <label>Gemini API Key
      <input id="key" type="password" autocomplete="off" placeholder="Enter your Gemini API key">
    </label>
    <p id="key-state" class="muted"></p>
    <label>Text Model
      <input id="model" autocomplete="off" placeholder="gemini-2.5-flash">
    </label>
    <label>Live Voice Model
      <input id="live-model" autocomplete="off" placeholder="gemini-2.5-flash">
    </label>
    <label>Language
      <select id="language">
        <option value="hi-IN">Hindi / Hinglish</option>
        <option value="en-IN">English (India)</option>
        <option value="en-US">English (US)</option>
      </select>
    </label>
    <label>3D Graphics Preset
      <select id="quality">
        <option value="balanced">Balanced (Recommended)</option>
        <option value="high">High · Sharp 3D</option>
        <option value="low">Low · Battery Saver</option>
      </select>
    </label>
    <label class="check">
      <input id="spoken" type="checkbox"> Read text replies with Android voice
    </label>
    <button id="save" class="primary">Save Settings</button>
    <button id="check-connection">Check Key &amp; Model</button>
    <p id="settings-status" class="muted" role="status" aria-live="polite"></p>
    <div class="privacy-actions">
      <button id="remove-key">Remove API Key</button>
      <button id="clear-history">Clear History</button>
      <button id="android-settings">App Permissions</button>
      <button id="floating-settings">Floating Voice Controls</button>
    </div>
    <p class="muted">Control actions supported: "WhatsApp kholo", "YouTube search [song]", "Google search [topic]", "Message [name] on WhatsApp: [msg]".</p>
    <output id="diagnostics" class="muted"></output>
  </dialog>
`;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function notice(message: string) {
  el('notice').textContent = message;
}

function append(role: 'user' | 'model', text: string) {
  const container = document.createElement('div');
  container.className = `message ${role}`;
  const label = document.createElement('small');
  label.textContent = role === 'user' ? 'YOU' : 'YORUICHI';
  const body = document.createElement('p');
  body.textContent = text;
  container.appendChild(label);
  container.appendChild(body);
  el('messages').appendChild(container);
  el('messages').scrollTop = el('messages').scrollHeight;
}

function renderHistory(expanded = false) {
  el('messages').replaceChildren();
  const turns = state.history || [];
  const visible = expanded ? turns : turns.slice(-4);
  for (const turn of visible) append(turn.role, turn.text);
}

function refreshSettings() {
  el<HTMLInputElement>('key').value = '';
  el<HTMLInputElement>('model').value = state.model || 'gemini-2.5-flash';
  el<HTMLInputElement>('live-model').value = state.liveModel || 'gemini-2.5-flash';
  el<HTMLSelectElement>('language').value = state.language || 'hi-IN';
  el<HTMLSelectElement>('quality').value = state.quality || 'balanced';
  el<HTMLInputElement>('spoken').checked = !!state.spokenReplies;
  refreshKeyStatus();
}

function refreshKeyStatus() {
  el('key-state').textContent = state.keyConfigured
    ? `API key saved in Android Keystore. ${state.keyVerified ? 'Verified by Google.' : 'Use Check key & model to verify.'}`
    : 'No API key configured. Enter one to chat.';
}

function settingsProgress(active: boolean, message: string) {
  el('settings-status').textContent = message;
  for (const control of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
    '#settings-panel input,#settings-panel select,#save,#check-connection'
  )) {
    control.disabled = active;
  }
}

async function loadAvatar() {
  const mine = ++generation;
  system?.dispose();
  system = null;
  avatar3d?.dispose();
  avatar3d = null;

  el('avatar').replaceChildren();
  const canvas = document.createElement('canvas');
  el('avatar').appendChild(canvas);
  el('avatar-status').textContent = 'Loading 3D assistant…';

  try {
    // Attempt PMX character load first if assets exist
    const base = qualityProfile(state.quality || 'balanced');
    const quality = {
      ...base,
      maxPixelRatio: state.quality === 'low' ? 0.85 : state.quality === 'balanced' ? 1.2 : 1.6,
      maxTextureSize: state.quality === 'high' ? 2048 : state.quality === 'low' ? 512 : 1024,
      targetFps: 30,
      shadows: false,
      cloth: false,
      antialias: false,
    };
    const instance = new CharacterSystem({
      canvas,
      config: withQuality(evelynConfig, quality),
      quality,
      onError: error => {
        if (mine === generation) notice(`Avatar: ${error.message}`);
      },
    });

    const box = el('avatar').getBoundingClientRect();
    instance.resize(box.width, box.height);
    setCharacterRealism(0.65);
    await instance.load();

    if (mine !== generation) return;
    system = instance;
    if (fullBody) instance.frameFullBody();
    instance.setEyeTracking(true);
    if (foreground && !document.hidden) instance.start();
    el('avatar-status').textContent = '';
  } catch (_pmxError) {
    if (mine !== generation) return;
    // Activate Real-Time 3D Holographic Yoruichi Avatar
    try {
      const holo = new Yoruichi3DAvatar({
        canvas,
        quality: state.quality || 'balanced',
        onReady: () => {
          el('avatar-status').textContent = '';
        },
      });
      avatar3d = holo;
      const box = el('avatar').getBoundingClientRect();
      holo.resize(box.width, box.height);
      if (foreground && !document.hidden) holo.start();
      el('avatar-status').textContent = '';
    } catch (holoErr) {
      el('avatar-status').textContent = '';
    }
  }
}

const handleGenericEvent = (event: any) => {
  if (event.type === 'mobile-action-result') {
    const request = actionRequests.get(event.id);
    if (request) {
      clearTimeout(request.timer);
      actionRequests.delete(event.id);
      request.resolve(event.result);
    }
    notice(event.result?.message || 'Action executed.');
    return;
  }
  if (event.type === 'live-token') backgroundLive = !!event.backgroundLive;
  if (event.type === 'live-token' || event.type === 'live-error') {
    window.dispatchEvent(new CustomEvent('yoruichi:mobile-live', { detail: event }));
    window.dispatchEvent(new CustomEvent('myraa:mobile-live', { detail: event }));
    return;
  }
  if (event.type === 'settings') {
    settingsProgress(false, event.message || '');
    if (event.state) {
      state = event.state;
      refreshSettings();
    }
    return;
  }
  if (event.type === 'reply' && event.id === requestId) {
    busy = false;
    lastReply = event.text;
    append('model', event.text);
    return;
  }
  if (event.type === 'error' && event.id === requestId) {
    busy = false;
    notice(event.message || 'Error answering.');
    return;
  }
  if (event.type === 'speech') {
    const active = !!event.active;
    el('presence').textContent = active ? 'Yoruichi speaking…' : 'Online';
    system?.setFrameInput({ activity: active ? 'talking' : 'idle' });
    avatar3d?.setFrameInput({ activity: active ? 'talking' : 'idle' });
    return;
  }
};

window.YoruichiEvents = handleGenericEvent;
window.MyraaEvents = handleGenericEvent;

async function sendChat() {
  const input = el<HTMLTextAreaElement>('input');
  const text = (input.value || pendingText).trim();
  if (!text) return;

  const characterCommand = parseCharacterCommand(text);
  if (characterCommand && system) {
    append('user', text);
    input.value = '';
    pendingText = '';
    system.applyCommand(characterCommand);
    notice(`Action: ${characterCommand.type}`);
    return;
  }

  const action = parseMobileAction(text);
  if (action) {
    append('user', text);
    input.value = '';
    pendingText = '';
    notice(`Starting: ${action.action}...`);
    avatar3d?.smile();
    const result = await runMobileAction('mobile_action', action);
    notice(result.message || 'Finished action.');
    return;
  }

  if (busy) return notice('Yoruichi is answering. Tap Stop to interrupt.');
  if (!bridge) return notice('Chat connects through the Android app.');

  append('user', text);
  input.value = '';
  pendingText = '';
  busy = true;
  requestId = crypto.randomUUID();
  avatar3d?.setFrameInput({ activity: 'talking' });
  bridge.chat(text, requestId);
}

el('send').onclick = () => void sendChat();
el('input').onkeydown = event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void sendChat();
  }
};

el('stop').onclick = () => {
  busy = false;
  bridge?.cancel();
  bridge?.stopSpeech();
  stopVoice();
  notice('Stopped.');
};

el('voice').onclick = () => {
  if (liveSession) {
    stopVoice();
    return;
  }
  if (!bridge) return notice('Live voice runs inside the Android app.');

  bridge.stopSpeech();
  liveCaption = null;
  liveSession = new MyraaAudioSession({
    connection: { createSocket: () => new MobileLiveTransport(bridge) },
    onStateChange: liveState,
    onTranscription: liveTranscription,
    onToolCall: (name, args, callback) => {
      if (name !== 'mobile_action') {
        callback({ status: 'unsupported', message: 'That tool is unavailable on mobile.' });
        return;
      }
      void runMobileAction(name, args).then(result => {
        notice(result.message);
        callback(result);
      });
    },
    onError: message => {
      notice(message);
      stopVoice();
    },
  });

  notice('Connecting to Yoruichi Live…');
  void liveSession.connect(true);
};

el('speak').onclick = () => {
  const text = lastReply || state.history.filter((t: any) => t.role === 'model').at(-1)?.text;
  if (text) {
    stopVoice();
    bridge?.speak(text);
  } else {
    notice('No reply to read yet.');
  }
};

el('wave').onclick = () => {
  system?.setFrameInput({ emotion: 'happy' });
  system?.playBehaviour('wave');
  avatar3d?.wave();
};

el('sit').onclick = () => {
  system?.frameFullBody();
  system?.sit({ seat: 'chair', style: 'upright' });
  avatar3d?.sit();
};

el('stand').onclick = () => {
  system?.stand();
  if (!fullBody) {
    system?.stage.clearPan();
    system?.setCameraFocus(null);
  }
  avatar3d?.stand();
};

el('view').onclick = () => {
  fullBody = !fullBody;
  if (fullBody) {
    system?.frameFullBody();
    avatar3d?.frameFullBody();
  } else {
    system?.stage.clearPan();
    system?.setCameraFocus(null);
    avatar3d?.framePortrait();
  }
  el('view').textContent = fullBody ? 'Portrait' : 'Full body';
};

el('happy').onclick = () => {
  system?.setFrameInput({ emotion: 'happy' });
  avatar3d?.smile();
  setTimeout(() => system?.setFrameInput({ emotion: 'idle' }), 3000);
};

el('settings').onclick = () => {
  stopVoice();
  refreshSettings();
  el<HTMLDialogElement>('settings-panel').showModal();
  el('diagnostics').textContent = JSON.stringify(system?.diagnostics || {});
};

el('save').onclick = () => {
  if (!bridge) return notice('Save settings in the installed Android app.');
  settingsProgress(true, 'Checking and saving settings…');
  bridge.configure(
    JSON.stringify({
      key: el<HTMLInputElement>('key').value.trim(),
      liveModel: el<HTMLInputElement>('live-model').value.trim(),
      model: el<HTMLInputElement>('model').value.trim(),
      quality: el<HTMLSelectElement>('quality').value,
      language: el<HTMLSelectElement>('language').value,
      spokenReplies: el<HTMLInputElement>('spoken').checked,
    })
  );
};

el('check-connection').onclick = () => {
  if (!bridge) return notice('Check connection in the installed Android app.');
  settingsProgress(true, 'Checking Google key & model access…');
  bridge.checkConnection(
    JSON.stringify({
      key: el<HTMLInputElement>('key').value.trim(),
      liveModel: el<HTMLInputElement>('live-model').value.trim(),
      model: el<HTMLInputElement>('model').value.trim(),
    })
  );
};

let allHistory = false;
el('history-toggle').onclick = () => {
  allHistory = !allHistory;
  renderHistory(allHistory);
  el('history-toggle').textContent = allHistory ? 'Close history' : 'History';
  document.querySelector('.conversation')!.classList.toggle('expanded', allHistory);
};

el('clear-history').onclick = () => {
  if (confirm('Clear conversation history on this device?')) {
    bridge?.clearHistory();
    state = bridge ? JSON.parse(bridge.getState()) : state;
    renderHistory();
  }
};

el('remove-key').onclick = () => {
  if (confirm('Remove your saved Gemini API key?')) {
    bridge?.clearKey();
    state = bridge ? JSON.parse(bridge.getState()) : state;
    refreshSettings();
  }
};

el('android-settings').onclick = () => bridge?.openSettings();
el('floating-settings').onclick = () => bridge?.openFloatingSettings();

const resize = new ResizeObserver(() => {
  const box = el('avatar').getBoundingClientRect();
  system?.resize(box.width, box.height);
  avatar3d?.resize(box.width, box.height);
  if (fullBody) {
    system?.frameFullBody();
    avatar3d?.frameFullBody();
  }
});
resize.observe(el('avatar'));

el('avatar').onpointermove = event => {
  const box = el('avatar').getBoundingClientRect();
  system?.setPointer(((event.clientX - box.left) / box.width) * 2 - 1, 1 - ((event.clientY - box.top) / box.height) * 2);
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!backgroundLive && !permissionPrompt) stopVoice();
    system?.stop();
    avatar3d?.stop();
    bridge?.stopSpeech();
  } else {
    system?.start();
    avatar3d?.start();
  }
});

const onLifecycle = (event: any) => {
  foreground = !!(event as CustomEvent).detail?.active;
  permissionPrompt = !!(event as CustomEvent).detail?.permissionPrompt;
  backgroundLive = !!(event as CustomEvent).detail?.backgroundLive;
  if (!foreground && !backgroundLive && !(event as CustomEvent).detail?.permissionPrompt) {
    stopVoice();
  }
  if (foreground) {
    system?.start();
    avatar3d?.start();
  } else {
    system?.stop();
    avatar3d?.stop();
    bridge?.stopSpeech();
  }
};

window.addEventListener('yoruichi:lifecycle', onLifecycle);
window.addEventListener('myraa:lifecycle', onLifecycle);

const onStopLive = () => {
  stopVoice();
  notice('Live call ended.');
};
window.addEventListener('yoruichi:stop-live', onStopLive);
window.addEventListener('myraa:stop-live', onStopLive);

window.addEventListener('pagehide', () => {
  stopVoice();
  generation++;
  system?.dispose();
  avatar3d?.dispose();
  bridge?.cancel();
});

renderHistory();
refreshSettings();
void loadAvatar();

if (!bridge) notice('Browser preview — native phone controls run on Android device.');
