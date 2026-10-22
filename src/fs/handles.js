// Browser only: remembers File System Access handles in IndexedDB so a file can be found
// again later (recent documents) and gets a stable id (draft keys no longer collide when
// two different files share a name).

const DB = 'mdnote';
const STORE = 'handles';
const KEEP = 40;

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out?.result ?? out);
    tx.onerror = () => reject(tx.error);
  }));
}

const all = () => run('readonly', (s) => s.getAll());

// Stable id for `handle`: the id of an already stored handle to the same file, or a new one.
export async function handleId(handle) {
  try {
    const rows = await all();
    for (const row of rows) {
      try {
        if (await row.handle.isSameEntry(handle)) {
          await run('readwrite', (s) => s.put({ ...row, handle, at: Date.now() }));
          return row.id;
        }
      } catch { /* stale handle */ }
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await run('readwrite', (s) => {
      s.put({ id, handle, at: Date.now() });
      rows.sort((a, b) => b.at - a.at).slice(KEEP - 1).forEach((r) => s.delete(r.id));
    });
    return id;
  } catch {
    // IndexedDB unavailable (private mode): fall back to the name, as before.
    return 'n:' + handle.name;
  }
}

export async function getHandle(id) {
  try {
    const row = await run('readonly', (s) => s.get(id));
    return row?.handle ?? null;
  } catch { return null; }
}
