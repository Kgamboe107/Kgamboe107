/* Reports: tax & compliance tracking, filings calendar, audit readiness, accountant workbook */
(function (App) {
  const { esc, fmt } = App;
  const C = () => App.compliance;
  let tab = 'overview';
  let year = new Date().getFullYear();
  let calFilter = '';

  const STATUS = { done: ['good', 'Filed'], overdue: ['bad', 'Overdue'], soon: ['warn', 'Due soon'], upcoming: ['', 'Upcoming'] };
  const badge = d => { const [t, l] = STATUS[d.status]; return `<span class="badge ${t}">${l}${d.status === 'soon' ? ` · ${d.days === 0 ? 'today' : d.days + 'd'}` : d.status === 'overdue' ? ` · ${-d.days}d` : ''}</span>`; };
  const TABS = [['overview', 'Overview'], ['calendar', 'Filing calendar'], ['sales', 'Sales tax'], ['payroll', 'Payroll tax'], ['1099', '1099 contractors'], ['licenses', 'Licenses & permits'], ['records', 'Records & audit log'], ['setup', 'Setup']];

  App.modules.compliance = {
    async render(view, params = {}) {
      if (params.tab) tab = params.tab;
      if (App.biz.isMaster()) {
        view.innerHTML = App.ui.empty('Tax & compliance is tracked per business (each has its own EIN, permits and filings). Pick a business from the sidebar.', `<div class="row" style="justify-content:center">${App.biz.active().map(b => `<button class="btn" data-biz="${b.id}">${esc(b.name)}</button>`).join('')}</div>`);
        view.querySelectorAll('[data-biz]').forEach(b => b.onclick = () => { App.biz.setCurrent(b.dataset.biz); App.go('compliance'); });
        return;
      }
      const years = [year + 1, year, year - 1, year - 2].filter((y, i, a) => a.indexOf(y) === i && y <= new Date().getFullYear() + 1).sort((a, b) => b - a);
      view.innerHTML = `
        <div class="card row spread no-print">
          <div class="tabs" style="background:none;padding:0">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>
          <label class="row small muted">Tax year <select id="cyYear">${App.ui.options(years.map(String), String(year))}</select></label>
        </div>
        <div class="alert small" style="background:var(--panel-2)">These figures are estimates built from your own data to help you track, prepare and stay audit-ready. They are not tax or legal advice. Confirm amounts and deadlines with your CPA, payroll provider and state/local agencies.</div>
        <div id="cyBody" class="stack" style="gap:16px"></div>`;
      view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; App.go('compliance'); });
      view.querySelector('#cyYear').onchange = e => { year = +e.target.value; App.go('compliance'); };
      const body = view.querySelector('#cyBody');
      await publish();
      await ({ overview, calendar, sales, payroll, 1099: contractors, licenses, records, setup })[tab](body);
    }
  };

  async function publish() {
    const up = await C().upcoming(30);
    const r = await C().readiness(year);
    const flags = [...up.filter(d => d.status === 'overdue').map(d => `Overdue: ${d.title} (due ${d.due})`), ...up.filter(d => d.status !== 'overdue').slice(0, 5).map(d => `Due ${d.due}: ${d.title}`), ...r.items.filter(i => i[0] === 'bad').map(i => i[1])];
    const overdueN = up.filter(d => d.status === 'overdue').length;
    const pill = document.getElementById('cmpPill'); if (pill) { pill.hidden = !overdueN; pill.textContent = overdueN; pill.title = `${overdueN} overdue filing${overdueN > 1 ? 's' : ''}`; }
    App.ui.publish('compliance', { score: r.score, overdue: up.filter(d => d.status === 'overdue').length, dueSoon: up.filter(d => d.status !== 'overdue').length, alerts: flags.length, flags: flags.slice(0, 12) });
  }

  /* ---------- Mark a deadline filed / paid (the audit trail for each filing) ---------- */
  function markFiled(d, after) {
    const done = App.bsettings.get('cmp.done', {});
    const cur = done[d.key] || {};
    App.ui.modal(`<div class="card-head"><h2>${cur.date ? 'Filing record' : 'Mark as filed / paid'}</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="stack">
        <div><b>${esc(d.title)}</b><div class="muted small">Due ${esc(d.due)}${d.amount != null ? ` · estimated ${fmt.money(d.amount, 2)}` : ''}</div></div>
        <div class="mapper">
          <label>Date filed / paid<input type="date" id="mfDate" value="${esc(cur.date || new Date().toISOString().slice(0, 10))}"></label>
          <label>Amount paid<input type="number" step="0.01" id="mfAmt" value="${esc(cur.amount ?? (d.amount != null ? d.amount.toFixed(2) : ''))}"></label>
          <label>Confirmation # / reference<input id="mfConf" value="${esc(cur.confirmation || '')}" placeholder="e.g. EFTPS 27047…"></label>
          <label>Filed by<input id="mfBy" value="${esc(cur.by || '')}" placeholder="You, CPA, payroll provider"></label>
        </div>
        <label class="field">Notes<input id="mfNote" value="${esc(cur.note || '')}"></label>
        <div class="row"><label class="btn small">${App.fx.icon('upload')} Attach proof (return, payment receipt)<input type="file" id="mfFile" hidden></label><span class="muted tiny" id="mfF">${cur.fileName ? '📎 ' + esc(cur.fileName) : ''}</span></div>
        <div class="row spread"><button class="btn primary" id="mfSave">Save filing record</button>${cur.date ? '<button class="btn danger" id="mfUndo">Mark not filed</button>' : ''}</div>
      </div>`, (card, close) => {
      let file = null;
      card.querySelector('#mfFile').onchange = e => { file = e.target.files[0]; card.querySelector('#mfF').textContent = file ? '📎 ' + file.name : ''; };
      card.querySelector('#mfSave').onclick = async () => {
        const rec = { date: card.querySelector('#mfDate').value, amount: card.querySelector('#mfAmt').value === '' ? null : +card.querySelector('#mfAmt').value, confirmation: card.querySelector('#mfConf').value.trim(), by: card.querySelector('#mfBy').value.trim(), note: card.querySelector('#mfNote').value.trim(), fileId: cur.fileId, fileName: cur.fileName };
        if (file) { const [f] = await App.ingest.ingestMany([file], { category: 'report', tags: ['Compliance', d.title] }); if (f) { rec.fileId = f.id; rec.fileName = f.name; } }
        const all = App.bsettings.get('cmp.done', {}); all[d.key] = rec; App.bsettings.set('cmp.done', all);
        C().audit('Filing recorded', `${d.title}: filed ${rec.date}${rec.amount != null ? ', paid ' + fmt.money(rec.amount, 2) : ''}${rec.confirmation ? ', conf ' + rec.confirmation : ''}`);
        close(); App.ui.toast('Filing record saved'); after ? after() : App.go('compliance');
      };
      card.querySelector('#mfUndo')?.addEventListener('click', () => {
        const all = App.bsettings.get('cmp.done', {}); delete all[d.key]; App.bsettings.set('cmp.done', all);
        C().audit('Filing record removed', d.title); close(); App.go('compliance');
      });
    });
  }

  function deadlineRows(el, list) {
    App.ui.table(el, [
      { key: 'due', label: 'Due', fmt: (v, r) => `<b>${esc(v)}</b>` },
      { key: 'title', label: 'Obligation' },
      { key: 'cat', label: 'Type', fmt: v => `<span class="badge">${esc(v)}</span>` },
      { key: 'amount', label: 'Est. amount', num: true, fmt: v => v == null ? '—' : fmt.money(v, 2) },
      { key: 'status', label: 'Status', fmt: (v, r) => badge(r) + (r.done ? `<div class="muted tiny">${esc(r.done.date)}${r.done.confirmation ? ' · #' + esc(r.done.confirmation) : ''}${r.done.fileName ? ' · 📎' : ''}</div>` : '') },
      { key: 'key', label: '', fmt: (v, r) => `<button class="btn small ${r.done ? 'ghost' : ''}" data-mark="${esc(v)}">${r.done ? 'View' : 'Mark filed'}</button>` }
    ], list, { limit: 400 });
    el.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => markFiled(list.find(d => d.key === b.dataset.mark)));
  }

  /* ---------- Overview ---------- */
  async function overview(body) {
    const [r, up, st, pr, cons, pt, all] = await Promise.all([C().readiness(year), C().upcoming(45), C().salesTax(year), C().payroll(year), C().contractors(year), C().purchaseTax(year), C().deadlines(year)]);
    const lic = App.bsettings.get('cmp.licenses', []);
    const expiring = lic.filter(l => ['soon', 'expired'].includes(C().licenseStatus(l).k));
    const to1099 = cons.filter(c => c.status.startsWith('file'));
    const overdue = up.filter(d => d.status === 'overdue');
    const salesTaxEst = App.sum(st.periods.map(p => p.tax));
    const done = App.bsettings.get('cmp.done', {});
    const salesTaxPaid = App.sum(st.periods.map(p => done['sales:' + p.key]?.amount || 0));
    const sales = App.sum(st.periods.map(p => p.gross));
    const tone = isNaN(r.score) ? '' : r.score >= 0.85 ? 'good' : r.score >= 0.6 ? 'warn' : 'bad';

    body.innerHTML = `
      ${C().isSetUp() ? '' : `<div class="card hero"><div class="hero-grid"></div><h2>Set up your tax profile</h2><p class="muted">Two minutes: business type, state sales tax rate and filing frequency, and whether you have employees. Deadlines, estimates and the audit checklist are built from it.</p><div class="row"><button class="btn primary" data-tabgo="setup">Set up now</button></div></div>`}
      <div class="grid k4">
        <div class="card kpi ${tone}"><div class="label">Audit readiness</div><div class="value">${isNaN(r.score) ? '—' : Math.round(r.score * 100) + '%'}</div><div class="sub muted">${r.parts.length} checks · ${year}</div><div class="meter"><i style="width:${isNaN(r.score) ? 0 : Math.round(r.score * 100)}%"></i></div></div>
        ${App.ui.kpi('Overdue filings', fmt.num(overdue.length), overdue.length ? 'mark filed if already done' : 'nothing overdue', overdue.length ? 'bad' : 'good')}
        ${App.ui.kpi('Due in 45 days', fmt.num(up.length - overdue.length), up.find(d => d.status !== 'overdue') ? 'next: ' + esc(up.find(d => d.status !== 'overdue').due) : '')}
        ${App.ui.kpi('Est. sales tax ' + year, fmt.money(salesTaxEst), st.source ? `${fmt.money(salesTaxPaid)} recorded paid` : 'add sales data', salesTaxEst - salesTaxPaid > 1 ? 'warn' : '')}
        ${App.ui.kpi('Est. employer payroll tax', pr.total ? fmt.money(pr.total.employerTax) : '—', pr.total ? `on ${fmt.money(pr.total.wages)} wages` : 'add labor data')}
        ${App.ui.kpi('1099s to file', fmt.num(to1099.length), `threshold ${fmt.money(C().threshold1099(year))} (${year})`, to1099.some(c => !c.w9) ? 'warn' : '')}
        ${App.ui.kpi('Licenses needing action', fmt.num(expiring.length), `${lic.length} on file`, expiring.some(l => C().licenseStatus(l).k === 'expired') ? 'bad' : expiring.length ? 'warn' : '')}
      </div>
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>Due next</h2><a data-tabgo="calendar" class="small">Full calendar →</a></div>
          <div class="stack">${up.slice(0, 8).map(d => `<div class="dl-item ${d.status}"><div class="dl-date"><b>${new Date(d.due + 'T00:00:00').toLocaleString(undefined, { month: 'short' })}</b><span>${+d.due.slice(8)}</span></div>
            <div style="flex:1;min-width:0"><div class="small"><b>${esc(d.title)}</b></div><div class="muted tiny">${esc(d.cat)}${d.amount != null ? ' · est. ' + fmt.money(d.amount, 2) : ''}</div></div>
            ${badge(d)}<button class="btn small" data-mark="${esc(d.key)}">Mark filed</button></div>`).join('') || '<div class="alert good">Nothing due in the next 45 days.</div>'}</div></div>
        <div class="card"><div class="card-head"><h2>Fix to stay audit-ready</h2><span class="badge ${r.items.length ? 'warn' : 'good'}">${r.items.length}</span></div>
          <div class="stack">${r.items.slice(0, 10).map(([t, s, go]) => `<a class="alert ${t}" data-fix="${go}" style="text-decoration:none;color:inherit;cursor:pointer">${esc(s)}</a>`).join('') || '<div class="alert good">No issues found.</div>'}</div>
          <h3 style="margin:16px 0 8px">Checks</h3>
          <div class="stack">${r.parts.map(([l, v, d]) => `<div class="row spread small"><span>${esc(l)}</span><span class="row"><span class="muted">${d}</span><span class="badge ${v >= 0.9 ? 'good' : v >= 0.6 ? 'warn' : 'bad'}">${Math.round(v * 100)}%</span></span></div>`).join('') || '<div class="muted small">Add receipts, licenses or contractors to start scoring.</div>'}</div></div>
      </div>
      ${pt.foodHeavyTax > 25 ? `<div class="alert warn">You paid about <b>${fmt.money(pt.foodHeavyTax, 2)}</b> in sales tax on receipts that were mostly food for resale this year. Many states let restaurants buy ingredients tax-free with a resale certificate. Ask your state and your suppliers (Costco, Restaurant Depot) how to set one up.</div>` : ''}
      <div class="card"><div class="card-head"><h2>${year} year-end summary</h2>
        <div class="row no-print"><button class="btn primary small" id="cyXlsx">${App.fx.icon('download')} Accountant workbook (Excel)</button><button class="btn small" onclick="window.print()">${App.fx.icon('printer')} Print / PDF</button></div></div>
        <div class="table-wrap"><table><tbody>
          ${[['Gross sales (from your sales data)', sales], ['Taxable sales (est.)', App.sum(st.periods.map(p => p.taxable))], ['Sales tax due (est.)', salesTaxEst], ['Sales tax recorded as paid', salesTaxPaid],
             ['Food purchases', pt.byGroup.food || 0], ['Beverage & alcohol purchases', (pt.byGroup.beverage || 0) + (pt.byGroup.alcohol || 0)], ['Supplies, paper & other purchases', (pt.byGroup.supplies || 0) + (pt.byGroup.other || 0)],
             ['Personal items on receipts (excluded)', pt.byGroup.excluded || 0], ['Sales tax paid on purchases', pt.tax],
             ['Gross wages (from labor data)', pr.total?.wages ?? null], ['Employer Social Security + Medicare (est.)', pr.total ? pr.total.ss + pr.total.medicare : null], ['FUTA + state unemployment (est.)', pr.total ? pr.total.futa + pr.total.suta : null],
             ['Contractors requiring a 1099', to1099.length, 'count'], ['Paid to 1099 contractors', App.sum(to1099.map(c => c.paid))], ['Filings recorded this tax year', all.filter(d => d.done).length + ' of ' + all.length, 'text']]
            .map(([l, v, k]) => `<tr><td>${l}</td><td class="num"><b>${v == null ? '—' : k === 'count' ? v : k === 'text' ? v : fmt.money(v, 2)}</b></td></tr>`).join('')}
        </tbody></table></div>
        <div class="muted tiny" style="margin-top:8px">Sources: ${esc(st.source || 'no sales table')} · ${esc(pr.source || 'no labor table')} · ${pt.receipts} receipts in Purchases.</div></div>`;
    body.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => markFiled(up.find(d => d.key === b.dataset.mark)));
    body.querySelectorAll('[data-tabgo]').forEach(b => b.onclick = () => { tab = b.dataset.tabgo; App.go('compliance'); });
    body.querySelectorAll('[data-fix]').forEach(a => a.onclick = () => { const g = a.dataset.fix; if (['purchases', 'personnel'].includes(g)) App.go(g); else { tab = g; App.go('compliance'); } });
    body.querySelector('#cyXlsx').onclick = () => workbook();
  }

  /* ---------- Calendar ---------- */
  async function calendar(body) {
    const list = await C().deadlines(year);
    const cats = [...new Set(list.map(d => d.cat))];
    const shown = calFilter ? list.filter(d => d.cat === calFilter) : list;
    body.innerHTML = `<div class="card"><div class="card-head"><h2>${year} filing calendar</h2>
        <div class="row"><select id="calCat"><option value="">All types</option>${App.ui.options(cats, calFilter)}</select><button class="btn small" id="calAdd">${App.fx.icon('plus')} Custom deadline</button><button class="btn small" id="calCsv">${App.fx.icon('download')} CSV</button></div></div>
        <div class="muted small" style="margin:-6px 0 12px">Federal deadlines are moved to the next business day when they fall on a weekend (holidays aren't adjusted). Add state and local items (annual report, franchise tax, health inspections) as custom deadlines.</div>
        <div id="calT"></div></div>`;
    deadlineRows(body.querySelector('#calT'), shown);
    body.querySelector('#calCat').onchange = e => { calFilter = e.target.value; App.go('compliance'); };
    body.querySelector('#calCsv').onclick = () => App.download(`filing-calendar-${year}.csv`, App.toCSV(['due', 'title', 'cat', 'amount', 'status', 'filed', 'confirmation'], list.map(d => ({ ...d, amount: d.amount?.toFixed(2) ?? '', filed: d.done?.date || '', confirmation: d.done?.confirmation || '' }))));
    body.querySelector('#calAdd').onclick = () => App.ui.modal(`<div class="card-head"><h2>Custom deadline</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="stack"><label class="field">What's due<input id="cdT" placeholder="e.g. State annual report, Liquor license renewal, Health inspection"></label>
      <div class="mapper"><label>Date<input type="date" id="cdD"></label><label>Type<select id="cdC">${App.ui.options(['State & local', 'Sales tax', 'Payroll', 'Income tax', 'License', 'Insurance', 'Other'], 'State & local')}</select></label></div>
      <label class="row small"><input type="checkbox" id="cdY" checked> Repeats every year</label>
      <label class="field">Notes<input id="cdN"></label><div class="row"><button class="btn primary" id="cdS">Add deadline</button></div></div>`, (card, close) => {
      card.querySelector('#cdS').onclick = () => {
        const t = card.querySelector('#cdT').value.trim(), d = card.querySelector('#cdD').value;
        if (!t || !d) return App.ui.toast('Add a title and date');
        const list = App.bsettings.get('cmp.custom', []); list.push({ id: App.uid(), title: t, date: d, cat: card.querySelector('#cdC').value, yearly: card.querySelector('#cdY').checked, note: card.querySelector('#cdN').value });
        App.bsettings.set('cmp.custom', list); C().audit('Deadline added', `${t} (${d})`); close(); App.go('compliance');
      };
    });
  }

  /* ---------- Sales tax ---------- */
  async function sales(body) {
    const S = C().setup(), st = await C().salesTax(year), pt = await C().purchaseTax(year), done = App.bsettings.get('cmp.done', {});
    const ds = await C().deadlines(year);
    const rows = st.periods.map(p => { const d = ds.find(x => x.key === 'sales:' + p.key); return { ...p, status: d?.status, days: d?.days, done: d?.done, paid: d?.done?.amount ?? null, diff: d?.done?.amount != null && p.hasData ? d.done.amount - p.tax : null, dkey: 'sales:' + p.key }; });
    body.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Rate', (+S.salesTaxRate).toFixed(3).replace(/\.?0+$/, '') + '%', `${S.taxableShare}% of sales taxable${S.salesIncludesTax ? ' · prices include tax' : ''}`)}
        ${App.ui.kpi('Taxable sales ' + year, fmt.money(App.sum(rows.map(r => r.taxable))), st.source ? 'from ' + esc(st.source) : 'no sales table found')}
        ${App.ui.kpi('Est. tax due ' + year, fmt.money(App.sum(rows.map(r => r.tax)), 2), `${S.salesFreq} filing · due the ${S.salesDueDay}th`)}
        ${App.ui.kpi('Recorded paid', fmt.money(App.sum(rows.map(r => r.paid || 0)), 2), `${rows.filter(r => r.done).length} of ${rows.length} periods filed`)}
        ${App.ui.kpi('Tax you paid on purchases', fmt.money(pt.tax, 2), `${pt.receipts} receipts`)}
      </div>
      <div class="card"><div class="card-head"><h2>Returns by period</h2><a class="small" data-tabgo="setup">Change rate or frequency →</a></div><div id="stT"></div></div>
      <div class="card"><div class="card-head"><h2>Estimated tax by period</h2></div><div class="chart-box" style="height:240px"><canvas id="stC"></canvas></div></div>
      ${pt.foodHeavyTax > 25 ? `<div class="alert warn">About <b>${fmt.money(pt.foodHeavyTax, 2)}</b> of the sales tax you paid this year was on receipts that were mostly food for resale. With a resale certificate, many states let you buy ingredients tax-free.</div>` : ''}`;
    App.ui.table(body.querySelector('#stT'), [
      { key: 'label', label: 'Period' }, { key: 'gross', label: 'Gross sales', num: true, fmt: (v, r) => r.hasData ? fmt.money(v) : '<span class="muted">no data</span>' },
      { key: 'taxable', label: 'Taxable', num: true, fmt: v => fmt.money(v) }, { key: 'tax', label: 'Est. tax', num: true, fmt: v => fmt.money(v, 2) },
      { key: 'due', label: 'Due' }, { key: 'status', label: 'Status', fmt: (v, r) => r.status ? badge(r) : '' },
      { key: 'paid', label: 'Paid', num: true, fmt: v => v == null ? '—' : fmt.money(v, 2) },
      { key: 'diff', label: 'Paid vs est.', num: true, fmt: v => v == null ? '—' : `<span style="color:var(${Math.abs(v) < 1 ? '--good' : '--warn'})">${v >= 0 ? '+' : ''}${fmt.money(v, 2)}</span>` },
      { key: 'dkey', label: '', fmt: (v, r) => `<button class="btn small" data-mark="${v}">${r.done ? 'View' : 'Mark filed'}</button>` }
    ], rows, { limit: 20 });
    body.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => markFiled(ds.find(d => d.key === b.dataset.mark)));
    body.querySelectorAll('[data-tabgo]').forEach(b => b.onclick = () => { tab = b.dataset.tabgo; App.go('compliance'); });
    App.ui.chart('stC', 'bar', { labels: rows.map(r => r.label), datasets: [{ label: 'Estimated', data: rows.map(r => +r.tax.toFixed(2)) }, { label: 'Paid', data: rows.map(r => r.paid ?? 0), color: '#10b981' }] });
  }

  /* ---------- Payroll ---------- */
  async function payroll(body) {
    const S = C().setup(), pr = await C().payroll(year), ds = await C().deadlines(year);
    if (!S.hasEmployees) { body.innerHTML = App.ui.empty('Your setup says this business has no employees.', '<button class="btn" data-tabgo="setup">Change setup</button>'); body.querySelector('[data-tabgo]').onclick = () => { tab = 'setup'; App.go('compliance'); }; return; }
    if (!pr.total) { body.innerHTML = App.ui.empty('No labor data found. Upload a Harri timesheet or type hours in via Data Library → New table → Labor hours.', '<a class="btn primary" data-go="library">Add labor data</a>'); return; }
    body.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Gross wages ' + year, fmt.money(pr.total.wages), `${pr.total.employees} employees`)}
        ${App.ui.kpi('Social Security (employer 6.2%)', fmt.money(pr.total.ss, 2), `wage base ${fmt.money(C().ssBase(year))}`)}
        ${App.ui.kpi('Medicare (employer 1.45%)', fmt.money(pr.total.medicare, 2), '')}
        ${App.ui.kpi('FUTA (est.)', fmt.money(pr.total.futa, 2), `${S.futaRate}% on first $7,000/employee`)}
        ${App.ui.kpi('State unemployment (est.)', fmt.money(pr.total.suta, 2), `${S.sutaRate}% on first ${fmt.money(+S.sutaBase)}`)}
        ${App.ui.kpi('Total employer tax (est.)', fmt.money(pr.total.employerTax, 2), fmt.pct(pr.total.employerTax / pr.total.wages) + ' of wages')}
      </div>
      <div class="card"><div class="card-head"><h2>By quarter (Form 941)</h2><span class="muted small">from ${esc(pr.source)}</span></div><div id="prT"></div>
        <div class="muted tiny" style="margin-top:8px">Employer share only. Employee withholding (income tax, their 7.65% FICA) and deposit schedules come from your payroll provider, whose figures are authoritative. FUTA credit is reduced in "credit reduction" states (e.g. California); adjust the FUTA rate in Setup.</div></div>`;
    const rows = pr.quarters.map(q => { const d = ds.find(x => x.key === `941:${year}Q${q.q}`); return { ...q, due: d?.due, status: d?.status, days: d?.days, done: d?.done, dkey: d?.key }; });
    App.ui.table(body.querySelector('#prT'), [
      { key: 'label', label: 'Quarter' }, { key: 'employees', label: 'Employees', num: true }, { key: 'wages', label: 'Wages', num: true, fmt: v => fmt.money(v) },
      { key: 'ss', label: 'Soc. Sec.', num: true, fmt: v => fmt.money(v, 2) }, { key: 'medicare', label: 'Medicare', num: true, fmt: v => fmt.money(v, 2) },
      { key: 'futa', label: 'FUTA', num: true, fmt: v => fmt.money(v, 2) }, { key: 'suta', label: 'SUTA', num: true, fmt: v => fmt.money(v, 2) },
      { key: 'employerTax', label: 'Employer total', num: true, fmt: v => `<b>${fmt.money(v, 2)}</b>` },
      { key: 'due', label: '941 due' }, { key: 'status', label: 'Status', fmt: (v, r) => r.status ? badge(r) : '' },
      { key: 'dkey', label: '', fmt: (v, r) => v ? `<button class="btn small" data-mark="${v}">${r.done ? 'View' : 'Mark filed'}</button>` : '' }
    ], rows, { limit: 10 });
    body.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => markFiled(ds.find(d => d.key === b.dataset.mark)));
  }

  /* ---------- 1099 contractors ---------- */
  async function contractors(body) {
    const list = await C().contractors(year), th = C().threshold1099(year);
    const cpay = App.bsettings.get('cmp.cpay', []).filter(p => p.date.startsWith(String(year)));
    const st = { file: ['bad', 'File 1099'], 'file-no-w9': ['bad', 'File 1099 · need W-9'], below: ['', `Under ${fmt.money(th)}`], 'below-no-w9': ['warn', 'Get W-9'], review: ['warn', 'Review'], none: ['', 'Not required'] };
    body.innerHTML = `
      <div class="alert small" style="background:var(--accent-soft)">For ${year}, a 1099-NEC is generally required for an unincorporated contractor (person, LLC, partnership) paid <b>${fmt.money(th)}+</b> for services${year >= 2026 ? ' (up from $600 for 2025 and earlier)' : ''}. Payments by credit/debit card or PayPal-type apps are left out: the card processor reports those on a 1099-K. Corporations are usually exempt, except attorneys. Collect a <b>W-9</b> before you pay.</div>
      <div class="card"><div class="card-head"><h2>Vendors &amp; contractors paid in ${year}</h2><div class="row"><button class="btn small primary" id="cpAdd">${App.fx.icon('plus')} Record contractor payment</button><button class="btn small" id="cpCsv">${App.fx.icon('download')} 1099 CSV</button></div></div>
        <div id="cpT"></div><div class="muted tiny" style="margin-top:8px">Tick "Needs 1099" for service providers. Suppliers of goods (Costco, Sysco) don't get 1099s.</div></div>
      <div class="card"><div class="card-head"><h2>Contractor payments recorded here</h2></div><div id="cpL"></div></div>`;
    App.ui.table(body.querySelector('#cpT'), [
      { key: 'name', label: 'Vendor' }, { key: 'paid', label: 'Paid (cash/check/ACH)', num: true, fmt: v => fmt.money(v, 2) },
      { key: 'card', label: 'Paid by card (excluded)', num: true, fmt: v => v ? `<span class="muted">${fmt.money(v, 2)}</span>` : '—' },
      { key: 'needs', label: 'Needs 1099', fmt: (v, r) => `<input type="checkbox" data-n="${esc(r.key)}" ${v ? 'checked' : ''}>${r.suggest ? ' <span class="badge warn">likely</span>' : ''}` },
      { key: 'w9', label: 'W-9 on file', fmt: (v, r) => `<input type="checkbox" data-w="${esc(r.key)}" ${v ? 'checked' : ''} ${r.needs ? '' : 'disabled'}>` },
      { key: 'form', label: 'Form', fmt: (v, r) => `<select data-f="${esc(r.key)}" ${r.needs ? '' : 'disabled'}>${App.ui.options(['NEC', 'MISC'], v)}</select>` },
      { key: 'tin', label: 'TIN (last 4)', fmt: (v, r) => `<input data-t="${esc(r.key)}" value="${esc(v)}" maxlength="4" style="width:70px" ${r.needs ? '' : 'disabled'}>` },
      { key: 'status', label: 'Status', fmt: v => `<span class="badge ${st[v][0]}">${st[v][1]}</span>` }
    ], list, { limit: 300 });
    const save = (k, patch, label) => { const v = App.bsettings.get('cmp.vendors', {}); v[k] = { ...(v[k] || {}), ...patch }; App.bsettings.set('cmp.vendors', v); C().audit('1099 vendor updated', `${list.find(x => x.key === k)?.name}: ${label}`); };
    body.querySelectorAll('[data-n]').forEach(c => c.onchange = () => { save(c.dataset.n, { needs1099: c.checked }, c.checked ? 'needs 1099' : 'no 1099'); App.go('compliance'); });
    body.querySelectorAll('[data-w]').forEach(c => c.onchange = () => { save(c.dataset.w, { w9: c.checked }, c.checked ? 'W-9 on file' : 'W-9 missing'); App.go('compliance'); });
    body.querySelectorAll('[data-f]').forEach(c => c.onchange = () => save(c.dataset.f, { form: c.value }, 'form ' + c.value));
    body.querySelectorAll('[data-t]').forEach(c => c.onchange = () => save(c.dataset.t, { tin: c.value.replace(/\D/g, '').slice(0, 4) }, 'TIN updated'));
    App.ui.table(body.querySelector('#cpL'), [
      { key: 'date', label: 'Date' }, { key: 'vendor', label: 'Paid to' }, { key: 'amount', label: 'Amount', num: true, fmt: v => fmt.money(+v, 2) },
      { key: 'method', label: 'Method' }, { key: 'memo', label: 'For' }, { key: 'id', label: '', fmt: v => `<button class="btn ghost small" data-rm="${v}">Delete</button>` }
    ], cpay, { limit: 300 });
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const all = App.bsettings.get('cmp.cpay', []); const p = all.find(x => x.id === b.dataset.rm); App.bsettings.set('cmp.cpay', all.filter(x => x.id !== b.dataset.rm)); C().audit('Contractor payment deleted', `${p?.vendor} ${fmt.money(+p?.amount, 2)} ${p?.date}`); App.go('compliance'); });
    body.querySelector('#cpCsv').onclick = () => App.download(`1099-${year}.csv`, App.toCSV(['Vendor', 'Form', 'Amount', 'W9', 'TIN last 4', 'Status'], list.filter(c => c.needs).map(c => ({ Vendor: c.name, Form: '1099-' + c.form, Amount: c.paid.toFixed(2), W9: c.w9 ? 'Yes' : 'No', 'TIN last 4': c.tin, Status: st[c.status][1] }))));
    body.querySelector('#cpAdd').onclick = () => App.ui.modal(`<div class="card-head"><h2>Record contractor payment</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="stack"><div class="mapper">
        <label>Paid to<input id="pV" list="pVL" placeholder="e.g. Sparkle Cleaning Services"><datalist id="pVL">${list.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></label>
        <label>Date<input type="date" id="pD" value="${new Date().toISOString().slice(0, 10)}"></label>
        <label>Amount<input type="number" step="0.01" id="pA"></label>
        <label>Paid by<select id="pM">${App.ui.options(['Check', 'ACH / bank transfer', 'Cash', 'Zelle', 'Credit card (excluded)', 'PayPal / Venmo business (excluded)'], 'Check')}</select></label>
      </div><label class="field">For (service)<input id="pF" placeholder="e.g. Hood cleaning, plumbing repair, bookkeeping"></label>
      <label class="row small"><input type="checkbox" id="pN" checked> This vendor needs a 1099</label>
      <div class="row"><button class="btn primary" id="pS">Save payment</button></div></div>`, (card, close) => {
      card.querySelector('#pS').onclick = () => {
        const v = card.querySelector('#pV').value.trim(), a = +card.querySelector('#pA').value;
        if (!v || !a) return App.ui.toast('Add who you paid and the amount');
        const all = App.bsettings.get('cmp.cpay', []); all.push({ id: App.uid(), vendor: v, date: card.querySelector('#pD').value, amount: a, method: card.querySelector('#pM').value, memo: card.querySelector('#pF').value.trim() }); App.bsettings.set('cmp.cpay', all);
        if (card.querySelector('#pN').checked) { const vend = App.bsettings.get('cmp.vendors', {}); const k = App.purchasing.norm(v); vend[k] = { ...(vend[k] || {}), needs1099: true }; App.bsettings.set('cmp.vendors', vend); }
        C().audit('Contractor payment recorded', `${v} ${fmt.money(a, 2)} (${card.querySelector('#pM').value})`); close(); App.go('compliance');
      };
    });
  }

  /* ---------- Licenses & permits ---------- */
  async function licenses(body) {
    const lic = App.bsettings.get('cmp.licenses', []);
    const rows = lic.map(l => ({ ...l, st: C().licenseStatus(l) })).sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
    const have = new Set(lic.map(l => l.type || l.name));
    body.innerHTML = `
      <div class="card"><div class="card-head"><h2>Licenses, permits, certifications &amp; insurance</h2><button class="btn small primary" id="lcAdd">${App.fx.icon('plus')} Add</button></div>
        <div id="lcT"></div></div>
      <div class="card"><div class="card-head"><h2>Commonly required</h2><span class="muted small">click to add</span></div>
        <div class="row">${C().LICENSE_TEMPLATES.filter(([n]) => !have.has(n)).map(([n]) => `<button class="btn small" data-tpl="${esc(n)}">${App.fx.icon('plus')} ${esc(n)}</button>`).join('')}</div>
        <div class="muted tiny" style="margin-top:8px">Requirements vary by city, county and state. Check with your local licensing office and health department.</div></div>`;
    App.ui.table(body.querySelector('#lcT'), [
      { key: 'name', label: 'Name', fmt: (v, r) => `<a data-ed="${r.id}">${esc(v)}</a>${r.holder ? `<div class="muted tiny">${esc(r.holder)}</div>` : ''}` },
      { key: 'number', label: 'Number' }, { key: 'issuer', label: 'Issued by' }, { key: 'expires', label: 'Expires', fmt: v => v || '—' },
      { key: 'st', label: 'Status', fmt: v => `<span class="badge ${v.tone}">${esc(v.label)}</span>` },
      { key: 'cost', label: 'Renewal cost', num: true, fmt: v => v ? fmt.money(+v, 2) : '—' },
      { key: 'fileId', label: 'Copy', fmt: (v, r) => v ? `<a data-doc="${v}">📎 view</a>` : '<span class="badge warn">missing</span>' }
    ], rows, { limit: 200 });
    body.querySelectorAll('[data-ed]').forEach(a => a.onclick = () => editLicense(lic.find(l => l.id === a.dataset.ed)));
    body.querySelectorAll('[data-doc]').forEach(a => a.onclick = async () => { const f = await App.store.get('files', a.dataset.doc); if (f?.blob) window.open(URL.createObjectURL(f.blob), '_blank'); else App.ui.toast('File not found'); });
    body.querySelector('#lcAdd').onclick = () => editLicense(null);
    body.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => editLicense({ name: b.dataset.tpl, type: b.dataset.tpl }));
  }

  function editLicense(l) {
    const isNew = !l?.id;
    l = { id: App.uid(), name: '', ...l };
    const months = (C().LICENSE_TEMPLATES.find(([n]) => n === l.type) || [])[1];
    App.ui.modal(`<div class="card-head"><h2>${isNew ? 'Add' : 'Edit'} license / permit</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="stack"><div class="mapper">
        <label>Name<input id="lN" value="${esc(l.name)}"></label>
        <label>Number<input id="lNum" value="${esc(l.number || '')}"></label>
        <label>Issued by<input id="lI" value="${esc(l.issuer || '')}" placeholder="City, county health dept, state ABC…"></label>
        <label>Holder / person<input id="lH" value="${esc(l.holder || '')}" placeholder="for certifications"></label>
        <label>Issued<input type="date" id="lIs" value="${esc(l.issued || '')}"></label>
        <label>Expires${months ? ` <span class="tiny">(usually every ${months >= 12 ? months / 12 + ' yr' : months + ' mo'})</span>` : ''}<input type="date" id="lE" value="${esc(l.expires || '')}"></label>
        <label>Renewal cost<input type="number" step="0.01" id="lC" value="${esc(l.cost || '')}"></label>
      </div><label class="field">Notes<input id="lNo" value="${esc(l.notes || '')}"></label>
      <div class="row"><label class="btn small">${App.fx.icon('upload')} ${l.fileId ? 'Replace' : 'Attach'} copy<input type="file" id="lF" hidden></label><span class="muted tiny" id="lFn">${l.fileName ? '📎 ' + esc(l.fileName) : ''}</span></div>
      <div class="row spread"><button class="btn primary" id="lS">Save</button>${isNew ? '' : '<button class="btn danger" id="lD">Delete</button>'}</div></div>`, (card, close) => {
      const $ = s => card.querySelector(s);
      let file = null;
      $('#lF').onchange = e => { file = e.target.files[0]; $('#lFn').textContent = file ? '📎 ' + file.name : ''; };
      $('#lIs').onchange = () => { if (months && !$('#lE').value && $('#lIs').value) { const d = new Date($('#lIs').value + 'T00:00:00'); d.setMonth(d.getMonth() + months); $('#lE').value = d.toISOString().slice(0, 10); } };
      $('#lS').onclick = async () => {
        Object.assign(l, { name: $('#lN').value.trim() || 'License', number: $('#lNum').value.trim(), issuer: $('#lI').value.trim(), holder: $('#lH').value.trim(), issued: $('#lIs').value, expires: $('#lE').value, cost: $('#lC').value, notes: $('#lNo').value.trim() });
        if (file) { const [f] = await App.ingest.ingestMany([file], { category: 'report', tags: ['Compliance', l.name] }); if (f) { l.fileId = f.id; l.fileName = f.name; } }
        const all = App.bsettings.get('cmp.licenses', []).filter(x => x.id !== l.id); all.push(l); App.bsettings.set('cmp.licenses', all);
        C().audit(isNew ? 'License added' : 'License updated', `${l.name}${l.number ? ' #' + l.number : ''}${l.expires ? ', expires ' + l.expires : ''}`);
        close(); App.go('compliance');
      };
      $('#lD')?.addEventListener('click', async () => { if (!await App.confirm({ title: `Delete ${l.name || 'this license'}?`, body: 'Renewal reminders stop and the record leaves your compliance file. The deletion is noted in the audit log.', ok: 'Delete license', cancel: 'Keep license', danger: true })) return; App.bsettings.set('cmp.licenses', App.bsettings.get('cmp.licenses', []).filter(x => x.id !== l.id)); C().audit('License deleted', l.name); close(); App.go('compliance'); });
    });
  }

  /* ---------- Records & audit log ---------- */
  async function records(body) {
    const log = App.bsettings.get('cmp.log', []);
    const ps = await App.store.all('purchases');
    const noDoc = ps.filter(p => !p.attachment);
    body.innerHTML = `
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>How long to keep records</h2><span class="muted small">IRS general guidance</span></div>
          <div class="table-wrap"><table><tbody>${C().RETENTION.map(([a, b]) => `<tr><td style="white-space:normal">${esc(a)}</td><td style="white-space:normal"><b>${esc(b)}</b></td></tr>`).join('')}</tbody></table></div>
          <div class="muted tiny" style="margin-top:8px">Many owners simply keep everything 7 years. Use Settings → Export backup each year and store it somewhere safe.</div></div>
        <div class="card"><div class="card-head"><h2>Documentation gaps</h2></div>
          <div class="stack">
            <div class="row spread"><span>Receipts without a photo or scan</span><a data-go="purchases"><span class="badge ${noDoc.length ? 'warn' : 'good'}">${noDoc.length} of ${ps.length}</span></a></div>
            ${noDoc.slice(0, 8).map(p => `<div class="row spread small muted"><span>${esc(p.date)} · ${esc(p.vendor)}</span><span>${fmt.money(App.purchasing.totals(p).computed, 2)}</span></div>`).join('')}
          </div></div>
      </div>
      <div class="card"><div class="card-head"><h2>Activity log</h2><div class="row"><input type="search" id="lgQ" placeholder="Filter…"><button class="btn small" id="lgCsv">${App.fx.icon('download')} CSV</button></div></div>
        <div class="muted small" style="margin:-6px 0 10px">An automatic record of receipt changes, filings, license updates and 1099 decisions in this business. Entries can't be edited.</div><div id="lgT"></div></div>`;
    const draw = q => App.ui.table(body.querySelector('#lgT'), [
      { key: 'at', label: 'When', fmt: v => new Date(v).toLocaleString() }, { key: 'action', label: 'Action' }, { key: 'detail', label: 'Details', fmt: v => `<span style="white-space:normal">${esc(v)}</span>` }
    ], q ? log.filter(e => (e.action + ' ' + e.detail).toLowerCase().includes(q.toLowerCase())) : log, { limit: 500 });
    draw('');
    body.querySelector('#lgQ').oninput = e => draw(e.target.value);
    body.querySelector('#lgCsv').onclick = () => App.download('activity-log.csv', App.toCSV(['when', 'action', 'detail'], log.map(e => ({ when: new Date(e.at).toISOString(), action: e.action, detail: e.detail }))));
  }

  /* ---------- Setup ---------- */
  async function setup(body) {
    const S = C().setup();
    body.innerHTML = `<div class="card stack"><h2>Tax profile: ${esc(App.biz.get(App.biz.current()).name)}</h2>
      <div class="mapper">
        <label>Business type<select id="sE">${App.ui.options(Object.entries(C().ENTITIES).map(([value, label]) => ({ value, label })), S.entity)}</select></label>
        <label>State<input id="sSt" value="${esc(S.state)}" placeholder="e.g. WA" maxlength="2" style="text-transform:uppercase"></label>
        <label>EIN (last 4, optional)<input id="sEin" value="${esc(S.ein)}" maxlength="4"></label>
      </div>
      <h3>Sales tax</h3>
      <div class="mapper">
        <label>Combined rate (state + local) %<input type="number" step="0.001" id="sR" value="${S.salesTaxRate}"></label>
        <label>Share of sales that's taxable %<input type="number" step="1" id="sTs" value="${S.taxableShare}"></label>
        <label>Filing frequency<select id="sF">${App.ui.options([{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annual', label: 'Annually' }], S.salesFreq)}</select></label>
        <label>Due day of following month<input type="number" min="1" max="28" id="sDd" value="${S.salesDueDay}"></label>
      </div>
      <label class="row small"><input type="checkbox" id="sInc" ${S.salesIncludesTax ? 'checked' : ''}> My sales figures already include sales tax</label>
      <h3>Payroll</h3>
      <label class="row small"><input type="checkbox" id="sEmp" ${S.hasEmployees ? 'checked' : ''}> This business has W-2 employees</label>
      <div class="mapper">
        <label>FUTA net rate %<input type="number" step="0.1" id="sFu" value="${S.futaRate}"></label>
        <label>State unemployment (SUTA) rate %<input type="number" step="0.01" id="sSu" value="${S.sutaRate}"></label>
        <label>SUTA wage base $<input type="number" step="1" id="sSb" value="${S.sutaBase}"></label>
      </div>
      <label class="row small"><input type="checkbox" id="s8027" ${S.tipped8027 ? 'checked' : ''}> Food/beverage business with tipped employees and more than 10 employees (Form 8027)</label>
      <h3>Income tax</h3>
      <label class="row small"><input type="checkbox" id="sEst" ${S.estimatedTaxes ? 'checked' : ''}> I make quarterly estimated tax payments</label>
      <div class="row"><button class="btn primary" id="sSave">Save tax profile</button></div>
      <div class="muted tiny">Your state's sales tax rate, filing frequency and due day are on your sales tax permit or state revenue website. SUTA rate and wage base are on your state unemployment notice.</div></div>`;
    body.querySelector('#sSave').onclick = () => {
      const g = id => body.querySelector(id);
      const next = { entity: g('#sE').value, state: g('#sSt').value.toUpperCase(), ein: g('#sEin').value.replace(/\D/g, ''), salesTaxRate: +g('#sR').value, taxableShare: +g('#sTs').value, salesFreq: g('#sF').value, salesDueDay: +g('#sDd').value || 20, salesIncludesTax: g('#sInc').checked, hasEmployees: g('#sEmp').checked, futaRate: +g('#sFu').value, sutaRate: +g('#sSu').value, sutaBase: +g('#sSb').value, tipped8027: g('#s8027').checked, estimatedTaxes: g('#sEst').checked };
      App.bsettings.set('cmp.setup', next);
      C().audit('Tax profile saved', `${C().ENTITIES[next.entity]}, ${next.state || 'no state'}, sales tax ${next.salesTaxRate}% ${next.salesFreq}`);
      App.ui.toast('Tax profile saved'); tab = 'overview'; App.go('compliance');
    };
  }

  /* ---------- Accountant workbook (one Excel file, a sheet per topic) ---------- */
  async function workbook() {
    const [st, pr, cons, all, pt] = await Promise.all([C().salesTax(year), C().payroll(year), C().contractors(year), C().deadlines(year), C().purchaseTax(year)]);
    const ps = (await App.store.all('purchases')).filter(p => p.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
    const S = C().setup(), biz = App.biz.get(App.biz.current());
    const wb = XLSX.utils.book_new();
    const sheet = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No data' }]), name);
    sheet('Summary', [
      { Item: 'Business', Value: biz.name }, { Item: 'Tax year', Value: year }, { Item: 'Entity', Value: C().ENTITIES[S.entity] }, { Item: 'State', Value: S.state },
      { Item: 'Gross sales', Value: +App.sum(st.periods.map(p => p.gross)).toFixed(2) }, { Item: 'Est. sales tax due', Value: +App.sum(st.periods.map(p => p.tax)).toFixed(2) },
      { Item: 'Food purchases', Value: +(pt.byGroup.food || 0).toFixed(2) }, { Item: 'Beverage & alcohol purchases', Value: +((pt.byGroup.beverage || 0) + (pt.byGroup.alcohol || 0)).toFixed(2) },
      { Item: 'Supplies & other purchases', Value: +((pt.byGroup.supplies || 0) + (pt.byGroup.other || 0)).toFixed(2) }, { Item: 'Personal items excluded', Value: +(pt.byGroup.excluded || 0).toFixed(2) },
      { Item: 'Sales tax paid on purchases', Value: +pt.tax.toFixed(2) }, { Item: 'Gross wages', Value: pr.total ? +pr.total.wages.toFixed(2) : '' },
      { Item: 'Est. employer payroll taxes', Value: pr.total ? +pr.total.employerTax.toFixed(2) : '' }, { Item: 'Generated', Value: new Date().toLocaleString() },
      { Item: 'Note', Value: 'Estimates from Ops Command Desk data. Verify against filed returns and payroll reports.' }
    ]);
    sheet('Sales tax', st.periods.map(p => ({ Period: p.label, 'Gross sales': +p.gross.toFixed(2), Taxable: +p.taxable.toFixed(2), 'Est. tax': +p.tax.toFixed(2), Due: p.due })));
    sheet('Payroll', pr.quarters.map(q => ({ Quarter: q.label, Employees: q.employees, Wages: +q.wages.toFixed(2), 'Social Security (employer)': +q.ss.toFixed(2), 'Medicare (employer)': +q.medicare.toFixed(2), FUTA: +q.futa.toFixed(2), SUTA: +q.suta.toFixed(2) })));
    sheet('1099', cons.filter(c => c.needs).map(c => ({ Vendor: c.name, Form: '1099-' + c.form, 'Paid (non-card)': +c.paid.toFixed(2), 'Paid by card (excluded)': +c.card.toFixed(2), 'W-9 on file': c.w9 ? 'Yes' : 'No', 'TIN last 4': c.tin })));
    sheet('Purchases', ps.flatMap(p => p.lines.map(l => ({ Date: p.date, Vendor: p.vendor, Item: l.item, Category: App.purchasing.CAT[l.cat]?.label || '', Group: App.purchasing.GROUPS[App.purchasing.CAT[l.cat]?.group] || '', Amount: +l.amount, 'Paid with': p.payment, 'Receipt #': p.ref || '', 'Photo on file': p.attachment ? 'Yes' : 'No' }))));
    sheet('Receipts', ps.map(p => { const t = App.purchasing.totals(p); return { Date: p.date, Vendor: p.vendor, Business: +t.business.toFixed(2), Personal: +(t.groups.excluded || 0).toFixed(2), Tax: +t.tax.toFixed(2), Total: +(p.total || t.computed).toFixed(2), 'Paid with': p.payment, 'Owed to owner': p.reimburse ? 'Yes' : '' }; }));
    sheet('Filings', all.map(d => ({ Due: d.due, Obligation: d.title, Type: d.cat, 'Est. amount': d.amount != null ? +d.amount.toFixed(2) : '', Filed: d.done?.date || '', 'Amount paid': d.done?.amount ?? '', Confirmation: d.done?.confirmation || '', 'Filed by': d.done?.by || '' })));
    sheet('Licenses', App.bsettings.get('cmp.licenses', []).map(l => ({ Name: l.name, Number: l.number, 'Issued by': l.issuer, Holder: l.holder, Issued: l.issued, Expires: l.expires, Status: C().licenseStatus(l).label, 'Copy on file': l.fileId ? 'Yes' : 'No' })));
    sheet('Activity log', App.bsettings.get('cmp.log', []).map(e => ({ When: new Date(e.at).toLocaleString(), Action: e.action, Details: e.detail })));
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    App.download(`${biz.name.replace(/[^\w\- ]/g, '')} ${year} tax & compliance.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    C().audit('Accountant workbook exported', `${year}`);
  }

  App.complianceWorkbook = workbook;
})(window.App);
