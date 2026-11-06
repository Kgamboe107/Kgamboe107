/* Data Library: upload, classify, browse, preview, and manage every file */
(function (App) {
  const { esc, fmt } = App;
  let filter = { cat: '', src: '', q: '' };

  App.modules.library = {
    async render(view) {
      const catOpts = [{ value: '', label: 'Auto-detect' }, ...Object.entries(App.categories).map(([k, v]) => ({ value: k, label: v.label }))];
      const srcOpts = [{ value: '', label: 'Auto-detect' }, ...Object.entries(App.sources).map(([k, v]) => ({ value: k, label: v.label }))];
      view.innerHTML = `
        <div class="card">
          <div class="card-head"><h2>Add data</h2><div class="row">
            <button class="btn small" onclick="App.newTable()">${App.fx.icon('edit')} Type it in (new table)</button>
            ${App.biz.enabled('purchases') && !App.biz.isMaster() ? `<button class="btn small" onclick="App.go('purchases').then(() => App.purchasesEditor())">${App.fx.icon('receipt')} Enter a receipt</button>` : ''}
          </div></div>
          <div class="muted small" style="margin:-6px 0 12px">Upload spreadsheets (CSV, XLSX, XLS, ODS), reports (PDF, DOCX, PPTX), notes (MD, TXT), images and personnel files, or type data in by hand.</div>
          <div class="row" style="margin-bottom:12px">
            <label class="field">Business<select id="upBiz">${App.ui.options(App.biz.active().map(b => ({ value: b.id, label: b.name })), App.biz.target())}</select></label>
            <label class="field">Category<select id="upCat">${App.ui.options(catOpts, '')}</select></label>
            <label class="field">Source system<select id="upSrc">${App.ui.options(srcOpts, '')}</select></label>
            <label class="field" style="flex:1">Tags (comma separated)<input id="upTags" placeholder="e.g. Q3, Store 12, board deck"></label>
          </div>
          <label class="dropzone" id="dz">
            <div class="dz-icon">${App.fx.icon('upload')}</div>
            <div><b>Drop files here</b> or click to browse</div>
            <div class="muted small">Exports from Harri, CrunchTime, Webull, Dub, Outlook attachments, Anara notes, and Google Drive are recognized automatically</div>
            <input type="file" id="dzInput" multiple hidden>
          </label>
        </div>
        <div class="card">
          <div class="card-head"><h2>Files</h2>
            <div class="row">
              <input id="fQ" type="search" placeholder="Filter…" value="${esc(filter.q)}">
              <select id="fCat"><option value="">All categories</option>${App.ui.options(Object.entries(App.categories).map(([k, v]) => ({ value: k, label: v.label })), filter.cat)}</select>
              <select id="fSrc"><option value="">All sources</option>${App.ui.options(Object.entries(App.sources).map(([k, v]) => ({ value: k, label: v.label })), filter.src)}</select>
            </div>
          </div>
          <div id="fileList"></div>
        </div>`;

      const dz = view.querySelector('#dz'), inp = view.querySelector('#dzInput');
      const opts = () => ({
        businessId: view.querySelector('#upBiz').value,
        category: view.querySelector('#upCat').value || undefined,
        source: view.querySelector('#upSrc').value || undefined,
        tags: view.querySelector('#upTags').value.split(',').map(s => s.trim()).filter(Boolean)
      });
      inp.onchange = async () => { await App.ingest.ingestMany([...inp.files], opts()); inp.value = ''; renderList(); };
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', async e => {
        e.preventDefault(); e.stopPropagation(); dz.classList.remove('over');
        document.getElementById('dropOverlay').classList.remove('show');
        await App.ingest.ingestMany([...e.dataTransfer.files], opts()); renderList();
      });
      view.querySelector('#fQ').oninput = e => { filter.q = e.target.value; renderList(); };
      view.querySelector('#fCat').onchange = e => { filter.cat = e.target.value; renderList(); };
      view.querySelector('#fSrc').onchange = e => { filter.src = e.target.value; renderList(); };

      async function renderList() {
        let files = await App.store.files();
        if (filter.cat) files = files.filter(f => f.category === filter.cat);
        if (filter.src) files = files.filter(f => f.source === filter.src);
        if (filter.q) { const q = filter.q.toLowerCase(); files = files.filter(f => (f.name + ' ' + (f.tags || []).join(' ')).toLowerCase().includes(q)); }
        const el = view.querySelector('#fileList');
        if (!files.length) { el.innerHTML = '<div class="empty">No files yet.</div>'; return; }
        el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Business</th><th>Category</th><th>Source</th><th>Tags</th><th class="num">Size</th><th>Uploaded</th><th></th></tr></thead><tbody>
          ${files.map(f => `<tr>
            <td><a data-open="${f.id}">${esc(f.name)}</a>${f.datasetIds?.length ? ` <span class="badge accent">${f.datasetIds.length} table${f.datasetIds.length > 1 ? 's' : ''}</span>` : ''}</td>
            <td><select data-biz="${f.id}">${App.ui.options(App.biz.list().map(b => ({ value: b.id, label: b.name })), App.biz.idOf(f))}</select></td>
            <td><select data-cat="${f.id}">${App.ui.options(Object.entries(App.categories).map(([k, v]) => ({ value: k, label: v.label })), f.category)}</select></td>
            <td><span class="badge" style="border-color:${App.sources[f.source]?.color}">${esc(App.sources[f.source]?.label || f.source)}</span></td>
            <td class="small">${(f.tags || []).map(t => `<span class="badge">${esc(t)}</span>`).join(' ')}</td>
            <td class="num">${fmt.bytes(f.size || 0)}</td>
            <td class="small">${new Date(f.uploadedAt).toLocaleString()}</td>
            <td><button class="btn small" data-dl="${f.id}">Download</button> <button class="btn small danger" data-del="${f.id}">Delete</button></td>
          </tr>`).join('')}</tbody></table></div>`;
        el.querySelectorAll('[data-cat]').forEach(s => s.onchange = async () => {
          const f = await App.store.get('files', s.dataset.cat);
          f.category = s.value;
          await App.store.put('files', f);
          for (const id of f.datasetIds || []) { const d = await App.store.get('datasets', id); if (d) { d.category = s.value; await App.store.put('datasets', d); } }
          App.ui.toast('Category updated');
        });
        el.querySelectorAll('[data-biz]').forEach(s => s.onchange = async () => {
          const f = await App.store.get('files', s.dataset.biz);
          f.businessId = s.value;
          await App.store.put('files', f);
          for (const id of f.datasetIds || []) { const d = await App.store.get('datasets', id); if (d) { d.businessId = s.value; await App.store.put('datasets', d); } }
          for (const n of await App.store.all('notes', { raw: true })) if (n.fileId === f.id) { n.businessId = s.value; await App.store.put('notes', n); }
          App.ui.toast(`Moved to ${App.biz.get(s.value).name}`); renderList();
        });
        el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (!await App.confirm({ title: 'Delete this file?', body: 'The file and every data table read from it are removed. Dashboards that use them will update.', ok: 'Delete file and tables', cancel: 'Keep file', danger: true })) return;
          const gone = await App.store.get('files', b.dataset.del);
          await App.store.deleteFile(b.dataset.del);
          App.compliance?.audit('File deleted', gone?.name || '', gone?.businessId); renderList();
        });
        el.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => {
          const f = await App.store.get('files', b.dataset.dl);
          if (f?.blob) App.download(f.name, f.blob);
          else if (f?.datasetIds?.[0]) { const d = await App.store.get('datasets', f.datasetIds[0]); if (d) App.download(f.name + '.csv', App.toCSV(d.headers, d.rows)); }
        });
        el.querySelectorAll('[data-open]').forEach(a => a.onclick = async () => {
          const f = await App.store.get('files', a.dataset.open);
          if (f?.origin === 'manual' && f.datasetIds?.[0]) App.go('sheet', { id: f.datasetIds[0] }); else preview(a.dataset.open);
        });
      }
      renderList();
    }
  };

  async function preview(id) {
    const f = await App.store.get('files', id);
    if (!f) return;
    const datasets = (await Promise.all((f.datasetIds || []).map(d => App.store.get('datasets', d)))).filter(Boolean);
    App.ui.modal(`
      <div class="card-head"><h2>${esc(f.name)}</h2><button class="btn small" data-close>Close</button></div>
      <div class="stack">
        <label class="field">Tags<input id="pvTags" value="${esc((f.tags || []).join(', '))}"></label>
        <label class="field">Notes<textarea id="pvNotes" rows="3">${esc(f.notes || '')}</textarea></label>
        <div class="row"><button class="btn primary small" id="pvSave">Save details</button>
          ${f.blob && /pdf|image|text|html/.test(f.blob.type || f.mime) ? '<button class="btn small" id="pvView">Open file</button>' : ''}
          ${datasets.length ? '<button class="btn small" id="pvExplore">Open in Data Explorer</button><button class="btn small" id="pvEdit">Edit data</button>' : ''}</div>
        <div id="pvTables"></div>
      </div>`, (card, close) => {
      card.querySelector('#pvSave').onclick = async () => {
        f.tags = card.querySelector('#pvTags').value.split(',').map(s => s.trim()).filter(Boolean);
        f.notes = card.querySelector('#pvNotes').value;
        await App.store.put('files', f);
        App.ui.toast('Saved'); close(); App.go('library');
      };
      const v = card.querySelector('#pvView');
      if (v) v.onclick = () => window.open(URL.createObjectURL(f.blob), '_blank');
      const ex = card.querySelector('#pvExplore');
      const ed = card.querySelector('#pvEdit');
      if (ed) ed.onclick = () => { close(); App.go('sheet', { id: datasets[0].id }); };
      if (ex) ex.onclick = () => { App.bsettings.set('explorer.ds', datasets[0].id); close(); App.go('explorer'); };
      const t = card.querySelector('#pvTables');
      datasets.forEach(d => {
        const box = document.createElement('div');
        box.innerHTML = `<h3 style="margin:8px 0">${esc(d.sheet || d.name)} <span class="muted small">${d.rows.length} rows</span></h3><div></div>`;
        t.appendChild(box);
        App.ui.table(box.lastElementChild, d.headers.map(h => ({ key: h, label: h })), d.rows, { limit: 50 });
      });
    });
  }
})(window.App);
