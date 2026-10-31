/* Marketing: campaign/channel performance + strategy workspace (SWOT, initiatives) */
(function (App) {
  const { fmt, n0, esc } = App;

  const FIELDS = [
    { key: 'camp', label: 'Campaign', syn: ['campaign', 'campaign name', 'ad set', 'ad name', 'name'] },
    { key: 'chan', label: 'Channel', syn: ['channel', 'platform', 'source', 'medium', 'network'], optional: true },
    { key: 'date', label: 'Date', syn: ['date', 'day', 'week', 'month', 'period'], optional: true },
    { key: 'spend', label: 'Spend', syn: ['spend', 'cost', 'amount spent', 'budget spent'] },
    { key: 'impr', label: 'Impressions', syn: ['impressions', 'impr', 'reach', 'views'], optional: true },
    { key: 'clicks', label: 'Clicks', syn: ['clicks', 'link clicks', 'sessions', 'visits'], optional: true },
    { key: 'leads', label: 'Leads', syn: ['leads', 'signups', 'sign ups', 'form fills'], optional: true },
    { key: 'conv', label: 'Conversions / orders', syn: ['conversions', 'purchases', 'orders', 'sales', 'results'], optional: true },
    { key: 'rev', label: 'Revenue', syn: ['revenue', 'conversion value', 'purchase value', 'sales revenue', 'value'], optional: true }
  ];
  let tab = 'performance';

  App.modules.marketing = {
    async render(view) {
      view.innerHTML = `<div class="tabs no-print"><button data-t="performance">Campaign performance</button><button data-t="strategy">Strategy workspace</button></div><div id="mkBody" class="stack" style="gap:16px"></div>`;
      const tabs = view.querySelectorAll('.tabs button');
      const show = async t => {
        tab = t; tabs.forEach(b => b.classList.toggle('active', b.dataset.t === t));
        const body = view.querySelector('#mkBody'); body.innerHTML = '';
        if (t === 'performance') {
          body.innerHTML = `<div id="mMap"></div><div id="mOut" class="stack" style="gap:16px"></div>`;
          await App.ui.mapper(body.querySelector('#mMap'), { title: 'Campaign data', categories: ['marketing'], fields: FIELDS, key: 'marketing',
            onChange: (ds, m) => perf(body.querySelector('#mOut'), ds, m) });
        } else strategy(body);
      };
      tabs.forEach(b => b.onclick = () => show(b.dataset.t));
      await show(tab);
    }
  };

  function agg(rows, m, keyFn) {
    const g = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      const a = g.get(k) || { key: k, spend: 0, impr: 0, clicks: 0, leads: 0, conv: 0, rev: 0 };
      for (const f of ['spend', 'impr', 'clicks', 'leads', 'conv', 'rev']) if (m[f]) a[f] += n0(r[m[f]]);
      g.set(k, a);
    }
    return [...g.values()].map(a => ({ ...a,
      ctr: a.impr ? a.clicks / a.impr : NaN, cpc: a.clicks ? a.spend / a.clicks : NaN, cpm: a.impr ? a.spend / a.impr * 1000 : NaN,
      cvr: a.clicks ? a.conv / a.clicks : NaN, cpa: a.conv ? a.spend / a.conv : NaN, cpl: a.leads ? a.spend / a.leads : NaN,
      roas: a.spend && m.rev ? a.rev / a.spend : NaN }));
  }

  function perf(el, ds, m) {
    if (!ds || !m.spend) { el.innerHTML = ds ? App.ui.empty('Map at least Campaign and Spend.') : ''; return; }
    const tgt = App.settings.get('mk.targets', { roas: 3, cpa: 50 });
    const [tot] = agg(ds.rows, m, () => 'Total');
    const camps = agg(ds.rows, m, r => String(r[m.camp] || '(none)'));
    const chans = m.chan ? agg(ds.rows, m, r => String(r[m.chan] || '(none)')) : [];
    const trend = m.date ? agg(ds.rows, m, r => App.periodKey(r[m.date])).sort((a, b) => a.key.localeCompare(b.key)) : [];

    const alerts = [];
    camps.forEach(c => {
      if (m.rev && c.spend > tot.spend * 0.05 && c.roas < 1) alerts.push(['bad', `${c.key}: ROAS ${c.roas.toFixed(2)}× — spending ${fmt.money(c.spend)} at a loss`]);
      else if (m.rev && c.roas < tgt.roas && c.spend > tot.spend * 0.05) alerts.push(['warn', `${c.key}: ROAS ${c.roas.toFixed(2)}× below ${tgt.roas}× target`]);
      if (m.conv && c.cpa > tgt.cpa * 1.5) alerts.push(['warn', `${c.key}: CPA ${fmt.money(c.cpa, 2)} vs ${fmt.money(tgt.cpa)} target`]);
      if (m.conv && c.spend > 0 && c.conv === 0) alerts.push(['bad', `${c.key}: ${fmt.money(c.spend)} spent with zero conversions`]);
    });
    const best = m.rev ? [...camps].filter(c => c.spend > 0).sort((a, b) => b.roas - a.roas)[0] : null;
    App.ui.publish('marketing', { spend: tot.spend, rev: tot.rev, roas: tot.roas, cpa: tot.cpa, alerts: alerts.length });

    el.innerHTML = `
      <div class="card no-print"><div class="row">
        <label class="field">Target ROAS (×)<input type="number" step="0.1" id="tRoas" value="${tgt.roas}"></label>
        <label class="field">Target CPA ($)<input type="number" id="tCpa" value="${tgt.cpa}"></label>
        ${best ? `<div class="muted small" style="flex:1">Best performer: <b>${esc(best.key)}</b> at ${best.roas.toFixed(2)}× ROAS — candidate for budget shift.</div>` : ''}
      </div></div>
      <div class="grid k4">
        ${App.ui.kpi('Spend', fmt.compact(tot.spend), `${camps.length} campaigns`)}
        ${m.rev ? App.ui.kpi('Revenue', fmt.compact(tot.rev), '') : ''}
        ${m.rev ? App.ui.kpi('ROAS', isNaN(tot.roas) ? '—' : tot.roas.toFixed(2) + '×', 'target ' + tgt.roas + '×', tot.roas >= tgt.roas ? 'good' : 'bad') : ''}
        ${m.conv ? App.ui.kpi('CPA', fmt.money(tot.cpa, 2), `${fmt.num(tot.conv)} conversions`, tot.cpa <= tgt.cpa ? 'good' : 'warn') : ''}
        ${m.impr && m.clicks ? App.ui.kpi('CTR', fmt.pct(tot.ctr, 2), `CPC ${fmt.money(tot.cpc, 2)} · CPM ${fmt.money(tot.cpm, 2)}`) : ''}
        ${m.clicks && m.conv ? App.ui.kpi('Conversion rate', fmt.pct(tot.cvr, 2), '') : ''}
        ${m.leads ? App.ui.kpi('Leads', fmt.num(tot.leads), 'CPL ' + fmt.money(tot.cpl, 2)) : ''}
      </div>
      ${alerts.length ? `<div class="card"><div class="card-head"><h2>Flags</h2><span class="badge warn">${alerts.length}</span></div><div class="stack">${alerts.slice(0, 12).map(([c, s]) => `<div class="alert ${c}">${esc(s)}</div>`).join('')}</div></div>` : ''}
      <div class="grid c2">
        ${chans.length ? `<div class="card"><div class="card-head"><h2>Spend by channel</h2></div><div class="chart-box"><canvas id="mkChan"></canvas></div></div>` : ''}
        ${trend.length > 1 ? `<div class="card"><div class="card-head"><h2>Trend</h2></div><div class="chart-box"><canvas id="mkTrend"></canvas></div></div>` : ''}
      </div>
      ${chans.length ? `<div class="card"><div class="card-head"><h2>Channel efficiency</h2></div><div id="mkChanT"></div></div>` : ''}
      <div class="card"><div class="card-head"><h2>Campaigns</h2><button class="btn small" id="mkCsv">Export CSV</button></div><div id="mkCampT"></div></div>`;

    const tr = s => s.oninput = () => { App.settings.set('mk.targets', { roas: +el.querySelector('#tRoas').value, cpa: +el.querySelector('#tCpa').value }); };
    tr(el.querySelector('#tRoas')); tr(el.querySelector('#tCpa'));
    el.querySelectorAll('#tRoas,#tCpa').forEach(i => i.onchange = () => perf(el, ds, m));

    if (chans.length) App.ui.chart('mkChan', 'doughnut', { labels: chans.map(c => c.key), datasets: [{ data: chans.map(c => c.spend) }] });
    if (trend.length > 1) {
      const dsets = [{ label: 'Spend', data: trend.map(t => t.spend) }];
      if (m.rev) dsets.push({ label: 'Revenue', data: trend.map(t => t.rev), color: '#059669' });
      App.ui.chart('mkTrend', 'line', { labels: trend.map(t => t.key), datasets: dsets });
    }
    const cols = [
      { key: 'key', label: 'Name' },
      { key: 'spend', label: 'Spend', num: true, fmt: v => fmt.money(v) },
      ...(m.impr ? [{ key: 'impr', label: 'Impr.', num: true, fmt: v => fmt.num(v) }] : []),
      ...(m.clicks ? [{ key: 'clicks', label: 'Clicks', num: true, fmt: v => fmt.num(v) }] : []),
      ...(m.impr && m.clicks ? [{ key: 'ctr', label: 'CTR', num: true, fmt: v => fmt.pct(v, 2) }, { key: 'cpc', label: 'CPC', num: true, fmt: v => fmt.money(v, 2) }] : []),
      ...(m.leads ? [{ key: 'leads', label: 'Leads', num: true, fmt: v => fmt.num(v) }, { key: 'cpl', label: 'CPL', num: true, fmt: v => fmt.money(v, 2) }] : []),
      ...(m.conv ? [{ key: 'conv', label: 'Conv.', num: true, fmt: v => fmt.num(v) }, { key: 'cpa', label: 'CPA', num: true, fmt: v => fmt.money(v, 2) }] : []),
      ...(m.rev ? [{ key: 'rev', label: 'Revenue', num: true, fmt: v => fmt.money(v) }, { key: 'roas', label: 'ROAS', num: true, fmt: v => isNaN(v) ? '—' : `<span style="color:var(${v < 1 ? '--bad' : v >= tgt.roas ? '--good' : '--warn'})">${v.toFixed(2)}×</span>` }] : [])
    ];
    if (chans.length) App.ui.table(el.querySelector('#mkChanT'), cols, chans, { sortKey: 'spend' });
    App.ui.table(el.querySelector('#mkCampT'), cols, camps, { sortKey: 'spend' });
    el.querySelector('#mkCsv').onclick = () => App.download('campaigns.csv', App.toCSV(cols.map(c => c.key), camps));
  }

  async function strategy(body) {
    const swot = App.settings.get('mk.swot', { s: '', w: '', o: '', t: '' });
    const inits = App.settings.get('mk.initiatives', []);
    body.innerHTML = `
      <div class="card"><div class="card-head"><h2>SWOT</h2><span class="muted small">Autosaves</span></div>
        <div class="swot">
          ${[['s', 'Strengths'], ['w', 'Weaknesses'], ['o', 'Opportunities'], ['t', 'Threats']].map(([k, l]) => `<label class="field"><b style="color:var(--text)">${l}</b><textarea data-sw="${k}">${esc(swot[k])}</textarea></label>`).join('')}
        </div></div>
      <div class="card"><div class="card-head"><h2>Initiatives</h2></div>
        <div class="row" style="margin-bottom:12px">
          <input id="iName" placeholder="Initiative (e.g. Launch loyalty SMS)" style="flex:2">
          <input id="iOwner" placeholder="Owner" style="flex:1">
          <input id="iDue" type="date">
          <input id="iBudget" type="number" placeholder="Budget $" style="width:110px">
          <select id="iStatus">${App.ui.options(['Idea', 'Planned', 'Active', 'Done'], 'Idea')}</select>
          <button class="btn primary" id="iAdd">Add</button>
        </div>
        <div class="grid c3" id="iBoard"></div></div>`;
    body.querySelectorAll('[data-sw]').forEach(t => t.oninput = () => { swot[t.dataset.sw] = t.value; App.settings.set('mk.swot', swot); });
    const board = () => {
      const groups = ['Idea', 'Planned', 'Active', 'Done'];
      body.querySelector('#iBoard').innerHTML = groups.map(g => `<div class="card" style="background:var(--panel-2)"><div class="card-head"><h3>${g}</h3><span class="badge">${inits.filter(i => i.status === g).length}</span></div>
        <div class="stack">${inits.filter(i => i.status === g).map(i => `<div class="note-item" style="background:var(--panel)"><b>${esc(i.name)}</b>
          <div class="muted small">${esc(i.owner || '—')}${i.due ? ' · due ' + esc(i.due) : ''}${i.budget ? ' · ' + fmt.money(+i.budget) : ''}</div>
          <div class="row" style="margin-top:6px"><select data-mv="${i.id}" class="small">${App.ui.options(groups, g)}</select><button class="btn small danger" data-rm="${i.id}">Remove</button></div></div>`).join('') || '<div class="muted small">—</div>'}</div></div>`).join('');
      body.querySelectorAll('[data-mv]').forEach(s => s.onchange = () => { inits.find(i => i.id === s.dataset.mv).status = s.value; App.settings.set('mk.initiatives', inits); board(); });
      body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { inits.splice(inits.findIndex(i => i.id === b.dataset.rm), 1); App.settings.set('mk.initiatives', inits); board(); });
    };
    body.querySelector('#iAdd').onclick = () => {
      const name = body.querySelector('#iName').value.trim();
      if (!name) return;
      inits.push({ id: App.uid(), name, owner: body.querySelector('#iOwner').value, due: body.querySelector('#iDue').value, budget: body.querySelector('#iBudget').value, status: body.querySelector('#iStatus').value });
      App.settings.set('mk.initiatives', inits);
      body.querySelector('#iName').value = '';
      board();
    };
    board();
  }
})(window.App);
