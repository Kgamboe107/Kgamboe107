/* Before you decide: the 7-question thought process for big decisions (deals, ventures, projects, and any approval
   you mark as important). 1 Define the problem · 2 Check the evidence · 3 Expand your options · 4 Weigh the
   trade-offs · 5 Look ahead · 6 Assess reversibility · 7 Plan your review. The AI can draft it from your data;
   you edit and decide. On the review date it comes back in Today's three: continue, adjust or stop. */
(function (UC) {
  const { esc } = App;
  const S = UC.S;
  UC.screens = UC.screens || {};
  const Q = [
    ['problem', 'Define the problem', 'What problem am I really trying to solve?', 'A busy signal can hide an unclear priority. Define what needs to change before choosing a solution.', 'Write the problem in one sentence.'],
    ['evidence', 'Check the evidence', 'What do I know, and what am I assuming?', 'Being excited about an idea doesn’t prove there’s demand for it. Separate what you’ve observed from what you still need to validate.', 'Test your most important assumption before committing resources.'],
    ['options', 'Expand your options', 'What option am I overlooking?', 'Between taking on the whole thing and turning it down, there may be a third option: a pilot with a defined scope and timeline.', 'Expand your options before comparing them.'],
    ['tradeoff', 'Weigh the trade-offs', 'What am I giving up by choosing this?', 'A new commitment takes time, attention and capacity. Which project, relationship or priority will get less of you?', 'Consider what you’ll no longer have room to build.'],
    ['ahead', 'Look ahead', 'What happens beyond the initial result?', 'A win can increase demands on fulfillment, support and staffing. Who will sustain what this decision sets in motion?', 'Factor in what it takes to sustain the result.'],
    ['reverse', 'Assess reversibility', 'How easy would it be to change course?', 'A one-month trial leaves room to adjust. A multiyear commitment calls for a closer look at the assumptions behind it.', 'Match your analysis to the cost of reversing course.'],
    ['review', 'Plan your review', 'What evidence would change my mind?', 'Before you start, define what would justify continuing, adjusting or stopping, so you can reassess without relying on your first enthusiasm.', 'Write down when you’ll reassess and what evidence you’ll use.']
  ];
  const list = () => S.get('briefs', []);
  const save = l => S.set('briefs', l.slice(-400));
  const get = id => list().find(b => b.id === id);
  const put = b => { b.updated = Date.now(); save([...list().filter(x => x.id !== b.id), b]); App.bus.emit('uc-changed'); return b; };
  const forRef = ref => list().filter(b => b.ref === ref).sort((a, b) => b.created - a.created)[0];
  const blank = (title, kind = 'other', ref = '') => ({ id: App.uid(), title, kind, ref, created: Date.now(), status: 'thinking', problem: '', know: [], assume: [], testFirst: '', options: ['Go ahead', 'Run a pilot', 'Decline'], pilot: '', choice: '', givingUp: '', result: '', demands: '', who: '', reversible: '', reverseCost: '', cont: '', adjust: '', stop: '', reviewOn: '', reviews: [] });
  const addDays = n => App.dateKey(new Date(Date.now() + n * 864e5));
  const due = () => list().filter(b => b.status === 'decided' && b.reviewOn && b.reviewOn <= App.dateKey(new Date()));
  const missing = b => {
    const m = [];
    if (!b.problem.trim()) m.push(1); if (!b.know.length && !b.assume.length) m.push(2); if (b.options.filter(Boolean).length < 3) m.push(3);
    if (!b.givingUp.trim()) m.push(4); if (!b.result.trim() && !b.demands.trim()) m.push(5); if (!b.reversible) m.push(6); if (!b.reviewOn || !(b.cont || b.adjust || b.stop)) m.push(7);
    return m;
  };

  /* Context for the AI (and plain prefill without it) */
  async function context(b) {
    let ref = '';
    if (b.kind === 'deal') { const p = (await UC.deals.all()).find(x => x.id === b.ref); if (p) ref = `Deal: ${p.name} (${UC.deals.TYPES[p.dtype]?.[1]}). Stage ${p.stage}. ${p.fit?.why || ''}\n${p.fin ? `Financials: ${JSON.stringify(p.fin)}` : ''}${p.fr ? `\nFranchise: ${JSON.stringify(p.fr)}` : ''}\nSignals: ${(p.signals || []).join(' ')}\nNotes: ${p.notes || ''}`; }
    if (b.kind === 'venture') { const v = UC.engine.ventures().find(x => x.id === b.ref); if (v) ref = `Venture: ${v.name}, stage ${v.stage}, target open ${v.open || 'not set'}. Notes: ${v.notes || ''}`; }
    if (b.kind === 'project') { const p = UC.coord?.get(b.ref); if (p) ref = `Project: ${p.name}. Goal: ${p.goal}. Status ${p.status}. Steps: ${p.tasks.map(t => t.title + ' (' + t.status + ')').join('; ')}`; }
    if (b.kind === 'ask') { const a = UC.engine.state().asks.find(x => x.id === b.ref); if (a) ref = `Approval requested by ${UC.agent(a.agent)?.name || 'an agent'}: ${a.title}\n${String(a.detail || '').slice(0, 2000)}`; }
    let mem = '';
    try { mem = (await UC.brain.search(b.title, { limit: 5, semantic: false })).map(h => `- ${h.n.title}: ${String(h.n.body).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n'); } catch { /* optional */ }
    const active = (UC.coord?.list() || []).filter(p => ['running', 'ready', 'paused'].includes(p.status)).map(p => p.name).concat(UC.engine.ventures().filter(v => !v.sample && v.stage !== 'open').map(v => v.name));
    return { ref, mem, active };
  }
  async function draft(b) {
    const c = await context(b); const st = await UC.ai.status();
    if (!st.running) {
      if (!b.problem) b.problem = b.title;
      if (!b.know.length && c.ref) b.know = c.ref.split('\n').filter(Boolean).slice(0, 3);
      if (!b.assume.length) b.assume = ['The numbers shown are accurate and current', 'We have the people and time to run this well', 'Demand holds after the first months'];
      if (!b.givingUp && c.active.length) b.givingUp = `Attention on: ${c.active.slice(0, 3).join(', ')}`;
      return put(b);
    }
    const r = await App.ai.ollamaChat({ format: 'json', ctx: 12288, messages: [
      { role: 'system', content: 'You help a multi-unit business owner think through one big decision with 7 questions. Be concrete and short. Use only the facts given; mark anything not in the facts as an assumption. JSON {"problem": one sentence, "know": [up to 4 facts], "assume": [up to 4 assumptions], "testFirst": the single most important assumption and a cheap way to test it, "options": [exactly 3: full yes, a pilot with scope and timeline, no], "pilot": the pilot in one sentence, "givingUp": what gets less attention, "result": immediate result, "demands": new demands it creates, "who": who sustains it, "reversible": "easy" or "hard", "reverseCost": what reversing would cost, "cont": evidence to continue, "adjust": evidence to adjust, "stop": evidence to stop, "reviewDays": number of days until review}.' },
      { role: 'user', content: `Decision: ${b.title}\n\n${c.ref}\n\nOther commitments right now: ${c.active.join(', ') || 'none listed'}\n\nRelated memories:\n${c.mem || '- none'}` }] });
    let j; try { j = JSON.parse(r.text); } catch { const m = r.text.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : {}; }
    const s = v => String(v || '').trim(), arr = v => (Array.isArray(v) ? v : []).map(s).filter(Boolean).slice(0, 5);
    Object.assign(b, { problem: b.problem || s(j.problem), know: b.know.length ? b.know : arr(j.know), assume: b.assume.length ? b.assume : arr(j.assume), testFirst: b.testFirst || s(j.testFirst),
      options: arr(j.options).length === 3 ? arr(j.options) : b.options, pilot: b.pilot || s(j.pilot), givingUp: b.givingUp || s(j.givingUp), result: b.result || s(j.result), demands: b.demands || s(j.demands), who: b.who || s(j.who),
      reversible: b.reversible || (['easy', 'hard'].includes(j.reversible) ? j.reversible : ''), reverseCost: b.reverseCost || s(j.reverseCost), cont: b.cont || s(j.cont), adjust: b.adjust || s(j.adjust), stop: b.stop || s(j.stop),
      reviewOn: b.reviewOn || addDays(Math.max(7, Math.min(180, +j.reviewDays || 30))), aiModel: r.model });
    return put(b);
  }
  function decide(b, choice) {
    b.choice = choice; b.status = 'decided'; b.decidedAt = Date.now();
    if (!b.reviewOn) b.reviewOn = addDays(b.reversible === 'hard' ? 30 : 14);
    return put(b);
  }
  function review(b, verdict, note) {
    b.reviews = [...(b.reviews || []), { t: Date.now(), verdict, note }];
    if (verdict === 'stop') { b.status = 'reviewed'; b.reviewOn = ''; } else b.reviewOn = addDays(verdict === 'adjust' ? 14 : 30);
    return put(b);
  }

  /* ---------- the sheet ---------- */
  const lines = v => (v || []).join('\n');
  const fromLines = v => v.split('\n').map(x => x.replace(/^[-•\s]+/, '').trim()).filter(Boolean);
  function open(idOrBrief, after) {
    let b = typeof idOrBrief === 'string' ? get(idOrBrief) : idOrBrief; if (!b) return;
    if (!get(b.id)) put(b);
    const n = i => String(i + 1).padStart(2, '0');
    const sec = (i, inner) => `<section class="uc-q"><div class="uc-qk">${n(i)} / ${Q[i][1].toUpperCase()}</div><h3 class="uc-qh">${Q[i][2]}</h3><p class="uc-qp">${Q[i][3]}</p>${inner}<div class="uc-qr">${Q[i][4]}</div></section>`;
    const ta = (k, ph, rows = 2) => `<textarea data-f="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(b[k] || '')}</textarea>`;
    const dueNow = b.status === 'decided' && b.reviewOn && b.reviewOn <= App.dateKey(new Date());
    App.ui.modal(`<div class="uc-brief"><div class="row spread"><div class="uc-qk">BEFORE YOU DECIDE${b.kind !== 'other' ? ` · ${esc(b.kind.toUpperCase())}` : ''}</div><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <textarea class="uc-btitle" data-f="title" rows="2" aria-label="Decision">${esc(b.title)}</textarea>
      ${dueNow ? `<div class="uc-rev"><b>Time to reassess.</b> You decided “${esc(b.choice)}” on ${new Date(b.decidedAt).toLocaleDateString()}. Look at the evidence you named in 07, then choose.<textarea id="rvN" rows="2" placeholder="What the evidence shows"></textarea><div class="row"><button class="btn primary" data-rv="continue">Continue</button><button class="btn" data-rv="adjust">Adjust</button><button class="btn danger" data-rv="stop">Stop</button></div></div>` : ''}
      <div class="row" style="margin:6px 0 4px"><button class="btn small" id="bAI">${App.fx.icon('sparkles')} Draft from my data</button><span class="muted tiny" id="bMsg">${b.aiModel ? 'Drafted by ' + esc(b.aiModel) + '. Edit anything.' : 'The AI fills what it can from your numbers, the deal and the Brain. You decide.'}</span></div>
      ${sec(0, ta('problem', 'In one sentence…'))}
      ${sec(1, `<div class="uc-q2"><label>What you know<textarea data-l="know" rows="4" placeholder="One per line">${esc(lines(b.know))}</textarea></label><label>What needs validation<textarea data-l="assume" rows="4" placeholder="One per line">${esc(lines(b.assume))}</textarea></label></div>${ta('testFirst', 'The assumption to test first, and how')}`)}
      ${sec(2, `<div class="uc-opts">${[0, 1, 2].map(i => `<input data-o="${i}" value="${esc(b.options[i] || '')}" placeholder="${['Full yes', 'A pilot', 'No'][i]}">`).join('')}</div>${ta('pilot', 'The pilot: scope and timeline')}`)}
      ${sec(3, `<div class="uc-trade"><div><span>What you choose</span><b>${esc(b.choice || b.options[0] || '—')}</b></div><i>→</i>${ta('givingUp', 'What you put on hold')}</div>`)}
      ${sec(4, `<div class="uc-q3">${ta('result', 'Immediate result')}${ta('demands', 'New demands it creates')}${ta('who', 'Who sustains it')}</div>`)}
      ${sec(5, `<div class="seg" style="margin-bottom:8px">${[['easy', 'Easy to reverse'], ['hard', 'Hard to reverse']].map(([k, l]) => `<button data-rvs="${k}" class="${b.reversible === k ? 'on' : ''}">${l}</button>`).join('')}</div>${ta('reverseCost', 'What changing course would cost')}<div class="muted tiny" id="hardNote" ${b.reversible === 'hard' ? '' : 'hidden'}>Hard to reverse: every question needs an answer before you decide.</div>`)}
      ${sec(6, `<div class="uc-q3">${ta('cont', 'Continue if…')}${ta('adjust', 'Adjust if…')}${ta('stop', 'Stop if…')}</div><label class="field">Reassess on<input type="date" data-f="reviewOn" value="${esc(b.reviewOn || '')}"></label>`)}
      <div class="uc-bfoot"><div class="muted small" id="bMiss"></div><div class="row">${b.options.filter(Boolean).map((o, i) => `<button class="btn ${i === 1 ? 'primary' : ''}" data-choose="${i}">${esc(o)}</button>`).join('')}</div></div>
      ${(b.reviews || []).length ? `<div class="uc-qk" style="margin-top:18px">REVIEWS</div>${b.reviews.map(r => `<div class="small"><b>${esc(r.verdict)}</b> · ${new Date(r.t).toLocaleDateString()} ${esc(r.note || '')}</div>`).join('')}` : ''}
      <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn ghost small danger" id="bDel">Delete</button><span class="muted tiny">${b.status === 'decided' ? `Decided: ${esc(b.choice)} · review ${esc(b.reviewOn)}` : 'Not decided yet'}</span></div></div>`, (c, close) => {
      c.classList.add('wide');
      const sync = () => {
        if (!c.querySelector('#bMiss')) return missing(b);
        c.querySelectorAll('[data-f]').forEach(x => b[x.dataset.f] = x.value);
        c.querySelectorAll('[data-l]').forEach(x => b[x.dataset.l] = fromLines(x.value));
        c.querySelectorAll('[data-o]').forEach(x => b.options[+x.dataset.o] = x.value.trim());
        const m = missing(b); c.querySelector('#bMiss').textContent = m.length ? `Still open: ${m.map(i => String(i).padStart(2, '0')).join(', ')}` : 'All seven answered.';
        b.updated = Date.now(); save([...list().filter(x => x.id !== b.id), b]); return m;
      };
      c.addEventListener('input', () => { clearTimeout(c._t); c._t = setTimeout(sync, 400); });
      sync();
      c.querySelectorAll('[data-rvs]').forEach(x => x.onclick = () => { b.reversible = x.dataset.rvs; c.querySelectorAll('[data-rvs]').forEach(y => y.classList.toggle('on', y === x)); c.querySelector('#hardNote').hidden = b.reversible !== 'hard'; sync(); });
      c.querySelector('#bAI').onclick = async e => { sync(); e.currentTarget.disabled = true; c.querySelector('#bMsg').innerHTML = '<span class="task-spin"></span> Thinking it through…'; try { await draft(b); close(); open(b.id, after); } catch (err) { const mm = c.querySelector('#bMsg'); if (mm) mm.textContent = err.message; else App.ui.toast(err.message); } };
      c.querySelectorAll('[data-choose]').forEach(x => x.onclick = () => {
        const m = sync();
        if (b.reversible === 'hard' && m.length) return App.ui.toast(`Hard to reverse: answer ${m.map(i => String(i).padStart(2, '0')).join(', ')} first`, 5000);
        if (m.includes(1)) return App.ui.toast('Write the problem in one sentence first (01)');
        decide(b, b.options[+x.dataset.choose]); close(); App.ui.toast(`Decided: ${b.choice}. Review on ${b.reviewOn}.`); after?.(b);
      });
      c.querySelectorAll('[data-rv]').forEach(x => x.onclick = () => { review(b, x.dataset.rv, c.querySelector('#rvN').value.trim()); close(); App.ui.toast(x.dataset.rv === 'stop' ? 'Stopped. Saved to the Brain.' : `Next review ${b.reviewOn}`); after?.(b); });
      c.querySelector('#bDel').onclick = () => { if (!confirm('Delete this decision brief?')) return; save(list().filter(x => x.id !== b.id)); close(); after?.(null); };
    });
  }
  /* Start (or reopen) a brief for something */
  function think(title, kind, ref, after) { const b = (ref && forRef(ref)) || blank(title, kind, ref); open(b, after); return b; }

  /* ---------- Decisions screen ---------- */
  UC.screens.decide = async (view, params = {}) => {
    const l = list().sort((a, b) => b.updated - a.updated), d = due();
    const row = b => `<button class="uc-arow" data-brief="${b.id}"><span class="uc-dot" style="background:${b.status === 'thinking' ? 'var(--blue)' : d.includes(b) ? 'var(--gold)' : 'var(--label-3)'}"></span><span><b>${esc(b.title)}</b><span class="muted tiny">${b.status === 'thinking' ? `Thinking · ${7 - missing(b).length} of 7 answered` : b.status === 'decided' ? `${esc(b.choice)} · review ${esc(b.reviewOn)}` : `Stopped after review`} · ${esc(b.kind)}</span></span></button>`;
    view.innerHTML = `<section class="card uc-brief-intro"><div class="uc-qk">JUDGMENT / DECISIONS / SYSTEMS</div><h2 class="uc-qh" style="font-size:28px;margin:8px 0">Seven questions before every big decision.</h2>
        <p class="muted">Deals, ventures, new projects and any approval you mark as important go through the same thought process. Each one is saved in the Brain and comes back on its review date.</p>
        <form id="dNew" class="uc-askbar" style="margin-top:12px"><input id="dT" placeholder="What are you deciding? e.g. Buy the Lakeside bakery for $420k" autocomplete="off"><button class="btn primary">Think it through</button></form></section>
      ${d.length ? `<section class="card"><div class="uc-sh"><h2>Time to reassess</h2><span class="uc-count">${d.length}</span></div><div class="uc-alist">${d.map(row).join('')}</div></section>` : ''}
      <section class="card"><div class="uc-sh"><h2>Thinking</h2></div><div class="uc-alist">${l.filter(b => b.status === 'thinking').map(row).join('') || '<div class="uc-empty">Nothing open.</div>'}</div></section>
      <section class="card"><div class="uc-sh"><h2>Decided</h2></div><div class="uc-alist">${l.filter(b => b.status !== 'thinking' && !d.includes(b)).map(row).join('') || '<div class="uc-empty">No decisions yet.</div>'}</div></section>`;
    const re = () => UC.go('decide', { keepScroll: true });
    view.querySelector('#dNew').onsubmit = e => { e.preventDefault(); const t = view.querySelector('#dT').value.trim(); if (!t) return; think(t, 'other', '', re); };
    view.querySelectorAll('[data-brief]').forEach(x => x.onclick = () => open(x.dataset.brief, re));
    if (params.id && get(params.id)) open(params.id, re);
  };

  UC.decide = { Q, list, get, put, forRef, blank, open, think, draft, decide, review, due, missing };
})(window.UC);
