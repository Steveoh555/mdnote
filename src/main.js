import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/markdown.css';
import './styles/print.css';

import { t, setLanguage } from './i18n.js';
import { loadSettings, saveSettings, saveDraft, loadDraft, clearDraft, loadRecent, addRecent, removeRecent } from './storage.js';
import { computeStats } from './stats.js';
import { renderMarkdown, renderMermaid } from './markdown.js';
import { createEditor } from './editor.js';
import { fs, initFs } from './fs/index.js';
import { buildHtmlDocument } from './export.js';
import welcomeText from './welcome.md?raw';

if (import.meta.env.PROD && window.top !== window.self) {
  try { window.top.location = window.location.href; } catch { document.documentElement.hidden = true; }
}

const VERSION = '0.5.0';
const MD_FILE_RE = /\.(md|markdown|mdx|txt)$/i;
const $ = (id) => document.getElementById(id);

const el = {
  app: $('app'),
  fileName: $('file-name'),
  dirtyDot: $('dirty-dot'),
  viewSwitch: $('view-switch'),
  btnSearch: $('btn-search'),
  btnSettings: $('btn-settings'),
  btnExport: $('btn-export'),
  exportMenu: $('export-menu'),
  btnSave: $('btn-save'),
  btnSaveAs: $('btn-save-as'),
  btnSaveQuick: $('btn-save-quick'),
  btnOpenFile: $('btn-open-file'),
  btnNewDoc: $('btn-new-doc'),
  setOutline: $('set-outline'),
  btnGuide: $('btn-guide'),
  fmtToolbar: $('fmt-toolbar'),
  sidebarEmpty: $('sidebar-empty'),
  sidebarNote: $('sidebar-note'),
  sidebarTree: $('sidebar-tree'),
  btnOpenFolder: $('btn-open-folder'),
  editorPane: $('editor-pane'),
  previewPane: $('preview-pane'),
  preview: $('preview'),
  draftBanner: $('draft-banner'),
  draftRestore: $('draft-restore'),
  draftDiscard: $('draft-discard'),
  extBanner: $('ext-banner'),
  extReload: $('ext-reload'),
  extIgnore: $('ext-ignore'),
  outlineList: $('outline-list'),
  stats: $('stats'),
  cursorPos: $('cursor-pos'),
  searchPanel: $('search-panel'),
  searchInput: $('search-input'),
  searchCount: $('search-count'),
  searchPrev: $('search-prev'),
  searchNext: $('search-next'),
  searchClose: $('search-close'),
  replaceInput: $('replace-input'),
  replaceOne: $('replace-one'),
  replaceAll: $('replace-all'),
  settingsDialog: $('settings-dialog'),
  setTheme: $('set-theme'),
  setLang: $('set-lang'),
  setFont: $('set-font'),
  setFontValue: $('set-font-value'),
  setEfont: $('set-efont'),
  setEfontValue: $('set-efont-value'),
  efontRange: $('efont-range'),
  efontValue: $('efont-size-value'),
  efontDec: $('efont-dec'),
  efontInc: $('efont-inc'),
  fontGroupRead: $('font-group-read'),
  fontGroupEdit: $('font-group-edit'),
  splitter: $('splitter'),
  main: $('main'),
  btnFont: $('btn-font'),
  fontMenu: $('font-menu'),
  fontRange: $('font-range'),
  fontValue: $('font-size-value'),
  fontDec: $('font-dec'),
  fontInc: $('font-inc'),
  fontReset: $('font-reset'),
  btnSideSave: $('btn-side-save'),
  btnSideSaveAs: $('btn-side-save-as'),
  setWidth: $('set-width'),
  toast: $('toast'),
  recentWrap: $('sidebar-recent'),
  recentList: $('recent-list'),
  resumeBanner: $('resume-banner'),
  resumeText: $('resume-text'),
  resumeOpen: $('resume-open'),
  resumeClose: $('resume-close'),
  zoomDialog: $('zoom-dialog'),
  zoomStage: $('zoom-stage'),
  zoomValue: $('zoom-value'),
};

const settings = loadSettings();
const state = {
  text: '',
  savedText: '',
  name: '',
  ref: null,
  key: 'new',
  dirty: false,
  draftSaved: false,
  folder: null,
  activePath: null,
  pendingDraft: null,
  eol: '\n',
  encoding: 'utf-8',
  bom: false,
  mtime: null,
  extIgnored: false,
  dir: null,
  downloaded: false,
};

let editor;
let renderTimer = null;
let draftTimer = null;
const media = window.matchMedia('(prefers-color-scheme: dark)');

// ---------------------------------------------------------------- settings
function isDark() {
  return settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
}

function applySettings() {
  document.documentElement.dataset.theme = isDark() ? 'dark' : 'light';
  document.documentElement.style.setProperty('--reading-font-size', settings.fontSize + 'px');
  document.documentElement.style.setProperty('--editor-font-size', settings.editorFontSize + 'px');
  document.documentElement.style.setProperty('--split-ratio', String(settings.splitRatio));
  document.documentElement.style.setProperty(
    '--content-width',
    { narrow: '620px', normal: '720px', wide: '960px' }[settings.width] || '720px',
  );
  setLanguage(settings.lang);
  el.preview.dataset.empty = t('preview.empty');
  el.app.dataset.outline = settings.outline ? '1' : '0';
  el.setOutline.checked = !!settings.outline;
  el.setTheme.value = settings.theme;
  el.setLang.value = settings.lang;
  el.setFont.value = settings.fontSize;
  el.setFontValue.textContent = settings.fontSize;
  el.fontRange.value = settings.fontSize;
  el.fontValue.textContent = settings.fontSize;
  el.setEfont.value = settings.editorFontSize;
  el.setEfontValue.textContent = settings.editorFontSize;
  el.efontRange.value = settings.editorFontSize;
  el.efontValue.textContent = settings.editorFontSize;
  el.setWidth.value = settings.width;
  if (!state.name || state.key === 'new') updateFileName();
  updateStats();
  $('about-version').textContent = 'v' + VERSION;
  $('about-shortcuts').textContent = t('about.shortcuts');
}

function persistSettings() {
  saveSettings(settings);
}

