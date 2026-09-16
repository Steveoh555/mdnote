// Picks the file-system backend at runtime.
// In the Tauri desktop build `window.__TAURI_INTERNALS__` exists and the
// native backend (src/fs/tauri.js) is used; in the browser we fall back to
// the File System Access API.
import * as web from './web.js';

let backend = web;

export async function initFs() {
  if (window.__TAURI_INTERNALS__) {
    try {
      backend = await import('./tauri.js');
    } catch (e) {
      console.warn('Tauri backend unavailable, using web backend', e);
    }
  }
  return backend;
}

export const fs = {
  get capabilities() { return backend.capabilities; },
  openFile: (...a) => backend.openFile(...a),
  saveFile: (...a) => backend.saveFile(...a),
  saveFileAs: (...a) => backend.saveFileAs(...a),
  download: (...a) => backend.download(...a),
  openFolder: (...a) => backend.openFolder(...a),
  readEntry: (...a) => backend.readEntry(...a),
  isTauri: () => backend !== web,
};
