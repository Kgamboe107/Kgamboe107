/* Drill-down: click any KPI box to open a side panel with the records behind it.
   Each drill computes from the underlying data itself, so it works from module pages and dashboards alike. */
(function (App) {
  const { esc, fmt, n0 } = App;

  /* ---------- Data finders (use the user's saved column mapping, else auto-detect) ---------- */
  async function find(key, categories, fields) {
    const r = await App.ui.resolve(key, { categories, fields, includeLive: key === 'purchases' });
    if (!r.ds) return null;
    const ok = fields.filter(f => f.req).every(f => r.map[f.k]);
    return ok ? { ds: r.ds, m: r.map } : null;
  }

  async function roster() {
    const r = await find('personnel', ['personnel'], [
      { k: 'name', syn: ['employee name', 'employee', 'full name', 'name', 'team member'], req: true },
      { k: 'id', syn: ['employee id', 'emp id', 'employee number', 'badge'] },
      { k: 'title', syn: ['position', 'job title', 'title', 'role', 'job'] }, { k: 'dept', syn: ['department', 'dept', 'team', 'division'] },
      { k: 'loc', syn: ['location', 'store', 'site'] }, { k: 'hire', syn: ['hire date', 'start date', 'date hired'], req: true },
      { k: 'term', syn: ['termination date', 'term date', 'end date', 'separation date'] }, { k: 'status', syn: ['status', 'employment status'] },
      { k: 'type', syn: ['employment type', 'ft/pt', 'full/part time'] }, { k: 'pay', syn: ['pay rate', 'hourly rate', 'rate', 'salary', 'wage'] },
      { k: 'email', syn: ['email', 'e-mail', 'email address'] }, { k: 'phone', syn: ['phone', 'mobile', 'cell'] }, { k: 'mgr', syn: ['manager', 'supervisor', 'reports to'] }
    ]);
    if (!r) return null;
    const { ds, m } = r, now = new Date();
    return { source: ds.name, people: ds.rows.map(row => {
      const term = m.term ? App.toDate(row[m.term]) : null, st = m.status ? String(row[m.status] || '') : '';
      const hire = m.hire ? App.toDate(row[m.hire]) : null;
      const active = term ? false : (st ? !/term|inactive|separated|quit|former/i.test(st) : true);
      return { name: String(row[m.name] || '').trim(), id: m.id ? String(row[m.id] || '') : '', title: row[m.title] || '', dept: row[m.dept] || row[m.loc] || '', loc: row[m.loc] || '',
        hire, term, active, status: st || (active ? 'Active' : 'Terminated'), type: row[m.type] || '', pay: m.pay ? n0(row[m.pay]) : NaN,
        email: row[m.email] || '', phone: row[m.phone] || '', mgr: row[m.mgr] || '', tenure: hire ? ((term || now) - hire) / (365.25 * 864e5) : NaN };
    }).filter(p => p.name) };
  }

  async function labor() {
    const r = await find('ops-labor', ['operations', 'personnel'], [
      { k: 'hours', syn: ['total hours', 'actual hours', 'hours', 'regular hours', 'hours worked'], req: true },
      { k: 'date', syn: ['date', 'business date', 'shift date', 'clock in', 'day', 'week'], req: true },
      { k: 'emp', syn: ['employee', 'employee name', 'name', 'team member'] }, { k: 'id', syn: ['employee id', 'emp id', 'badge'] },
      { k: 'pos', syn: ['position', 'job', 'role', 'job title'] }, { k: 'loc', syn: ['location', 'store', 'site', 'unit'] },
      { k: 'ot', syn: ['overtime hours', 'overtime', 'ot hours'] }, { k: 'sched', syn: ['scheduled hours', 'scheduled'] },
      { k: 'cost', syn: ['labor cost', 'total pay', 'gross pay', 'wages', 'cost'] }, { k: 'rate', syn: ['pay rate', 'rate', 'hourly rate'] }
    ]);
    if (!r) return null;
    const { ds, m } = r;
    return { source: ds.name, rows: ds.rows.map(row => {
      const hours = n0(row[m.hours]), ot = m.ot ? n0(row[m.ot]) : 0;
      const cost = m.cost ? n0(row[m.cost]) : (m.rate ? n0(row[m.rate]) * (hours + 0.5 * ot) : 0);
      return { date: App.dateKey(row[m.date]), emp: m.emp ? String(row[m.emp] || '') : '', id: m.id ? String(row[m.id] || '') : '', pos: row[m.pos] || '', loc: row[m.loc] || '', hours, ot, sched: m.sched ? n0(row[m.sched]) : NaN, cost, rate: m.rate ? n0(row[m.rate]) : NaN };
    }) };
  }

  async function sales() {
    const r = await find('ops-sales', ['operations', 'financial'], [
      { k: 'sales', syn: ['net sales', 'sales', 'revenue', 'gross sales'], req: true }, { k: 'date', syn: ['date', 'business date', 'day', 'week', 'period'], req: true },
      { k: 'loc', syn: ['location', 'store', 'site'] }, { k: 'guests', syn: ['guests', 'guest count', 'covers', 'transactions', 'checks'] },
      { k: 'cogs', syn: ['food cost', 'cogs', 'actual cost', 'cost of sales'] }
    ]);
    if (!r) return null;
    const { ds, m } = r;
    return { source: ds.name, rows: ds.rows.map(row => ({ date: App.dateKey(row[m.date]), loc: row[m.loc] || '', sales: n0(row[m.sales]), guests: m.guests ? n0(row[m.guests]) : NaN, cogs: m.cogs ? n0(row[m.cogs]) : NaN })) };
  }

  const keyOf = p => (p.id ? 'id:' + p.id : 'n:' + App.purchasing.norm(p.name || p.emp));
  const sumBy = (rows, kf, vf) => { const g = new Map(); rows.forEach(r => { const k = kf(r); g.set(k, (g.get(k) || 0) + vf(r)); }); return g; };

  /* ---------- Panel ---------- */
  const stack = [];
  function ensure() {
    let el = document.getElementById('drill');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'drill'; el.className = 'drill';
    el.innerHTML = `<div class="drill-scrim"></div><aside class="drill-panel" role="dialog" aria-modal="true"><div id="drillBody"></div></aside>`;
    document.body.appendChild(el);
    el.querySelector('.drill-scrim').onclick = close;
    return el;
  }
  function close() { const el = document.getElementById('drill'); if (!el) return; el.classList.remove('open'); stack.length = 0; setTimeout(() => { if (!el.classList.contains('open')) el.hidden = true; }, 250); }
  async function open(id, arg, push = false) {
    const def = DRILLS[id]; if (!def) return false;
    const el = ensure();
    if (!push) stack.length = 0;
    stack.push([id, arg]);
    el.hidden = false; requestAnimationFrame(() => el.classList.add('open'));
    const body = el.querySelector('#drillBody');
    body.innerHTML = `<div class="drill-head"><div class="skel" style="height:22px;width:60%"></div></div><div class="drill-content">${'<div class="skel" style="height:70px"></div>'.repeat(3)}</div>`;
    let r;
    try { r = await def(arg); } catch (e) { console.error(e); r = { title: 'Details', sections: [{ html: `<div class="alert bad">Couldn't load details: ${esc(e.message)}</div>` }] }; }
    if (!r) r = { title: 'No details yet', sections: [{ html: `<div class="muted">There's no underlying data for this number yet. Add or upload data and it will show here.</div>` }] };
    render(body, r);
    return true;
  }
  function back() { stack.pop(); const [id, arg] = stack.pop() || []; if (id) open(id, arg, true); else close(); }

  function render(body, r) {
    body.innerHTML = `
      <div class="drill-head">
        <div class="row" style="gap:8px;flex-wrap:nowrap;min-width:0">
          ${stack.length > 1 ? `<button class="btn ghost small icon-btn" id="drBack" title="Back">←</button>` : ''}
          <div style="min-width:0"><h2>${esc(r.title)}</h2>${r.subtitle ? `<div class="muted small">${r.subtitle}</div>` : ''}</div>
        </div>
        <button class="btn ghost small icon-btn" id="drClose" title="Close (Esc)">✕</button>
      </div>
      <div class="drill-content">
        ${r.stats?.length ? `<div class="drill-stats">${r.stats.map(([l, v, t]) => `<div class="${t || ''}"><div class="l">${esc(l)}</div><div class="v">${v}</div></div>`).join('')}</div>` : ''}
        ${(r.sections || []).map((s, i) => `<section class="drill-sec">${s.title ? `<div class="row spread"><h3>${esc(s.title)}</h3>${s.table ? `<button class="btn ghost small" data-csv="${i}">CSV</button>` : ''}</div>` : ''}${s.html || ''}${s.bars ? bars(s.bars) : ''}${s.table ? `<div data-tbl="${i}"></div>` : ''}</section>`).join('')}
      </div>
      ${r.actions?.length ? `<div class="drill-foot">${r.actions.map((a, i) => `<button class="btn ${i === 0 ? 'primary' : ''} small" data-act="${i}">${esc(a[0])}</button>`).join('')}</div>` : ''}`;
    body.querySelector('#drClose').onclick = close;
    body.querySelector('#drBack')?.addEventListener('click', back);
    (r.sections || []).forEach((s, i) => {
      if (!s.table) return;
      App.ui.table(body.querySelector(`[data-tbl="${i}"]`), s.table.cols, s.table.rows, { limit: s.table.limit || 300, sortKey: s.table.sortKey });
      body.querySelector(`[data-csv="${i}"]`)?.addEventListener('click', () => App.download((s.title || 'details').replace(/[^\w\- ]/g, '') + '.csv', App.toCSV(s.table.cols.map(c => c.key), s.table.rows.map(row => Object.fromEntries(s.table.cols.map(c => [c.key, row[c.key] instanceof Date ? row[c.key].toISOString().slice(0, 10) : row[c.key]]))))));
    });
    (r.actions || []).forEach((a, i) => body.querySelector(`[data-act="${i}"]`).onclick = () => { close(); a[1](); });
    body.querySelectorAll('[data-drill]').forEach(x => x.onclick = e => { e.preventDefault(); e.stopPropagation(); open(x.dataset.drill, x.dataset.arg, true); });
    body.scrollTop = 0;
  }

  function bars(list) {
    const max = Math.max(1, ...list.map(b => Math.abs(b.v)));
    return `<div class="drill-bars">${list.map(b => `<div class="db-row"${b.drill ? ` data-drill="${b.drill}" data-arg="${esc(b.arg || '')}" style="cursor:pointer"` : ''}><span class="db-l">${esc(b.label)}</span><span class="db-track"><i style="width:${Math.max(2, Math.abs(b.v) / max * 100)}%;${b.color ? 'background:' + b.color : ''}"></i></span><span class="db-v">${b.text}</span></div>`).join('')}</div>`;
  }
  const link = (drill, arg, text) => `<a data-drill="${drill}" data-arg="${esc(arg)}">${esc(text)}</a>`;
  const money = v => fmt.money(v, 2);
  const page = (route, params) => () => App.go(route, params || {});

  /* ---------- Drill definitions ---------- */
  const DRILLS = {
    /* Who's on the team and what they cost */
    async headcount() {
      const [R, Lb] = await Promise.all([roster(), labor()]);
      if (!R && !Lb) return null;
      const lab = Lb?.rows || [];
      const byEmp = new Map();
      lab.forEach(r => { const k = keyOf(r); const a = byEmp.get(k) || { hours: 0, ot: 0, cost: 0, shifts: 0, last: '', locs: new Set(), pos: r.pos }; a.hours += r.hours; a.ot += r.ot; a.cost += r.cost; a.shifts++; if (r.date > a.last) a.last = r.date; if (r.loc) a.locs.add(r.loc); byEmp.set(k, a); });
      let people = R ? R.people.filter(p => p.active) : [...new Set(lab.map(r => r.emp))].filter(Boolean).map(n => ({ name: n, active: true }));
      // match roster ↔ timesheet by ID, falling back to name
      const nameCount = sumBy(people, p => App.purchasing.norm(p.name), () => 1);
      const rows = people.map(p => { const w = byEmp.get(keyOf(p)) || byEmp.get('n:' + App.purchasing.norm(p.name)) || {}; return { ...p, display: nameCount.get(App.purchasing.norm(p.name)) > 1 && p.id ? `${p.name} (#${p.id})` : p.name, title: p.title || w.pos || '', hours: w.hours || 0, ot: w.ot || 0, cost: w.cost || 0, shifts: w.shifts || 0, last: w.last || '', locs: w.locs ? [...w.locs].join(', ') : p.loc, perHr: w.hours ? w.cost / w.hours : NaN }; });
      const totalCost = App.sum(rows.map(r => r.cost)), totalHours = App.sum(rows.map(r => r.hours));
      const dates = [...new Set(lab.map(r => r.date))].sort();
      const latest = dates[dates.length - 1], first = dates[0];
      const dupName = n => (nameCount.get(App.purchasing.norm(n)) || 0) > 1;
      const today = lab.filter(r => r.date === latest).map(r => ({ ...r, display: dupName(r.emp) && r.id ? `${r.emp} (#${r.id})` : r.emp }));
      const worked = rows.filter(r => r.hours > 0).length;
      const byDept = sumBy(rows, r => r.dept || r.title || 'Unassigned', r => r.cost);
      const cntDept = sumBy(rows, r => r.dept || r.title || 'Unassigned', () => 1);
      const employerTax = totalCost * 0.0765;
      return {
        title: 'Team & labor spend', subtitle: `${R ? esc(R.source) : ''}${Lb ? (R ? ' + ' : '') + esc(Lb.source) + ` · ${first} → ${latest}` : ''}`,
        stats: [['Active employees', fmt.num(rows.length)], ['Worked in period', fmt.num(worked)], ['Hours', fmt.num(totalHours, 1)], ['Labor cost', fmt.money(totalCost)], ['Avg per employee', fmt.money(worked ? totalCost / worked : NaN)], ['Est. employer FICA', fmt.money(employerTax), 'muted']],
        sections: [
          latest ? { title: `Working on ${new Date(latest + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} (latest day)`, table: { cols: [
            { key: 'emp', label: 'Employee', fmt: (v, r) => link('employee', r.id ? 'id:' + r.id : 'n:' + v, r.display || v) }, { key: 'pos', label: 'Position' }, { key: 'loc', label: 'Location' },
            { key: 'hours', label: 'Hours', num: true, fmt: v => fmt.num(v, 1) }, { key: 'cost', label: 'Cost', num: true, fmt: v => money(v) }
          ], rows: today, sortKey: 'cost' }, html: `<div class="muted tiny" style="margin-bottom:6px">${today.length} people · ${fmt.num(App.sum(today.map(r => r.hours)), 1)} hours · ${money(App.sum(today.map(r => r.cost)))}</div>` } : null,
          { title: 'Spend by department / role', bars: [...byDept.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: `${k} (${cntDept.get(k)})`, v, text: fmt.money(v) })) },
          { title: 'Everyone', table: { cols: [
            { key: 'name', label: 'Employee', fmt: (v, r) => link('employee', r.id ? 'id:' + r.id : 'n:' + v, r.display || v) }, { key: 'title', label: 'Position' }, { key: 'locs', label: 'Location' },
            { key: 'shifts', label: 'Shifts', num: true }, { key: 'hours', label: 'Hours', num: true, fmt: v => fmt.num(v, 1) }, { key: 'ot', label: 'OT', num: true, fmt: v => v ? fmt.num(v, 1) : '—' },
            { key: 'cost', label: 'Cost', num: true, fmt: v => money(v) }, { key: 'perHr', label: '$/hr', num: true, fmt: v => fmt.money(v, 2) }, { key: 'last', label: 'Last shift' }
          ], rows, sortKey: 'cost' } }
        ].filter(Boolean),
        actions: [['Open Personnel', page('personnel')], ['Open Operations', page('operations')], ['Payroll taxes', page('compliance', { tab: 'payroll' })]]
      };
    },

    /* One employee: profile, shifts, cost, documents, signatures */
    async employee(arg) {
      const [R, Lb] = await Promise.all([roster(), labor()]);
      const [kind, val] = String(arg).split(/:(.*)/s);
      const match = x => kind === 'id' ? String(x.id) === val : App.purchasing.norm(x.name || x.emp) === App.purchasing.norm(val);
      const p = R?.people.find(match) || { name: kind === 'n' ? val : '', id: kind === 'id' ? val : '' };
      const shifts = (Lb?.rows || []).filter(r => kind === 'id' && r.id ? r.id === val : App.purchasing.norm(r.emp) === App.purchasing.norm(p.name || val)).sort((a, b) => b.date.localeCompare(a.date));
      if (!p.name && shifts[0]) p.name = shifts[0].emp;
      const files = (await App.store.files()).filter(f => (f.tags || []).some(t => App.purchasing.norm(t) === App.purchasing.norm(p.name)));
      const signed = App.bsettings.get('legal.signed', []).filter(s => App.purchasing.norm(s.person) === App.purchasing.norm(p.name));
      const cost = App.sum(shifts.map(s => s.cost)), hours = App.sum(shifts.map(s => s.hours)), ot = App.sum(shifts.map(s => s.ot));
      const has = re => files.some(f => re.test(f.name));
      return {
        title: p.name || 'Employee', subtitle: [p.title, p.dept, p.loc].filter(Boolean).map(esc).join(' · ') + (p.id ? ` · ID ${esc(p.id)}` : ''),
        stats: [['Shifts', fmt.num(shifts.length)], ['Hours', fmt.num(hours, 1)], ['Overtime', fmt.num(ot, 1)], ['Labor cost', money(cost)], ['Pay rate', isNaN(p.pay) ? '—' : money(p.pay)], ['Tenure', isNaN(p.tenure) ? '—' : p.tenure.toFixed(1) + ' yrs']],
        sections: [
          { title: 'Profile', html: `<div class="drill-kv">${[['Status', p.status], ['Type', p.type], ['Hired', p.hire ? p.hire.toLocaleDateString() : ''], ['Ended', p.term ? p.term.toLocaleDateString() : ''], ['Manager', p.mgr], ['Email', p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''], ['Phone', p.phone ? esc(p.phone) : '']].filter(([, v]) => v).map(([k, v]) => `<div><span>${k}</span><b>${/^</.test(v) ? v : esc(v)}</b></div>`).join('') || '<span class="muted small">No roster record found.</span>'}</div>` },
          { title: 'Paperwork', html: `<div class="row">${[['I-9', /i-?9/i], ['W-4', /w-?4/i]].map(([l, re]) => `<span class="badge ${has(re) ? 'good' : 'warn'}">${l} ${has(re) ? '✓' : 'missing'}</span>`).join(' ')}${signed.map(s => `<span class="badge good">${esc(App.legal?.DOCS.find(d => d.id === s.doc)?.title.split(' (')[0] || s.doc)} ✓</span>`).join(' ')}</div>
            ${files.length ? `<div class="stack small" style="margin-top:8px">${files.map(f => `<div class="row spread"><span>📎 ${esc(f.name)}</span><span class="muted tiny">${new Date(f.uploadedAt).toLocaleDateString()}</span></div>`).join('')}</div>` : '<div class="muted small" style="margin-top:6px">No files attached. Open Personnel to attach their I-9, W-4, reviews and certifications.</div>'}` },
          shifts.length ? { title: 'Shifts', table: { cols: [{ key: 'date', label: 'Date' }, { key: 'loc', label: 'Location' }, { key: 'pos', label: 'Position' }, { key: 'hours', label: 'Hours', num: true, fmt: v => fmt.num(v, 2) }, { key: 'ot', label: 'OT', num: true, fmt: v => v ? fmt.num(v, 2) : '—' }, { key: 'cost', label: 'Cost', num: true, fmt: v => money(v) }], rows: shifts } } : { html: '<div class="muted small">No shifts in the timesheet data.</div>' }
        ],
        actions: [['Open Personnel', page('personnel')], ...(p.email ? [['Email ' + p.name.split(' ')[0], () => { location.href = 'mailto:' + p.email; }]] : [])]
      };
    },

    async turnover() {
      const R = await roster(); if (!R) return null;
      const gone = R.people.filter(p => !p.active).sort((a, b) => (b.term || 0) - (a.term || 0));
      const early = gone.filter(p => p.hire && p.term && (p.term - p.hire) < 90 * 864e5);
      return { title: 'Former employees', subtitle: esc(R.source), stats: [['Left', fmt.num(gone.length)], ['Left within 90 days', fmt.num(early.length), early.length ? 'warn' : ''], ['Active', fmt.num(R.people.length - gone.length)]],
        sections: [{ title: 'Who left', table: { cols: [{ key: 'name', label: 'Name', fmt: (v, r) => link('employee', r.id ? 'id:' + r.id : 'n:' + v, v) }, { key: 'title', label: 'Position' }, { key: 'dept', label: 'Dept' }, { key: 'hire', label: 'Hired', fmt: v => v ? v.toLocaleDateString() : '—' }, { key: 'term', label: 'Left', fmt: v => v ? v.toLocaleDateString() : '—' }, { key: 'tenure', label: 'Tenure', num: true, fmt: v => isNaN(v) ? '—' : (v < 1 ? Math.round(v * 12) + ' mo' : v.toFixed(1) + ' yrs') }], rows: gone } }],
        actions: [['Open Personnel', page('personnel')]] };
    },

    async tenure() {
      const R = await roster(); if (!R) return null;
      const act = R.people.filter(p => p.active && !isNaN(p.tenure)).sort((a, b) => b.tenure - a.tenure);
      const B = [['< 90 days', 0, .25], ['3–12 months', .25, 1], ['1–2 years', 1, 2], ['2–5 years', 2, 5], ['5+ years', 5, 99]];
      return { title: 'Tenure', subtitle: esc(R.source), stats: [['Average', App.mean(act.map(p => p.tenure)).toFixed(1) + ' yrs'], ['Longest', act[0] ? act[0].tenure.toFixed(1) + ' yrs' : '—'], ['New (< 90 days)', fmt.num(act.filter(p => p.tenure < .25).length)]],
        sections: [{ title: 'Distribution', bars: B.map(([l, a, b]) => { const n = act.filter(p => p.tenure >= a && p.tenure < b).length; return { label: l, v: n, text: n }; }) },
          { title: 'Longest-serving first', table: { cols: [{ key: 'name', label: 'Name', fmt: (v, r) => link('employee', r.id ? 'id:' + r.id : 'n:' + v, v) }, { key: 'title', label: 'Position' }, { key: 'hire', label: 'Hired', fmt: v => v ? v.toLocaleDateString() : '—' }, { key: 'tenure', label: 'Years', num: true, fmt: v => v.toFixed(1) }], rows: act } }],
        actions: [['Open Personnel', page('personnel')]] };
    },

    async pay() {
      const R = await roster(); if (!R) return null;
      const act = R.people.filter(p => p.active && p.pay > 0).sort((a, b) => b.pay - a.pay);
      const byTitle = new Map(); act.forEach(p => { const k = p.title || 'Unassigned'; const a = byTitle.get(k) || []; a.push(p.pay); byTitle.set(k, a); });
      return { title: 'Pay rates', subtitle: esc(R.source), stats: [['Median', money(App.quantile(act.map(p => p.pay), .5))], ['Lowest', money(act[act.length - 1]?.pay)], ['Highest', money(act[0]?.pay)]],
        sections: [{ title: 'Average by position', bars: [...byTitle.entries()].map(([k, a]) => ({ label: `${k} (${a.length})`, v: App.mean(a), text: money(App.mean(a)) })).sort((a, b) => b.v - a.v) },
          { title: 'Everyone', table: { cols: [{ key: 'name', label: 'Name', fmt: (v, r) => link('employee', r.id ? 'id:' + r.id : 'n:' + v, v) }, { key: 'title', label: 'Position' }, { key: 'type', label: 'Type' }, { key: 'pay', label: 'Rate', num: true, fmt: v => money(v) }], rows: act, sortKey: 'pay' } }],
        actions: [['Open Personnel', page('personnel')]] };
    },

    /* Labor: by day, position, employee */
    async labor(focus) {
      const [Lb, S] = await Promise.all([labor(), sales()]); if (!Lb) return null;
      const t = App.bsettings.get('ops.targets', { labor: .28, splh: 55 });
      const days = new Map();
      Lb.rows.forEach(r => { const d = days.get(r.date) || { date: r.date, hours: 0, cost: 0, ot: 0, people: new Set(), sales: 0 }; d.hours += r.hours; d.cost += r.cost; d.ot += r.ot; d.people.add(r.id || r.emp); days.set(r.date, d); });
      (S?.rows || []).forEach(r => { const d = days.get(r.date); if (d) d.sales += r.sales; });
      const dayRows = [...days.values()].map(d => ({ ...d, people: d.people.size, pct: d.sales ? d.cost / d.sales : NaN, splh: d.hours ? d.sales / d.hours : NaN })).sort((a, b) => b.date.localeCompare(a.date));
      const pos = sumBy(Lb.rows, r => r.pos || 'Unassigned', r => focus === 'hours' ? r.hours : r.cost);
      const emp = new Map(); Lb.rows.forEach(r => { const k = r.id || r.emp; const a = emp.get(k) || { name: r.emp, id: r.id, hours: 0, cost: 0, ot: 0 }; a.hours += r.hours; a.cost += r.cost; a.ot += r.ot; emp.set(k, a); });
      const cost = App.sum(Lb.rows.map(r => r.cost)), hours = App.sum(Lb.rows.map(r => r.hours)), sl = App.sum(dayRows.map(d => d.sales));
      return { title: focus === 'hours' ? 'Labor hours' : focus === 'pct' ? 'Labor % of sales' : 'Labor cost', subtitle: esc(Lb.source) + (S ? ' + ' + esc(S.source) : ''),
        stats: [['Labor cost', fmt.money(cost)], ['Hours', fmt.num(hours, 1)], ['Overtime hrs', fmt.num(App.sum(Lb.rows.map(r => r.ot)), 1)], ['Labor %', fmt.pct(sl ? cost / sl : NaN), sl && cost / sl > t.labor ? 'bad' : 'good'], ['Sales / labor hr', fmt.money(hours ? sl / hours : NaN, 2)]],
        sections: [
          { title: 'By day', table: { cols: [{ key: 'date', label: 'Date' }, { key: 'people', label: 'Staff', num: true }, { key: 'hours', label: 'Hours', num: true, fmt: v => fmt.num(v, 1) }, { key: 'cost', label: 'Cost', num: true, fmt: v => fmt.money(v) }, { key: 'sales', label: 'Sales', num: true, fmt: v => v ? fmt.money(v) : '—' }, { key: 'pct', label: 'Labor %', num: true, fmt: v => isNaN(v) ? '—' : `<span style="color:var(${v > t.labor ? '--bad' : '--good'})">${fmt.pct(v)}</span>` }], rows: dayRows } },
          { title: focus === 'hours' ? 'Hours by position' : 'Cost by position', bars: [...pos.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, v, text: focus === 'hours' ? fmt.num(v, 1) + ' h' : fmt.money(v) })) },
          { title: 'Top employees by cost', bars: [...emp.values()].sort((a, b) => b.cost - a.cost).slice(0, 15).map(e => ({ label: e.name, v: e.cost, text: fmt.money(e.cost), drill: 'employee', arg: e.id ? 'id:' + e.id : 'n:' + e.name })) }
        ], actions: [['Open Operations', page('operations')], ['Whole team', () => open('headcount')]] };
    },

    async sales() {
      const S = await sales(); if (!S) return null;
      const days = sumBy(S.rows, r => r.date, r => r.sales);
      const locs = sumBy(S.rows, r => r.loc || 'All', r => r.sales);
      const total = App.sum(S.rows.map(r => r.sales)), guests = App.sum(S.rows.map(r => r.guests).filter(x => !isNaN(x)));
      const dayRows = [...days.entries()].map(([date, v]) => ({ date, sales: v, dow: new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }) })).sort((a, b) => b.date.localeCompare(a.date));
      const dow = sumBy(dayRows, r => r.dow, r => r.sales), dowN = sumBy(dayRows, r => r.dow, () => 1);
      return { title: 'Sales', subtitle: esc(S.source), stats: [['Total', fmt.money(total)], ['Days', fmt.num(days.size)], ['Avg / day', fmt.money(total / Math.max(1, days.size))], ['Guests', guests ? fmt.num(guests) : '—'], ['Avg check', guests ? fmt.money(total / guests, 2) : '—']],
        sections: [{ title: 'By location', bars: [...locs.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, v, text: fmt.money(v) })) },
          { title: 'Average by weekday', bars: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter(d => dow.has(d)).map(d => ({ label: d, v: dow.get(d) / dowN.get(d), text: fmt.money(dow.get(d) / dowN.get(d)) })) },
          { title: 'By day', table: { cols: [{ key: 'date', label: 'Date' }, { key: 'dow', label: 'Day' }, { key: 'sales', label: 'Sales', num: true, fmt: v => fmt.money(v) }], rows: dayRows } }],
        actions: [['Open Operations', page('operations')]] };
    },

    /* Purchases: receipts / food lines / personal / owed */
    async purchases(focus) {
      const ps = (await App.store.all('purchases')).sort((a, b) => b.date.localeCompare(a.date));
      if (!ps.length) return null;
      const P = App.purchasing;
      const lines = ps.flatMap(p => p.lines.map(l => ({ ...l, date: p.date, vendor: p.vendor, pid: p.id, payment: p.payment, group: P.CAT[l.cat]?.group || 'other', catLabel: P.CAT[l.cat]?.label || 'Other', unit: l.qty ? l.amount / l.qty : l.amount })));
      const owedIds = new Set(ps.filter(p => p.reimburse).map(p => p.id));
      const sel = focus === 'owed' ? lines.filter(l => owedIds.has(l.pid) && l.group !== 'excluded') : focus === 'food' ? lines.filter(l => l.group === 'food') : focus === 'personal' ? lines.filter(l => l.group === 'excluded') : focus === 'bev' ? lines.filter(l => ['beverage', 'alcohol'].includes(l.group)) : focus === 'supplies' ? lines.filter(l => ['supplies', 'other'].includes(l.group)) : lines.filter(l => l.group !== 'excluded');
      const recs = focus === 'owed' ? ps.filter(p => p.reimburse) : ps;
      const byCat = sumBy(sel, l => l.catLabel, l => l.amount), byItem = new Map();
      sel.forEach(l => { const k = P.norm(l.item) || l.catLabel; const a = byItem.get(k) || { item: l.item || l.catLabel, amount: 0, qty: 0, buys: 0, last: '' }; a.amount += l.amount; a.qty += +l.qty || 0; a.buys++; if (l.date > a.last) a.last = l.date; byItem.set(k, a); });
      const titles = { food: 'Food purchases', personal: 'Personal items on receipts', owed: 'Owed to you', bev: 'Beverage & alcohol', supplies: 'Supplies & paper' };
      const recRows = recs.map(p => { const t = P.totals(p); return { id: p.id, date: p.date, vendor: p.vendor, business: t.business, food: t.food, personal: t.groups.excluded || 0, total: p.total || t.computed, payment: p.payment }; });
      return { title: titles[focus] || 'Business purchases', subtitle: `${recs.length} receipts`,
        stats: [['Total', money(App.sum(sel.map(l => l.amount)))], ['Lines', fmt.num(sel.length)], ['Items', fmt.num(byItem.size)], ['Vendors', fmt.num(new Set(sel.map(l => l.vendor)).size)]],
        sections: [
          focus === 'owed' ? null : { title: 'By category', bars: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, v, text: money(v) })) },
          focus === 'owed' ? null : { title: 'Top items', table: { cols: [{ key: 'item', label: 'Item' }, { key: 'buys', label: 'Times', num: true }, { key: 'qty', label: 'Qty', num: true, fmt: v => fmt.num(v, 1) }, { key: 'amount', label: 'Spent', num: true, fmt: v => money(v) }, { key: 'last', label: 'Last bought' }], rows: [...byItem.values()], sortKey: 'amount', limit: 100 } },
          { title: 'Receipts', table: { cols: [{ key: 'date', label: 'Date', fmt: (v, r) => link('receipt', r.id, v) }, { key: 'vendor', label: 'Vendor' }, { key: focus === 'personal' ? 'personal' : focus === 'food' ? 'food' : 'business', label: focus === 'personal' ? 'Personal' : focus === 'food' ? 'Food' : 'Business', num: true, fmt: v => money(v) }, { key: 'total', label: 'Total', num: true, fmt: v => money(v) }, { key: 'payment', label: 'Paid with' }], rows: focus === 'personal' ? recRows.filter(r => r.personal) : recRows } }
        ].filter(Boolean),
        actions: [['Open Purchases', page('purchases')]] };
    },

    async receipt(id) {
      const p = await App.store.get('purchases', id); if (!p) return null;
      const t = App.purchasing.totals(p);
      return { title: `${p.vendor} · ${p.date}`, subtitle: `${esc(p.payment || '')}${p.ref ? ' · #' + esc(p.ref) : ''}${p.reimburse ? ' · <span class="badge warn">owed to you</span>' : ''}`,
        stats: [['Business', money(t.business)], ['Food', money(t.food)], ['Tax', money(t.tax)], ['Total', money(p.total || t.computed)], ...(t.groups.excluded ? [['Personal', money(t.groups.excluded), 'warn']] : [])],
        sections: [{ title: 'Lines', table: { cols: [{ key: 'item', label: 'Item' }, { key: 'cat', label: 'Category', fmt: v => esc(App.purchasing.CAT[v]?.label || v) }, { key: 'qty', label: 'Qty', num: true }, { key: 'amount', label: 'Amount', num: true, fmt: v => money(v) }], rows: p.lines } },
          p.attachment ? { html: `<button class="btn small" id="drAtt">📎 View receipt photo</button>` } : { html: '<div class="muted small">No photo attached.</div>' }, p.notes ? { title: 'Notes', html: esc(p.notes) } : null].filter(Boolean),
        actions: [['Edit receipt', async () => { await App.go('purchases'); App.purchasesEditor(await App.store.get('purchases', id)); }]],
        after: () => document.getElementById('drAtt')?.addEventListener('click', () => window.open(URL.createObjectURL(p.attachment.blob), '_blank')) };
    },

    async foodcost() {
      const ps = await App.store.all('purchases'); const S = await sales();
      if (!ps.length) return null;
      const days = S ? S.rows.map(r => r.date).filter(Boolean).sort() : [];
      const cov = days.length ? [days[0], days[days.length - 1]] : null;
      const food = ps.filter(p => !cov || (p.date >= cov[0] && p.date <= cov[1])).flatMap(p => p.lines.filter(l => App.purchasing.CAT[l.cat]?.group === 'food').map(l => ({ ...l, date: p.date, vendor: p.vendor })));
      const total = App.sum(food.map(l => l.amount)), sl = S ? App.sum(S.rows.map(r => r.sales)) : NaN;
      const byCat = sumBy(food, l => App.purchasing.CAT[l.cat]?.label, l => l.amount), byVendor = sumBy(food, l => l.vendor, l => l.amount);
      return { title: 'Food cost', subtitle: (cov ? `Purchases and sales ${fmt.date(cov[0])} – ${fmt.date(cov[1])}` : 'All-time purchases vs. sales') + (S ? ' · ' + esc(S.source) : ''),
        stats: [['Food purchases', fmt.money(total)], ['Sales', fmt.money(sl)], ['Food cost %', fmt.pct(sl ? total / sl : NaN)]],
        sections: [{ title: 'By category (share of sales)', bars: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, v, text: `${fmt.money(v)} · ${fmt.pct(sl ? v / sl : NaN)}` })) },
          { title: 'By vendor', bars: [...byVendor.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, v, text: fmt.money(v) })) },
          { title: 'Price increases', html: App.purchasing.priceChanges(ps).filter(c => c.change > 0).slice(0, 8).map(c => `<div class="row spread small"><span>${esc(c.item)}</span><span class="badge bad">▲ ${fmt.pct(c.change)} · ${money(c.from)} → ${money(c.to)}</span></div>`).join('') || '<span class="muted small">None</span>' }],
        actions: [['Open Purchases', page('purchases')], ['Food purchases detail', () => open('purchases', 'food')]] };
    },

    /* Finance periods */
    async finance(focus) {
      const r = await find('finance', ['financial'], [{ k: 'period', syn: ['period', 'month', 'date', 'week', 'quarter', 'year'], req: true }, { k: 'revenue', syn: ['revenue', 'total revenue', 'net sales', 'sales', 'income', 'gross sales'], req: true }, { k: 'cogs', syn: ['cogs', 'cost of goods sold', 'cost of sales', 'food cost'] }, { k: 'labor', syn: ['labor', 'payroll', 'wages', 'labor cost'] }, { k: 'opex', syn: ['operating expenses', 'opex', 'expenses', 'total expenses'] }, { k: 'other', syn: ['other expenses', 'other', 'interest', 'depreciation'] }]);
      if (!r) return null;
      const { ds, m } = r;
      const rows = ds.rows.map(x => { const rev = Math.abs(n0(x[m.revenue])), c = ['cogs', 'labor', 'opex', 'other'].reduce((s, k) => s + (m[k] ? Math.abs(n0(x[m[k]])) : 0), 0); return { period: App.periodKey(x[m.period]), revenue: rev, cogs: m.cogs ? Math.abs(n0(x[m.cogs])) : NaN, labor: m.labor ? Math.abs(n0(x[m.labor])) : NaN, expenses: c, net: rev - c, margin: rev ? (rev - c) / rev : NaN }; });
      const rev = App.sum(rows.map(x => x.revenue)), net = App.sum(rows.map(x => x.net));
      const best = [...rows].sort((a, b) => b.net - a.net);
      return { title: focus === 'net' ? 'Net income' : 'Revenue', subtitle: esc(ds.name),
        stats: [['Revenue', fmt.money(rev)], ['Expenses', fmt.money(rev - net)], ['Net income', fmt.money(net), net >= 0 ? 'good' : 'bad'], ['Net margin', fmt.pct(rev ? net / rev : NaN)], ['Best period', best[0]?.period || '—'], ['Worst period', best[best.length - 1]?.period || '—']],
        sections: [{ title: focus === 'net' ? 'Net income by period' : 'Revenue by period', bars: rows.map(x => ({ label: x.period, v: focus === 'net' ? x.net : x.revenue, text: fmt.money(focus === 'net' ? x.net : x.revenue), color: focus === 'net' && x.net < 0 ? 'var(--bad)' : '' })) },
          { title: 'Period detail', table: { cols: [{ key: 'period', label: 'Period' }, { key: 'revenue', label: 'Revenue', num: true, fmt: v => fmt.money(v) }, { key: 'cogs', label: 'COGS', num: true, fmt: v => fmt.money(v) }, { key: 'labor', label: 'Labor', num: true, fmt: v => fmt.money(v) }, { key: 'expenses', label: 'All costs', num: true, fmt: v => fmt.money(v) }, { key: 'net', label: 'Net', num: true, fmt: v => `<span style="color:var(${v < 0 ? '--bad' : '--good'})">${fmt.money(v)}</span>` }, { key: 'margin', label: 'Margin', num: true, fmt: v => fmt.pct(v) }], rows } }],
        actions: [['Open Financials', page('finance')]] };
    },

    /* Trading positions */
    async positions(focus) {
      const r = await find('trade-pos', ['trading'], [{ k: 'sym', syn: ['symbol', 'ticker', 'instrument'], req: true }, { k: 'qty', syn: ['quantity', 'qty', 'shares', 'position', 'units', 'total qty'], req: true }, { k: 'avg', syn: ['avg cost', 'average cost', 'avg price', 'cost basis per share', 'entry price'] }, { k: 'last', syn: ['last price', 'last', 'price', 'current price', 'mark'] }, { k: 'mv', syn: ['market value', 'mkt value', 'value', 'current value'] }, { k: 'sector', syn: ['sector', 'industry', 'asset class'] }, { k: 'acct', syn: ['account', 'portfolio', 'creator', 'strategy'] }]);
      if (!r) return null;
      const { ds, m } = r;
      const rows = ds.rows.filter(x => x[m.sym] !== '').map(x => { const q = n0(x[m.qty]), last = n0(x[m.last]), avg = n0(x[m.avg]); const mv = m.mv ? n0(x[m.mv]) : q * last; const cost = m.avg ? q * avg : NaN; return { sym: String(x[m.sym]), acct: x[m.acct] || '', sector: x[m.sector] || '', qty: q, avg, last: m.last ? last : mv / q, mv, upl: mv - cost, ret: cost ? (mv - cost) / Math.abs(cost) : NaN }; });
      const gross = App.sum(rows.map(x => Math.abs(x.mv))); rows.forEach(x => x.w = gross ? Math.abs(x.mv) / gross : 0);
      const upl = App.sum(rows.map(x => isNaN(x.upl) ? 0 : x.upl));
      const sec = sumBy(rows, x => x.sector || 'Unclassified', x => Math.abs(x.mv));
      const sorted = focus === 'upl' ? [...rows].sort((a, b) => b.upl - a.upl) : [...rows].sort((a, b) => b.w - a.w);
      return { title: focus === 'upl' ? 'Unrealized P&L' : 'Exposure', subtitle: esc(ds.name),
        stats: [['Gross exposure', fmt.money(gross)], ['Unrealized P&L', fmt.money(upl), upl >= 0 ? 'good' : 'bad'], ['Positions', fmt.num(rows.length)], ['Largest', sorted[0] ? `${esc(sorted[0].sym)} ${fmt.pct(sorted[0].w)}` : '—']],
        sections: [focus === 'upl' ? { title: 'Winners & losers', bars: sorted.map(x => ({ label: x.sym, v: x.upl, text: `${fmt.money(x.upl)} (${fmt.pct(x.ret)})`, color: x.upl < 0 ? 'var(--bad)' : 'var(--good)' })) } : { title: 'Weight by position', bars: sorted.map(x => ({ label: x.sym, v: x.w, text: `${fmt.pct(x.w)} · ${fmt.money(x.mv)}` })) },
          { title: 'By sector', bars: [...sec.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, v, text: `${fmt.money(v)} · ${fmt.pct(v / gross)}` })) },
          { title: 'Positions', table: { cols: [{ key: 'sym', label: 'Symbol' }, { key: 'qty', label: 'Qty', num: true, fmt: v => fmt.num(v, 2) }, { key: 'avg', label: 'Avg', num: true, fmt: v => money(v) }, { key: 'last', label: 'Last', num: true, fmt: v => money(v) }, { key: 'mv', label: 'Value', num: true, fmt: v => fmt.money(v) }, { key: 'upl', label: 'P&L', num: true, fmt: v => `<span style="color:var(${v < 0 ? '--bad' : '--good'})">${fmt.money(v)}</span>` }, { key: 'w', label: 'Weight', num: true, fmt: v => fmt.pct(v) }], rows, sortKey: focus === 'upl' ? 'upl' : 'w' } }],
        actions: [['Open Trading Risk', page('trading')]] };
    },

    /* Marketing campaigns */
    async marketing(focus) {
      const r = await find('marketing', ['marketing'], [{ k: 'camp', syn: ['campaign', 'campaign name', 'ad set', 'ad name'], req: true }, { k: 'spend', syn: ['spend', 'cost', 'amount spent'], req: true }, { k: 'chan', syn: ['channel', 'platform', 'source', 'medium'] }, { k: 'conv', syn: ['conversions', 'purchases', 'orders', 'results'] }, { k: 'rev', syn: ['revenue', 'conversion value', 'purchase value'] }, { k: 'clicks', syn: ['clicks', 'link clicks'] }]);
      if (!r) return null;
      const { ds, m } = r;
      const g = new Map();
      ds.rows.forEach(x => { const k = String(x[m.camp] || '(none)'); const a = g.get(k) || { camp: k, chan: x[m.chan] || '', spend: 0, rev: 0, conv: 0, clicks: 0 }; a.spend += n0(x[m.spend]); a.rev += m.rev ? n0(x[m.rev]) : 0; a.conv += m.conv ? n0(x[m.conv]) : 0; a.clicks += m.clicks ? n0(x[m.clicks]) : 0; g.set(k, a); });
      const rows = [...g.values()].map(a => ({ ...a, roas: a.spend && m.rev ? a.rev / a.spend : NaN, cpa: a.conv ? a.spend / a.conv : NaN }));
      const spend = App.sum(rows.map(x => x.spend)), rev = App.sum(rows.map(x => x.rev));
      const tgt = App.bsettings.get('mk.targets', { roas: 3 }).roas;
      return { title: focus === 'roas' ? 'Return on ad spend' : 'Marketing spend', subtitle: esc(ds.name),
        stats: [['Spend', fmt.money(spend)], ['Revenue', m.rev ? fmt.money(rev) : '—'], ['ROAS', m.rev ? (rev / spend).toFixed(2) + '×' : '—'], ['Campaigns', fmt.num(rows.length)]],
        sections: [{ title: focus === 'roas' ? 'ROAS by campaign' : 'Spend by campaign', bars: (focus === 'roas' ? [...rows].sort((a, b) => b.roas - a.roas) : [...rows].sort((a, b) => b.spend - a.spend)).map(x => ({ label: x.camp, v: focus === 'roas' ? x.roas || 0 : x.spend, text: focus === 'roas' ? `${isNaN(x.roas) ? '—' : x.roas.toFixed(2) + '×'} on ${fmt.money(x.spend)}` : fmt.money(x.spend), color: focus === 'roas' ? (x.roas < 1 ? 'var(--bad)' : x.roas < tgt ? 'var(--warn)' : 'var(--good)') : '' })) },
          { title: 'Campaigns', table: { cols: [{ key: 'camp', label: 'Campaign' }, { key: 'chan', label: 'Channel' }, { key: 'spend', label: 'Spend', num: true, fmt: v => fmt.money(v) }, { key: 'conv', label: 'Conv.', num: true }, { key: 'cpa', label: 'CPA', num: true, fmt: v => fmt.money(v, 2) }, { key: 'rev', label: 'Revenue', num: true, fmt: v => fmt.money(v) }, { key: 'roas', label: 'ROAS', num: true, fmt: v => isNaN(v) ? '—' : v.toFixed(2) + '×' }], rows, sortKey: 'spend' } }],
        actions: [['Open Marketing', page('marketing')]] };
    },

    /* Compliance & legal */
    async filings(focus) {
      if (!App.compliance) return null;
      const list = focus === 'overdue' ? (await App.compliance.upcoming(0)).filter(d => d.status === 'overdue') : await App.compliance.upcoming(45);
      return { title: focus === 'overdue' ? 'Overdue filings' : 'Due soon', stats: [['Items', fmt.num(list.length)]],
        sections: [{ table: { cols: [{ key: 'due', label: 'Due' }, { key: 'title', label: 'Obligation' }, { key: 'cat', label: 'Type' }, { key: 'amount', label: 'Est.', num: true, fmt: v => v == null ? '—' : fmt.money(v, 2) }, { key: 'status', label: 'Status', fmt: (v, r) => `<span class="badge ${v === 'overdue' ? 'bad' : v === 'soon' ? 'warn' : ''}">${v}${r.days != null ? ` · ${r.days < 0 ? -r.days + 'd late' : r.days + 'd'}` : ''}</span>` }], rows: list } }],
        actions: [['Open filing calendar', page('compliance', { tab: 'calendar' })]] };
    },
    async contractors() {
      if (!App.compliance) return null;
      const y = new Date().getFullYear(), list = (await App.compliance.contractors(y)).filter(c => c.needs || c.suggest);
      return { title: `1099 contractors (${y})`, subtitle: `Threshold ${fmt.money(App.compliance.threshold1099(y))}`, stats: [['To file', fmt.num(list.filter(c => c.status.startsWith('file')).length)], ['Missing W-9', fmt.num(list.filter(c => c.needs && !c.w9).length), 'warn'], ['Paid', fmt.money(App.sum(list.map(c => c.paid)))]],
        sections: [{ table: { cols: [{ key: 'name', label: 'Vendor' }, { key: 'paid', label: 'Paid', num: true, fmt: v => money(v) }, { key: 'card', label: 'By card', num: true, fmt: v => v ? money(v) : '—' }, { key: 'w9', label: 'W-9', fmt: v => v ? '✓' : '<span class="badge warn">missing</span>' }, { key: 'status', label: 'Status' }], rows: list } }],
        actions: [['Open 1099 tracker', page('compliance', { tab: '1099' })]] };
    },
    async licenses() {
      const lic = App.bsettings.get('cmp.licenses', []).map(l => ({ ...l, st: App.compliance.licenseStatus(l) })).sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
      if (!lic.length) return null;
      return { title: 'Licenses & insurance', stats: [['On file', fmt.num(lic.length)], ['Expired', fmt.num(lic.filter(l => l.st.k === 'expired').length), 'bad'], ['Expiring ≤60d', fmt.num(lic.filter(l => l.st.k === 'soon').length), 'warn']],
        sections: [{ table: { cols: [{ key: 'name', label: 'Name' }, { key: 'number', label: 'Number' }, { key: 'expires', label: 'Expires' }, { key: 'st', label: 'Status', fmt: v => `<span class="badge ${v.tone}">${esc(v.label)}</span>` }], rows: lic } }],
        actions: [['Open licenses', page('compliance', { tab: 'licenses' })]] };
    },
    async audit() {
      if (!App.compliance) return null;
      const r = await App.compliance.readiness(new Date().getFullYear());
      return { title: 'Audit readiness', stats: [['Score', isNaN(r.score) ? '—' : Math.round(r.score * 100) + '%'], ['Issues', fmt.num(r.items.length)]],
        sections: [{ title: 'Checks', bars: r.parts.map(([l, v, d]) => ({ label: l, v, text: `${Math.round(v * 100)}% · ${d}`, color: v >= .9 ? 'var(--good)' : v >= .6 ? 'var(--warn)' : 'var(--bad)' })) },
          { title: 'Fix these', html: r.items.map(([t, s]) => `<div class="alert ${t} small">${esc(s)}</div>`).join('') || '<div class="alert good">No issues</div>' }],
        actions: [['Open Tax & Compliance', page('compliance')]] };
    },
    async legal() {
      if (!App.legal) return null;
      const a = await App.legal.assess();
      return { title: 'Lawsuit protection', stats: [['Score', isNaN(a.score) ? '—' : Math.round(a.score * 100) + '%'], ['High-risk gaps', fmt.num(a.gaps.filter(g => g.sev === 3).length), 'bad'], ['Unanswered', fmt.num(a.unanswered)]],
        sections: [{ title: 'Gaps, highest risk first', html: a.gaps.map(g => `<div class="alert ${g.sev === 3 ? 'bad' : 'warn'} small"><div><b>${esc(g.q)}</b><div class="muted tiny">${esc(g.auto?.note || g.why)}</div></div></div>`).join('') || '<div class="alert good">No gaps among answered checks.</div>' }],
        actions: [['Open Legal & Risk', page('legal')]] };
    }
  };

  /* Re-run optional post-render hooks */
  const _render = render;
  render = function (body, r) { _render(body, r); r.after?.(); };

  /* Global: any element with data-drill opens its panel; Esc closes */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-drill]');
    if (!el || el.closest('#drill')) return;
    e.preventDefault(); e.stopPropagation();
    open(el.dataset.drill, el.dataset.arg);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('drill')?.classList.contains('open')) { e.stopPropagation(); close(); } }, true);

  /* Which drill a KPI box opens, from its label (and the page it's on, for ambiguous labels) */
  const RULES = [
    [/headcount|departments \/ locations/i, 'headcount'], [/tenure/i, 'tenure'], [/turnover/i, 'turnover'], [/pay rate/i, 'pay'],
    [/^labor hours/i, 'labor', 'hours'], [/^labor cost|gross wages|social security|medicare|futa|unemployment|employer (payroll )?tax/i, 'labor'],
    [/labor %|sales \/ labor hr|prime cost|schedule variance/i, 'labor', 'pct'],
    [/food cost %/i, 'foodcost'], [/business purchases|tax you paid on purchases/i, 'purchases'], [/^food purchases/i, 'purchases', 'food'],
    [/personal \(excluded\)/i, 'purchases', 'personal'], [/owed to you/i, 'purchases', 'owed'], [/beverage & alcohol/i, 'purchases', 'bev'], [/supplies & paper/i, 'purchases', 'supplies'],
    [/net sales|operating sales|taxable sales/i, 'sales'],
    [/unrealized/i, 'positions', 'upl'], [/exposure|largest position|top 5 concentration|leverage/i, 'positions'],
    [/marketing spend/i, 'marketing'], [/roas/i, 'marketing', 'roas'],
    [/net income/i, 'finance', 'net'], [/^(total )?revenue$|gross profit|total expenses|latest growth|vs budget/i, 'finance'],
    [/overdue filings/i, 'filings', 'overdue'], [/due in \d+ days/i, 'filings'], [/1099s to file/i, 'contractors'], [/licenses needing/i, 'licenses'],
    [/audit readiness/i, 'audit'], [/lawsuit protection|high-risk gaps|all gaps/i, 'legal']
  ];
  App.drillFor = label => {
    const route = App.currentRoute?.();
    if (route === 'marketing' && /^(spend|revenue|cpa|ctr|conversion rate|leads)$/i.test(label)) return ['marketing'];
    if (route === 'marketing' && /roas/i.test(label)) return ['marketing', 'roas'];
    const r = RULES.find(([re]) => re.test(label));
    return r ? [r[1], r[2] || ''] : null;
  };
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.kpi[data-drill]')) { e.preventDefault(); open(e.target.dataset.drill, e.target.dataset.arg); }
  });

  App.drill = { open, close, DRILLS, roster, labor, sales };
})(window.App);