media.addEventListener('change', () => {
  if (settings.theme === 'system') { applySettings(); render(); }
});

// ---------------------------------------------------------------- views
function setView(view) {
  if (!['read', 'edit', 'split'].includes(view)) view = 'read';
  el.app.dataset.view = view;
  el.viewSwitch.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-selected', b.dataset.view === view ? 'true' : 'false');
  });
  settings.view = view;
  persistSettings();
  updateCursorVisibility();
  updateFileName();
  el.fontGroupRead.hidden = view === 'edit';
  el.fontGroupEdit.hidden = view === 'read';
  if (mermaidPending && view !== 'edit') setTimeout(() => renderDiagrams(), 0);
  if (view !== 'read') requestAnimationFrame(() => editor.focus());
  if (!el.searchPanel.hidden) runSearch();
}

function updateCursorVisibility() {
  if (el.app.dataset.view === 'read') el.cursorPos.textContent = '';
}

// ---------------------------------------------------------------- document
function updateFileName() {
  const name = state.name || t('untitled');
  el.fileName.textContent = name;
  document.title = `${state.dirty ? '• ' : ''}${name} – MDnote`;
  el.dirtyDot.hidden = !state.dirty;
  el.btnSaveQuick.hidden = !(state.dirty && el.app.dataset.view === 'read');
}

function setDocument({ name, text, ref, key, encoding = 'utf-8', bom = false, mtime = null, dir = null }, { remember = true } = {}) {
  state.dir = dir;
  state.downloaded = false;
  hideResume();
  state.encoding = encoding;
  state.bom = bom;
  state.mtime = mtime;
  state.extIgnored = false;
  el.extBanner.hidden = true;
  // Keep the editor on LF; remember the file's own line ending so saves round-trip unchanged.
  state.eol = /\r\n/.test(text) ? '\r\n' : '\n';
  text = text.replace(/\r\n?/g, '\n');
  state.name = name;
  state.text = text;
  state.savedText = text;
  state.ref = ref ?? null;
  state.key = key;
  state.dirty = false;
  state.draftSaved = false;
  editor.setText(text);
  updateFileName();
  render(true);
  el.previewPane.scrollTop = 0;
  checkDraft();
  if (remember) rememberDoc();
  // Delayed so it wins over the generic "opened" toast shown by callers.
  if (encoding === 'euc-kr') setTimeout(() => toast(t('enc.eucKr'), 6000), 150);
  else if (encoding === 'unknown') setTimeout(() => toast(t('enc.unknown'), 8000), 150);
}

function onEditorChange(text) {
  state.text = text;
  state.dirty = text !== state.savedText;
  state.draftSaved = false;
  updateFileName();
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => render(), 140);
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (state.dirty) {
      saveDraft(state.key, state.text);
      state.draftSaved = true;
    } else {
      clearDraft(state.key);
    }
    updateStats();
  }, 800);
}

function checkDraft() {
  const draft = loadDraft(state.key);
  if (draft && draft.text !== state.text) {
    state.pendingDraft = draft.text;
    el.draftBanner.hidden = false;
  } else {
    state.pendingDraft = null;
    el.draftBanner.hidden = true;
  }
}

function confirmDiscard() {
  return !state.dirty || window.confirm(t('confirm.discard'));
}

// ---------------------------------------------------------------- recent documents
// The document on screen is remembered so the next launch can return to it; files that
// can be reopened (desktop path, browser file handle) also go into the recent list.
function rememberDoc() {
  settings.lastKey = state.key;
  persistSettings();
  const ref = state.ref;
  if (ref?.kind === 'path') renderRecent(addRecent({ key: state.key, name: state.name, path: ref.path }));
  else if (ref?.kind === 'handle' && ref.hid) renderRecent(addRecent({ key: state.key, name: state.name, hid: ref.hid }));
  else renderRecent();
}

function renderRecent(list = loadRecent()) {
  el.recentWrap.hidden = !list.length;
  el.recentList.innerHTML = '';
  for (const item of list) {
    const b = document.createElement('button');
    b.className = 'tree-row';
    b.style.setProperty('--indent', '8px');
    b.innerHTML = ICON_FILE + '<span></span>';
    b.querySelector('span').textContent = item.name;
    b.title = item.path || item.name;
    b.classList.toggle('active', item.key === state.key);
    b.addEventListener('click', () => openRecentItem(item));
    el.recentList.appendChild(b);
  }
}

async function openRecentItem(item, { quiet = false } = {}) {
  if (!quiet && item.key !== state.key && !confirmDiscard()) return false;
  try {
    const doc = await fs.openRecent(item);
    if (!doc) return false;
    setDocument(doc);
    state.activePath = null;
    highlightActiveFile();
    return true;
  } catch (e) {
    console.warn(e);
    hideResume();
    renderRecent(removeRecent(item.key));
    if (!quiet) toast(t('recent.missing', { name: item.name }), 4000);
    return false;
  }
}

let resumeAction = null;
function showResume(text, label, action) {
  el.resumeText.textContent = text;
  el.resumeOpen.textContent = label;
  resumeAction = action;
  el.resumeBanner.hidden = false;
}
function hideResume() {
  el.resumeBanner.hidden = true;
  resumeAction = null;
}
el.resumeOpen.addEventListener('click', () => resumeAction?.());
el.resumeClose.addEventListener('click', hideResume);

function blankDocument(opts) {
  setDocument({ name: t('untitled'), text: '', ref: null, key: 'new' }, opts);
}

// Launch: first run shows the guide; later runs return to the last document.
async function restoreSession() {
  if (!settings.tutorialSeen) {
    settings.tutorialSeen = true;
    persistSettings();
    openTutorial(true);
    return;
  }
  const last = settings.lastKey;
  if (last === 'welcome') { openTutorial(true, el.app.dataset.view); return; }
  if (last && last !== 'new') {
    const item = loadRecent().find((r) => r.key === last);
    if (item) {
      if (await fs.canReopenSilently(item)) {
        if (await openRecentItem(item, { quiet: true })) return;
      } else {
        // The browser asks again for permission, which needs a click.
        blankDocument({ remember: false });
        showResume(t('resume.reopen', { name: item.name }), t('resume.open'), () => openRecentItem(item));
        return;
      }
    } else if (last.startsWith('f:') && loadDraft(last)) {
      // Opened without a handle (Firefox/Safari): the draft comes back when the same file is opened.
      const name = last.slice(2, last.lastIndexOf(':'));
      blankDocument({ remember: false });
      showResume(t('resume.draft', { name }), t('resume.openFile'), openFile);
      return;
    }
  }
  blankDocument();
}

