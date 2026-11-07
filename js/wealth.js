/* Family wealth: members, accounts (assets & debts), holdings, net worth history, tax buckets, contribution limits.
   Accounts live in each personal unit (bsettings 'wealth.accounts'); family members are global. */
(function (App) {
  const { fmt } = App;

  /* ---------- Account types ---------- */
  const TYPES = {
    checking: { label: 'Checking', side: 'asset', group: 'cash', tax: 'taxable' },
    savings: { label: 'Savings / money market', side: 'asset', group: 'cash', tax: 'taxable' },
    brokerage: { label: 'Brokerage (taxable)', side: 'asset', group: 'invest', tax: 'taxable' },
    k401: { label: '401(k) / 403(b) / 457', side: 'asset', group: 'retire', tax: 'deferred' },
    ira: { label: 'Traditional IRA / SEP / SIMPLE', side: 'asset', group: 'retire', tax: 'deferred' },
    roth: { label: 'Roth IRA / Roth 401(k)', side: 'asset', group: 'retire', tax: 'roth' },
    hsa: { label: 'HSA', side: 'asset', group: 'retire', tax: 'hsa' },
    edu: { label: '529 / education', side: 'asset', group: 'invest', tax: '529' },
    crypto: { label: 'Crypto', side: 'asset', group: 'invest', tax: 'taxable' },
    home: { label: 'Home / real estate', side: 'asset', group: 'property', tax: 'none' },
    vehicle: { label: 'Vehicle', side: 'asset', group: 'property', tax: 'none' },
    business: { label: 'Business ownership', side: 'asset', group: 'property', tax: 'none' },
    otherAsset: { label: 'Other asset', side: 'asset', group: 'other', tax: 'none' },
    mortgage: { label: 'Mortgage / HELOC', side: 'debt', group: 'debt', tax: 'none' },
    auto: { label: 'Auto loan', side: 'debt', group: 'debt', tax: 'none' },
    student: { label: 'Student loan', side: 'debt', group: 'debt', tax: 'none' },
    card: { label: 'Credit card', side: 'debt', group: 'debt', tax: 'none' },
    otherDebt: { label: 'Other debt', side: 'debt', group: 'debt', tax: 'none' }
  };
  const GROUPS = { cash: 'Cash', invest: 'Investments', retire: 'Retirement & HSA', property: 'Property & other', other: 'Other', debt: 'Debts' };
  const TAX = { taxable: 'Taxable', deferred: 'Tax-deferred', roth: 'Tax-free (Roth)', hsa: 'HSA (triple tax-free)', '529': '529 (education)', none: 'Not invested' };

  /* IRS limits by tax year (editable on the Taxes & CPA page). 2026 from IRS Notice 2025-67 / Rev. Proc. 2025-19;
     2027 HSA from Rev. Proc. 2026-24; 2027 401(k)/IRA left as 2026 until the IRS announces them. */
  const LIMITS = {
    2026: { k401: 24500, k401CatchUp50: 8000, k401CatchUp60: 11250, ira: 7500, iraCatchUp50: 1100, hsaSelf: 4400, hsaFamily: 8750, hsaCatchUp55: 1000, note: 'IRS 2026 limits' },
    2027: { k401: 24500, k401CatchUp50: 8000, k401CatchUp60: 11250, ira: 7500, iraCatchUp50: 1100, hsaSelf: 4500, hsaFamily: 9000, hsaCatchUp55: 1000, note: '2027 HSA limits are final; 401(k)/IRA shown at 2026 levels until the IRS announces 2027 (edit when published)' }
  };
  const limits = year => ({ ...(LIMITS[year] || LIMITS[2026]), ...App.settings.get('tax.limits.' + year, {}) });

  /* ---------- Family members (global) ---------- */
  function members() {
    let m = App.settings.get('family.members', null);
    if (!Array.isArray(m) || !m.length) {
      m = [{ id: 'me', name: (App.settings.get('userName', '') || 'Me').trim() || 'Me', role: 'self', color: '#6366f1' }];
      App.settings.set('family.members', m);
    }
    return m;
  }
  const member = id => members().find(x => x.id === id);
  const memberName = id => (id === 'joint' || !id ? 'Joint' : member(id)?.name || 'Unknown');
  function saveMembers(m) { App.settings.set('family.members', m); App.bus.emit('biz-changed'); }
  /* Person filter for personal views: 'all' (family) or a member id */
  const person = () => { const p = App.settings.get('family.person', 'all'); return p === 'all' || member(p) ? p : 'all'; };
  const setPerson = p => App.settings.set('family.person', p);

  /* ---------- Accounts ---------- */
  const accounts = () => App.bsettings.get('wealth.accounts', []);
  function saveAccount(a) {
    const all = accounts().filter(x => x.id !== a.id);
    all.push(a);
    App.bsettings.set('wealth.accounts', all);
  }
  function removeAccount(id) { App.bsettings.set('wealth.accounts', accounts().filter(x => x.id !== id)); }
  /* Record a balance (keeps one point per day in the history) */
  function setBalance(a, balance, date = new Date().toISOString().slice(0, 10)) {
    a.balance = +balance || 0;
    a.asOf = date;
    a.history = (a.history || []).filter(h => h.date !== date).concat([{ date, balance: a.balance }]).sort((x, y) => x.date.localeCompare(y.date));
    return a;
  }
  const signed = a => (TYPES[a.type]?.side === 'debt' ? -Math.abs(+a.balance || 0) : +a.balance || 0);
  const taxOf = a => a.tax || TYPES[a.type]?.tax || 'taxable';
  const ownerOf = (a, unit) => a.owner || unit?.owner || 'joint';

  /* Guess the account type and tax treatment from a brokerage account name */
  function guessType(name) {
    const n = String(name || '').toLowerCase();
    if (/roth/.test(n)) return 'roth';
    if (/401|403|457|tsp|thrift/.test(n)) return 'k401';
    if (/\bira\b|rollover|sep|simple|traditional/.test(n)) return 'ira';
    if (/hsa|health savings/.test(n)) return 'hsa';
    if (/529|college|education|coverdell/.test(n)) return 'edu';
    if (/crypto|coinbase|bitcoin/.test(n)) return 'crypto';
    if (/checking/.test(n)) return 'checking';
    if (/saving|money market|cash management/.test(n)) return 'savings';
    return 'brokerage';
  }

  /* All accounts in the current view (one unit, or every personal unit in a roll-up), tagged with their unit */
  async function collect({ who = person() } = {}) {
    const units = App.biz.inView().filter(b => App.biz.kindOf(b) === 'individual' || !App.biz.isMaster());
    const out = [];
    for (const u of units) {
      const list = await App.biz.withBiz(u.id, () => accounts());
      for (const a of list) {
        const owner = ownerOf(a, u);
        if (who !== 'all' && owner !== who && owner !== 'joint') continue;
        out.push({ ...a, unit: u, owner, signed: signed(a), tax: taxOf(a), group: TYPES[a.type]?.group || 'other', side: TYPES[a.type]?.side || 'asset' });
      }
    }
    return out;
  }

  /* Totals, breakdowns and monthly net-worth history */
  function summarize(list) {
    const sum = f => list.filter(f).reduce((s, a) => s + Math.abs(+a.balance || 0), 0);
    const assets = sum(a => a.side === 'asset'), debts = sum(a => a.side === 'debt');
    const by = key => { const m = new Map(); list.forEach(a => m.set(a[key], (m.get(a[key]) || 0) + a.signed)); return m; };
    const byGroup = new Map(); list.forEach(a => byGroup.set(a.group, (byGroup.get(a.group) || 0) + Math.abs(+a.balance || 0)));
    const byTax = new Map(); list.filter(a => a.side === 'asset' && a.tax !== 'none').forEach(a => byTax.set(a.tax, (byTax.get(a.tax) || 0) + (+a.balance || 0)));
    const byOwner = by('owner');
    const liquid = sum(a => a.group === 'cash');
    const invested = sum(a => a.group === 'invest' || a.group === 'retire');
    // Monthly history: last known balance of each account at each month end
    const dates = [...new Set(list.flatMap(a => (a.history || []).map(h => h.date)))].sort();
    let history = [];
    if (dates.length) {
      const first = new Date(dates[0] + 'T12:00'), end = new Date();
      const points = [];
      for (let d = new Date(first.getFullYear(), first.getMonth() + 1, 0); d <= end || points.length === 0; d = new Date(d.getFullYear(), d.getMonth() + 2, 0)) {
        points.push(d.toISOString().slice(0, 10));
        if (points.length > 240) break;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (points[points.length - 1] < today) points.push(today);
      history = points.map(p => ({ date: p, net: list.reduce((s, a) => {
        const h = (a.history || []).filter(x => x.date <= p).pop();
        if (!h) return s;
        return s + (a.side === 'debt' ? -Math.abs(h.balance) : h.balance);
      }, 0) }));
    }
    // Change over time, counting only accounts that already had a balance at the first point
    let change = NaN, changeFrom = '';
    if (history.length > 1) {
      changeFrom = history[0].date;
      const at = (a, d) => { const h = (a.history || []).filter(x => x.date <= d).pop(); return h ? (a.side === 'debt' ? -Math.abs(h.balance) : h.balance) : null; };
      const tracked = list.filter(a => at(a, changeFrom) !== null);
      change = tracked.reduce((s, a) => s + (a.signed - at(a, changeFrom)), 0);
    }
    const holdings = list.flatMap(a => (a.holdings || []).map(h => ({ ...h, account: a.name, accountId: a.id, owner: a.owner, tax: a.tax, unit: a.unit })));
    return { assets, debts, net: assets - debts, liquid, invested, byGroup, byTax, byOwner, history, change, changeFrom, holdings, count: list.length };
  }

  /* Holdings that could be sold for a tax loss (taxable accounts only) */
  const harvestable = holdings => holdings.filter(h => h.tax === 'taxable' && +h.upl < -1).sort((a, b) => a.upl - b.upl);

  App.wealth = { TYPES, GROUPS, TAX, LIMITS, limits, members, member, memberName, saveMembers, person, setPerson, accounts, saveAccount, removeAccount, setBalance, guessType, collect, summarize, harvestable, ownerOf, signed };
})(window.App);
