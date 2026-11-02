/* Master dashboard: consolidated view across every business and venture */
(function (App) {
  const { fmt, esc } = App;
  const nz = v => (v === undefined || v === null || isNaN(v)) ? 0 : v;

  App.modules.master = {
    async render(view) {
      const bizs = App.biz.active();
      view.innerHTML = App.ui.skeleton(8);
      const allFiles = await App.store.all('files', { raw: true });

      /* Compute each business's KPIs in its own scope */
      const rows = [];
      for (const b of bizs) {
        const k = await App.biz.withBiz(b.id, () => App.modules.dashboard.refreshKpis());
        const files = allFiles.filter(f => App.biz.idOf(f) === b.id);
        const flags = Object.values(k).reduce((a, m) => a + nz(m.alerts), 0);
        rows.push({ b, k, files: files.length, last: Math.max(0, ...files.map(f => f.uploadedAt)), flags });
      }

      const S = fn => App.sum(rows.map(r => nz(fn(r.k))));
      const rev = S(k => k.finance?.revenue), net = S(k => k.finance?.net);
      const sales = S(k => k.operations?.sales);
      const spend = S(k => k.marketing?.spend), mrev = S(k => k.marketing?.rev);
      const head = S(k => k.personnel?.headcount);
      const gross = S(k => k.trading?.gross), upl = S(k => k.trading?.upl), real = S(k => k['trading-perf']?.total);
      const flags = App.sum(rows.map(r => r.flags));
      const has = key => rows.some(r => r.k[key]);

      view.innerHTML = `
        <div class="card row spread">
          <div><h2>Master dashboard</h2><div class="muted small">${bizs.length} active business${bizs.length > 1 ? 'es' : ''} · ${allFiles.length} files · updated ${new Date().toLocaleTimeString()}</div></div>
          <div class="row no-print"><button class="btn" onclick="App.fx.aiBriefing()">${App.fx.icon('sparkles')} AI briefing</button><button class="btn" data-go="businesses">Manage businesses</button><button class="btn primary" id="mNew">+ New business</button></div>
        </div>
        <div class="grid k4">
          ${has('finance') ? App.ui.kpi('Total revenue', fmt.compact(rev), 'all businesses') : ''}
          ${has('finance') ? App.ui.kpi('Total net income', fmt.compact(net), 'margin ' + fmt.pct(rev ? net / rev : NaN), net >= 0 ? 'good' : 'bad') : ''}
          ${has('operations') ? App.ui.kpi('Operating sales', fmt.compact(sales), 'from ops data') : ''}
          ${has('marketing') ? App.ui.kpi('Marketing spend', fmt.compact(spend), mrev ? `blended ROAS ${(mrev / spend).toFixed(2)}×` : '') : ''}
          ${has('personnel') ? App.ui.kpi('Total headcount', fmt.num(head), 'active employees') : ''}
          ${has('trading') ? App.ui.kpi('Trading exposure', fmt.compact(gross), `unrealized ${fmt.money(upl)}`, upl >= 0 ? 'good' : 'bad') : ''}
          ${has('trading-perf') ? App.ui.kpi('Realized trading P&L', fmt.money(real), '', real >= 0 ? 'good' : 'bad') : ''}
          ${App.ui.kpi('Open flags', fmt.num(flags), 'across all businesses', flags ? 'warn' : 'good')}
        </div>
        ${rows.length > 1 && has('finance') ? `<div class="grid c2">
          <div class="card"><div class="card-head"><h2>Revenue & net income by business</h2></div><div class="chart-box"><canvas id="mRev"></canvas></div></div>
          <div class="card"><div class="card-head"><h2>Share of revenue</h2></div><div class="chart-box"><canvas id="mShare"></canvas></div></div></div>` : ''}
        <h2 style="margin-top:4px">Businesses</h2>
        <div class="grid c3">${rows.map(r => card(r)).join('')}
          <button class="card empty" id="mNew2" style="cursor:pointer;border-style:dashed;font:inherit;color:var(--muted)"><div style="font-size:28px">+</div>Add a business or venture</button>
        </div>
        <div class="card"><div class="card-head"><h2>Needs attention</h2><span class="badge ${flags ? 'warn' : 'good'}">${flags} flags</span></div>
          <div class="stack">${rows.flatMap(r => Object.entries(r.k).filter(([, m]) => m.alerts).map(([mod, m]) =>
            `<a class="alert warn" style="text-decoration:none;color:inherit" data-jump="${r.b.id}" data-route="${mod.startsWith('trading') ? 'trading' : mod}">
              <span class="biz-dot" style="background:${r.b.color};margin-top:5px"></span><b>${esc(r.b.name)}</b><span>${esc(label(mod))}: ${m.alerts} item${m.alerts > 1 ? 's' : ''} flagged →</span></a>`)).join('') || '<div class="alert good">No flags across any business.</div>'}</div></div>
        <div class="row no-print"><button class="btn" onclick="window.print()">Print / save as PDF</button></div>`;

      const newBiz = () => App.businessForm(null, id => { App.biz.setCurrent(id); App.go('dashboard'); });
      view.querySelector('#mNew').onclick = newBiz;
      view.querySelector('#mNew2').onclick = newBiz;
      view.querySelectorAll('[data-jump]').forEach(a => a.onclick = e => { e.preventDefault(); App.biz.setCurrent(a.dataset.jump); App.go(a.dataset.route || 'dashboard'); });

      if (rows.length > 1 && has('finance')) {
        const fr = rows.filter(r => r.k.finance);
        App.ui.chart('mRev', 'bar', { labels: fr.map(r => r.b.name), datasets: [
          { label: 'Revenue', data: fr.map(r => r.k.finance.revenue), backgroundColor: fr.map(r => r.b.color) },
          { label: 'Net income', data: fr.map(r => r.k.finance.net), color: '#94a3b8' }] });
        App.ui.chart('mShare', 'doughnut', { labels: fr.map(r => r.b.name), datasets: [{ data: fr.map(r => r.k.finance.revenue), backgroundColor: fr.map(r => r.b.color) }] });
      }
    }
  };

  function label(mod) {
    return { legal: 'Legal & risk', compliance: 'Tax & compliance', purchases: 'Purchases', finance: 'Financials', operations: 'Operations', trading: 'Positions', 'trading-perf': 'Trade performance', marketing: 'Marketing', personnel: 'Personnel' }[mod] || mod;
  }

  function card({ b, k, files, last, flags }) {
    const m = [];
    if (k.finance) { m.push(['Revenue', fmt.compact(k.finance.revenue)]); m.push(['Net margin', fmt.pct(k.finance.margin)]); }
    if (k.operations && !isNaN(k.operations.laborPct)) m.push(['Labor %', fmt.pct(k.operations.laborPct)]);
    if (k.operations && !k.finance) m.push(['Sales', fmt.compact(k.operations.sales)]);
    if (k.trading) m.push(['Exposure', fmt.compact(k.trading.gross)]);
    if (k['trading-perf']) m.push(['Realized P&L', fmt.money(k['trading-perf'].total)]);
    if (k.legal && !isNaN(k.legal.score)) m.push(['Protection', Math.round(k.legal.score * 100) + '%' + (k.legal.high ? ` · ${k.legal.high} high` : '')]);
    if (k.compliance && !isNaN(k.compliance.score)) m.push(['Audit ready', Math.round(k.compliance.score * 100) + '%' + (k.compliance.overdue ? ` · ${k.compliance.overdue} overdue` : '')]);
    if (k.purchases?.receipts) m.push(['Food cost', fmt.pct(k.purchases.foodPct)]);
    if (k.marketing) m.push(['Mkt spend', fmt.compact(k.marketing.spend)]);
    if (k.personnel) m.push(['Headcount', fmt.num(k.personnel.headcount)]);
    return `<div class="card biz-card" style="--bc:${b.color}">
      <div class="row spread"><div><h2>${esc(b.name)}</h2><div class="muted small">${esc(App.biz.TEMPLATES[b.type]?.label || 'Custom')}</div></div>
        <span class="badge ${flags ? 'warn' : 'good'}">${flags ? flags + ' flags' : 'All clear'}</span></div>
      ${m.length ? `<div class="mini-kpis">${m.slice(0, 6).map(([l, v]) => `<div><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>`
        : `<div class="muted small">No data yet — open it and upload files to see KPIs here.</div>`}
      <div class="row spread"><span class="muted tiny">${files} files${last ? ' · last upload ' + new Date(last).toLocaleDateString() : ''}</span>
        <button class="btn small primary" data-jump="${b.id}" data-route="dashboard">Open →</button></div>
    </div>`;
  }
})(window.App);