// ---------------------------------------------------------------- render
// Relative image paths are resolved against the folder of the open file (desktop only;
// the browser has no file paths). The folder was added to the asset scope on open.
function resolveImage(src) {
  if (!native || !state.dir) return null;
  try {
    const clean = decodeURIComponent(src.replace(/[?#].*$/, ''));
    return native.assetUrl(native.resolvePath(state.dir, clean));
  } catch { return null; }
}

let mermaidPending = false;
async function renderDiagrams() {
  // Mermaid measures text while laying out; in a display:none pane every size is 0 and
  // the SVG comes out broken, so diagrams are drawn only once the preview is visible.
  if (el.previewPane.offsetParent === null) { mermaidPending = true; return; }
  mermaidPending = false;
  await renderMermaid(el.preview, isDark());
  fitDiagrams();
}

async function render(immediate = false) {
  el.preview.innerHTML = renderMarkdown(state.text, { resolveImage });
  buildOutline();
  updateStats();
  await renderDiagrams();
  if (!el.searchPanel.hidden && el.app.dataset.view === 'read') markPreview(el.searchInput.value);
  if (immediate) updateActiveHeading();
}

function buildOutline() {
  const headings = el.preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
  el.outlineList.innerHTML = '';
  if (!headings.length) {
    const p = document.createElement('div');
    p.className = 'outline__empty';
    p.textContent = t('outline.empty');
    el.outlineList.appendChild(p);
    return;
  }
  headings.forEach((h) => {
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    a.title = h.textContent;
    a.style.setProperty('--lvl', h.tagName[1]);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    el.outlineList.appendChild(a);
  });
}

function updateActiveHeading() {
  const headings = [...el.preview.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  if (!headings.length) return;
  const top = el.previewPane.getBoundingClientRect().top + 24;
  let current = headings[0];
  for (const h of headings) {
    if (h.getBoundingClientRect().top <= top) current = h;
    else break;
  }
  el.outlineList.querySelectorAll('a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
  });
}
el.previewPane.addEventListener('scroll', () => requestAnimationFrame(updateActiveHeading), { passive: true });

function updateStats() {
  const s = computeStats(state.text);
  const status = state.dirty
    ? (state.draftSaved ? t('stats.draft') : t('stats.unsaved'))
    : (state.downloaded ? t('stats.downloaded') : t('stats.saved'));
  el.stats.textContent = [
    t('stats.chars', { n: s.chars.toLocaleString() }),
    t('stats.words', { n: s.words.toLocaleString() }),
    t('stats.minutes', { n: s.minutes }),
    status,
  ].join('  ·  ');
}

// Interactive bits inside the rendered document.
el.preview.addEventListener('click', async (e) => {
  const link = e.target.closest('a');
  const href = link ? (link.getAttribute('href') || link.getAttribute('xlink:href') || '') : '';
  if (link && href.startsWith('#')) {
    e.preventDefault();
    let id = href.slice(1);
    try { id = decodeURIComponent(id); } catch { /* keep */ }
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (link && href) {
    // Never let a document navigate the app itself (SVG <a target=_self> from Mermaid, etc).
    e.preventDefault();
    if (/^https?:\/\//i.test(href)) {
      if (native) native.openExternal(href);
      else window.open(href, '_blank', 'noopener,noreferrer');
    }
    return;
  }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const code = copy.parentElement.querySelector('code');
    try {
      await navigator.clipboard.writeText(code.innerText);
      copy.textContent = t('code.copied');
      setTimeout(() => (copy.textContent = t('code.copy')), 1200);
    } catch { /* clipboard blocked */ }
    return;
  }
  const zoomBtn = e.target.closest('[data-zoom]') || e.target.closest('pre.mermaid svg');
  if (zoomBtn) {
    const svg = zoomBtn.closest('pre.mermaid')?.querySelector('svg');
    if (svg) openZoom(svg);
  }
});
el.preview.addEventListener('change', (e) => {
  const box = e.target.closest('.task-box');
  if (!box) return;
  const item = box.closest('li[data-line]');
  if (!item) return;
  const [start, end] = item.dataset.line.split(',').map(Number);
  toggleTaskAtLines(start, end);
});
// Allow clicking disabled-looking checkboxes: they are real inputs, so
// enable them after each render via CSS pointer events and remove "disabled".
const enableTaskBoxes = () => el.preview.querySelectorAll('.task-box').forEach((b) => (b.disabled = false));
new MutationObserver(enableTaskBoxes).observe(el.preview, { childList: true });

// Toggle the task marker of the list item whose source lines are [start, end).
// The item's own "- [ ]" line is the first matching line in that range; nested
// items and fenced code inside the item come later, so they are never touched.
function toggleTaskAtLines(start, end) {
  const lines = state.text.split('\n');
  for (let i = start; i < Math.min(end, lines.length); i++) {
    const m = /^((?:\s*>)*\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\](\s+|$)/.exec(lines[i]);
    if (!m) continue;
    const checked = m[2] !== ' ';
    lines[i] = lines[i].replace(/\[( |x|X)\]/, checked ? '[ ]' : '[x]');
    const text = lines.join('\n');
    editor.setText(text);
    onEditorChange(text);
    return;
  }
}

// ---------------------------------------------------------------- file ops
function openTutorial(first, view = 'split') {
  if (!first && !confirmDiscard()) return;
  setDocument({ name: t('tutorialName'), text: welcomeText, ref: null, key: 'welcome' });
  state.activePath = null;
  highlightActiveFile();
  setView(view);
}

async function newDocument() {
  if (!confirmDiscard()) return;
  blankDocument();
  state.activePath = null;
  highlightActiveFile();
  if (el.app.dataset.view === 'read') setView('edit');
}

async function openFile() {
  if (!confirmDiscard()) return;
  try {
    const doc = await fs.openFile();
    if (!doc) return;
    setDocument(doc);
    state.activePath = null;
    highlightActiveFile();
    toast(t('toast.opened', { name: doc.name }));
  } catch (e) {
    console.error(e);
    toast(String(e.message || e));
  }
}

async function saveFile() {
  if (!state.dirty && state.encoding === 'utf-8' && (state.ref || state.downloaded)) {
    toast(t('toast.noChanges'));
    return;
  }
  if (state.encoding === 'unknown' && state.ref) {
    toast(t('enc.blocked'), 5000);
    return saveFileAs();
  }
  try {
    if (state.ref && !state.extIgnored) {
      const now = await fs.mtime(state.ref);
      if (now != null && state.mtime != null && now !== state.mtime && !window.confirm(t('ext.confirmOverwrite'))) return;
    }
    const result = await fs.saveFile(state.ref, state.name || t('untitled'), textForDisk(), { bom: state.bom });
    if (!result) return;
    afterSave(result);
  } catch (e) {
    console.error(e);
    toast(t('toast.saveFailed'));
  }
}

async function saveFileAs() {
  try {
    const result = await fs.saveFileAs(state.name || t('untitled'), textForDisk(), { bom: state.bom });
    if (!result) return;
    afterSave(result);
  } catch (e) {
    console.error(e);
    toast(t('toast.saveFailed'));
  }
}

function textForDisk() {
  return state.eol === '\r\n' ? state.text.replace(/\n/g, '\r\n') : state.text;
}

function afterSave(result) {
  const oldKey = state.key;
  state.downloaded = !!result.downloaded;
  if (result.downloaded) toast(t('toast.downloaded', { name: result.name || state.name }), 6000);
  else toast(t('toast.saved'));
  state.ref = result.ref ?? state.ref;
  if (result.name) state.name = result.name;
  if (result.key) state.key = result.key;
  if (result.mtime != null) state.mtime = result.mtime;
  if (result.ref || result.key) state.encoding = 'utf-8';
  state.extIgnored = false;
  el.extBanner.hidden = true;
  state.savedText = state.text;
  state.dirty = false;
  state.draftSaved = false;
  // "Save as" moves the document to a new key; the draft under the old key is done with too.
  clearDraft(oldKey);
  clearDraft(state.key);
  if (!result.downloaded) rememberDoc();
  updateFileName();
  updateStats();
}

async function openFolder() {
  try {
    const folder = await fs.openFolder();
    if (!folder) return;
    state.folder = folder;
    renderSidebar();
    if (folder.root) settings.lastFolder = folder.root; // desktop: reopened on the next launch
    persistSettings();
    toast(t('toast.folderOpened', { name: folder.name }));
  } catch (e) {
    console.error(e);
    toast(String(e.message || e));
  }
}

async function openEntry(entry) {
  if (!confirmDiscard()) return;
  try {
    const doc = await fs.readEntry(entry);
    setDocument(doc);
    state.activePath = entry.path;
    highlightActiveFile();
    if (el.app.dataset.view !== 'read') setView('read');
  } catch (e) {
    console.error(e);
    toast(String(e.message || e));
  }
}

// ---------------------------------------------------------------- sidebar
const ICON_FILE = '<svg viewBox="0 0 20 20"><path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z"/><path d="M11.5 2.5v4h4"/></svg>';
const ICON_DIR = '<svg viewBox="0 0 20 20"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h4l2 2h6a1.5 1.5 0 0 1 1.5 1.5V15A1.5 1.5 0 0 1 16 16.5H4A1.5 1.5 0 0 1 2.5 15z"/></svg>';
const ICON_CHEV = '<svg class="chev" viewBox="0 0 20 20"><path d="M6 8l4 4 4-4"/></svg>';

function renderSidebar() {
  const folder = state.folder;
  if (!folder) {
    el.sidebarEmpty.hidden = false;
    el.sidebarTree.hidden = true;
    return;
  }
  el.sidebarEmpty.hidden = true;
  el.sidebarTree.hidden = false;
  el.sidebarTree.innerHTML = '';
  const root = { type: 'dir', name: folder.name, path: folder.name, children: folder.tree };
  el.sidebarTree.appendChild(buildTreeNode(root, 0, true));
  if (!folder.tree.length) {
    const p = document.createElement('p');
    p.className = 'sidebar__empty';
    p.textContent = t('sidebar.noFiles');
    el.sidebarTree.appendChild(p);
  }
}

function buildTreeNode(node, depth, isRoot = false) {
  if (node.type === 'file') {
    const b = document.createElement('button');
    b.className = 'tree-row';
    b.style.setProperty('--indent', `${8 + depth * 14}px`);
    b.dataset.path = node.path;
    b.innerHTML = ICON_FILE + '<span></span>';
    b.querySelector('span').textContent = node.name;
    b.title = node.name;
    b.addEventListener('click', () => openEntry(node));
    return b;
  }
  const wrap = document.createElement('div');
  wrap.className = 'tree-dir';
  const row = document.createElement('button');
  row.className = 'tree-row tree-row--dir';
  row.style.setProperty('--indent', `${8 + depth * 14}px`);
  row.innerHTML = ICON_CHEV + ICON_DIR + '<span></span>';
  row.querySelector('span').textContent = node.name;
  row.addEventListener('click', () => wrap.classList.toggle('collapsed'));
  wrap.appendChild(row);
  const children = document.createElement('div');
  children.className = 'tree-children';
  node.children.forEach((c) => children.appendChild(buildTreeNode(c, depth + 1)));
  wrap.appendChild(children);
  if (!isRoot && depth > 0) wrap.classList.add('collapsed');
  return wrap;
}

function highlightActiveFile() {
  el.sidebarTree.querySelectorAll('.tree-row').forEach((r) => {
    r.classList.toggle('active', !!state.activePath && r.dataset.path === state.activePath);
  });
}

function setOutlineVisible(on) {
  settings.outline = !!on;
  el.app.dataset.outline = settings.outline ? '1' : '0';
  el.setOutline.checked = settings.outline;
  persistSettings();
}
function toggleOutline() { setOutlineVisible(!settings.outline); }

// ---------------------------------------------------------------- search
let previewMarks = [];
let previewMarkIndex = -1;

function openSearch() {
  el.searchPanel.hidden = false;
  el.btnSearch.classList.add('active');
  el.searchInput.focus();
  el.searchInput.select();
  runSearch();
}

function closeSearch() {
  el.searchPanel.hidden = true;
  el.btnSearch.classList.remove('active');
  unmarkPreview();
  editor.setQuery('');
  if (el.app.dataset.view !== 'read') editor.focus();
}

function runSearch() {
  const term = el.searchInput.value;
  if (el.app.dataset.view === 'read') {
    editor.setQuery('');
    const n = markPreview(term);
    if (n) gotoPreviewMatch(0);
    el.searchCount.textContent = term ? `${n ? previewMarkIndex + 1 : 0}/${n}` : '';
  } else {
    unmarkPreview();
    const n = editor.setQuery(term, el.replaceInput.value);
    el.searchCount.textContent = term ? String(n) : '';
    if (term && n) editor.findNext();
  }
}

function searchNext(backwards = false) {
  if (el.app.dataset.view === 'read') {
    if (!previewMarks.length) return;
    gotoPreviewMatch((previewMarkIndex + (backwards ? -1 : 1) + previewMarks.length) % previewMarks.length);
    el.searchCount.textContent = `${previewMarkIndex + 1}/${previewMarks.length}`;
  } else {
    backwards ? editor.findPrev() : editor.findNext();
  }
}

function markPreview(term) {
  unmarkPreview();
  if (!term) return 0;
  const needle = term.toLowerCase();
  const walker = document.createTreeWalker(el.preview, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('svg, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(needle);
    if (idx === -1) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (idx !== -1) {
      frag.appendChild(document.createTextNode(text.slice(last, idx)));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(idx, idx + term.length);
      frag.appendChild(mark);
      previewMarks.push(mark);
      last = idx + term.length;
      idx = lower.indexOf(needle, last);
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  return previewMarks.length;
}

function unmarkPreview() {
  for (const mark of previewMarks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  }
  previewMarks = [];
  previewMarkIndex = -1;
}

function gotoPreviewMatch(i) {
  previewMarks.forEach((m) => m.classList.remove('active'));
  previewMarkIndex = i;
  const m = previewMarks[i];
  if (!m) return;
  m.classList.add('active');
  m.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ---------------------------------------------------------------- export
async function exportHtml() {
  const title = (state.name || t('untitled')).replace(MD_FILE_RE, '');
  // Leave out on-screen helpers: zoom buttons and search highlights.
  const body = el.preview.cloneNode(true);
  body.querySelectorAll('.zoom-btn').forEach((n) => n.remove());
  body.querySelectorAll('mark').forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
  const html = buildHtmlDocument({
    title,
    bodyHtml: body.innerHTML,
    dark: isDark(),
    lang: settings.lang,
  });
  const saved = await fs.download(title + '.html', html, 'text/html');
  if (saved === false) return;
  toast(fs.isTauri() ? t('toast.exported') : t('toast.exportedDownload', { name: title + '.html' }), 5000);
}

function exportPdf() {
  window.print();
}

// ---------------------------------------------------------------- export dropdown / dialogs
function toggleMenu(force) {
  const show = force ?? el.exportMenu.hidden;
  el.exportMenu.hidden = !show;
  el.btnExport.classList.toggle('active', show);
}

el.exportMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-action]');
  if (!item) return;
  toggleMenu(false);
  ({ exportHtml, exportPdf })[item.dataset.action]?.();
});

document.addEventListener('click', (e) => {
  if (!el.exportMenu.hidden && !el.exportMenu.contains(e.target) && !el.btnExport.contains(e.target)) toggleMenu(false);
});

el.setOutline.addEventListener('change', () => setOutlineVisible(el.setOutline.checked));
el.btnGuide.addEventListener('click', () => { el.settingsDialog.close(); openTutorial(false); });

el.setTheme.addEventListener('change', () => { settings.theme = el.setTheme.value; persistSettings(); applySettings(); render(); });
el.setLang.addEventListener('change', () => { settings.lang = el.setLang.value; persistSettings(); applySettings(); render(); });
const FONT_MIN = 12, FONT_MAX = 30, FONT_DEFAULT = 16;
function setFontSize(px) {
  const n = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number(px) || FONT_DEFAULT)));
  settings.fontSize = String(n);
  persistSettings();
  applySettings();
}
el.setFont.addEventListener('input', () => setFontSize(el.setFont.value));
el.fontRange.addEventListener('input', () => setFontSize(el.fontRange.value));
el.fontDec.addEventListener('click', () => setFontSize(Number(settings.fontSize) - 1));
el.fontInc.addEventListener('click', () => setFontSize(Number(settings.fontSize) + 1));
const EFONT_MIN = 10, EFONT_DEFAULT = 14;
function setEditorFontSize(px) {
  const n = Math.min(FONT_MAX, Math.max(EFONT_MIN, Math.round(Number(px) || EFONT_DEFAULT)));
  settings.editorFontSize = String(n);
  persistSettings();
  applySettings();
}
el.setEfont.addEventListener('input', () => setEditorFontSize(el.setEfont.value));
el.efontRange.addEventListener('input', () => setEditorFontSize(el.efontRange.value));
el.efontDec.addEventListener('click', () => setEditorFontSize(Number(settings.editorFontSize) - 1));
el.efontInc.addEventListener('click', () => setEditorFontSize(Number(settings.editorFontSize) + 1));
el.fontReset.addEventListener('click', () => { setFontSize(FONT_DEFAULT); setEditorFontSize(EFONT_DEFAULT); });
// Ctrl+= / Ctrl+- act on the pane that matches the current view (editor in edit mode, reading otherwise).
function bumpFont(delta) {
  if (el.app.dataset.view === 'edit') setEditorFontSize(Number(settings.editorFontSize) + delta);
  else setFontSize(Number(settings.fontSize) + delta);
}

function toggleFontMenu(force) {
  const show = force ?? el.fontMenu.hidden;
  el.fontMenu.hidden = !show;
  el.btnFont.classList.toggle('active', show);
  if (show) toggleMenu(false);
}
el.btnFont.addEventListener('click', () => toggleFontMenu());
document.addEventListener('click', (e) => {
  if (!el.fontMenu.hidden && !el.fontMenu.contains(e.target) && !el.btnFont.contains(e.target)) toggleFontMenu(false);
});
el.setWidth.addEventListener('change', () => { settings.width = el.setWidth.value; persistSettings(); applySettings(); });

// ---------------------------------------------------------------- formatting
const FORMAT_ACTIONS = {
  undo: () => editor.undo(),
  redo: () => editor.redo(),
  bold: () => editor.wrap('**', '**', 'text'),
  italic: () => editor.wrap('*', '*', 'text'),
  strike: () => editor.wrap('~~', '~~', 'text'),
  hr: () => editor.insertBlock('---'),
  mermaid: () => editor.insertBlock(t('tpl.mermaid')),
  code: () => editor.wrap('`', '`', 'code'),
  link: () => editor.wrap('[', '](https://)', 'text'),
  image: () => editor.wrap('![', '](image.png)', 'alt'),
  h1: () => editor.prefixLines(() => '# '),
  h2: () => editor.prefixLines(() => '## '),
  h3: () => editor.prefixLines(() => '### '),
  ul: () => editor.prefixLines(() => '- '),
  ol: () => editor.prefixLines((i) => `${i + 1}. `),
  task: () => editor.prefixLines(() => '- [ ] '),
  quote: () => editor.prefixLines(() => '> '),
  codeblock: () => editor.insertBlock('```\n\n```'),
  table: () => {
    const h = t('tpl.col');
    editor.insertBlock(`| ${h} 1 | ${h} 2 | ${h} 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |`);
  },
};

el.fmtToolbar.addEventListener('mousedown', (e) => { if (e.target.closest('.fmt-btn')) e.preventDefault(); }); // keep editor focus
el.fmtToolbar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fmt]');
  if (b) FORMAT_ACTIONS[b.dataset.fmt]?.();
});

