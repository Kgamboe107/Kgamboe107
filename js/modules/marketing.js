/* Marketing: campaign/channel performance, guest scores & audits (7 Principles of Success), strategy workspace */
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
    async render(view, params = {}) {
      if (params.tab) tab = params.tab;
      App.guest.publish();
      view.innerHTML = `<div class="tabs no-print"><button data-t="performance">Campaign performance</button><button data-t="guest">Guest scores &amp; audits</button><button data-t="strategy">Strategy workspace</button></div><div id="mkBody" class="stack" style="gap:16px"></div>`;
      const tabs = view.querySelectorAll('.tabs button');
      const show = async t => {
        tab = t; tabs.forEach(b => b.classList.toggle('active', b.dataset.t === t));
        const body = view.querySelector('#mkBody'); body.innerHTML = '';
        if (t === 'performance') {
          body.innerHTML = `<div id="mMap"></div><div id="mOut" class="stack" style="gap:16px"></div>`;
          await App.ui.mapper(body.querySelector('#mMap'), { title: 'Campaign data', categories: ['marketing'], fields: FIELDS, key: 'marketing',
            onChange: (ds, m) => perf(body.querySelector('#mOut'), ds, m) });
        } else if (t === 'guest') guestTab(body);
        else strategy(body);
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
    const tgt = App.bsettings.get('mk.targets', { roas: 3, cpa: 50 });
    const [tot] = agg(ds.rows, m, () => 'Total');
    const camps = agg(ds.rows, m, r => String(r[m.camp] || '(none)'));
    const chans = m.chan ? agg(ds.rows, m, r => String(r[m.chan] || '(none)')) : [];
    const msub = App.period.range().sub || App.period.autoSub(m.date ? ds.rows.map(r => App.dateKey(r[m.date])) : []);
    const trend = m.date ? agg(ds.rows, m, r => App.period.bucket(r[m.date], msub)).sort((a, b) => a.key.localeCompare(b.key)) : [];

    const alerts = [];
    camps.forEach(c => {
      if (m.rev && c.spend > tot.spend * 0.05 && c.roas < 1) alerts.push(['bad', `${c.key}: ROAS ${c.roas.toFixed(2)}× — spending ${fmt.money(c.spend)} at a loss`]);
      else if (m.rev && c.roas < tgt.roas && c.spend > tot.spend * 0.05) alerts.push(['warn', `${c.key}: ROAS ${c.roas.toFixed(2)}× below ${tgt.roas}× target`]);
      if (m.conv && c.cpa > tgt.cpa * 1.5) alerts.push(['warn', `${c.key}: CPA ${fmt.money(c.cpa, 2)} vs ${fmt.money(tgt.cpa)} target`]);
      if (m.conv && c.spend > 0 && c.conv === 0) alerts.push(['bad', `${c.key}: ${fmt.money(c.spend)} spent with zero conversions`]);
    });
    const best = m.rev ? [...camps].filter(c => c.spend > 0).sort((a, b) => b.roas - a.roas)[0] : null;
    App.ui.publish('marketing', { spend: tot.spend, rev: tot.rev, roas: tot.roas, cpa: tot.cpa, alerts: alerts.length, flags: alerts.slice(0, 12).map(a => a[1]) });

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

    const tr = s => s.oninput = () => { App.bsettings.set('mk.targets', { roas: +el.querySelector('#tRoas').value, cpa: +el.querySelector('#tCpa').value }); };
    tr(el.querySelector('#tRoas')); tr(el.querySelector('#tCpa'));
    el.querySelectorAll('#tRoas,#tCpa').forEach(i => i.onchange = () => perf(el, ds, m));

    if (chans.length) App.ui.chart('mkChan', 'doughnut', { labels: chans.map(c => c.key), datasets: [{ data: chans.map(c => c.spend) }] });
    if (trend.length > 1) {
      const dsets = [{ label: 'Spend', data: trend.map(t => t.spend) }];
      if (m.rev) dsets.push({ label: 'Revenue', data: trend.map(t => t.rev), color: '#059669' });
      App.ui.chart('mkTrend', 'line', { labels: trend.map(t => App.period.bucketLabel(t.key, msub)), datasets: dsets });
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
    const swot = App.bsettings.get('mk.swot', { s: '', w: '', o: '', t: '' });
    const inits = App.bsettings.get('mk.initiatives', []);
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
    body.querySelectorAll('[data-sw]').forEach(t => t.oninput = () => { swot[t.dataset.sw] = t.value; App.bsettings.set('mk.swot', swot); });
    const board = () => {
      const groups = ['Idea', 'Planned', 'Active', 'Done'];
      body.querySelector('#iBoard').innerHTML = groups.map(g => `<div class="card" style="background:var(--panel-2)"><div class="card-head"><h3>${g}</h3><span class="badge">${inits.filter(i => i.status === g).length}</span></div>
        <div class="stack">${inits.filter(i => i.status === g).map(i => `<div class="note-item" style="background:var(--panel)"><b>${esc(i.name)}</b>
          <div class="muted small">${esc(i.owner || '—')}${i.due ? ' · due ' + esc(i.due) : ''}${i.budget ? ' · ' + fmt.money(+i.budget) : ''}</div>
          <div class="row" style="margin-top:6px"><select data-mv="${i.id}" class="small">${App.ui.options(groups, g)}</select><button class="btn small danger" data-rm="${i.id}">Remove</button></div></div>`).join('') || '<div class="muted small">—</div>'}</div></div>`).join('');
      body.querySelectorAll('[data-mv]').forEach(s => s.onchange = () => { inits.find(i => i.id === s.dataset.mv).status = s.value; App.bsettings.set('mk.initiatives', inits); board(); });
      body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { inits.splice(inits.findIndex(i => i.id === b.dataset.rm), 1); App.bsettings.set('mk.initiatives', inits); board(); });
    };
    body.querySelector('#iAdd').onclick = () => {
      const name = body.querySelector('#iName').value.trim();
      if (!name) return;
      inits.push({ id: App.uid(), name, owner: body.querySelector('#iOwner').value, due: body.querySelector('#iDue').value, budget: body.querySelector('#iBudget').value, status: body.querySelector('#iStatus').value });
      App.bsettings.set('mk.initiatives', inits);
      body.querySelector('#iName').value = '';
      board();
    };
    board();
  }

  /* ================= Guest scores & audits: Jersey Mike's 7 Principles of Success ================= */
  const G = () => App.guest;
  const pct = v => (isNaN(v) ? '—' : Math.round(v * 100) + '%');
  const pv = v => (v === '' || v == null || isNaN(+v) ? '—' : (+v).toFixed(+v % 1 ? 1 : 0) + '%');
  const delta = (v, p) => (isNaN(v) || isNaN(p) ? '' : `<span class="${v >= p ? 'up' : 'down'}">${v >= p ? '▲' : '▼'} ${Math.abs(v - p).toFixed(1).replace(/\.0$/, '')}</span>`);

  function guestTab(body) {
    const s = G().publish(), T = s.targets;
    const ov = s.last ? +s.last.scores?.overall : NaN, ovp = s.prev ? +s.prev.scores?.overall : NaN;
    body.innerHTML = `
      <div class="card row spread">
        <div><h2>Guest scores &amp; store audits</h2><div class="muted small">SMG guest survey results and audits, scored against Jersey Mike's 7 Principles of Success.</div></div>
        <div class="row"><label class="btn primary" title="Upload the Full Scale or Trend report exported from SMG (CSV or Excel)">${App.fx.icon('upload')} Import SMG report<input type="file" id="gImp" accept=".csv,.xlsx,.xls" multiple hidden></label><button class="btn" id="gSmg">${App.fx.icon('plus')} Type in SMG scores</button><button class="btn primary" id="gAudit">${App.fx.icon('shield')} Start an audit</button><button class="btn" id="gTargets">Goals</button></div>
      </div>
      ${!s.last && !s.lastA ? App.ui.empty('No scores yet. Add your latest SMG results or walk the store with an audit: one step per principle, about 5 minutes.', '<div class="row" style="justify-content:center"><button class="btn primary" data-g="smg">Add SMG scores</button><button class="btn" data-g="audit">Start an audit</button></div>') : `
      <div class="grid k4">
        ${App.ui.kpi('Overall satisfaction', pv(ov), s.last ? `SMG ${fmt.date(s.last.from)} – ${fmt.date(s.last.to)}${s.last.surveys ? ` · ${s.last.surveys} surveys` : ''}${s.last.region?.overall != null ? ` · ${esc(benchShort(s.last))} ${pv(s.last.region.overall)}` : ''} · goal ${T.overall}%` : 'add SMG scores', isNaN(ov) ? '' : ov >= T.overall ? 'good' : 'bad', false)}
        ${App.ui.kpi('Latest audit', pct(s.lastA?.s.score), s.lastA ? `${esc(s.lastA.type)} · ${fmt.date(s.lastA.date)} · goal ${T.audit}%` : 'start an audit', !s.lastA ? '' : s.lastA.s.score * 100 >= T.audit ? 'good' : s.lastA.s.score * 100 >= T.auditGate ? 'warn' : 'bad', false)}
        ${App.ui.kpi('Weakest principle', s.weakest ? `<span style="font-size:19px;line-height:1.25;display:block">${esc(`${s.weakest.n}. ${s.weakest.title}`)}</span>` : '—', s.weakest ? `${pct(s.weakest.auditScore)} on the last audit` : '', s.weakest && s.weakest.auditScore < 0.8 ? 'bad' : 'warn', false)}
        ${App.ui.kpi('Items to fix', String(s.lastA ? s.lastA.s.misses.length : 0), s.lastA ? `from the ${fmt.date(s.lastA.date)} audit` : '', s.lastA?.s.misses.length ? 'warn' : 'good', false)}
      </div>
      <div class="card"><div class="card-head"><div><h2>The 7 Principles of Success</h2><div class="muted small">Latest audit score for each principle, with the SMG measures guests use to judge it${s.last && s.prev ? ' (▲▼ vs the previous SMG period)' : ''}.</div></div></div>
        <div class="principles">${s.board.map(b => `
          <div class="principle ${b.tone}">
            <div class="pr-head"><span class="pr-n">${b.n}</span><div style="min-width:0"><b>${esc(b.title)}</b><div class="muted tiny">${esc(b.std)}</div></div></div>
            <div class="pr-score"><span>${pct(b.auditScore)}</span><span class="muted tiny">audit${!isNaN(b.auditScore) && !isNaN(b.prevScore) ? ' ' + delta(b.auditScore * 100, b.prevScore * 100) : ''}</span></div>
            <div class="meter"><i style="width:${isNaN(b.auditScore) ? 0 : Math.round(b.auditScore * 100)}%"></i></div>
            ${b.metrics.map(m => `<div class="row spread small pr-m"><span>SMG ${esc(m.label.toLowerCase())}</span><span><b class="${!isNaN(m.v) && m.target ? (m.v >= m.target ? 'ok' : 'low') : ''}">${pv(m.v)}</b> ${m.lower ? delta(-m.v, -m.pv) : delta(m.v, m.pv)}${!isNaN(m.region) ? ` <span class="muted tiny">${esc(benchShort(s.last))} ${pv(m.region)}</span>` : ''}</span></div>`).join('')}
            ${b.misses.length ? `<ul class="pr-miss tiny">${b.misses.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          </div>`).join('')}</div></div>
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>SMG trend</h2><span class="muted small">% of guests rating 5 (top box), ${weekly().length >= 2 ? 'by week' : 'by survey period'}</span></div>${trendRows().length ? '<div class="chart-box"><canvas id="gSmgChart"></canvas></div>' : '<div class="muted small">Add two or more periods to see the trend.</div>'}</div>
        <div class="card"><div class="card-head"><h2>Audit trend</h2><span class="muted small">Gate 1: ${T.auditGate}% · goal: ${T.audit}%</span></div>${s.audits.length ? '<div class="chart-box"><canvas id="gAudChart"></canvas></div>' : '<div class="muted small">No audits yet.</div>'}</div>
      </div>
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>SMG periods</h2><span class="badge">${s.smg.length}</span></div><div id="gSmgT"></div></div>
        <div class="card"><div class="card-head"><h2>Audits</h2><span class="badge">${s.audits.length}</span></div><div id="gAudT"></div></div>
      </div>
      ${whyCard(s)}
      ${s.last?.comments ? `<div class="card"><div class="card-head"><h2>Guest comments</h2><span class="muted small">SMG ${fmt.date(s.last.from)} – ${fmt.date(s.last.to)}</span></div><div class="small" style="white-space:pre-wrap">${esc(s.last.comments)}</div></div>` : ''}`}`;

    const refresh = () => guestTab(body);
    body.querySelector('#gSmg').onclick = () => smgDialog(null, refresh);
    body.querySelector('#gImp').onchange = async e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) { await App.ingest.ingestMany(f); refresh(); } };
    body.querySelector('#gAudit').onclick = () => auditDialog(null, refresh);
    body.querySelector('#gTargets').onclick = () => targetsDialog(refresh);
    body.querySelectorAll('[data-g]').forEach(b => b.onclick = () => (b.dataset.g === 'smg' ? smgDialog(null, refresh) : auditDialog(null, refresh)));
    if (!s.last && !s.lastA) return;

    const TR = trendRows();
    const KEY = ['overall', 'speed', 'clean', 'accuracy', 'digital', 'friendly', 'taste'];
    const shown = G().METRICS.filter(m => KEY.includes(m.k) && TR.some(r => r.scores?.[m.k] !== '' && r.scores?.[m.k] != null));
    if (TR.length) App.ui.chart('gSmgChart', 'line', { labels: TR.map(r => r.week ? `Wk ${r.week} (${fmt.date(r.from)})` : fmt.date(r.to || r.from)), datasets: shown.map(m => ({ label: m.label.replace(/ of (restaurant|staff|food)$/, ''), data: TR.map(r => r.scores?.[m.k] === '' || r.scores?.[m.k] == null ? null : +r.scores[m.k]), spanGaps: true, pointRadius: 3 })) },
      { scales: { y: { suggestedMin: 40, suggestedMax: 100, ticks: { callback: v => v + '%' } } } });
    if (s.audits.length) App.ui.chart('gAudChart', 'line', { labels: s.audits.map(a => `${fmt.date(a.date)}`), datasets: [
      { label: 'Audit score', data: s.audits.map(a => isNaN(a.s.score) ? null : +(a.s.score * 100).toFixed(1)), pointRadius: 5, pointHoverRadius: 7 },
      { label: `Goal ${T.audit}%`, data: s.audits.map(() => T.audit), borderDash: [6, 4], pointRadius: 0, color: '#059669' },
      { label: `Gate ${T.auditGate}%`, data: s.audits.map(() => T.auditGate), borderDash: [3, 4], pointRadius: 0, color: '#d97706' }] },
      { scales: { y: { suggestedMin: 50, suggestedMax: 100, ticks: { callback: v => v + '%' } } } });

    App.ui.table(body.querySelector('#gSmgT'), [
      { key: 'period', label: 'Period' }, { key: 'src', label: 'From' }, { key: 'surveys', label: 'Surveys', num: true },
      { key: 'overall', label: 'Overall', num: true, fmt: v => pv(v) }, { key: 'speed', label: 'Speed', num: true, fmt: v => pv(v) }, { key: 'clean', label: 'Clean', num: true, fmt: v => pv(v) },
      { key: 'digital', label: 'Digital acc.', num: true, fmt: v => pv(v) }, { key: 'id', label: '', fmt: v => `<button class="btn small" data-es="${v}">Edit</button>` }
    ], [...s.smg].reverse().map(r => ({ id: r.id, src: r.imported ? (r.week ? 'SMG trend' : 'SMG full scale') : 'Typed in', period: `${fmt.date(r.from)} – ${fmt.date(r.to)}`, surveys: +r.surveys || 0, overall: num(r.scores?.overall), speed: num(r.scores?.speed), clean: num(r.scores?.clean), digital: num(r.scores?.digital) })));
    App.ui.table(body.querySelector('#gAudT'), [
      { key: 'date', label: 'Date', fmt: v => fmt.date(v) }, { key: 'type', label: 'Type' }, { key: 'by', label: 'By' },
      { key: 'score', label: 'Score', num: true, fmt: v => pct(v) }, { key: 'miss', label: 'To fix', num: true }, { key: 'id', label: '', fmt: v => `<button class="btn small" data-ea="${v}">Open</button>` }
    ], [...s.audits].reverse().map(a => ({ id: a.id, date: a.date, type: a.type, by: a.by || '', score: a.s.score, miss: a.s.misses.length })));
    body.querySelectorAll('[data-es]').forEach(b => b.onclick = () => smgDialog(G().smg().find(r => r.id === b.dataset.es), refresh));
    body.querySelectorAll('[data-ea]').forEach(b => b.onclick = () => auditDialog(G().audits().find(r => r.id === b.dataset.ea), refresh));
  }
  const num = v => (v === '' || v == null ? NaN : +v);
  const benchShort = e => (/jersey/i.test(e?.benchLabel || '') ? 'JM avg' : e?.benchLabel ? 'benchmark' : 'region');
  const weekly = () => G().smg().filter(r => r.week || (r.from && r.to && (new Date(r.to) - new Date(r.from)) / 864e5 <= 7));
  const trendRows = () => (weekly().length >= 2 ? weekly() : G().smg());

  /* Why unhappy guests weren't satisfied (SMG Full Scale follow-up questions) */
  function whyCard(s) {
    const e = [...s.smg].reverse().find(r => r.reasons && Object.keys(r.reasons).length);
    if (!e) return '';
    const NAMES = { speed: ['Speed of service', 5], taste: ['Taste of food', 3], accuracy: ['Order accuracy', 5] };
    return `<div class="card"><div class="card-head"><div><h2>Why guests weren't satisfied</h2><div class="muted small">SMG follow-up answers from guests who rated below top box · ${fmt.date(e.from)} – ${fmt.date(e.to)}</div></div></div>
      <div class="grid c3">${Object.entries(e.reasons).map(([k, list]) => `<div class="stack" style="gap:6px"><b class="small">${esc(NAMES[k]?.[0] || k)} <span class="muted tiny">· Principle ${NAMES[k]?.[1] || ''}</span></b>
        ${[...list].sort((a, b) => b.pct - a.pct).filter(x => x.pct > 0).map(x => `<div class="row spread small"><span>${esc(x.label)}</span><span><b>${pv(x.pct)}</b> <span class="muted tiny">of ${x.n}</span></span></div>`).join('') || '<span class="muted small">No reasons given</span>'}</div>`).join('')}</div>
      <div class="muted tiny" style="margin-top:8px">Small counts: with only a few unhappy guests, one answer can be 33–100%. Read these as leads, not trends.</div></div>`;
  }

  async function attach(file, tags) {
    if (!file) return null;
    const [f] = await App.ingest.ingestMany([file], { quiet: true, category: 'marketing', tags });
    return f ? { fileId: f.id, fileName: f.name } : null;
  }

  /* ---------- SMG survey entry ---------- */
  function smgDialog(rec, after) {
    const isNew = !rec;
    const today = new Date().toISOString().slice(0, 10);
    const r = rec || { id: App.uid(), from: '', to: today, surveys: '', scores: {}, region: {}, comments: '' };
    const T = G().targets();
    App.ui.modal(`<div class="card-head"><div><h2>${isNew ? 'Add SMG scores' : 'Edit SMG scores'}</h2><div class="muted small">Enter the % of guests who gave a 5 for each measure. Benchmark is optional. Tip: <b>Import SMG report</b> fills this in for you.</div></div><button class="btn small ghost" data-close>Cancel</button></div>
      <div class="stack form-group" style="gap:24px">
        <div class="mapper"><label>Period start<input type="date" id="sF" value="${esc(r.from)}"></label><label>Period end<input type="date" id="sT" value="${esc(r.to)}"></label><label>Surveys (n)<input type="number" min="0" id="sN" value="${esc(r.surveys)}" placeholder="e.g. 42"></label></div>
        <div class="smg-grid"><div class="tiny muted">Measure</div><div class="tiny muted">Your store %</div><div class="tiny muted">Benchmark % <span class="muted">(JM avg)</span></div><div class="tiny muted">Principle</div>
          ${G().METRICS.map(m => `<label for="sm_${m.k}" class="small">${esc(m.label)}${T[m.k] ? ` <span class="tiny muted">goal ${T[m.k]}%</span>` : ''}</label>
            <input id="sm_${m.k}" type="number" min="0" max="100" step="0.1" data-sc="${m.k}" value="${esc(r.scores?.[m.k] ?? '')}" inputmode="decimal">
            <input type="number" min="0" max="100" step="0.1" data-rg="${m.k}" value="${esc(r.region?.[m.k] ?? '')}" inputmode="decimal" aria-label="${esc(m.label)} region">
            <span class="tiny muted">${m.principle ? `${G().P[m.principle].n}. ${esc(G().P[m.principle].title)}` : '—'}</span>`).join('')}</div>
        <label class="field">Guest comments worth sharing (optional)<textarea id="sC" rows="3" placeholder="“Great customer service from Dylan…”">${esc(r.comments || '')}</textarea></label>
        <label class="field">Attach the SMG report (optional)<input type="file" id="sFile" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx">${r.fileName ? `<span class="tiny muted">On file: ${esc(r.fileName)}</span>` : ''}</label>
        <div class="confirm-actions form-submit" style="margin-top:8px">${isNew ? '' : '<button class="btn danger" id="sDel">Delete period…</button>'}<button class="btn primary" id="sSave">${isNew ? 'Save SMG scores' : 'Save changes'}</button></div>
      </div>`, (card, close) => {
      card.classList.add('wide');
      card.querySelector('#sSave').onclick = async () => {
        const g = q => card.querySelector(q).value;
        const scores = {}, region = {};
        card.querySelectorAll('[data-sc]').forEach(i => { if (i.value !== '') scores[i.dataset.sc] = Math.max(0, Math.min(100, +i.value)); });
        card.querySelectorAll('[data-rg]').forEach(i => { if (i.value !== '') region[i.dataset.rg] = Math.max(0, Math.min(100, +i.value)); });
        if (!g('#sT')) return App.ui.toast('Enter the period end date');
        if (!Object.keys(scores).length) return App.ui.toast('Enter at least one score');
        const next = { ...r, from: g('#sF') || g('#sT'), to: g('#sT'), surveys: g('#sN'), scores, region, comments: g('#sC').trim(), updated: Date.now() };
        const a = await attach(card.querySelector('#sFile').files[0], ['SMG', next.to]);
        if (a) Object.assign(next, a);
        G().save('smg', next);
        App.compliance?.audit(isNew ? 'SMG scores added' : 'SMG scores edited', `${next.from} – ${next.to} · overall ${next.scores.overall ?? '—'}%`);
        close(); App.ui.toast('SMG scores saved'); after();
      };
      card.querySelector('#sDel')?.addEventListener('click', async () => {
        if (!await App.confirm({ title: 'Delete this SMG period?', body: `${fmt.date(r.from)} – ${fmt.date(r.to)} will be removed from the trend and the dashboard.`, ok: 'Delete period', cancel: 'Keep period', danger: true })) return;
        G().remove('smg', r.id); close(); after();
      });
    });
  }

  /* ---------- Audit: one step per principle ---------- */
  function auditDialog(rec, after) {
    const isNew = !rec;
    const a = rec ? JSON.parse(JSON.stringify(rec)) : { id: App.uid(), date: new Date().toISOString().slice(0, 10), type: 'Self-evaluation', by: App.settings.get('userName', ''), official: '', answers: {}, notes: {} };
    const step = p => `<section data-step="${p.n}. ${esc(p.title)}" class="stack form-group" data-p="${p.key}">
        <div><b>Principle ${p.n}: ${esc(p.title)}</b><div class="muted small">${esc(p.std)}</div></div>
        <div class="stack audit-items">${p.checks.map((c, i) => `<div class="audit-item"><span class="small">${esc(c)}</span>
          <div class="seg yn" role="radiogroup" aria-label="${esc(c)}">${[['yes', 'Yes'], ['no', 'Needs work'], ['na', 'N/A']].map(([v, l]) => `<button type="button" data-a="${p.key}:${i}" data-v="${v}" class="${a.answers?.[p.key]?.[i] === v ? 'on ' + v : ''}">${l}</button>`).join('')}</div></div>`).join('')}</div>
        <label class="field">Notes for ${esc(p.title.toLowerCase())}<textarea rows="2" data-note="${p.key}" placeholder="What you saw, who fixed it, follow-up">${esc(a.notes?.[p.key] || '')}</textarea></label>
        <div class="tiny muted" data-live="${p.key}"></div>
      </section>`;
    App.ui.modal(`<div class="card-head"><div><h2>${isNew ? 'Store audit' : `${esc(a.type)} · ${fmt.date(a.date)}`}</h2><div class="muted small">Walk the store one principle at a time. Mark anything that isn't right as "Needs work".</div></div><button class="btn small ghost" data-close>${isNew ? 'Cancel' : 'Close'}</button></div>
      <div class="stack" data-steps>
        <section data-step="Details" class="stack form-group">
          <div class="mapper"><label>Date<input type="date" id="aD" value="${esc(a.date)}"></label><label>Type<select id="aT" data-native>${App.ui.options(G().AUDIT_TYPES, a.type)}</select></label><label>Done by<input id="aBy" value="${esc(a.by || '')}" placeholder="Name"></label>
            <label>Official score % <span class="tiny">(if the auditor gave one)</span><input type="number" id="aO" min="0" max="100" step="0.1" value="${esc(a.official ?? '')}" placeholder="optional"></label></div>
          <label class="field">Attach the audit report (optional)<input type="file" id="aFile" accept=".pdf,.png,.jpg,.jpeg">${a.fileName ? `<span class="tiny muted">On file: ${esc(a.fileName)}</span>` : ''}</label>
        </section>
        ${G().PRINCIPLES.map(step).join('')}
        <section data-step="Review" class="stack form-group"><div id="aReview"></div>
          <div class="confirm-actions form-submit">${isNew ? '' : '<button class="btn danger" id="aDel">Delete audit…</button>'}<button class="btn primary" id="aSave">${isNew ? 'Save audit' : 'Save changes'}</button></div></section>
      </div>`, (card, close) => {
      card.classList.add('wide');
      const live = () => {
        const sc = G().scoreAudit(a);
        G().PRINCIPLES.forEach(p => { const el = card.querySelector(`[data-live="${p.key}"]`); if (el) el.textContent = isNaN(sc.per[p.key]) ? 'Not scored yet' : `Principle score: ${pct(sc.per[p.key])}`; });
        card.querySelector('#aReview').innerHTML = `<div class="grid k4">${App.ui.kpi('Checklist score', pct(sc.checklist), `${sc.answered} items answered`, isNaN(sc.checklist) ? '' : sc.checklist >= 0.9 ? 'good' : sc.checklist >= 0.8 ? 'warn' : 'bad', false)}${!isNaN(sc.official) ? App.ui.kpi('Official score', pct(sc.official), 'used as the audit score', '', false) : ''}</div>
          <div class="stack" style="margin-top:12px">${G().PRINCIPLES.map(p => `<div class="row spread small"><span>${p.n}. ${esc(p.title)}</span><b>${pct(sc.per[p.key])}</b></div>`).join('')}</div>
          ${sc.misses.length ? `<h3 style="margin-top:14px">To fix (${sc.misses.length})</h3><ul class="small">${sc.misses.map(x => `<li><b>${x.principle.n}.</b> ${esc(x.item)}</li>`).join('')}</ul>` : '<div class="alert good small" style="margin-top:12px">Nothing marked "Needs work".</div>'}`;
      };
      card.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
        const [pk, i] = b.dataset.a.split(':');
        a.answers[pk] = a.answers[pk] || {};
        a.answers[pk][i] = a.answers[pk][i] === b.dataset.v ? undefined : b.dataset.v;
        b.parentElement.querySelectorAll('button').forEach(x => x.className = a.answers[pk][i] === x.dataset.v ? 'on ' + x.dataset.v : '');
        live();
      });
      card.querySelectorAll('[data-note]').forEach(t => t.oninput = () => { a.notes[t.dataset.note] = t.value; });
      card.querySelector('#aO').oninput = e => { a.official = e.target.value; live(); };
      App.ux.steps(card.querySelector('[data-steps]'), { finish: '#aSave' });
      live();
      card.querySelector('#aSave').onclick = async () => {
        Object.assign(a, { date: card.querySelector('#aD').value || a.date, type: card.querySelector('#aT').value, by: card.querySelector('#aBy').value.trim(), official: card.querySelector('#aO').value, updated: Date.now() });
        for (const k of Object.keys(a.answers)) for (const i of Object.keys(a.answers[k])) if (a.answers[k][i] === undefined) delete a.answers[k][i];
        const f = await attach(card.querySelector('#aFile').files[0], ['Audit', a.type, a.date]);
        if (f) Object.assign(a, f);
        G().save('audit', a);
        const sc = G().scoreAudit(a);
        App.compliance?.audit(isNew ? 'Store audit recorded' : 'Store audit edited', `${a.type} ${a.date} · ${pct(sc.score)} · ${sc.misses.length} to fix`);
        close(); App.ui.toast(`Audit saved: ${pct(sc.score)}${sc.misses.length ? ` · ${sc.misses.length} item${sc.misses.length > 1 ? 's' : ''} to fix` : ''}`); after();
      };
      card.querySelector('#aDel')?.addEventListener('click', async () => {
        if (!await App.confirm({ title: 'Delete this audit?', body: `The ${a.type.toLowerCase()} from ${fmt.date(a.date)} will be removed from the trend and the 7 Principles scoreboard.`, ok: 'Delete audit', cancel: 'Keep audit', danger: true })) return;
        G().remove('audit', a.id); close(); after();
      });
    });
  }

  function targetsDialog(after) {
    const T = G().targets();
    const rows = [...G().METRICS.map(m => [m.k, `SMG ${m.label.toLowerCase()}`]), ['audit', 'Audit score goal'], ['auditGate', 'Audit gate (checkpoint)']];
    App.ui.modal(`<div class="card-head"><h2>Goals</h2><button class="btn small ghost" data-close>Cancel</button></div>
      <div class="stack form-group" style="gap:24px"><div class="mapper">${rows.map(([k, l]) => `<label>${esc(l)} %<input type="number" min="0" max="100" step="1" data-t="${k}" value="${T[k] ?? ''}"></label>`).join('')}</div>
      <div class="confirm-actions form-submit"><button class="btn" id="tReset">Use the default goals</button><button class="btn primary" id="tSave">Save goals</button></div></div>`, (card, close) => {
      card.querySelector('#tSave').onclick = () => { const o = {}; card.querySelectorAll('[data-t]').forEach(i => { if (i.value !== '') o[i.dataset.t] = +i.value; }); App.bsettings.set('guest.targets', o); close(); after(); };
      card.querySelector('#tReset').onclick = () => { App.bsettings.set('guest.targets', {}); close(); after(); };
    });
  }
})(window.App);
