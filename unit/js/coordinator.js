/* Coordinator: give it one goal; it breaks the goal into tasks, assigns each to the right agents, runs them in
   order (respecting dependencies), tracks progress, answers "Where are we?", takes side questions without derailing
   the work, can fork a project to try another approach, and meters how much AI time it uses.
   Projects are saved in settings (synced) and remembered by the Brain. */
(function (UC) {
  const { S } = UC;
  const list = () => S.get('projects', []);
  const save = l => { S.set('projects', l.slice(-60)); App.bus.emit('uc-projects'); App.bus.emit('uc-changed'); };
  const get = id => list().find(p => p.id === id);
  const put = p => { const l = list(); const i = l.findIndex(x => x.id === p.id); p.updated = Date.now(); if (i >= 0) l[i] = p; else l.push(p); save(l); return p; };

  const TEMPLATES = [
    { id: 'labor', name: 'Bring a unit’s labor % under target', goal: 'Get {unit} labor under {target}% within 4 weeks without hurting sales or service.' },
    { id: 'open', name: 'Open a new location', goal: 'Plan and open a new {type} location by {date}: site, lease, budget, permits, hiring, opening playbook and marketing.' },
    { id: 'sales', name: 'Grow sales at a unit', goal: 'Grow {unit} weekly sales 10% over the next 6 weeks: find what is slipping, fix pricing and mix, and run local marketing.' },
    { id: 'close', name: 'Month-end close', goal: 'Close last month for every unit: reconcile, categorize, P&L vs budget, prime cost, and a CPA packet.' },
    { id: 'hire', name: 'Hire for a role', goal: 'Hire a {role} for {unit}: job post, screen applicants, interview questions and an onboarding pack.' },
    { id: 'food', name: 'Cut food cost', goal: 'Bring {unit} food cost within 1 point of theoretical: find the gaps, fix pars and order guides, and check vendor prices.' }
  ];

  /* ---------- planning ---------- */
  const catalogText = () => UC.AGENTS.filter(UC.enabledAgent).map(a => `${a.id} | ${a.name} | ${a.does.slice(0, 80)}`).join('\n');
  /* Offline fallback: pick agents whose name/purpose best match the goal */
  const STOPW = new Set('bring check make help plan week weeks unit units within point under over the and for with from into this that next last more less get keep every each all our your'.split(' '));
  const stem = w => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
  function plainPlan(goal) {
    const g = goal.toLowerCase();
    const words = [...new Set(g.split(/[^a-z0-9%]+/).filter(w => w.length > 3 && !STOPW.has(w)).map(stem))];
    const wantVenture = /venture|open|launch|new location|second location|start a|business plan|funding|lease|site/.test(g);
    const scored = UC.AGENTS.filter(a => UC.enabledAgent(a) && a.dept !== 'knowledge' && (wantVenture || !['venture', 'multi'].includes(a.dept))).map(a => {
      const name = a.name.toLowerCase().split(/[^a-z0-9%]+/).map(stem), body = (a.does + ' ' + a.output).toLowerCase().split(/[^a-z0-9%]+/).map(stem);
      const s = words.reduce((n, w) => n + (name.includes(w) ? 4 : 0) + (body.includes(w) ? 1 : 0), 0);
      return { a, s: s + (s && a.rule ? 1 : 0) };
    }).filter(x => x.s >= 2).sort((x, y) => y.s - x.s).slice(0, 6);
    const rules = scored.filter(x => x.a.rule), rest = scored.filter(x => !x.a.rule);
    const ordered = [...rules, ...rest];
    return { summary: `Plan built from the agent catalog (AI off): ${ordered.length} steps, data checks first, then the work.`,
      tasks: ordered.map(x => ({ title: x.a.name, agent: x.a.id, why: x.a.does, input: goal, after: x.a.rule ? [] : rules.map((_, k) => k) })) };
  }
  async function aiPlan(goal, extra = '') {
    const st = await UC.ai.status();
    if (!st.running) return null;
    const mem = UC.brain ? await UC.brain.search(goal, { limit: 4, semantic: false }).catch(() => []) : [];
    const sys = `You are the Coordinator in ${UC.BRAND.name}: you break one business goal into a short plan and assign each step to the best agent from the catalog. Use only agent ids from the catalog. 3 to 8 steps. Put data checks (rules agents like sales/flash, people/labor-pct) before work that depends on them. Each step's "input" tells that agent exactly what to do for this goal. "after" lists the step numbers (0-based) it must wait for. Reply with JSON only: {"summary": one sentence, "tasks": [{"title": short, "agent": catalog id, "why": one line, "input": instruction for the agent, "after": [numbers]}]}.`;
    const user = `Goal: ${goal}\n${extra ? `Approach to try: ${extra}\n` : ''}${mem.length ? `\nRelevant memories:\n${mem.map(h => `- ${h.n.title}: ${String(h.n.body).slice(0, 200).replace(/\n/g, ' ')}`).join('\n')}\n` : ''}\nAgent catalog (id | name | what it does):\n${catalogText()}`;
    const r = await App.ai.ollamaChat({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], format: 'json', ctx: 16384 });
    let j; try { j = JSON.parse(r.text); } catch { const m = r.text.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; }
    if (!j?.tasks?.length) return null;
    const byName = n => UC.AGENTS.find(a => a.name.toLowerCase() === String(n).toLowerCase());
    const tasks = j.tasks.slice(0, 8).map(t => ({ ...t, agent: UC.agent(t.agent) ? t.agent : byName(t.agent)?.id || byName(t.title)?.id })).filter(t => t.agent);
    return tasks.length ? { summary: String(j.summary || ''), tasks, model: r.model, ms: r.ms } : null;
  }
  async function plan(p) {
    let pl = null, how = 'catalog';
    try { pl = await aiPlan(p.goal, p.approach); if (pl) how = 'ai'; } catch (e) { console.warn('plan', e); }
    if (!pl) pl = plainPlan(p.goal + ' ' + (p.approach || ''));
    p.summary = pl.summary; p.planner = how;
    p.tasks = pl.tasks.map((t, i) => ({ id: App.uid(), n: i, title: String(t.title || UC.agent(t.agent).name).slice(0, 80), agent: t.agent, why: String(t.why || '').slice(0, 160), input: String(t.input || p.goal).slice(0, 1200),
      after: (Array.isArray(t.after) ? t.after : []).map(Number).filter(k => k >= 0 && k < i), status: 'todo', out: '', summary: '', ms: 0 }));
    p.status = 'ready';
    note(p, `Planned ${p.tasks.length} steps (${how === 'ai' ? 'AI plan' : 'from the agent catalog'}).`);
    return put(p);
  }
  const note = (p, text, kind = 'info') => { p.log = [...(p.log || []), { t: Date.now(), text, kind }].slice(-80); };

  async function create(goal, opts = {}) {
    const p = { id: App.uid(), goal: goal.trim(), approach: opts.approach || '', forkOf: opts.forkOf || '', status: 'planning', created: Date.now(), tasks: [], log: [], asks: [], usage: { ms: 0, runs: 0 } };
    put(p);
    return plan(p);
  }

  /* ---------- running (one task at a time on Ollama; rules agents are instant) ---------- */
  let busy = null;
  const ready = p => p.tasks.filter(t => t.status === 'todo' && t.after.every(k => p.tasks[k]?.status === 'done' || p.tasks[k]?.status === 'waiting'));
  async function runNext(id) {
    const p = get(id); if (!p || p.status !== 'running') return false;
    const t = ready(p)[0];
    if (!t) {
      if (p.tasks.every(x => ['done', 'waiting', 'skipped'].includes(x.status))) { p.status = 'done'; note(p, `All ${p.tasks.length} steps finished.`, 'done'); put(p); App.ui.toast(`Project done: ${p.goal.slice(0, 60)}`); }
      else if (!p.tasks.some(x => x.status === 'running')) { p.status = 'blocked'; note(p, 'Stopped: a step failed or is waiting on something.', 'flag'); put(p); }
      return false;
    }
    const a = UC.agent(t.agent);
    t.status = 'running'; t.started = Date.now(); put(p); App.bus.emit('uc-projects');
    try {
      const prior = p.tasks.filter(x => x.status === 'done' && x.summary).map(x => `- ${x.title}: ${x.summary}`).join('\n');
      const input = `Project goal: ${p.goal}\nYour step: ${t.title}. ${t.input}\n${prior ? `\nWhat the other steps found so far:\n${prior}` : ''}`;
      if (a.rule) { const [e] = await UC.engine.run([a.id]); t.summary = e?.text || 'Ran.'; t.ms = 1; }
      else {
        const rec = await UC.ai.run(a, { input, ventureId: p.ventureId || '' });
        t.summary = rec.summary; t.out = rec.id; t.ms = rec.ms || 0; t.flags = rec.flags || [];
        p.usage.ms += rec.ms || 0;
      }
      p.usage.runs++;
      const f = get(id) || p; // re-read in case of edits
      const tt = f.tasks.find(x => x.id === t.id) || t;
      Object.assign(tt, { status: a.signoff ? 'waiting' : 'done', summary: t.summary, out: t.out, ms: t.ms, flags: t.flags, finished: Date.now() });
      f.usage = p.usage;
      note(f, `${tt.title}: ${t.summary}`.slice(0, 400), a.signoff ? 'waiting' : 'done');
      put(f);
    } catch (e) {
      const f = get(id) || p; const tt = f.tasks.find(x => x.id === t.id) || t;
      tt.status = 'failed'; tt.summary = e.message; note(f, `${tt.title} couldn’t run: ${e.message}`, 'flag'); put(f);
      if (/not running|not ready|reach|Ollama/i.test(e.message)) { f.status = 'paused'; note(f, 'Paused: the AI isn’t available. It continues when you press Run.', 'flag'); put(f); return false; }
    }
    return true;
  }
  async function start(id) {
    const p = get(id); if (!p) return;
    if (['done'].includes(p.status)) return;
    p.tasks.forEach(t => { if (t.status === 'failed') t.status = 'todo'; });
    p.status = 'running'; note(p, 'Started.'); put(p);
    pump();
  }
  function pause(id) { const p = get(id); if (!p) return; p.status = 'paused'; note(p, 'Paused by you.'); put(p); }
  /* One worker walks every running project, one step at a time */
  async function pump() {
    if (busy) return; busy = true;
    try { for (let guard = 0; guard < 200; guard++) { const p = list().find(x => x.status === 'running' && ready(x).length); if (!p) { list().filter(x => x.status === 'running').forEach(x => runNext(x.id)); break; } await runNext(p.id); } }
    finally { busy = null; App.bus.emit('uc-projects'); }
  }

  /* ---------- status, side questions, fork ---------- */
  function statusReport(p) {
    const by = s => p.tasks.filter(t => t.status === s);
    const done = by('done').length + by('waiting').length, total = p.tasks.length;
    const lines = [
      `${done} of ${total} steps done${p.status === 'done' ? ', project complete' : ''}.`,
      ...by('done').concat(by('waiting')).slice(-4).map(t => `✓ ${t.title}${t.status === 'waiting' ? ' (draft waiting for your yes)' : ''}: ${t.summary.slice(0, 140)}`),
      ...by('running').map(t => `… ${t.title} is running now.`),
      ...by('failed').map(t => `! ${t.title} failed: ${t.summary.slice(0, 120)}`),
      ...(ready(p).length && p.status !== 'running' ? [`Next: ${ready(p)[0].title}.`] : [])
    ];
    return { done, total, pct: total ? done / total : 0, lines };
  }
  async function whereAreWe(id) {
    const p = get(id), r = statusReport(p), st = await UC.ai.status();
    if (!st.running) return r.lines.join('\n');
    const res = await App.ai.ollamaChat({ messages: [{ role: 'system', content: 'You are the project coordinator. Give a short status report: what is done, what is running, what is blocked, what needs the owner, and the next step. 5 lines max. Plain language.' },
      { role: 'user', content: `Goal: ${p.goal}\nSteps:\n${p.tasks.map(t => `- [${t.status}] ${t.title}: ${t.summary || t.why}`).join('\n')}` }] });
    note(p, 'Status report requested.'); put(p);
    return res.text;
  }
  /* /btw: answer a side question from the project and the Brain without touching the plan */
  async function btw(id, q) {
    const p = get(id), st = await UC.ai.status();
    const hits = UC.brain ? await UC.brain.search(q, { limit: 5 }).catch(() => []) : [];
    if (!st.running) return `AI is off. Closest memories: ${hits.map(h => h.n.title).join('; ') || 'none'}.`;
    const r = await App.ai.ollamaChat({ messages: [{ role: 'system', content: 'Answer the owner’s side question briefly from the project and memories. Do not change the plan.' },
      { role: 'user', content: `Question: ${q}\n\nProject: ${p.goal}\n${p.tasks.map(t => `- [${t.status}] ${t.title}: ${t.summary}`).join('\n')}\n\nMemories:\n${hits.map(h => `- ${h.n.title}: ${String(h.n.body).slice(0, 400)}`).join('\n')}` }] });
    p.asks = [...(p.asks || []), { t: Date.now(), q, a: r.text }].slice(-30); put(p);
    return r.text;
  }
  async function fork(id, approach) {
    const p = get(id);
    const f = await create(p.goal, { approach, forkOf: p.id });
    f.name = `Fork: ${approach.slice(0, 70)}`; put(f);
    return f;
  }
  function remove(id) { save(list().filter(p => p.id !== id)); }
  function setTasks(id, fn) { const p = get(id); fn(p); return put(p); }

  /* Usage meter: AI minutes today vs your daily budget (local AI is free, but it ties up the computer) */
  function usageToday() {
    const today = App.dateKey(new Date());
    const ms = UC.engine.state().log.filter(e => e.date === today && e.ai).length; // runs today
    const time = list().reduce((a, p) => a + (p.tasks || []).filter(t => t.finished && App.dateKey(new Date(t.finished)) === today).reduce((b, t) => b + (t.ms || 0), 0), 0);
    const budget = (UC.S.get('coord.budgetMin', 60)) * 60000;
    return { runs: ms, ms: time, budget, pct: Math.min(1, time / budget) };
  }

  // Keep running projects moving while the app is open (desktop)
  setTimeout(() => { if (!App.hosted) pump(); }, 20000);
  setInterval(() => { if (!App.hosted) pump(); }, 5 * 60000);

  UC.coord = { list, get, create, plan, start, pause, pump, statusReport, whereAreWe, btw, fork, remove, setTasks, usageToday, TEMPLATES, busy: () => !!busy, ready };
})(window.UC);
