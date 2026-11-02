/* Deterministic sample data in each source system's export shape — for demos and testing */
(function (App) {
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  const csv = rows => rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
  const d = (base, add) => { const x = new Date(base); x.setDate(x.getDate() + add); return x.toISOString().slice(0, 10); };

  function build() {
    const r = rng(42);
    const out = {};
    const locs = ['Downtown', 'Midtown', 'Airport'];
    const start = '2026-10-01';

    /* Financial P&L — 12 months */
    const pnl = [['Month', 'Revenue', 'COGS', 'Labor', 'Operating Expenses', 'Other Expenses', 'Budget']];
    for (let m = 0; m < 12; m++) {
      const rev = Math.round(410000 + m * 9000 + (r() - 0.4) * 60000 + (m === 7 ? -70000 : 0));
      pnl.push([`2025-${String(m + 1).padStart(2, '0')}`, rev, Math.round(rev * (0.29 + r() * 0.04)), Math.round(rev * (0.27 + r() * 0.05)),
        Math.round(85000 + r() * 15000), Math.round(12000 + r() * 6000), Math.round(430000 + m * 9000)]);
    }
    out['financial-pnl-2025.csv'] = csv(pnl);

    const ledger = [['Date', 'Account', 'Category', 'Amount']];
    const cats = [['Rent', 28000], ['Utilities', 9500], ['Marketing', 14000], ['Software', 4200], ['Insurance', 6100], ['Repairs & Maintenance', 7400], ['Professional Fees', 5200], ['Supplies', 8800], ['Travel', 2100]];
    for (let m = 1; m <= 6; m++) cats.forEach(([c, base], i) => ledger.push([`2026-${String(m).padStart(2, '0')}-15`, 6000 + i * 10, c, Math.round(base * (0.85 + r() * 0.3))]));
    out['expense-ledger-h1.csv'] = csv(ledger);

    /* Harri timesheet — 14 days x 3 locations */
    const staff = [];
    const positions = [['Server', 14.5], ['Line Cook', 18], ['Host', 13], ['Dishwasher', 14], ['Bartender', 15], ['Shift Manager', 24]];
    const first = ['Ava', 'Liam', 'Noah', 'Mia', 'Ethan', 'Sofia', 'Lucas', 'Chloe', 'Mason', 'Zoe', 'Jack', 'Lily', 'Owen', 'Ella', 'Leo', 'Nora', 'Eli', 'Ruby', 'Kai', 'Ivy', 'Max', 'Aria', 'Sam', 'Jade'];
    const last = ['Garcia', 'Smith', 'Nguyen', 'Patel', 'Johnson', 'Lee', 'Brown', 'Davis', 'Lopez', 'Kim', 'Martin', 'Clark'];
    for (let i = 0; i < 36; i++) {
      const [pos, rate] = positions[i % positions.length];
      staff.push({ id: 1000 + i, name: `${first[i % first.length]} ${last[(i * 7) % last.length]}`, loc: locs[i % 3], pos, rate: +(rate + r() * 3).toFixed(2) });
    }
    const ts = [['Employee', 'Employee ID', 'Location', 'Position', 'Date', 'Scheduled Hours', 'Total Hours', 'Overtime Hours', 'Pay Rate', 'Labor Cost']];
    for (let day = 0; day < 14; day++) {
      staff.forEach(s => {
        if (r() < 0.3) return;
        const sched = [5, 6, 7, 8][Math.floor(r() * 4)];
        const hrs = +(sched + (r() - 0.35) * 1.5).toFixed(2);
        const ot = s.loc === 'Airport' && r() < 0.25 ? +(r() * 2).toFixed(2) : 0;
        ts.push([s.name, s.id, s.loc, s.pos, d(start, day), sched, hrs, ot, s.rate, +((hrs + ot * 0.5) * s.rate).toFixed(2)]);
      });
    }
    out['harri-timesheet-oct.csv'] = csv(ts);

    /* Harri roster */
    const roster = [['Employee Name', 'Employee ID', 'Position', 'Department', 'Location', 'Hire Date', 'Termination Date', 'Status', 'Employment Type', 'Pay Rate', 'Email', 'Phone', 'Manager']];
    staff.forEach((s, i) => roster.push([s.name, s.id, s.pos, s.pos.includes('Cook') || s.pos === 'Dishwasher' ? 'Back of House' : s.pos === 'Shift Manager' ? 'Management' : 'Front of House',
      s.loc, d('2019-03-01', Math.floor(r() * 2400)), '', 'Active', r() < 0.6 ? 'Part-Time' : 'Full-Time', s.rate,
      i % 9 === 4 ? '' : `${s.name.toLowerCase().replace(' ', '.')}@example.com`, `555-01${String(i).padStart(2, '0')}`, 'Jordan Reyes']));
    for (let i = 0; i < 10; i++) {
      const hire = d('2025-06-01', Math.floor(r() * 300));
      roster.push([`${first[(i + 5) % first.length]} ${last[(i + 3) % last.length]}`, 2000 + i, positions[i % 6][0], 'Front of House', locs[i % 3], hire, d(hire, 20 + Math.floor(r() * 200)), 'Terminated', 'Part-Time', 14, '', '', 'Jordan Reyes']);
    }
    out['harri-employee-roster.csv'] = csv(roster);

    /* CrunchTime daily sales */
    const sales = [['Business Date', 'Location', 'Net Sales', 'Guest Count', 'Food Cost', 'Theoretical Cost']];
    for (let day = 0; day < 14; day++) locs.forEach((l, i) => {
      const ns = Math.round((2900 + i * 650) * (new Date(d(start, day)).getDay() >= 5 ? 1.35 : 1) * (0.85 + r() * 0.3));
      const theo = ns * 0.285;
      sales.push([d(start, day), l, ns, Math.round(ns / (24 + r() * 6)), Math.round(theo * (1.01 + r() * (l === 'Midtown' ? 0.12 : 0.04))), Math.round(theo)]);
    });
    out['crunchtime-daily-sales.csv'] = csv(sales);

    const items = [['Chicken Breast', 3.2], ['Ground Beef', 4.1], ['Salmon Fillet', 9.5], ['Romaine', 1.4], ['Avocado', 1.1], ['Cheddar', 3.6], ['Brioche Bun', 0.55], ['Fries', 0.9], ['Ribeye', 14.2], ['Shrimp', 8.8], ['Tomato', 0.6], ['Bacon', 5.4], ['Draft Beer (oz)', 0.12], ['House Wine (btl)', 7.5]];
    const avt = [['Item', 'Count Unit', 'Unit Cost', 'Theoretical Usage', 'Actual Usage', 'Variance $']];
    items.forEach(([it, uc]) => { const th = Math.round(200 + r() * 800); const ac = Math.round(th * (0.96 + r() * (it === 'Ribeye' || it === 'Shrimp' ? 0.18 : 0.07))); avt.push([it, 'EA', uc, th, ac, +((ac - th) * uc).toFixed(2)]); });
    out['crunchtime-avt-inventory.csv'] = csv(avt);

    /* Webull positions */
    const pos = [['Symbol', 'Name', 'Quantity', 'Avg Cost', 'Last Price', 'Mkt Value', 'Unrealized P&L', 'Sector']];
    [['NVDA', 'NVIDIA', 120, 98.4, 141.2, 'Technology'], ['AAPL', 'Apple', 80, 182.1, 228.5, 'Technology'], ['MSFT', 'Microsoft', 40, 395, 431.8, 'Technology'],
      ['JPM', 'JPMorgan', 50, 205, 238.9, 'Financials'], ['XOM', 'Exxon Mobil', 70, 118.4, 109.2, 'Energy'], ['COST', 'Costco', 12, 820, 915.4, 'Consumer Staples'],
      ['TSLA', 'Tesla', 35, 262, 219.7, 'Consumer Discretionary'], ['SPY', 'SPDR S&P 500', 25, 540, 582.3, 'ETF'], ['PLTR', 'Palantir', 300, 28.5, 61.2, 'Technology']]
      .forEach(([s, n, q, a, l, sec]) => pos.push([s, n, q, a, l, +(q * l).toFixed(2), +(q * (l - a)).toFixed(2), sec]));
    out['webull-positions.csv'] = csv(pos);

    /* Webull order history — FIFO round trips */
    const ord = [['Name', 'Symbol', 'Side', 'Status', 'Filled', 'Total Qty', 'Price', 'Avg Price', 'Time-in-Force', 'Placed Time', 'Filled Time']];
    const syms = [['AMD', 150], ['META', 520], ['NFLX', 640], ['SHOP', 72], ['UBER', 68], ['COIN', 210], ['SOFI', 9], ['CRWD', 310]];
    for (let k = 0; k < 46; k++) {
      const [s, base] = syms[Math.floor(r() * syms.length)];
      const q = Math.max(1, Math.round(4000 / base));
      const entry = +(base * (0.9 + r() * 0.2)).toFixed(2);
      const edge = r() < 0.55 ? 1 : -1;
      const exit = +(entry * (1 + edge * (0.01 + r() * (edge > 0 ? 0.06 : 0.08)))).toFixed(2);
      const day = Math.floor(k * 1.6);
      const t1 = `${d('2026-07-01', day)} 09:${String(30 + Math.floor(r() * 29)).padStart(2, '0')}:00`;
      const t2 = `${d('2026-07-01', day + 1 + Math.floor(r() * 2))} 15:${String(10 + Math.floor(r() * 40)).padStart(2, '0')}:00`;
      ord.push([s, s, 'Buy', 'Filled', q, q, entry, entry, 'DAY', t1, t1]);
      ord.push([s, s, 'Sell', 'Filled', q, q, exit, exit, 'DAY', t2, t2]);
      if (r() < 0.1) ord.push([s, s, 'Buy', 'Cancelled', 0, q, entry, '', 'GTC', t1, '']);
    }
    out['webull-orders-history.csv'] = csv(ord);

    /* Dub copy-trading portfolio */
    const dub = [['Portfolio', 'Symbol', 'Quantity', 'Avg Cost', 'Last Price', 'Market Value', 'Sector']];
    [['Tech Momentum', 'NVDA', 18, 120.5, 141.2, 'Technology'], ['Tech Momentum', 'AVGO', 10, 160, 171.3, 'Technology'], ['Tech Momentum', 'PLTR', 60, 41, 61.2, 'Technology'],
      ['Dividend Core', 'KO', 40, 61.2, 70.1, 'Consumer Staples'], ['Dividend Core', 'JNJ', 15, 152, 159.4, 'Health Care'], ['Dividend Core', 'O', 30, 55.6, 57.9, 'Real Estate'],
      ['Macro Hedge', 'GLD', 12, 221, 248.6, 'Commodities'], ['Macro Hedge', 'TLT', 25, 94, 91.2, 'Bonds']]
      .forEach(([p, s, q, a, l, sec]) => dub.push([p, s, q, a, l, +(q * l).toFixed(2), sec]));
    out['dub-portfolio-holdings.csv'] = csv(dub);

    /* Marketing campaigns */
    const mk = [['Date', 'Campaign', 'Channel', 'Spend', 'Impressions', 'Clicks', 'Leads', 'Conversions', 'Revenue']];
    const camps = [['Fall Menu Launch', 'Meta Ads', 3.8], ['Brand Search', 'Google Search', 6.5], ['Catering Leads', 'Google Search', 2.6], ['Happy Hour Promo', 'Instagram', 2.1],
      ['Loyalty Reactivation', 'Email', 11], ['Local Awareness', 'TikTok', 0.7], ['Delivery Push', 'DoorDash Ads', 2.9]];
    for (let w = 0; w < 8; w++) camps.forEach(([c, ch, roas]) => {
      const sp = Math.round((ch === 'Email' ? 300 : 1200) * (0.7 + r() * 0.6));
      const imp = Math.round(sp * (ch === 'Email' ? 40 : 90 + r() * 60));
      const cl = Math.round(imp * (0.008 + r() * 0.02));
      const conv = c === 'Local Awareness' && w % 3 === 0 ? 0 : Math.round(cl * (0.02 + r() * 0.05));
      mk.push([d('2026-08-03', w * 7), c, ch, sp, imp, cl, Math.round(cl * 0.08), conv, Math.round(sp * roas * (0.7 + r() * 0.6))]);
    });
    out['marketing-campaigns.csv'] = csv(mk);

    out['anara-research-delivery-pricing.md'] = `# Third-party delivery pricing study

**Question:** Should we raise in-app menu prices on delivery platforms to offset commissions?

## Sources
- Platform commission schedules (2026)
- Competitor menu scrape — 14 nearby restaurants
- Internal CrunchTime sales mix, Aug–Oct

## Findings
1. 11 of 14 competitors price delivery menus 12–20% above dine-in.
2. Delivery is 18% of net sales; average commission + fees = 27%.
3. Price-sensitive items (kids, sides) show highest elasticity.

## Next steps
- Test +12% delivery pricing at Midtown for 4 weeks.
- Track order count and ticket size weekly in Marketing → Campaign performance.
`;
    return out;
  }

  async function load() {
    const files = Object.entries(build()).map(([name, text]) => new File([text], name, { type: name.endsWith('.md') ? 'text/markdown' : 'text/csv' }));
    await App.ingest.ingestMany(files, { tags: ['Sample'] });
    if (App.purchasing) await loadPurchases();
    if (App.compliance) await loadCompliance();
  }

  /* Sample tax profile, permits, contractors and filing history, with a few realistic problems to fix */
  async function loadCompliance() {
    const biz = App.biz.target();
    await App.biz.withBiz(biz, async () => {
      if (!App.bsettings.get('cmp.setup', null)) App.bsettings.set('cmp.setup', { ...App.compliance.DEFAULT_SETUP, entity: 'llc-single', state: 'WA', salesTaxRate: 10.25, salesFreq: 'monthly', salesDueDay: 25, sutaRate: 1.2, sutaBase: 72800, tipped8027: true, sample: true });
      const lic = App.bsettings.get('cmp.licenses', []);
      [['Business license', 'BL-604-22871', 'City of Seattle', '2026-12-31', ''], ['Food service / health permit', 'PR0071234', 'King County Public Health', '2026-11-20', ''],
       ['Liquor license', '421987', 'WA State Liquor & Cannabis Board', '2026-10-31', ''], ['Food manager certification (ServSafe)', 'SS-8834120', 'ServSafe / NRA', '2029-03-14', 'Jordan Reyes'],
       ['General liability insurance', 'GL-2210-993', 'The Hartford', '2027-04-01', ''], ["Workers' comp insurance", 'WA L&I 600-112-33', 'WA Labor & Industries', '2027-01-01', ''],
       ["Seller's permit (sales tax)", 'UBI 604 228 711', 'WA Dept. of Revenue', '', '']]
        .forEach(([name, number, issuer, expires, holder]) => lic.push({ id: App.uid(), name, type: name, number, issuer, expires, holder, sample: true, fileId: null }));
      App.bsettings.set('cmp.licenses', lic);
      const cp = App.bsettings.get('cmp.cpay', []);
      for (let m = 1; m <= 10; m++) cp.push({ id: App.uid(), vendor: 'Sparkle Cleaning Services', date: `2026-${String(m).padStart(2, '0')}-05`, amount: 650, method: 'Check', memo: 'Nightly kitchen cleaning', sample: true });
      cp.push({ id: App.uid(), vendor: "Joe's Plumbing", date: '2026-03-18', amount: 1450, method: 'Check', memo: 'Grease trap repair', sample: true });
      cp.push({ id: App.uid(), vendor: "Joe's Plumbing", date: '2026-08-02', amount: 820, method: 'ACH / bank transfer', memo: 'Water heater', sample: true });
      cp.push({ id: App.uid(), vendor: "Joe's Plumbing", date: '2026-09-14', amount: 450, method: 'Credit card (excluded)', memo: 'Drain clearing', sample: true });
      cp.push({ id: App.uid(), vendor: 'Hood Pros LLC', date: '2026-06-10', amount: 900, method: 'ACH / bank transfer', memo: 'Hood & duct cleaning', sample: true });
      App.bsettings.set('cmp.cpay', cp);
      const v = App.bsettings.get('cmp.vendors', {});
      v[App.purchasing.norm('Sparkle Cleaning Services')] = { needs1099: true, w9: true, form: 'NEC', tin: '4821' };
      v[App.purchasing.norm("Joe's Plumbing")] = { needs1099: true, w9: false, form: 'NEC' };
      App.bsettings.set('cmp.vendors', v);
      const custom = App.bsettings.get('cmp.custom', []);
      custom.push({ id: App.uid(), title: 'County health inspection window opens', date: '2026-12-08', cat: 'State & local', yearly: false, sample: true });
      custom.push({ id: App.uid(), title: 'WA annual reconciliation (if annual filer) / business license renewal', date: '2026-04-15', cat: 'State & local', yearly: true, sample: true });
      App.bsettings.set('cmp.custom', custom);
      // Filing history: everything already due is filed, except September sales tax (left overdue on purpose)
      const done = App.bsettings.get('cmp.done', {});
      const past = [...await App.compliance.deadlines(2025), ...await App.compliance.deadlines(2026)].filter(d => d.days < 0 && d.key !== 'sales:2026-09');
      past.forEach((d, i) => { if (!done[d.key]) done[d.key] = { date: d.due, amount: d.cat === 'Sales tax' ? 10800 + (i % 5) * 340 : d.cat === 'Payroll' && /941/.test(d.title) ? 18400 + (i % 3) * 610 : null, confirmation: 'CONF-' + (100000 + i * 7919), by: d.cat === 'Payroll' ? 'Payroll provider' : 'Owner', sample: true }; });
      App.bsettings.set('cmp.done', done);
      App.compliance.audit('Sample data loaded', 'Tax profile, licenses, contractor payments and filing history');
    });
  }

  /* Sample receipts in the same weeks as the sample sales, so food cost % works out of the box */
  async function loadPurchases() {
    const biz = App.biz.target();
    const L = (item, cat, qty, amount) => ({ item, cat, qty, amount });
    const receipts = [
      { date: '2026-10-02', vendor: 'Sysco', payment: 'Business checking', ref: 'INV-90117', tax: 0, lines: [L('Chicken Breast 40lb case', 'protein', 40, 3920), L('Ground Beef 80/20 10lb', 'protein', 60, 3120), L('Salmon Fillet 10lb', 'protein', 15, 1687.5), L('Romaine 24ct case', 'produce', 30, 1140), L('Roma Tomatoes 25lb', 'produce', 25, 800), L('Cheddar Shredded 5lb', 'dairy', 40, 840), L('Fries 6x5lb case', 'frozen', 30, 930), L('Dinner Napkins case', 'paper', 10, 450)] },
      { date: '2026-10-06', vendor: 'US Foods', payment: 'Business checking', ref: 'USF-55210', tax: 0, lines: [L('Ribeye Choice 12lb', 'protein', 20, 2877.6), L('Shrimp 16/20 5lb', 'protein', 30, 1349.7), L('Chicken Thighs 40lb case', 'protein', 25, 2050), L('Avocados 48ct case', 'produce', 20, 1240), L('Brioche Buns 48ct', 'bakery', 80, 1199.2), L('Flour AP 50lb', 'dry', 12, 299.4), L('Heavy Cream Qt', 'dairy', 40, 199.6), L('To-Go Containers 150ct', 'paper', 15, 479.85)] },
      { date: '2026-10-09', vendor: 'Sysco', payment: 'Business checking', ref: 'INV-90388', tax: 0, lines: [L('Chicken Breast 40lb case', 'protein', 40, 4160), L('Ground Beef 80/20 10lb', 'protein', 60, 3120), L('Salmon Fillet 10lb', 'protein', 15, 1770), L('Romaine 24ct case', 'produce', 30, 1230), L('Cheddar Shredded 5lb', 'dairy', 40, 840), L('Fries 6x5lb case', 'frozen', 30, 930), L('Eggs 15dz case', 'dairy', 20, 760)] },
      { date: '2026-10-13', vendor: 'US Foods', payment: 'Business checking', ref: 'USF-55897', tax: 0, lines: [L('Ribeye Choice 12lb', 'protein', 20, 3024), L('Shrimp 16/20 5lb', 'protein', 30, 1349.7), L('Chicken Thighs 40lb case', 'protein', 25, 2050), L('Avocados 48ct case', 'produce', 20, 1420), L('Brioche Buns 48ct', 'bakery', 80, 1199.2), L('House Wine case', 'alcohol', 10, 718.8), L('Sanitizer Quat Gal', 'cleaning', 6, 95.94)] },
      { date: '2026-10-02', vendor: 'Costco', payment: 'Business card', tax: 6.21, lines: [L('KS Chicken Breast', 'protein', 3, 71.97), L('Avocado Hass 6ct', 'produce', 4, 27.96), L('Romaine Hearts 6pk', 'produce', 3, 16.47), L('KS Large Eggs 60ct', 'dairy', 2, 31.98), L('KS Olive Oil 2L', 'dry', 1, 24.99), L('KS Paper Towels 12pk', 'paper', 1, 22.99), L('Nitrile Gloves L 200ct', 'paper', 2, 39.98), L('KS Water 40pk', 'bev', 2, 9.98)] },
      { date: '2026-10-05', vendor: 'Restaurant Depot', payment: 'Business checking', ref: 'RD-44821', tax: 0, lines: [L('Ribeye Choice 12lb', 'protein', 2, 287.76), L('Shrimp 16/20 5lb', 'protein', 2, 89.98), L('Fries 6x5lb', 'frozen', 2, 61.98), L('Brioche Buns 48ct', 'bakery', 3, 44.97), L('Cheddar Sliced 5lb', 'dairy', 2, 41.98), L('Foam To-Go Containers 150', 'paper', 2, 63.98)] },
      { date: '2026-10-09', vendor: 'Costco', payment: 'Personal card (owner paid)', reimburse: true, tax: 41.84, lines: [L('KS Chicken Breast', 'protein', 3, 77.97), L('Avocado Hass 6ct', 'produce', 4, 31.96), L('Tomatoes Roma 5lb', 'produce', 2, 13.98), L('Clorox Bleach 3pk', 'cleaning', 1, 12.99), L('Samsung 65" TV', 'personal', 1, 479.99), L('Instant savings', 'other', 1, -4.00)] },
      { date: '2026-10-12', vendor: 'Sysco', payment: 'Business checking', ref: 'INV-90233', tax: 0, lines: [L('Salmon Fillet 10lb', 'protein', 1, 112.50), L('Mixed Greens 3lb', 'produce', 4, 47.80), L('Heavy Cream Qt', 'dairy', 6, 29.94), L('Flour AP 50lb', 'dry', 1, 24.95), L('House Wine Case', 'alcohol', 2, 143.76), L('Sanitizer Quat Gal', 'cleaning', 2, 31.98)] }
    ];
    for (const r of receipts) {
      const sub = r.lines.reduce((a, l) => a + l.amount, 0);
      await App.store.put('purchases', { id: App.uid(), businessId: biz, sample: true, ref: '', notes: '', attachment: null, ...r, total: +(sub + r.tax).toFixed(2), created: Date.now(), updated: Date.now() });
      App.purchasing.remember(r.lines.filter(l => l.item !== 'Instant savings'), r.date);
    }
    await App.purchasing.syncDataset();
  }

  App.samples = { build, load };
})(typeof window !== 'undefined' ? (window.App = window.App || { modules: {} }) : (globalThis.App = { modules: {} }));
