/* Business operations: labor (Harri), sales & food cost / inventory variance (CrunchTime) */
(function (App) {
  const { fmt, n0, esc } = App;

  const LABOR = [
    { key: 'date', label: 'Date', syn: ['date', 'business date', 'shift date', 'clock in', 'day', 'week'], optional: true },
    { key: 'loc', label: 'Location / Store', syn: ['location', 'store', 'site', 'unit', 'restaurant'], optional: true },
    { key: 'emp', label: 'Employee', syn: ['employee', 'employee name', 'name', 'team member'], optional: true },
    { key: 'pos', label: 'Position / Job', syn: ['position', 'job', 'role', 'job title', 'department'], optional: true },
    { key: 'hours', label: 'Hours worked', syn: ['total hours', 'actual hours', 'hours', 'regular hours', 'hours worked'] },
    { key: 'ot', label: 'Overtime hours', syn: ['overtime hours', 'overtime', 'ot hours', 'ot'], optional: true },
    { key: 'sched', label: 'Scheduled hours', syn: ['scheduled hours', 'scheduled', 'sched hours'], optional: true },
    { key: 'cost', label: 'Labor cost', syn: ['labor cost', 'total pay', 'gross pay', 'wages', 'cost', 'pay'], optional: true },
    { key: 'rate', label: 'Pay rate', syn: ['pay rate', 'rate', 'hourly rate', 'wage rate'], optional: true }
  ];
  const SALES = [
    { key: 'date', label: 'Date', syn: ['date', 'business date', 'day', 'week', 'period'], optional: true },
    { key: 'loc', label: 'Location / Store', syn: ['location', 'store', 'site', 'unit', 'restaurant'], optional: true },
    { key: 'sales', label: 'Net sales', syn: ['net sales', 'sales', 'revenue', 'gross sales'] },
    { key: 'cogs', label: 'Food / product cost', syn: ['food cost', 'cogs', 'actual cost', 'cost of sales', 'product cost'], optional: true },
    { key: 'theo', label: 'Theoretical cost', syn: ['theoretical cost', 'theoretical', 'ideal cost'], optional: true },
    { key: 'guests', label: 'Guests / transactions', syn: ['guests', 'guest count', 'covers', 'transactions', 'checks', 'orders'], optional: true },
    { key: 'fc', label: 'Sales forecast', syn: ['sales forecast', 'forecast sales', 'adjusted sales forecast', 'forecast'], optional: true }
  ];
  const INV = [
    { key: 'item', label: 'Item', syn: ['item', 'item name', 'menu item', 'product', 'description', 'ingredient'] },
    { key: 'theo', label: 'Theoretical usage', syn: ['theoretical usage', 'theoretical', 'ideal usage', 'expected'], optional: true },
    { key: 'actual', label: 'Actual usage', syn: ['actual usage', 'actual', 'used'], optional: true },
    { key: 'var', label: 'Variance $', syn: ['variance $', 'variance amount', 'variance cost', 'variance', 'var $'], optional: true },
    { key: 'unit', label: 'Unit cost', syn: ['unit cost', 'cost per unit', 'price', 'cost'], optional: true },
    { key: 'count', label: 'Counted on hand', syn: ['physical qty', 'physical', 'counted', 'on hand'], optional: true }
  ];

  let L = { ds: null, m: {} }, S = { ds: null, m: {} }, avtChoice = null;

  App.modules.operations = {
    async render(view) {
      const t = App.bsettings.get('ops.targets', { labor: 0.28, food: 0.30, prime: 0.60, splh: 55, ot: 0.05 });
      view.innerHTML = `
        <div class="card no-print"><div class="card-head"><h2>Targets</h2><span class="muted small">Used for flags and KPI colors</span></div>
          <div class="row">
            <label class="field">Labor % of sales<input type="number" step="0.5" id="tLabor" value="${+(t.labor * 100).toFixed(2)}"></label>
            <label class="field">Food cost %<input type="number" step="0.5" id="tFood" value="${+(t.food * 100).toFixed(2)}"></label>
            <label class="field">Prime cost %<input type="number" step="0.5" id="tPrime" value="${+(t.prime * 100).toFixed(2)}"></label>
            <label class="field">Min sales / labor hr ($)<input type="number" step="1" id="tSplh" value="${t.splh}"></label>
            <label class="field">Max overtime % of hours<input type="number" step="0.5" id="tOt" value="${+(t.ot * 100).toFixed(2)}"></label>
          </div></div>
        <div class="grid c2"><div id="lMap"></div><div id="sMap"></div></div>
        <div id="opsOut" class="stack" style="gap:16px"></div>
        <div id="avtOut"></div>
        <div id="iMap"></div><div id="iOut"></div>`;
      view.querySelectorAll('.row input').forEach(i => i.onchange = () => {
        App.bsettings.set('ops.targets', {
          labor: +view.querySelector('#tLabor').value / 100, food: +view.querySelector('#tFood').value / 100,
          prime: +view.querySelector('#tPrime').value / 100, splh: +view.querySelector('#tSplh').value, ot: +view.querySelector('#tOt').value / 100
        });
        analyze(view);
      });
      await App.ui.mapper(view.querySelector('#lMap'), { title: 'Labor (e.g. Harri timesheet)', categories: ['operations', 'personnel'], fields: LABOR, key: 'ops-labor',
        onChange: (ds, m) => { L = { ds, m }; analyze(view); } });
      await App.ui.mapper(view.querySelector('#sMap'), { title: 'Sales & cost (e.g. CrunchTime)', categories: ['operations', 'financial'], fields: SALES, key: 'ops-sales',
        onChange: (ds, m) => { S = { ds, m }; analyze(view); } });
      await App.ui.mapper(view.querySelector('#iMap'), { title: 'Inventory variance (e.g. CrunchTime AvT)', categories: ['operations'], fields: INV, key: 'ops-inv',
        onChange: (ds, m) => inventory(view.querySelector('#iOut'), ds, m) });
      await foodGap(view.querySelector('#avtOut'));
    }
  };

  function analyze(view) {
    const el = view.querySelector('#opsOut');
    if (!el) return;
    const t = App.bsettings.get('ops.targets', { labor: 0.28, food: 0.30, prime: 0.60, splh: 55, ot: 0.05 });
    const lm = L.m, sm = S.m;
    const hasL = L.ds && lm.hours, hasS = S.ds && sm.sales;
    if (!hasL && !hasS) { el.innerHTML = ''; return; }

    const laborCost = r => lm.cost ? n0(r[lm.cost]) : (lm.rate ? n0(r[lm.rate]) * (n0(r[lm.hours]) + 0.5 * (lm.ot ? n0(r[lm.ot]) : 0)) : 0);
    const lRows = hasL ? L.ds.rows : [], sRows = hasS ? S.ds.rows : [];
    const hours = App.sum(lRows.map(r => n0(r[lm.hours])));
    const ot = lm.ot ? App.sum(lRows.map(r => n0(r[lm.ot]))) : 0;
    const sched = lm.sched ? App.sum(lRows.map(r => n0(r[lm.sched]))) : 0;
    const lcost = App.sum(lRows.map(laborCost));
    const sales = App.sum(sRows.map(r => n0(r[sm.sales])));
    const cogs = sm.cogs ? App.sum(sRows.map(r => n0(r[sm.cogs]))) : 0;
    const theo = sm.theo ? App.sum(sRows.map(r => n0(r[sm.theo]))) : 0;
    const guests = sm.guests ? App.sum(sRows.map(r => n0(r[sm.guests]))) : 0;
    const fcSales = sm.fc ? App.sum(sRows.map(r => n0(r[sm.fc]))) : 0;
    const sDays = sm.date ? [...new Set(sRows.map(r => App.dateKey(r[sm.date])).filter(Boolean))].sort() : [];
    const weeks = sDays.length > 7 ? (new Date(sDays[sDays.length - 1]) - new Date(sDays[0])) / (7 * 864e5) + 1 / 7 : 0;
    const laborPct = sales && lcost ? lcost / sales : NaN;
    const pr = App.period.range();
    const prevS = pr.prev && S.ds?._all && sm.date ? App.period.within(S.ds._all, sm.date, pr.prev.from, pr.prev.to) : null;
    const prevL = pr.prev && L.ds?._all && lm.date ? App.period.within(L.ds._all, lm.date, pr.prev.from, pr.prev.to) : null;
    const prevSales = prevS ? App.sum(prevS.map(r => n0(r[sm.sales]))) : NaN;
    const prevLcost = prevL ? App.sum(prevL.map(laborCost)) : NaN;
    const prevLaborPct = prevSales && prevLcost ? prevLcost / prevSales : NaN;
    const vs = (cur, prev, pct) => (isNaN(prev) || !prev ? '' : pct ? `${cur - prev >= 0 ? '▲' : '▼'} ${Math.abs((cur - prev) * 100).toFixed(1)} pts vs ${pr.prev.word}` : `${cur >= prev ? '▲' : '▼'} ${Math.abs((cur / prev - 1) * 100).toFixed(1)}% vs ${pr.prev.word}`);
    const foodPct = sales && cogs ? cogs / sales : NaN;
    const primePct = sales && cogs && lcost ? (cogs + lcost) / sales : NaN;
    const splh = sales && hours ? sales / hours : NaN;
    const otPct = hours && lm.ot ? ot / hours : NaN;

    /* Per sub-period (day / week / month) and location */
    const per = App.period.range();
    const allKeys = sm.date ? sRows.map(r => App.dateKey(r[sm.date])) : lm.date ? lRows.map(r => App.dateKey(r[lm.date])) : [];
    const sub = per.sub || App.period.autoSub(allKeys);
    const by = new Map();
    const bucket = (k) => { if (!by.has(k)) by.set(k, { key: k, sales: 0, cogs: 0, hours: 0, lcost: 0, guests: 0 }); return by.get(k); };
    const keyOf = (r, m) => {
      const parts = [];
      if (m.loc && ((lm.loc && sm.loc) || !hasL || !hasS)) parts.push(String(r[m.loc] || ''));
      if (m.date) parts.push(App.period.bucket(r[m.date], sub));
      return parts.join(' · ') || 'All';
    };
    sRows.forEach(r => { const b = bucket(keyOf(r, sm)); b.sales += n0(r[sm.sales]); b.cogs += sm.cogs ? n0(r[sm.cogs]) : 0; b.guests += sm.guests ? n0(r[sm.guests]) : 0; });
    lRows.forEach(r => { const b = bucket(keyOf(r, lm)); b.hours += n0(r[lm.hours]); b.lcost += laborCost(r); });
    const rows = [...by.values()].sort((a, b) => a.key.localeCompare(b.key)).map(r => ({
      ...r, label: r.key.split(' · ').map(x => App.period.bucketLabel(x, sub)).join(' · '), laborPct: r.sales ? r.lcost / r.sales : NaN, foodPct: r.sales && r.cogs ? r.cogs / r.sales : NaN,
      splh: r.hours ? r.sales / r.hours : NaN, avgCheck: r.guests ? r.sales / r.guests : NaN
    }));

    /* By position */
    const pos = [];
    if (hasL && lm.pos) {
      const g = new Map();
      lRows.forEach(r => { const k = String(r[lm.pos] || '(none)'); const a = g.get(k) || { pos: k, hours: 0, cost: 0, ot: 0, people: new Set() }; a.hours += n0(r[lm.hours]); a.cost += laborCost(r); a.ot += lm.ot ? n0(r[lm.ot]) : 0; if (lm.emp) a.people.add(r[lm.emp]); g.set(k, a); });
      g.forEach(v => pos.push({ ...v, people: v.people.size }));
    }

    const alerts = [];
    if (laborPct > t.labor) alerts.push(['bad', `Labor is ${fmt.pct(laborPct)} of sales — target ${fmt.pct(t.labor)}`]);
    if (foodPct > t.food) alerts.push(['bad', `Food cost is ${fmt.pct(foodPct)} — target ${fmt.pct(t.food)}`]);
    if (primePct > t.prime) alerts.push(['warn', `Prime cost is ${fmt.pct(primePct)} — target ${fmt.pct(t.prime)}`]);
    if (splh < t.splh) alerts.push(['warn', `Sales per labor hour ${fmt.money(splh, 2)} is under ${fmt.money(t.splh)}`]);
    if (otPct > t.ot) alerts.push(['warn', `Overtime is ${fmt.pct(otPct)} of hours (${fmt.num(ot, 1)} hrs)`]);
    if (theo && cogs > theo * 1.02) alerts.push(['warn', `Actual vs theoretical food cost gap: ${fmt.money(cogs - theo)} (${fmt.pct(cogs / theo - 1)})`]);
    rows.filter(r => r.sales && r.laborPct > t.labor * 1.15).slice(0, 6).forEach(r => alerts.push(['warn', `${r.key}: labor ${fmt.pct(r.laborPct)}`]));

    App.ui.publish('operations', { sales, laborPct, foodPct, primePct, splh, alerts: alerts.length, flags: alerts.slice(0, 12).map(a => a[1]) });
    const tone = (v, tgt, lowerBetter = true) => isNaN(v) ? '' : ((lowerBetter ? v <= tgt : v >= tgt) ? 'good' : 'bad');

    el.innerHTML = `
      <div class="grid k4">
        ${hasS ? App.ui.kpi('Net sales', fmt.compact(sales), [vs(sales, prevSales), weeks ? `avg ${fmt.compact(sales / weeks)}/week over ${Math.round(weeks)} weeks` : '', sDays.length ? `${fmt.date(sDays[0])} – ${fmt.date(sDays[sDays.length - 1])}` : '', guests ? `${fmt.num(guests)} guests · avg ${fmt.money(sales / guests, 2)}` : ''].filter(Boolean).join(' · ')) : ''}
        ${fcSales ? App.ui.kpi('Sales vs forecast', (sales >= fcSales ? '+' : '') + fmt.compact(sales - fcSales), `${fmt.pct(sales / fcSales - 1)} vs ${fmt.compact(fcSales)} forecast`, sales >= fcSales ? 'good' : 'warn') : ''}
        ${hasL ? App.ui.kpi('Labor hours', fmt.num(hours, 1), lm.ot ? `${fmt.num(ot, 1)} OT hrs (${fmt.pct(otPct)})` : (sched ? `${fmt.num(sched, 1)} scheduled` : '')) : ''}
        ${lcost ? App.ui.kpi('Labor cost', fmt.compact(lcost), lm.cost ? '' : 'estimated from pay rate') : ''}
        ${App.ui.kpi('Labor %', fmt.pct(laborPct), ['target ' + fmt.pct(t.labor), vs(laborPct, prevLaborPct, true)].filter(Boolean).join(' · '), tone(laborPct, t.labor))}
        ${sm.cogs ? App.ui.kpi('Food cost %', fmt.pct(foodPct), 'target ' + fmt.pct(t.food), tone(foodPct, t.food)) : ''}
        ${isNaN(primePct) ? '' : App.ui.kpi('Prime cost %', fmt.pct(primePct), 'target ' + fmt.pct(t.prime), tone(primePct, t.prime))}
        ${App.ui.kpi('Sales / labor hr', fmt.money(splh, 2), 'target ' + fmt.money(t.splh), tone(splh, t.splh, false))}
        ${sched ? App.ui.kpi('Schedule variance', fmt.num(hours - sched, 1) + ' hrs', fmt.pct(hours / sched - 1) + ' vs schedule', Math.abs(hours / sched - 1) < 0.03 ? 'good' : 'warn') : ''}
      </div>
      ${alerts.length ? `<div class="card"><div class="card-head"><h2>Flags</h2><span class="badge warn">${alerts.length}</span></div><div class="stack">${alerts.map(([c, s]) => `<div class="alert ${c}">${esc(s)}</div>`).join('')}</div></div>` : ''}
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>Sales vs labor</h2></div><div class="chart-box"><canvas id="opsChart"></canvas></div></div>
        ${pos.length ? `<div class="card"><div class="card-head"><h2>Hours by position</h2></div><div class="chart-box"><canvas id="opsPos"></canvas></div></div>` : ''}
      </div>
      <div class="card"><div class="card-head"><h2>${{ day: 'Daily', week: 'Weekly', month: 'Monthly' }[sub]} detail${per.g !== 'all' ? ` · ${App.esc(per.label)}` : ''}</h2><button class="btn small" id="opsCsv">Export CSV</button></div><div id="opsTable"></div></div>`;

    App.ui.chart('opsChart', 'bar', { labels: rows.map(r => r.label), datasets: [
      { label: 'Sales', data: rows.map(r => r.sales) },
      { label: 'Labor cost', data: rows.map(r => r.lcost), color: '#d97706' },
      { label: 'Labor %', data: rows.map(r => +(r.laborPct * 100).toFixed(1)), type: 'line', yAxisID: 'y2', color: '#dc2626' }
    ] }, { scales: {
      x: { ticks: { color: App.ui.cssVar('--muted') }, grid: { display: false } },
      y: { ticks: { color: App.ui.cssVar('--muted') }, grid: { color: App.ui.cssVar('--border') } },
      y2: { position: 'right', ticks: { color: App.ui.cssVar('--muted'), callback: v => v + '%' }, grid: { display: false } }
    } });
    if (pos.length) App.ui.chart('opsPos', 'bar', { labels: pos.map(p => p.pos), datasets: [{ label: 'Hours', data: pos.map(p => p.hours), multiColor: true }] }, { indexAxis: 'y' });

    const cols = [
      { key: 'key', label: { day: 'Day', week: 'Week', month: 'Month' }[sub] + ((sm.loc || lm.loc) ? ' / Location' : ''), fmt: (v, r) => App.esc(r.label) },
      { key: 'sales', label: 'Sales', num: true, fmt: v => fmt.money(v) },
      { key: 'hours', label: 'Hours', num: true, fmt: v => fmt.num(v, 1) },
      { key: 'lcost', label: 'Labor $', num: true, fmt: v => fmt.money(v) },
      { key: 'laborPct', label: 'Labor %', num: true, fmt: v => `<span style="color:var(${v > t.labor ? '--bad' : '--good'})">${fmt.pct(v)}</span>` },
      { key: 'splh', label: 'SPLH', num: true, fmt: v => fmt.money(v, 2) },
      ...(sm.cogs ? [{ key: 'foodPct', label: 'Food %', num: true, fmt: v => fmt.pct(v) }] : []),
      ...(sm.guests ? [{ key: 'guests', label: 'Guests', num: true, fmt: v => fmt.num(v) }, { key: 'avgCheck', label: 'Avg check', num: true, fmt: v => fmt.money(v, 2) }] : [])
    ];
    App.ui.table(el.querySelector('#opsTable'), cols, rows);
    el.querySelector('#opsCsv').onclick = () => App.download('operations.csv', App.toCSV(cols.map(c => c.key), rows));
  }

  /* Actual vs theoretical food cost (CrunchTime AvT): the gap between what was used and what should have been */
  async function foodGap(el) {
    const avts = (await App.store.datasets()).filter(d => d.meta?.kind === 'avt').sort((a, b) => (b.meta.to || '').localeCompare(a.meta.to || ''));
    if (!avts.length || !el) { if (el) el.innerHTML = ''; return; }
    const d = avts.find(x => x.id === avtChoice) || avts[0], M = d.meta;
    const older = avts.filter(x => x !== d && (x.meta.to || '') < (M.to || ''));
    const rows = d.rows.map(r => ({ item: r.Item, a: n0(r['Actual Cost']), t: n0(r['Theoretical Cost']), v: n0(r['Variance $']), pts: n0(r['Variance pts']), w: n0(r['Logged Waste $']) })).sort((a, b) => b.v - a.v);
    const goal = 1.0;
    el.innerHTML = `<div class="card stack">
      <div class="card-head"><h2>Food cost gap: actual vs. theoretical</h2>
        <select id="avtPick" class="small" data-native>${avts.map(x => `<option value="${x.id}" ${x === d ? 'selected' : ''}>${esc(fmt.date(x.meta.from))} – ${esc(fmt.date(x.meta.to))}</option>`).join('')}</select></div>
      <div class="grid k4">
        ${App.ui.kpi('Food cost gap', M.gapPts.toFixed(2) + ' pts', `${fmt.money(M.overspend)} above theoretical · gold standard 0.8–1.0`, M.gapPts <= goal ? 'good' : M.gapPts <= 1.8 ? 'warn' : 'bad', false)}
        ${App.ui.kpi('Actual food cost', M.costPct.toFixed(2) + '%', `of ${fmt.money(M.netSales)} sales`, '', false)}
        ${App.ui.kpi('Biggest gap', esc(rows[0]?.item || '—'), rows[0] ? `${fmt.money(rows[0].v)} · ${rows[0].pts.toFixed(2)} pts` : '', 'bad', false)}
        ${older.length ? App.ui.kpi('Trend', (M.gapPts - older[0].meta.gapPts >= 0 ? '+' : '') + (M.gapPts - older[0].meta.gapPts).toFixed(2) + ' pts', `vs ${fmt.date(older[0].meta.from)} – ${fmt.date(older[0].meta.to)} (${older[0].meta.gapPts.toFixed(2)} pts)`, M.gapPts <= older[0].meta.gapPts ? 'good' : 'bad', false) : ''}
      </div>
      <div class="chart-box" style="height:260px"><canvas id="avtChart"></canvas></div></div>`;
    App.ui.chart('avtChart', 'bar', { labels: rows.map(r => r.item), datasets: [{ label: 'Actual − theoretical $', data: rows.map(r => +r.v.toFixed(2)), backgroundColor: rows.map(r => r.v > 0 ? '#dc2626' : '#059669') }] }, { indexAxis: 'y' });
    el.querySelector('#avtPick').onchange = e => { avtChoice = e.target.value; foodGap(el); };
  }

  function inventory(el, ds, m) {
    if (!ds || !m.item || !(m.var || (m.theo && m.actual))) { el.innerHTML = ''; return; }
    const rows = ds.rows.map(r => {
      const theo = n0(r[m.theo]), act = n0(r[m.actual]), unit = m.unit ? n0(r[m.unit]) : 1;
      const v = m.var ? n0(r[m.var]) : (act - theo) * unit;
      return { item: r[m.item], theo, act, unitVar: act - theo, varAmt: v, varPct: theo ? act / theo - 1 : NaN };
    }).filter(r => r.item !== '');
    const over = App.sum(rows.filter(r => r.varAmt > 0).map(r => r.varAmt));
    const under = App.sum(rows.filter(r => r.varAmt < 0).map(r => r.varAmt));
    const top = [...rows].sort((a, b) => Math.abs(b.varAmt) - Math.abs(a.varAmt)).slice(0, 12);
    el.innerHTML = `<div class="grid k4">
        ${App.ui.kpi('Net variance', fmt.money(over + under), `${rows.length} items`, over + under > 0 ? 'bad' : 'good')}
        ${App.ui.kpi('Overuse / loss', fmt.money(over), '', 'bad')}
        ${App.ui.kpi('Underuse', fmt.money(under), '')}
      </div>
      <div class="grid c2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h2>Largest variances</h2></div><div class="chart-box"><canvas id="invChart"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Item detail</h2></div><div id="invT"></div></div></div>`;
    App.ui.chart('invChart', 'bar', { labels: top.map(r => r.item), datasets: [{ label: 'Variance $', data: top.map(r => r.varAmt),
      backgroundColor: top.map(r => r.varAmt > 0 ? '#dc2626' : '#059669') }] }, { indexAxis: 'y' });
    App.ui.table(el.querySelector('#invT'), [
      { key: 'item', label: 'Item' },
      ...(m.theo ? [{ key: 'theo', label: 'Theo', num: true, fmt: v => fmt.num(v, 2) }] : []),
      ...(m.actual ? [{ key: 'act', label: 'Actual', num: true, fmt: v => fmt.num(v, 2) }, { key: 'varPct', label: 'Var %', num: true, fmt: v => fmt.pct(v) }] : []),
      { key: 'varAmt', label: 'Var $', num: true, fmt: v => `<span style="color:var(${v > 0 ? '--bad' : '--good'})">${fmt.money(v, 2)}</span>` }
    ], rows, { sortKey: 'varAmt' });
  }
})(window.App);
