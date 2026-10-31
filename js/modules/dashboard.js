/* Dashboard: cross-module command view */
(function (App) {
  const { fmt, esc } = App;

  /* Re-run each analysis off-screen so the dashboard always reflects current data */
  async function refreshKpis() {
    App.settings.set('kpis', {});
    const runs = [['finance'], ['operations'], ['trading', { tab: 'positions' }], ['trading', { tab: 'trades' }], ['marketing'], ['personnel']];
    for (const [mod, params] of runs) {
      try { await App.modules[mod].render(document.createElement('div'), params || {}); } catch (e) { console.warn('KPI refresh', mod, e); }
    }
    return App.settings.get('kpis', {});
  }

  App.modules.dashboard = {
    async render(view) {
      const files = await App.store.files();
      const datasets = await App.store.datasets();
      const notes = await App.store.all('notes');
      if (!files.length) {
        view.innerHTML = `
          <div class="card"><h2>Welcome to your operations desk</h2>
            <p class="muted">Upload spreadsheets, reports, and personnel files — or connect Google Drive and Outlook — and every module (financials, operations, trading risk, marketing, research, personnel) will analyze them automatically.</p>
            <div class="row"><a class="btn primary" data-go="library">Upload files</a><a class="btn" data-go="integrations">Connect apps</a><button class="btn" id="dSample">Load sample data</button></div>
          </div>
          <div class="grid c3">${Object.entries(App.sources).filter(([k]) => k !== 'manual').map(([, s]) => `<div class="card row"><span class="badge" style="background:${s.color};color:#fff;border:none">${esc(s.label)}</span><span class="muted small">ready</span></div>`).join('')}</div>`;
        view.querySelector('#dSample').onclick = async () => { await App.samples.load(); App.go('dashboard'); };
        return;
      }
      view.innerHTML = `<div class="muted small">Refreshing analyses…</div>`;
      const k = await refreshKpis();
      const f = k.finance || {}, o = k.operations || {}, t = k.trading || {}, tp = k['trading-perf'] || {}, mk = k.marketing || {}, p = k.personnel || {};
      const openResearch = notes.filter(n => n.module === 'research' && (n.status || 'Open question') !== 'Archived' && n.status !== 'Findings ready').length;
      const tiles = [
        f.revenue !== undefined && ['Revenue', fmt.compact(f.revenue), `net margin ${fmt.pct(f.margin)}`, f.margin >= 0 ? 'good' : 'bad', 'finance'],
        o.laborPct !== undefined && !isNaN(o.laborPct) && ['Labor %', fmt.pct(o.laborPct), `prime cost ${fmt.pct(o.primePct)}`, '', 'operations'],
        o.splh !== undefined && !isNaN(o.splh) && ['Sales / labor hr', fmt.money(o.splh, 2), `sales ${fmt.compact(o.sales)}`, '', 'operations'],
        t.gross !== undefined && ['Gross exposure', fmt.compact(t.gross), `${t.positions} positions · top ${fmt.pct(t.topWeight)}`, '', 'trading'],
        t.upl !== undefined && ['Unrealized P&L', fmt.money(t.upl), '', t.upl >= 0 ? 'good' : 'bad', 'trading'],
        tp.total !== undefined && ['Realized P&L', fmt.money(tp.total), `win rate ${fmt.pct(tp.winRate)} · VaR ${fmt.money(tp.hVaR)}`, tp.total >= 0 ? 'good' : 'bad', 'trading'],
        mk.spend !== undefined && ['Marketing spend', fmt.compact(mk.spend), mk.roas ? `ROAS ${(+mk.roas).toFixed(2)}×` : '', '', 'marketing'],
        p.headcount !== undefined && ['Active headcount', fmt.num(p.headcount), `turnover ${fmt.pct(p.turnover)}`, '', 'personnel'],
        ['Open research', fmt.num(openResearch), `${notes.length} notes`, '', 'research']
      ].filter(Boolean);
      const alertMods = [['finance', 'Financials', f], ['operations', 'Operations', o], ['trading', 'Positions', t], ['trading', 'Trade performance', tp], ['marketing', 'Marketing', mk], ['personnel', 'Personnel', p]].filter(([, , d]) => d.alerts);
      const byCat = {};
      files.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + 1);
      const bySrc = {};
      files.forEach(x => bySrc[x.source] = (bySrc[x.source] || 0) + 1);

      view.innerHTML = `
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
      const cats = Object.keys(byCat);
      App.ui.chart('dCov', 'doughnut', { labels: cats.map(c => App.categories[c]?.label || c), datasets: [{ data: cats.map(c => byCat[c]), backgroundColor: cats.map(c => App.categories[c]?.color || '#64748b') }] }, { plugins: { legend: { position: 'right', labels: { color: App.ui.cssVar('--muted') } } } });
    }
  };
})(window.App);
