/* Unit Command screens: Ventures, Agent Map, Agents (+ agent drawer), Imports, Settings */
(function (UC) {
  const { esc } = App;
  const E = () => UC.engine;
  UC.screens = UC.screens || {};
  const md = s => esc(s).replace(/^# (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h4>$1</h4>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?:^\d+\. .*(?:\n|$))+/gm, m => `<ol>${m.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')}</ol>`).replace(/ {2}\n/g, '<br>').replace(/\n\n/g, '<br>');

  /* ---------- Ventures ---------- */
  const TYPES = () => Object.entries(App.biz.TEMPLATES).filter(([, t]) => t.kind === 'business');
  UC.screens.ventures = async (view) => {
    const vs = E().ventures(), S = E().STAGES;
    const prog = v => { const all = S.flatMap(s => v.check[s.id] || []); return all.length ? all.filter(i => i.done).length / all.length : 0; };
    const today = App.dateKey(new Date());
    view.innerHTML = `<section class="card"><div class="row spread"><div class="uc-sh"><span class="uc-num">VS</span><div><h2 class="uc-dup">Ventures</h2><div class="muted small">every business you’re creating, from idea to operating unit</div></div></div>
        <button class="btn primary" id="vNew">${App.fx.icon('plus')} New venture</button></div>
      ${vs.some(v => v.sample) ? '<div class="uc-demo small" style="margin-top:12px">These three are examples to show how it works. Open one and delete it, or add your own.</div>' : ''}
      <div class="uc-board">${S.map(s => { const col = vs.filter(v => v.stage === s.id); return `<div class="uc-stage"><div class="uc-stage-h"><b>${s.name}</b><span class="muted tiny">${col.length}</span></div>
        ${col.map(v => { const items = v.check[v.stage] || [], next = items.find(i => !i.done), late = items.some(i => !i.done && i.due && i.due < today); return `<button class="uc-vcard ${late ? 'late' : ''}" data-v="${v.id}">
          <b>${esc(v.name)}</b><span class="muted tiny">${esc(App.biz.TEMPLATES[v.type]?.label || '')}${v.open ? ` · opens ${E().fmtDay(v.open)}` : ''}</span>
          <span class="uc-bar"><i style="width:${Math.round(prog(v) * 100)}%"></i></span>
          <span class="tiny">${next ? `Next: ${esc(next.t)}${next.due ? ` · due ${E().fmtDay(next.due)}` : ''}` : 'Stage complete, ready to move on'}</span>${late ? '<span class="uc-flag tiny">overdue</span>' : ''}</button>`; }).join('') || '<div class="uc-empty tiny">—</div>'}</div>`; }).join('')}</div></section>
      <section class="card"><div class="uc-sh"><h2>Venture agents</h2><span class="muted tiny">Venture Studio · ${UC.dept('venture').count} agents</span></div>
        <div class="uc-chips">${UC.dept('venture').agents.map(a => `<button class="uc-chip" data-agent="venture/${a[0]}">${esc(a[1])}${a[7] ? ' <span class="uc-live">rules</span>' : ''}</button>`).join('')}</div></section>`;
    view.querySelector('#vNew').onclick = () => editVenture(null);
    view.querySelectorAll('[data-v]').forEach(b => b.onclick = () => editVenture(b.dataset.v));
  };
  function editVenture(id) {
    const all = E().ventures(), S = E().STAGES;
    const v = id ? JSON.parse(JSON.stringify(all.find(x => x.id === id))) : { id: App.uid(), name: '', type: 'restaurant', stage: 'idea', open: '', owner: 'You', notes: '', check: Object.fromEntries(S.map(s => [s.id, E().blankChecklist(s.id)])) };
    const stageIx = S.findIndex(s => s.id === v.stage);
    App.ui.modal(`<div class="row spread"><h2>${id ? esc(v.name) : 'New venture'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-two"><label class="field">Name<input id="vN" value="${esc(v.name)}" placeholder="e.g. Second location, Eastside"></label>
        <label class="field">Type of business<select id="vT" data-native>${TYPES().map(([k, t]) => `<option value="${k}" ${k === v.type ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label></div>
      <div class="sp-two"><label class="field">Stage<select id="vS" data-native>${S.map(s => `<option value="${s.id}" ${s.id === v.stage ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>
        <label class="field">Target opening<input id="vO" type="date" value="${esc(v.open)}"></label></div>
      <div class="uc-checks">${S.map((s, i) => `<details ${s.id === v.stage ? 'open' : ''} class="${i < stageIx ? 'past' : ''}"><summary><b>${s.name}</b> <span class="muted tiny">${(v.check[s.id] || []).filter(x => x.done).length}/${(v.check[s.id] || []).length}</span></summary>
        ${(v.check[s.id] || []).map((it, k) => `<div class="uc-ci"><label><input type="checkbox" data-ck="${s.id}:${k}" ${it.done ? 'checked' : ''}> ${esc(it.t)}</label><input type="date" data-due="${s.id}:${k}" value="${esc(it.due || '')}" aria-label="Due date"></div>`).join('')}</details>`).join('')}</div>
      <label class="field">Notes<textarea id="vNo" rows="3">${esc(v.notes || '')}</textarea></label>
      ${id ? `<div class="uc-sub">Agents for the ${esc(S[stageIx].name)} stage</div><div class="uc-chips">${UC.AGENTS.filter(a => a.dept === 'venture' && UC.cadence(a).stage === v.stage).map(a => `<button class="uc-chip" data-agent="${a.id}">${esc(a.name)}</button>`).join('') || '<span class="muted tiny">None for this stage.</span>'}</div>
        <div class="row" style="margin-top:8px"><button class="btn small" id="vRun">${App.fx.icon('sparkles')} Run all of them on this venture</button></div>` : ''}
      <div class="row" style="justify-content:space-between;margin-top:12px">${id ? '<div class="row"><button class="btn danger" id="vDel">Delete</button>' + (v.stage === 'operating' || v.stage === 'open' ? '<button class="btn" id="vUnit">Add as a unit</button>' : '') + '</div>' : '<span></span>'}
        <div class="row">${id ? '<button class="btn" id="vThink">Before you decide</button>' : ''}<button class="btn" data-close>Cancel</button><button class="btn primary" id="vSave">Save</button></div></div>`, (c, close) => {
      const collect = () => {
        v.name = c.querySelector('#vN').value.trim(); v.type = c.querySelector('#vT').value; v.stage = c.querySelector('#vS').value; v.open = c.querySelector('#vO').value; v.notes = c.querySelector('#vNo').value; v.sample = false;
        c.querySelectorAll('[data-ck]').forEach(x => { const [s, k] = x.dataset.ck.split(':'); v.check[s][k].done = x.checked; });
        c.querySelectorAll('[data-due]').forEach(x => { const [s, k] = x.dataset.due.split(':'); v.check[s][k].due = x.value; });
      };
      c.querySelector('#vSave').onclick = () => { collect(); if (!v.name) return App.ui.toast('Name the venture'); const l = E().ventures(); const i = l.findIndex(x => x.id === v.id); if (i >= 0) l[i] = v; else l.push(v); E().saveVentures(l); close(); UC.go('ventures', { keepScroll: true }); };
      c.querySelector('#vRun')?.addEventListener('click', async e => {
        const ags = UC.AGENTS.filter(a => a.dept === 'venture' && UC.cadence(a).stage === v.stage);
        e.target.disabled = true; let n = 0;
        for (const a of ags) { e.target.innerHTML = `<span class="task-spin"></span> ${esc(a.name)} (${++n} of ${ags.length})…`; try { await UC.ai.run(a, { ventureId: v.id }); } catch (err) { App.ui.toast(err.message, 6000); break; } }
        e.target.disabled = false; e.target.textContent = 'Done. Tap an agent above to read its result.';
      });
      c.querySelector('#vThink')?.addEventListener('click', () => { close(); UC.decide.think(`Go ahead with ${v.name}?`, 'venture', v.id, () => UC.go('ventures')); });
      c.querySelector('#vDel')?.addEventListener('click', () => { if (!confirm(`Delete ${v.name}?`)) return; E().saveVentures(E().ventures().filter(x => x.id !== v.id)); close(); UC.go('ventures'); });
      c.querySelector('#vUnit')?.addEventListener('click', () => {
        collect(); const b = App.biz.create({ name: v.name, type: v.type, description: 'Created from a Unit Command venture', started: v.open || App.dateKey(new Date()) });
        v.stage = 'operating'; const last = v.check.operating; if (last?.length) last[last.length - 1].done = true; v.unitId = b.id;
        const l = E().ventures(); l[l.findIndex(x => x.id === v.id)] = v; E().saveVentures(l); close(); App.ui.toast(`${v.name} added as a unit. Import its exports in Imports.`); UC.go('ventures');
      });
    });
  }

  /* ---------- Agent Map (hub and spokes) ---------- */
  let mapSel = null;
  UC.screens.map = async (view) => {
    const st = E().state();
    const depts = UC.DEPTS.filter(UC.enabledDept), ring = depts.filter(d => !d.readByAll), know = depts.find(d => d.readByAll);
    const W = 1120, H = 860, cx = W / 2, cy = H / 2, R = 270;
    const recent = id => st.runs[id] && Date.now() - st.runs[id] < 864e5;
    let svg = `<defs><radialGradient id="hubg"><stop offset="0" stop-color="var(--uc-hub)" stop-opacity=".55"/><stop offset="1" stop-color="var(--uc-hub)" stop-opacity="0"/></radialGradient></defs>
      <circle cx="${cx}" cy="${cy}" r="150" fill="url(#hubg)"/>`;
    // hub dust: one dot per agent, near the center
    UC.AGENTS.filter(UC.enabledAgent).forEach((a, i) => { const ang = i * 2.399963, rr = 18 + Math.sqrt(i) * 8.5; svg += `<circle cx="${(cx + Math.cos(ang) * rr).toFixed(1)}" cy="${(cy + Math.sin(ang) * rr).toFixed(1)}" r="1.6" fill="${UC.dept(a.dept).color}" opacity=".7"/>`; });
    const nodes = [];
    ring.forEach((d, i) => {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / ring.length, x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
      const on = !mapSel || mapSel === d.id, agents = d.agents.map(a => UC.agent(`${d.id}/${a[0]}`)).filter(UC.enabledAgent);
      svg += `<g class="uc-spoke ${on ? '' : 'dim'}" data-dept="${d.id}">`;
      svg += `<path d="M${cx},${cy} Q${(cx + x) / 2 + Math.sin(ang) * 30},${(cy + y) / 2 - Math.cos(ang) * 30} ${x},${y}" stroke="${d.color}" class="uc-wire ${mapSel === d.id ? 'hot' : ''}"/>`;
      agents.forEach((a, k) => {
        const spread = 1.15, aa = ang - spread / 2 + (agents.length > 1 ? k * spread / (agents.length - 1) : spread / 2), rr = 62 + (k % 3) * 22 + (a.rule ? 6 : 0);
        const ax = x + Math.cos(aa) * rr, ay = y + Math.sin(aa) * rr;
        svg += `<line x1="${x}" y1="${y}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="${d.color}" class="uc-twig"/>`;
        svg += `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="${a.rule ? 5.5 : 4}" fill="${a.rule || UC.canAuto(a) ? d.color : 'var(--panel)'}" stroke="${d.color}" stroke-width="1.6" class="uc-adot ${recent(a.id) ? 'pulse' : ''}" data-agent="${a.id}"><title>${esc(a.name)} (${UC.agentKind(a)[0]})</title></circle>`;
      });
      svg += `<circle cx="${x}" cy="${y}" r="21" class="uc-dnode" stroke="${d.color}"/><text x="${x}" y="${y + 4}" class="uc-dnum" fill="${d.color}">${String(i + 1).padStart(2, '0')}</text>`;
      const lx = cx + Math.cos(ang) * (R + 132), ly = cy + Math.sin(ang) * (R + 128);
      svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="uc-dlabel" text-anchor="${Math.abs(Math.cos(ang)) < .3 ? 'middle' : Math.cos(ang) > 0 ? 'start' : 'end'}">${esc(d.short)}</text></g>`;
      nodes.push(d);
    });
    if (know) svg += `<g data-dept="${know.id}" class="uc-spoke ${!mapSel || mapSel === know.id ? '' : 'dim'}"><circle cx="${cx}" cy="${cy}" r="34" class="uc-dnode hub" stroke="${know.color}"/><text x="${cx}" y="${cy - 2}" class="uc-dnum" fill="var(--text)">KB</text><text x="${cx}" y="${cy + 13}" class="uc-hubt">read by all</text></g>`;
    const sel = mapSel && UC.dept(mapSel);
    const panel = sel ? (() => { const ags = sel.agents.map(a => UC.agent(`${sel.id}/${a[0]}`)).filter(UC.enabledAgent); return `<div class="row spread"><div class="uc-sh"><span class="uc-dot lg" style="background:${sel.color}"></span><div><h2>${esc(sel.name)}</h2><div class="muted tiny">${ags.length} agents · ${esc(sel.about)}</div></div></div><button class="btn small ghost" id="mClear">Show all</button></div>
        <div class="uc-alist">${ags.map(a => `<button class="uc-arow" data-agent="${a.id}"><span class="uc-st ${a.rule ? 'live' : UC.canAuto(a) ? 'auto' : ''}"></span><span><b>${esc(a.name)}</b><span class="muted tiny">${UC.agentKind(a)[0]} · ${esc(a.trigger)} → ${esc(a.output)}</span></span>${a.signoff ? '<span class="badge accent">sign-off</span>' : ''}<span class="muted tiny">${UC.ago(st.runs[a.id])}</span></button>`).join('')}</div>
        <button class="btn small" id="mRunDept">${App.fx.icon('sparkles')} Run ${esc(sel.short)} agents</button>`; })()
      : `<h2>${UC.AGENTS.filter(UC.enabledAgent).length} agents run this business</h2><p class="muted small">Tap a department to see its agents. Filled dots run on their own (rules on your data, or AI on autopilot); hollow dots are AI agents that run when you give them something to work on. Dots pulse when an agent ran in the last 24 hours. Knowledge sits in the middle because every agent reads it first.</p>
        <div class="uc-dgrid">${depts.map(d => `<button class="uc-dbtn" data-dept="${d.id}" style="--dc:${d.color}"><b>${esc(d.name)}</b><span class="muted tiny">${d.agents.map(a => UC.agent(`${d.id}/${a[0]}`)).filter(UC.enabledAgent).length} agents · ${d.agents.map(a => UC.agent(`${d.id}/${a[0]}`)).filter(a => a.rule || UC.canAuto(a)).length} run on their own</span></button>`).join('')}</div>`;
    view.innerHTML = `<div class="uc-mapwrap"><section class="card uc-mapcard"><svg viewBox="0 0 ${W} ${H}" class="uc-map" role="img" aria-label="Agent map">${svg}</svg></section><section class="card uc-mappanel">${panel}</section></div>`;
    view.querySelectorAll('[data-dept]').forEach(g => g.addEventListener('click', e => { if (e.target.closest('[data-agent]')) return; mapSel = mapSel === g.dataset.dept ? null : g.dataset.dept; UC.go('map', { keepScroll: true }); }));
    view.querySelector('#mClear')?.addEventListener('click', () => { mapSel = null; UC.go('map', { keepScroll: true }); });
    view.querySelector('#mRunDept')?.addEventListener('click', async () => { const ids = UC.AGENTS.filter(a => a.dept === mapSel && UC.enabledAgent(a)).map(a => a.id); const r = await E().run(ids); App.ui.toast(`${r.length} agents ran`); UC.go('map', { keepScroll: true }); });
  };

  /* ---------- Agents ---------- */
  let q = '', fDept = '', fStat = '';
  UC.screens.agents = async (view) => {
    const st = E().state();
    const all = UC.AGENTS.filter(UC.enabledAgent);
    const list = all.filter(a => (!fDept || a.dept === fDept) && (!q || (a.name + ' ' + a.does + ' ' + a.output).toLowerCase().includes(q.toLowerCase()))
      && (!fStat || (fStat === 'live' ? a.rule : fStat === 'auto' ? !a.rule && UC.canAuto(a) : fStat === 'designed' ? !a.rule && !UC.canAuto(a) : fStat === 'signoff' ? a.signoff : st.off[a.id])));
    const depts = UC.DEPTS.filter(UC.enabledDept);
    view.innerHTML = `<section class="card"><div class="row spread"><div class="uc-sh"><span class="uc-num">${all.length}</span><div><h2 class="uc-dup">Agents</h2><div class="muted small">${all.filter(a => a.rule).length} rules · ${all.filter(a => !a.rule && UC.canAuto(a)).length} AI on autopilot · ${all.filter(a => !a.rule && !UC.canAuto(a)).length} AI on demand · one workflow file each</div></div></div>
        <div class="row"><button class="btn" id="aRunLive">${App.fx.icon('sparkles')} Run rules agents</button><button class="btn ghost" id="aExport">${App.fx.icon('download')} Workflows (.md)</button></div></div>
      <div class="uc-filters"><input id="aQ" placeholder="Search agents…" value="${esc(q)}" aria-label="Search agents">
        <select id="aD" data-native aria-label="Department"><option value="">All departments</option>${depts.map(d => `<option value="${d.id}" ${fDept === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <div class="seg">${[['', 'All'], ['live', 'Rules'], ['auto', 'Autopilot'], ['designed', 'On demand'], ['signoff', 'Sign-off'], ['off', 'Off']].map(([k, l]) => `<button data-fs="${k}" class="${fStat === k ? 'on' : ''}">${l}</button>`).join('')}</div></div></section>
      ${depts.filter(d => list.some(a => a.dept === d.id)).map(d => `<section class="card uc-agroup" style="--dc:${d.color}"><div class="uc-sh"><span class="uc-dot lg" style="background:${d.color}"></span><div><h2>${esc(d.name)}</h2><div class="muted tiny">${esc(d.about)}</div></div></div>
        <div class="uc-alist">${list.filter(a => a.dept === d.id).map(a => `<button class="uc-arow ${st.off[a.id] ? 'off' : ''}" data-agent="${a.id}"><span class="uc-st ${a.rule ? 'live' : UC.canAuto(a) ? 'auto' : ''}" title="${agentKind(a)[0]}"></span>
          <span><b>${esc(a.name)}</b><span class="muted tiny">${esc(a.does)}</span></span><span class="uc-meta tiny"><span>${agentKind(a)[0]} · ${esc(a.trigger)}</span>${a.signoff ? '<span class="badge accent">sign-off</span>' : ''}${st.off[a.id] ? '<span class="badge">off</span>' : ''}<span class="muted">${st.runs[a.id] ? 'ran ' + UC.ago(st.runs[a.id]) : ''}</span></span></button>`).join('')}</div></section>`).join('') || '<div class="card empty">No agents match.</div>'}`;
    const re = () => UC.go('agents', { keepScroll: true });
    const qi = view.querySelector('#aQ'); qi.oninput = () => { q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => UC.go('agents', { keepScroll: true }).then(() => { const n = document.getElementById('aQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 250); };
    view.querySelector('#aD').onchange = e => { fDept = e.target.value; re(); };
    view.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { fStat = b.dataset.fs; re(); });
    view.querySelector('#aRunLive').onclick = async () => { const r = await E().run(E().liveIds()); App.ui.toast(`${r.length} rules agents ran. Results are on Today.`); re(); };
    view.querySelector('#aExport').onclick = () => App.download(`${UC.BRAND.name.replace(/\s+/g, '-')}-workflows.md`, UC.AGENTS.filter(UC.enabledAgent).map(a => `<!-- ${a.id}.md -->\n` + UC.workflow(a)).join('\n---\n\n'), 'text/markdown');
  };

  /* Agent drawer: give it work, run it with AI, read the result, see its workflow and history */
  const agentKind = a => a.rule ? ['Rules', 'good', 'Runs on your imported data, no AI needed.'] : UC.canAuto(a) ? ['AI · autopilot', 'accent', 'Runs on its own on schedule while the desktop app is open.'] : ['AI · on demand', '', 'Runs when you give it something to work on.'];
  UC.agentKind = agentKind;
  UC.md = md;
  const fullMd = s => esc(s).replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h4>$1</h4>').replace(/^# (.*)$/gm, '<h3>$1</h3>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^\|.*\|[ \t]*(?:\n|$))+/gm, t => { const rows = t.trim().split('\n').filter(r => !/^\|\s*:?-{2,}/.test(r)); return `<div class="uc-tablewrap"><table class="uc-table sm">${rows.map((r, i) => `<tr>${r.replace(/^\||\|$/g, '').split('|').map(c => i ? `<td>${c.trim()}</td>` : `<th>${c.trim()}</th>`).join('')}</tr>`).join('')}</table></div>\n`; })
    .replace(/(?:^[ \t]*[-*] .*(?:\n|$))+/gm, m => `<ul>${m.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*[-*] (\[[ x]\] )?/, '')}</li>`).join('')}</ul>\n`)
    .replace(/(?:^\d+[.)] .*(?:\n|$))+/gm, m => `<ol>${m.trim().split('\n').map(l => `<li>${l.replace(/^\d+[.)] /, '')}</li>`).join('')}</ol>\n`).replace(/(<\/(?:ol|ul|div|h3|h4)>)\n+/g, '$1').replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  UC.fullMd = fullMd;
  async function readFileText(f) {
    if (/\.pdf$/i.test(f.name)) { const r = await App.ingest.readPdf(await f.arrayBuffer()); return r?.text || ''; }
    if (/\.(xlsx|xls|ods)$/i.test(f.name) && window.XLSX) { const wb = XLSX.read(await f.arrayBuffer()); return wb.SheetNames.map(n => `## ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n\n'); }
    return f.text();
  }
  UC.agentDrawer = async (id, tab) => {
    const a = UC.agent(id); if (!a) return;
    const d = UC.dept(a.dept), st = E().state(), [kl, kt, kd] = agentKind(a);
    const outs = a.rule ? [] : await UC.ai.outputs(a.id);
    const ai = a.rule ? null : await UC.ai.status();
    const recent = st.log.filter(e => e.agent === id).slice(-6).reverse();
    const vs = ['venture', 'multi'].includes(a.dept) ? E().ventures() : [];
    let view = tab || (outs.length ? 'result' : a.rule ? 'workflow' : 'run');
    const draw = c => {
      const body = c.querySelector('#adBody');
      c.querySelectorAll('[data-adt]').forEach(b => b.classList.toggle('on', b.dataset.adt === view));
      if (view === 'run') {
        body.innerHTML = a.rule ? `<p class="small">This agent runs on your imported data. Tap Run now.</p>` : `
          ${ai.running ? '' : `<div class="uc-demo small">${esc(ai.error)} ${App.hosted ? '' : '<a data-go="settings">Set up Ollama in Settings</a>.'}</div>`}
          ${vs.length ? `<label class="field">Venture<select id="adV" data-native><option value="">All ventures</option>${vs.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></label>` : ''}
          <label class="field">${esc(UC.needsFor(a))}<textarea id="adIn" rows="6" placeholder="Paste text, notes or numbers here"></textarea></label>
          <div class="row"><label class="btn small">${App.fx.icon('upload')} Add a file<input type="file" id="adFile" hidden accept=".txt,.md,.csv,.pdf,.xlsx,.xls,.json,.eml"></label><span class="muted tiny" id="adFileName"></span></div>
          <p class="muted tiny">It also reads: ${a.reads.filter(r => UC.AVAILABLE.includes(r)).map(r => esc(UC.INPUTS[r])).join(', ') || 'only what you give it'}, plus your Knowledge docs. Local AI can take a minute or two.</p>`;
        c.querySelector('#adFile')?.addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { const t = await readFileText(f); const ta = c.querySelector('#adIn'); ta.value = (ta.value ? ta.value + '\n\n' : '') + `--- ${f.name} ---\n` + t.slice(0, 30000); c.querySelector('#adFileName').textContent = f.name; } catch (err) { App.ui.toast('Could not read that file: ' + err.message); } });
      } else if (view === 'result') {
        const r = outs[0];
        body.innerHTML = r ? `<div class="row spread tiny muted"><span>${UC.ago(r.t)} · ${esc(r.model || '')}${r.ms ? ` · ${Math.round(r.ms / 1000)} s` : ''}${r.auto ? ' · autopilot' : ''}${r.demo ? ' · demo data' : ''}</span>
            <span class="row"><button class="btn small ghost" id="adCopy">Copy</button><button class="btn small ghost" id="adSave">${App.fx.icon('download')} .md</button>${a.dept === 'knowledge' ? '<button class="btn small" id="adUse">Use as my ' + esc(a.name) + '</button>' : ''}</span></div>
          <p class="small"><b>${esc(r.summary)}</b></p>
          ${r.flags?.length ? `<div class="uc-sub">Flags</div><ul class="uc-bul small">${r.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
          ${r.missing?.length ? `<div class="uc-sub">It needed</div><ul class="uc-bul small">${r.missing.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
          <div class="uc-md small">${fullMd(r.output || '')}</div>
          ${outs.length > 1 ? `<div class="uc-sub">Earlier results</div><div class="uc-alist">${outs.slice(1).map((o, i) => `<button class="uc-arow" data-old="${i + 1}"><span class="uc-st"></span><span><b>${esc(o.summary.slice(0, 120))}</b><span class="muted tiny">${UC.ago(o.t)}</span></span></button>`).join('')}</div>` : ''}`
          : '<div class="uc-empty">No results yet. Run it.</div>';
        c.querySelector('#adCopy')?.addEventListener('click', () => navigator.clipboard?.writeText(r.output).then(() => App.ui.toast('Copied')));
        c.querySelector('#adSave')?.addEventListener('click', () => App.download(`${a.key}-${App.dateKey(new Date(r.t))}.md`, `# ${a.name}\n\n${r.summary}\n\n${r.output}`, 'text/markdown'));
        c.querySelector('#adUse')?.addEventListener('click', () => { UC.ai.setKnowledge(a.key, r.output); App.ui.toast(`Saved as your ${a.name}. Every agent reads it now.`); });
        c.querySelectorAll('[data-old]').forEach(b => b.onclick = () => { outs.unshift(outs.splice(+b.dataset.old, 1)[0]); draw(c); });
      } else if (view === 'workflow') {
        body.innerHTML = `<div class="uc-md small">${md(UC.workflow(a))}</div>${recent.length ? `<div class="uc-sub">Recent runs</div><ol class="uc-log">${recent.map(UC.logItem).join('')}</ol>` : ''}`;
      }
    };
    App.ui.modal(`<div class="row spread"><div class="uc-sh"><span class="uc-dot lg" style="background:${d.color}"></span><div><h2>${esc(a.name)}</h2><div class="muted tiny">${esc(d.name)} · <code>${esc(a.id)}.md</code></div></div></div><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="small" style="margin:6px 0">${esc(a.does)}</p>
      <div class="row" style="margin:6px 0 10px"><span class="badge ${kt}" title="${esc(kd)}">${kl}</span>${a.signoff ? '<span class="badge accent">Needs your yes</span>' : ''}<span class="muted tiny">${esc(a.trigger)} → ${esc(a.output)}</span></div>
      <div class="seg" style="margin-bottom:10px">${a.rule ? '' : '<button data-adt="run">Give it work</button><button data-adt="result">Result</button>'}<button data-adt="workflow">Workflow</button></div>
      <div id="adBody"></div>
      <div class="row" style="justify-content:space-between;margin-top:12px"><label class="row small"><input type="checkbox" id="adOn" ${st.off[a.id] ? '' : 'checked'}> Agent on</label>
        <div class="row"><button class="btn" data-close>Close</button><button class="btn primary" id="adRun">${App.fx.icon('sparkles')} ${a.rule ? 'Run now' : 'Run with AI'}</button></div></div>`, (c, close) => {
      c.querySelectorAll('[data-adt]').forEach(b => b.onclick = () => { view = b.dataset.adt; draw(c); });
      draw(c);
      c.querySelector('#adOn').onchange = e => { E().setOff(a.id, !e.target.checked); App.ui.toast(e.target.checked ? 'Agent on' : 'Agent off'); };
      const btn = c.querySelector('#adRun');
      btn.onclick = async () => {
        if (E().state().off[a.id]) return App.ui.toast('Turn the agent on first');
        if (a.rule) { const [r] = await E().run([a.id]); close(); App.ui.toast(r ? r.text.slice(0, 140) : 'Ran', 6000); UC.go(UC.current(), { keepScroll: true }); return; }
        const input = c.querySelector('#adIn')?.value || '', ventureId = c.querySelector('#adV')?.value || '';
        btn.disabled = true; btn.innerHTML = '<span class="task-spin"></span> Thinking…';
        try { await UC.ai.run(a, { input, ventureId }); App.ui.toast(`${a.name} finished`); close(); UC.agentDrawer(a.id, 'result'); UC.go(UC.current(), { keepScroll: true }); }
        catch (e) { App.ui.toast(e.message, 6000); btn.disabled = false; btn.innerHTML = `${App.fx.icon('sparkles')} Run with AI`; }
      };
    });
  };

  /* ---------- Knowledge (every agent reads these first) ---------- */
  UC.screens.knowledge = async (view) => {
    const k = UC.ai.knowledge();
    view.innerHTML = `<section class="card"><div class="uc-sh"><span class="uc-num">KB</span><div><h2 class="uc-dup">Knowledge</h2><div class="muted small">every agent reads these before it does anything · the better these are, the better every draft</div></div></div></section>
      ${UC.ai.KDOCS.map(([id, name, hint]) => `<section class="card"><div class="row spread"><div class="uc-sh"><h2>${esc(name)}</h2><span class="muted tiny">${k[id] ? `${k[id].length.toLocaleString()} characters` : 'empty'}</span></div>
        <div class="row"><button class="btn small ghost" data-agent="knowledge/${id}">${App.fx.icon('sparkles')} Draft with AI</button><button class="btn small primary" data-ksave="${id}">Save</button></div></div>
        <textarea data-k="${id}" rows="8" placeholder="${esc(hint)}" style="width:100%;margin-top:10px">${esc(k[id] || '')}</textarea></section>`).join('')}`;
    view.querySelectorAll('[data-ksave]').forEach(b => b.onclick = () => { UC.ai.setKnowledge(b.dataset.ksave, view.querySelector(`[data-k="${b.dataset.ksave}"]`).value); App.ui.toast('Saved. Every agent reads it from now on.'); });
  };

  /* ---------- Settings: AI card ---------- */
  UC.aiSettingsCard = async () => {
    if (App.hosted) return `<section class="card"><div class="uc-sh"><h2>AI agents</h2></div><p class="small">Agents think on your computer with Ollama. Open Unit Command from the Ops Command Desk desktop app (sidebar → Unit Command) to set it up and run them. Results sync here.</p></section>`;
    const s = await UC.ai.status(true), ap = UC.ai.auto();
    const due = s.running ? UC.ai.dueList(await E().context()).length : 0;
    return `<section class="card"><div class="uc-sh"><h2>AI agents (Ollama)</h2><span class="muted tiny">runs on this computer · free · your data stays here</span></div>
      <div id="ucOl" style="margin-top:10px"></div>
      ${s.running ? `<div class="sp-two" style="margin-top:10px"><label class="field">Model<select id="aiM" data-native>${s.models.map(m => `<option ${m === UC.ai.model() ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        <label class="field">Memory per run (context)<select id="aiC" data-native>${[[8192, '8K (fast)'], [12288, '12K (default)'], [16384, '16K'], [32768, '32K (big docs, needs RAM)']].map(([v, l]) => `<option value="${v}" ${+App.settings.get('ai.ollama.ctx', 12288) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <p class="muted tiny">Bigger models write better plans and drafts. qwen3:8b or gemma3 is worth it if this computer has 16 GB of memory.</p>
        <label class="row small" style="margin-top:6px"><input type="checkbox" id="aiAuto" ${ap.on ? 'checked' : ''}> Autopilot: run due agents on their schedule while this app is open</label>
        <label class="row small"><input type="checkbox" id="aiVen" ${ap.ventures ? 'checked' : ''}> Include venture agents when a venture reaches their stage</label>
        <div class="uc-targets" style="margin-top:8px"><label class="field">Daily AI time budget for projects<span class="uc-in"><input type="number" id="aiBud" min="10" step="10" value="${UC.S.get('coord.budgetMin', 60)}" inputmode="numeric"><i>min</i></span></label></div>
        <div class="row" style="margin-top:8px"><button class="btn" id="aiNow">${App.fx.icon('sparkles')} Run due agents now (${due})</button></div>` : ''}</section>`;
  };
  UC.bindAiSettings = view => {
    const box = view.querySelector('#ucOl');
    if (box && App.ollamaSetup) App.ollamaSetup(box, { onReady: () => UC.ai.status(true) });
    view.querySelector('#aiM')?.addEventListener('change', e => { App.settings.set(App.ai.modelKey('ollama'), e.target.value); App.ui.toast('Model set to ' + e.target.value); });
    view.querySelector('#aiC')?.addEventListener('change', e => App.settings.set('ai.ollama.ctx', +e.target.value));
    view.querySelector('#aiAuto')?.addEventListener('change', e => { UC.ai.setAuto({ on: e.target.checked }); App.ui.toast(e.target.checked ? 'Autopilot on' : 'Autopilot off'); if (e.target.checked) UC.ai.tick(); });
    view.querySelector('#aiVen')?.addEventListener('change', e => UC.ai.setAuto({ ventures: e.target.checked }));
    view.querySelector('#aiBud')?.addEventListener('change', e => UC.S.set('coord.budgetMin', Math.max(10, +e.target.value || 60)));
    view.querySelector('#aiNow')?.addEventListener('click', () => { App.ui.toast('Running due agents in the background'); UC.ai.tick(true); });
  };

  /* ---------- Imports ---------- */
  const GUIDES = [
    ['CrunchTime', 'Daily Sales & Labor Variance (CSV), Actual vs. Theoretical (PDF), Inventory count / variance (PDF), Purchase Journal (PDF). Recognized automatically.', 'live'],
    ['Harri', 'Timesheet / labor report or roster (CSV or Excel). Hours, overtime and scheduled hours feed People agents.', 'live'],
    ['Square', 'Reports → Sales Summary or Item Sales, export CSV by day. Needs a Date column and Net Sales (or Gross Sales).', 'csv'],
    ['Clover', 'Reports → Sales overview, export CSV by day. Needs Date and Net Sales.', 'csv'],
    ['Toast', 'Reports → Sales summary by day, export CSV. Labor: Time entries export.', 'csv'],
    ['Rosnet / R365 / QuickBooks', 'P&L and budget exports as Excel/CSV for Finance agents.', 'csv'],
    ['Any POS or spreadsheet', 'One row per day with a Date column plus any of: Net Sales, Sales Forecast, Labor Cost, Actual Hours, Scheduled Hours, Overtime Hours, Guest Count.', 'csv']
  ];
  UC.screens.imports = async (view) => {
    const ctx = await E().context();
    const units = ctx.real;
    const target = UC.S.get('importTo', units[0]?.id || '');
    view.innerHTML = `<section class="card"><div class="uc-sh"><span class="uc-num">IN</span><div><h2 class="uc-dup">Imports</h2><div class="muted small">exports from the systems you already use · shared with Ops Command Desk</div></div></div>
      <div class="sp-two" style="margin-top:12px"><label class="field">Import into unit<select id="iU" data-native>${units.map(u => `<option value="${u.id}" ${u.id === target ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
        <div class="field"><span>Need another unit?</span><button class="btn" id="iNew">${App.fx.icon('plus')} Add a unit</button></div></div>
      <label class="uc-drop" id="iDrop"><input type="file" id="iF" multiple hidden accept=".csv,.xlsx,.xls,.ods,.pdf,.txt">
        <span class="uc-drop-i">${App.fx.icon('upload')}</span><b>Drop exports here or tap to choose</b><span class="muted small">CSV, Excel or PDF. Files are read on this device.</span></label></section>
      <section class="card"><div class="uc-sh"><h2>Units and their data</h2></div>
        <div class="uc-tablewrap"><table class="uc-table sm"><thead><tr><th>Unit</th><th class="n">Days of sales</th><th>From</th><th>To</th><th>Food vs theo</th></tr></thead><tbody>
        ${units.map(u => `<tr><td><span class="uc-dot" style="background:${u.color}"></span>${esc(u.name)}</td><td class="n">${u.days.length || '—'}</td><td>${u.days[0] ? E().fmtDay(u.days[0].date) : '—'}</td><td>${u.days.length ? E().fmtDay(u.days[u.days.length - 1].date) : '—'}</td><td>${u.avt ? '+' + u.avt.gapPts + ' pts' : '—'}</td></tr>`).join('')}</tbody></table></div>
        ${ctx.demo ? '<p class="muted small">Until a unit has sales data, Today, Units and the agents use demo units.</p>' : ''}</section>
      <section class="card"><div class="uc-sh"><h2>Where to get each export</h2><span class="muted tiny">live POS connections come in a later phase</span></div>
        <div class="uc-guides">${GUIDES.map(([n, t, k]) => `<div class="uc-guide"><b>${esc(n)}</b>${k === 'live' ? '<span class="badge good">recognized</span>' : '<span class="badge">CSV by day</span>'}<div class="muted small">${esc(t)}</div></div>`).join('')}</div></section>`;
    const sel = view.querySelector('#iU');
    sel.onchange = () => UC.S.set('importTo', sel.value);
    const doImport = async files => {
      if (!files.length) return;
      if (!sel.value) return App.ui.toast('Add a unit first');
      UC.S.set('importTo', sel.value);
      await App.ingest.ingestMany(files, { businessId: sel.value });
      UC.S.set('lastImport', Date.now());
      await E().morningRun(true);
      UC.go('imports');
    };
    view.querySelector('#iF').onchange = e => doImport([...e.target.files]);
    const drop = view.querySelector('#iDrop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); doImport([...(e.dataTransfer?.files || [])]); });
    view.querySelector('#iNew').onclick = () => App.ui.modal(`<div class="row spread"><h2>Add a unit</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <label class="field">Name<input id="nuN" placeholder="e.g. Store 1042, Downtown"></label>
      <label class="field">Type<select id="nuT" data-native>${TYPES().map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select></label>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="nuGo">Add</button></div>`, (c, close) => {
      c.querySelector('#nuGo').onclick = () => { const n = c.querySelector('#nuN').value.trim(); if (!n) return App.ui.toast('Name the unit'); const b = App.biz.create({ name: n, type: c.querySelector('#nuT').value }); UC.S.set('importTo', b.id); close(); UC.go('imports'); };
    });
  };

  /* ---------- Settings ---------- */
  UC.screens.settings = async (view) => {
    const T = UC.targets(), demo = UC.S.get('demo', null), plan = UC.plan();
    const F = [['laborPct', 'Labor % target', '%'], ['forecastMiss', 'Forecast miss threshold', '%'], ['splh', 'Sales per labor hour target', '$'], ['otHours', 'Overtime hours per unit per week', 'h'],
      ['schedVar', 'Hours over schedule allowed', '%'], ['avtGap', 'Food cost above theoretical allowed', 'pts'], ['primeCost', 'Prime cost target', '%'], ['trendDrop', 'Weekly sales drop that gets flagged', '%']];
    const account = App.cloud ? await App.cloud.settingsCard() : '';
    const aiCard = await UC.aiSettingsCard();
    view.innerHTML = `<div class="uc-grid2"><div class="uc-col">
      <section class="card"><div class="uc-sh"><h2>Targets</h2><span class="muted tiny">the live agents flag anything past these</span></div>
        <div class="uc-targets">${F.map(([k, l, u]) => `<label class="field">${l}<span class="uc-in"><input type="number" step="0.5" data-t="${k}" value="${T[k]}" inputmode="decimal"><i>${u}</i></span></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="sSave">Save targets</button><button class="btn ghost" id="sReset">Defaults</button></div></section>
      <section class="card"><div class="uc-sh"><h2>Data</h2></div>
        <div class="seg">${[[null, 'Demo units: automatic'], [true, 'Always demo'], [false, 'Never demo']].map(([v, l]) => `<button data-demo="${v}" class="${demo === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <p class="muted small">Automatic shows demo units until one of your units has sales data. Demo data is never saved.</p>
        <div class="row"><button class="btn" id="sClrLog">Clear agent log</button><button class="btn" id="sClrAsk">Clear decided &amp; sample requests</button><button class="btn danger" id="sClrAll">Reset all agent history</button></div></section></div>
      <div class="uc-col">${aiCard}<section class="card"><div class="uc-sh"><h2>Plan</h2><span class="muted tiny">preview what the marketed version includes</span></div>
        <div class="seg">${Object.entries(UC.PLANS).map(([k, p]) => `<button data-plan="${k}" class="${plan === k ? 'on' : ''}">${p.label}</button>`).join('')}</div>
        <p class="muted small">${plan === 'lite' ? `Lite shows ${UC.AGENTS.filter(UC.enabledAgent).length} agents in ${UC.PLANS.lite.depts.length} departments, without Ventures or Multi-Unit Development.` : `Full: all ${UC.AGENTS.length} agents in ${UC.DEPTS.length} departments, Ventures and Multi-Unit Development.`}</p></section>
        <section class="card"><div class="uc-sh"><h2>Appearance</h2></div><div class="seg" style="margin-top:12px;display:flex">${[['dark', 'Dark'], ['light', 'Light'], ['auto', 'Automatic']].map(([k, l]) => `<button data-appear="${k}" class="${UC.appearance() === k ? 'on' : ''}" style="flex:1;justify-content:center">${l}</button>`).join('')}</div><p class="muted small" style="margin-top:8px">Dark glass is the default. Automatic follows your device.</p></section>
        <section class="card"><div class="uc-sh"><h2>Color</h2><span class="muted small">60% base · 30% support · 10% accent</span></div><div class="uc-alist" style="margin-top:8px">${[['gold', 'Black · White · Gold', 'Gold marks what to tap or look at first. Blue for links and AI, red only for alerts.', ['#000', '#fff', '#E9B949']], ['red', 'Black · White · Red', 'Red is the accent; gold for premium highlights. Alerts turn orange so they stay distinct.', ['#000', '#fff', '#F2263A']], ['navy', 'Navy · White · Gold', 'Deep navy base, white text, gold accent, red for alerts.', ['#0A1A33', '#fff', '#E9B949']]].map(([k, l, d, sw]) => `<button class="uc-arow ${UC.palette() === k ? 'on' : ''}" data-palette="${k}"><span class="uc-swatch">${sw.map(c => `<i style="background:${c}"></i>`).join('')}</span><span><b>${l}</b><span class="muted tiny">${d}</span></span></button>`).join('')}</div></section>
        ${account}
        <section class="card"><div class="uc-sh"><h2>About</h2></div><p class="small">${esc(UC.BRAND.name)} ${esc(UC.BRAND.version)} · ${UC.AGENTS.length} agents · shares sign-in, sync and imports with <a href="index.html">Ops Command Desk</a>.</p></section></div></div>`;
    view.querySelector('#sSave').onclick = () => { const t = {}; view.querySelectorAll('[data-t]').forEach(i => t[i.dataset.t] = +i.value); UC.S.set('targets', t); App.ui.toast('Targets saved'); E().morningRun(true); };
    view.querySelector('#sReset').onclick = () => { UC.S.set('targets', {}); UC.go('settings'); };
    view.querySelectorAll('[data-demo]').forEach(b => b.onclick = () => { UC.S.set('demo', JSON.parse(b.dataset.demo)); E().morningRun(true).then(() => UC.go('settings')); });
    view.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => { App.settings.set('uc.plan', b.dataset.plan); location.reload(); });
    view.querySelectorAll('[data-appear]').forEach(b => b.onclick = () => UC.setAppearance(b.dataset.appear));
    view.querySelectorAll('[data-palette]').forEach(b => b.onclick = () => UC.setPalette(b.dataset.palette));
    view.querySelector('#sClrLog').onclick = () => { E().clear('log'); App.ui.toast('Log cleared'); };
    view.querySelector('#sClrAsk').onclick = () => { E().clear('asks'); App.ui.toast('Cleared'); };
    view.querySelector('#sClrAll').onclick = () => { if (confirm('Clear every agent run, request and the morning page?')) { E().clear('all'); App.ui.toast('Agent history reset'); } };
    App.cloud?.bindSettings(view);
    UC.bindAiSettings(view);
  };
})(window.UC);
