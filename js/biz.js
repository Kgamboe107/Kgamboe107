/* Units: businesses (stores, ventures) and personal units (household finances, investment accounts,
   rentals, side income). Each has its own data, settings, targets and dashboard.
   Roll-up views: "all:business" (Business dashboard), "all:individual" (Personal dashboard), "all" (everything). */
(function (App) {
  const ALL_MODULES = ['finance', 'purchases', 'operations', 'trading', 'marketing', 'research', 'personnel'];
  const MODULE_LABELS = { finance: 'Financials', purchases: 'Purchases', operations: 'Operations', trading: 'Trading Risk', marketing: 'Marketing', research: 'Research', personnel: 'Personnel' };
  const KINDS = {
    business: { label: 'Business', plural: 'Businesses', master: 'Business dashboard', unit: 'business', icon: 'businesses', blurb: 'Stores, locations, companies and ventures' },
    individual: { label: 'Personal', plural: 'Personal', master: 'Personal dashboard', unit: 'personal unit', icon: 'personnel', blurb: 'Your own money: household, investments, rentals, side income' }
  };
  const TEMPLATES = {
    restaurant: { kind: 'business', label: 'Restaurant / hospitality', modules: ['finance', 'purchases', 'operations', 'marketing', 'research', 'personnel'] },
    ecommerce: { kind: 'business', label: 'E-commerce / retail', modules: ['finance', 'purchases', 'operations', 'marketing', 'research', 'personnel'] },
    services: { kind: 'business', label: 'Services / consulting', modules: ['finance', 'purchases', 'marketing', 'research', 'personnel'] },
    realestate: { kind: 'business', label: 'Real estate company', modules: ['finance', 'purchases', 'operations', 'research'] },
    trading: { kind: 'business', label: 'Trading firm / fund', modules: ['finance', 'trading', 'research'] },
    startup: { kind: 'business', label: 'Startup / new venture', modules: ['finance', 'purchases', 'marketing', 'research'] },
    custom: { kind: 'business', label: 'Custom business', modules: ALL_MODULES.slice() },
    // Personal units get every page too (turn any off in Units); P&L, operations, marketing and staff apply to side businesses, rentals and households
    personal: { kind: 'individual', label: 'Personal finances', modules: ALL_MODULES.slice() },
    investing: { kind: 'individual', label: 'Investing & trading account', modules: ALL_MODULES.slice() },
    rental: { kind: 'individual', label: 'Rental property', modules: ALL_MODULES.slice() },
    freelance: { kind: 'individual', label: 'Freelance / side income', modules: ALL_MODULES.slice() },
    household: { kind: 'individual', label: 'Household & family', modules: ALL_MODULES.slice() },
    icustom: { kind: 'individual', label: 'Custom personal unit', modules: ALL_MODULES.slice() }
  };
  const COLORS = ['#2563eb', '#059669', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#ea580c', '#475569'];

  const kindOf = b => (b && (b.kind || TEMPLATES[b.type]?.kind)) || 'business';
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
    // v1.24: personal units get every page (nothing missing compared with businesses)
    if (l.some(b => !b.mv4)) {
      l.forEach(b => { if (!b.mv4) { b.mv4 = true; if (kindOf(b) === 'individual') b.modules = [...new Set([...(b.modules || []), ...ALL_MODULES])]; } });
      App.settings.set('businesses', l);
    }
    return l;
  }
  const active = () => list().filter(b => !b.archived);
  const get = id => list().find(b => b.id === id);
  function save(l) { App.settings.set('businesses', l); App.bus.emit('biz-changed'); }

  const MASTERS = ['all', 'all:business', 'all:individual'];
  function current() {
    const c = App.settings.get('activeBiz', 'main');
    if (MASTERS.includes(c)) return c;
    return get(c) ? c : list()[0].id;
  }
  const isMaster = () => MASTERS.includes(current());
  /* 'business' | 'individual' for a roll-up view, else null */
  const masterKind = () => ({ 'all:business': 'business', 'all:individual': 'individual' })[current()] || null;
  /* The kind the user is working in right now (a unit's kind, or the roll-up's) */
  const currentKind = () => isMaster() ? masterKind() : kindOf(get(current()));
  const units = kind => active().filter(b => !kind || kindOf(b) === kind);
  /* Units included in the current view */
  const inView = () => isMaster() ? units(masterKind()) : [get(current())].filter(Boolean);
  function masterLabel(id = current()) { return id === 'all:business' ? KINDS.business.master : id === 'all:individual' ? KINDS.individual.master : 'Everything'; }
  function setCurrent(id) { App.settings.set('activeBiz', id); App.bus.emit('biz-changed'); }
  /* Where new uploads go: the active unit (or the first one in the roll-up being viewed) */
  const target = () => isMaster() ? (inView()[0] || active()[0] || list()[0]).id : current();
  const idOf = rec => rec.businessId || 'main';
  const inScope = rec => {
    if (!isMaster()) return idOf(rec) === current();
    const mk = masterKind();
    return !mk || kindOf(get(idOf(rec))) === mk;
  };

  function enabled(mod) {
    // The calendar covers business and personal together, so it lives in the Everything view
    if (mod === 'calendar') return current() === 'all';
    // Personal spending (receipts) is for personal units and the Personal dashboard
    if (mod === 'spending') return currentKind() === 'individual';
    // Personal units have every business page too (household employees, side LLCs, rentals); only Net Worth / Taxes & CPA / Spending are personal-only
    if ((mod === 'wealth' || mod === 'tax') && currentKind() === 'business') return false;
    if (!ALL_MODULES.includes(mod)) return true;
    if (isMaster()) return inView().some(b => b.modules.includes(mod));
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
      id: App.uid(), name: data.name || 'New venture', type: data.type || 'custom', kind: data.kind || TEMPLATES[data.type]?.kind || 'business',
      color: data.color || COLORS[l.length % COLORS.length], modules: data.modules || (TEMPLATES[data.type] || TEMPLATES.custom).modules.slice(),
      description: data.description || '', started: data.started || '', createdAt: Date.now(),
      ...(data.owner ? { owner: data.owner } : {}),
      ...(data.ownerUnit ? { ownerUnit: data.ownerUnit, share: data.share ?? 100, profitToPersonal: data.profitToPersonal !== false } : {})
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

  /* Businesses whose profit belongs to a personal unit */
  const ownedBy = pid => active().filter(b => kindOf(b) === 'business' && b.ownerUnit === pid);
  App.biz = { ownedBy, KINDS, kindOf, masterKind, currentKind, units, inView, masterLabel, ALL_MODULES, MODULE_LABELS, TEMPLATES, COLORS, list, active, get, current, isMaster, setCurrent, target, idOf, inScope, enabled, withBiz, create, update, remove, moveData };
  App.bsettings = bsettings;
})(window.App);
