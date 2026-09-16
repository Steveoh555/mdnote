// Browser backend: File System Access API when available (Chrome/Edge),
// otherwise <input type=file> + download fallback.

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
    const handle = handles[0];
    const file = await handle.getFile();
    return { name: file.name, text: await file.text(), ref: { kind: 'handle', handle }, key: 'h:' + file.name };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdx,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, text: await file.text(), ref: null, key: 'f:' + file.name });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function saveFile(ref, name, text) {
  if (ref?.kind === 'handle') {
    const perm = await ref.handle.requestPermission?.({ mode: 'readwrite' });
    if (perm && perm !== 'granted') throw new Error('permission-denied');
    const w = await ref.handle.createWritable();
    await w.write(text);
    await w.close();
    return { ref, name };
  }
  return saveFileAs(name, text);
}

export async function saveFileAs(name, text) {
  if (window.showSaveFilePicker) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: name, types: MD_TYPES });
    } catch (e) {
      if (e.name === 'AbortError') return null;
      throw e;
    }
    const w = await handle.createWritable();
    await w.write(text);
    await w.close();
    return { ref: { kind: 'handle', handle }, name: handle.name };
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
  const file = await entry.ref.handle.getFile();
  return { name: file.name, text: await file.text(), ref: entry.ref, key: 'p:' + entry.path };
}
