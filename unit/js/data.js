/* Unit data: the businesses (units) you run, their daily sales & labor, food cost gaps and purchases.
   Reads what the Ops Command Desk importers stored (CrunchTime, Harri, POS exports, purchase journals).
   When no unit has data yet, a demo set of units is generated in memory (never saved). */
(function (UC) {
  const S = {
    get: (k, d) => App.settings.get('uc.' + k, d),
    set: (k, v) => App.settings.set('uc.' + k, v)
  };
  UC.S = S;
  UC.TARGETS_DEFAULT = { laborPct: 28, forecastMiss: 5, otHours: 8, splh: 50, schedVar: 5, primeCost: 60, avtGap: 1.5, trendDrop: 8 };
  UC.targets = () => ({ ...UC.TARGETS_DEFAULT, ...S.get('targets', {}) });

  const COL = {
    date: ['Date', 'Business Date', 'Day', 'Sales Date', 'Transaction Date'],
    sales: ['Net Sales', 'Net sales', 'Sales', 'Net Revenue', 'Total Net Sales', 'Gross Sales', 'Amount Collected'],
    forecast: ['Sales Forecast', 'Forecast', 'Projected Sales', 'Budget Sales'],
    labor: ['Labor Cost', 'Labor $', 'Total Labor', 'Labor Dollars', 'Wages'],
    hours: ['Actual Hours', 'Hours', 'Total Hours', 'Hours Worked', 'Regular Hours'],
    sched: ['Scheduled Hours', 'Forecast Hours', 'Sched Hours'],
    ot: ['Overtime Hours', 'OT Hours', 'Overtime'],
    guests: ['Guest Count', 'Guests', 'Transactions', 'Checks', 'Orders']
  };
  const pick = (headers, list) => App.findCol(headers, list);

  /* Merge every dated sales/labor table for one unit into one row per day */
  function normalize(datasets) {
    const days = new Map();
    const ordered = [...datasets].sort((a, b) => (b.rolling ? 1 : 0) - (a.rolling ? 1 : 0)); // rolling CrunchTime table wins
    for (const ds of ordered) {
      const h = ds.headers || [];
      const c = Object.fromEntries(Object.entries(COL).map(([k, l]) => [k, pick(h, l)]));
      if (!c.date || !(c.sales || c.labor || c.hours)) continue;
      for (const r of ds.rows || []) {
        const d = App.toDate(r[c.date]); if (!d || isNaN(d)) continue;
        const key = App.dateKey(d);
        const row = days.get(key) || { date: key };
        const set = (k, v) => { const n = App.num(v); if (!isNaN(n) && row[k] === undefined) row[k] = n; };
        for (const k of ['sales', 'forecast', 'labor', 'hours', 'sched', 'ot', 'guests']) if (c[k]) set(k, r[c[k]]);
        days.set(key, row);
      }
    }
    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ---------- demo units (in memory only) ---------- */
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function demo() {
    const defs = [
      ['demo-1', 'Downtown', '#6366f1', 5200, 0.265, 1], ['demo-2', 'Northgate', '#10b981', 4300, 0.292, 2],
      ['demo-3', 'Lakeside', '#f59e0b', 3600, 0.318, 3], ['demo-4', 'Airport (new)', '#ec4899', 2400, 0.34, 4, 30]
    ];
    const today = new Date(); today.setHours(12, 0, 0, 0);
    return defs.map(([id, name, color, base, lp, seed, ageDays = 70]) => {
      const r = rng(seed * 7919), rows = [];
      for (let i = Math.min(ageDays, 70); i >= 1; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const dow = d.getDay(), wk = [0.82, 0.78, 0.86, 0.95, 1.12, 1.32, 1.15][dow];
        const ramp = ageDays < 70 ? Math.min(1, 0.6 + (ageDays - i) / ageDays * 0.5) : 1;
        const fc = base * wk * ramp;
        const sales = fc * (0.9 + r() * 0.18) * (id === 'demo-3' && i < 10 ? 0.9 : 1);
        const hours = sales / (55 + r() * 12 - (id === 'demo-3' ? 8 : 0));
        const sched = hours * (0.94 + r() * 0.06);
        const labor = sales * (lp + (r() - 0.5) * 0.03);
        const ot = id === 'demo-2' && i < 6 ? 2 + r() * 3 : r() < 0.15 ? r() * 2 : 0;
        rows.push({ date: App.dateKey(d), sales: +sales.toFixed(2), forecast: +fc.toFixed(2), labor: +labor.toFixed(2), hours: +hours.toFixed(1), sched: +sched.toFixed(1), ot: +ot.toFixed(1), guests: Math.round(sales / 14.5) });
      }
      return { id, name: 'Demo · ' + name, color, type: 'restaurant', demo: true, days: rows,
        avt: { gapPts: id === 'demo-3' ? 2.4 : id === 'demo-1' ? 0.8 : 1.2 }, purchases: rows.reduce((a, x) => a + x.sales * (0.29 + (seed % 3) * 0.01), 0) * 28 / rows.length };
    });
  }

  /* All units with their data. { units, demo } */
  async function load() {
    const biz = App.biz.list().filter(b => !b.archived && App.biz.kindOf(b) === 'business');
    const datasets = await App.store.all('datasets', { raw: true }).catch(() => []);
    const purchases = await App.store.all('purchases', { raw: true }).catch(() => []);
    const units = biz.map(b => {
      const mine = datasets.filter(d => App.biz.idOf(d) === b.id);
      const avtDs = mine.filter(d => d.meta?.kind === 'avt').sort((a, c) => (c.meta.to || '').localeCompare(a.meta.to || ''))[0];
      const days = normalize(mine);
      const since = days.length ? days[Math.max(0, days.length - 28)].date : '';
      const buys = purchases.filter(p => App.biz.idOf(p) === b.id && !p.sample);
      return { id: b.id, name: b.name, color: b.color, type: b.type, days, avt: avtDs ? { gapPts: avtDs.meta.gapPts, overspend: avtDs.meta.overspend, to: avtDs.meta.to } : null,
        purchases: buys.filter(p => !since || (p.date || '') >= since).reduce((a, p) => a + (+p.total || 0), 0), purchaseList: buys };
    });
    const withData = units.filter(u => u.days.length);
    const forceDemo = S.get('demo', null);
    const useDemo = forceDemo === true || (forceDemo !== false && !withData.length);
    return useDemo ? { units: demo(), demo: true, real: units } : { units: withData, demo: false, real: units, empty: units.filter(u => !u.days.length) };
  }

  /* ---------- math ---------- */
  const sum = (rows, k) => rows.reduce((a, r) => a + (+r[k] || 0), 0);
  function stats(rows) {
    const sales = sum(rows, 'sales'), fc = sum(rows, 'forecast'), labor = sum(rows, 'labor'), hours = sum(rows, 'hours'), sched = sum(rows, 'sched');
    return { days: rows.length, sales, forecast: fc, vsFc: fc ? (sales - fc) / fc : NaN, labor, laborPct: sales ? labor / sales : NaN, hours, sched, schedVar: sched ? (hours - sched) / sched : NaN,
      ot: sum(rows, 'ot'), splh: hours ? sales / hours : NaN, guests: sum(rows, 'guests') };
  }
  const lastDate = units => units.reduce((m, u) => u.days.length && u.days[u.days.length - 1].date > m ? u.days[u.days.length - 1].date : m, '');
  function windowRows(u, end, n) {
    if (!end) return [];
    const e = new Date(end + 'T12:00'), s = new Date(e); s.setDate(s.getDate() - n + 1);
    const from = App.dateKey(s);
    return u.days.filter(r => r.date >= from && r.date <= end);
  }
  function weekStart(end) { const e = new Date(end + 'T12:00'); const dow = (e.getDay() + 6) % 7; e.setDate(e.getDate() - dow); return App.dateKey(e); }
  const wtd = (u, end) => u.days.filter(r => r.date >= weekStart(end) && r.date <= end);
  function prior(u, end, n) { const e = new Date(end + 'T12:00'); e.setDate(e.getDate() - n); return windowRows(u, App.dateKey(e), n); }

  UC.data = { load, stats, lastDate, windowRows, wtd, prior, weekStart, normalize };
})(window.UC);