// ---------------------------------------------------------------- keyboard
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (!el.searchPanel.hidden) { closeSearch(); e.preventDefault(); }
    if (!el.exportMenu.hidden) toggleMenu(false);
    if (!el.fontMenu.hidden) toggleFontMenu(false);
    return;
  }
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (el.zoomDialog.open) {
    const z = { '=': 1.25, '+': 1.25, '-': 0.8 }[k];
    if (z) { e.preventDefault(); setZoom(zoom.scale * z); } else if (k === '0') { e.preventDefault(); fitZoom(); }
    return;
  }
  const inEditor = el.app.dataset.view !== 'read';
  const map = {
    o: openFile,
    s: e.shiftKey ? saveFileAs : saveFile,
    n: newDocument,
    f: openSearch,
    p: exportPdf,
    '=': () => bumpFont(1),
    '+': () => bumpFont(1),
    '-': () => bumpFont(-1),
    0: () => { setFontSize(FONT_DEFAULT); setEditorFontSize(EFONT_DEFAULT); },
    1: () => setView('read'),
    2: () => setView('edit'),
    3: () => setView('split'),
    b: inEditor ? FORMAT_ACTIONS.bold : null,
    i: inEditor ? FORMAT_ACTIONS.italic : null,
    k: inEditor ? FORMAT_ACTIONS.link : null,
  };
  const fn = map[k];
  if (fn) { e.preventDefault(); fn(); }
});

