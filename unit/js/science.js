/* Management science: human thought and structure turned into working tools.
   Four phases (the Master Skill Tree):
   1 Foundations      time and priorities, capture, retention (the continuous learning engine)
   2 Core mechanics   statistics (normal range, standard deviation), correlation is not causation, the accounting equation
   3 Human experience four schools of psychology as coaching styles, the communication model, the three ethical scales
   4 Applied systems  Plan · Organize · Lead · Control, the 4 Ps, the CIA triad, legal risk
   Each framework is used somewhere real in the app; the Blueprint screen shows where and what it says now. */
(function (UC) {
  /* ---------- Phase 2: statistics ---------- */
  const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
  /* A unit's day vs. its own normal for that weekday (the last 8 same weekdays) */
  function zDay(u, date, field = 'sales') {
    const day = u.days.find(d => d.date === date); if (!day || !(day[field] > 0)) return null;
    const wd = new Date(date + 'T12:00').getDay();
    const hist = u.days.filter(d => d.date < date && new Date(d.date + 'T12:00').getDay() === wd && d[field] > 0).slice(-8).map(d => d[field]);
    if (hist.length < 4) return null;
    const m = mean(hist), s = sd(hist); if (!s) return null;
    return { z: (day[field] - m) / s, value: day[field], mean: m, sd: s, n: hist.length };
  }
  function unusual(units, date) {
    const out = [];
    for (const u of units) {
      const s = zDay(u, date, 'sales'); if (s && Math.abs(s.z) >= 2) out.push({ u, field: 'sales', ...s });
      const lp = (() => { const d = u.days.find(x => x.date === date); if (!d?.sales || !d.labor) return null; const wd = new Date(date + 'T12:00').getDay(); const h = u.days.filter(x => x.date < date && x.sales && x.labor && new Date(x.date + 'T12:00').getDay() === wd).slice(-8).map(x => x.labor / x.sales); if (h.length < 4 || !sd(h)) return null; return { z: (d.labor / d.sales - mean(h)) / sd(h), value: d.labor / d.sales, mean: mean(h), sd: sd(h), n: h.length }; })();
      if (lp && lp.z >= 2) out.push({ u, field: 'labor %', ...lp });
    }
    return out;
  }
  const describe = x => x.field === 'sales'
    ? `${x.u.name} sales ${App.fmt.money(x.value)} vs. a normal ${App.fmt.money(x.mean)} for that weekday (${x.z > 0 ? '+' : ''}${x.z.toFixed(1)} standard deviations)`
    : `${x.u.name} labor ${(x.value * 100).toFixed(1)}% vs. a normal ${(x.mean * 100).toFixed(1)}% (${x.z > 0 ? '+' : ''}${x.z.toFixed(1)} SD)`;

  /* ---------- Phase 3: the communication model (sender → message → channel → receiver → feedback, plus noise) ---------- */
  function comm(text, to = '') {
    const t = String(text || ''), body = t.replace(/^Subject:.*\n+/i, ''), words = body.split(/\s+/).filter(Boolean).length, notes = [];
    if (!to.trim()) notes.push(['Receiver', 'No clear recipient']);
    if (words > 220) notes.push(['Noise', `${words} words; most people skim past 150`]);
    if (!/\?|please|can you|could you|would you|let me know|reply|(?:^|[.!\n]\s*)(?:fix|send|move|call|review|approve|confirm|schedule|cover|order|update|sign|book)\b|by (mon|tue|wed|thu|fri|sat|sun|today|tomorrow|\d)/i.test(body)) notes.push(['Feedback', 'No clear ask or next step']);
    if (/[A-Z]{6,}/.test(body.replace(/\b(LLC|CEO|GM|POS|SOP|FDD|NDA|LOI|ASAP|USA|PTO)\b/g, ''))) notes.push(['Noise', 'ALL CAPS reads as shouting']);
    if (/!!|\b(unacceptable|ridiculous|always|never|terrible|lazy)\b/i.test(body)) notes.push(['Noise', 'Emotional or absolute words']);
    if ((body.match(/\b(synergy|leverage|bandwidth|circle back|per my last|going forward|ASAP)\b/gi) || []).length >= 2) notes.push(['Message', 'Jargon; say it plainly']);
    return { ok: !notes.length, words, notes };
  }

  /* ---------- Phase 3: the three ethical scales (used in Decision briefs) ---------- */
  const ETHICS = [['outcome', 'Outcome (consequences)', 'Who benefits and who could be harmed: guests, staff, partners, the community?'], ['duty', 'Duty (rules and promises)', 'Does it break a law, a contract, a policy or a promise you made?'], ['character', 'Character (virtue)', 'Would you be comfortable if your team, your family or the public saw exactly how you did it?']];

  /* ---------- Phase 4: the management functions on your departments ---------- */
  const POLC = { plan: ['Plan', 'Set goals and decide how to reach them', ['venture', 'multi', 'intel']], organize: ['Organize', 'Arrange people, money and supplies to do it', ['supply', 'finance', 'knowledge']], lead: ['Lead', 'Guide, coach and communicate', ['people', 'customer']], control: ['Control', 'Measure results against the plan and correct', ['sales', 'ops', 'risk']] };
  const polcOf = dept => Object.entries(POLC).find(([, v]) => v[2].includes(dept))?.[0] || 'control';

  /* ---------- Phase 3: four schools of psychology as coaching styles ---------- */
  const COACH = [
    ['Behavioral', 'Clear expectations, quick recognition, consistent consequences.', 'New hires, routines, checklists, speed of service.'],
    ['Cognitive', 'Explain the why; teach how to think through a problem.', 'Shift leads, troubleshooting, food cost and labor decisions.'],
    ['Humanistic', 'Growth, autonomy and purpose; ask what they want to become.', 'Strong performers, future managers, retention.'],
    ['Psychodynamic', 'Notice patterns under the surface: stress, conflict, history.', 'Repeated conflicts, sudden changes in behavior; refer to professionals when needed.']
  ];

  /* ---------- the Blueprint: phases, nodes and what each says about you now ---------- */
  async function status() {
    const st = UC.engine.state(), ctx = await UC.data.load(), end = UC.data.lastDate(ctx.units);
    const obj = UC.S.get('objectivesLog', []).slice(-14), done = obj.reduce((a, o) => a + o.items.filter(i => i.done).length, 0), total = obj.reduce((a, o) => a + o.items.length, 0);
    const notes = UC.brain?.notes ? [...UC.brain.notes().values()] : [];
    const week = Date.now() - 7 * 864e5;
    const un = end ? unusual(ctx.units, end) : [];
    const pend = st.asks.filter(a => a.status === 'pending'), commIssues = pend.filter(a => !comm(a.detail, a.to).ok).length;
    const briefs = UC.decide?.list() || [], ethics = briefs.filter(b => b.outcome || b.duty || b.character).length;
    let legal = null; try { const all = await UC.legalAssessAll(); const s = all.filter(x => x.a && !isNaN(x.a.score)); legal = s.length ? Math.round(mean(s.map(x => x.a.score)) * 100) : null; } catch { /* optional */ }
    const deals = UC.deals ? await UC.deals.all() : [];
    const growth = UC.growth ? (await UC.growth.all()).filter(p => !p.deal) : [];
    const lock = App.lock?.enabled?.(), cloud = App.settings.get('cloud.mode', 'local');
    const logs = st.log.filter(e => e.t > week), byPolc = Object.fromEntries(Object.keys(POLC).map(k => [k, logs.filter(e => polcOf(e.dept || String(e.agent).split('/')[0]) === k).length]));
    return {
      foundations: [
        ['time', 'Time & priorities', total ? `${done} of ${total} daily objectives done in the last two weeks` : 'Start with Today’s three', 'today', {}],
        ['capture', 'Capture & organize', `${notes.filter(n => n.updated > week).length} memories added or changed this week`, 'brain', {}],
        ['retain', 'Retention', `${UC.brainPlus?.dueCards().length || 0} review cards due`, 'brain', { tab: 'review' }],
        ['learn', 'Continuous learning', 'Survey · Question · Read · Recite · Review: use Notebooks to study one topic deeply', 'brain', { tab: 'notebooks' }]],
      mechanics: [
        ['stats', 'Normal range (statistics)', un.length ? `${un.length} unusual reading${un.length > 1 ? 's' : ''} on ${end}: ${un.slice(0, 2).map(describe).join('; ')}` : end ? `Every unit inside its normal range on ${end}` : 'Needs daily numbers', 'units', {}],
        ['cause', 'Correlation ≠ causation', 'Agents are told to say “linked with” and suggest a test before claiming a cause', 'agents', {}],
        ['books', 'The accounting equation', 'Assets = Liabilities + Equity. Income statement, balance sheet and cash flow live in the Ops Command Desk', '', {}],
        ['forecast', 'Forecast accuracy', 'Forecast Miss and Sales Trend agents compare plan with result every morning', 'agents', {}]],
      human: [
        ['coach', 'Coaching styles (psychology)', 'Behavioral · Cognitive · Humanistic · Psychodynamic: pick the style that fits the person and the moment', '', {}],
        ['comm', 'Communication check', pend.length ? `${commIssues} of ${pend.length} drafts waiting for you have a clarity note` : 'Checks every draft before you approve it', 'today', {}],
        ['ethics', 'Ethical scales', `${ethics} of ${briefs.length} decision briefs include the ethics check`, 'decide', {}],
        ['decide', 'Decision thought process', `${briefs.filter(b => b.status === 'thinking').length} open · ${UC.decide?.due().length || 0} due for review`, 'decide', {}]],
      applied: [
        ['polc', 'Plan · Organize · Lead · Control', `This week: ${Object.entries(byPolc).map(([k, n]) => `${POLC[k][0]} ${n}`).join(' · ')} agent runs`, 'map', {}],
        ['4p', 'Product · Price · Place · Promotion', `${growth.length} outreach prospects · ${deals.length} deal leads`, 'growth', {}],
        ['cia', 'Security (confidentiality, integrity, availability)', `${lock ? 'App lock on' : 'App lock off'} · ${cloud === 'local' ? 'data on this device only' : 'encrypted cloud sync'}`, 'settings', {}],
        ['legal', 'Legal & risk', legal === null ? 'Check each unit in Legal' : `${legal}% protected across units`, 'legal', {}]],
      unusual: un
    };
  }
  const INFO = {
    time: ['Foundations', 'Pick the few things that matter most, then protect time for them. Today’s three turns everything that needs you into three objectives a day.', ['Do the hardest objective first.', 'Work in focused blocks (Pomodoro: 25 minutes on, 5 off).', 'Anything not in the three can wait or be delegated.']],
    capture: ['Foundations', 'Write it down while it’s fresh: decisions, meetings, what you learned. The Brain files everything into sections and links related memories.', ['Cornell method: cues on the left, notes on the right, a summary at the bottom.', 'One note per idea; link with [[double brackets]].']],
    retain: ['Foundations', 'Memory fades on a curve. Reviewing just before you forget (spaced repetition) keeps it for good.', ['Review cards daily: a few minutes.', 'Chunk big topics into small cards.']],
    learn: ['Foundations', 'Learning is a loop: survey, question, read, recite, review. Notebooks answer only from the sources you pick, so you can study one topic in depth.', ['Make a Notebook per decision or project.', 'Generate a study guide, then turn it into cards.']],
    stats: ['Core mechanics', 'Every unit has its own normal. A day more than two standard deviations from that unit’s usual for the same weekday is unusual, even if it’s inside your fixed targets. The Sales Trend agent now flags these.', ['A z-score of +2 or −2 happens by chance about 1 day in 20.', 'Look for a cause (weather, event, staffing, data error) before reacting.']],
    cause: ['Core mechanics', 'Two things moving together doesn’t mean one causes the other. Agents are instructed to say “linked with”, not “caused by”, and to suggest a way to test it.', ['Test with a small change in one unit and compare with the others.', 'Check for a third factor (season, a holiday, a new competitor).']],
    books: ['Core mechanics', 'Assets (debits) = Liabilities + Equity (credits), under generally accepted accounting principles. The three statements are the income statement, the balance sheet and cash flow.', ['Profit isn’t cash: watch cash flow separately.', 'Keep business and personal money apart.']],
    forecast: ['Core mechanics', 'A plan is only useful if you compare it with what happened. Forecast Miss and Sales Trend do that every morning.', ['Small, frequent corrections beat big late ones.']],
    coach: ['Human experience', 'The four schools of psychology give four ways to coach.', COACH.map(([n, h, w]) => `${n}: ${h} Best for ${w}`)],
    comm: ['Human experience', 'Sender → Message → Channel → Receiver → Feedback, with noise in between (bias, language, emotion). Every draft in Needs your yes gets a quick check: a clear receiver, a clear ask, no shouting, no jargon, a readable length.', ['Say the ask in the first two lines.', 'Pick the channel to match the message: text for quick, email for detail, in person for hard news.']],
    ethics: ['Human experience', 'Three ways to weigh what’s right, now part of every decision brief.', ETHICS.map(([, l, q]) => `${l}: ${q}`)],
    decide: ['Human experience', 'Seven questions before a big decision: the problem, the evidence, the options, the trade-offs, what comes next, how reversible, and what would change your mind.', ['Hard-to-reverse decisions need every answer.', 'Set the review date before you start.']],
    polc: ['Applied systems', 'The four management functions. Each of your departments is mainly one of them.', Object.values(POLC).map(([l, d, ds]) => `${l}: ${d} (${ds.map(x => UC.dept(x)?.short || x).join(', ')})`)],
    '4p': ['Applied systems', 'Product, Price, Place, Promotion, wrapped in customer behavior and market segments. Growth handles promotion and new markets; Deals adds new places.', ['Change one P at a time and measure it.']],
    cia: ['Applied systems', 'Confidentiality (data stays private), Integrity (data stays unchanged), Availability (data is there when you need it).', ['Turn on the app lock.', 'Use encrypted cloud sync so a lost laptop isn’t lost data.', 'Watch for phishing and social engineering: most breaches start with an email.']],
    legal: ['Applied systems', 'Structure protects you: entity, insurance, written policies, incident reports. The Legal screen shows each unit’s gaps.', ['Fix high-risk gaps first.']]
  };

  UC.science = { zDay, unusual, describe, comm, ETHICS, POLC, polcOf, COACH, status, INFO, mean, sd };
})(window.UC);
