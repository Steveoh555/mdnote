// Native backend for the Tauri desktop build.
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, readDir, stat } from '@tauri-apps/plugin-fs';
import { decodeBytes, encodeText } from './encoding.js';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { join, basename } from '@tauri-apps/api/path';

const MD_FILTER = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] }];
const MD_RE = /\.(md|markdown|mdx)$/i;

export const capabilities = { folders: true };

// Paths chosen by the user (dialogs, argv, folder trees) are added to the fs scope at
// runtime; the capability file no longer grants blanket access to the whole disk.
async function allowPath(path, recursive = false) {
  try { await invoke('allow_path', { path, recursive }); } catch (e) { console.warn('allow_path', e); }
}

async function fileMtime(path) {
  try { const s = await stat(path); return s.mtime ? new Date(s.mtime).getTime() : null; } catch { return null; }
}

async function docFromPath(path) {
  await allowPath(path);
  const { text, encoding, bom } = decodeBytes(await readFile(path));
  return { name: await basename(path), text, ref: { kind: 'path', path }, key: 'p:' + path, encoding, bom, mtime: await fileMtime(path) };
}

export async function mtime(ref) {
  return ref?.kind === 'path' ? fileMtime(ref.path) : null;
}

export async function reread(ref) {
  return ref?.kind === 'path' ? docFromPath(ref.path) : null;
}

export async function openFile() {
  const path = await open({ filters: MD_FILTER, multiple: false, directory: false });
  if (!path) return null;
  return docFromPath(path);
}

export async function openPath(path) {
  return docFromPath(path);
}

export async function saveFile(ref, name, text, opts = {}) {
  if (ref?.kind === 'path') {
    await writeFile(ref.path, encodeText(text, opts.bom));
    return { ref, name, mtime: await fileMtime(ref.path) };
  }
  return saveFileAs(name, text, opts);
}

export async function saveFileAs(name, text, opts = {}) {
  const path = await save({ defaultPath: name, filters: MD_FILTER });
  if (!path) return null;
  await allowPath(path);
  await writeFile(path, encodeText(text, opts.bom));
  return { ref: { kind: 'path', path }, name: await basename(path), key: 'p:' + path, mtime: await fileMtime(path) };
}

// Used for exports (HTML). Asks where to save instead of "downloading".
export async function download(name, text) {
  const ext = name.split('.').pop();
  const path = await save({ defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (!path) return;
  await allowPath(path);
  await writeFile(path, encodeText(text));
}

export async function openFolder() {
  const dir = await open({ directory: true, multiple: false });
  if (!dir) return null;
  await allowPath(dir, true);
  const name = await basename(dir);
  const tree = await readTree(dir, name, 0);
  return { name, tree, root: dir };
}

async function readTree(dir, path, depth) {
  const entries = await readDir(dir);
  const dirs = [];
  const files = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    if (e.isDirectory) {
      if (depth < 4) dirs.push(e);
    } else if (MD_RE.test(e.name)) {
      files.push({ type: 'file', name: e.name, path: path + '/' + e.name, ref: { kind: 'path', path: await join(dir, e.name) } });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const children = [];
  for (const d of dirs.sort(byName)) {
    const sub = await readTree(await join(dir, d.name), path + '/' + d.name, depth + 1);
    if (sub.length) children.push({ type: 'dir', name: d.name, path: path + '/' + d.name, children: sub });
  }
  return [...children, ...files.sort(byName)];
}

export async function readEntry(entry) {
  return docFromPath(entry.ref.path);
}

export async function openExternal(url) {
  await openUrl(url);
}

// Desktop-only hooks: file passed on launch, and files sent by a second launch.
export async function launchFile() {
  try { return await invoke('launch_file'); } catch { return null; }
}

export function onOpenFile(handler) {
  return listen('open-file', (e) => handler(e.payload));
}
