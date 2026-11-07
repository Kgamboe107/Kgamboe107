/* Units: businesses and personal units. Create, edit, archive, merge and delete.
   Both kinds can have as many units as you like; each kind has its own roll-up dashboard. */
(function (App) {
  const { esc } = App;
  const K = () => App.biz.KINDS;
  const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const templatesOf = kind => Object.entries(App.biz.TEMPLATES).filter(([, t]) => t.kind === kind);

  function form(b, kind) {
    b = b || {};
    const type = b.type || (kind === 'individual' ? 'personal' : 'restaurant');
    const mods = b.modules || App.biz.TEMPLATES[type].modules;
    const k = b.id ? App.biz.kindOf(b) : kind;
    return `
      <div class="card-head"><h2>${b.id ? `Edit ${esc(b.name)}` : 'Add a unit'}</h2><button class="btn small ghost" data-close>${b.id ? 'Discard changes' : 'Cancel'}</button></div>
      <div class="stack"${b.id ? '' : ' data-steps'}>
        <section data-step="Business or personal" class="stack form-group">
          <div class="muted small">Businesses roll up into the Business dashboard; personal units roll up into the Personal dashboard. You can add as many of each as you like.</div>
          <div class="kind-pick" role="radiogroup" aria-label="Kind of unit">${Object.entries(K()).map(([kk, v]) => `
            <label class="kind-card"><input type="radio" name="bKind" value="${kk}" ${kk === k ? 'checked' : ''}>
              <span class="kind-ico">${App.fx.icon(v.icon)}</span><span><b>${esc(v.label)}</b><span class="muted small">${esc(v.blurb)}</span></span></label>`).join('')}</div>
        </section>
        <section data-step="Name &amp; type" class="stack form-group">
          <label class="field">Name<input id="bName" value="${esc(b.name || '')}" placeholder="${k === 'individual' ? 'e.g. Household budget, Roth IRA, Elm St rental' : 'e.g. Auburn #11053, Taco Truck #2, Gamboe Consulting'}"></label>
          <div class="row">
            <label class="field" style="flex:1">Type<select id="bType" data-native></select></label>
            <label class="field">Color<input type="color" id="bColor" value="${b.color || App.biz.COLORS[App.biz.list().length % App.biz.COLORS.length]}" style="width:60px;padding:2px"></label>
            <label class="field">Started<input type="date" id="bStart" value="${esc(b.started || '')}"></label>
          </div>
          <label class="field" id="bOwnerWrap" ${k === 'individual' ? '' : 'hidden'}>Belongs to<select id="bOwner" data-native>${App.ui.options([...App.wealth.members().map(m => ({ value: m.id, label: m.name })), { value: 'joint', label: 'Joint / whole family' }], b.owner || (App.wealth.person() !== 'all' ? App.wealth.person() : 'joint'))}</select></label>
          <label class="field">Description<textarea id="bDesc" rows="2" placeholder="What this unit is, goals, partners, store number…">${esc(b.description || '')}</textarea></label>
        </section>
        <section data-step="Pick modules" class="stack form-group">
        <div class="field">Modules this unit uses
          <div class="check-grid" id="bMods">${App.biz.ALL_MODULES.map(m => `<label class="row small" style="color:var(--text)"><input type="checkbox" value="${m}" ${mods.includes(m) ? 'checked' : ''}> ${App.biz.MODULE_LABELS[m]}</label>`).join('')}</div>
        </div>
        <div class="row form-submit"><button class="btn primary" id="bSave">${b.id ? 'Save changes' : 'Create unit'}</button></div>
        </section>
      </div>`;
  }

  /* openForm(unit | null, after(id, isNew), { kind }) */
  function openForm(b, after, opts = {}) {
    const startKind = b?.id ? App.biz.kindOf(b) : (opts.kind || App.biz.currentKind() || 'business');
    App.ui.modal(form(b, startKind), (card, close) => {
      card.classList.add('wide');
      const typeSel = card.querySelector('#bType');
      const kindNow = () => card.querySelector('input[name=bKind]:checked').value;
      const fillTypes = (keep) => {
        const list = templatesOf(kindNow());
        const cur = keep && list.some(([t]) => t === keep) ? keep : list[0][0];
        typeSel.innerHTML = list.map(([t, v]) => `<option value="${t}" ${t === cur ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
        return cur;
      };
      const applyMods = t => { const mods = App.biz.TEMPLATES[t].modules; card.querySelectorAll('#bMods input').forEach(i => i.checked = mods.includes(i.value)); };
      fillTypes(b?.type);
      card.querySelectorAll('input[name=bKind]').forEach(r => r.onchange = () => {
        const t = fillTypes();
        if (!b?.id) applyMods(t);
        card.querySelector('#bName').placeholder = kindNow() === 'individual' ? 'e.g. Household budget, Roth IRA, Elm St rental' : 'e.g. Auburn #11053, Taco Truck #2, Gamboe Consulting';
        card.querySelector('#bSave').textContent = b?.id ? 'Save changes' : `Create ${K()[kindNow()].unit}`;
        card.querySelector('#bOwnerWrap').hidden = kindNow() !== 'individual';
      });
      typeSel.onchange = e => applyMods(e.target.value);
      if (!b?.id) App.ux.steps(card.querySelector('[data-steps]'), { finish: '#bSave' });
      card.querySelector('#bSave').textContent = b?.id ? 'Save changes' : `Create ${K()[startKind].unit}`;
      card.querySelector('#bSave').onclick = () => {
        const kind = kindNow();
        const data = {
          name: card.querySelector('#bName').value.trim() || (kind === 'individual' ? 'Personal' : 'New business'), type: typeSel.value, kind,
          color: card.querySelector('#bColor').value, started: card.querySelector('#bStart').value, description: card.querySelector('#bDesc').value.trim(),
          modules: [...card.querySelectorAll('#bMods input:checked')].map(i => i.value),
          ...(kind === 'individual' ? { owner: card.querySelector('#bOwner').value } : {})
        };
        let id = b?.id;
        if (id) App.biz.update(id, data); else id = App.biz.create(data).id;
        close();
        App.ui.toast(b?.id ? `${data.name} updated` : `Created ${data.name}`);
        after?.(id, !b?.id);
      };
    });
  }
  App.businessForm = openForm;

  let tab = null;
  App.modules.businesses = {
    async render(view, params = {}) {
      if (params.kind) tab = params.kind;
      if (!tab) tab = App.biz.currentKind() || 'business';
      const all = App.biz.list();
      const counts = {};
      for (const f of await App.store.all('files', { raw: true })) { const id = App.biz.idOf(f); counts[id] = (counts[id] || 0) + 1; }
      const ofKind = kind => all.filter(b => App.biz.kindOf(b) === kind);
      const kv = K()[tab];
      const pf = tab === 'individual' ? App.wealth.person() : 'all';
      const list = ofKind(tab).filter(b => pf === 'all' || (b.owner || 'joint') === pf || (b.owner || 'joint') === 'joint');
      view.innerHTML = `
        <div class="card row spread">
          <div><h2>Businesses &amp; personal</h2><div class="muted small">Every unit keeps its own files, column mappings, targets and dashboard. Businesses roll up into the Business dashboard, personal units into the Personal dashboard.</div></div>
          <div class="row"><button class="btn" data-view="all">Everything dashboard</button></div>
        </div>
        <div class="kind-tabs" role="tablist">${Object.entries(K()).map(([k, v]) => `
          <button role="tab" data-tab="${k}" class="kind-tab ${k === tab ? 'on' : ''}" aria-selected="${k === tab}">
            <span class="kind-ico">${App.fx.icon(v.icon)}</span><span><b>${esc(v.plural)}</b><span class="muted tiny">${ofKind(k).filter(b => !b.archived).length} active · ${esc(v.blurb)}</span></span></button>`).join('')}</div>
        <div class="row spread">
          <div class="row"><button class="btn primary" data-new="${tab}">${App.fx.icon('plus')} Add ${esc(kv.unit)}</button><button class="btn" data-view="all:${tab}">${App.fx.icon('dashboard')} Open ${esc(kv.master)}</button></div>
          <span class="muted small">${list.length} ${tab === 'individual' ? 'personal unit' : 'business'}${list.length === 1 ? '' : tab === 'individual' ? 's' : 'es'}</span>
        </div>
        ${tab === 'individual' ? `<div class="card stack" style="gap:10px"><div class="row spread"><div><h2>Family</h2><div class="muted small">Give each person an individual view of every unit, account and tax item. The Personal dashboard shows the whole family's wealth.</div></div><button class="btn small" data-fam>Edit family members</button></div>${App.modules.wealth.personBar()}</div>` : ''}
        <div class="grid c3">${list.map(b => `
          <div class="card biz-card unit-card" style="--bc:${b.color};${b.archived ? 'opacity:.6' : ''}">
            <div class="row spread" style="align-items:flex-start"><div class="row" style="gap:12px;flex-wrap:nowrap;min-width:0"><span class="unit-av" style="background:${b.color}">${esc(initials(b.name))}</span>
              <div style="min-width:0"><h2 style="margin:0">${esc(b.name)}</h2><div class="muted small">${esc(App.biz.TEMPLATES[b.type]?.label || 'Custom')}${App.biz.kindOf(b) === 'individual' ? ' · ' + esc(App.wealth.memberName(b.owner || 'joint')) : ''}${b.started ? ' · since ' + esc(b.started) : ''}${b.archived ? ' · archived' : ''}</div></div></div>
              <span class="badge">${counts[b.id] || 0} files</span></div>
            ${b.description ? `<div class="small">${esc(b.description)}</div>` : ''}
            <div class="row">${b.modules.map(m => `<span class="badge">${App.biz.MODULE_LABELS[m]}</span>`).join('')}</div>
            <div class="row">
              <button class="btn small primary" data-open="${b.id}">Open dashboard</button>
              <button class="btn small" data-edit="${b.id}">Edit</button>
              <button class="btn small ghost" data-arch="${b.id}">${b.archived ? 'Restore' : 'Archive'}</button>
              <button class="btn small danger ghost" data-del="${b.id}">Delete…</button>
            </div>
          </div>`).join('')}
          <button class="card empty add-unit" data-new="${tab}"><div class="add-plus">+</div>Add ${esc(kv.unit)}<div class="muted tiny">${tab === 'individual' ? 'household, investment account, rental, side income' : 'store, location, company or venture'}</div></button>
        </div>`;

      view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; App.go('businesses'); });
      view.querySelector('[data-fam]')?.addEventListener('click', () => App.modules.wealth.membersDialog(() => App.go('businesses')));
      if (tab === 'individual') App.modules.wealth.wirePersonBar(view, () => App.go('businesses'));
      view.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { App.biz.setCurrent(b.dataset.view); App.go('dashboard'); });
      view.querySelectorAll('[data-new]').forEach(b => b.onclick = () => openForm(null, id => { App.biz.setCurrent(id); App.go('dashboard'); }, { kind: b.dataset.new }));
      view.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { App.biz.setCurrent(b.dataset.open); App.go('dashboard'); });
      view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(App.biz.get(b.dataset.edit), id => { tab = App.biz.kindOf(App.biz.get(id)); App.go('businesses'); }));
      view.querySelectorAll('[data-arch]').forEach(b => b.onclick = () => {
        const biz = App.biz.get(b.dataset.arch);
        if (!biz.archived && App.biz.active().length <= 1) return App.ui.toast('Keep at least one active unit.');
        App.biz.update(biz.id, { archived: !biz.archived });
        if (!biz.archived && App.biz.current() === biz.id) App.biz.setCurrent(`all:${App.biz.kindOf(biz)}`);
        App.go('businesses');
      });
      view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        const biz = App.biz.get(b.dataset.del);
        const others = App.biz.list().filter(x => x.id !== biz.id);
        App.ui.modal(`
          <div class="card-head"><h2>Delete ${esc(biz.name)}?</h2></div>
          <div class="stack">
            <div class="muted">${counts[biz.id] || 0} files belong to this unit.</div>
            ${others.length ? `<label class="row"><input type="radio" name="dm" value="move" checked> Move its files and notes to <select id="dTo" data-native>${App.ui.options(others.map(o => ({ value: o.id, label: `${o.name} (${K()[App.biz.kindOf(o)].label})` })), others[0].id)}</select></label>` : ''}
            <label class="row"><input type="radio" name="dm" value="delete" ${others.length ? '' : 'checked'}> Permanently delete its files and notes</label>
            <div class="confirm-actions"><button class="btn" data-close>Keep ${esc(biz.name)}</button><button class="btn destructive" id="dGo">${others.length ? 'Delete unit &amp; move files' : 'Delete unit &amp; its files'}</button></div>
          </div>`, (card, close) => {
          const go = card.querySelector('#dGo');
          card.querySelectorAll('input[name=dm]').forEach(r => r.onchange = () => { go.textContent = card.querySelector('input[name=dm]:checked').value === 'move' ? 'Delete unit & move files' : 'Delete unit & its files'; });
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
