/* Financial analysis: P&L trend, margins, budget variance, expense mix */
(function (App) {
  const { fmt, n0, esc } = App;

  /* Turn a date-ish period value into YYYY-MM, otherwise keep the label */
  function periodKey(v) {
    if (v === '' || v === null || v === undefined) return '(blank)';
    const looksDate = v instanceof Date || (typeof v === 'number' && v > 20000 && v < 80000) || /\d{4}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[a-z]{3,9}\.? \d{4}/i.test(String(v));
    if (looksDate) { const d = App.toDate(v); if (d) { const sub = App.period?.range().sub; return sub === 'day' ? App.dateKey(d) : d.toISOString().slice(0, 7); } }
    return String(v);
  }
  App.periodKey = periodKey;

  const FIELDS = [
    { key: 'period', label: 'Period / Date', syn: ['period', 'month', 'date', 'week', 'quarter', 'year'] },
    { key: 'revenue', label: 'Revenue / Sales', syn: ['revenue', 'total revenue', 'net sales', 'sales', 'income', 'gross sales'] },
    { key: 'cogs', label: 'COGS', syn: ['cogs', 'cost of goods sold', 'cost of sales', 'food cost', 'cost of goods'], optional: true },
    { key: 'labor', label: 'Labor / Payroll', syn: ['labor', 'payroll', 'wages', 'labor cost', 'salaries'], optional: true },
    { key: 'opex', label: 'Operating expenses', syn: ['operating expenses', 'opex', 'expenses', 'total expenses', 'sg&a', 'overhead'], optional: true },
    { key: 'other', label: 'Other expenses', syn: ['other expenses', 'other', 'interest', 'depreciation', 'taxes'], optional: true },
    { key: 'net', label: 'Net income (if provided)', syn: ['net income', 'net profit', 'net', 'profit'], optional: true },
    { key: 'budget', label: 'Budget revenue', syn: ['budget', 'budget revenue', 'plan', 'forecast', 'target'], optional: true }
  ];

  const LEDGER = [
    { key: 'cat', label: 'Expense category', syn: ['category', 'account', 'gl account', 'expense type', 'type', 'description'] },
    { key: 'amt', label: 'Amount', syn: ['amount', 'total', 'value', 'debit', 'cost'] }
  ];

  App.modules.finance = {
    async render(view) {
      view.innerHTML = `<div id="fMap"></div><div id="fOut" class="stack" style="gap:16px"></div>
        <div id="lMap"></div><div id="lOut"></div>`;
      await App.ui.mapper(view.querySelector('#fMap'), {
        title: 'P&L data', categories: ['financial'], fields: FIELDS, key: 'finance',
        hint: 'Expected columns: period, revenue, and cost lines.', onChange: (ds, m) => analyze(view.querySelector('#fOut'), ds, m)
      });
      await App.ui.mapper(view.querySelector('#lMap'), {
        title: 'Expense detail (optional)', categories: ['financial'], fields: LEDGER, key: 'finance-ledger',
        onChange: (ds, m) => ledger(view.querySelector('#lOut'), ds, m)
      });
    }
  };

  function analyze(el, ds, m) {
    if (!ds || !m.revenue) { el.innerHTML = ds ? App.ui.empty('Map at least a Revenue column to analyze this table.') : ''; return; }
    const map = new Map();
    for (const r of ds.rows) {
      const k = m.period ? periodKey(r[m.period]) : 'All';
      if (!map.has(k)) map.set(k, { period: k, revenue: 0, cogs: 0, labor: 0, opex: 0, other: 0, net: 0, budget: 0, hasNet: false });
      const a = map.get(k);
      for (const f of ['revenue', 'cogs', 'labor', 'opex', 'other', 'budget']) if (m[f]) a[f] += Math.abs(n0(r[m[f]]));
      if (m.net) { a.net += n0(r[m.net]); a.hasNet = true; }
    }
    let rows = [...map.values()];
    if (rows.every(r => /^\d{4}-\d{2}$/.test(r.period))) rows.sort((a, b) => a.period.localeCompare(b.period));
    rows.forEach((r, i) => {
      r.gross = r.revenue - r.cogs;
      r.expenses = r.cogs + r.labor + r.opex + r.other;
      if (!r.hasNet) r.net = r.revenue - r.expenses;
      r.gm = r.revenue ? r.gross / r.revenue : NaN;
      r.nm = r.revenue ? r.net / r.revenue : NaN;
      r.prime = r.revenue ? (r.cogs + r.labor) / r.revenue : NaN;
      r.growth = i > 0 && rows[i - 1].revenue ? r.revenue / rows[i - 1].revenue - 1 : NaN;
      r.bvar = m.budget && r.budget ? r.revenue / r.budget - 1 : NaN;
    });
    const T = k => App.sum(rows.map(r => r[k]));
    const rev = T('revenue'), gross = T('gross'), net = T('net'), exp = T('expenses'), bud = T('budget');
    const last = rows[rows.length - 1];

    const alerts = [];
    rows.forEach(r => {
      if (r.nm < 0) alerts.push(['bad', `${r.period}: net loss of ${fmt.money(r.net)} (${fmt.pct(r.nm)} margin)`]);
      if (r.growth < -0.1) alerts.push(['warn', `${r.period}: revenue down ${fmt.pct(-r.growth)} vs prior period`]);
      if (r.bvar < -0.05) alerts.push(['warn', `${r.period}: revenue ${fmt.pct(-r.bvar)} below budget`]);
      if (r.prime > 0.65 && (m.cogs && m.labor)) alerts.push(['warn', `${r.period}: prime cost ${fmt.pct(r.prime)} of revenue (target < 65%)`]);
    });

    App.ui.publish('finance', { revenue: rev, net, margin: rev ? net / rev : NaN, periods: rows.length, alerts: alerts.length, flags: alerts.slice(0, 12).map(a => a[1]) });

    el.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Revenue', fmt.compact(rev), `${rows.length} period${rows.length > 1 ? 's' : ''}`)}
        ${App.ui.kpi('Gross profit', fmt.compact(gross), 'Margin ' + fmt.pct(rev ? gross / rev : NaN))}
        ${App.ui.kpi('Total expenses', fmt.compact(exp), fmt.pct(rev ? exp / rev : NaN) + ' of revenue')}
        ${App.ui.kpi('Net income', fmt.compact(net), 'Margin ' + fmt.pct(rev ? net / rev : NaN), net >= 0 ? 'good' : 'bad')}
        ${last && !isNaN(last.growth) ? App.ui.kpi('Latest growth', fmt.pct(last.growth), last.period + ' vs prior', last.growth >= 0 ? 'good' : 'bad') : ''}
        ${m.budget ? App.ui.kpi('vs Budget', fmt.pct(bud ? rev / bud - 1 : NaN), fmt.compact(bud) + ' budgeted', rev >= bud ? 'good' : 'warn') : ''}
      </div>
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>Revenue, expenses & net income</h2></div><div class="chart-box"><canvas id="finTrend"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Margin trend</h2></div><div class="chart-box"><canvas id="finMargin"></canvas></div></div>
      </div>
      ${alerts.length ? `<div class="card"><div class="card-head"><h2>Flags</h2><span class="badge warn">${alerts.length}</span></div><div class="stack">${alerts.slice(0, 12).map(([t, s]) => `<div class="alert ${t}">${esc(s)}</div>`).join('')}</div></div>` : ''}
      <div class="card"><div class="card-head"><h2>Period detail</h2><button class="btn small" id="finCsv">Export CSV</button></div><div id="finTable"></div></div>`;

    const labels = rows.map(r => r.period);
    App.ui.chart('finTrend', 'bar', { labels, datasets: [
      { label: 'Revenue', data: rows.map(r => r.revenue) },
      { label: 'Expenses', data: rows.map(r => r.expenses), color: '#d97706' },
      { label: 'Net income', data: rows.map(r => r.net), type: 'line', color: '#059669' }
    ] });
    const mds = [{ label: 'Net margin %', data: rows.map(r => +(r.nm * 100).toFixed(2)), color: '#059669' }];
    if (m.cogs) mds.unshift({ label: 'Gross margin %', data: rows.map(r => +(r.gm * 100).toFixed(2)) });
    if (m.cogs && m.labor) mds.push({ label: 'Prime cost %', data: rows.map(r => +(r.prime * 100).toFixed(2)), color: '#dc2626' });
    App.ui.chart('finMargin', 'line', { labels, datasets: mds });

    const cols = [
      { key: 'period', label: 'Period' },
      { key: 'revenue', label: 'Revenue', num: true, fmt: v => fmt.money(v) },
      ...(m.cogs ? [{ key: 'cogs', label: 'COGS', num: true, fmt: v => fmt.money(v) }, { key: 'gm', label: 'GM %', num: true, fmt: v => fmt.pct(v) }] : []),
      ...(m.labor ? [{ key: 'labor', label: 'Labor', num: true, fmt: v => fmt.money(v) }] : []),
      { key: 'expenses', label: 'Total exp.', num: true, fmt: v => fmt.money(v) },
      { key: 'net', label: 'Net income', num: true, fmt: v => `<span style="color:var(${v < 0 ? '--bad' : '--good'})">${fmt.money(v)}</span>` },
      { key: 'nm', label: 'Net %', num: true, fmt: v => fmt.pct(v) },
      { key: 'growth', label: 'Growth', num: true, fmt: v => fmt.pct(v) },
      ...(m.budget ? [{ key: 'bvar', label: 'vs Budget', num: true, fmt: v => fmt.pct(v) }] : [])
    ];
    App.ui.table(el.querySelector('#finTable'), cols, rows);
    el.querySelector('#finCsv').onclick = () => App.download('pnl-summary.csv', App.toCSV(cols.map(c => c.key), rows));
  }

  function ledger(el, ds, m) {
    if (!ds || !m.cat || !m.amt) { el.innerHTML = ''; return; }
    const g = App.groupSum(ds.rows, m.cat, [m.amt]);
    const rows = [...g.entries()].map(([k, v]) => ({ cat: k, amt: Math.abs(v[m.amt]) })).sort((a, b) => b.amt - a.amt);
    const total = App.sum(rows.map(r => r.amt));
    const top = rows.slice(0, 9);
    if (rows.length > 9) top.push({ cat: 'All other', amt: App.sum(rows.slice(9).map(r => r.amt)) });
    el.innerHTML = `<div class="grid c2">
      <div class="card"><div class="card-head"><h2>Expense mix</h2><span class="muted">${fmt.money(total)}</span></div><div class="chart-box"><canvas id="finMix"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>By category</h2></div><div id="finMixT"></div></div></div>`;
    App.ui.chart('finMix', 'doughnut', { labels: top.map(r => r.cat), datasets: [{ data: top.map(r => r.amt) }] });
    App.ui.table(el.querySelector('#finMixT'), [
      { key: 'cat', label: 'Category' },
      { key: 'amt', label: 'Amount', num: true, fmt: v => fmt.money(v) },
      { key: 'share', label: 'Share', num: true, fmt: (v, r) => fmt.pct(r.amt / total) }
    ], rows.map(r => ({ ...r, share: r.amt / total })), { sortKey: 'amt' });
  }
})(window.App);
