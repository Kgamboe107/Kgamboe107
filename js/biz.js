/* Businesses / ventures: each has its own data, settings, targets and dashboard.
   "all" is the Master view that consolidates every business. */
(function (App) {
  const ALL_MODULES = ['finance', 'purchases', 'operations', 'trading', 'marketing', 'research', 'personnel'];
  const MODULE_LABELS = { finance: 'Financials', purchases: 'Purchases', operations: 'Operations', trading: 'Trading Risk', marketing: 'Marketing', research: 'Research', personnel: 'Personnel' };
  const TEMPLATES = {
    restaurant: { label: 'Restaurant / hospitality', modules: ['finance', 'purchases', 'operations', 'marketing', 'research', 'personnel'] },
    trading: { label: 'Trading / investing', modules: ['finance', 'trading', 'research'] },
    ecommerce: { label: 'E-commerce / retail', modules: ['finance', 'purchases', 'operations', 'marketing', 'research', 'personnel'] },
    services: { label: 'Services / consulting', modules: ['finance', 'purchases', 'marketing', 'research', 'personnel'] },
    realestate: { label: 'Real estate', modules: ['finance', 'purchases', 'operations', 'research'] },
    startup: { label: 'Startup / new venture', modules: ['finance', 'purchases', 'marketing', 'research'] },
    custom: { label: 'Custom', modules: ALL_MODULES.slice() }
  };
  const COLORS = ['#2563eb', '#059669', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#ea580c', '#475569'];

  function list() {
    let l = App.settings.get('businesses', null);
    if (!Array.isArray(l) || !l.length) {
      l = [{ id: 'main', name: 'Main Business', type: 'custom', color: COLORS[0], modules: ALL_MODULES.slice(), description: '', createdAt: Date.now() }];
      App.settings.set('businesses', l);
    }
    // v1.3: give existing businesses the Purchases module once (they can turn it off)
    if (l.some(b => !b.mv3)) {
      l.forEach(b => { if (!b.mv3) { b.mv3 = true; if (b.type !== 'trading' && !b.modules.includes('purchases')) b.modules.splice(1, 0, 'purchases'); } });
      App.settings.set('businesses', l);
    }
    return l;
  }
  const active = () => list().filter(b => !b.archived);
  const get = id => list().find(b => b.id === id);
  function save(l) { App.settings.set('businesses', l); App.bus.emit('biz-changed'); }

  function current() {
    const c = App.settings.get('activeBiz', 'main');
    if (c === 'all') return 'all';
    return get(c) ? c : list()[0].id;
  }
  const isMaster = () => current() === 'all';
  function setCurrent(id) { App.settings.set('activeBiz', id); App.bus.emit('biz-changed'); }
  /* Where new uploads go: the active business (or the first one while in Master view) */
  const target = () => isMaster() ? active()[0]?.id || list()[0].id : current();
  const idOf = rec => rec.businessId || 'main';
  const inScope = rec => isMaster() || idOf(rec) === current();

  function enabled(mod) {
    if (!ALL_MODULES.includes(mod)) return true;
    if (isMaster()) return active().some(b => b.modules.includes(mod));
    return (get(current())?.modules || ALL_MODULES).includes(mod);
  }

  /* Temporarily switch scope (used to compute each business's KPIs for the Master dashboard) */
  async function withBiz(id, fn) {
    const prev = App.settings.get('activeBiz', 'main');
    App.settings.set('activeBiz', id);
    try { return await fn(); } finally { App.settings.set('activeBiz', prev); }
  }

  function create(data) {
    const l = list();
    const b = {
      id: App.uid(), name: data.name || 'New venture', type: data.type || 'custom',
      color: data.color || COLORS[l.length % COLORS.length], modules: data.modules || TEMPLATES[data.type || 'custom'].modules.slice(),
      description: data.description || '', started: data.started || '', createdAt: Date.now()
    };
    l.push(b); save(l);
    return b;
  }
  function update(id, patch) { const l = list(); Object.assign(l.find(b => b.id === id), patch); save(l); }

  /* Move every file/table/note from one business to another */
  async function moveData(fromId, toId) {
    for (const s of ['files', 'datasets', 'notes']) {
      for (const r of await App.store.all(s, { raw: true })) {
        if (idOf(r) === fromId) { r.businessId = toId; await App.store.put(s, r); }
      }
    }
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(`ocd.b.${fromId}.`)) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
    }
  }
  async function remove(id, { moveTo } = {}) {
    if (moveTo) await moveData(id, moveTo);
    else {
      for (const f of await App.store.all('files', { raw: true })) if (idOf(f) === id) await App.store.deleteFile(f.id);
      for (const n of await App.store.all('notes', { raw: true })) if (idOf(n) === id) await App.store.del('notes', n.id);
    }
    const l = list().filter(b => b.id !== id);
    if (!l.length) l.push({ id: App.uid(), name: 'Main Business', type: 'custom', color: COLORS[0], modules: ALL_MODULES.slice(), createdAt: Date.now() });
    save(l);
    if (App.settings.get('activeBiz') === id) setCurrent('all');
  }

  /* Settings scoped to the active business (targets, column mappings, KPIs, strategy notes) */
  const bsettings = {
    get(k, d) {
      const v = App.settings.get(`b.${current()}.${k}`, undefined);
      if (v !== undefined) return v;
      if (current() === 'main') return App.settings.get(k, d); // data saved before businesses existed
      return d;
    },
    set(k, v) { App.settings.set(`b.${current()}.${k}`, v); }
  };

  App.biz = { ALL_MODULES, MODULE_LABELS, TEMPLATES, COLORS, list, active, get, current, isMaster, setCurrent, target, idOf, inScope, enabled, withBiz, create, update, remove, moveData };
  App.bsettings = bsettings;
})(window.App);
