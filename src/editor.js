import { EditorState } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  search, SearchQuery, setSearchQuery, findNext, findPrevious, replaceNext, replaceAll,
} from '@codemirror/search';

const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-h cm-h1' },
  { tag: tags.heading2, class: 'cm-h cm-h2' },
  { tag: tags.heading3, class: 'cm-h cm-h3' },
  { tag: tags.heading4, class: 'cm-h' },
  { tag: tags.heading5, class: 'cm-h' },
  { tag: tags.heading6, class: 'cm-h' },
  { tag: tags.strong, class: 'cm-strong' },
  { tag: tags.emphasis, class: 'cm-em' },
  { tag: tags.strikethrough, class: 'cm-strike' },
  { tag: tags.link, class: 'cm-link' },
  { tag: tags.url, class: 'cm-url' },
  { tag: tags.monospace, class: 'cm-code' },
  { tag: tags.processingInstruction, class: 'cm-mark' },
  { tag: tags.quote, class: 'cm-quote' },
  { tag: tags.list, class: 'cm-list' },
  { tag: tags.contentSeparator, class: 'cm-hr' },
  { tag: tags.labelName, class: 'cm-code-lang' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: 'var(--editor-font-size)' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.7',
    padding: '20px 0 40vh',
  },
  '.cm-content': { padding: '0 28px 0 12px', caretColor: 'var(--accent)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--text-faint)',
    border: 'none',
    paddingLeft: '10px',
  },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '34px' },
  '.cm-activeLine': { backgroundColor: 'var(--line-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection) !important',
  },
  '.cm-searchMatch': { backgroundColor: 'var(--match)', outline: '1px solid var(--match-ring)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--match-active)' },
  '.cm-panels': { display: 'none' }, // we draw our own search panel
});

export function createEditor(parent, { doc, onChange, onCursor }) {
  const state = EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      indentUnit.of('  '),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(mdHighlight),
      editorTheme,
      search({ top: true }),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange(u.state.doc.toString());
        if (u.selectionSet || u.docChanged) {
          const pos = u.state.selection.main.head;
          const line = u.state.doc.lineAt(pos);
          onCursor(line.number, pos - line.from + 1);
        }
      }),
    ],
  });

  const view = new EditorView({ state, parent });

  const api = {
    view,
    setText(text) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
      });
      view.scrollDOM.scrollTop = 0;
    },
    focus: () => view.focus(),
    undo: () => { undo(view); view.focus(); },
    redo: () => { redo(view); view.focus(); },

    // --- formatting helpers ---------------------------------------------
    wrap(before, after = before, placeholder = '') {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to) || placeholder;
      const insert = before + selected + after;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + before.length, head: from + before.length + selected.length },
      });
      view.focus();
    },
    prefixLines(makePrefix) {
      const { from, to } = view.state.selection.main;
      const startLine = view.state.doc.lineAt(from);
      const endLine = view.state.doc.lineAt(to);
      const changes = [];
      let idx = 0;
      for (let n = startLine.number; n <= endLine.number; n++) {
        const line = view.state.doc.line(n);
        const prefix = makePrefix(idx++, line.text);
        if (prefix === null) continue;
        // Toggle: remove if already present.
        if (line.text.startsWith(prefix)) {
          changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
        } else {
          const stripped = line.text.replace(/^(#{1,6}\s|[-*+]\s\[[ xX]\]\s|[-*+]\s|\d+\.\s|>\s)/, '');
          changes.push({ from: line.from, to: line.to, insert: prefix + stripped });
        }
      }
      view.dispatch({ changes });
      view.focus();
    },
    insertBlock(text) {
      const { from, to } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      const needsNewline = line.text.trim().length > 0;
      const insert = (needsNewline ? '\n\n' : '') + text + '\n';
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } });
      view.focus();
    },

    // --- search bridge ----------------------------------------------------
    setQuery(term, replace = '') {
      const q = new SearchQuery({ search: term, replace, caseSensitive: false });
      view.dispatch({ effects: setSearchQuery.of(q) });
      return term ? countMatches(view, q) : 0;
    },
    findNext: () => findNext(view),
    findPrev: () => findPrevious(view),
    replaceOne: () => replaceNext(view),
    replaceAll: () => replaceAll(view),

    // --- split-view sync helpers ----------------------------------------
    // 0-based source line currently at the top of the editor viewport, with
    // the fraction of that line already scrolled past.
    topLine() {
      const top = view.scrollDOM.scrollTop;
      const block = view.lineBlockAtHeight(top);
      const line = view.state.doc.lineAt(block.from);
      const frac = block.height ? Math.min(1, Math.max(0, (top - block.top) / block.height)) : 0;
      return { line: line.number - 1, frac };
    },
    scrollToLine(line0, frac = 0) {
      const n = Math.min(view.state.doc.lines, Math.max(1, line0 + 1));
      const l = view.state.doc.line(n);
      const block = view.lineBlockAt(l.from);
      view.scrollDOM.scrollTop = Math.max(0, block.top + block.height * frac);
    },
    // Select `text` (as it appears in the rendered preview) in the source, searching from
    // 0-based line `line0`. Matching ignores everything except letters and digits so that
    // markdown punctuation (**, `, [](), #) and whitespace differences do not matter.
    selectText(text, line0) {
      const wanted = text.replace(/[^\p{L}\p{N}]/gu, '');
      if (!wanted) return false;
      const doc = view.state.doc;
      const from = doc.line(Math.min(doc.lines, Math.max(1, line0 + 1))).from;
      const hay = doc.sliceString(from);
      const chars = [];
      const idx = [];
      for (let i = 0; i < hay.length; i++) {
        const ch = hay[i];
        if (/[\p{L}\p{N}]/u.test(ch)) { chars.push(ch); idx.push(i); }
      }
      const pos = chars.join('').indexOf(wanted);
      if (pos === -1) return false;
      const a = from + idx[pos];
      const b = from + idx[pos + wanted.length - 1] + 1;
      view.dispatch({ selection: { anchor: a, head: b }, scrollIntoView: true });
      return true;
    },
    onScroll(fn) { view.scrollDOM.addEventListener('scroll', fn, { passive: true }); },
  };
  return api;
}

function countMatches(view, query) {
  if (!query.valid) return 0;
  let n = 0;
  const cursor = query.getCursor(view.state.doc);
  while (!cursor.next().done) n++;
  return n;
}