el.searchInput.addEventListener('input', runSearch);
el.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); searchNext(e.shiftKey); }
});
el.replaceInput.addEventListener('input', () => editor.setQuery(el.searchInput.value, el.replaceInput.value));
el.replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); editor.replaceOne(); runSearch(); }
});
el.searchNext.addEventListener('click', () => searchNext(false));
el.searchPrev.addEventListener('click', () => searchNext(true));
el.searchClose.addEventListener('click', closeSearch);
el.replaceOne.addEventListener('click', () => { editor.replaceOne(); runSearch(); });
el.replaceAll.addEventListener('click', () => { editor.replaceAll(); runSearch(); });

el.btnSearch.addEventListener('click', () => (el.searchPanel.hidden ? openSearch() : closeSearch()));
el.btnSettings.addEventListener('click', () => el.settingsDialog.showModal());
el.btnExport.addEventListener('click', () => toggleMenu());
el.btnSave.addEventListener('click', saveFile);
el.btnSaveAs.addEventListener('click', saveFileAs);
el.btnSaveQuick.addEventListener('click', saveFile);
el.btnOpenFile.addEventListener('click', openFile);
el.btnNewDoc.addEventListener('click', newDocument);
el.btnSideSave.addEventListener('click', saveFile);
el.btnSideSaveAs.addEventListener('click', saveFileAs);
el.btnOpenFolder.addEventListener('click', openFolder);
el.viewSwitch.addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (b) setView(b.dataset.view);
});
el.draftRestore.addEventListener('click', () => {
  if (state.pendingDraft == null) return;
  editor.setText(state.pendingDraft);
  onEditorChange(state.pendingDraft);
  state.pendingDraft = null;
  el.draftBanner.hidden = true;
  if (el.app.dataset.view === 'read') setView('edit');
});
el.draftDiscard.addEventListener('click', () => {
  clearDraft(state.key);
  state.pendingDraft = null;
  el.draftBanner.hidden = true;
});

