/* Projects screen: the Coordinator. One goal → plan → steps run by the right agents → status, side questions, fork. */
(function (UC) {
  const { esc } = App;
  const C = () => UC.coord;
  UC.screens = UC.screens || {};
  let open = null, lastReport = {}, lastBtw = {};
  const STATUS = { planning: ['Planning', ''], ready: ['Ready', 'accent'], running: ['Running', 'live'], paused: ['Paused', ''], blocked: ['Needs a look', 'bad'], done: ['Done', 'good'] };
  const TSTAT = { todo: '○', running: '◐', done: '✓', waiting: '✓', failed: '!', skipped: '–' };
  const mins = ms => ms < 60000 ? `${Math.round(ms / 1000)} s` : `${(ms / 60000).toFixed(1)} min`;

  function gauge(u) {
    const r = 54, c = Math.PI * r, p = Math.max(0.02, u.pct);
    return `<svg viewBox="0 0 140 84" class="uc-gauge" aria-label="AI time today"><path d="M16 74 A54 54 0 0 1 124 74" fill="none" stroke="var(--fill-3)" stroke-width="10" stroke-linecap="round"/>
      <path d="M16 74 A54 54 0 0 1 124 74" fill="none" stroke="${u.pct > .8 ? 'var(--orange)' : 'var(--gold)'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}"/></svg>`;
  }

  UC.screens.projects = async (view, params = {}) => {
    if (params.id) open = params.id;
    const all = C().list().slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const p = open && C().get(open);
    if (p) return detail(view, p);
    const u = C().usageToday(), ai = await UC.ai.status();
    const active = all.filter(x => ['running', 'ready', 'paused', 'blocked', 'planning'].includes(x.status));
    view.innerHTML = `<div class="uc-grid2"><div class="uc-col">
      <section class="card"><div class="uc-sh"><h2>New project</h2></div>
        <p class="muted small" style="margin:6px 0 12px">Say what you want done. The coordinator breaks it into steps, gives each to the right agents, and runs them${App.hosted ? ' on your computer' : ''}.</p>
        <form id="pNew" class="uc-askbar"><input id="pGoal" placeholder="e.g. Get Lakeside labor under 28% in four weeks" autocomplete="off"><button class="btn primary">Start</button></form>
        <div class="uc-chips">${C().TEMPLATES.map(t => `<button class="uc-chip" data-tpl="${t.id}">${esc(t.name)}</button>`).join('')}</div>
        ${ai.running ? '' : `<div class="uc-demo" style="margin-top:12px"><div>${esc(ai.error || 'AI is off.')} Plans still get built from the agent catalog; AI steps run once Ollama is on.</div></div>`}</section>
      <section class="card"><div class="uc-sh"><h2>Projects</h2>${all.length ? `<span class="muted small">${active.length} active</span>` : ''}</div>
        <div class="uc-alist">${all.map(x => { const r = C().statusReport(x), [lab, tone] = STATUS[x.status] || ['', '']; return `<button class="uc-arow uc-prow" data-proj="${x.id}"><span class="uc-ring" style="--p:${Math.round(r.pct * 100)}"></span>
          <span><b>${esc(x.name || x.goal)}</b><span class="muted tiny">${r.done} of ${r.total} steps · ${UC.ago(x.updated)}${x.forkOf ? ' · fork' : ''}</span></span><span class="uc-spill ${tone}">${lab}</span></button>`; }).join('') || '<div class="uc-empty">No projects yet. Start one above.</div>'}</div></section></div>
      <div class="uc-col"><section class="card uc-usage"><div class="uc-sh"><h2>AI time today</h2></div>
        <div class="uc-gwrap">${gauge(u)}<div class="uc-gnum"><b>${Math.round(u.pct * 100)}%</b><span>${mins(u.ms)} of ${Math.round(u.budget / 60000)} min</span></div></div>
        <p class="muted small">Ollama runs free on your computer, but long runs tie it up. Steps run one at a time; ${active.filter(x => x.status === 'running').length} project${active.filter(x => x.status === 'running').length === 1 ? '' : 's'} running. Change the daily budget in Settings.</p></section></div></div>`;
    const f = view.querySelector('#pNew');
    f.onsubmit = async e => {
      e.preventDefault(); const g = view.querySelector('#pGoal').value.trim(); if (!g) return App.ui.toast('Say what you want done');
      const btn = f.querySelector('button'); btn.disabled = true; btn.innerHTML = '<span class="task-spin"></span> Planning…';
      const pr = await C().create(g); open = pr.id; UC.go('projects');
    };
    view.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => {
      const t = C().TEMPLATES.find(x => x.id === b.dataset.tpl), units = App.biz.list().filter(x => !x.archived && App.biz.kindOf(x) === 'business');
      view.querySelector('#pGoal').value = t.goal.replace('{unit}', units[0]?.name || 'the unit').replace('{target}', UC.targets().laborPct).replace('{type}', 'restaurant').replace('{date}', 'the target date').replace('{role}', 'shift lead');
      view.querySelector('#pGoal').focus();
    });
    view.querySelectorAll('[data-proj]').forEach(b => b.onclick = () => { open = b.dataset.proj; UC.go('projects'); });
  };

  function detail(view, p) {
    const r = C().statusReport(p), [lab, tone] = STATUS[p.status] || ['', ''];
    const lanes = {}; p.tasks.forEach(t => { const d = UC.agent(t.agent)?.dept || 'other'; (lanes[d] = lanes[d] || []).push(t); });
    const sub = document.getElementById('ucSub'); if (sub) sub.textContent = '';
    view.innerHTML = `<button class="btn ghost small uc-backbtn" id="pBack">${UC.icon('back')} Projects</button>
      <section class="card uc-phead"><div class="row spread" style="align-items:flex-start"><div style="min-width:0"><span class="uc-spill ${tone}">${lab}</span><h2 class="uc-ptitle">${esc(p.name || p.goal)}</h2>
        ${p.approach ? `<div class="muted small">Approach: ${esc(p.approach)}</div>` : ''}<div class="muted small" style="margin-top:4px">${esc(p.summary || '')}</div></div></div>
        <div class="uc-bar" style="margin:14px 0 6px"><i style="width:${Math.round(r.pct * 100)}%"></i></div>
        <div class="muted tiny">${r.done} of ${r.total} steps · ${p.usage?.runs || 0} runs · ${mins(p.usage?.ms || 0)} of AI time · ${p.planner === 'ai' ? 'AI plan' : 'catalog plan'}</div>
        <div class="row uc-pact">${p.status === 'running' ? `<button class="btn" id="pPause">Pause</button>` : p.status !== 'done' ? `<button class="btn primary" id="pRun">${p.status === 'ready' ? 'Run the plan' : 'Continue'}</button>` : ''}
          <button class="btn" id="pWhere">Where are we?</button><button class="btn" id="pFork">Fork</button><button class="btn" id="pThink">Before you decide</button><button class="btn ghost" id="pDel" style="color:var(--red)">Delete</button></div>
        ${lastReport[p.id] ? `<div class="uc-report"><b>Status</b><div class="uc-md small">${UC.fullMd(lastReport[p.id])}</div></div>` : ''}</section>
      <div class="uc-lanes2">${Object.entries(lanes).map(([d, ts]) => { const dd = UC.dept(d); const dn = ts.filter(t => ['done', 'waiting'].includes(t.status)).length; return `<section class="card uc-thread" style="--dc:${dd?.color || 'var(--label-3)'}">
        <div class="uc-thead"><span class="uc-dot" style="background:${dd?.color}"></span><b>${esc(dd?.name || 'Other')}</b><span class="muted tiny">${dn}/${ts.length}</span></div>
        <div class="uc-bar thin"><i style="width:${Math.round(dn / ts.length * 100)}%;background:${dd?.color}"></i></div>
        ${ts.map(t => `<button class="uc-step s-${t.status}" ${t.out ? `data-agent="${t.agent}"` : ''}><i>${t.status === 'running' ? '<span class="task-spin"></span>' : TSTAT[t.status]}</i><span><b>${esc(t.title)}</b><span class="muted tiny">${esc(t.summary || t.why || UC.agent(t.agent)?.does || '')}</span>${t.status === 'waiting' ? '<span class="uc-wait tiny">Draft waiting in Needs your yes</span>' : ''}${t.after.length ? `<span class="muted tiny">after step ${t.after.map(k => k + 1).join(', ')}</span>` : ''}</span><em>${t.n + 1}</em></button>`).join('')}</section>`; }).join('')}</div>
      <section class="card"><div class="uc-sh"><h2>Ask on the side</h2><span class="muted small">answers from the project and the Brain; the plan keeps running</span></div>
        <form id="pBtw" class="uc-askbar" style="margin-top:10px"><input id="pQ" placeholder="e.g. Which unit had the most overtime last month?" autocomplete="off"><button class="btn">Ask</button></form>
        ${(p.asks || []).slice(-3).reverse().map(a => `<div class="uc-btw"><b>${esc(a.q)}</b><div class="uc-md small">${UC.fullMd(a.a)}</div></div>`).join('')}</section>
      <section class="card"><details class="uc-disclose"><summary><span><b style="font-size:17px">Project log</b> <span class="muted small">${(p.log || []).length}</span></span></summary>
        <ol class="uc-log">${(p.log || []).slice().reverse().map(e => `<li class="k-${e.kind === 'flag' ? 'flag' : e.kind === 'waiting' ? 'waiting' : 'done'}"><time>${UC.clock(e.t)}</time><div>${esc(e.text)}</div></li>`).join('')}</ol></details></section>`;
    const re = () => UC.go('projects', { keepScroll: true });
    view.querySelector('#pBack').onclick = () => { open = null; UC.go('projects'); };
    view.querySelector('#pRun')?.addEventListener('click', () => { C().start(p.id); App.ui.toast('Running. Steps go one at a time.'); setTimeout(re, 300); });
    view.querySelector('#pPause')?.addEventListener('click', () => { C().pause(p.id); re(); });
    view.querySelector('#pWhere').onclick = async e => { e.target.disabled = true; e.target.innerHTML = '<span class="task-spin"></span>'; try { lastReport[p.id] = await C().whereAreWe(p.id); } catch (err) { lastReport[p.id] = C().statusReport(p).lines.join('\n'); } re(); };
    view.querySelector('#pThink').onclick = () => UC.decide.think(`Commit to “${p.name || p.goal}”?`, 'project', p.id, () => UC.go('projects', { id: p.id, keepScroll: true }));
    view.querySelector('#pFork').onclick = () => App.ui.modal(`<div class="row spread"><h2>Fork this project</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="muted small">Same goal, a different approach. The original keeps its progress.</p><label class="field">Try this instead<input id="fkA" placeholder="e.g. Cut hours on slow weekdays instead of overtime"></label>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="fkGo">Fork</button></div>`, (c, close) => {
      c.querySelector('#fkGo').onclick = async ev => { const a = c.querySelector('#fkA').value.trim(); if (!a) return App.ui.toast('Describe the other approach'); ev.target.disabled = true; ev.target.innerHTML = '<span class="task-spin"></span>'; const f = await C().fork(p.id, a); close(); open = f.id; UC.go('projects'); };
    });
    view.querySelector('#pDel').onclick = () => { if (!confirm('Delete this project? Agent results stay in the Brain.')) return; C().remove(p.id); open = null; UC.go('projects'); };
    view.querySelector('#pBtw').onsubmit = async e => { e.preventDefault(); const q = view.querySelector('#pQ').value.trim(); if (!q) return; const b = e.target.querySelector('button'); b.disabled = true; b.innerHTML = '<span class="task-spin"></span>'; try { await C().btw(p.id, q); } catch (err) { App.ui.toast(err.message); } re(); };
  }

  App.bus.on('uc-projects', () => { if (UC.current?.() === 'projects' && !document.querySelector('#modal:not([hidden])') && !document.activeElement?.matches('input,textarea')) { clearTimeout(UC._pt); UC._pt = setTimeout(() => UC.go('projects', { keepScroll: true }), 250); } });
})(window.UC);
