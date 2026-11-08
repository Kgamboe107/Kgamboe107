/* Targets & Weekly Review: set a target for each KPI (per unit), then review a week against those targets
   and print a one-page sheet per unit. Business units get operating KPIs, personal units get money KPIs.
   Weekly numbers are computed by running each page's analysis with the reporting period set to that week. */
(function (App) {
  const { fmt, esc } = App;
  const P = () => App.period;
  const num = v => typeof v === 'number' && Number.isFinite(v);

  /* ---------- Metric catalogue ---------- */
  // f: how to format · better: which way is good · ops / guest: target shared with Operations / Marketing
  // weekly:false = a "latest" value (balances, scores), not something summed over the week
  const METRICS = [
    { id: 'sales', kind: 'business', label: 'Net sales', f: 'money', better: 'up', get: k => k.operations?.sales || k.finance?.revenue || NaN },
    { id: 'labor', kind: 'business', label: 'Labor % of sales', f: 'pct', better: 'down', ops: 'labor', get: k => k.operations?.laborPct },
    { id: 'food', kind: 'business', label: 'Food cost %', f: 'pct', better: 'down', ops: 'food', get: k => num(k.purchases?.foodPct) ? k.purchases.foodPct : k.operations?.foodPct },
    { id: 'prime', kind: 'business', label: 'Prime cost %', f: 'pct', better: 'down', ops: 'prime', get: k => num(k.operations?.primePct) ? k.operations.primePct : num(k.operations?.laborPct) && num(k.purchases?.foodPct) ? k.operations.laborPct + k.purchases.foodPct : NaN },
    { id: 'splh', kind: 'business', label: 'Sales per labor hour', f: 'money2', better: 'up', ops: 'splh', get: k => k.operations?.splh },
    { id: 'ot', kind: 'business', label: 'Overtime % of hours', f: 'pct', better: 'down', ops: 'ot', get: k => k.operations?.otPct },
    { id: 'purch', kind: 'business', label: 'Total purchases', f: 'money', better: 'down', get: k => k.purchases?.receipts ? k.purchases.total : NaN },
    { id: 'margin', kind: 'business', label: 'Net margin', f: 'pct', better: 'up', get: k => k.finance?.margin === 1 ? NaN : k.finance?.margin },
    { id: 'guest', kind: 'business', label: 'Guest satisfaction (latest SMG)', f: 'pts', better: 'up', guest: 'overall', weekly: false, get: k => k.guest?.overall },
    { id: 'audit', kind: 'business', label: 'Store audit score (latest)', f: 'pts', better: 'up', guest: 'audit', weekly: false, get: k => num(k.guest?.audit) ? k.guest.audit * 100 : NaN },
    { id: 'mkspend', kind: 'business', label: 'Marketing spend', f: 'money', better: 'down', get: k => k.marketing?.spend },
    { id: 'roas', kind: 'business', label: 'Marketing ROAS', f: 'x', better: 'up', get: k => num(+k.marketing?.roas) && +k.marketing.roas ? +k.marketing.roas : NaN },
    { id: 'overdue', kind: 'business', label: 'Overdue filings', f: 'int', better: 'down', def: 0, weekly: false, get: k => k.compliance?.overdue },
    { id: 'income', kind: 'individual', label: 'Income', f: 'money', better: 'up', get: k => k.finance?.revenue || NaN },
    { id: 'workhrs', kind: 'individual', label: 'Work hours', f: 'int', better: 'down', def: 48, get: k => k.work?.hours || NaN },
    { id: 'perhour', kind: 'individual', label: 'Pay per labor hour', f: 'money2', better: 'up', get: k => k.work?.perHour },
    { id: 'worklabor', kind: 'individual', label: 'Personal labor %', f: 'pct', better: 'down', def: 1, get: k => k.work?.laborPct },
    { id: 'costearn', kind: 'individual', label: 'Cost to earn %', f: 'pct', better: 'down', def: 0.05, get: k => k.work?.costPct },
    { id: 'receipts', kind: 'individual', label: 'Spending from receipts', f: 'money', better: 'down', get: k => k.spending?.count ? k.spending.total : NaN },
    { id: 'spend', kind: 'individual', label: 'Spending', f: 'money', better: 'down', get: k => num(k.finance?.revenue) && num(k.finance?.net) && k.finance.margin !== 1 ? k.finance.revenue - k.finance.net : NaN },
    { id: 'save', kind: 'individual', label: 'Savings rate', f: 'pct', better: 'up', def: 0.2, get: k => k.finance?.margin === 1 ? NaN : k.finance?.margin },
    { id: 'nw', kind: 'individual', label: 'Net worth', f: 'money', better: 'up', weekly: false, get: k => k.wealth?.accounts ? k.wealth.net : NaN },
    { id: 'liquid', kind: 'individual', label: 'Cash & emergency fund', f: 'money', better: 'up', weekly: false, get: k => k.wealth?.accounts ? k.wealth.liquid : NaN },
    { id: 'invested', kind: 'individual', label: 'Invested assets', f: 'money', better: 'up', weekly: false, get: k => k.wealth?.accounts ? k.wealth.invested : NaN },
    { id: 'debt', kind: 'individual', label: 'Total debts', f: 'money', better: 'down', weekly: false, get: k => k.wealth?.accounts ? k.wealth.debts : NaN },
    { id: 'trading', kind: 'individual', label: 'Realized trading P&L', f: 'money', better: 'up', get: k => k['trading-perf']?.total }
  ];
  const isPct = m => m.f === 'pct';
  const show = (m, v) => {
    if (!num(v)) return '—';
    return { money: fmt.money(v), money2: fmt.money(v, 2), pct: fmt.pct(v), pts: v.toFixed(1).replace(/\.0$/, '') + '%', x: v.toFixed(2) + '×', int: fmt.num(v) }[m.f] ?? String(v);
  };

  /* ---------- Targets (per unit; Operations and SMG targets are shared with those pages) ---------- */
  const OPS_DEF = { labor: 0.28, food: 0.30, prime: 0.60, splh: 55, ot: 0.05 };
  const ops = () => ({ ...OPS_DEF, ...App.bsettings.get('ops.targets', {}) });
  const own = () => App.bsettings.get('targets', {});
  function target(m) {
    if (m.ops) return ops()[m.ops];
    if (m.guest) return App.guest?.targets?.()[m.guest];
    const t = own()[m.id];
    return t && num(t.v) ? t.v : m.def;
  }
  function setTarget(m, v) {
    if (m.ops) { App.bsettings.set('ops.targets', { ...ops(), [m.ops]: num(v) ? v : OPS_DEF[m.ops] }); return; }
    if (m.guest) { App.bsettings.set('guest.targets', { ...App.bsettings.get('guest.targets', {}), [m.guest]: v }); return; }
    App.bsettings.set('targets', { ...own(), [m.id]: { ...(own()[m.id] || {}), v: num(v) ? v : null } });
  }
  const shownSet = () => App.bsettings.get('review.metrics', null);
  const kindMetrics = kind => METRICS.filter(m => m.kind === kind);
  /* Metrics on the sheet: the ones picked, or by default every one with data */
  function pickMetrics(kind, weeks) {
    const sel = shownSet();
    const ms = kindMetrics(kind);
    if (Array.isArray(sel)) return ms.filter(m => sel.includes(m.id));
    return ms.filter(m => weeks.some(w => num(m.get(w.k))));
  }

  function status(m, v, t) {
    if (!num(v) || !num(t)) return { s: 'none', label: 'No target', tone: '' };
    const ok = m.better === 'up' ? v >= t : v <= t;
    if (ok) return { s: 'hit', label: 'On target', tone: 'good' };
    const gap = Math.abs(v - t) / (Math.abs(t) || 1);
    return gap <= 0.05 ? { s: 'close', label: 'Close', tone: 'warn' } : { s: 'miss', label: 'Off target', tone: 'bad' };
  }
  function change(m, v, p) {
    if (!num(v) || !num(p)) return '';
    const up = v >= p, good = (m.better === 'up') === up;
    if (v === p) return '<span class="muted">no change</span>';
    const txt = isPct(m) ? `${Math.abs((v - p) * 100).toFixed(1)} pts` : m.f === 'pts' ? `${Math.abs(v - p).toFixed(1)} pts` : p ? `${Math.abs((v / p - 1) * 100).toFixed(1)}%` : show(m, Math.abs(v - p));
    return `<span class="${good ? 'up' : 'down'}">${up ? '▲' : '▼'} ${txt}</span>`;
  }
  const BARS = '▁▂▃▄▅▆▇█';
  function spark(vals) {
    const v = vals.filter(num);
    if (v.length < 2) return '';
    const lo = Math.min(...v), hi = Math.max(...v);
    return vals.map(x => num(x) ? BARS[hi === lo ? 3 : Math.round((x - lo) / (hi - lo) * 7)] : ' ').join('');
  }

  /* ---------- Weekly numbers ---------- */
  const defaultWeek = () => { const t = P().parse(P().today()); t.setDate(t.getDate() - 7); return P().bounds('week', P().iso(t))[0]; };
  const shiftWeek = (from, n) => { const d = P().parse(from); d.setDate(d.getDate() + 7 * n); return P().iso(d); };
  let week = null;

  async function unitReport(b, from) {
    return App.biz.withBiz(b.id, async () => {
      const saved = App.bsettings.get('kpis', {});
      const weeks = [];
      try {
        for (let i = 0; i < 4; i++) {
          const anchor = shiftWeek(from, -i);
          const [f, t] = P().bounds('week', anchor);
          const k = await P().withState({ g: 'week', anchor }, () => App.modules.dashboard.refreshKpis());
          weeks.push({ from: f, to: t, k });
        }
      } finally { App.bsettings.set('kpis', saved); }
      const kind = App.biz.kindOf(b);
      const ms = pickMetrics(kind, weeks);
      const rows = ms.map(m => {
        const vals = weeks.map(w => m.get(w.k));
        const t = target(m), v = vals[0];
        const avg4 = m.weekly === false ? NaN : (a => a.length ? App.sum(a) / a.length : NaN)(vals.filter(num));
        return { m, v, prev: vals[1], avg4, t, st: status(m, v, t), trend: spark(vals.slice().reverse()) };
      });
      // Alerts for this week only: drop ones that name dates outside it
      const inWeek = f => { const ds = String(f).match(/\d{4}-\d{2}-\d{2}/g); return !ds || ds.some(d => d >= weeks[0].from && d <= weeks[0].to); };
      const flags = Object.values(weeks[0].k).flatMap(x => (x && Array.isArray(x.flags) ? x.flags : [])).filter(inWeek).slice(0, 6);
      const notes = App.bsettings.get(`review.notes.${from}`, '');
      return { b, kind, weeks, rows, flags, notes };
    });
  }

  const tally = rows => { const scored = rows.filter(r => r.st.s !== 'none'); return { hit: scored.filter(r => r.st.s === 'hit').length, n: scored.length }; };

  /* ---------- Screen ---------- */
  function unitCard(R, multi) {
    const { hit, n } = tally(R.rows);
    const wins = R.rows.filter(r => r.st.s === 'hit'), misses = R.rows.filter(r => r.st.s === 'miss' || r.st.s === 'close');
    return `<div class="card rv-unit">
      <div class="card-head"><div><h2>${esc(R.b.name)}</h2><div class="muted small">${R.kind === 'individual' ? 'Personal' : 'Business'} · ${esc(P().labelOf('week', R.weeks[0].from, R.weeks[0].to))}</div></div>
        <div class="row">${n ? `<span class="badge ${hit === n ? 'good' : hit >= n / 2 ? 'warn' : 'bad'}">${hit} of ${n} on target</span>` : '<span class="badge">No targets set</span>'}
        ${multi ? '' : `<button class="btn small" data-edit="${R.b.id}">${App.fx.icon('target')} Edit targets</button>`}</div></div>
      ${R.rows.length ? `<div class="table-wrap rv-wrap"><table class="rv-tbl"><thead><tr><th>Metric</th><th class="num">Target</th><th class="num">This week</th><th class="num">Last week</th><th>Change</th><th class="num">4-wk avg</th><th>Trend</th><th>Status</th></tr></thead><tbody>
        ${R.rows.map(r => `<tr><td>${esc(r.m.label)}${r.m.weekly === false ? ' <span class="muted tiny">(latest)</span>' : ''}</td>
          <td class="num muted">${num(r.t) ? `${r.m.better === 'up' ? '≥' : '≤'} ${show(r.m, r.t)}` : '—'}</td>
          <td class="num"><b>${show(r.m, r.v)}</b></td><td class="num">${show(r.m, r.prev)}</td><td class="rv-chg">${change(r.m, r.v, r.prev)}</td>
          <td class="num">${show(r.m, r.avg4)}</td><td class="rv-spark" aria-hidden="true">${r.trend}</td>
          <td>${r.st.s === 'none' ? '<span class="muted tiny">—</span>' : `<span class="badge ${r.st.tone}">${r.st.label}</span>`}</td></tr>`).join('')}
      </tbody></table></div>` : App.ui.empty('No numbers for this week yet. Upload this week’s reports, or pick another week.')}
      <div class="grid c2 rv-sum">
        <div><div class="rv-h">Wins</div>${wins.length ? `<ul>${wins.map(r => `<li>${esc(r.m.label)}: ${show(r.m, r.v)}</li>`).join('')}</ul>` : '<div class="muted small">None yet this week</div>'}</div>
        <div><div class="rv-h">Off target</div>${misses.length ? `<ul>${misses.map(r => `<li>${esc(r.m.label)}: ${show(r.m, r.v)} vs ${show(r.m, r.t)}</li>`).join('')}</ul>` : '<div class="muted small">Nothing off target</div>'}</div>
      </div>
      ${R.flags.length ? `<div class="rv-h">Needs attention</div><ul class="rv-flags">${R.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      <label class="field rv-notes">Notes &amp; actions for next week<textarea rows="3" data-notes="${R.b.id}" placeholder="What happened, and what you'll do about it">${esc(R.notes)}</textarea></label>
    </div>`;
  }

  /* ---------- Print ---------- */
  function sheetHtml(R) {
    const { hit, n } = tally(R.rows);
    const wins = R.rows.filter(r => r.st.s === 'hit'), misses = R.rows.filter(r => r.st.s !== 'hit' && r.st.s !== 'none');
    const mark = s => ({ hit: '✓', close: '~', miss: '✗' })[s] || '';
    return `<section class="ps-page">
      <header class="ps-head"><div><div class="ps-kicker">Weekly KPI review</div><h1>${esc(R.b.name)}</h1></div>
        <div class="ps-meta"><b>${esc(P().labelOf('week', R.weeks[0].from, R.weeks[0].to))}</b><br>${R.kind === 'individual' ? 'Personal' : 'Business'} · prepared ${esc(fmt.date(new Date()))}<br>${n ? `<b>${hit} of ${n}</b> on target` : 'No targets set'}</div></header>
      <table class="ps-tbl"><thead><tr><th>Metric</th><th>Target</th><th>This week</th><th>Last week</th><th>Change</th><th>4-wk avg</th><th>Trend</th><th></th></tr></thead><tbody>
        ${R.rows.map(r => `<tr class="${r.st.s}"><td>${esc(r.m.label)}${r.m.weekly === false ? ' <i>(latest)</i>' : ''}</td><td>${num(r.t) ? `${r.m.better === 'up' ? '≥' : '≤'} ${show(r.m, r.t)}` : '—'}</td>
          <td><b>${show(r.m, r.v)}</b></td><td>${show(r.m, r.prev)}</td><td>${change(r.m, r.v, r.prev).replace(/<[^>]+>/g, '')}</td><td>${show(r.m, r.avg4)}</td><td class="ps-spark">${r.trend}</td><td class="ps-mark">${mark(r.st.s)}</td></tr>`).join('') || '<tr><td colspan="8">No numbers for this week.</td></tr>'}
      </tbody></table>
      <div class="ps-cols"><div><h3>Wins</h3><ul>${wins.map(r => `<li>${esc(r.m.label)}: ${show(r.m, r.v)}</li>`).join('') || '<li class="ps-dim">—</li>'}</ul></div>
        <div><h3>Off target</h3><ul>${misses.map(r => `<li>${esc(r.m.label)}: ${show(r.m, r.v)} (target ${show(r.m, r.t)})</li>`).join('') || '<li class="ps-dim">—</li>'}</ul></div></div>
      ${R.flags.length ? `<h3>Needs attention</h3><ul>${R.flags.slice(0, 5).map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      <h3>Notes &amp; actions for next week</h3>
      ${R.notes ? `<div class="ps-notes">${esc(R.notes).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="ps-lines">${'<div></div>'.repeat(R.notes ? 3 : 5)}</div>
      <footer class="ps-foot"><span>Reviewed by ____________________</span><span>Date __________</span><span class="ps-dim">Ops Command Desk</span></footer>
    </section>`;
  }
  function print(reports) {
    document.querySelector('.print-sheet')?.remove();
    const el = document.createElement('div');
    el.className = 'print-sheet';
    el.innerHTML = reports.map(sheetHtml).join('');
    document.body.appendChild(el);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); el.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }

  /* ---------- Targets editor ---------- */
  function editTargets(unitId, onSaved, shownNow = {}) {
    const units = App.biz.inView();
    let id = unitId || units[0]?.id;
    const draw = (c, close) => {
      const b = App.biz.get(id), kind = App.biz.kindOf(b);
      App.biz.withBiz(id, async () => {
        const sel = shownSet(), cur = App.bsettings.get('kpis', {});
        const ms = kindMetrics(kind);
        c.innerHTML = `<div class="row spread"><h2>Targets</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
          ${units.length > 1 ? `<div class="seg" role="tablist">${units.map(u => `<button data-u="${u.id}" class="${u.id === id ? 'on' : ''}">${esc(u.name)}</button>`).join('')}</div>` : ''}
          <p class="muted small">Targets for <b>${esc(b.name)}</b>. Labor, food, prime cost, sales per labor hour and overtime are shared with Operations; guest and audit targets with Marketing. Untick a metric to leave it off the sheet.</p>
          <div class="rv-targets">${ms.map(m => {
            const t = target(m), on = Array.isArray(sel) ? sel.includes(m.id) : shownNow[id]?.length ? shownNow[id].includes(m.id) : num(m.get(cur)) || num(t);
            const v = num(t) ? (isPct(m) ? +(t * 100).toFixed(2) : t) : '';
            return `<div class="rv-trow"><label class="rv-on"><input type="checkbox" data-on="${m.id}" ${on ? 'checked' : ''}> ${esc(m.label)}</label>
              <span class="muted tiny">${m.better === 'up' ? 'at least' : 'at most'}</span>
              <span class="rv-in"><span class="muted">${m.f.startsWith('money') ? '$' : ''}</span><input type="number" step="any" data-t="${m.id}" value="${v}" aria-label="${esc(m.label)} target" placeholder="none"><span class="muted">${isPct(m) || m.f === 'pts' ? '%' : m.f === 'x' ? '×' : ''}</span></span></div>`;
          }).join('')}</div>
          <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="rvSave">Save targets</button></div>`;
        c.querySelectorAll('[data-close]').forEach(x => x.onclick = close);
        c.querySelectorAll('[data-u]').forEach(x => x.onclick = () => { id = x.dataset.u; draw(c, close); });
        c.querySelector('#rvSave').onclick = () => App.biz.withBiz(id, async () => {
          for (const m of ms) {
            const raw = c.querySelector(`[data-t="${m.id}"]`).value.trim();
            const v = raw === '' ? NaN : +raw;
            if (raw !== '' && !num(v)) continue;
            setTarget(m, isPct(m) && num(v) ? v / 100 : v);
          }
          App.bsettings.set('review.metrics', ms.filter(m => c.querySelector(`[data-on="${m.id}"]`).checked).map(m => m.id));
        }).then(() => { close(); App.ui.toast('Targets saved'); onSaved?.(); });
      });
    };
    App.ui.modal('<div></div>', (c, close) => { c.classList.add('rv-modal'); draw(c, close); });
  }

  /* ---------- Page ---------- */
  App.modules.review = {
    METRICS, target,
    async render(view) {
      week = week || defaultWeek();
      const units = App.biz.inView();
      const [f, t] = P().bounds('week', week);
      view.innerHTML = `<div class="card rv-bar">
          <div class="row"><button class="btn small" id="rvPrev" aria-label="Previous week">‹</button>
            <div><div class="muted tiny">Week under review</div><b>${esc(P().labelOf('week', f, t))}</b></div>
            <button class="btn small" id="rvNext" aria-label="Next week" ${shiftWeek(week, 1) > P().today() ? 'disabled' : ''}>›</button></div>
          <div class="row"><button class="btn" id="rvTargets">${App.fx.icon('target')} Set targets</button>
            <button class="btn primary" id="rvPrint">${App.fx.icon('printer')} Print review sheet</button></div>
        </div><div id="rvOut">${App.fx.skeleton ? App.fx.skeleton(3) : ''}</div>`;
      App.fx.hydrateIcons?.(view);
      const rerender = () => App.go('review');
      view.querySelector('#rvPrev').onclick = () => { week = shiftWeek(week, -1); rerender(); };
      view.querySelector('#rvNext').onclick = () => { week = shiftWeek(week, 1); rerender(); };
      const out = view.querySelector('#rvOut');
      if (!units.length) { out.innerHTML = App.ui.empty('Add a unit first (Tools → Units).'); return; }
      const reports = [];
      for (const b of units) reports.push(await unitReport(b, f));
      if (!out.isConnected) return;
      out.innerHTML = `<div class="stack">${reports.map(R => unitCard(R, units.length > 1)).join('')}</div>`;
      view.querySelector('#rvPrint').onclick = () => print(reports);
      const shownNow = Object.fromEntries(reports.map(R => [R.b.id, R.rows.map(r => r.m.id)]));
      view.querySelector('#rvTargets').onclick = () => editTargets(App.biz.isMaster() ? null : App.biz.current(), rerender, shownNow);
      out.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editTargets(b.dataset.edit, rerender, shownNow));
      out.querySelectorAll('[data-notes]').forEach(ta => ta.oninput = () => {
        const R = reports.find(r => r.b.id === ta.dataset.notes); R.notes = ta.value;
        App.biz.withBiz(R.b.id, async () => App.bsettings.set(`review.notes.${f}`, ta.value));
      });
    }
  };
})(window.App);