// Drag & drop a file onto the window.
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; el.app.classList.add('dragging'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; el.app.classList.remove('dragging'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  el.app.classList.remove('dragging');
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (!MD_FILE_RE.test(file.name)) { toast(t('drop.notMd')); return; }
  // Ask for the handle before anything else: drop data is only readable during the event.
  const item = e.dataTransfer.items?.[0];
  const pending = item?.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
  if (!confirmDiscard()) return;
  try {
    const handle = await pending;
    const doc = await fs.docFromDrop(file, handle?.kind === 'file' ? handle : null);
    if (!doc.ref) doc.mtime = null;
    setDocument(doc);
    state.activePath = null;
    highlightActiveFile();
    toast(t('toast.opened', { name: file.name }));
  } catch (err) {
    console.error(err);
    toast(String(err.message || err));
  }
});

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) {
    saveDraft(state.key, state.text);
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------------------------------------------------------- toast
let toastTimer = null;
function toast(msg, ms = 2400) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), ms);
}

// ---------------------------------------------------------------- split view: scroll + selection sync
let syncLock = 0;
const isSplit = () => el.app.dataset.view === 'split';

function lineBlocks() {
  return [...el.preview.querySelectorAll('[data-line]')].map((n) => {
    const [a, b] = n.dataset.line.split(',').map(Number);
    return { el: n, start: a, end: b };
  });
}

