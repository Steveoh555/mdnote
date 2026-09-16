// Native backend for the Tauri desktop build.
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { join, basename } from '@tauri-apps/api/path';

const MD_FILTER = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] }];
const MD_RE = /\.(md|markdown|mdx)$/i;

export const capabilities = { folders: true };

async function docFromPath(path) {
  const text = await readTextFile(path);
  return { name: await basename(path), text, ref: { kind: 'path', path }, key: 'p:' + path };
}

export async function openFile() {
  const path = await open({ filters: MD_FILTER, multiple: false, directory: false });
  if (!path) return null;
  return docFromPath(path);
}

export async function openPath(path) {
  return docFromPath(path);
}

export async function saveFile(ref, name, text) {
  if (ref?.kind === 'path') {
    await writeTextFile(ref.path, text);
    return { ref, name };
  }
  return saveFileAs(name, text);
}

export async function saveFileAs(name, text) {
  const path = await save({ defaultPath: name, filters: MD_FILTER });
  if (!path) return null;
  await writeTextFile(path, text);
  return { ref: { kind: 'path', path }, name: await basename(path), key: 'p:' + path };
}

// Used for exports (HTML). Asks where to save instead of "downloading".
export async function download(name, text) {
  const ext = name.split('.').pop();
  const path = await save({ defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (!path) return;
  await writeTextFile(path, text);
}

export async function openFolder() {
  const dir = await open({ directory: true, multiple: false });
  if (!dir) return null;
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
