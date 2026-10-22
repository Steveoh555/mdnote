// Browser backend: File System Access API when available (Chrome/Edge),
// otherwise <input type=file> + download fallback.

import { decodeBytes, encodeText } from './encoding.js';
import { handleId, getHandle } from './handles.js';

const MD_TYPES = [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdx', '.txt'] } }];
const MD_RE = /\.(md|markdown|mdx)$/i;

export const capabilities = {
  folders: typeof window.showDirectoryPicker === 'function',
};

export async function openFile() {
  if (window.showOpenFilePicker) {
    let handles;
    try {
      handles = await window.showOpenFilePicker({ types: MD_TYPES, multiple: false });
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
    return docFromHandle(handles[0]);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdx,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(await docFromFile(file, null, fileKey(file)));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function docFromFile(file, ref, key) {
  const { text, encoding, bom } = decodeBytes(await file.arrayBuffer());
  return { name: file.name, text, ref, key, encoding, bom, mtime: file.lastModified };
}

// A file without a handle (Firefox/Safari, plain <input>) cannot be written back; its drafts
// are keyed by name + modification time so two different files with one name never mix.
const fileKey = (file) => `f:${file.name}:${file.lastModified}`;

async function docFromHandle(handle) {
  const hid = await handleId(handle);
  return docFromFile(await handle.getFile(), { kind: 'handle', handle, hid }, 'h:' + hid);
}

// A file dropped onto the window (with its handle when the browser provides one).
export async function docFromDrop(file, handle) {
  if (handle) return docFromHandle(handle);
  return docFromFile(file, null, fileKey(file));
}

// Reopen a recent document by its stored handle id. Must run from a click (permission prompt).
export async function openRecent(item) {
  const handle = item.hid ? await getHandle(item.hid) : null;
  if (!handle) throw new Error('missing');
  const perm = await handle.requestPermission?.({ mode: 'readwrite' });
  if (perm && perm !== 'granted') return null;
  return docFromHandle(handle);
}

// Whether a recent document can be reopened without asking (permission still granted).
export async function canReopenSilently(item) {
  const handle = item.hid ? await getHandle(item.hid) : null;
  try { return !!handle && (await handle.queryPermission?.({ mode: 'readwrite' })) === 'granted'; } catch { return false; }
}

export async function saveFile(ref, name, text, opts = {}) {
  if (ref?.kind === 'handle') {
    const perm = await ref.handle.requestPermission?.({ mode: 'readwrite' });
    if (perm && perm !== 'granted') throw new Error('permission-denied');
    const w = await ref.handle.createWritable();
    await w.write(encodeText(text, opts.bom));
    await w.close();
    return { ref, name, mtime: (await ref.handle.getFile()).lastModified };
  }
  return saveFileAs(name, text, opts);
}

// Last-modified time of the file behind `ref`, or null when unknown (download fallback).
export async function mtime(ref) {
  if (ref?.kind !== 'handle') return null;
  try { return (await ref.handle.getFile()).lastModified; } catch { return null; }
}

// Re-read the file behind `ref` (used when it changed on disk).
export async function reread(ref, key) {
  if (ref?.kind !== 'handle') return null;
  return docFromFile(await ref.handle.getFile(), ref, key);
}

export async function saveFileAs(name, text, opts = {}) {
  if (window.showSaveFilePicker) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: name, types: MD_TYPES });
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
    const w = await handle.createWritable();
    await w.write(encodeText(text, opts.bom));
    await w.close();
    const hid = await handleId(handle);
    return { ref: { kind: 'handle', handle, hid }, name: handle.name, key: 'h:' + hid, mtime: (await handle.getFile()).lastModified };
  }
  download(name, text, 'text/markdown');
  return { ref: null, name, downloaded: true };
}

export function download(name, text, type) {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function openFolder() {
  if (!capabilities.folders) return null;
  let dir;
  try {
    dir = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
  const tree = await readTree(dir, dir.name, 0);
  return { name: dir.name, tree };
}

async function readTree(dir, path, depth) {
  const dirs = [];
  const files = [];
  for await (const [name, entry] of dir.entries()) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    if (entry.kind === 'directory') {
      if (depth < 4) dirs.push(entry);
    } else if (MD_RE.test(name)) {
      files.push({ type: 'file', name, path: path + '/' + name, ref: { kind: 'handle', handle: entry } });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const children = [];
  for (const d of dirs.sort(byName)) {
    const sub = await readTree(d, path + '/' + d.name, depth + 1);
    if (sub.length) children.push({ type: 'dir', name: d.name, path: path + '/' + d.name, children: sub });
  }
  return [...children, ...files.sort(byName)];
}

export async function readEntry(entry) {
  return docFromHandle(entry.ref.handle);
}
