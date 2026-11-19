/* Agent engine: runs agents, keeps the agent log, the Needs-your-yes queue and the Morning page.
   Live agents (with a rule) compute real results from your units' data. Designed agents produce a clearly marked
   sample result until an AI is connected. State is saved in settings, so it syncs with your account. */
(function (UC) {
  const { S } = UC;
  const fmt = App.fmt;
  const pct = v => isNaN(v) ? '—' : (v * 100).toFixed(1) + '%';
  const money = v => fmt.money(v);
  const MAX_LOG = 400;

  const state = () => ({ log: [], asks: [], runs: {}, off: {}, morning: null, lastMorning: '', ...S.get('state', {}) });
  const save = st => { st.log = st.log.slice(-MAX_LOG); S.set('state', st); App.bus.emit('uc-changed'); };

  /* Ventures (business creation pipeline) */
  const STAGES = [
    { id: 'idea', name: 'Idea', items: ['Describe the idea and who it serves', 'Run Idea Screening', 'Market sizing', 'Competitor scan', 'Decide: go / no-go'] },
    { id: 'plan', name: 'Plan', items: ['Concept one-pager', 'Pro forma (3 years)', 'Startup budget', 'Business plan draft', 'Entity, EIN and bank account', 'Licenses & permits list'] },
    { id: 'funding', name: 'Funding', items: ['Decide funding mix (cash, SBA, partners)', 'Lender / investor package', 'Term sheet or loan approval', 'Funds in the bank'] },
    { id: 'build', name: 'Build-out', items: ['Site signed (lease or purchase)', 'Contractor and permits', 'Equipment and vendors ordered', 'Hire managers', 'Systems set up (POS, payroll, accounting)', 'Pre-opening timeline'] },
    { id: 'open', name: 'Opening', items: ['Hire and train the team', 'Opening inventory', 'Final inspections passed', 'Soft opening', 'Grand opening marketing'] },
    { id: 'operating', name: 'Operating', items: ['First 30 days reviewed', 'First 90 days reviewed against the pro forma', 'Added as a unit'] }
  ];
  const ventures = () => S.get('ventures', null) ?? starterVentures();
  const saveVentures = v => { S.set('ventures', v); App.bus.emit('uc-changed'); };
  function blankChecklist(stage) { return STAGES.find(s => s.id === stage).items.map(t => ({ t, done: false, due: '' })); }
  function starterVentures() {
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return App.dateKey(x); };
    const v = [
      { id: App.uid(), name: 'Second location: Eastside', type: 'restaurant', stage: 'build', open: d(75), owner: 'You', sample: true, notes: 'Lease signed; contractor starts next week.', check: {} },
      { id: App.uid(), name: 'Catering & events arm', type: 'services', stage: 'plan', open: d(140), owner: 'You', sample: true, notes: '', check: {} },
      { id: App.uid(), name: 'Packaged sauce line (retail)', type: 'ecommerce', stage: 'idea', open: '', owner: 'You', sample: true, notes: '', check: {} }
    ];
    for (const x of v) for (const s of STAGES) x.check[s.id] = blankChecklist(s.id);
    const b = v[0].check; b.idea.forEach(i => i.done = true); b.plan.forEach(i => i.done = true); b.funding.forEach(i => i.done = true);
    b.build[0].done = true; b.build[1].due = d(-3); b.build[2].due = d(4);
    v[1].check.idea.forEach(i => i.done = true); v[1].check.plan[0].done = true; v[1].check.plan[1].due = d(-1);
    S.set('ventures', v);
    return v;
  }

  /* ---------- rules (live agents) ---------- */
  const T = () => UC.targets();
  const D = () => UC.data;
  const RULES = {
    flash(ctx) {
      const end = ctx.end, rows = ctx.units.map(u => ({ u, day: D().stats(D().windowRows(u, end, 1)), wk: D().stats(D().wtd(u, end)) })).filter(x => x.day.days);
      if (!rows.length) return { text: 'No sales for the latest day yet.', kind: 'flag' };
      const tot = rows.reduce((a, x) => a + x.day.sales, 0), fc = rows.reduce((a, x) => a + x.day.forecast, 0), wk = rows.reduce((a, x) => a + x.wk.sales, 0);
      return { text: `${fmtDay(end)}: ${money(tot)} across ${rows.length} unit${rows.length > 1 ? 's' : ''}${fc ? `, ${signPct((tot - fc) / fc)} vs forecast` : ''}. Week to date ${money(wk)}.`, kind: 'done' };
    },
    forecastMiss(ctx) {
      const miss = ctx.units.map(u => ({ u, s: D().stats(D().windowRows(u, ctx.end, 1)) })).filter(x => x.s.forecast && x.s.vsFc < -T().forecastMiss / 100);
      return miss.length ? { text: `Under forecast ${fmtDay(ctx.end)}: ${miss.map(x => `${x.u.name} ${signPct(x.s.vsFc)} (${money(x.s.sales - x.s.forecast)})`).join('; ')}.`, kind: 'flag', units: miss.map(x => x.u.id) }
        : { text: `Every unit within ${T().forecastMiss}% of forecast ${fmtDay(ctx.end)}.`, kind: 'done' };
    },
    trend(ctx) {
      const out = ctx.units.map(u => { const a = D().stats(D().windowRows(u, ctx.end, 7)), b = D().stats(D().prior(u, ctx.end, 7)); return { u, ch: b.sales ? (a.sales - b.sales) / b.sales : NaN }; }).filter(x => !isNaN(x.ch));
      const down = out.filter(x => x.ch < -T().trendDrop / 100);
      return down.length ? { text: `Sales sliding (last 7 days vs. the 7 before): ${down.map(x => `${x.u.name} ${signPct(x.ch)}`).join('; ')}.`, kind: 'flag', units: down.map(x => x.u.id) }
        : { text: `Last 7 days vs. the 7 before: ${out.map(x => `${x.u.name} ${signPct(x.ch)}`).join(', ') || 'not enough history yet'}.`, kind: 'done' };
    },
    laborPct(ctx) {
      const over = ctx.units.map(u => ({ u, s: D().stats(D().windowRows(u, ctx.end, 7)) })).filter(x => x.s.sales && x.s.laborPct * 100 > T().laborPct);
      return over.length ? { text: `Labor over ${T().laborPct}% (last 7 days): ${over.map(x => `${x.u.name} ${pct(x.s.laborPct)} (${money(x.s.labor - x.s.sales * T().laborPct / 100)} over)`).join('; ')}.`, kind: 'flag', units: over.map(x => x.u.id) }
        : { text: `Every unit at or under ${T().laborPct}% labor for the last 7 days.`, kind: 'done' };
    },
    otWatch(ctx) {
      const hot = ctx.units.map(u => ({ u, s: D().stats(D().wtd(u, ctx.end)) })).filter(x => x.s.ot > T().otHours);
      if (!hot.length) return { text: `Overtime under ${T().otHours} h week to date at every unit.`, kind: 'done' };
      return { text: `Overtime building week to date: ${hot.map(x => `${x.u.name} ${x.s.ot.toFixed(1)} h`).join('; ')}. Heads-up drafted for each manager.`, kind: 'waiting', units: hot.map(x => x.u.id),
        asks: hot.map(x => ({ lane: 'team', to: `${x.u.name} manager`, unit: x.u.id, title: `Overtime heads-up: ${x.u.name} (${x.s.ot.toFixed(1)} h so far)`,
          detail: `Heads-up: ${x.u.name} has ${x.s.ot.toFixed(1)} overtime hours so far this week (target ${T().otHours} h). Please review the rest of the schedule today and move hours so no one goes past 40. Reply with the changes you make.` })) };
    },
    splh(ctx) {
      const low = ctx.units.map(u => ({ u, s: D().stats(D().windowRows(u, ctx.end, 7)) })).filter(x => x.s.hours && x.s.splh < T().splh);
      return low.length ? { text: `Sales per labor hour under $${T().splh}: ${low.map(x => `${x.u.name} $${x.s.splh.toFixed(0)}`).join('; ')}.`, kind: 'flag', units: low.map(x => x.u.id) }
        : { text: `Sales per labor hour at or above $${T().splh} everywhere (last 7 days).`, kind: 'done' };
    },
    schedVar(ctx) {
      const off = ctx.units.map(u => ({ u, s: D().stats(D().windowRows(u, ctx.end, 7)) })).filter(x => x.s.sched && x.s.schedVar * 100 > T().schedVar);
      return off.length ? { text: `Worked more hours than scheduled: ${off.map(x => `${x.u.name} +${(x.s.schedVar * 100).toFixed(1)}% (${(x.s.hours - x.s.sched).toFixed(0)} h)`).join('; ')}.`, kind: 'flag', units: off.map(x => x.u.id) }
        : { text: 'Hours worked stayed within the schedule (last 7 days).', kind: 'done' };
    },
    avt(ctx) {
      const gaps = ctx.units.filter(u => u.avt && u.avt.gapPts > T().avtGap);
      const any = ctx.units.filter(u => u.avt);
      if (!any.length) return { text: 'No actual vs. theoretical report imported yet (CrunchTime AvT PDF).', kind: 'flag' };
      return gaps.length ? { text: `Food cost above theoretical by more than ${T().avtGap} pts: ${gaps.map(u => `${u.name} +${u.avt.gapPts.toFixed(1)} pts`).join('; ')}.`, kind: 'flag', units: gaps.map(u => u.id) }
        : { text: `Food cost within ${T().avtGap} pts of theoretical at every unit with a count.`, kind: 'done' };
    },
    primeCost(ctx) {
      const out = ctx.units.map(u => { const s = D().stats(D().windowRows(u, ctx.end, 28)); return { u, s, pc: s.sales && u.purchases ? (s.labor + u.purchases) / s.sales : NaN }; }).filter(x => !isNaN(x.pc));
      if (!out.length) return { text: 'Prime cost needs purchases (purchase journal or receipts) next to sales and labor.', kind: 'flag' };
      const over = out.filter(x => x.pc * 100 > T().primeCost);
      return { text: `Prime cost, last 4 weeks: ${out.map(x => `${x.u.name} ${pct(x.pc)}`).join(', ')}${over.length ? `. Over ${T().primeCost}%: ${over.map(x => x.u.name).join(', ')}` : ''}.`, kind: over.length ? 'flag' : 'done', units: over.map(x => x.u.id) };
    },
    benchmark(ctx) {
      const r = ctx.units.map(u => ({ u, s: D().stats(D().windowRows(u, ctx.end, 7)) })).filter(x => x.s.sales).sort((a, b) => a.s.laborPct - b.s.laborPct);
      if (r.length < 2) return { text: 'Benchmarking needs two or more units with data.', kind: 'done' };
      return { text: `Best labor % this week: ${r[0].u.name} (${pct(r[0].s.laborPct)}). Furthest behind: ${r[r.length - 1].u.name} (${pct(r[r.length - 1].s.laborPct)}). Gap worth ${money((r[r.length - 1].s.laborPct - r[0].s.laborPct) * r[r.length - 1].s.sales)} a week.`, kind: 'done' };
    },
    ventureWatch() {
      const today = App.dateKey(new Date()), late = [];
      for (const v of ventures()) for (const it of v.check[v.stage] || []) if (!it.done && it.due && it.due < today) late.push(`${v.name}: ${it.t}`);
      return late.length ? { text: `Overdue on ventures: ${late.join('; ')}.`, kind: 'flag' } : { text: `${ventures().length} venture${ventures().length === 1 ? '' : 's'} on track; nothing overdue.`, kind: 'done' };
    },
    morning(ctx, st) {
      const m = buildMorning(ctx, st);
      st.morning = m; st.lastMorning = App.dateKey(new Date());
      return { text: `Morning page ready: ${m.headline}`, kind: 'done' };
    }
  };
  const signPct = v => isNaN(v) ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
  const fmtDay = d => d ? new Date(d + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '—';

  function buildMorning(ctx, st) {
    const end = ctx.end, units = ctx.units;
    const day = D().stats(units.flatMap(u => D().windowRows(u, end, 1)));
    const wk = D().stats(units.flatMap(u => D().wtd(u, end)));
    const today = App.dateKey(new Date());
    const flags = st.log.filter(e => e.kind === 'flag' && e.date === today && !e.sample).map(e => e.text).slice(-6);
    const waiting = st.asks.filter(a => a.status === 'pending').length;
    const nextVenture = ventures().map(v => ({ v, it: (v.check[v.stage] || []).find(i => !i.done) })).filter(x => x.it).slice(0, 3);
    return {
      at: Date.now(), end, demo: ctx.demo,
      headline: `${money(day.sales)} yesterday${day.forecast ? ` (${signPct(day.vsFc)} vs forecast)` : ''}, labor ${pct(day.laborPct)}, ${waiting} waiting for your yes.`,
      numbers: [['Sales yesterday', money(day.sales)], ['vs forecast', signPct(day.vsFc)], ['Labor %', pct(day.laborPct)], ['Week to date', money(wk.sales)], ['WTD labor %', pct(wk.laborPct)], ['Overtime WTD', wk.ot.toFixed(1) + ' h']],
      flags, waiting, ventures: nextVenture.map(x => `${x.v.name}: next, ${x.it.t}${x.it.due ? ` (due ${fmtDay(x.it.due)})` : ''}`)
    };
  }

  /* ---------- running ---------- */
  async function context() { const d = await UC.data.load(); return { ...d, end: UC.data.lastDate(d.units) }; }
  function record(st, a, res, ctx) {
    const now = Date.now();
    st.runs[a.id] = now;
    const e = { id: App.uid(), t: now, date: App.dateKey(new Date()), agent: a.id, dept: a.dept, text: res.text, kind: res.kind, sample: !!res.sample, demo: !!ctx?.demo, units: res.units || [], ...(res.out ? { out: res.out } : {}), ...(res.ai ? { ai: true } : {}) };
    st.log.push(e);
    for (const q of res.asks || []) {
      // Don't stack duplicates of the same open request
      if (st.asks.some(x => x.status === 'pending' && x.agent === a.id && x.title === q.title)) continue;
      st.asks.push({ id: App.uid(), agent: a.id, dept: a.dept, created: now, status: 'pending', lane: 'you', demo: !!ctx?.demo, sample: !!res.sample, ...q });
    }
    return e;
  }
  /* Run agents. Rule agents compute on your data; AI agents go to Ollama (UC.ai) one at a time. */
  async function run(ids, opts = {}) {
    const ctx = opts.ctx || await context();
    const out = [];
    const rules = ids.map(id => UC.agent(id)).filter(a => a && a.rule && RULES[a.rule] && !state().off[a.id]);
    if (rules.length) {
      const st = state();
      for (const a of rules) {
        let res;
        try { res = RULES[a.rule](ctx, st); } catch (e) { console.error(e); res = { text: `${a.name} hit an error: ${e.message}`, kind: 'flag' }; }
        out.push(record(st, a, res, ctx));
      }
      save(st);
    }
    for (const a of ids.map(id => UC.agent(id)).filter(a => a && !a.rule && !state().off[a.id])) {
      try { await UC.ai.run(a, { ...opts, ctx }); out.push(state().log[state().log.length - 1]); }
      catch (e) { if (opts.throw) throw e; push(a.id, { text: `${a.name} couldn’t run: ${e.message}`, kind: 'flag' }, ctx); }
    }
    return out;
  }
  /* Add one result to the log / Needs your yes (used by the AI runner) */
  function push(id, res, ctx) { const st = state(), a = UC.agent(id); const e = record(st, a, res, ctx); save(st); return e; }
  function markStage(key) { const st = state(); st.stageRuns = { ...(st.stageRuns || {}), [key]: Date.now() }; save(st); }
  const liveIds = () => UC.AGENTS.filter(a => a.rule && UC.enabledAgent(a)).map(a => a.id);
  /* Every morning (first open of the day): run the live agents, Morning page last */
  async function morningRun(force = false) {
    const st = state(), today = App.dateKey(new Date());
    if (!force && st.lastMorning === today) return null;
    const ids = liveIds().filter(id => id !== 'intel/morning-page');
    await run([...ids, 'intel/morning-page']);
    return state().morning;
  }

  function decide(id, status, detail) {
    const st = state(), a = st.asks.find(x => x.id === id); if (!a) return;
    a.status = status; a.decidedAt = Date.now(); if (detail != null) a.detail = detail;
    const ag = UC.agent(a.agent);
    st.log.push({ id: App.uid(), t: Date.now(), date: App.dateKey(new Date()), agent: a.agent, dept: a.dept, kind: 'done', text: `${status === 'approved' ? 'You approved' : 'You declined'}: ${a.title}${status === 'approved' && a.lane !== 'you' ? ` (goes to ${a.to || 'the team'})` : ''}`, sample: a.sample, demo: a.demo });
    save(st);
    return ag;
  }
  function setOff(id, off) { const st = state(); if (off) st.off[id] = true; else delete st.off[id]; save(st); }
  function clear(what) { const st = state(); if (what === 'log') st.log = []; if (what === 'asks') st.asks = st.asks.filter(a => a.status === 'pending' && !a.sample); if (what === 'all') { S.set('state', {}); App.bus.emit('uc-changed'); return; } save(st); }

  UC.engine = { state, run, push, markStage, morningRun, decide, setOff, clear, context, liveIds, RULES, STAGES, ventures, saveVentures, blankChecklist, fmtDay, signPct, pct };
})(window.UC);
