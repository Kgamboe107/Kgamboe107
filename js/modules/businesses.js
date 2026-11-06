/* Businesses: create, edit, archive, merge, and delete ventures */
(function (App) {
  const { esc } = App;

  function form(b) {
    b = b || {};
    const type = b.type || 'restaurant';
    const mods = b.modules || App.biz.TEMPLATES[type].modules;
    return `
      <div class="card-head"><h2>${b.id ? 'Edit business' : 'New business or venture'}</h2><button class="btn small ghost" data-close>${b.id ? 'Discard changes' : 'Cancel'}</button></div>
      <div class="stack"${b.id ? '' : ' data-steps'}>
        <section data-step="Name &amp; type" class="stack form-group">
        <label class="field">Name<input id="bName" value="${esc(b.name || '')}" placeholder="e.g. Gamboe Consulting, Taco Truck #2, Swing Trading"></label>
        <div class="row">
          <label class="field" style="flex:1">Type<select id="bType">${App.ui.options(Object.entries(App.biz.TEMPLATES).map(([k, t]) => ({ value: k, label: t.label })), type)}</select></label>
          <label class="field">Color<input type="color" id="bColor" value="${b.color || App.biz.COLORS[App.biz.list().length % App.biz.COLORS.length]}" style="width:60px;padding:2px"></label>
          <label class="field">Started<input type="date" id="bStart" value="${esc(b.started || '')}"></label>
        </div>
        <label class="field">Description<textarea id="bDesc" rows="2" placeholder="What this venture does, goals, partners…">${esc(b.description || '')}</textarea></label>
        </section>
        <section data-step="Pick modules" class="stack form-group">
        <div class="field">Modules this business uses
          <div class="check-grid" id="bMods">${App.biz.ALL_MODULES.map(m => `<label class="row small" style="color:var(--text)"><input type="checkbox" value="${m}" ${mods.includes(m) ? 'checked' : ''}> ${App.biz.MODULE_LABELS[m]}</label>`).join('')}</div>
        </div>
        <div class="row form-submit"><button class="btn primary" id="bSave">${b.id ? 'Save changes' : 'Create business'}</button></div>
        </section>
      </div>`;
  }

  function openForm(b, after) {
    App.ui.modal(form(b), (card, close) => {
      if (!b?.id) App.ux.steps(card.querySelector('[data-steps]'), { finish: '#bSave' });
      card.querySelector('#bType').onchange = e => {
        const mods = App.biz.TEMPLATES[e.target.value].modules;
        card.querySelectorAll('#bMods input').forEach(i => i.checked = mods.includes(i.value));
      };
      card.querySelector('#bSave').onclick = () => {
        const data = {
          name: card.querySelector('#bName').value.trim() || 'New venture', type: card.querySelector('#bType').value,
          color: card.querySelector('#bColor').value, started: card.querySelector('#bStart').value, description: card.querySelector('#bDesc').value.trim(),
          modules: [...card.querySelectorAll('#bMods input:checked')].map(i => i.value)
        };
        let id = b?.id;
        if (id) App.biz.update(id, data); else id = App.biz.create(data).id;
        close();
        App.ui.toast(b?.id ? 'Business updated' : `Created ${data.name}`);
        after(id, !b?.id);
      };
    });
  }
  App.businessForm = openForm;

  App.modules.businesses = {
    async render(view) {
      const all = App.biz.list();
      const counts = {};
      for (const f of await App.store.all('files', { raw: true })) { const id = App.biz.idOf(f); counts[id] = (counts[id] || 0) + 1; }
      view.innerHTML = `
        <div class="card row spread"><div><h2>Businesses & ventures</h2><div class="muted small">Each business keeps its own files, column mappings, targets, risk limits, and dashboard. The Master dashboard rolls them all up.</div></div>
          <div class="row"><button class="btn" data-go-master>Master dashboard</button><button class="btn primary" id="bNew">+ New business</button></div></div>
        <div class="grid c3">${all.map(b => `
          <div class="card biz-card" style="--bc:${b.color};${b.archived ? 'opacity:.6' : ''}">
            <div class="row spread"><div><h2>${esc(b.name)}</h2><div class="muted small">${esc(App.biz.TEMPLATES[b.type]?.label || 'Custom')}${b.started ? ' · since ' + esc(b.started) : ''}${b.archived ? ' · archived' : ''}</div></div>
              <span class="badge">${counts[b.id] || 0} files</span></div>
            ${b.description ? `<div class="small">${esc(b.description)}</div>` : ''}
            <div class="row">${b.modules.map(m => `<span class="badge">${App.biz.MODULE_LABELS[m]}</span>`).join('')}</div>
            <div class="row">
              <button class="btn small primary" data-open="${b.id}">Open</button>
              <button class="btn small" data-edit="${b.id}">Edit</button>
              <button class="btn small" data-arch="${b.id}">${b.archived ? 'Restore' : 'Archive'}</button>
              <button class="btn small danger" data-del="${b.id}">Delete…</button>
            </div>
          </div>`).join('')}</div>`;

      view.querySelector('[data-go-master]').onclick = () => { App.biz.setCurrent('all'); App.go('dashboard'); };
      view.querySelector('#bNew').onclick = () => openForm(null, (id) => { App.biz.setCurrent(id); App.go('dashboard'); });
      view.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { App.biz.setCurrent(b.dataset.open); App.go('dashboard'); });
      view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(App.biz.get(b.dataset.edit), () => App.go('businesses')));
      view.querySelectorAll('[data-arch]').forEach(b => b.onclick = () => {
        const biz = App.biz.get(b.dataset.arch);
        if (!biz.archived && App.biz.active().length <= 1) return App.ui.toast('Keep at least one active business.');
        App.biz.update(biz.id, { archived: !biz.archived });
        if (!biz.archived && App.biz.current() === biz.id) App.biz.setCurrent('all');
        App.go('businesses');
      });
      view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        const biz = App.biz.get(b.dataset.del);
        const others = App.biz.list().filter(x => x.id !== biz.id);
        App.ui.modal(`
          <div class="card-head"><h2>Delete ${esc(biz.name)}?</h2></div>
          <div class="stack">
            <div class="muted">${counts[biz.id] || 0} files belong to this business.</div>
            ${others.length ? `<label class="row"><input type="radio" name="dm" value="move" checked> Move its files and notes to <select id="dTo">${App.ui.options(others.map(o => ({ value: o.id, label: o.name })), others[0].id)}</select></label>` : ''}
            <label class="row"><input type="radio" name="dm" value="delete" ${others.length ? '' : 'checked'}> Permanently delete its files and notes</label>
            <div class="confirm-actions"><button class="btn" data-close>Keep ${esc(biz.name)}</button><button class="btn destructive" id="dGo">${others.length ? 'Delete business &amp; move files' : 'Delete business &amp; its files'}</button></div>
          </div>`, (card, close) => {
          const go = card.querySelector('#dGo');
          card.querySelectorAll('input[name=dm]').forEach(r => r.onchange = () => { go.textContent = card.querySelector('input[name=dm]:checked').value === 'move' ? 'Delete business & move files' : 'Delete business & its files'; });
          go.onclick = async () => {
            const mode = card.querySelector('input[name=dm]:checked').value;
            await App.biz.remove(biz.id, mode === 'move' ? { moveTo: card.querySelector('#dTo').value } : {});
            close(); App.ui.toast(`Deleted ${biz.name}`); App.go('businesses');
          };
        });
      });
    }
  };
})(window.App);
