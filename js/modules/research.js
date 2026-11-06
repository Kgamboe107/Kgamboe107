/* Research management: notes, sources (Anara links), status tracking, linked reports */
(function (App) {
  const { esc } = App;
  let activeId = null, q = '', statusFilter = '';
  const STATUSES = ['Open question', 'In progress', 'Findings ready', 'Archived'];

  App.modules.research = {
    async render(view) {
      view.innerHTML = `
        <div class="grid" style="grid-template-columns:minmax(260px,320px) 1fr">
          <div class="card stack">
            <div class="row"><button class="btn primary" id="rNew">New note</button>
              <label class="btn">Import Anara export<input type="file" id="rImp" accept=".md,.markdown,.txt,.pdf,.docx,.html" multiple hidden></label></div>
            <input type="search" id="rQ" placeholder="Search notes…" value="${esc(q)}">
            <select id="rS"><option value="">All statuses</option>${App.ui.options(STATUSES, statusFilter)}</select>
            <div id="rList" class="stack"></div>
          </div>
          <div id="rEdit"></div>
        </div>
        <div class="card"><div class="card-head"><h2>Reports & research files</h2><a data-go="library" class="small">Manage in Data Library →</a></div><div id="rFiles"></div></div>`;
      view.querySelector('#rNew').onclick = async () => {
        const n = { id: App.uid(), businessId: App.biz.target(), module: 'research', title: 'Untitled research', body: '', tags: [], status: 'Open question', link: '', updated: Date.now() };
        await App.store.put('notes', n); activeId = n.id; list(view); edit(view);
      };
      view.querySelector('#rImp').onchange = async e => {
        await App.ingest.ingestMany([...e.target.files], { source: 'anara', category: 'research' });
        e.target.value = ''; list(view); files(view);
      };
      view.querySelector('#rQ').oninput = e => { q = e.target.value; list(view); };
      view.querySelector('#rS').onchange = e => { statusFilter = e.target.value; list(view); };
      await list(view); await edit(view); await files(view);
      if (window.innerWidth < 860) view.querySelector('.grid').style.gridTemplateColumns = '1fr';
    }
  };

  async function notes() {
    return (await App.store.all('notes')).filter(n => n.module === 'research').sort((a, b) => b.updated - a.updated);
  }

  async function list(view) {
    let ns = await notes();
    if (q) { const l = q.toLowerCase(); ns = ns.filter(n => (n.title + ' ' + n.body + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(l)); }
    if (statusFilter) ns = ns.filter(n => (n.status || 'Open question') === statusFilter);
    if (!activeId && ns[0]) activeId = ns[0].id;
    const el = view.querySelector('#rList');
    el.innerHTML = ns.map(n => `<div class="note-item ${n.id === activeId ? 'active' : ''}" data-id="${n.id}">
      <b>${esc(n.title)}</b><div class="row small muted" style="margin-top:4px"><span class="badge">${esc(n.status || 'Open question')}</span>${(n.tags || []).slice(0, 3).map(t => `<span class="badge accent">${esc(t)}</span>`).join('')}</div>
      <div class="tiny muted" style="margin-top:4px">${new Date(n.updated).toLocaleDateString()}</div></div>`).join('') || '<div class="muted small">No notes yet.</div>';
    el.querySelectorAll('[data-id]').forEach(d => d.onclick = () => { activeId = d.dataset.id; list(view); edit(view); });
  }

  async function edit(view) {
    const el = view.querySelector('#rEdit');
    const n = activeId ? await App.store.get('notes', activeId) : null;
    if (!n) { el.innerHTML = App.ui.empty('Create a note, or import notes exported from Anara (Markdown/PDF).'); return; }
    el.innerHTML = `<div class="card stack">
      <input id="nTitle" value="${esc(n.title)}" style="font-size:16px;font-weight:600">
      <div class="row">
        <label class="field">Status<select id="nStatus">${App.ui.options(STATUSES, n.status || 'Open question')}</select></label>
        <label class="field" style="flex:1">Tags<input id="nTags" value="${esc((n.tags || []).join(', '))}" placeholder="pricing, competitor, Q4"></label>
        <label class="field" style="flex:1">Source link (Anara, article, Drive)<input id="nLink" value="${esc(n.link || '')}" placeholder="https://anara.com/…"></label>
      </div>
      <textarea id="nBody" rows="18" placeholder="Hypothesis, sources, findings, next steps…">${esc(n.body)}</textarea>
      <div class="row spread"><span class="muted small" id="nSaved">Autosaves</span>
        <div class="row">${n.link ? `<a class="btn small" href="${esc(n.link)}" target="_blank" rel="noopener">Open source</a>` : ''}
          <button class="btn small" id="nExport">Export .md</button><button class="btn small danger" id="nDel">Delete</button></div></div>
    </div>`;
    let t;
    const save = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        n.title = el.querySelector('#nTitle').value || 'Untitled';
        n.status = el.querySelector('#nStatus').value;
        n.tags = el.querySelector('#nTags').value.split(',').map(s => s.trim()).filter(Boolean);
        n.link = el.querySelector('#nLink').value.trim();
        n.body = el.querySelector('#nBody').value;
        n.updated = Date.now();
        await App.store.put('notes', n);
        el.querySelector('#nSaved').textContent = 'Saved ' + new Date().toLocaleTimeString();
        list(view);
      }, 400);
    };
    el.querySelectorAll('input,textarea,select').forEach(i => i.addEventListener('input', save));
    el.querySelector('#nExport').onclick = () => App.download((n.title || 'note') + '.md', `# ${n.title}\n\nStatus: ${n.status}\nTags: ${(n.tags || []).join(', ')}\nSource: ${n.link || ''}\n\n${n.body}`, 'text/markdown');
    el.querySelector('#nDel').onclick = async () => { if (!await App.confirm({ title: `Delete “${n.title || 'Untitled note'}”?`, body: 'This note is removed from Research. Export it first if you want a copy.', ok: 'Delete note', cancel: 'Keep note', danger: true })) return; await App.store.del('notes', n.id); activeId = null; list(view); edit(view); };
  }

  async function files(view) {
    const fs = (await App.store.files()).filter(f => ['research', 'report'].includes(f.category));
    const el = view.querySelector('#rFiles');
    if (!fs.length) { el.innerHTML = '<div class="muted small">No research files yet. Upload PDFs, decks, or Anara exports.</div>'; return; }
    App.ui.table(el, [
      { key: 'name', label: 'File' },
      { key: 'source', label: 'Source', fmt: v => esc(App.sources[v]?.label || v) },
      { key: 'tags', label: 'Tags', fmt: v => (v || []).map(t => `<span class="badge">${esc(t)}</span>`).join(' ') },
      { key: 'uploadedAt', label: 'Added', fmt: v => new Date(v).toLocaleDateString() }
    ], fs);
  }
})(window.App);
