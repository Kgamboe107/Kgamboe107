/* Local persistence in IndexedDB: files (with original blobs), datasets (parsed tables), notes */
(function (App) {
  const DB_NAME = 'ops-command-desk';
  const DB_VER = 1;
  let dbp = null;
  const SCOPED = ['files', 'datasets', 'notes'];

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('datasets')) {
          const ds = db.createObjectStore('datasets', { keyPath: 'id' });
          ds.createIndex('fileId', 'fileId');
        }
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      Promise.resolve(fn(s)).then(r => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
    });
  }
  const reqP = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  const store = {
    async put(name, obj) { await tx(name, 'readwrite', s => s.put(obj)); App.bus.emit('data-changed', name); return obj; },
    async get(name, id) { const db = await open(); return reqP(db.transaction(name).objectStore(name).get(id)); },
    /* files/datasets/notes are scoped to the active business unless { raw: true } */
    async all(name, opts = {}) {
      const db = await open();
      const rows = await reqP(db.transaction(name).objectStore(name).getAll());
      return opts.raw || !SCOPED.includes(name) || !App.biz ? rows : rows.filter(App.biz.inScope);
    },
    async del(name, id) { await tx(name, 'readwrite', s => s.delete(id)); App.bus.emit('data-changed', name); },
    async clear(name) { await tx(name, 'readwrite', s => s.clear()); App.bus.emit('data-changed', name); },

    /* File metadata without blobs (faster lists) */
    async files() {
      const all = await this.all('files');
      return all.map(({ blob, ...meta }) => meta).sort((a, b) => b.uploadedAt - a.uploadedAt);
    },
    async datasets(filter = {}) {
      let all = await this.all('datasets');
      if (filter.category) all = all.filter(d => d.category === filter.category || (Array.isArray(filter.category) && filter.category.includes(d.category)));
      return all.sort((a, b) => b.createdAt - a.createdAt);
    },
    async deleteFile(id) {
      const ds = (await this.all('datasets', { raw: true })).filter(d => d.fileId === id);
      for (const d of ds) await tx('datasets', 'readwrite', s => s.delete(d.id));
      await this.del('files', id);
    },
    async exportAll() {
      const files = await this.all('files', { raw: true });
      const out = { version: 2, exportedAt: new Date().toISOString(), files: [], datasets: await this.all('datasets', { raw: true }), notes: await this.all('notes', { raw: true }) };
      for (const f of files) {
        const { blob, ...meta } = f;
        meta.dataUrl = blob ? await blobToDataUrl(blob) : null;
        out.files.push(meta);
      }
      return out;
    },
    async importAll(data) {
      for (const f of data.files || []) {
        const { dataUrl, ...meta } = f;
        meta.blob = dataUrl ? await (await fetch(dataUrl)).blob() : null;
        await tx('files', 'readwrite', s => s.put(meta));
      }
      for (const d of data.datasets || []) await tx('datasets', 'readwrite', s => s.put(d));
      for (const n of data.notes || []) await tx('notes', 'readwrite', s => s.put(n));
      App.bus.emit('data-changed', 'all');
    }
  };

  function blobToDataUrl(blob) {
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  }

  App.store = store;
})(window.App);
