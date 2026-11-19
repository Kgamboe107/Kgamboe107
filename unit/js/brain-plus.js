/* Brain upgrade: Daily objectives, Planetary view, Notebooks (NotebookLM-style) and Review cards (Anki-style). */
(function (UC) {
  const { esc } = App;
  const S = UC.S;
  const today = () => App.dateKey(new Date());

  /* ---------- Daily objectives: three a day, from what actually needs you ---------- */
  async function candidates() {
    const st = UC.engine.state(), out = [];
    const pend = st.asks.filter(a => a.status === 'pending');
    if (pend.length) out.push({ p: 10, text: `Clear ${pend.length} approval${pend.length > 1 ? 's' : ''} in Needs your yes`, go: 'today', src: 'approvals' });
    for (const pr of (UC.coord?.list() || []).filter(x => ['running', 'ready', 'paused', 'blocked'].includes(x.status))) {
      const next = UC.coord.ready(pr)[0] || pr.tasks.find(t => t.status === 'failed');
      if (next) out.push({ p: pr.status === 'blocked' ? 9 : 8, text: `${pr.status === 'blocked' ? 'Unblock' : 'Move'} “${(pr.name || pr.goal).slice(0, 48)}”: ${next.title}`, go: 'projects', params: { id: pr.id }, src: 'project' });
    }
    const flag = st.log.filter(e => e.date === today() && e.kind === 'flag')[0];
    if (flag) out.push({ p: 7, text: `${UC.agent(flag.agent)?.name || 'An agent'}: ${flag.text.length > 64 ? flag.text.slice(0, 62).replace(/[\s,;:]+\S*$/, '') + '…' : flag.text}`, agent: flag.agent, src: 'flag' });
    const ready = UC.growth ? (await UC.growth.all()).filter(p => p.status === 'approved').length : 0;
    if (ready) out.push({ p: 6, text: `Send ${ready} approved outreach email${ready > 1 ? 's' : ''}`, go: 'growth', src: 'growth' });
    const td = new Date().toISOString().slice(0, 10);
    for (const v of UC.engine.ventures().filter(v => !v.sample)) { const it = (v.check[v.stage] || []).find(i => !i.done); if (it) out.push({ p: it.due && it.due < td ? 8 : 5, text: `${v.name}: ${it.t}`, go: 'ventures', src: 'venture' }); }
    for (const b of (UC.decide?.due() || []).slice(0, 2)) out.push({ p: 9, text: `Reassess “${b.title.slice(0, 50)}”: continue, adjust or stop?`, go: 'decide', params: { id: b.id }, src: 'brief' });
    const talks = UC.deals ? (await UC.deals.all()).filter(p => ['talking', 'nda', 'loi', 'diligence'].includes(p.stage)) : [];
    for (const p of talks.slice(0, 2)) out.push({ p: 6, text: `Deal: next step with ${p.name} (${UC.deals.STAGES.find(s => s[0] === p.stage)[1]})`, go: 'growth', params: { mode: 'deals' }, src: 'deal' });
    try { for (const { u, a } of (await UC.legalAssessAll?.() || []).filter(x => x.a)) { const g = a.gaps.find(x => x.sev === 3); if (g) { out.push({ p: 7, text: `${u.name} legal: ${g.q.length > 60 ? g.q.slice(0, 58).replace(/\s+\S*$/, '') + '…' : g.q}`, go: 'legal', params: { unit: u.id, tab: 'fix' }, src: 'legal' }); break; } } } catch { /* optional */ }
    const due = dueCards().length;
    if (due) out.push({ p: 4, text: `Review ${due} card${due > 1 ? 's' : ''} (about ${Math.max(1, Math.round(due * 0.15))} min)`, go: 'brain', params: { tab: 'review' }, src: 'review' });
    out.push({ p: 1, text: 'Write one note in the Brain about something you learned today', go: 'brain', src: 'note' });
    return out.sort((a, b) => b.p - a.p);
  }
  async function objectives(force) {
    let o = S.get('objectives', {});
    if (force || o.date !== today() || !o.items?.length) {
      const keep = o.date === today() ? (o.items || []).filter(i => i.done) : [];
      const c = (await candidates()).filter(x => !keep.some(k => k.text === x.text)).slice(0, Math.max(0, 3 - keep.length));
      o = { date: today(), items: [...keep, ...c.map(x => ({ id: App.uid(), ...x, done: false }))].slice(0, 3) };
      S.set('objectives', o); logObj(o);
    }
    return o;
  }
  function logObj(o) { const l = S.get('objectivesLog', []).filter(x => x.date !== o.date); l.push({ date: o.date, t: Date.now(), items: o.items.map(i => ({ text: i.text, done: i.done })) }); S.set('objectivesLog', l.slice(-1500)); }
  function toggle(id) { const o = S.get('objectives', {}); const i = (o.items || []).find(x => x.id === id); if (i) { i.done = !i.done; S.set('objectives', o); logObj(o); } return o; }
  /* Today's card */
  UC.objectivesCard = async () => {
    const o = await objectives();
    const done = o.items.filter(i => i.done).length;
    return `<section class="card uc-obj"><div class="uc-sh" style="justify-content:space-between"><h2>Today’s three</h2><span class="muted small">${done} of ${o.items.length} done</span></div>
      <div class="uc-alist">${o.items.map(i => `<div class="uc-arow uc-objrow ${i.done ? 'done' : ''}"><label class="uc-ci" style="border:0;min-height:0"><input type="checkbox" data-obj="${i.id}" ${i.done ? 'checked' : ''} aria-label="Done"></label>
        <span><b>${esc(i.text)}</b></span>${i.go || i.agent ? `<button class="btn ghost small" ${i.agent ? `data-agent="${esc(i.agent)}"` : `data-objgo="${i.id}"`}>Open</button>` : ''}</div>`).join('')}</div></section>`;
  };
  UC.bindObjectives = (root, rerender) => {
    root.querySelectorAll('[data-obj]').forEach(b => b.onchange = () => { toggle(b.dataset.obj); rerender?.(); });
    root.querySelectorAll('[data-objgo]').forEach(b => b.onclick = async () => { const i = (await objectives()).items.find(x => x.id === b.dataset.objgo); if (i) UC.go(i.go, i.params || {}); });
  };

  /* ---------- Review cards (spaced repetition, SM-2) ---------- */
  const cards = () => S.get('cards', []);
  const saveCards = l => S.set('cards', l.slice(-1200));
  const dueCards = () => cards().filter(c => !c.suspended && (c.due || 0) <= Date.now());
  async function buildCards() {
    await UC.brain.load();
    const have = new Map(cards().map(c => [c.key, c])), add = [];
    const push = (key, deck, q, a, src) => { if (!have.has(key) && q && a) { const c = { id: App.uid(), key, deck, q: q.slice(0, 300), a: a.slice(0, 400), src, ease: 2.5, ivl: 0, reps: 0, lapses: 0, due: Date.now(), created: Date.now() }; have.set(key, c); add.push(c); } };
    for (const n of UC.brain.notes().values()) {
      if (n.type === 'knowledge') {
        const lines = String(n.body).split('\n').map(l => l.replace(/^[-*\d.)\s]+/, '').trim()).filter(l => l.length > 12);
        for (const l of lines.slice(0, 60)) {
          const kv = l.match(/^\|?\s*([^|:]{3,60})\s*[|:]\s*([^|]{1,80})/);
          if (kv) push(`kb:${n.id}:${kv[1]}`, n.title, `${n.title}: ${kv[1].trim()}?`, kv[2].trim(), n.id);
          else if (/\b(always|never|must|within|at least|no more than|before|after)\b/i.test(l)) { const w = l.match(/\b(\d+\s?(?:°F|°C|minutes?|hours?|days?|%|\$?\d*))\b/); push(`kb:${n.id}:${l.slice(0, 40)}`, n.title, w ? l.replace(w[0], '_____') : `Finish the rule: ${l.split(' ').slice(0, Math.ceil(l.split(' ').length / 2)).join(' ')} …`, w ? w[0] : l, n.id); }
        }
      }
      if (n.type === 'month') {
        const m = String(n.body).match(/\| Labor % \| ([\d.]+%)/), sales = String(n.body).match(/\| Sales \| (\$[\d,]+)/);
        if (m) push(`m:${n.id}:lp`, 'Your numbers', `${n.title}: labor %?`, m[1], n.id);
        if (sales) push(`m:${n.id}:s`, 'Your numbers', `${n.title}: sales?`, sales[1], n.id);
      }
      if (n.type === 'decision' && n.tags.includes('rejected')) push(`d:${n.id}`, 'Your decisions', `You declined this draft. Why might that be? ${n.title.replace(/^No · /, '')}`, 'Check your note under “My notes”, then decide if the agent should stop suggesting it.', n.id);
    }
    const T = UC.targets(), TL = { laborPct: ['Labor % target', '%'], otHours: ['Overtime hours allowed per week', ' h'], splh: ['Sales per labor hour target', ''], primeCost: ['Prime cost target', '%'], forecastMiss: ['Forecast miss that gets flagged', '%'] };
    for (const [k, [lab, unit]] of Object.entries(TL)) push(`t:${k}:${T[k]}`, 'Your targets', `${lab}?`, k === 'splh' ? `$${T[k]}` : `${T[k]}${unit}`, '');
    if (add.length) saveCards([...cards(), ...add]);
    return add.length;
  }
  async function aiCards(noteId) {
    const n = UC.brain.get(noteId); if (!n) return 0;
    const r = await App.ai.ollamaChat({ format: 'json', messages: [{ role: 'system', content: 'Make 5 to 10 flashcards that help a business owner and their managers remember the important, specific facts in this note (numbers, rules, steps, names). Short questions, short exact answers. JSON {"cards":[{"q":...,"a":...}]}.' }, { role: 'user', content: `${n.title}\n\n${String(n.body).slice(0, 6000)}` }] });
    let j; try { j = JSON.parse(r.text); } catch { return 0; }
    const add = (j.cards || []).slice(0, 12).map(c => ({ id: App.uid(), key: `ai:${noteId}:${String(c.q).slice(0, 40)}`, deck: n.title, q: String(c.q).slice(0, 300), a: String(c.a).slice(0, 400), src: noteId, ease: 2.5, ivl: 0, reps: 0, lapses: 0, due: Date.now(), created: Date.now() }));
    saveCards([...cards(), ...add]); return add.length;
  }
  /* SM-2: grade 0 again · 3 hard · 4 good · 5 easy */
  function grade(id, g) {
    const l = cards(), c = l.find(x => x.id === id); if (!c) return;
    if (g < 3) { c.reps = 0; c.ivl = 10 / 1440; c.lapses++; }
    else { c.reps++; c.ivl = c.reps === 1 ? 1 : c.reps === 2 ? (g === 5 ? 4 : 3) : Math.round(c.ivl * c.ease * (g === 3 ? 0.8 : g === 5 ? 1.3 : 1)); }
    c.ease = Math.max(1.3, c.ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
    c.due = Date.now() + c.ivl * 864e5; c.last = Date.now();
    saveCards(l);
  }

  /* ---------- Notebooks (chat with chosen sources; generate guides) ---------- */
  const notebooks = () => S.get('notebooks', []);
  const saveNb = l => S.set('notebooks', l.slice(-50));
  async function nbAsk(nb, q, kind) {
    const src = nb.sources.map(id => UC.brain.get(id)).filter(Boolean);
    const st = await UC.ai.status();
    if (!st.running) throw new Error(st.error || 'AI is off.');
    const PROMPTS = { briefing: 'Write a one-page briefing: the key points, the numbers that matter, risks, and recommended next steps.', faq: 'Write an FAQ: the 8 questions a manager would ask about these sources, each with a short answer.', study: 'Write a study guide: key terms with definitions, the main ideas, and 5 quiz questions with answers.', timeline: 'Write a timeline of events and decisions in date order, one line each.' };
    const r = await App.ai.ollamaChat({ ctx: 16384, messages: [{ role: 'system', content: 'Answer ONLY from the numbered sources. Cite them like [1]. If the sources don’t say, say so. Be concise and concrete.' },
      { role: 'user', content: `${kind ? PROMPTS[kind] : 'Question: ' + q}\n\n# Sources\n${src.map((n, i) => `[${i + 1}] ${n.title} (${n.section})\n${String(n.body).slice(0, Math.floor(10000 / Math.max(1, src.length)))}`).join('\n\n')}` }] });
    const l = notebooks(), x = l.find(b => b.id === nb.id);
    if (kind) x.guides = { ...(x.guides || {}), [kind]: { t: Date.now(), text: r.text } };
    else x.chat = [...(x.chat || []), { t: Date.now(), q, a: r.text }].slice(-40);
    saveNb(l); return r.text;
  }

  /* ---------- Planetary view ---------- */
  let cam = null, focus = null;
  async function planet(el, all) {
    const o = await objectives();
    const ns = all.filter(n => n.type !== 'log');
    const secs = {}; ns.forEach(n => { const s = n.section.split('/')[0]; (secs[s] = secs[s] || []).push(n); });
    const names = Object.keys(secs).sort((a, b) => secs[b].length - secs[a].length);
    el.innerHTML = `<section class="card uc-graphcard"><div class="row spread"><div class="muted tiny">${ns.length} memories in ${names.length} sections · tap a planet to fly in, tap a moon to open it, drag and pinch to move</div><button class="btn small" id="plHome">Center</button></div>
      <canvas id="plC" class="uc-graph uc-planet" aria-label="Planetary view of the Brain"></canvas>
      <div class="uc-plobj">${o.items.map(i => `<span class="${i.done ? 'done' : ''}">${i.done ? '✓' : '○'} ${esc(i.text)}</span>`).join('')}</div></section>`;
    const cv = el.querySelector('#plC'), dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const R = 300, planets = names.map((s, i) => { const a = -Math.PI / 2 + i / names.length * Math.PI * 2; const size = 14 + Math.min(26, Math.sqrt(secs[s].length) * 3);
      const moons = secs[s].sort((x, y) => y.updated - x.updated).slice(0, 160).map((n, k) => ({ n, r: size + 18 + (k % 5) * 11 + Math.floor(k / 40) * 8, a: k * 2.399963, sp: 0.00006 + (k % 7) * 0.00002 }));
      return { s, x: Math.cos(a) * R, y: Math.sin(a) * R, size, color: UC.sectionColor(s), moons }; });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fit = Math.min(W, H) / 820;
    const target = () => focus ? { x: W / 2 - focus.x * 2.2 * fit, y: H / 2 - focus.y * 2.2 * fit, k: 2.2 * fit } : { x: W / 2, y: H / 2, k: fit };
    cam = cam && cv.dataset.keep ? cam : { ...target() };
    let t0 = performance.now(), drag = null, moved = 0, hover = null;
    const world = (cx, cy) => ({ x: (cx - cam.x) / cam.k, y: (cy - cam.y) / cam.k });
    function moonPos(p, m, t) { const a = m.a + (reduced ? 0 : t * m.sp); return { x: p.x + Math.cos(a) * m.r, y: p.y + Math.sin(a) * m.r }; }
    function draw(now) {
      if (!cv.isConnected) return;
      const t = now - t0, tg = target();
      if (!drag) { cam.x += (tg.x - cam.x) * 0.12; cam.y += (tg.y - cam.y) * 0.12; cam.k += (tg.k - cam.k) * 0.12; }
      g.clearRect(0, 0, W, H); g.save(); g.translate(cam.x, cam.y); g.scale(cam.k, cam.k);
      // orbits
      g.strokeStyle = css('--sep'); g.lineWidth = 1 / cam.k;
      [R * 0.42, R, R * 1.55].forEach(r => { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); });
      // core: you + today's objectives
      const grd = g.createRadialGradient(0, 0, 4, 0, 0, 90); grd.addColorStop(0, 'rgba(233,185,73,.55)'); grd.addColorStop(1, 'rgba(233,185,73,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 90, 0, 7); g.fill();
      g.fillStyle = css('--gold'); g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();
      g.fillStyle = css('--gold-ink'); g.font = `700 ${13}px ${css('--font-round')}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('You', 0, 1);
      o.items.forEach((it, i) => { const a = -Math.PI / 2 + i * (Math.PI * 2 / 3) + (reduced ? 0 : t * 0.00008); const x = Math.cos(a) * R * 0.42, y = Math.sin(a) * R * 0.42;
        g.fillStyle = it.done ? css('--green') : css('--gold'); g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
        if (cam.k > fit * 0.9) { g.fillStyle = css('--label-2'); g.font = `500 ${11}px ${css('--font')}`; g.fillText(it.text.slice(0, 28) + (it.text.length > 28 ? '…' : ''), x, y + 18); } });
      // planets + moons
      for (const p of planets) {
        for (const m of p.moons) { const q = moonPos(p, m, t); g.globalAlpha = focus && focus !== p ? 0.25 : 0.85; g.fillStyle = p.color; g.beginPath(); g.arc(q.x, q.y, m === hover ? 4.5 : 2.2, 0, 7); g.fill(); }
        g.globalAlpha = focus && focus !== p ? 0.35 : 1;
        const pg = g.createRadialGradient(p.x - p.size * .3, p.y - p.size * .3, 1, p.x, p.y, p.size); pg.addColorStop(0, '#fff'); pg.addColorStop(.25, p.color); pg.addColorStop(1, p.color + '55');
        g.fillStyle = pg; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill();
        g.fillStyle = css('--label'); g.font = `600 ${13}px ${css('--font')}`; g.fillText(p.s, p.x, p.y + p.size + 16);
        g.fillStyle = css('--label-2'); g.font = `500 ${11}px ${css('--font')}`; g.fillText(`${secs[p.s].length}`, p.x, p.y + p.size + 31);
        g.globalAlpha = 1;
      }
      if (hover) { const p = planets.find(x => x.moons.includes(hover)), q = moonPos(p, hover, t); g.fillStyle = css('--label'); g.font = `600 ${12 / Math.max(1, cam.k / fit / 1.6)}px ${css('--font')}`; g.fillText(hover.n.title.slice(0, 40), q.x, q.y - 10); }
      g.restore();
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    const hit = (cx, cy) => { const w = world(cx, cy), t = performance.now() - t0;
      for (const p of planets) if (Math.hypot(w.x - p.x, w.y - p.y) < p.size + 6) return { p };
      let best = null, bd = 1e9; for (const p of planets) for (const m of p.moons) { const q = moonPos(p, m, t), d = Math.hypot(w.x - q.x, w.y - q.y); if (d < bd && d < 8 / cam.k + 4) { bd = d; best = { m }; } } return best; };
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const touches = new Map(); let pinch = null;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); touches.set(e.pointerId, pos(e)); moved = 0; const [x, y] = pos(e);
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: cam.k }; return; } drag = { x, y, cx: cam.x, cy: cam.y }; });
    cv.addEventListener('pointermove', e => { const [x, y] = pos(e); if (touches.has(e.pointerId)) touches.set(e.pointerId, [x, y]);
      if (pinch && touches.size === 2) { const [a, b] = [...touches.values()]; cam.k = Math.max(.2, Math.min(6, pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); focus = null; cv.dataset.keep = 1; return; }
      if (drag) { if (Math.hypot(x - drag.x, y - drag.y) > 4) { moved++; cam.x = drag.cx + x - drag.x; cam.y = drag.cy + y - drag.y; focus = null; } return; }
      const h = hit(x, y); hover = h?.m || null; cv.style.cursor = h ? 'pointer' : 'grab'; });
    const up = e => { const [x, y] = pos(e); touches.delete(e.pointerId); if (touches.size < 2) pinch = null;
      if (drag && moved < 2) { const h = hit(x, y); if (h?.p) { focus = focus === h.p ? null : h.p; cv.dataset.keep = ''; } else if (h?.m) UC.openNote(h.m.n.id); }
      drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = pos(e), w = world(x, y); focus = null; cv.dataset.keep = 1; cam.k = Math.max(.2, Math.min(6, cam.k * (e.deltaY < 0 ? 1.12 : 0.89))); cam.x = x - w.x * cam.k; cam.y = y - w.y * cam.k; }, { passive: false });
    el.querySelector('#plHome').onclick = () => { focus = null; cv.dataset.keep = ''; };
  }

  /* ---------- Notebooks screen ---------- */
  let nbOpen = null, nbQ = '';
  async function notebooksTab(el) {
    await UC.brain.load();
    const l = notebooks(), nb = l.find(b => b.id === nbOpen);
    if (!nb) {
      el.innerHTML = `<section class="card"><div class="row spread"><div class="uc-sh"><h2>Notebooks</h2><span class="muted small">chat with only the sources you choose</span></div><button class="btn primary small" id="nbNew">New notebook</button></div>
        <div class="uc-alist">${l.map(b => `<button class="uc-arow" data-nb="${b.id}"><span class="uc-dot" style="background:var(--blue)"></span><span><b>${esc(b.name)}</b><span class="muted tiny">${b.sources.length} source${b.sources.length === 1 ? '' : 's'} · ${(b.chat || []).length} questions · ${Object.keys(b.guides || {}).length} guides</span></span></button>`).join('') || '<div class="uc-empty">No notebooks yet. Make one for a unit, a venture, a lease or a hiring round.</div>'}</div></section>`;
      el.querySelector('#nbNew').onclick = () => editNb(null);
      el.querySelectorAll('[data-nb]').forEach(b => b.onclick = () => { nbOpen = b.dataset.nb; UC.go('brain', { keepScroll: true }); });
      return;
    }
    const src = nb.sources.map(id => UC.brain.get(id)).filter(Boolean);
    const G = [['briefing', 'Briefing'], ['faq', 'FAQ'], ['study', 'Study guide'], ['timeline', 'Timeline']];
    el.innerHTML = `<button class="btn ghost small uc-backbtn" id="nbBack">${UC.icon('back')} Notebooks</button>
      <div class="uc-grid2"><div class="uc-col"><section class="card"><div class="row spread"><div class="uc-sh"><h2>${esc(nb.name)}</h2></div><button class="btn small" id="nbEdit">Sources</button></div>
        <form id="nbAsk" class="uc-askbar" style="margin-top:12px"><input id="nbQ" placeholder="Ask only these sources…" value="${esc(nbQ)}" autocomplete="off"><button class="btn primary">Ask</button></form>
        ${(nb.chat || []).slice().reverse().slice(0, 8).map(c => `<div class="uc-btw"><b>${esc(c.q)}</b><div class="uc-md small">${UC.brainRender(c.a).replace(/\[(\d+)\]/g, (m, i) => src[i - 1] ? `<a class="uc-cite" data-note="${esc(src[i - 1].id)}">[${i}]</a>` : m)}</div></div>`).join('')}</section>
        ${G.filter(([k]) => nb.guides?.[k]).map(([k, lab]) => `<section class="card"><details class="uc-disclose" open><summary><b style="font-size:17px">${lab}</b><span class="muted small">${UC.ago(nb.guides[k].t)}</span></summary><div class="uc-md small" style="max-height:none">${UC.brainRender(nb.guides[k].text)}</div></details></section>`).join('')}</div>
      <div class="uc-col"><section class="card"><div class="uc-sh"><h2>Make from these sources</h2></div><div class="uc-chips">${G.map(([k, l2]) => `<button class="uc-chip" data-guide="${k}">${nb.guides?.[k] ? 'Redo ' : ''}${l2}</button>`).join('')}</div><span class="muted tiny" id="nbProg"></span></section>
        <section class="card"><div class="uc-sh"><h2>Sources</h2><span class="muted small">${src.length}</span></div><div class="uc-alist">${src.map((n, i) => `<button class="uc-arow" data-note="${esc(n.id)}"><span class="uc-dot" style="background:${UC.sectionColor(n.section)}"></span><span><b>[${i + 1}] ${esc(n.title)}</b><span class="muted tiny">${esc(n.section)}</span></span></button>`).join('')}</div></section></div></div>`;
    el.querySelector('#nbBack').onclick = () => { nbOpen = null; UC.go('brain', { keepScroll: true }); };
    el.querySelector('#nbEdit').onclick = () => editNb(nb);
    el.querySelector('#nbAsk').onsubmit = async e => { e.preventDefault(); const q = el.querySelector('#nbQ').value.trim(); if (!q) return; const b = e.target.querySelector('button'); b.disabled = true; b.innerHTML = '<span class="task-spin"></span>'; try { await nbAsk(nb, q); nbQ = ''; } catch (err) { App.ui.toast(err.message, 6000); } UC.go('brain', { keepScroll: true }); };
    el.querySelectorAll('[data-guide]').forEach(b => b.onclick = async () => { b.disabled = true; el.querySelector('#nbProg').textContent = 'Writing…'; try { await nbAsk(nb, '', b.dataset.guide); } catch (err) { App.ui.toast(err.message, 6000); } UC.go('brain', { keepScroll: true }); });
  }
  function editNb(nb) {
    let picked = new Set(nb?.sources || []), q = '';
    const rows = async () => (q ? (await UC.brain.search(q, { limit: 40, semantic: false })).map(h => h.n) : [...UC.brain.notes().values()].filter(n => n.type !== 'log').sort((a, b) => b.updated - a.updated).slice(0, 40));
    App.ui.modal(`<div class="row spread"><h2>${nb ? 'Sources' : 'New notebook'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <label class="field">Name<input id="nbN" value="${esc(nb?.name || '')}" placeholder="e.g. Eastside lease decision"></label>
      <label class="field">Find memories<input id="nbS" placeholder="Search the Brain…" autocomplete="off"></label>
      <div class="uc-alist" id="nbL" style="max-height:44vh;overflow:auto"></div>
      <div class="row" style="justify-content:space-between;margin-top:12px">${nb ? '<button class="btn danger" id="nbDel">Delete</button>' : '<span class="muted small" id="nbCount"></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="nbGo">Save</button></div></div>`, (c, close) => {
      const draw = async () => { const r = await rows(); c.querySelector('#nbL').innerHTML = r.map(n => `<label class="uc-arow uc-cb" style="cursor:pointer"><input type="checkbox" data-src="${esc(n.id)}" ${picked.has(n.id) ? 'checked' : ''}><span><b>${esc(n.title)}</b><span class="muted tiny">${esc(n.section)}</span></span></label>`).join('') || '<div class="uc-empty">No matches.</div>';
        c.querySelectorAll('[data-src]').forEach(x => x.onchange = () => { x.checked ? picked.add(x.dataset.src) : picked.delete(x.dataset.src); const el = c.querySelector('#nbCount'); if (el) el.textContent = `${picked.size} chosen`; }); };
      draw();
      const si = c.querySelector('#nbS'); si.oninput = () => { q = si.value.trim(); clearTimeout(si._t); si._t = setTimeout(draw, 250); };
      c.querySelector('#nbDel')?.addEventListener('click', () => { saveNb(notebooks().filter(b => b.id !== nb.id)); nbOpen = null; close(); UC.go('brain', { keepScroll: true }); });
      c.querySelector('#nbGo').onclick = () => {
        const name = c.querySelector('#nbN').value.trim() || 'Notebook'; if (!picked.size) return App.ui.toast('Pick at least one source');
        const l = notebooks(); if (nb) { const x = l.find(b => b.id === nb.id); x.name = name; x.sources = [...picked]; } else { const x = { id: App.uid(), name, sources: [...picked], chat: [], guides: {}, created: Date.now() }; l.push(x); nbOpen = x.id; }
        saveNb(l); close(); UC.go('brain', { keepScroll: true });
      };
    });
  }

  /* ---------- Review screen ---------- */
  let showA = false;
  async function reviewTab(el) {
    const due = dueCards(), all = cards();
    const c = due[0];
    el.innerHTML = `<div class="uc-grid2"><div class="uc-col"><section class="card uc-review">${c ? `
        <div class="row spread"><span class="muted small">${esc(c.deck)}</span><span class="muted small">${due.length} due</span></div>
        <div class="uc-rq">${esc(c.q)}</div>
        ${showA ? `<div class="uc-ra">${esc(c.a)}</div>${c.src ? `<a class="uc-wl small" data-note="${esc(c.src)}">Open the source</a>` : ''}
          <div class="uc-grades"><button class="btn" data-g="0">Again<small>10 min</small></button><button class="btn" data-g="3">Hard</button><button class="btn primary" data-g="4">Good</button><button class="btn" data-g="5">Easy</button></div>`
        : `<button class="btn primary uc-show" id="rvShow">Show answer</button>`}`
      : `<div class="uc-empty" style="padding:30px">${all.length ? 'All caught up. Come back tomorrow.' : 'No cards yet. Build them from your Knowledge docs, monthly numbers and decisions.'}</div>`}</section></div>
      <div class="uc-col"><section class="card"><div class="uc-sh"><h2>Cards</h2><span class="muted small">${all.length} total · ${due.length} due</span></div>
        <p class="muted small">Spaced repetition: cards you know come back less often; misses come back soon. Made from your SOPs, price book, monthly numbers and decisions.</p>
        <div class="row" style="margin-top:8px"><button class="btn" id="rvBuild">Build cards from the Brain</button>${!App.hosted ? '<button class="btn ghost" id="rvAI">Make cards from a memory (AI)</button>' : ''}</div>
        <div class="uc-tiles" style="margin-top:12px">${[...new Set(all.map(x => x.deck))].slice(0, 8).map(d => UC.tile(d, all.filter(x => x.deck === d).length, `${all.filter(x => x.deck === d && x.due <= Date.now()).length} due`)).join('')}</div></section></div></div>`;
    const re = () => UC.go('brain', { keepScroll: true });
    el.querySelector('#rvShow')?.addEventListener('click', () => { showA = true; re(); });
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { grade(c.id, +b.dataset.g); showA = false; re(); });
    el.querySelector('#rvBuild').onclick = async () => { const n = await buildCards(); App.ui.toast(n ? `${n} new cards` : 'No new cards to make'); re(); };
    el.querySelector('#rvAI')?.addEventListener('click', () => App.ui.modal(`<div class="row spread"><h2>Cards from a memory</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div><label class="field">Find a memory<input id="aiS" placeholder="e.g. SOPs, price book, Lakeside October"></label><div class="uc-alist" id="aiL"></div>`, (m, close) => {
      const s = m.querySelector('#aiS'); s.oninput = async () => { const r = (await UC.brain.search(s.value, { limit: 12, semantic: false })).map(h => h.n);
        m.querySelector('#aiL').innerHTML = r.map(n => `<button class="uc-arow" data-mk="${esc(n.id)}"><span class="uc-dot" style="background:${UC.sectionColor(n.section)}"></span><span><b>${esc(n.title)}</b><span class="muted tiny">${esc(n.section)}</span></span></button>`).join('');
        m.querySelectorAll('[data-mk]').forEach(b => b.onclick = async () => { b.innerHTML = '<span class="task-spin"></span> Making cards…'; try { const n = await aiCards(b.dataset.mk); App.ui.toast(`${n} cards added`); } catch (err) { App.ui.toast(err.message); } close(); re(); }); };
    }));
    if (c) { const k = e => { if (!el.isConnected) return document.removeEventListener('keydown', k); if (e.key === ' ' && !showA) { e.preventDefault(); showA = true; re(); } else if (showA && ['1', '2', '3', '4'].includes(e.key)) { grade(c.id, [0, 3, 4, 5][+e.key - 1]); showA = false; re(); } }; document.addEventListener('keydown', k, { once: true }); }
  }

  UC.brainPlus = { objectives, toggle, candidates, cards, dueCards, buildCards, grade, notebooks, nbAsk, tabs: { planet, notebooks: notebooksTab, review: reviewTab } };
})(window.UC);
