/* Personnel: roster analytics (Harri employee export), directory, per-employee files */
(function (App) {
  const { fmt, n0, esc } = App;

  const FIELDS = [
    { key: 'name', label: 'Employee name', syn: ['employee name', 'employee', 'full name', 'name', 'team member'] },
    { key: 'first', label: 'First name (if split)', syn: ['first name', 'first'], optional: true },
    { key: 'last', label: 'Last name (if split)', syn: ['last name', 'last', 'surname'], optional: true },
    { key: 'title', label: 'Position / Title', syn: ['position', 'job title', 'title', 'role', 'job'], optional: true },
    { key: 'dept', label: 'Department', syn: ['department', 'dept', 'team', 'division'], optional: true },
    { key: 'loc', label: 'Location', syn: ['location', 'store', 'site', 'brand'], optional: true },
    { key: 'hire', label: 'Hire date', syn: ['hire date', 'start date', 'date hired', 'hired'], optional: true },
    { key: 'term', label: 'Termination date', syn: ['termination date', 'term date', 'end date', 'separation date'], optional: true },
    { key: 'status', label: 'Status', syn: ['status', 'employment status', 'active'], optional: true },
    { key: 'type', label: 'Employment type', syn: ['employment type', 'type', 'ft/pt', 'full/part time'], optional: true },
    { key: 'pay', label: 'Pay rate / Salary', syn: ['pay rate', 'rate', 'hourly rate', 'salary', 'wage'], optional: true },
    { key: 'email', label: 'Email', syn: ['email', 'e-mail', 'email address'], optional: true },
    { key: 'phone', label: 'Phone', syn: ['phone', 'mobile', 'cell', 'phone number'], optional: true },
    { key: 'mgr', label: 'Manager', syn: ['manager', 'supervisor', 'reports to'], optional: true }
  ];
  let people = [], q = '';

  App.modules.personnel = {
    async render(view) {
      view.innerHTML = `<div class="alert warn small">Personnel data is confidential. Everything stays in this computer's local storage — use Settings → Export backup for secure archiving.</div>
        <div id="pMap"></div><div id="pOut" class="stack" style="gap:16px"></div>`;
      await App.ui.mapper(view.querySelector('#pMap'), { title: 'Employee roster (e.g. Harri export)', categories: ['personnel'], fields: FIELDS, key: 'personnel',
        onChange: (ds, m) => analyze(view.querySelector('#pOut'), ds, m) });
    }
  };

  async function analyze(el, ds, m) {
    if (!ds || !(m.name || m.first)) { el.innerHTML = ds ? App.ui.empty('Map an Employee name column.') : await docsOnly(); return; }
    const now = new Date();
    people = ds.rows.map((r, i) => {
      const name = m.name ? String(r[m.name]) : `${r[m.first] || ''} ${r[m.last] || ''}`.trim();
      const hire = m.hire ? App.toDate(r[m.hire]) : null;
      const term = m.term ? App.toDate(r[m.term]) : null;
      const st = m.status ? String(r[m.status]) : '';
      const active = term ? false : (st ? !/term|inactive|separated|quit|fired|former|no/i.test(st) : true);
      const end = term || now;
      return { i, name, title: r[m.title] || '', dept: r[m.dept] || r[m.loc] || 'Unassigned', loc: r[m.loc] || '', hire, term, status: st || (active ? 'Active' : 'Terminated'), active,
        type: r[m.type] || '', pay: m.pay ? n0(r[m.pay]) : NaN, email: r[m.email] || '', phone: r[m.phone] || '', mgr: r[m.mgr] || '',
        tenure: hire ? (end - hire) / (365.25 * 864e5) : NaN, raw: r };
    }).filter(p => p.name);

    const active = people.filter(p => p.active);
    const termed = people.filter(p => !p.active);
    const yearAgo = new Date(now - 365 * 864e5);
    const termLastYear = termed.filter(p => p.term && p.term >= yearAgo).length;
    const turnover = active.length ? (m.term ? termLastYear : termed.length) / ((active.length + termed.length + active.length) / 2) : NaN;
    const tenures = active.map(p => p.tenure).filter(x => !isNaN(x));
    const pays = active.map(p => p.pay).filter(x => !isNaN(x) && x > 0);
    const newHires90 = active.filter(p => p.hire && now - p.hire < 90 * 864e5).length;
    const early = termed.filter(p => p.hire && p.term && (p.term - p.hire) < 90 * 864e5).length;

    const byDept = new Map();
    active.forEach(p => byDept.set(p.dept, (byDept.get(p.dept) || 0) + 1));
    const deptRows = [...byDept.entries()].sort((a, b) => b[1] - a[1]);
    const buckets = { '< 90 days': 0, '3–12 mo': 0, '1–2 yrs': 0, '2–5 yrs': 0, '5+ yrs': 0 };
    tenures.forEach(t => { if (t < 0.25) buckets['< 90 days']++; else if (t < 1) buckets['3–12 mo']++; else if (t < 2) buckets['1–2 yrs']++; else if (t < 5) buckets['2–5 yrs']++; else buckets['5+ yrs']++; });

    const alerts = [];
    if (turnover > 0.75) alerts.push(['warn', `Annualized turnover ≈ ${fmt.pct(turnover)}`]);
    if (early) alerts.push(['warn', `${early} employee${early > 1 ? 's' : ''} left within 90 days of hire — review onboarding`]);
    if (m.email) { const missing = active.filter(p => !p.email).length; if (missing) alerts.push(['warn', `${missing} active employee records missing email`]); }
    App.ui.publish('personnel', { headcount: active.length, turnover, avgTenure: App.mean(tenures), alerts: alerts.length });

    el.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Active headcount', fmt.num(active.length), `${termed.length} former`)}
        ${App.ui.kpi('Departments / locations', fmt.num(byDept.size), '')}
        ${m.hire ? App.ui.kpi('Avg tenure', isNaN(App.mean(tenures)) ? '—' : App.mean(tenures).toFixed(1) + ' yrs', `${newHires90} hired in last 90 days`) : ''}
        ${App.ui.kpi('Turnover', fmt.pct(turnover), m.term ? 'last 12 months, annualized' : 'former / avg headcount', turnover > 0.75 ? 'warn' : '')}
        ${m.pay ? App.ui.kpi('Median pay rate', fmt.money(App.quantile(pays, 0.5), 2), `range ${fmt.money(Math.min(...pays), 2)} – ${fmt.money(Math.max(...pays), 2)}`) : ''}
      </div>
      ${alerts.length ? `<div class="card"><div class="stack">${alerts.map(([c, s]) => `<div class="alert ${c}">${esc(s)}</div>`).join('')}</div></div>` : ''}
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>Headcount by ${m.dept ? 'department' : 'location'}</h2></div><div class="chart-box"><canvas id="pDept"></canvas></div></div>
        ${m.hire ? `<div class="card"><div class="card-head"><h2>Tenure distribution</h2></div><div class="chart-box"><canvas id="pTen"></canvas></div></div>` : ''}
      </div>
      <div class="card"><div class="card-head"><h2>Directory</h2>
        <div class="row"><input type="search" id="pQ" placeholder="Search people…" value="${esc(q)}"><label class="row small"><input type="checkbox" id="pAct" checked> Active only</label><button class="btn small" id="pCsv">Export CSV</button></div></div>
        <div id="pDir"></div><div class="muted tiny" style="margin-top:6px">Click a name to view the record and attach personnel files.</div></div>`;

    App.ui.chart('pDept', 'bar', { labels: deptRows.map(d => d[0]), datasets: [{ label: 'Employees', data: deptRows.map(d => d[1]), multiColor: true }] }, { indexAxis: 'y' });
    if (m.hire) App.ui.chart('pTen', 'bar', { labels: Object.keys(buckets), datasets: [{ label: 'Employees', data: Object.values(buckets) }] });

    const fileList = await App.store.files();
    const docCount = name => fileList.filter(f => (f.tags || []).some(t => t.toLowerCase() === name.toLowerCase())).length;
    const dir = () => {
      const l = q.toLowerCase();
      const onlyActive = el.querySelector('#pAct').checked;
      const rows = people.filter(p => (!onlyActive || p.active) && (!l || [p.name, p.title, p.dept, p.loc, p.email, p.mgr].join(' ').toLowerCase().includes(l)))
        .map(p => ({ ...p, docs: docCount(p.name) }));
      App.ui.table(el.querySelector('#pDir'), [
        { key: 'name', label: 'Name', fmt: (v, r) => `<a data-p="${r.i}">${esc(v)}</a>` },
        ...(m.title ? [{ key: 'title', label: 'Position' }] : []),
        { key: 'dept', label: m.dept ? 'Department' : 'Location' },
        ...(m.hire ? [{ key: 'tenure', label: 'Tenure', num: true, fmt: v => isNaN(v) ? '—' : v.toFixed(1) + ' y' }] : []),
        ...(m.pay ? [{ key: 'pay', label: 'Pay', num: true, fmt: v => fmt.money(v, 2) }] : []),
        { key: 'status', label: 'Status', fmt: (v, r) => `<span class="badge ${r.active ? 'good' : ''}">${esc(v)}</span>` },
        { key: 'docs', label: 'Files', num: true }
      ], rows);
      el.querySelectorAll('[data-p]').forEach(a => a.onclick = () => record(people.find(p => p.i === +a.dataset.p), () => dir()));
    };
    el.querySelector('#pQ').oninput = e => { q = e.target.value; dir(); };
    el.querySelector('#pAct').onchange = dir;
    el.querySelector('#pCsv').onclick = () => App.download('directory.csv', App.toCSV(ds.headers, ds.rows));
    dir();
  }

  async function docsOnly() {
    const fs = (await App.store.files()).filter(f => f.category === 'personnel');
    return fs.length ? `<div class="card"><h2>Personnel files</h2><div class="stack" style="margin-top:10px">${fs.map(f => `<div>${esc(f.name)}</div>`).join('')}</div></div>` : '';
  }

  async function record(p, refresh) {
    const files = (await App.store.files()).filter(f => (f.tags || []).some(t => t.toLowerCase() === p.name.toLowerCase()));
    App.ui.modal(`
      <div class="card-head"><h2>${esc(p.name)}</h2><button class="btn small" data-close>Close</button></div>
      <div class="table-wrap" style="max-height:260px"><table><tbody>${Object.entries(p.raw).filter(([, v]) => v !== '').map(([k, v]) => `<tr><th style="position:static">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
      <h3 style="margin:16px 0 8px">Personnel files (${files.length})</h3>
      <div class="stack">${files.map(f => `<div class="row spread"><span>${esc(f.name)}</span><button class="btn small" data-dl="${f.id}">Download</button></div>`).join('') || '<div class="muted small">No files attached.</div>'}</div>
      <label class="btn primary" style="margin-top:12px">Attach file (review, I-9, certification…)<input type="file" id="pf" multiple hidden></label>
      ${p.email ? `<a class="btn" style="margin-top:12px" href="mailto:${esc(p.email)}">Email</a>` : ''}`, (card, close) => {
      card.querySelector('#pf').onchange = async e => {
        await App.ingest.ingestMany([...e.target.files], { category: 'personnel', tags: [p.name] });
        close(); refresh(); record(p, refresh);
      };
      card.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { const f = await App.store.get('files', b.dataset.dl); App.download(f.name, f.blob); });
    });
  }
})(window.App);
