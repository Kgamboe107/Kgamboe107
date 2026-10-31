/* Router, global upload/drag-drop, search, theme */
(function (App) {
  const { $, $$ } = App;
  const TITLES = {
    dashboard: 'Dashboard', library: 'Data Library', finance: 'Financial Analysis', operations: 'Business Operations',
    trading: 'Trading Risk Management', marketing: 'Marketing Strategy', research: 'Research Management',
    personnel: 'Personnel', businesses: 'Businesses', explorer: 'Data Explorer', integrations: 'Integrations', settings: 'Settings', search: 'Search'
  };
  let current = 'dashboard';

  async function go(route, params = {}) {
    if (!App.modules[route] || route === 'master' || !App.biz.enabled(route)) route = 'dashboard';
    current = route;
    syncBiz();
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    const master = App.biz.isMaster();
    const bizName = master ? 'All businesses' : App.biz.get(App.biz.current()).name;
    $('#pageTitle').textContent = route === 'dashboard' ? (master ? 'Master Dashboard' : bizName) : `${TITLES[route] || route} · ${bizName}`;
    $('#sidebar').classList.remove('open');
    if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
    const view = $('#view');
    view.innerHTML = '';
    try { await App.modules[route].render(view, params); }
    catch (e) { console.error(e); view.innerHTML = App.ui.empty('Something went wrong rendering this page: ' + App.esc(e.message)); }
    view.scrollTop = 0;
  }
  App.go = go;

  /* Sidebar business switcher + per-business nav */
  function syncBiz() {
    const cur = App.biz.current();
    const sel = $('#bizSelect');
    const live = App.biz.active();
    const archived = App.biz.list().filter(b => b.archived);
    sel.innerHTML = `<option value="all" ${cur === 'all' ? 'selected' : ''}>★ All businesses (Master)</option>`
      + live.map(b => `<option value="${b.id}" ${b.id === cur ? 'selected' : ''}>${App.esc(b.name)}</option>`).join('')
      + (archived.length ? `<optgroup label="Archived">${archived.map(b => `<option value="${b.id}" ${b.id === cur ? 'selected' : ''}>${App.esc(b.name)}</option>`).join('')}</optgroup>` : '')
      + `<option value="__new">+ New business…</option>`;
    const biz = cur === 'all' ? null : App.biz.get(cur);
    $('#dashLabel').textContent = biz ? 'Dashboard' : 'Master Dashboard';
    $('#brandSub').textContent = biz ? biz.name : 'All businesses';
    $('#brandMark').style.background = biz ? biz.color : '';
    $('#brandMark').textContent = biz ? biz.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'OC';
    $$('#nav a[data-route]').forEach(a => a.classList.toggle('hidden', !App.biz.enabled(a.dataset.route)));
  }

  function init() {
    const theme = App.settings.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    $('#themeToggle').onclick = () => {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = t;
      App.settings.set('theme', t);
      go(current);
    };

    $('#nav').addEventListener('click', e => { const a = e.target.closest('a[data-route]'); if (a) go(a.dataset.route); });
    document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });
    $('#bizSelect').onchange = e => {
      const v = e.target.value;
      if (v === '__new') { syncBiz(); App.businessForm(null, id => { App.biz.setCurrent(id); go('dashboard'); }); return; }
      App.biz.setCurrent(v);
      go(current === 'search' || current === 'businesses' ? 'dashboard' : current);
    };
    $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');

    $('#quickUpload').onchange = async e => {
      await App.ingest.ingestMany([...e.target.files]);
      e.target.value = '';
      go(current === 'dashboard' ? 'library' : current);
    };

    let dragDepth = 0;
    const overlay = $('#dropOverlay');
    window.addEventListener('dragenter', e => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth++; overlay.classList.add('show'); } });
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove('show'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', async e => {
      e.preventDefault(); dragDepth = 0; overlay.classList.remove('show');
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) { await App.ingest.ingestMany(files); go(current); }
    });

    let st;
    $('#globalSearch').addEventListener('input', e => {
      clearTimeout(st);
      const q = e.target.value.trim();
      st = setTimeout(() => { if (q.length >= 2) go('search', { q }); else if (current === 'search') go('dashboard'); }, 250);
    });

    go(location.hash.slice(1) || 'dashboard');
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
        <div class="card"><h2>Files (${files.length})</h2><div class="stack" style="margin-top:10px">${files.map(f => `<div class="row spread"><span>${App.esc(f.name)}</span><span class="badge">${App.esc(App.categories[f.category]?.label)}</span></div>`).join('') || '<span class="muted">No matches</span>'}</div></div>
        <div class="card"><h2>Notes (${notes.length})</h2><div class="stack" style="margin-top:10px">${notes.map(n => `<div><b>${App.esc(n.title)}</b> <span class="muted small">${App.esc(n.body.slice(0, 120))}</span></div>`).join('') || '<span class="muted">No matches</span>'}</div></div>
        <div class="card"><h2>Rows in data tables (${rowHits.length}${rowHits.length > 50 ? '+' : ''})</h2><div class="stack small" style="margin-top:10px">${rowHits.slice(0, 50).map(h => `<div><span class="badge">${App.esc(h.d.name)}</span> ${App.esc(Object.values(h.r).slice(0, 6).join(' · '))}</div>`).join('') || '<span class="muted">No matches</span>'}</div></div>`;
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.App);
