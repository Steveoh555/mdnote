import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/markdown.css';
import './styles/print.css';

import { t, setLanguage } from './i18n.js';
import { loadSettings, saveSettings, saveDraft, loadDraft, clearDraft } from './storage.js';
import { computeStats } from './stats.js';
import { renderMarkdown, renderMermaid } from './markdown.js';
import { createEditor } from './editor.js';
import { fs, initFs } from './fs/index.js';
import { buildHtmlDocument } from './export.js';
import welcomeText from './welcome.md?raw';

const VERSION = '0.3.1';
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

function setDocument({ name, text, ref, key }) {
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

// ---------------------------------------------------------------- render
async function render(immediate = false) {
  el.preview.innerHTML = renderMarkdown(state.text);
  buildOutline();
  updateStats();
  await renderMermaid(el.preview, isDark());
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
  const status = state.dirty ? (state.draftSaved ? t('stats.draft') : t('stats.unsaved')) : t('stats.saved');
  el.stats.textContent = [
    t('stats.chars', { n: s.chars.toLocaleString() }),
    t('stats.words', { n: s.words.toLocaleString() }),
    t('stats.minutes', { n: s.minutes }),
    status,
  ].join('  ·  ');
}

// Interactive bits inside the rendered document.
el.preview.addEventListener('click', async (e) => {
  const link = e.target.closest('a[href]');
  if (link && native && /^https?:\/\//i.test(link.href)) {
    e.preventDefault();
    native.openExternal(link.href);
    return;
  }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const code = copy.parentElement.querySelector('code');
    try {
      await navigator.clipboard.writeText(code.innerText);
      copy.textContent = 'copied';
      setTimeout(() => (copy.textContent = 'copy'), 1200);
    } catch { /* clipboard blocked */ }
    return;
  }
});
el.preview.addEventListener('change', (e) => {
  const box = e.target.closest('.task-box');
  if (!box) return;
  const boxes = [...el.preview.querySelectorAll('.task-box')];
  toggleTask(boxes.indexOf(box));
});
// Allow clicking disabled-looking checkboxes: they are real inputs, so
// enable them after each render via CSS pointer events and remove "disabled".
const enableTaskBoxes = () => el.preview.querySelectorAll('.task-box').forEach((b) => (b.disabled = false));
new MutationObserver(enableTaskBoxes).observe(el.preview, { childList: true });

function toggleTask(index) {
  if (index < 0) return;
  const lines = state.text.split('\n');
  let n = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\](\s+)/.exec(lines[i]);
    if (!m) continue;
    n++;
    if (n !== index) continue;
    const checked = m[2] !== ' ';
    lines[i] = lines[i].replace(/\[( |x|X)\]/, checked ? '[ ]' : '[x]');
    const text = lines.join('\n');
    editor.setText(text);
    onEditorChange(text);
    return;
  }
}

// ---------------------------------------------------------------- file ops
function openTutorial(first) {
  if (!first && !confirmDiscard()) return;
  setDocument({ name: t('tutorialName'), text: welcomeText, ref: null, key: 'welcome' });
  state.activePath = null;
  highlightActiveFile();
  setView('split');
}

async function newDocument() {
  if (!confirmDiscard()) return;
  setDocument({ name: t('untitled'), text: '', ref: null, key: 'new' });
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
  try {
    const result = await fs.saveFile(state.ref, state.name || t('untitled'), textForDisk());
    if (!result) return;
    afterSave(result);
  } catch (e) {
    console.error(e);
    toast(t('toast.saveFailed'));
  }
}

