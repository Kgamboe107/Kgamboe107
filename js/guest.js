/* Guest scores & store audits, organized by Jersey Mike's 7 Principles of Success.
   SMG survey results and audits (self-evaluations, operational audits, district visits) are kept per business. */
(function (App) {
  const { fmt } = App;

  /* The 7 Principles of Success, with what each looks like in the store (from the team handbook / meeting deck) */
  const PRINCIPLES = [
    { n: 1, key: 'clean', title: 'Clean and well maintained', std: 'Nothing for a guest to fix, inside or out', smg: ['clean'],
      checks: ['Dining room, tables and floors clean', 'Restrooms clean and stocked', 'Outside clean: lot, entry, windows, trash', 'Line and back of house clean as you go', 'Equipment working and well maintained'] },
    { n: 2, key: 'stocked', title: 'Well stocked', std: 'Every station set by 9:59 and 4:00', smg: [],
      checks: ['Every station set by 9:59 for lunch', 'Every station set by 4:00 for dinner', 'Bread baked to the chart', 'Bags, cups, napkins and condiments stocked', 'Chips, cookies and bottles faced and full'] },
    { n: 3, key: 'fresh', title: 'Fresh', std: 'Sliced, baked and labeled fresh, nothing past its time', smg: ['taste'],
      checks: ['Meats and cheeses sliced in front of the guest', 'Bread baked here today', 'Time labels on every cut tomato and lettuce pan (4-hour rule)', 'Nothing past its time; FIFO followed', 'Temps logged 3× a day (coolers 38–40°F, steam table 135°F+)'] },
    { n: 4, key: 'neat', title: 'Neat and well-groomed', std: 'Full uniform, every shift', smg: [],
      checks: ['Logo hat or visor, hair tucked in', 'Grey logo polo and navy apron, clean', 'Long navy slacks or khakis, belt, black non-slip shoes', 'Short nails, one stud per ear, groomed facial hair', 'Phone out of guest view, no headphones'] },
    { n: 5, key: 'procedures', title: 'Proper procedures', std: 'Every sub to spec, to weight, called down the line', smg: ['speed', 'accuracy', 'digital'],
      checks: ['Mini, regular and giant weighed this shift; sliced to spec', 'Sub and guest name called down the line', 'Hands washed and new gloves for each task', 'Sanitizer tested hourly (50–200 ppm)', 'Every digital bag checked against its ticket', 'Waste and remakes logged on the waste sheet'] },
    { n: 6, key: 'sharing', title: 'Sharing our lives', std: 'A real greeting, a conversation, a real goodbye', smg: ['friendly'],
      checks: ['Every guest greeted as they walk in', 'A real conversation, not a script', 'A real goodbye and thank-you', 'Problems handled with BLAST (Believe, Listen, Apologize, Solve, Thank)'] },
    { n: 7, key: 'inviting', title: 'Inviting people in', std: 'Proudly asking people in once 1 to 6 are a yes', smg: ['overall', 'return'],
      checks: ['Every guest asked about MyMike’s rewards', 'Catering and online ordering mentioned', 'Signage, windows and entrance inviting', 'Local outreach or Month of Giving activity this period'] }
  ];
  const P = Object.fromEntries(PRINCIPLES.map(p => [p.key, p]));

  /* SMG survey measures (percent of top-box / satisfied guests, as SMG reports them) */
  const METRICS = [
    { k: 'overall', label: 'Overall satisfaction', principle: 'inviting' },
    { k: 'taste', label: 'Taste of food', principle: 'fresh' },
    { k: 'speed', label: 'Speed of service', principle: 'procedures' },
    { k: 'clean', label: 'Cleanliness', principle: 'clean' },
    { k: 'friendly', label: 'Friendliness', principle: 'sharing' },
    { k: 'accuracy', label: 'Order accuracy (in store)', principle: 'procedures' },
    { k: 'digital', label: 'Digital order accuracy', principle: 'procedures' },
    { k: 'return', label: 'Likely to return', principle: 'inviting' },
    { k: 'value', label: 'Value', principle: null }
  ];
  const M = Object.fromEntries(METRICS.map(m => [m.k, m]));

  const AUDIT_TYPES = ['Self-evaluation', 'Operational audit (corporate)', 'District / owner visit', 'Health inspection', 'Other'];

  /* Goals: April 1 targets from the Auburn rebuild scorecard; editable on the page */
  const DEFAULT_TARGETS = { overall: 85, speed: 80, clean: 85, digital: 90, friendly: 85, taste: 85, accuracy: 90, return: 85, value: 80, audit: 90, auditGate: 88 };

  const smg = () => App.bsettings.get('guest.smg', []).slice().sort((a, b) => (a.to || a.from || '').localeCompare(b.to || b.from || ''));
  const audits = () => App.bsettings.get('guest.audits', []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const targets = () => ({ ...DEFAULT_TARGETS, ...App.bsettings.get('guest.targets', {}) });
  function save(kind, rec) {
    const key = kind === 'smg' ? 'guest.smg' : 'guest.audits';
    const all = App.bsettings.get(key, []).filter(x => x.id !== rec.id);
    all.push(rec);
    App.bsettings.set(key, all);
  }
  function remove(kind, id) {
    const key = kind === 'smg' ? 'guest.smg' : 'guest.audits';
    App.bsettings.set(key, App.bsettings.get(key, []).filter(x => x.id !== id));
  }

  /* Score one audit: per-principle % of applicable items answered yes */
  function scoreAudit(a) {
    const per = {};
    let yes = 0, tot = 0;
    for (const p of PRINCIPLES) {
      const ans = a.answers?.[p.key] || {};
      const vals = Object.values(ans).filter(v => v === 'yes' || v === 'no');
      const y = vals.filter(v => v === 'yes').length;
      per[p.key] = vals.length ? y / vals.length : NaN;
      yes += y; tot += vals.length;
    }
    const checklist = tot ? yes / tot : NaN;
    const official = a.official !== '' && a.official != null && !isNaN(+a.official) ? +a.official / 100 : NaN;
    const misses = PRINCIPLES.flatMap(p => Object.entries(a.answers?.[p.key] || {}).filter(([, v]) => v === 'no').map(([i]) => ({ principle: p, item: p.checks[+i] || i })));
    return { per, checklist, score: isNaN(official) ? checklist : official, official, misses, answered: tot };
  }

  /* Everything the page, dashboard and drill-downs need */
  function summary() {
    const S = smg(), A = audits().map(a => ({ ...a, s: scoreAudit(a) })), T = targets();
    const last = S[S.length - 1], prev = S[S.length - 2];
    const lastA = A[A.length - 1], prevA = A[A.length - 2];
    const lastSelf = [...A].reverse().find(a => /self/i.test(a.type)) || lastA;
    // Each principle: latest audit score + the SMG measures that reflect it
    const board = PRINCIPLES.map(p => {
      const auditScore = lastA ? lastA.s.per[p.key] : NaN;
      const prevScore = prevA ? prevA.s.per[p.key] : NaN;
      const metrics = METRICS.filter(m => m.principle === p.key).map(m => ({ ...m, v: last ? num(last.scores?.[m.k]) : NaN, pv: prev ? num(prev.scores?.[m.k]) : NaN, region: last ? num(last.region?.[m.k]) : NaN, target: T[m.k] }));
      const misses = lastA ? lastA.s.misses.filter(x => x.principle.key === p.key).map(x => x.item) : [];
      const below = metrics.filter(m => !isNaN(m.v) && m.target && m.v < m.target);
      const tone = (!isNaN(auditScore) && auditScore < 0.8) || below.length ? 'bad' : (!isNaN(auditScore) && auditScore < 0.95) || misses.length ? 'warn' : (!isNaN(auditScore) || metrics.some(m => !isNaN(m.v))) ? 'good' : '';
      return { ...p, auditScore, prevScore, metrics, misses, tone };
    });
    const flags = [];
    if (last) METRICS.forEach(m => { const v = num(last.scores?.[m.k]); if (!isNaN(v) && T[m.k] && v < T[m.k]) flags.push(`SMG ${m.label.toLowerCase()} ${v}% is below the ${T[m.k]}% goal`); });
    if (lastA && !isNaN(lastA.s.score) && lastA.s.score * 100 < T.audit) flags.push(`${lastA.type} ${fmt.date(lastA.date)}: ${Math.round(lastA.s.score * 100)}%, goal ${T.audit}%`);
    if (lastA) lastA.s.misses.slice(0, 6).forEach(x => flags.push(`Principle ${x.principle.n} · ${x.principle.title}: ${x.item}`));
    const weakest = board.filter(b => !isNaN(b.auditScore)).sort((a, b) => a.auditScore - b.auditScore)[0];
    return { smg: S, audits: A, last, prev, lastA, prevA, lastSelf, board, flags, weakest, targets: T };
  }
  const num = v => (v === '' || v == null ? NaN : +v);

  /* Dashboard tiles + "needs attention" */
  function publish() {
    const s = summary();
    if (!s.last && !s.lastA) { App.ui.publish('guest', {}); return s; }
    App.ui.publish('guest', {
      overall: s.last ? num(s.last.scores?.overall) : NaN, overallPrev: s.prev ? num(s.prev.scores?.overall) : NaN, surveys: s.last?.surveys || 0, smgPeriod: s.last ? `${fmt.date(s.last.from)} – ${fmt.date(s.last.to)}` : '',
      audit: s.lastA ? s.lastA.s.score : NaN, auditType: s.lastA?.type || '', auditDate: s.lastA?.date || '', weakest: s.weakest ? `${s.weakest.n}. ${s.weakest.title}` : '',
      alerts: s.flags.length, flags: s.flags
    });
    return s;
  }

  App.guest = { PRINCIPLES, P, METRICS, M, AUDIT_TYPES, DEFAULT_TARGETS, smg, audits, targets, save, remove, scoreAudit, summary, publish };
})(window.App);
