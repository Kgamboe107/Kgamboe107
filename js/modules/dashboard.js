/* Dashboard: cross-module command view */
(function (App) {
  const { fmt, esc } = App;
  const num = v => typeof v === 'number' && Number.isFinite(v); // saved KPIs round-trip through JSON (NaN → null)

  /* Re-run each analysis off-screen so the dashboard always reflects current data */
  async function refreshKpis() {
    App.bsettings.set('kpis', {});
    const runs = [['wealth'], ['finance'], ['purchases'], ['compliance'], ['legal'], ['operations'], ['trading', { tab: 'positions' }], ['trading', { tab: 'trades' }], ['marketing'], ['personnel']];
    for (const [mod, params] of runs) {
      if (!App.biz.enabled(mod)) continue;
      try { await App.modules[mod].render(document.createElement('div'), params || {}); } catch (e) { console.warn('KPI refresh', mod, e); }
    }
    return App.bsettings.get('kpis', {});
  }

  /* Goals scorecard (e.g. from a team-meeting deck) with live numbers where the app can measure them */
  async function goalsCard(datasets) {
    const sc = datasets.filter(d => d.meta?.kind === 'scorecard').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    if (!sc) return '';
    const daily = datasets.find(d => d.rolling && d.headers.includes('Net Sales') && d.headers.includes('Date'));
    let week = null;
    if (daily) {
      const byWeek = new Map();
      for (const r of daily.rows) { const k = r.Week || r.Date; const w = byWeek.get(k) || { start: k, days: 0, sales: 0, labor: 0 }; w.days++; w.sales += +r['Net Sales'] || 0; w.labor += +r['Labor Cost'] || 0; byWeek.set(k, w); }
      week = [...byWeek.values()].filter(w => w.days >= 7).sort((a, b) => b.start.localeCompare(a.start))[0] || null;
    }
    const H = sc.headers;
    const live = row => {
      const m = String(Object.values(row)[0] || '');
      if (week && /weekly sales|sales a week|sales per week/i.test(m) && !/catering/i.test(m)) return `<b>${fmt.compact(week.sales)}</b> <span class="muted tiny">week of ${fmt.date(week.start)}</span>`;
      const G = App.guest?.summary();
      const smgKey = /overall satisfaction/i.test(m) ? 'overall' : /speed/i.test(m) ? 'speed' : /cleanliness/i.test(m) ? 'clean' : /digital accuracy/i.test(m) ? 'digital' : /friendl/i.test(m) ? 'friendly' : /taste/i.test(m) ? 'taste' : '';
      if (G?.last && smgKey && G.last.scores?.[smgKey] != null) return `<b>${G.last.scores[smgKey]}%</b> <span class="muted tiny">SMG to ${fmt.date(G.last.to)}</span>`;
      if (G?.lastSelf && /audit|self-?eval/i.test(m)) return `<b>${Math.round(G.lastSelf.s.score * 100)}%</b> <span class="muted tiny">${esc(G.lastSelf.type.toLowerCase())} ${fmt.date(G.lastSelf.date)}</span>`;
      return '';
    };
    const anyLive = sc.rows.some(r => live(r));
    const liveNote = [week ? 'CrunchTime sales' : '', App.guest?.summary().last || App.guest?.summary().lastA ? 'SMG scores & audits' : ''].filter(Boolean).join(' and ');
    return `<div class="card"><div class="card-head"><div><h2>Goals scorecard</h2><div class="muted small">From ${esc(sc.meta.deck || sc.name)}${sc.meta.slide ? `, slide ${sc.meta.slide}` : ''}${anyLive ? ` · live numbers from your ${liveNote}` : ''}</div></div><a data-go="research" class="small">Meeting note →</a></div>
      <div class="table-wrap"><table><thead><tr>${H.map(h => `<th>${esc(h)}</th>`).join('')}${anyLive ? '<th>Latest (live)</th>' : ''}</tr></thead>
      <tbody>${sc.rows.map(r => `<tr>${H.map((h, i) => `<td${i ? '' : ' style="font-weight:600"'}>${esc(r[h])}</td>`).join('')}${anyLive ? `<td>${live(r)}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
  }

  App.modules.dashboard = {
    refreshKpis,
    async render(view) {
      if (App.biz.isMaster()) return App.modules.master.render(view);
      const biz = App.biz.get(App.biz.current());
      const personalUnit = App.biz.kindOf(biz) === 'individual';
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
            ['businesses', 'Add more units', 'Add businesses and personal units (household, investments, rentals). Each kind has its own roll-up dashboard.', 'businesses']
          ].map(([ic, t, d, go], i) => `<a class="card note-item" data-go="${go}" style="text-decoration:none;color:inherit;padding:18px">
              <div class="row" style="gap:12px"><span class="oc-i" style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${App.fx.icon(ic)}</span>
              <span class="badge">Step ${i + 1}</span></div><h3 style="margin-top:12px">${t}</h3><div class="muted small" style="margin-top:4px">${d}</div></a>`).join('')}</div>
          <div class="row muted small"><kbd>${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd> opens the command palette from anywhere</div>`;
        view.querySelector('#dSample').onclick = async () => { await App.samples.load(); App.go('dashboard'); };
        return;
      }
      view.innerHTML = App.ui.skeleton();
      const k = await refreshKpis();
      const pu = k.purchases || {}, cm = k.compliance || {}, lg = k.legal || {};
      const f = k.finance || {}, o = k.operations || {}, t = k.trading || {}, tp = k['trading-perf'] || {}, mk = k.marketing || {}, p = k.personnel || {}, gs = k.guest || {};
      const openResearch = notes.filter(n => n.module === 'research' && (n.status || 'Open question') !== 'Archived' && n.status !== 'Findings ready').length;
      const tiles = [
        lg.score !== undefined && ['Lawsuit protection', isNaN(lg.score) ? '—' : Math.round(lg.score * 100) + '%', lg.high ? `${lg.high} high-risk gap${lg.high > 1 ? 's' : ''}` : `${lg.gaps || 0} gaps`, lg.high ? 'bad' : lg.score >= 0.85 ? 'good' : 'warn', 'legal'],
        cm.score !== undefined && ['Audit readiness', isNaN(cm.score) ? '—' : Math.round(cm.score * 100) + '%', cm.overdue ? `${cm.overdue} overdue filing${cm.overdue > 1 ? 's' : ''}` : `${cm.dueSoon || 0} due in 30 days`, cm.overdue ? 'bad' : cm.score >= 0.85 ? 'good' : 'warn', 'compliance'],
        pu.receipts && ['Food cost %', fmt.pct(pu.foodPct), `${fmt.money(pu.food)} food · ${pu.receipts} receipts`, isNaN(pu.foodPct) ? '' : pu.foodPct <= (App.bsettings.get('ops.targets', {}).food || 0.3) ? 'good' : 'bad', 'purchases'],
        personalUnit && k.wealth?.accounts && ['Net worth', fmt.compact(k.wealth.net), `${fmt.compact(k.wealth.assets)} assets · ${fmt.compact(k.wealth.debts)} debts`, k.wealth.net >= 0 ? 'good' : 'bad', 'wealth'],
        f.revenue !== undefined && [personalUnit ? 'Income' : 'Revenue', fmt.compact(f.revenue), `${personalUnit ? 'savings rate' : 'net margin'} ${fmt.pct(f.margin)}`, f.margin >= 0 ? 'good' : 'bad', 'finance'],
        num(o.laborPct) && ['Labor %', fmt.pct(o.laborPct), `prime cost ${fmt.pct(o.primePct)}`, '', 'operations'],
        num(o.splh) && ['Sales / labor hr', fmt.money(o.splh, 2), `sales ${fmt.compact(o.sales)}`, '', 'operations'],
        t.gross !== undefined && ['Gross exposure', fmt.compact(t.gross), `${t.positions} positions · top ${fmt.pct(t.topWeight)}`, '', 'trading'],
        t.upl !== undefined && ['Unrealized P&L', fmt.money(t.upl), '', t.upl >= 0 ? 'good' : 'bad', 'trading'],
        tp.total !== undefined && ['Realized P&L', fmt.money(tp.total), `win rate ${fmt.pct(tp.winRate)} · VaR ${fmt.money(tp.hVaR)}`, tp.total >= 0 ? 'good' : 'bad', 'trading'],
        num(gs.overall) && ['Guest satisfaction', gs.overall + '%', `SMG ${gs.smgPeriod}${num(gs.overallPrev) ? ` · ${gs.overall >= gs.overallPrev ? '▲' : '▼'} ${Math.abs(gs.overall - gs.overallPrev).toFixed(1).replace(/\.0$/, '')} pts` : ''}`, gs.overall >= App.guest.targets().overall ? 'good' : 'bad', 'marketing'],
        num(gs.audit) && ['Store audit (7 Principles)', Math.round(gs.audit * 100) + '%', `${gs.auditType} · ${fmt.date(gs.auditDate)}${gs.weakest ? ' · weakest: ' + gs.weakest : ''}`, gs.audit * 100 >= App.guest.targets().audit ? 'good' : gs.audit * 100 >= App.guest.targets().auditGate ? 'warn' : 'bad', 'marketing'],
        mk.spend !== undefined && ['Marketing spend', fmt.compact(mk.spend), mk.roas ? `ROAS ${(+mk.roas).toFixed(2)}×` : '', '', 'marketing'],
        p.headcount !== undefined && ['Active headcount', fmt.num(p.headcount), `turnover ${fmt.pct(p.turnover)}`, '', 'personnel'],
        App.biz.enabled('research') && ['Open research', fmt.num(openResearch), `${notes.length} notes`, '', 'research']
      ].filter(Boolean);
      const alertMods = [['legal', 'Legal & risk', lg], ['compliance', 'Tax & compliance', cm], ['purchases', 'Purchases', pu], ['finance', 'Financials', f], ['operations', 'Operations', o], ['trading', 'Positions', t], ['trading', 'Trade performance', tp], ['marketing', 'Marketing', mk], ['marketing', 'Guest scores & audits', gs], ['personnel', 'Personnel', p]].filter(([, , d]) => d.alerts);
      const byCat = {};
      files.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + 1);
      const bySrc = {};
      files.forEach(x => bySrc[x.source] = (bySrc[x.source] || 0) + 1);

      view.innerHTML = `
        <div class="card biz-card greet row spread" style="--bc:${biz.color};flex-direction:row">
          <div><div class="greet-hi">${esc(App.ux.greeting())}</div><div class="muted small">${esc(App.ux.today())} · <b style="color:var(--text)">${esc(biz.name)}</b> · ${esc(App.biz.TEMPLATES[biz.type]?.label || 'Custom')}${biz.description ? ' · ' + esc(biz.description) : ''}</div></div>
          <div class="row no-print"><button class="btn small primary" onclick="App.fx.aiBriefing()">${App.fx.icon('sparkles')} AI briefing</button><button class="btn small" id="dEdit">Edit unit</button><button class="btn small" id="dMaster">${App.fx.icon(personalUnit ? 'user' : 'businesses')} ${personalUnit ? 'Personal dashboard' : 'Business dashboard'}</button></div>
        </div>
        <div class="grid k4">${tiles.map(([l, v, s, tone, go]) => `<a data-go="${go}" style="text-decoration:none;color:inherit">${App.ui.kpi(l, v, s, tone)}</a>`).join('')}</div>
        ${await goalsCard(datasets)}
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
      view.querySelector('#dMaster').onclick = () => { App.biz.setCurrent(App.biz.kindOf(biz) === 'individual' ? 'all:individual' : 'all:business'); App.go('dashboard'); };
      const cats = Object.keys(byCat);
      App.ui.chart('dCov', 'doughnut', { labels: cats.map(c => App.categories[c]?.label || c), datasets: [{ data: cats.map(c => byCat[c]), backgroundColor: cats.map(c => App.categories[c]?.color || '#64748b') }] }, { plugins: { legend: { position: 'right', labels: { color: App.ui.cssVar('--muted') } } } });
    }
  };
})(window.App);
