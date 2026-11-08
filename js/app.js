/* Router, global upload/drag-drop, search, theme */
(function (App) {
  const { $, $$ } = App;
  const TITLES = {
    dashboard: 'Dashboard', library: 'Data Library', finance: 'Financial Analysis', operations: 'Business Operations',
    trading: 'Trading Risk Management', marketing: 'Marketing Strategy', research: 'Research Management',
    personnel: 'Personnel', businesses: 'Businesses & Personal', wealth: 'Net Worth', tax: 'Taxes & CPA', review: 'Targets & Weekly Review', calendar: 'Calendar', help: 'Help & tutorial', spending: 'Personal Spending', giving: 'Charitable Giving', gigs: '1099 Work', ai: 'AI Assistant', purchases: 'Purchase Journal', compliance: 'Tax & Compliance Reports', legal: 'Legal & Risk', sheet: 'Edit Table', explorer: 'Data Explorer', integrations: 'Integrations', settings: 'Settings', search: 'Search'
  };
  let current = 'dashboard';
  let renderToken = 0;

  async function go(route, params = {}) {
    if (!App.modules[route] || route === 'master' || !App.biz.enabled(route)) route = 'dashboard';
    current = route;
    syncBiz();
    $$('#tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === route || (b.dataset.tab === 'plan' && (route === 'calendar' || route === 'review'))));
    App.periodUI?.render();
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    const master = App.biz.isMaster();
    const bizName = master ? App.biz.masterLabel() : App.biz.get(App.biz.current()).name;
    $('#pageTitle').innerHTML = route === 'dashboard' ? App.esc(bizName)
      : `${App.esc(TITLES[route] || route)} <span class="crumb">· ${App.esc(bizName)}</span>`;
    $('#sidebar').classList.remove('open');
    if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
    const view = $('#view');
    view.classList.remove('page-enter'); void view.offsetWidth; view.classList.add('page-enter');
    view.innerHTML = '';
    const token = ++renderToken;
    try { await App.modules[route].render(view, params); }
    catch (e) {
      if (token !== renderToken) return; // a newer page render replaced this one
      console.error(e); view.innerHTML = App.ui.empty('Something went wrong rendering this page: ' + App.esc(e.message));
    }
    window.scrollTo({ top: 0 });
  }
  App.go = go;
  App.currentRoute = () => current;

  /* Sidebar unit switcher (businesses + personal) + per-unit nav */
  const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  function syncBiz() {
    const cur = App.biz.current();
    const biz = App.biz.isMaster() ? null : App.biz.get(cur);
    const kind = App.biz.currentKind();
    $('#wsAv').style.background = biz ? biz.color : '';
    $('#wsAv').classList.toggle('master', !biz);
    $('#wsAv').innerHTML = biz ? App.esc(initials(biz.name)) : App.fx.icon(kind === 'individual' ? 'user' : kind === 'business' ? 'businesses' : 'layers');
    $('#wsKind').textContent = biz ? `${App.biz.KINDS[App.biz.kindOf(biz)].label}${biz.archived ? ' · archived' : ''}` : 'Roll-up';
    $('#wsName').textContent = biz ? biz.name : App.biz.masterLabel();
    $('#dashLabel').textContent = biz ? 'Dashboard' : App.biz.masterLabel();
    $$('#nav a[data-route]').forEach(a => a.classList.toggle('hidden', !App.biz.enabled(a.dataset.route)));
    // Hide a section label when everything under it is hidden
    $$('#nav [data-sec-body]').forEach(sec => { const lbl = $(`#nav [data-sec="${sec.dataset.secBody}"]`); lbl.hidden = ![...sec.querySelectorAll('a')].some(a => !a.classList.contains('hidden')); });
  }

  /* Grouped menu: Business dashboard + businesses, Personal dashboard + personal units, Everything */
  function openSwitcher() {
    const btn = $('#wsBtn');
    if ($('.ws-menu')) return closeSwitcher();
    const cur = App.biz.current();
    const row = (id, label, sub, av, color) => `<button role="menuitemradio" aria-checked="${id === cur}" class="ws-item ${id === cur ? 'on' : ''}" data-ws="${id}">
      <span class="ws-av sm ${color ? '' : 'master'}" ${color ? `style="background:${color}"` : ''}>${av}</span><span class="ws-text"><span class="ws-name">${App.esc(label)}</span>${sub ? `<span class="ws-kind">${App.esc(sub)}</span>` : ''}</span>${id === cur ? '<span class="ws-tick">✓</span>' : ''}</button>`;
    const group = kind => {
      const K = App.biz.KINDS[kind], list = App.biz.units(kind);
      const n = list.length, word = kind === 'individual' ? (n === 1 ? 'unit' : 'units') : (n === 1 ? 'business' : 'businesses');
      return `<div class="ws-group"><div class="ws-head"><span>${K.plural}</span><button class="ws-add" data-ws-add="${kind}" title="Add ${K.unit}">+ Add</button></div>
        ${row('all:' + kind, K.master, `${n} ${word} rolled up`, App.fx.icon(kind === 'individual' ? 'user' : 'businesses'))}
        ${list.map(b => row(b.id, b.name, App.biz.TEMPLATES[b.type]?.label || '', App.esc(initials(b.name)), b.color)).join('') || `<div class="muted tiny ws-empty">No ${kind === 'individual' ? 'personal units' : 'businesses'} yet</div>`}</div>`;
    };
    const archived = App.biz.list().filter(b => b.archived);
    const m = document.createElement('div');
    m.className = 'ws-menu glass-pop';
    m.setAttribute('role', 'menu');
    m.innerHTML = `${group('business')}${group('individual')}
      <div class="ws-group">${row('all', 'Everything', 'businesses + personal', App.fx.icon('layers'))}</div>
      ${archived.length ? `<details class="ws-group"><summary class="ws-head"><span>Archived (${archived.length})</span></summary>${archived.map(b => row(b.id, b.name, 'archived', App.esc(initials(b.name)), b.color)).join('')}</details>` : ''}
      <div class="ws-foot"><button class="btn small ghost" data-ws-manage>${App.fx.icon('settings')} Manage units</button></div>`;
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - 308)) + 'px';
    m.style.top = (r.bottom + 6) + 'px';
    m.style.maxHeight = (innerHeight - r.bottom - 16) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    m.addEventListener('click', e => {
      const it = e.target.closest('[data-ws]'), add = e.target.closest('[data-ws-add]');
      if (it) { closeSwitcher(); App.biz.setCurrent(it.dataset.ws); go(current === 'search' || current === 'businesses' ? 'dashboard' : current); }
      else if (add) { closeSwitcher(); App.businessForm(null, id => { App.biz.setCurrent(id); go('dashboard'); }, { kind: add.dataset.wsAdd }); }
      else if (e.target.closest('[data-ws-manage]')) { closeSwitcher(); go('businesses'); }
    });
    (m.querySelector('.ws-item.on') || m.querySelector('.ws-item'))?.focus();
  }
  function closeSwitcher() { $('.ws-menu')?.remove(); $('#wsBtn').setAttribute('aria-expanded', 'false'); }
  App.openSwitcher = openSwitcher;

  /* Collapsible sidebar (icon rail) + collapsible nav sections, remembered */
  function setRail(on) {
    document.documentElement.classList.toggle('rail', on);
    App.settings.set('ui.rail', on);
    $('#railToggle').setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar');
    $('#railToggle').title = (on ? 'Expand' : 'Collapse') + ' sidebar (Ctrl+\\)';
  }
  App.toggleRail = () => setRail(!document.documentElement.classList.contains('rail'));
  function setSection(sec, open) {
    const lbl = $(`#nav [data-sec="${sec}"]`), body = $(`#nav [data-sec-body="${sec}"]`);
    lbl.setAttribute('aria-expanded', open); body.classList.toggle('closed', !open);
    const st = App.settings.get('ui.navClosed', {}); st[sec] = !open; App.settings.set('ui.navClosed', st);
  }

  function init() {
    const theme = App.settings.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    if (window.desktop) { document.documentElement.classList.add('desktop', window.desktop.platform); window.desktop.setTheme?.(theme); }
    App.lock?.boot();
    App.fx.hydrateIcons();
    App.fx.updateThemeButton();
    App.fx.watch($('#view'));
    $('#cmdkKey').textContent = /Mac/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
    $('#cmdkBtn').onclick = () => App.fx.openPalette();

    $('#nav').addEventListener('click', e => { const a = e.target.closest('a[data-route]'); if (a) go(a.dataset.route); });
    document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });
    $('#wsBtn').onclick = e => { e.stopPropagation(); openSwitcher(); };
    App.bus.on('period-changed', () => { App.periodUI.render(); go(current); });
    App.bus.on('biz-changed', () => syncBiz());
    document.addEventListener('mousedown', e => { if ($('.ws-menu') && !e.target.closest('.ws-menu, #wsBtn')) closeSwitcher(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('.ws-menu')) { closeSwitcher(); $('#wsBtn').focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); App.toggleRail(); }
    });
    $('#railToggle').onclick = () => App.toggleRail();
    setRail(!!App.settings.get('ui.rail', false));
    const closed = App.settings.get('ui.navClosed', {});
    $$('#nav [data-sec]').forEach(l => { if (closed[l.dataset.sec]) setSection(l.dataset.sec, false); l.onclick = () => setSection(l.dataset.sec, l.getAttribute('aria-expanded') !== 'true'); });
    $$('[data-theme-set]').forEach(b => b.onclick = e => App.fx.setTheme(b.dataset.themeSet, { x: e.clientX, y: e.clientY }));
    $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
    $('#helpBtn').onclick = () => App.help.open(current === 'help' ? '' : current);
    window.addEventListener('keydown', e => { if (e.key === 'F1') { e.preventDefault(); App.help.open(current === 'help' ? '' : current); } });
    // Phone tab bar
    $$('#tabbar [data-tab]').forEach(b => b.onclick = () => {
      const t = b.dataset.tab;
      if (t === 'upload') return $('#quickUpload').click();
      if (t === 'more') return $('#sidebar').classList.toggle('open');
      $('#sidebar').classList.remove('open');
      go(t === 'plan' ? (App.biz.enabled('calendar') ? 'calendar' : 'review') : t);
    });
    // Phone / web version: work offline and ask the browser to keep this device's data
    if (App.hosted) {
      document.documentElement.classList.add('hosted');
      if ('serviceWorker' in navigator) {
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(e => console.warn('Offline support unavailable', e));
        // A new version took over: reload once so the phone runs it right away
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
      }
      navigator.storage?.persist?.().catch(() => {});
    }
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) document.documentElement.classList.add('standalone');

    $('#quickUpload').onchange = async e => {
      await App.ingest.ingestMany([...e.target.files]);
      e.target.value = '';
      go(current);
    };

    let dragDepth = 0;
    const overlay = $('#dropOverlay');
    window.addEventListener('dragenter', e => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragDepth++; overlay.classList.add('show');
      $('#dropTarget').textContent = 'into ' + App.biz.get(App.biz.target()).name;
    });
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove('show'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', async e => {
      e.preventDefault(); dragDepth = 0; overlay.classList.remove('show');
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) { await App.ingest.ingestMany(files); go(current); }
    });

    // Opening page: sign in / sign up (or this-device-only) before the app opens
    (App.cloud ? App.cloud.gate() : Promise.resolve())
      .then(() => go(location.hash.slice(1) || 'dashboard'))
      .catch(e => console.error('Initial render failed', e))
      .finally(() => {
        App.fx.hideSplash(); window.desktop?.ready?.(); App.fx.maybeOnboard();
        // One-time offer of the guided tour for people who haven't seen it
        setTimeout(() => {
          if (App.settings.get('help.toured', false) || App.settings.get('help.offered', false) || !$('#modal').hidden || document.getElementById('authGate')) return;
          App.settings.set('help.offered', true);
          const n = document.createElement('div');
          n.className = 'tour-offer glass-pop';
          n.innerHTML = `<b>New here?</b><span class="muted small">Take a 1-minute tour, or press ? any time for help on the page you're on.</span><div class="row"><button class="btn small primary" data-t>Take the tour</button><button class="btn small" data-h>Open help</button><button class="btn small ghost" data-x>Not now</button></div>`;
          document.body.appendChild(n);
          n.querySelector('[data-t]').onclick = () => { n.remove(); App.help.tour(0); };
          n.querySelector('[data-h]').onclick = () => { n.remove(); App.help.open(''); };
          n.querySelector('[data-x]').onclick = () => n.remove();
        }, 2500);
        // Turn on Ollama automatically if it's installed and has a model
        App.ai?.ollamaAutodetect?.().then(on => { if (on && current === 'ai') go('ai'); }).catch(() => {});
      });
  }

  /* Global search across files, notes, and personnel rows */
  App.modules.search = {
    async render(view, { q = '' }) {
      const ql = q.toLowerCase();
      const files = (await App.store.files()).filter(f => f.name.toLowerCase().includes(ql) || (f.tags || []).join(' ').toLowerCase().includes(ql) || (f.notes || '').toLowerCase().includes(ql));
      const notes = (await App.store.all('notes')).filter(n => (n.title + ' ' + n.body + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(ql));
      const ds = await App.store.datasets();
      const rowHits = [];
      for (const d of ds) {
        for (const r of d.rows) {
          if (Object.values(r).some(v => String(v).toLowerCase().includes(ql))) { rowHits.push({ d, r }); if (rowHits.length > 50) break; }
        }
        if (rowHits.length > 50) break;
      }
      view.innerHTML = `
        <div class="card row spread"><h2>Results for “${App.esc(q)}”</h2><button class="btn small" onclick="App.fx.openPalette()">New search</button></div>
        <div class="card"><h2>Files (${files.length})</h2><div class="stack" style="margin-top:10px">${files.map(f => `<div class="row spread"><span>${App.esc(f.name)}</span><span class="badge">${App.esc(App.categories[f.category]?.label)}</span></div>`).join('') || '<span class="muted">No matches</span>'}</div></div>
        <div class="card"><h2>Notes (${notes.length})</h2><div class="stack" style="margin-top:10px">${notes.map(n => `<div><b>${App.esc(n.title)}</b> <span class="muted small">${App.esc(n.body.slice(0, 120))}</span></div>`).join('') || '<span class="muted">No matches</span>'}</div></div>
        <div class="card"><h2>Rows in data tables (${rowHits.length}${rowHits.length > 50 ? '+' : ''})</h2><div class="stack small" style="margin-top:10px">${rowHits.slice(0, 50).map(h => `<div><span class="badge">${App.esc(h.d.name)}</span> ${App.esc(Object.values(h.r).slice(0, 6).join(' · '))}</div>`).join('') || '<span class="muted">No matches</span>'}</div></div>`;
    }
  };

  /* Never fail silently: surface startup errors on screen and in the desktop log */
  function showFatal(msg) {
    window.desktop?.reportError?.(msg);
    document.getElementById('splash')?.remove();
    const v = document.getElementById('view');
    if (v && !v.children.length) v.innerHTML = `<div class="card"><h2>Something went wrong while starting</h2><p class="muted">${App.esc(msg)}</p>
      <div class="row"><button class="btn primary" onclick="location.reload()">Reload</button>${window.desktop ? '<button class="btn" onclick="window.desktop.openLogs()">Open logs</button>' : ''}</div></div>`;
  }
  window.addEventListener('error', e => window.desktop?.reportError?.(`${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', e => window.desktop?.reportError?.('Unhandled: ' + (e.reason?.stack || e.reason)));
  const safeInit = () => { try { init(); } catch (e) { console.error(e); showFatal(e.message); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
})(window.App);
