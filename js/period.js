/* Reporting period: one picker in the top bar that every analysis page follows.
   Views: All time · Daily (date range) · Weekly · Monthly · Quarterly · Yearly · Fiscal year.
   Pages get only the rows inside the period, grouped into sensible sub-periods, plus the previous period for comparison. */
(function (App) {
  const VIEWS = { all: 'All time', day: 'Daily', week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Yearly', fy: 'Fiscal year' };
  /* Pages where the period applies */
  const ROUTES = ['dashboard', 'finance', 'purchases', 'operations', 'trading', 'marketing'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FULLMON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => iso(new Date());
  const md = s => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
  const mdy = s => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };

  /* Calendar settings per unit: fiscal year start month (1–12) and week start (1 = Monday, 0 = Sunday) */
  const cal = () => ({ fyStart: 1, weekStart: 1, ...App.bsettings.get('cal', {}) });
  const setCal = c => App.bsettings.set('cal', { ...cal(), ...c });

  let override = null;
  function state() {
    const s = { g: 'all', anchor: today(), from: '', to: '', ...(override || App.settings.get('period', {})) };
    if (!VIEWS[s.g]) s.g = 'all';
    return s;
  }
  function setState(patch) { App.settings.set('period', { ...state(), ...patch }); App.bus.emit('period-changed'); }

  /* [from, to] for a view anchored on a date */
  function bounds(g, anchor, st = {}) {
    const a = parse(anchor || today()), c = cal();
    if (g === 'day') {
      const to = st.to || today(), from = st.from || iso(addDays(parse(to), -29));
      return from <= to ? [from, to] : [to, from];
    }
    if (g === 'week') { const back = (a.getDay() - c.weekStart + 7) % 7; const s = addDays(a, -back); return [iso(s), iso(addDays(s, 6))]; }
    if (g === 'month') return [iso(new Date(a.getFullYear(), a.getMonth(), 1)), iso(new Date(a.getFullYear(), a.getMonth() + 1, 0))];
    if (g === 'quarter') { const q = Math.floor(a.getMonth() / 3); return [iso(new Date(a.getFullYear(), q * 3, 1)), iso(new Date(a.getFullYear(), q * 3 + 3, 0))]; }
    if (g === 'year') return [`${a.getFullYear()}-01-01`, `${a.getFullYear()}-12-31`];
    if (g === 'fy') { const s = c.fyStart - 1, y = a.getMonth() >= s ? a.getFullYear() : a.getFullYear() - 1; return [iso(new Date(y, s, 1)), iso(new Date(y + 1, s, 0))]; }
    return null;
  }

  /* Fiscal years are named by the calendar year they end in (FY2027 = Jul 2026 – Jun 2027) unless they start in January */
  function fyName(from) { const d = parse(from); return `FY${cal().fyStart === 1 ? d.getFullYear() : d.getFullYear() + 1}`; }

  function labelOf(g, from, to) {
    if (g === 'all') return 'All time';
    const f = parse(from);
    if (g === 'week') return `Week of ${md(from)} – ${md(to)}, ${parse(to).getFullYear()}`;
    if (g === 'month') return `${FULLMON[f.getMonth()]} ${f.getFullYear()}`;
    if (g === 'quarter') return `Q${Math.floor(f.getMonth() / 3) + 1} ${f.getFullYear()}`;
    if (g === 'year') return String(f.getFullYear());
    if (g === 'fy') return `${fyName(from)} (${MON[f.getMonth()]} ${f.getFullYear()} – ${MON[parse(to).getMonth()]} ${parse(to).getFullYear()})`;
    if (from === to) return mdy(from);
    return parse(from).getFullYear() === parse(to).getFullYear() ? `${md(from)} – ${mdy(to)}` : `${mdy(from)} – ${mdy(to)}`;
  }
  const shortLabel = (g, from, to) => (g === 'fy' ? fyName(from) : g === 'week' ? `Wk of ${md(from)}` : labelOf(g, from, to));

  /* The current period, its sub-period grouping and the previous period */
  function range() {
    const s = state();
    if (s.g === 'all') return { g: 'all', from: null, to: null, label: 'All time', short: 'All time', sub: null, prev: null };
    const [from, to] = bounds(s.g, s.anchor, s);
    const days = Math.round((parse(to) - parse(from)) / 864e5) + 1;
    const sub = s.g === 'week' || s.g === 'month' ? 'day' : s.g === 'quarter' ? 'week' : s.g === 'year' || s.g === 'fy' ? 'month' : days <= 62 ? 'day' : days <= 400 ? 'week' : 'month';
    let prev;
    if (s.g === 'day') { const pt = iso(addDays(parse(from), -1)); prev = [iso(addDays(parse(pt), -(days - 1))), pt]; }
    else prev = bounds(s.g, iso(addDays(parse(from), -1)), s);
    const prevWord = { day: `previous ${days} day${days === 1 ? '' : 's'}`, week: 'previous week', month: 'previous month', quarter: 'previous quarter', year: 'previous year', fy: 'previous fiscal year' }[s.g];
    return { g: s.g, from, to, days, label: labelOf(s.g, from, to), short: shortLabel(s.g, from, to), sub, prev: { from: prev[0], to: prev[1], label: labelOf(s.g, prev[0], prev[1]), word: prevWord } };
  }

  /* Move one period back (-1) or forward (+1) */
  function step(dir) {
    const s = state();
    if (s.g === 'all') return;
    if (s.g === 'day') {
      const [from, to] = bounds('day', null, s), n = Math.round((parse(to) - parse(from)) / 864e5) + 1;
      return setState({ from: iso(addDays(parse(from), dir * n)), to: iso(addDays(parse(to), dir * n)) });
    }
    const [from, to] = bounds(s.g, s.anchor, s);
    setState({ anchor: dir < 0 ? iso(addDays(parse(from), -1)) : iso(addDays(parse(to), 1)) });
  }

  /* ---------- Filtering & grouping helpers for pages ---------- */
  const keyOf = v => { if (v === '' || v == null) return ''; const k = App.dateKey(v); return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : ''; };
  /* Rows whose date falls in [from, to]; rows with an unreadable date are kept (they may be totals or labels) */
  function within(rows, col, from, to) {
    if (!col || !from) return rows;
    return rows.filter(r => { const k = keyOf(r[col]); return !k || (k >= from && k <= to); });
  }
  const filter = (rows, col) => { const r = range(); return r.g === 'all' ? rows : within(rows, col, r.from, r.to); };
  const previous = (rows, col) => { const r = range(); return r.prev ? within(rows, col, r.prev.from, r.prev.to) : []; };

  /* Choose a grouping for all-time views from the dates present */
  function autoSub(keys) {
    const ks = keys.filter(Boolean).sort();
    if (!ks.length) return 'day';
    const span = (parse(ks[ks.length - 1]) - parse(ks[0])) / 864e5;
    return span <= 62 ? 'day' : span <= 400 ? 'week' : 'month';
  }
  /* Bucket a date into its sub-period: day 'YYYY-MM-DD', week = its start date, month 'YYYY-MM' */
  function bucket(v, sub) {
    const k = keyOf(v);
    if (!k) return String(v ?? '');
    if (sub === 'month') return k.slice(0, 7);
    if (sub === 'week') { const d = parse(k), back = (d.getDay() - cal().weekStart + 7) % 7; return iso(addDays(d, -back)); }
    if (sub === 'quarter') { const d = parse(k); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`; }
    return k;
  }
  function bucketLabel(key, sub) {
    if (/^\d{4}-\d{2}$/.test(key)) { const [y, m] = key.split('-').map(Number); return `${MON[m - 1]} ${y}`; }
    if (/^\d{4}-Q\d$/.test(key)) return key.replace(/^(\d{4})-(Q\d)$/, '$2 $1');
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const d = parse(key);
      if (sub === 'week') return `Wk of ${MON[d.getMonth()]} ${d.getDate()}`;
      return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
    }
    return key;
  }
  const active = () => (override || ROUTES.includes(App.currentRoute?.() || '')) && state().g !== 'all';
  /* Run fn with a temporary period (e.g. one week) without touching the saved picker */
  async function withState(st, fn) { const prev = override; override = st; try { return await fn(); } finally { override = prev; } }
  const change = (cur, prev) => (prev ? cur / prev - 1 : NaN);

  App.period = { withState, VIEWS, ROUTES, cal, setCal, state, setState, bounds, range, step, within, filter, previous, autoSub, bucket, bucketLabel, labelOf, active, change, today, iso, parse, fyName, MON };
})(window.App);