// Preview scrolled -> move the editor to the same source line.
function syncEditorToPreview() {
  if (!isSplit() || syncLock) return;
  const blocks = lineBlocks();
  if (!blocks.length) return;
  const paneTop = el.previewPane.getBoundingClientRect().top;
  let current = blocks[0];
  for (const b of blocks) {
    const r = b.el.getBoundingClientRect();
    if (r.top - paneTop <= 1) current = b; else break;
  }
  const r = current.el.getBoundingClientRect();
  const frac = r.height > 0 ? Math.min(1, Math.max(0, (paneTop - r.top) / r.height)) : 0;
  const span = Math.max(1, current.end - current.start);
  syncLock++;
  editor.scrollToLine(current.start + Math.floor(frac * span), (frac * span) % 1);
  setTimeout(() => syncLock--, 60);
}

// Editor scrolled -> move the preview to the block containing that source line.
function syncPreviewToEditor() {
  if (!isSplit() || syncLock) return;
  const { line, frac } = editor.topLine();
  const blocks = lineBlocks();
  if (!blocks.length) return;
  let target = blocks[0];
  for (const b of blocks) { if (b.start <= line) target = b; else break; }
  const span = Math.max(1, target.end - target.start);
  const within = Math.min(1, Math.max(0, (line - target.start + frac) / span));
  const paneRect = el.previewPane.getBoundingClientRect();
  const r = target.el.getBoundingClientRect();
  syncLock++;
  el.previewPane.scrollTop += (r.top - paneRect.top) + r.height * within;
  setTimeout(() => syncLock--, 60);
}

el.previewPane.addEventListener('scroll', syncEditorToPreview, { passive: true });

// Selecting text in the preview selects the same text in the editor.
function syncSelectionToEditor() {
  if (!isSplit()) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) { editor.clearSynced(); return; }
  const range = sel.getRangeAt(0);
  if (!el.preview.contains(range.commonAncestorContainer)) return;
  // Text as rendered, minus on-screen helpers that have no source (copy buttons, labels).
  const frag = range.cloneContents();
  frag.querySelectorAll('.code__copy, .code__lang, .zoom-btn, summary').forEach((n) => n.remove());
  const text = frag.textContent.trim();
  if (!text) return;
  const blockOf = (n) => (n.nodeType === 1 ? n : n.parentElement)?.closest('[data-line]');
  const startBlock = blockOf(range.startContainer);
  const endBlock = blockOf(range.endContainer);
  const line = startBlock ? Number(startBlock.dataset.line.split(',')[0]) : 0;
  const endLine = endBlock ? Number(endBlock.dataset.line.split(',')[1]) : null;
  syncLock++;
  editor.selectText(text, line, endLine);
  setTimeout(() => syncLock--, 60);
}
el.preview.addEventListener('mouseup', () => setTimeout(syncSelectionToEditor, 0));
el.preview.addEventListener('keyup', (e) => { if (e.shiftKey) syncSelectionToEditor(); });

// Draggable divider between editor and preview (kept between 25% and 75%).
(function initSplitter() {
  const MIN = 0.25, MAX = 0.75, MIN_PX = 280;
  let dragging = false;
  const apply = (ratio) => {
    // Neither side may get narrower than MIN_PX (the CSS clamps the same way on resize).
    const w = el.main.getBoundingClientRect().width || 1;
    const lo = Math.max(MIN, MIN_PX / w), hi = Math.min(MAX, 1 - MIN_PX / w);
    settings.splitRatio = lo > hi ? 0.5 : Math.min(hi, Math.max(lo, ratio));
    document.documentElement.style.setProperty('--split-ratio', String(settings.splitRatio));
  };
  el.splitter.addEventListener('pointerdown', (e) => {
    dragging = true;
    try { el.splitter.setPointerCapture(e.pointerId); } catch { /* synthetic event */ }
    el.app.classList.add('resizing');
    e.preventDefault();
  });
  el.splitter.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const r = el.main.getBoundingClientRect();
    apply((e.clientX - r.left) / r.width);
  });
  const stop = (e) => {
    if (!dragging) return;
    dragging = false;
    try { el.splitter.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    el.app.classList.remove('resizing');
    persistSettings();
  };
  el.splitter.addEventListener('pointerup', stop);
  el.splitter.addEventListener('pointercancel', stop);
  el.splitter.addEventListener('dblclick', () => { apply(0.5); persistSettings(); });
})();

// ---------------------------------------------------------------- external changes
let extChecking = false;
async function checkExternalChange() {
  if (extChecking || !state.ref || state.mtime == null || state.extIgnored) return;
  extChecking = true;
  try {
    const now = await fs.mtime(state.ref);
    if (now == null || now === state.mtime) return;
    if (!state.dirty) {
      await reloadFromDisk();
    } else {
      el.extBanner.hidden = false;
    }
  } catch { /* file may be gone; leave as is */ } finally { extChecking = false; }
}

async function reloadFromDisk() {
  const doc = await fs.reread(state.ref, state.key);
  if (!doc) return;
  const scroll = el.previewPane.scrollTop;
  const view = el.app.dataset.view;
  setDocument({ ...doc, name: doc.name || state.name, key: state.key });
  el.previewPane.scrollTop = scroll;
  if (view !== 'read') editor.focus();
  toast(t('ext.reloaded'));
}

el.extReload.addEventListener('click', () => { el.extBanner.hidden = true; reloadFromDisk(); });
el.extIgnore.addEventListener('click', async () => {
  el.extBanner.hidden = true;
  state.extIgnored = true; // keep editing; the next save overwrites without asking again
  state.mtime = await fs.mtime(state.ref);
});
window.addEventListener('focus', checkExternalChange);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExternalChange(); });
setInterval(checkExternalChange, 3000);