async function saveFileAs() {
  try {
    const result = await fs.saveFileAs(state.name || t('untitled'), textForDisk());
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
  if (result.downloaded) {
    toast(t('toast.downloadFallback'));
  } else {
    toast(t('toast.saved'));
  }
  state.ref = result.ref ?? state.ref;
  if (result.name) state.name = result.name;
  if (result.key) state.key = result.key;
  state.savedText = state.text;
  state.dirty = false;
  state.draftSaved = false;
  clearDraft(state.key);
  updateFileName();
  updateStats();
}

async function openFolder() {
  try {
    const folder = await fs.openFolder();
    if (!folder) return;
    state.folder = folder;
    renderSidebar();
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
function exportHtml() {
  const title = (state.name || t('untitled')).replace(/\.(md|markdown|mdx|txt)$/i, '');
  const html = buildHtmlDocument({
    title,
    bodyHtml: el.preview.innerHTML,
    dark: isDark(),
    lang: settings.lang,
  });
  fs.download(title + '.html', html, 'text/html');
  toast(t('toast.exported'));
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
  mermaid: () => editor.insertBlock('```mermaid\nflowchart LR\n    A[시작] --> B{판단}\n    B -- 예 --> C[완료]\n    B -- 아니오 --> A\n```'),
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
  table: () => editor.insertBlock('| 제목 1 | 제목 2 | 제목 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |'),
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
  if (!file || !/\.(md|markdown|mdx|txt)$/i.test(file.name)) return;
  if (!confirmDiscard()) return;
  const item = e.dataTransfer.items?.[0];
  let ref = null;
  if (item?.getAsFileSystemHandle) {
    try {
      const handle = await item.getAsFileSystemHandle();
      if (handle?.kind === 'file') ref = { kind: 'handle', handle };
    } catch { /* not supported */ }
  }
  setDocument({ name: file.name, text: await file.text(), ref, key: 'f:' + file.name });
  state.activePath = null;
  highlightActiveFile();
  toast(t('toast.opened', { name: file.name }));
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
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), 2400);
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
  const text = sel.toString().trim();
  if (!text) return;
  let node = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const block = node?.closest('[data-line]');
  const line = block ? Number(block.dataset.line.split(',')[0]) : 0;
  syncLock++;
  editor.selectText(text, line);
  setTimeout(() => syncLock--, 60);
}
el.preview.addEventListener('mouseup', () => setTimeout(syncSelectionToEditor, 0));
el.preview.addEventListener('keyup', (e) => { if (e.shiftKey) syncSelectionToEditor(); });

// Draggable divider between editor and preview (kept between 25% and 75%).
(function initSplitter() {
  const MIN = 0.25, MAX = 0.75;
  let dragging = false;
  const apply = (ratio) => {
    settings.splitRatio = Math.min(MAX, Math.max(MIN, ratio));
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
  if (import.meta.env.DEV) window.__mdnote = { editor, syncEditorToPreview, syncPreviewToEditor, syncSelectionToEditor, lineBlocks };
  applySettings();
  if (!fs.capabilities.folders) el.sidebarNote.hidden = false;
  setView(settings.view || 'read');

  // First launch shows the welcome document; later launches restore the draft of a new doc if any.
  const draft = loadDraft('new');
  if (draft?.text) {
    setDocument({ name: t('untitled'), text: '', ref: null, key: 'new' });
  } else {
    // First launch: open the Markdown guide side-by-side so the syntax can be learned by doing.
    openTutorial(true);
  }
  const qs = new URLSearchParams(location.search);
  if (qs.get('view')) setView(qs.get('view'));
  if (qs.has('outline')) setOutlineVisible(qs.get('outline') !== '0');
  if (fs.isTauri()) await initNative();
}

// ---------------------------------------------------------------- desktop (Tauri) hooks
let native = null;
async function initNative() {
  native = await import('./fs/tauri.js');
  const openPath = async (path) => {
    if (!confirmDiscard()) return;
    try {
      setDocument(await native.openPath(path));
      state.activePath = null;
      highlightActiveFile();
      setView('read');
    } catch (e) {
      toast(String(e.message || e));
    }
  };
  native.onOpenFile(openPath);
  const launch = await native.launchFile();
  if (launch) await openPath(launch);
}

boot();
