/* Dashboard: cross-module command view */
(function (App) {
  const { fmt, esc } = App;

  /* Re-run each analysis off-screen so the dashboard always reflects current data */
  async function refreshKpis() {
    App.bsettings.set('kpis', {});
    const runs = [['finance'], ['purchases'], ['operations'], ['trading', { tab: 'positions' }], ['trading', { tab: 'trades' }], ['marketing'], ['personnel']];
    for (const [mod, params] of runs) {
      if (!App.biz.enabled(mod)) continue;
      try { await App.modules[mod].render(document.createElement('div'), params || {}); } catch (e) { console.warn('KPI refresh', mod, e); }
    }
    return App.bsettings.get('kpis', {});
  }

  App.modules.dashboard = {
    refreshKpis,
    async render(view) {
      if (App.biz.isMaster()) return App.modules.master.render(view);
      const biz = App.biz.get(App.biz.current());
      const files = await App.store.files();
      const datasets = await App.store.datasets();
      const notes = await App.store.all('notes');
      if (!files.length) {
        view.innerHTML = `
          <div class="card hero"><div class="hero-grid"></div><div class="badge" style="background:rgba(255,255,255,.14);color:#fff;margin-bottom:12px">${esc(App.biz.TEMPLATES[biz.type]?.label || 'Custom')}</div><h2>${esc(biz.name)}: let's get started</h2>
            <p class="muted">Upload spreadsheets, reports, and personnel files — or connect Google Drive and Outlook — and every module (financials, operations, trading risk, marketing, research, personnel) will analyze them automatically.</p>
            <div class="row"><a class="btn primary" data-go="library">Upload files</a><a class="btn" data-go="integrations">Connect apps</a><button class="btn" id="dSample">Load sample data</button><button class="btn ghost" data-go="businesses">Manage businesses</button></div>
          </div>
          <div class="grid c3">${[
            ['upload', 'Drop in your exports', 'CSV/Excel from Harri, CrunchTime, Webull, Dub, P&Ls, campaign reports. Columns are matched automatically.', 'library'],
            ['integrations', 'Connect Drive & Outlook', 'Pull spreadsheets from Google Drive or attachments straight from your inbox.', 'integrations'],
            ['businesses', 'Add more ventures', 'Each business gets its own workspace. The Master dashboard rolls them up.', 'businesses']
          ].map(([ic, t, d, go], i) => `<a class="card note-item" data-go="${go}" style="text-decoration:none;color:inherit;padding:18px">
              <div class="row" style="gap:12px"><span class="oc-i" style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${App.fx.icon(ic)}</span>
              <span class="badge">Step ${i + 1}</span></div><h3 style="margin-top:12px">${t}</h3><div class="muted small" style="margin-top:4px">${d}</div></a>`).join('')}</div>
          <div class="row muted small"><kbd>${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd> opens the command palette from anywhere</div>`;
        view.querySelector('#dSample').onclick = async () => { await App.samples.load(); App.go('dashboard'); };
        return;
      }
      view.innerHTML = App.ui.skeleton();
      const k = await refreshKpis();
      const pu = k.purchases || {};
      const f = k.finance || {}, o = k.operations || {}, t = k.trading || {}, tp = k['trading-perf'] || {}, mk = k.marketing || {}, p = k.personnel || {};
      const openResearch = notes.filter(n => n.module === 'research' && (n.status || 'Open question') !== 'Archived' && n.status !== 'Findings ready').length;
      const tiles = [
        pu.receipts && ['Food cost %', fmt.pct(pu.foodPct), `${fmt.money(pu.food)} food · ${pu.receipts} receipts`, isNaN(pu.foodPct) ? '' : pu.foodPct <= (App.bsettings.get('ops.targets', {}).food || 0.3) ? 'good' : 'bad', 'purchases'],
        f.revenue !== undefined && ['Revenue', fmt.compact(f.revenue), `net margin ${fmt.pct(f.margin)}`, f.margin >= 0 ? 'good' : 'bad', 'finance'],
        o.laborPct !== undefined && !isNaN(o.laborPct) && ['Labor %', fmt.pct(o.laborPct), `prime cost ${fmt.pct(o.primePct)}`, '', 'operations'],
        o.splh !== undefined && !isNaN(o.splh) && ['Sales / labor hr', fmt.money(o.splh, 2), `sales ${fmt.compact(o.sales)}`, '', 'operations'],
        t.gross !== undefined && ['Gross exposure', fmt.compact(t.gross), `${t.positions} positions · top ${fmt.pct(t.topWeight)}`, '', 'trading'],
        t.upl !== undefined && ['Unrealized P&L', fmt.money(t.upl), '', t.upl >= 0 ? 'good' : 'bad', 'trading'],
        tp.total !== undefined && ['Realized P&L', fmt.money(tp.total), `win rate ${fmt.pct(tp.winRate)} · VaR ${fmt.money(tp.hVaR)}`, tp.total >= 0 ? 'good' : 'bad', 'trading'],
        mk.spend !== undefined && ['Marketing spend', fmt.compact(mk.spend), mk.roas ? `ROAS ${(+mk.roas).toFixed(2)}×` : '', '', 'marketing'],
        p.headcount !== undefined && ['Active headcount', fmt.num(p.headcount), `turnover ${fmt.pct(p.turnover)}`, '', 'personnel'],
        App.biz.enabled('research') && ['Open research', fmt.num(openResearch), `${notes.length} notes`, '', 'research']
      ].filter(Boolean);
      const alertMods = [['purchases', 'Purchases', pu], ['finance', 'Financials', f], ['operations', 'Operations', o], ['trading', 'Positions', t], ['trading', 'Trade performance', tp], ['marketing', 'Marketing', mk], ['personnel', 'Personnel', p]].filter(([, , d]) => d.alerts);
      const byCat = {};
      files.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + 1);
      const bySrc = {};
      files.forEach(x => bySrc[x.source] = (bySrc[x.source] || 0) + 1);

      view.innerHTML = `
        <div class="card biz-card row spread" style="--bc:${biz.color};flex-direction:row">
          <div><h2>${esc(biz.name)}</h2><div class="muted small">${esc(App.biz.TEMPLATES[biz.type]?.label || 'Custom')}${biz.description ? ' · ' + esc(biz.description) : ''}</div></div>
          <div class="row no-print"><button class="btn small primary" onclick="App.fx.aiBriefing()">${App.fx.icon('sparkles')} AI briefing</button><button class="btn small" id="dEdit">Edit business</button><button class="btn small" id="dMaster">Master dashboard</button></div>
        </div>
        <div class="grid k4">${tiles.map(([l, v, s, tone, go]) => `<a data-go="${go}" style="text-decoration:none;color:inherit">${App.ui.kpi(l, v, s, tone)}</a>`).join('')}</div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Needs attention</h2><span class="badge ${alertMods.length ? 'warn' : 'good'}">${App.sum(alertMods.map(a => a[2].alerts))} flags</span></div>
            <div class="stack">${alertMods.map(([go, l, d]) => `<a data-go="${go}" class="alert warn" style="text-decoration:none;color:inherit"><b>${esc(l)}</b><span>${d.alerts} item${d.alerts > 1 ? 's' : ''} flagged — review →</span></a>`).join('') || '<div class="alert good">No flags across modules.</div>'}</div>
          </div>
          <div class="card"><div class="card-head"><h2>Data coverage</h2><span class="muted small">${files.length} files · ${datasets.length} tables</span></div><div class="chart-box" style="height:220px"><canvas id="dCov"></canvas></div></div>
        </div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Recent uploads</h2><a data-go="library" class="small">All files →</a></div>
            <div class="stack">${files.slice(0, 8).map(x => `<div class="row spread"><span>${esc(x.name)}</span><span class="row"><span class="badge">${esc(App.categories[x.category]?.label)}</span><span class="badge" style="border-color:${App.sources[x.source]?.color}">${esc(App.sources[x.source]?.label || x.source)}</span></span></div>`).join('')}</div></div>
          <div class="card"><div class="card-head"><h2>By source system</h2><a data-go="integrations" class="small">Integrations →</a></div>
            <div class="stack">${Object.entries(bySrc).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<div class="row spread"><span class="row"><span style="width:10px;height:10px;border-radius:3px;background:${App.sources[s]?.color}"></span>${esc(App.sources[s]?.label || s)}</span><b>${n}</b></div>`).join('')}</div></div>
        </div>
        <div class="row no-print"><button class="btn" onclick="window.print()">Print / save as PDF</button><span class="muted small">Updated ${new Date().toLocaleTimeString()}</span></div>`;
      view.querySelector('#dEdit').onclick = () => App.businessForm(biz, () => App.go('dashboard'));
      view.querySelector('#dMaster').onclick = () => { App.biz.setCurrent('all'); App.go('dashboard'); };
      const cats = Object.keys(byCat);
      App.ui.chart('dCov', 'doughnut', { labels: cats.map(c => App.categories[c]?.label || c), datasets: [{ data: cats.map(c => byCat[c]), backgroundColor: cats.map(c => App.categories[c]?.color || '#64748b') }] }, { plugins: { legend: { position: 'right', labels: { color: App.ui.cssVar('--muted') } } } });
    }
  };
})(window.App);