// ---------------------------------------------------------------- boot
async function boot() {
  await initFs();
  editor = createEditor(el.editorPane, {
    doc: '',
    onChange: onEditorChange,
    onCursor: (l, c) => {
      if (el.app.dataset.view !== 'read') el.cursorPos.textContent = t('stats.pos', { l, c });
    },
  });
  editor.onScroll(syncPreviewToEditor);
  if (import.meta.env.DEV) window.__mdnote = { editor, syncEditorToPreview, syncPreviewToEditor, syncSelectionToEditor, lineBlocks, renderDiagrams, pending: () => mermaidPending, setDocument, state, openZoom };
  applySettings();
  if (!fs.capabilities.folders) el.sidebarNote.hidden = false;
  setView(settings.view || 'read');
  renderRecent();

  // A file passed on launch (desktop double-click) wins; otherwise return to the last document.
  const launched = fs.isTauri() ? await initNative() : false;
  if (launched) {
    // Someone who starts by opening a file already knows what they want; the guide stays in Settings.
    settings.tutorialSeen = true;
    persistSettings();
  } else {
    await restoreSession();
  }
  const qs = new URLSearchParams(location.search);
  if (qs.get('view')) setView(qs.get('view'));
  if (qs.has('outline')) setOutlineVisible(qs.get('outline') !== '0');
}

// ---------------------------------------------------------------- desktop (Tauri) hooks
let native = null;
async function initNative() {
  native = await import('./fs/tauri.js');
  const openPath = async (path, view = 'read') => {
    if (!confirmDiscard()) return false;
    try {
      setDocument(await native.openPath(path));
      state.activePath = null;
      highlightActiveFile();
      if (view) setView(view);
      return true;
    } catch (e) {
      toast(String(e.message || e));
      return false;
    }
  };
  native.onOpenFile(openPath);
  native.onDrop({
    enter: () => el.app.classList.add('dragging'),
    leave: () => el.app.classList.remove('dragging'),
    drop: async (paths) => {
      el.app.classList.remove('dragging');
      const path = paths.find((p) => MD_FILE_RE.test(p));
      if (!path) { if (paths.length) toast(t('drop.notMd')); return; }
      const name = path.split(/[\\/]/).pop();
      if (await openPath(path, null)) toast(t('toast.opened', { name }));
    },
  });
  if (settings.lastFolder) {
    try {
      state.folder = await native.openFolderPath(settings.lastFolder);
      renderSidebar();
    } catch {
      settings.lastFolder = null;
      persistSettings();
    }
  }
  const launch = await native.launchFile();
  return launch ? openPath(launch) : false;
}

// ---------------------------------------------------------------- diagram zoom
const zoom = { svg: null, w: 0, h: 0, scale: 1 };

// Wide diagrams shrink to the text column; below READABLE of their natural size they keep
// that size instead and scroll sideways, so labels never drop to unreadable pixel sizes.
const READABLE = 0.7;
function fitDiagrams() {
  el.preview.querySelectorAll('pre.mermaid').forEach((pre) => {
    const svg = pre.querySelector('svg');
    if (!svg) return;
    const vb = svg.viewBox?.baseVal;
    if (vb?.width && vb.width * READABLE > pre.clientWidth) {
      svg.style.maxWidth = 'none';
      svg.style.width = Math.round(vb.width * READABLE) + 'px';
    }
    if (!pre.querySelector('.zoom-btn')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'zoom-btn';
      b.dataset.zoom = '';
      b.title = t('zoom.open');
      b.setAttribute('aria-label', t('zoom.open'));
      b.innerHTML = '<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4.5 4.5M6 8.5h5M8.5 6v5"/></svg>';
      pre.appendChild(b);
    }
  });
}

function openZoom(svg) {
  const vb = svg.viewBox?.baseVal;
  const r = svg.getBoundingClientRect();
  zoom.w = vb?.width || r.width;
  zoom.h = vb?.height || r.height;
  const clone = svg.cloneNode(true);
  clone.removeAttribute('style');
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  zoom.svg = clone;
  el.zoomStage.replaceChildren(clone);
  el.zoomDialog.showModal();
  fitZoom();
}

function setZoom(scale) {
  if (!zoom.svg) return;
  zoom.scale = Math.min(4, Math.max(0.2, scale));
  zoom.svg.style.width = Math.round(zoom.w * zoom.scale) + 'px';
  zoom.svg.style.height = Math.round(zoom.h * zoom.scale) + 'px';
  el.zoomValue.textContent = Math.round(zoom.scale * 100) + '%';
}

function fitZoom() {
  const r = el.zoomStage.getBoundingClientRect();
  setZoom(Math.min((r.width - 48) / zoom.w, (r.height - 48) / zoom.h, 2));
}

$('zoom-in').addEventListener('click', () => setZoom(zoom.scale * 1.25));
$('zoom-out').addEventListener('click', () => setZoom(zoom.scale * 0.8));
$('zoom-fit').addEventListener('click', fitZoom);
$('zoom-close').addEventListener('click', () => el.zoomDialog.close());
el.zoomDialog.addEventListener('click', (e) => { if (e.target === el.zoomDialog) el.zoomDialog.close(); });
el.zoomDialog.addEventListener('close', () => { el.zoomStage.replaceChildren(); zoom.svg = null; });
el.zoomStage.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(zoom.scale * (e.deltaY < 0 ? 1.1 : 0.9));
}, { passive: false });
(function initPan() {
  let start = null;
  el.zoomStage.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, left: el.zoomStage.scrollLeft, top: el.zoomStage.scrollTop };
    el.zoomStage.classList.add('panning');
    try { el.zoomStage.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  });
  el.zoomStage.addEventListener('pointermove', (e) => {
    if (!start) return;
    el.zoomStage.scrollLeft = start.left - (e.clientX - start.x);
    el.zoomStage.scrollTop = start.top - (e.clientY - start.y);
  });
  const end = () => { start = null; el.zoomStage.classList.remove('panning'); };
  el.zoomStage.addEventListener('pointerup', end);
  el.zoomStage.addEventListener('pointercancel', end);
})();

boot();
