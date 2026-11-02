/* Tax & compliance engine: deadlines, sales/payroll tax estimates, 1099 tally, licenses, audit log, readiness score.
   US federal rules as of tax year 2026. Everything is an estimate for tracking. Owners confirm with their CPA / payroll provider. */
(function (App) {
  const { n0 } = App;

  /* ---------- Setup ---------- */
  const DEFAULT_SETUP = {
    entity: 'llc-single', state: '', ein: '', salesTaxRate: 8.25, taxableShare: 100, salesIncludesTax: false,
    salesFreq: 'monthly', salesDueDay: 20, hasEmployees: true, futaRate: 0.6, sutaRate: 2.7, sutaBase: 7000,
    estimatedTaxes: true, tipped8027: false
  };
  const ENTITIES = {
    'sole': 'Sole proprietorship', 'llc-single': 'Single-member LLC', 'partnership': 'Partnership / multi-member LLC',
    'scorp': 'S corporation', 'ccorp': 'C corporation'
  };
  const setup = () => ({ ...DEFAULT_SETUP, ...App.bsettings.get('cmp.setup', {}) });
  const isSetUp = () => !!App.bsettings.get('cmp.setup', null);

  /* ---------- Audit log (append-only, per business) ---------- */
  function audit(action, detail = '', bizId) {
    const write = () => {
      const log = App.bsettings.get('cmp.log', []);
      log.unshift({ at: Date.now(), action, detail: String(detail).slice(0, 300) });
      App.bsettings.set('cmp.log', log.slice(0, 3000));
    };
    bizId ? App.biz.withBiz(bizId, write) : write();
  }

  /* ---------- Dates ---------- */
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const ymd = (y, m, d) => new Date(y, m - 1, d);
  /* Federal rule: a deadline on Saturday/Sunday moves to the next business day (holidays not modeled) */
  function bizDay(d) { const x = new Date(d); const w = x.getDay(); if (w === 6) x.setDate(x.getDate() + 2); if (w === 0) x.setDate(x.getDate() + 1); return x; }
  const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const daysUntil = s => Math.round((new Date(s + 'T00:00:00') - today()) / 864e5);

  /* 1099-NEC/MISC threshold: $600 through 2025; $2,000 for payments made in 2026 (OBBBA §70433), indexed from 2027 */
  const threshold1099 = y => App.bsettings.get('cmp.threshold.' + y, null) ?? (y <= 2025 ? 600 : 2000);
  const SS_WAGE_BASE = { 2024: 168600, 2025: 176100, 2026: 184500 };
  const ssBase = y => SS_WAGE_BASE[y] || SS_WAGE_BASE[2026];

  /* ---------- Data sources ---------- */
  async function salesSource() {
    let saved = App.bsettings.get('map.ops-sales', {});
    if (!saved.ds) {
      for (const d of (await App.store.datasets()).filter(d => !d.live && ['operations', 'financial'].includes(d.category))) {
        const sales = App.findCol(d.headers, ['net sales', 'sales', 'gross sales']);
        const date = App.findCol(d.headers, ['business date', 'date', 'day']);
        if (sales && date && !/^month$/i.test(date)) { saved = { ds: d.id, map: { sales, date } }; break; }
      }
    }
    const d = saved.ds && await App.store.get('datasets', saved.ds);
    if (!d || !saved.map?.sales || !saved.map?.date) return null;
    return { name: d.name, rows: d.rows.map(r => ({ date: App.dateKey(r[saved.map.date]), sales: n0(r[saved.map.sales]) })).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date)) };
  }

  async function laborSource() {
    let saved = App.bsettings.get('map.ops-labor', {});
    let d = saved.ds && await App.store.get('datasets', saved.ds);
    let m = saved.map || {};
    if (!d) {
      for (const c of (await App.store.datasets()).filter(x => !x.live && ['operations', 'personnel'].includes(x.category))) {
        const hours = App.findCol(c.headers, ['total hours', 'actual hours', 'hours', 'regular hours']);
        const date = App.findCol(c.headers, ['date', 'business date', 'shift date', 'week']);
        const cost = App.findCol(c.headers, ['labor cost', 'total pay', 'gross pay', 'wages']);
        const rate = App.findCol(c.headers, ['pay rate', 'rate', 'hourly rate']);
        if (hours && date && (cost || rate)) { d = c; m = { hours, date, cost, rate, ot: App.findCol(c.headers, ['overtime hours', 'overtime', 'ot hours']), emp: App.findCol(c.headers, ['employee', 'employee name', 'name']) }; break; }
      }
    }
    if (!d || !m.hours || !m.date) return null;
    return {
      name: d.name,
      rows: d.rows.map(r => {
        const hours = n0(r[m.hours]), ot = m.ot ? n0(r[m.ot]) : 0;
        const wages = m.cost ? n0(r[m.cost]) : (m.rate ? n0(r[m.rate]) * (hours + 0.5 * ot) : 0);
        return { date: App.dateKey(r[m.date]), emp: m.emp ? String(r[m.emp] || '') : '', wages };
      }).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    };
  }

  /* ---------- Sales tax ---------- */
  function salesPeriods(year, freq) {
    if (freq === 'annual') return [{ key: `${year}`, label: `${year}`, from: `${year}-01-01`, to: `${year}-12-31`, endMonth: 12, endYear: year }];
    if (freq === 'quarterly') return [1, 2, 3, 4].map(q => ({ key: `${year}-Q${q}`, label: `Q${q} ${year}`, from: iso(ymd(year, q * 3 - 2, 1)), to: iso(ymd(year, q * 3 + 1, 0)), endMonth: q * 3, endYear: year }));
    return Array.from({ length: 12 }, (_, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, label: ymd(year, i + 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' }), from: iso(ymd(year, i + 1, 1)), to: iso(ymd(year, i + 2, 0)), endMonth: i + 1, endYear: year }));
  }
  async function salesTax(year) {
    const S = setup(), src = await salesSource();
    const rate = (+S.salesTaxRate || 0) / 100, share = (+S.taxableShare || 0) / 100;
    return { source: src?.name || '', periods: salesPeriods(year, S.salesFreq).map(p => {
      const gross = src ? App.sum(src.rows.filter(r => r.date >= p.from && r.date <= p.to).map(r => r.sales)) : 0;
      const taxable = gross * share;
      const tax = S.salesIncludesTax ? taxable * rate / (1 + rate) : taxable * rate;
      const due = iso(bizDay(ymd(p.endMonth === 12 ? p.endYear + 1 : p.endYear, p.endMonth === 12 ? 1 : p.endMonth + 1, Math.min(28, +S.salesDueDay || 20))));
      return { ...p, gross, taxable, tax, due, hasData: gross > 0 };
    }) };
  }

  /* ---------- Payroll tax estimates (employer side) ---------- */
  async function payroll(year) {
    const S = setup(), src = await laborSource();
    const quarters = [1, 2, 3, 4].map(q => ({ q, label: `Q${q} ${year}`, from: iso(ymd(year, q * 3 - 2, 1)), to: iso(ymd(year, q * 3 + 1, 0)), wages: 0, ss: 0, medicare: 0, futa: 0, suta: 0, emps: new Set() }));
    if (!src) return { source: '', quarters, total: null };
    const ytd = {}; // per-employee cumulative wages for wage-base caps
    for (const r of src.rows.filter(r => r.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date))) {
      const q = quarters[Math.floor((+r.date.slice(5, 7) - 1) / 3)];
      const e = r.emp || '(unnamed)';
      const before = ytd[e] || 0, after = before + r.wages; ytd[e] = after;
      const under = (base) => Math.max(0, Math.min(after, base) - Math.min(before, base));
      q.wages += r.wages; q.emps.add(e);
      q.ss += under(ssBase(year)) * 0.062;
      q.medicare += r.wages * 0.0145;
      q.futa += under(7000) * (+S.futaRate || 0) / 100;
      q.suta += under(+S.sutaBase || 7000) * (+S.sutaRate || 0) / 100;
    }
    quarters.forEach(q => { q.employees = q.emps.size; delete q.emps; q.employerTax = q.ss + q.medicare + q.futa + q.suta; });
    const sumk = k => App.sum(quarters.map(q => q[k]));
    return { source: src.name, quarters, total: { wages: sumk('wages'), ss: sumk('ss'), medicare: sumk('medicare'), futa: sumk('futa'), suta: sumk('suta'), employerTax: sumk('employerTax'), employees: Object.keys(ytd).length } };
  }

  /* ---------- 1099 contractors ---------- */
  const SERVICE_HINT = /clean|janitor|plumb|electric|hvac|repair|maint|landscap|lawn|pest|exterminat|consult|account|bookkeep|cpa|law|legal|attorney|design|photograph|marketing|agency|dj\b|band|music|security|window|hood clean|grease|handyman|contractor|services?\b|llc/i;
  const CARD_RE = /card|credit|debit|paypal|venmo|stripe|square|cash app/i;
  async function contractors(year) {
    const vend = App.bsettings.get('cmp.vendors', {});
    const manual = App.bsettings.get('cmp.cpay', []).filter(p => p.date.startsWith(String(year)));
    const purchases = (await App.store.all('purchases')).filter(p => p.date.startsWith(String(year)));
    const by = {};
    const add = (name, amt, method, src) => {
      const k = App.purchasing.norm(name); if (!k) return;
      const v = by[k] = by[k] || { key: k, name, paid: 0, card: 0, count: 0, sources: new Set() };
      if (CARD_RE.test(method || '')) v.card += amt; else v.paid += amt;
      v.count++; v.sources.add(src);
    };
    purchases.forEach(p => add(p.vendor, App.purchasing.totals(p).business + (+p.tax || 0), p.payment, 'Purchases'));
    manual.forEach(p => add(p.vendor, +p.amount || 0, p.method, 'Contractor payments'));
    const th = threshold1099(year);
    return Object.values(by).map(v => {
      const info = vend[v.key] || {};
      const needs = info.needs1099 ?? false;
      const suggest = info.needs1099 === undefined && SERVICE_HINT.test(v.name) && !/costco|sysco|us foods|restaurant depot|sam'?s|walmart|amazon|gordon/i.test(v.name);
      const status = !needs ? (suggest ? 'review' : 'none') : v.paid >= th ? (info.w9 ? 'file' : 'file-no-w9') : (info.w9 ? 'below' : 'below-no-w9');
      return { ...v, sources: [...v.sources].join(', '), needs, w9: !!info.w9, form: info.form || 'NEC', tin: info.tin || '', suggest, status, threshold: th };
    }).sort((a, b) => (b.needs - a.needs) || b.paid - a.paid);
  }

  /* ---------- Licenses & permits ---------- */
  const LICENSE_TEMPLATES = [
    ['Business license', 12], ['Food service / health permit', 12], ["Seller's permit (sales tax)", 0], ['Liquor license', 12],
    ['Food manager certification (ServSafe)', 60], ['Food handler cards', 36], ['Certificate of occupancy', 0], ['Fire inspection', 12],
    ['General liability insurance', 12], ["Workers' comp insurance", 12], ['Liquor liability insurance', 12], ['Music licensing (ASCAP/BMI)', 12],
    ['Commercial lease', 0], ['Sign permit', 12]
  ];
  function licenseStatus(l) {
    if (!l.expires) return { k: 'noexp', label: 'No expiry', tone: '' };
    const d = daysUntil(l.expires);
    if (d < 0) return { k: 'expired', label: `Expired ${-d} day${d === -1 ? '' : 's'} ago`, tone: 'bad', d };
    if (d <= 60) return { k: 'soon', label: `Expires in ${d} day${d === 1 ? '' : 's'}`, tone: 'warn', d };
    return { k: 'ok', label: 'Current', tone: 'good', d };
  }

  /* ---------- Deadlines ---------- */
  async function deadlines(year) {
    const S = setup(), done = App.bsettings.get('cmp.done', {});
    const out = [];
    const add = (key, title, due, cat, extra = {}) => out.push({ key, title, due: typeof due === 'string' ? due : iso(bizDay(due)), cat, ...extra, done: done[key] || null });
    const st = await salesTax(year);
    st.periods.forEach(p => add(`sales:${p.key}`, `Sales tax return: ${p.label}`, p.due, 'Sales tax', { amount: p.hasData ? p.tax : null, period: p.label }));
    if (S.hasEmployees) {
      [[1, ymd(year, 4, 30)], [2, ymd(year, 7, 31)], [3, ymd(year, 10, 31)], [4, ymd(year + 1, 1, 31)]].forEach(([q, d]) => add(`941:${year}Q${q}`, `Form 941: Q${q} ${year} payroll taxes`, d, 'Payroll'));
      add(`940:${year}`, `Form 940: ${year} federal unemployment (FUTA)`, ymd(year + 1, 1, 31), 'Payroll');
      add(`w2:${year}`, `W-2s to employees + W-3 to SSA (${year})`, ymd(year + 1, 1, 31), 'Payroll');
      if (S.tipped8027) add(`8027:${year}`, `Form 8027: tip income report (${year}, e-file)`, ymd(year + 1, 3, 31), 'Payroll');
    }
    add(`1099nec:${year}`, `1099-NEC to contractors + IRS (${year})`, ymd(year + 1, 1, 31), '1099');
    add(`1099misc:${year}`, `1099-MISC e-file to IRS (${year}, if any)`, ymd(year + 1, 3, 31), '1099');
    if (S.estimatedTaxes) {
      const est = S.entity === 'ccorp' ? [ymd(year, 4, 15), ymd(year, 6, 15), ymd(year, 9, 15), ymd(year, 12, 15)] : [ymd(year, 4, 15), ymd(year, 6, 15), ymd(year, 9, 15), ymd(year + 1, 1, 15)];
      est.forEach((d, i) => add(`est:${year}Q${i + 1}`, `Estimated income tax: ${year} payment ${i + 1}${S.entity === 'ccorp' ? ' (Form 1120-W)' : ' (Form 1040-ES)'}`, d, 'Income tax'));
    }
    const ret = { sole: ['Schedule C with Form 1040', ymd(year + 1, 4, 15)], 'llc-single': ['Schedule C with Form 1040', ymd(year + 1, 4, 15)], partnership: ['Form 1065 + K-1s', ymd(year + 1, 3, 15)], scorp: ['Form 1120-S + K-1s', ymd(year + 1, 3, 15)], ccorp: ['Form 1120', ymd(year + 1, 4, 15)] }[S.entity];
    if (ret) add(`return:${year}`, `${year} business income tax return: ${ret[0]}`, ret[1], 'Income tax');
    for (const l of App.bsettings.get('cmp.licenses', [])) {
      if (!l.expires || !l.expires.startsWith(String(year))) continue;
      add(`lic:${l.id}:${l.expires}`, `Renew: ${l.name}${l.number ? ' #' + l.number : ''}`, l.expires, 'License', { license: l.id });
    }
    for (const c of App.bsettings.get('cmp.custom', [])) {
      let dd = c.date;
      if (c.yearly) dd = `${year}${c.date.slice(4)}`;
      if (!dd.startsWith(String(year))) continue;
      add(`custom:${c.id}:${year}`, c.title, iso(bizDay(new Date(dd + 'T00:00:00'))), c.cat || 'State & local', { custom: c.id, note: c.note });
    }
    return out.map(d => ({ ...d, days: daysUntil(d.due), status: d.done ? 'done' : daysUntil(d.due) < 0 ? 'overdue' : daysUntil(d.due) <= 14 ? 'soon' : 'upcoming' })).sort((a, b) => a.due.localeCompare(b.due));
  }
  /* Deadlines across tax years that fall due near today (prior-year forms are due early next year) */
  async function upcoming(windowDays = 60) {
    const y = today().getFullYear();
    const all = [...await deadlines(y - 1), ...await deadlines(y)];
    return all.filter(d => !d.done && d.days <= windowDays && d.days >= -365).sort((a, b) => a.due.localeCompare(b.due));
  }

  /* ---------- Audit readiness ---------- */
  async function readiness(year) {
    const items = [], parts = [];
    const purchases = (await App.store.all('purchases')).filter(p => p.date.startsWith(String(year)));
    if (purchases.length) {
      const withDoc = purchases.filter(p => p.attachment).length;
      const ok = purchases.filter(p => !p.total || Math.abs(App.purchasing.totals(p).diff) < 0.02).length;
      parts.push(['Receipts with a photo/scan on file', withDoc / purchases.length, `${withDoc} of ${purchases.length}`, 'purchases']);
      parts.push(['Receipts that reconcile to their total', ok / purchases.length, `${ok} of ${purchases.length}`, 'purchases']);
      if (withDoc < purchases.length) items.push(['warn', `${purchases.length - withDoc} receipts have no photo or scan attached. The IRS expects documentation for business expenses.`, 'purchases']);
      if (ok < purchases.length) items.push(['warn', `${purchases.length - ok} receipts don't add up to their printed total`, 'purchases']);
    }
    const ds = (await deadlines(year)).concat(await deadlines(year - 1)).filter(d => d.days < 0);
    if (ds.length) {
      const filed = ds.filter(d => d.done).length;
      parts.push(['Past-due filings marked as filed', filed / ds.length, `${filed} of ${ds.length}`, 'calendar']);
      ds.filter(d => !d.done).slice(0, 6).forEach(d => items.push(['bad', `Not marked filed: ${d.title} (was due ${d.due})`, 'calendar']));
    }
    const lic = App.bsettings.get('cmp.licenses', []);
    if (lic.length) {
      const cur = lic.filter(l => licenseStatus(l).k !== 'expired').length;
      parts.push(['Licenses & permits current', cur / lic.length, `${cur} of ${lic.length}`, 'licenses']);
      lic.filter(l => licenseStatus(l).k === 'expired').forEach(l => items.push(['bad', `${l.name} is expired (${l.expires})`, 'licenses']));
      lic.filter(l => licenseStatus(l).k === 'soon').forEach(l => items.push(['warn', `${l.name} expires ${l.expires}`, 'licenses']));
      const docs = lic.filter(l => l.fileId).length;
      parts.push(['Licenses with a copy on file', docs / lic.length, `${docs} of ${lic.length}`, 'licenses']);
    }
    const cons = (await contractors(year)).filter(c => c.needs);
    if (cons.length) {
      const w9 = cons.filter(c => c.w9).length;
      parts.push(['Contractors with a W-9 on file', w9 / cons.length, `${w9} of ${cons.length}`, '1099']);
      cons.filter(c => !c.w9).forEach(c => items.push(['warn', `Get a W-9 from ${c.name} (paid ${App.fmt.money(c.paid)} in ${year})`, '1099']));
    }
    const review = (await contractors(year)).filter(c => c.suggest);
    review.slice(0, 4).forEach(c => items.push(['warn', `Does ${c.name} need a 1099? Looks like a service provider (${App.fmt.money(c.paid)} paid)`, '1099']));
    const emp = await employeeDocs();
    if (emp) {
      parts.push(['Employees with I-9 and W-4 on file', emp.complete / Math.max(1, emp.total), `${emp.complete} of ${emp.total}`, 'personnel']);
      if (emp.missing.length) items.push(['warn', `${emp.missing.length} active employees are missing an I-9 or W-4 in their personnel file (e.g. ${emp.missing.slice(0, 3).join(', ')})`, 'personnel']);
    }
    const score = parts.length ? App.mean(parts.map(p => p[1])) : NaN;
    return { score, parts, items };
  }

  /* Employee I-9 / W-4 check: personnel files are tagged with the employee's name */
  async function employeeDocs() {
    const roster = (await App.store.datasets()).find(d => d.category === 'personnel' && App.findCol(d.headers, ['employee name', 'employee', 'name']) && App.findCol(d.headers, ['hire date', 'status', 'position']));
    if (!roster) return null;
    const nameCol = App.findCol(roster.headers, ['employee name', 'employee', 'name']);
    const statusCol = App.findCol(roster.headers, ['status']);
    const termCol = App.findCol(roster.headers, ['termination date', 'term date']);
    const active = roster.rows.filter(r => !(statusCol && /term|inactive|former/i.test(r[statusCol])) && !(termCol && r[termCol])).map(r => String(r[nameCol] || '').trim()).filter(Boolean);
    const files = await App.store.files();
    const has = (name, re) => files.some(f => (f.tags || []).some(t => t.toLowerCase() === name.toLowerCase()) && re.test(f.name));
    const missing = active.filter(n => !(has(n, /i-?9/i) && has(n, /w-?4/i)));
    return { total: active.length, complete: active.length - missing.length, missing };
  }

  /* ---------- Purchases tax summary + resale certificate hint ---------- */
  async function purchaseTax(year) {
    const ps = (await App.store.all('purchases')).filter(p => p.date.startsWith(String(year)));
    let tax = 0, foodHeavyTax = 0;
    const byGroup = {};
    for (const p of ps) {
      const t = App.purchasing.totals(p);
      tax += t.tax;
      Object.entries(t.groups).forEach(([g, v]) => byGroup[g] = (byGroup[g] || 0) + v);
      if (t.tax > 0 && t.business > 0 && t.food / t.business > 0.6) foodHeavyTax += t.tax * (t.food / t.sub);
    }
    return { tax, byGroup, foodHeavyTax, receipts: ps.length };
  }

  const RETENTION = [
    ['Income tax returns & supporting records (receipts, invoices, bank statements)', '3 years from filing (6 if income was under-reported by 25%+, indefinitely if no return was filed)'],
    ['Employment tax records (payroll, W-4s, timesheets, tip reports)', 'At least 4 years after the tax is due or paid'],
    ['Form I-9', '3 years after hire or 1 year after employment ends, whichever is later'],
    ['Records for assets & equipment (purchase, depreciation)', 'Until 3 years after you dispose of the asset'],
    ['Sales tax records', 'Varies by state, commonly 3–4 years. Check your state'],
    ['Licenses, permits, leases, insurance policies', 'Life of the license/contract + 3 years']
  ];

  App.compliance = { DEFAULT_SETUP, ENTITIES, LICENSE_TEMPLATES, RETENTION, setup, isSetUp, audit, salesTax, payroll, contractors, licenseStatus, deadlines, upcoming, readiness, purchaseTax, threshold1099, ssBase, daysUntil };
})(window.App);
