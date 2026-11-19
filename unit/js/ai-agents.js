/* AI agents: the 124 agents that think. They run on Ollama on your computer (through the desktop app's local relay),
   read the data they're allowed to read, follow the Knowledge docs and their workflow, and return structured results:
   a log line, flags, a deliverable, and (if they need sign-off) a draft in Needs your yes.
   Results are saved in the synced "agentout" store, so the phone shows them even though it can't run Ollama. */
(function (UC) {
  const { esc } = App;
  const money = v => App.fmt.money(v);
  const pct = v => isNaN(v) ? '—' : (v * 100).toFixed(1) + '%';
  const KEEP = 8;           // results kept per agent
  const MAX_OUT = 12000;    // characters kept per result

  /* ---------- Knowledge (read by every agent) ---------- */
  const KDOCS = [['sops', 'SOPs', 'How things are done: opening, closing, food safety, cash, service…'], ['brand-voice', 'Brand voice', 'How you sound: words you use and avoid, tone with guests and staff'],
    ['price-book', 'Price book', 'Prices, packages, allowed discounts and who can approve more'], ['contracts', 'Contracts & terms', 'Standard terms, policies and what agents may promise']];
  const knowledge = () => UC.S.get('knowledge', {});
  const setKnowledge = (k, v) => { const all = knowledge(); all[k] = v; UC.S.set('knowledge', all); };

  /* ---------- AI availability (cached) ---------- */
  let st = { checked: 0, running: false, models: [], error: '' };
  async function status(force) {
    if (!force && Date.now() - st.checked < 60000) return st;
    if (App.hosted || !App.ai) { st = { checked: Date.now(), running: false, models: [], error: 'Agents think on your computer. Open Unit Command in the Ops Command Desk desktop app to run them; results show here.' }; return st; }
    const s = await App.ai.ollamaStatus();
    st = { checked: Date.now(), running: s.running && s.models.length > 0, models: s.models || [], error: s.running ? (s.models.length ? '' : 'Ollama is running but has no model yet.') : (s.error || 'Ollama is not running.'), version: s.version };
    App.bus.emit('uc-ai');
    return st;
  }
  const model = () => App.settings.get(App.ai?.modelKey?.('ollama') || 'ai.ollama.model', '') || st.models[0] || '';

  /* ---------- context: the data each agent may read ---------- */
  async function context(a, opts = {}) {
    const ctx = opts.ctx || await UC.engine.context();
    const parts = [];
    const k = knowledge();
    const kb = KDOCS.map(([id, name]) => k[id] ? `### ${name}\n${String(k[id]).slice(0, 2500)}` : '').filter(Boolean).join('\n\n');
    parts.push(`## Knowledge (read first)\n${kb || 'No knowledge docs written yet. Use plain, friendly, professional language and standard practice.'}`);
    if (a.reads.some(r => ['pos', 'labor', 'units', 'inv'].includes(r))) parts.push(unitsBlock(ctx));
    if (a.reads.includes('ventures') || ['venture', 'multi'].includes(a.dept)) parts.push(venturesBlock(opts.ventureId));
    if (a.reads.includes('ap')) parts.push(await purchasesBlock(ctx));
    if (UC.brain) {
      try {
        const mem = await UC.brain.forAgent(a, opts.input || ''); if (mem) parts.push(mem);
        if (a.reads.some(r => ['pos', 'labor', 'units'].includes(r))) { const y = UC.brain.yoyText(await UC.brain.facts(), null, UC.data.lastDate(ctx.real || [])); if (y) parts.push(y); }
      } catch (e) { console.warn('brain context', e); }
    }
    const missing = a.reads.filter(r => !UC.AVAILABLE.includes(r));
    if (missing.length) parts.push(`## Not connected\nThis agent normally reads ${missing.map(r => UC.NOT_CONNECTED[r] || r).join(', ')}, which isn’t connected. Use only what the owner pasted below; list anything else you need under "missing".`);
    return { text: parts.join('\n\n'), ctx };
  }
  function unitsBlock(ctx) {
    const end = ctx.end, T = UC.targets();
    if (!ctx.units.length) return '## Units\nNo unit sales or labor data has been imported yet.';
    const D = UC.data;
    const line = u => {
      const d = D.stats(D.windowRows(u, end, 1)), w = D.stats(D.windowRows(u, end, 7)), p = D.stats(D.prior(u, end, 7)), m = D.stats(D.windowRows(u, end, 28));
      return `| ${u.name} | ${money(d.sales)} | ${money(w.sales)} | ${p.sales ? ((w.sales - p.sales) / p.sales * 100).toFixed(1) + '%' : '—'} | ${w.forecast ? ((w.vsFc) * 100).toFixed(1) + '%' : '—'} | ${pct(w.laborPct)} | ${isNaN(w.splh) ? '—' : '$' + w.splh.toFixed(0)} | ${w.ot.toFixed(1)} | ${money(m.sales)} | ${pct(m.laborPct)} | ${u.avt ? '+' + u.avt.gapPts + ' pts' : '—'} |`;
    };
    const days = ctx.units.map(u => `${u.name}: ` + D.windowRows(u, end, 14).map(r => `${r.date.slice(5)} ${Math.round(r.sales)}${r.forecast ? '/' + Math.round(r.forecast) : ''}`).join(', ')).join('\n');
    return `## Units (data through ${end}${ctx.demo ? '; DEMO DATA, made up for testing' : ''})
Targets: labor ${T.laborPct}%, SPLH $${T.splh}, prime cost ${T.primeCost}%, overtime ${T.otHours} h/unit/week, food cost within ${T.avtGap} pts of theoretical.
| Unit | Latest day | Last 7 days | vs prior 7 | vs forecast (7d) | Labor % (7d) | SPLH (7d) | OT h (7d) | Last 28 days | Labor % (28d) | Food vs theo |
|---|---|---|---|---|---|---|---|---|---|---|
${ctx.units.map(line).join('\n')}

Daily sales, last 14 days (sales/forecast):
${days}`;
  }
  function venturesBlock(id) {
    const vs = UC.engine.ventures().filter(v => !id || v.id === id);
    if (!vs.length) return '## Ventures\nNo ventures yet.';
    return '## Ventures\n' + vs.map(v => {
      const stage = UC.engine.STAGES.find(s => s.id === v.stage);
      const items = (v.check[v.stage] || []).map(i => `- [${i.done ? 'x' : ' '}] ${i.t}${i.due ? ` (due ${i.due})` : ''}`).join('\n');
      return `### ${v.name}\nType: ${App.biz.TEMPLATES[v.type]?.label || v.type} · Stage: ${stage?.name} · Target opening: ${v.open || 'not set'}${v.sample ? ' · (example venture)' : ''}\n${v.notes ? 'Notes: ' + v.notes + '\n' : ''}Current stage checklist:\n${items}`;
    }).join('\n\n');
  }
  async function purchasesBlock(ctx) {
    const list = (ctx.real || []).flatMap(u => (u.purchaseList || []).map(p => ({ ...p, unit: u.name })));
    if (!list.length) return '## Purchases\nNo invoices or purchase journal imported yet.';
    const since = new Date(); since.setDate(since.getDate() - 28); const from = App.dateKey(since);
    const recent = list.filter(p => (p.date || '') >= from);
    const byVendor = {}; recent.forEach(p => { byVendor[p.vendor || 'Unknown'] = (byVendor[p.vendor || 'Unknown'] || 0) + (+p.total || 0); });
    const changes = App.purchasing?.priceChanges ? App.purchasing.priceChanges(list).slice(0, 15) : [];
    return `## Purchases (last 28 days)\nTotal ${money(recent.reduce((a, p) => a + (+p.total || 0), 0))} across ${recent.length} invoices.\nBy vendor: ${Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([v, t]) => `${v} ${money(t)}`).join('; ')}
${changes.length ? 'Price changes: ' + changes.map(c => `${c.item} ${(c.change * 100).toFixed(0)}% (${c.vendor}, ${c.date})`).join('; ') : ''}`;
  }

  /* ---------- run one agent ---------- */
  const SCHEMA = { type: 'object', properties: {
    summary: { type: 'string' }, flags: { type: 'array', items: { type: 'string' } }, output: { type: 'string' },
    send_to: { type: 'string', enum: ['you', 'team', 'clients'] }, recipient: { type: 'string' }, missing: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'output'] };

  function prompts(a, data, input) {
    const d = UC.dept(a.dept);
    const fmtHint = UC.formatFor(a.key);
    const system = `You are the "${a.name}" agent in ${UC.BRAND.name}, the operating system an owner uses to create, run and multiply businesses. Department: ${d.name}.
${UC.deptGuide(a.dept)}
Rules:
- Follow the Knowledge section (SOPs, brand voice, price book, terms) above everything else.
- Use the Memory section: build on your past results, and follow the owner's past decisions (don't repeat what they declined).
- Use only the numbers and facts provided. Never invent figures, names, prices or dates; if something is missing, say so and add it to "missing".
- Be specific and practical. Prefer short tables and numbered steps. No filler.
- Correlation is not causation: when two things move together, say they are linked, name other possible factors, and suggest a simple test. Judge numbers against each unit's own normal range, not only fixed targets.
- Communicate clearly: the main point and the ask first, plain words, no jargon, no all caps.
- ${a.signoff ? 'Your output is a DRAFT for the owner to approve. Nothing is sent until they say yes. Write it ready to send.' : 'You report and flag; you do not send anything.'}
- "Demo data" is made up for testing; say so if you rely on it.
Reply with JSON only: {"summary": one or two sentences for the agent log, "flags": [short items that need the owner's attention, or empty], "output": the full deliverable in Markdown, "send_to": "you" | "team" | "clients", "recipient": who it is for (if a draft), "missing": [information you needed but didn't have]}.`;
    const user = `# Task\n${UC.workflow(a)}\n${fmtHint ? `\n## Output format\n${fmtHint}\n` : ''}\n# Data you may use\n${data}\n\n# From the owner\n${input?.trim() || '(nothing added)'}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }
  function parse(text) {
    let j = null;
    try { j = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) try { j = JSON.parse(m[0]); } catch { /* not JSON */ } }
    if (!j || typeof j !== 'object') j = { summary: text.split('\n').find(l => l.trim()) || 'Done.', output: text };
    const arr = v => Array.isArray(v) ? v.map(String).filter(Boolean) : v ? [String(v)] : [];
    return { summary: String(j.summary || '').slice(0, 400) || 'Done.', flags: arr(j.flags).slice(0, 8), output: String(j.output || j.summary || '').slice(0, MAX_OUT),
      send_to: ['you', 'team', 'clients'].includes(j.send_to) ? j.send_to : 'you', recipient: String(j.recipient || '').slice(0, 120), missing: arr(j.missing).slice(0, 8) };
  }

  const running = new Set();
  async function run(a, opts = {}) {
    if (typeof a === 'string') a = UC.agent(a);
    const s = await status();
    if (!s.running) throw new Error(s.error || 'Ollama is not ready.');
    if (running.has(a.id)) throw new Error(`${a.name} is already running.`);
    running.add(a.id); App.bus.emit('uc-ai');
    try {
      const { text: data, ctx } = await context(a, opts);
      const messages = prompts(a, data, opts.input);
      let r;
      try { r = await App.ai.ollamaChat({ messages, format: SCHEMA, ctx: +App.settings.get('ai.ollama.ctx', 12288) || 12288 }); }
      catch (e) { if (/format|schema|400/i.test(e.message)) r = await App.ai.ollamaChat({ messages, format: 'json' }); else throw e; }
      const res = parse(r.text);
      const rec = { id: App.uid(), agent: a.id, dept: a.dept, t: Date.now(), model: r.model, ms: r.ms, input: (opts.input || '').slice(0, 4000), venture: opts.ventureId || '', demo: !!ctx.demo, auto: !!opts.auto, ...res };
      await App.store.put('agentout', rec);
      prune(a.id);
      const kind = a.signoff ? 'waiting' : res.flags.length ? 'flag' : 'done';
      const asks = a.signoff ? [{ lane: res.send_to, to: res.recipient, title: `${a.output}${res.recipient ? ' for ' + res.recipient : ''}`, detail: res.output.slice(0, 6000), out: rec.id }] : [];
      UC.engine.push(a.id, { text: res.summary + (res.flags.length ? ' Flags: ' + res.flags.join('; ') : '') + (res.missing.length ? ' Needs: ' + res.missing.join('; ') : ''), kind, asks, out: rec.id, ai: true }, ctx);
      return rec;
    } finally { running.delete(a.id); App.bus.emit('uc-ai'); }
  }
  async function prune(agent) {
    const all = (await App.store.all('agentout', { raw: true })).filter(r => r.agent === agent).sort((x, y) => y.t - x.t);
    for (const r of all.slice(KEEP)) await App.store.del('agentout', r.id);
  }
  const outputs = async agent => (await App.store.all('agentout', { raw: true }).catch(() => [])).filter(r => !agent || r.agent === agent).sort((x, y) => y.t - x.t);

  /* ---------- autopilot: run due agents while the desktop app is open ---------- */
  const auto = () => ({ on: false, ventures: true, ...UC.S.get('autopilot', {}) });
  const isDue = (a, last, now = new Date()) => {
    const c = UC.cadence(a); if (!last) return true;
    const l = new Date(last), day = x => App.dateKey(x);
    if (c.kind === 'daily') return day(l) !== day(now);
    if (c.kind === 'weekly') return (now.getDay() === c.day && day(l) !== day(now)) || now - l > 7 * 864e5;
    if (c.kind === 'monthly') return l.getMonth() !== now.getMonth() || l.getFullYear() !== now.getFullYear();
    if (c.kind === 'quarterly') return Math.floor(l.getMonth() / 3) !== Math.floor(now.getMonth() / 3) || l.getFullYear() !== now.getFullYear();
    return false;
  };
  function dueList(ctx) {
    const stt = UC.engine.state(), list = [];
    for (const a of UC.AGENTS) {
      if (a.rule || stt.off[a.id] || !UC.enabledAgent(a) || !UC.canAuto(a)) continue;
      const c = UC.cadence(a);
      if (c.kind === 'stage') {
        if (!auto().ventures) continue;
        for (const v of UC.engine.ventures().filter(v => v.stage === c.stage && !v.sample)) if (!stt.stageRuns?.[`${a.id}@${v.id}:${c.stage}`]) list.push({ a, ventureId: v.id, key: `${a.id}@${v.id}:${c.stage}` });
      } else if (!ctx.demo && isDue(a, stt.runs[a.id])) list.push({ a });
    }
    return list;
  }
  let queue = [], busy = false, done = 0;
  async function tick(force) {
    if (busy || (!auto().on && !force)) return;
    const s = await status(true); if (!s.running) return;
    const ctx = await UC.engine.context();
    queue = dueList(ctx); done = 0;
    if (!queue.length) { if (force) App.ui.toast('No agents are due right now'); return; }
    busy = true; App.bus.emit('uc-ai');
    try {
      while (queue.length) {
        const job = queue.shift();
        try { await run(job.a, { auto: true, ventureId: job.ventureId, ctx }); if (job.key) UC.engine.markStage(job.key); }
        catch (e) { console.warn(job.a.id, e); UC.engine.push(job.a.id, { text: `${job.a.name} couldn’t run: ${e.message}`, kind: 'flag' }, ctx); if (/not running|not ready|reach/i.test(e.message)) break; }
        done++; App.bus.emit('uc-ai');
      }
    } finally { busy = false; queue = []; App.bus.emit('uc-ai'); }
  }
  const progress = () => ({ busy, done, left: queue.length, running: [...running] });
  function startAutopilot() {
    if (App.hosted) return;
    setTimeout(() => tick(), 15000);
    setInterval(() => tick(), 30 * 60000);
  }

  UC.ai = { status, run, outputs, context, knowledge, setKnowledge, KDOCS, auto, setAuto: v => UC.S.set('autopilot', { ...auto(), ...v }), tick, dueList, progress, startAutopilot, model, isRunning: id => running.has(id) };
})(window.UC);
