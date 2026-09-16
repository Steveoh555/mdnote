const SETTINGS_KEY = 'mdnote.settings';
const DRAFT_PREFIX = 'mdnote.draft:';

const defaults = {
  theme: 'system',
  lang: navigator.language?.startsWith('ko') ? 'ko' : 'en',
  fontSize: '16',
  width: 'normal',
  view: 'read',
  outline: true,
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
  try { return { ...defaults, ...JSON.parse(raw) }; } catch { return { ...defaults }; }
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
