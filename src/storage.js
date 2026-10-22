const SETTINGS_KEY = 'mdnote.settings';
const DRAFT_PREFIX = 'mdnote.draft:';
const RECENT_KEY = 'mdnote.recent';
const RECENT_MAX = 8;

const defaults = {
  theme: 'system',
  lang: navigator.language?.startsWith('ko') ? 'ko' : 'en',
  fontSize: '16',
  editorFontSize: '14',
  splitRatio: 0.5,
  width: 'normal',
  view: 'read',
  outline: true,
  tutorialSeen: false,
  lastKey: null,
  lastFolder: null,
};

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore quota / private mode */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function loadSettings() {
  const raw = safeGet(SETTINGS_KEY);
  if (!raw) return { ...defaults };
  // Anyone with saved settings has used the app before (and seen the guide).
  try { return { ...defaults, tutorialSeen: true, ...JSON.parse(raw) }; } catch { return { ...defaults }; }
}

export function saveSettings(settings) {
  safeSet(SETTINGS_KEY, JSON.stringify(settings));
}

export function saveDraft(docKey, text) {
  safeSet(DRAFT_PREFIX + docKey, JSON.stringify({ text, at: Date.now() }));
}

export function loadDraft(docKey) {
  const raw = safeGet(DRAFT_PREFIX + docKey);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearDraft(docKey) {
  safeRemove(DRAFT_PREFIX + docKey);
}

// Recent documents, newest first: { key, name, path? (desktop), hid? (browser handle id), at }.
export function loadRecent() {
  try { return JSON.parse(safeGet(RECENT_KEY)) || []; } catch { return []; }
}

export function addRecent(item) {
  const list = [{ ...item, at: Date.now() }, ...loadRecent().filter((r) => r.key !== item.key)].slice(0, RECENT_MAX);
  safeSet(RECENT_KEY, JSON.stringify(list));
  return list;
}

export function removeRecent(key) {
  const list = loadRecent().filter((r) => r.key !== key);
  safeSet(RECENT_KEY, JSON.stringify(list));
  return list;
}
