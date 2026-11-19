/* Brain screen: Ask · Sections · Graph · Year over year · Setup (search by meaning + Obsidian vault) */
(function (UC) {
  const { esc } = App;
  const B = () => UC.brain;
  const money = v => App.fmt.money(v);
  let tab = 'ask', secOpen = '', typeF = '', q = '', lastAsk = null, yoyUnit = '';

  /* Note body → HTML with clickable [[links]] */
  const render = body => UC.fullMd(String(body || '')).replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, t, label) => `<a class="uc-wl" data-note-title="${esc(t.trim())}">${esc((label || t).trim())}</a>`);
  UC.brainRender = render;
  const typeLabel = t => (UC.BRAIN_TYPES[t] || ['', 'Note'])[1];
  const rowHtml = (n, extra = '') => `<button class="uc-arow uc-nrow" data-note="${esc(n.id)}" style="--dc:${UC.sectionColor(n.section)}"><span class="uc-dot" style="background:${UC.sectionColor(n.section)}"></span>
    <span><b>${esc(n.title)}</b><span class="muted tiny">${esc(n.section)} · ${typeLabel(n.type)}${n.date ? ' · ' + esc(n.date) : ''}${extra}</span></span><span class="muted tiny">${UC.ago(n.updated)}</span></button>`;

  /* ---------- note viewer / editor ---------- */
  UC.openNote = async (id, edit) => {
    await B().load();
    const n = B().get(id); if (!n) return App.ui.toast('That memory is gone');
    const editable = n.user || ['note', 'meeting', 'person'].includes(n.type);
    const back = [...B().notes().values()].filter(x => x.links.includes(n.id)).slice(0, 30);
    const fwd = n.links.map(l => B().get(l)).filter(Boolean);
    App.ui.modal(`<div class="row spread"><div class="uc-sh"><span class="uc-dot lg" style="background:${UC.sectionColor(n.section)}"></span><div><h2>${esc(n.title)}</h2><div class="muted tiny">${esc(n.section)} · ${typeLabel(n.type)}${n.date ? ' · ' + esc(n.date) : ''} · updated ${UC.ago(n.updated)}</div></div></div><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      ${n.tags.length ? `<div class="uc-chips" style="margin:6px 0">${n.tags.map(t => `<span class="badge">${esc(t)}</span>`).join('')}</div>` : ''}
      <div id="nBody">${edit && editable ? `<label class="field">Title<input id="nT" value="${esc(n.title)}"></label><label class="field">Section<input id="nS" value="${esc(n.section)}"></label><label class="field">Note (Markdown; link with [[Title]])<textarea id="nB" rows="12">${esc(n.body)}</textarea></label>`
        : `<div class="uc-md small uc-note">${render(n.body)}</div>`}</div>
      <label class="field" style="margin-top:10px">My notes <span class="muted tiny">(kept with this memory, also in Obsidian under “My notes”)</span><textarea id="nM" rows="3">${esc(n.mine || '')}</textarea></label>
      ${fwd.length || back.length ? `<div class="uc-sub">Linked</div><div class="uc-alist">${[...fwd, ...back.filter(b => !fwd.includes(b))].slice(0, 24).map(x => rowHtml(x)).join('')}</div>` : ''}
      <div class="row" style="justify-content:space-between;margin-top:12px"><div class="row">${editable ? `<button class="btn" id="nEdit">${edit ? 'Preview' : 'Edit'}</button><button class="btn danger" id="nDel">Delete</button>` : '<span class="muted tiny">Built from your data; it updates itself.</span>'}</div>
        <div class="row"><button class="btn ghost" id="nMd">${App.fx.icon('download')} .md</button><button class="btn primary" id="nSave">Save</button></div></div>`, (c, close) => {
      c.querySelector('#nEdit')?.addEventListener('click', () => { close(); UC.openNote(id, !edit); });
      c.querySelector('#nDel')?.addEventListener('click', async () => { if (!confirm('Delete this note from the Brain? (A copy already in your Obsidian vault stays there.)')) return; await B().remove(id); close(); App.bus.emit('brain-changed'); UC.go('brain', { keepScroll: true }); });
      c.querySelector('#nMd').onclick = () => App.download(`${n.title}.md`, `# ${n.title}\n\n${n.body}\n\n## My notes\n${c.querySelector('#nM').value}`, 'text/markdown');
      c.querySelector('#nSave').onclick = async () => {
        const mine = c.querySelector('#nM').value;
        if (edit && editable) await B().saveNote({ ...n, title: c.querySelector('#nT').value.trim() || n.title, section: c.querySelector('#nS').value.trim() || n.section, body: c.querySelector('#nB').value, mine });
        else await B().setMine(n.id, mine);
        App.ui.toast('Saved to the Brain'); close(); if (UC.current() === 'brain') UC.go('brain', { keepScroll: true });
      };
    });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-note]'); if (a) { e.preventDefault(); UC.openNote(a.dataset.note); return; }
    const t = e.target.closest('[data-note-title]'); if (t) { e.preventDefault(); const n = B().byTitle(t.dataset.noteTitle); n ? UC.openNote(n.id) : App.ui.toast('No memory with that title yet'); }
  });
  function newNote(kind = 'note') {
    App.ui.modal(`<div class="row spread"><h2>${kind === 'meeting' ? 'New meeting note' : kind === 'person' ? 'New person' : 'New note'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-two"><label class="field">Title<input id="nnT" placeholder="${kind === 'person' ? 'Full name' : kind === 'meeting' ? 'Meeting with…' : 'What is it about?'}"></label>
        <label class="field">Section<input id="nnS" value="${kind === 'person' ? 'People' : 'Notes'}"></label></div>
      <label class="field">Note (Markdown; link other memories with [[Title]])<textarea id="nnB" rows="10" placeholder="${kind === 'meeting' ? 'Who, what was decided, follow-ups…' : ''}"></textarea></label>
      <label class="field">Tags (comma separated)<input id="nnG"></label>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="nnGo">Save</button></div>`, (c, close) => {
      c.querySelector('#nnGo').onclick = async () => {
        const title = c.querySelector('#nnT').value.trim(); if (!title) return App.ui.toast('Give it a title');
        await B().saveNote({ type: kind, title, section: c.querySelector('#nnS').value.trim() || 'Notes', body: c.querySelector('#nnB').value, date: App.dateKey(new Date()), tags: c.querySelector('#nnG').value.split(',').map(s => s.trim()).filter(Boolean) });
        close(); App.ui.toast('Saved to the Brain'); UC.go('brain', { keepScroll: true });
      };
    });
  }

  /* ---------- screen ---------- */
  UC.screens.brain = async (view) => {
    view.innerHTML = '<div class="card"><span class="task-spin"></span> Gathering memories…</div>';
    await B().capture();
    const all = [...B().notes().values()];
    const tops = {}; all.forEach(n => { const t = n.section.split('/')[0]; tops[t] = (tops[t] || 0) + 1; });
    const head = `<section class="card uc-brainhead"><div class="row spread"><div class="uc-sh"><span class="uc-num">∞</span><div><h2>Brain</h2><div class="muted tiny">${all.length.toLocaleString()} memories in ${Object.keys(tops).length} sections · ${B().vecCount().toLocaleString()} searchable by meaning · synced, encrypted</div></div></div>
        <div class="row"><button class="btn small" data-new="note">${App.fx.icon('plus')} Note</button><button class="btn small" data-new="meeting">Meeting</button><button class="btn small" data-new="person">Person</button></div></div>
      <div class="seg uc-btabs" style="margin-top:12px">${[['ask', 'Ask'], ['sections', 'Sections'], ['graph', 'Graph'], ['yoy', 'Compare'], ['setup', 'Setup']].map(([k, l]) => `<button data-btab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div></section><div id="bBody"></div>`;
    view.innerHTML = head;
    view.querySelectorAll('[data-btab]').forEach(b => b.onclick = () => { tab = b.dataset.btab; UC.go('brain', { keepScroll: true }); });
    view.querySelectorAll('[data-new]').forEach(b => b.onclick = () => newNote(b.dataset.new));
    const body = view.querySelector('#bBody');
    await ({ ask, sections, graph, yoy, setup })[tab](body, all, tops);
    App.fx.hydrateIcons(view);
  };

  /* Ask */
  async function ask(el, all) {
    const ai = await UC.ai.status();
    el.innerHTML = `<section class="card"><form id="bAsk" class="uc-askbar"><input id="bQ" placeholder="Ask anything: “How did Lakeside do last November vs. this November?” or “What did I decide about overtime?”" value="${esc(q)}" autocomplete="off"><button class="btn primary">${App.fx.icon('sparkles')} ${ai.running ? 'Ask' : 'Search'}</button></form>
      <div class="muted tiny" style="margin-top:6px">${ai.running ? 'Answers come from your memories and year-over-year numbers, with sources.' : esc(ai.error || '') + ' Search still works here.'}</div></section>
      <div id="bAns">${lastAsk ? answerHtml(lastAsk) : recentHtml(all)}</div>`;
    const f = el.querySelector('#bAsk');
    f.onsubmit = async e => {
      e.preventDefault(); q = el.querySelector('#bQ').value.trim(); if (!q) return;
      const box = el.querySelector('#bAns'); box.innerHTML = '<div class="card"><span class="task-spin"></span> Remembering…</div>';
      try { lastAsk = { q, ...(await B().ask(q)) }; } catch (err) { lastAsk = { q, hits: await B().search(q, { semantic: false }), error: err.message }; }
      box.innerHTML = answerHtml(lastAsk); App.fx.hydrateIcons(box);
    };
  }
  function answerHtml(r) {
    return `${r.answer ? `<section class="card"><div class="uc-sub">Answer${r.model ? ` · ${esc(r.model)}` : ''}</div><div class="uc-md small">${render(r.answer).replace(/\[(\d+)\]/g, (m, i) => r.hits[i - 1] ? `<a class="uc-cite" data-note="${esc(r.hits[i - 1].n.id)}">[${i}]</a>` : m)}</div></section>` : ''}
      ${r.error ? `<div class="uc-demo small">${esc(r.error)}</div>` : ''}
      ${r.yoy && !r.answer ? `<section class="card"><div class="uc-sub">Year over year</div><div class="uc-md small">${UC.fullMd(r.yoy.replace(/^## .*\n/, ''))}</div></section>` : ''}
      <section class="card"><div class="uc-sub">Memories ${r.hits.length ? `(${r.hits.length})` : ''}</div><div class="uc-alist">${r.hits.map((h, i) => rowHtml(h.n, ` · [${i + 1}] ${h.why}`)).join('') || '<div class="uc-empty">Nothing matched. Try other words.</div>'}</div></section>`;
  }
  const recentHtml = all => `<section class="card"><div class="uc-sub">Recently remembered</div><div class="uc-alist">${all.filter(n => n.type !== 'log').sort((a, b) => b.updated - a.updated).slice(0, 12).map(n => rowHtml(n)).join('') || '<div class="uc-empty">Nothing yet. Import exports, run agents or write a note.</div>'}</div></section>`;

  /* Sections (folder tree like the vault) */
  async function sections(el, all, tops) {
    const tree = {}; all.forEach(n => { const parts = n.section.split('/'); for (let i = 1; i <= parts.length; i++) { const k = parts.slice(0, i).join('/'); tree[k] = (tree[k] || 0) + 1; } });
    const keys = Object.keys(tree).sort();
    const visible = keys.filter(k => { const d = k.split('/').length; if (d === 1) return true; const parent = k.split('/').slice(0, -1).join('/'); return secOpen === parent || secOpen.startsWith(k.split('/').slice(0, -1).join('/') + '/') || secOpen.startsWith(k + '/') || secOpen === k; });
    const list = all.filter(n => (!secOpen || n.section === secOpen || n.section.startsWith(secOpen + '/')) && (!typeF || n.type === typeF) && (!q || (n.title + ' ' + n.body).toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updated - a.updated);
    const types = [...new Set(all.map(n => n.type))];
    el.innerHTML = `<div class="uc-brain2"><section class="card uc-tree"><div class="uc-sub">Sections</div>
        <button class="uc-tnode ${!secOpen ? 'on' : ''}" data-sec="">All memories <span>${all.length}</span></button>
        ${visible.map(k => { const d = k.split('/').length - 1; return `<button class="uc-tnode ${secOpen === k ? 'on' : ''}" data-sec="${esc(k)}" style="padding-left:${10 + d * 14}px;--dc:${UC.sectionColor(k)}"><i></i>${esc(k.split('/').pop())} <span>${tree[k]}</span></button>`; }).join('')}</section>
      <section class="card"><div class="uc-filters" style="margin-top:0"><input id="sQ" placeholder="Filter by words…" value="${esc(q)}" aria-label="Filter"><select id="sT" data-native aria-label="Type"><option value="">All types</option>${types.map(t => `<option value="${t}" ${typeF === t ? 'selected' : ''}>${typeLabel(t)}</option>`).join('')}</select></div>
        <div class="muted tiny" style="margin:8px 0">${list.length.toLocaleString()} in ${esc(secOpen || 'all sections')}</div>
        <div class="uc-alist">${list.slice(0, 200).map(n => rowHtml(n)).join('') || '<div class="uc-empty">Nothing here yet.</div>'}</div>${list.length > 200 ? '<div class="muted tiny">Showing the newest 200. Narrow it with a section or words.</div>' : ''}</section></div>`;
    el.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { secOpen = b.dataset.sec; UC.go('brain', { keepScroll: true }); });
    const qi = el.querySelector('#sQ'); qi.oninput = () => { q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => UC.go('brain', { keepScroll: true }).then(() => { const n = document.getElementById('sQ'); n?.focus(); n?.setSelectionRange(n.value.length, n.value.length); }), 300); };
    el.querySelector('#sT').onchange = e => { typeF = e.target.value; UC.go('brain', { keepScroll: true }); };
  }

  /* Graph: force layout on a canvas (pan, zoom, drag, tap to open) */
  let gHideLogs = true;
  async function graph(el, all) {
    let ns = all.filter(n => !(gHideLogs && (n.type === 'log' || n.type === 'month' || n.type === 'personal' || n.type === 'purchases')));
    const deg = new Map(); ns.forEach(n => n.links.forEach(l => { deg.set(n.id, (deg.get(n.id) || 0) + 1); deg.set(l, (deg.get(l) || 0) + 1); }));
    ns = ns.sort((a, b) => (deg.get(b.id) || 0) - (deg.get(a.id) || 0) || b.updated - a.updated).slice(0, 700);
    const idx = new Map(ns.map((n, i) => [n.id, i]));
    const edges = []; ns.forEach((n, i) => n.links.forEach(l => { const j = idx.get(l); if (j !== undefined && j !== i) edges.push([i, j]); }));
    el.innerHTML = `<section class="card uc-graphcard"><div class="row spread"><div class="muted tiny">${ns.length} memories · ${edges.length} links · drag to move, scroll or pinch to zoom, tap a dot to open it</div>
      <label class="row tiny"><input type="checkbox" id="gLogs" ${gHideLogs ? 'checked' : ''}> Hide daily logs, monthly reports and ledgers</label></div>
      <canvas id="gC" class="uc-graph"></canvas><div class="uc-legend tiny">${[...new Set(ns.map(n => n.section.split('/')[0]))].map(s => `<span><i style="background:${UC.sectionColor(s)}"></i>${esc(s)}</span>`).join('')}</div></section>`;
    el.querySelector('#gLogs').onchange = e => { gHideLogs = e.target.checked; UC.go('brain', { keepScroll: true }); };
    const cv = el.querySelector('#gC'), dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    // seed by section so clusters form
    const secs = [...new Set(ns.map(n => n.section.split('/')[0]))];
    const P = ns.map((n, i) => { const a = secs.indexOf(n.section.split('/')[0]) / secs.length * Math.PI * 2; return { x: Math.cos(a) * 220 + (Math.random() - .5) * 120, y: Math.sin(a) * 220 + (Math.random() - .5) * 120, vx: 0, vy: 0, r: 2.5 + Math.min(9, Math.sqrt(deg.get(n.id) || 0) * 1.6), n }; });
    let view = { x: W / 2, y: H / 2, k: Math.min(W, H) / 900 }, alpha = 1, drag = null, hover = null, raf;
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    function step() {
      const cell = 60, grid = new Map();
      P.forEach((p, i) => { const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`; (grid.get(k) || grid.set(k, []).get(k)).push(i); });
      P.forEach((p, i) => { const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(`${cx + dx},${cy + dy}`) || []) { if (j <= i) continue; const q = P[j]; let x = p.x - q.x, y = p.y - q.y, d2 = x * x + y * y || .01; if (d2 > cell * cell) continue; const f = 140 / d2 * alpha; p.vx += x * f; p.vy += y * f; q.vx -= x * f; q.vy -= y * f; }
        p.vx -= p.x * 0.004 * alpha; p.vy -= p.y * 0.004 * alpha; });
      for (const [a, b] of edges) { const p = P[a], q = P[b], x = q.x - p.x, y = q.y - p.y, d = Math.sqrt(x * x + y * y) || 1, f = (d - 45) * 0.02 * alpha; p.vx += x / d * f; p.vy += y / d * f; q.vx -= x / d * f; q.vy -= y / d * f; }
      P.forEach(p => { if (p === drag?.p) return; p.x += p.vx; p.y += p.vy; p.vx *= .82; p.vy *= .82; });
      alpha = Math.max(0.02, alpha * 0.985);
    }
    function draw() {
      g.clearRect(0, 0, W, H); g.save(); g.translate(view.x, view.y); g.scale(view.k, view.k);
      g.strokeStyle = css('--border-strong'); g.globalAlpha = .55; g.lineWidth = 1 / view.k; g.beginPath();
      for (const [a, b] of edges) { g.moveTo(P[a].x, P[a].y); g.lineTo(P[b].x, P[b].y); } g.stroke(); g.globalAlpha = 1;
      for (const p of P) { g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fillStyle = UC.sectionColor(p.n.section); g.fill(); if (p === hover) { g.lineWidth = 2 / view.k; g.strokeStyle = css('--text'); g.stroke(); } }
      g.fillStyle = css('--text-2'); g.font = `${11 / view.k}px Inter, system-ui`; g.textAlign = 'center';
      for (const p of P) if (p === hover || (p.r > 6 && view.k > .55) || view.k > 1.6) g.fillText(p.n.title.slice(0, 32), p.x, p.y - p.r - 4 / view.k);
      g.restore();
    }
    const loop = () => { if (!cv.isConnected) return; if (alpha > 0.021 || drag) step(); draw(); raf = requestAnimationFrame(loop); };
    for (let i = 0; i < 120; i++) step();
    loop();
    const toWorld = (cx, cy) => ({ x: (cx - view.x) / view.k, y: (cy - view.y) / view.k });
    const hit = (cx, cy) => { const w = toWorld(cx, cy); let best = null, bd = 1e9; for (const p of P) { const d = (p.x - w.x) ** 2 + (p.y - w.y) ** 2; if (d < bd && d < (p.r + 6 / view.k) ** 2) { bd = d; best = p; } } return best; };
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let moved = 0, pinch = null; const touches = new Map();
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); touches.set(e.pointerId, pos(e)); const [x, y] = pos(e); moved = 0;
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k }; drag = null; return; }
      const p = hit(x, y); drag = p ? { p } : { pan: true, x, y, vx: view.x, vy: view.y }; if (p) alpha = Math.max(alpha, .3); });
    cv.addEventListener('pointermove', e => { const [x, y] = pos(e); if (touches.has(e.pointerId)) touches.set(e.pointerId, [x, y]);
      if (pinch && touches.size === 2) { const [a, b] = [...touches.values()]; view.k = Math.max(.15, Math.min(5, pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); return; }
      if (!drag) { hover = hit(x, y); cv.style.cursor = hover ? 'pointer' : 'grab'; return; }
      moved++; if (drag.p) { const w = toWorld(x, y); drag.p.x = w.x; drag.p.y = w.y; } else { view.x = drag.vx + x - drag.x; view.y = drag.vy + y - drag.y; } });
    const up = e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; if (drag?.p && moved < 4) UC.openNote(drag.p.n.id); drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = pos(e), w = toWorld(x, y); view.k = Math.max(.15, Math.min(5, view.k * (e.deltaY < 0 ? 1.12 : 0.89))); view.x = x - w.x * view.k; view.y = y - w.y * view.k; }, { passive: false });
  }

  /* Year over year (permanent daily facts) */
  async function yoy(el) {
    const facts = await B().facts();
    if (!facts.length) { el.innerHTML = `<section class="card empty"><h2>No history yet</h2><p class="small">Year over year uses your real daily numbers (demo units don’t count). Import CrunchTime, Harri or POS exports in <a data-go="imports">Imports</a>. Every day you import is kept here for good, even if you delete the file later. Import last year’s exports too and the comparisons light up right away.</p></section>`; return; }
    const units = [...new Map(facts.map(f => [f.unit, f.unitName])).entries()];
    const ids = yoyUnit ? [yoyUnit] : null;
    const end = facts.filter(f => !ids || ids.includes(f.unit)).reduce((m, f) => f.date > m ? f.date : m, '');
    const rows = B().compare(facts, ids, end);
    const ch = (a, b) => b ? `<span class="${a >= b ? 'up' : 'down'}">${a >= b ? '+' : ''}${((a - b) / b * 100).toFixed(1)}%</span>` : '<span class="muted">—</span>';
    const pct = v => isNaN(v) ? '—' : (v * 100).toFixed(1) + '%';
    const mon = B().monthly(facts, ids), years = [...new Set(Object.keys(mon).map(k => k.slice(0, 4)))].sort();
    el.innerHTML = `<section class="card"><div class="row spread"><div class="uc-sh"><h2>Year over year</h2><span class="muted tiny">through ${esc(B().fmtDay(end))} · ${facts.length.toLocaleString()} days on file, kept permanently</span></div>
        <select id="yU" data-native aria-label="Unit"><option value="">All units</option>${units.map(([id, n]) => `<option value="${id}" ${yoyUnit === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div class="uc-tablewrap"><table class="uc-table"><thead><tr><th>Period</th><th class="n">Sales</th><th class="n">Last year</th><th class="n">Change</th><th class="n">Labor %</th><th class="n">LY labor %</th><th class="n">SPLH</th><th class="n">LY SPLH</th><th class="n">Guests</th><th class="n">LY guests</th></tr></thead><tbody>
      ${rows.map(r => { const L = r.lfl, part = L.days && r.coverage < 0.95; return `<tr><td>${r.label}<div class="muted tiny">${r.a.slice(5)} → ${r.b.slice(5)} vs ${r.la.slice(0, 4)}${part ? ` · last year has ${L.days} of these ${r.ty.days} days` : ''}</div></td><td class="n">${money(r.ty.sales)}</td><td class="n">${L.days ? money(part ? L.ly.sales : r.ly.sales) : '—'}${part ? '<div class="muted tiny">same days</div>' : ''}</td><td class="n">${L.days ? ch(L.ty.sales, L.ly.sales) : '—'}</td><td class="n">${pct(r.ty.laborPct)}</td><td class="n">${pct(L.ly.laborPct)}</td><td class="n">${isNaN(r.ty.splh) ? '—' : '$' + r.ty.splh.toFixed(0)}</td><td class="n">${isNaN(L.ly.splh) ? '—' : '$' + L.ly.splh.toFixed(0)}</td><td class="n">${r.ty.guests || '—'}</td><td class="n">${L.ly.guests || '—'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="muted tiny">Change compares the same days in both years, so a partial year on file never inflates it. Day and week periods line up by weekday (364 days back).</p>
      <div class="uc-chart"><canvas id="yC"></canvas></div>
      ${years.length < 2 ? '<p class="muted small">Only one year on file so far. Import last year’s exports to see the comparison lines.</p>' : ''}</section>`;
    el.querySelector('#yU').onchange = e => { yoyUnit = e.target.value; UC.go('brain', { keepScroll: true }); };
    if (window.Chart) {
      const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), C = ['#94a3b8', '#06b6d4', '#a855f7', '#f59e0b'];
      new Chart(el.querySelector('#yC'), { type: 'line', data: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: years.slice(-4).map((y, i, arr) => ({ label: `${y} · average sales per day`, data: Array.from({ length: 12 }, (_, m) => { const x = mon[`${y}-${String(m + 1).padStart(2, '0')}`]; return x?.days ? Math.round(x.sales / x.days) : null; }), borderColor: i === arr.length - 1 ? css('--accent') : C[i % C.length], borderWidth: i === arr.length - 1 ? 3 : 1.6, pointRadius: 2, spanGaps: true })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: css('--muted'), boxWidth: 10 } } }, scales: { x: { ticks: { color: css('--muted') }, grid: { display: false } }, y: { ticks: { color: css('--muted') }, grid: { color: css('--border') } } } } });
    }
  }

  /* Setup: search by meaning, Obsidian vault, capture */
  async function setup(el, all, tops) {
    const ai = await UC.ai.status(), canE = ai.running ? await B().canEmbed(true) : false, v = B().vault;
    const vi = v.kind ? await v.info().catch(() => ({ root: '' })) : { root: '' };
    const last = UC.S.get('brain.vaultLast', 0);
    el.innerHTML = `<div class="uc-grid2"><div class="uc-col">
      <section class="card"><div class="uc-sh"><h2>Obsidian vault</h2><span class="muted tiny">two-way: edit in either place</span></div>
        ${!v.kind ? '<p class="small">Vault sync runs on your computer: open Unit Command in the desktop app (or Chrome/Edge on a computer). The phone shows the same memories through your synced account.</p>'
        : `<p class="small">${vi.root ? `Connected to <b>${esc(vi.root)}</b>${last ? ` · last synced ${UC.ago(last)}` : ''}.` : 'Pick a folder: an existing Obsidian vault or an empty folder you then open in Obsidian (Open folder as vault).'}</p>
          <ul class="uc-bul small"><li>Every memory becomes a .md file in its section folder, with [[links]] so Obsidian’s graph matches this one.</li><li>Notes you write in Obsidian come back here; your lines under “My notes” are kept on every memory.</li><li>If both sides changed, both versions are kept. Deleting a file in Obsidian never deletes anything here.</li></ul>
          <div class="row"><button class="btn primary" id="vPick">${vi.root ? 'Change folder' : 'Choose vault folder'}</button>${vi.root ? '<button class="btn" id="vNow">Sync now</button><button class="btn ghost" id="vForget">Disconnect</button>' : ''}</div>
          ${vi.root ? `<label class="row small" style="margin-top:8px"><input type="checkbox" id="vAuto" ${UC.S.get('brain.vaultOn', false) ? 'checked' : ''}> Keep in sync automatically (every 5 minutes while the app is open)</label>` : ''}
          <div class="muted tiny" id="vRes"></div>`}</section>
      <section class="card"><div class="uc-sh"><h2>Search by meaning</h2><span class="muted tiny">Ollama embeddings · on this computer</span></div>
        ${App.hosted ? '<p class="small">Runs on your computer. Here on the phone, search by words works on every memory.</p>' : !ai.running ? `<p class="small">${esc(ai.error)} Set up Ollama in <a data-go="settings">Settings</a> first.</p>`
        : canE ? `<p class="small">${B().vecCount().toLocaleString()} of ${all.length.toLocaleString()} memories indexed with <b>${esc(B().embedModel())}</b>. New memories index themselves.</p><div class="row"><button class="btn" id="eIdx">Index now</button></div><div class="muted tiny" id="eRes"></div>`
        : `<p class="small">Download the small embedding model (<b>nomic-embed-text</b>, about 270 MB) so the Brain can find memories by meaning, not just matching words.</p><div class="row"><button class="btn primary" id="ePull">${App.fx.icon('download')} Download embedding model</button></div><div id="eRes" class="muted tiny"></div>`}</section></div>
      <div class="uc-col"><section class="card"><div class="uc-sh"><h2>What the Brain holds</h2></div>
        <div class="uc-tiles" style="margin-top:10px">${Object.entries(tops).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<div class="uc-tile" style="border-left:3px solid ${UC.sectionColor(s)}"><div class="l">${esc(s)}</div><div class="v">${n.toLocaleString()}</div></div>`).join('')}</div>
        <p class="muted small">It captures on its own: unit numbers (every day, kept for good), monthly reports with last year beside them, every import, purchases and vendors, every agent result and your decisions, ventures, knowledge, research notes, and personal spending, giving and pay. Notes, meetings and people you add are yours to edit.</p>
        <div class="row"><button class="btn" id="cNow">Rebuild from all data</button><button class="btn ghost" id="cExp">${App.fx.icon('download')} Export all (.md)</button></div></section></div></div>`;
    el.querySelector('#vPick')?.addEventListener('click', async () => { try { const r = await v.connect(); if (r) { UC.S.set('brain.vaultOn', true); App.ui.toast('Vault connected. Syncing…'); await B().syncVault(res => App.ui.toast(`Vault synced: ${res.wrote} written, ${res.created} new from Obsidian`)); } UC.go('brain', { keepScroll: true }); } catch (e) { if (e.name !== 'AbortError') App.ui.toast(e.message); } });
    el.querySelector('#vNow')?.addEventListener('click', async e => { e.target.disabled = true; e.target.innerHTML = '<span class="task-spin"></span> Syncing…'; try { const r = await B().syncVault(); el.querySelector('#vRes').textContent = r ? `${r.wrote} files written, ${r.read} read, ${r.created} new notes from Obsidian, ${r.conflicts} kept as both versions.` : 'Vault not available. Reconnect the folder.'; } catch (err) { App.ui.toast(err.message); } e.target.disabled = false; e.target.textContent = 'Sync now'; });
    el.querySelector('#vForget')?.addEventListener('click', async () => { if (!confirm('Disconnect the vault folder? Files already there stay; nothing is deleted.')) return; await v.forget(); UC.S.set('brain.vaultOn', false); UC.go('brain', { keepScroll: true }); });
    el.querySelector('#vAuto')?.addEventListener('change', e => UC.S.set('brain.vaultOn', e.target.checked));
    el.querySelector('#ePull')?.addEventListener('click', async e => { e.target.disabled = true; const r = el.querySelector('#eRes'); try { await App.ai.ollamaPull(B().embedModel(), p => { r.textContent = `${p.status || 'Downloading'} ${isNaN(p.pct) ? '' : Math.round(p.pct * 100) + '%'}`; }); await B().canEmbed(true); r.textContent = 'Ready. Indexing…'; await B().indexVectors((d, t) => { r.textContent = `Indexed ${d} of ${t}`; }); UC.go('brain', { keepScroll: true }); } catch (err) { r.textContent = 'Download failed: ' + err.message; e.target.disabled = false; } });
    el.querySelector('#eIdx')?.addEventListener('click', async e => { e.target.disabled = true; const r = el.querySelector('#eRes'); try { const n = await B().indexVectors((d, t) => { r.textContent = `Indexed ${d} of ${t}`; }); r.textContent = n ? `Indexed ${n} memories.` : 'Everything is already indexed.'; } catch (err) { r.textContent = err.message; } e.target.disabled = false; });
    el.querySelector('#cNow').onclick = async e => { e.target.disabled = true; e.target.innerHTML = '<span class="task-spin"></span> Rebuilding…'; await B().load(true); await B().capture(); UC.go('brain', { keepScroll: true }); };
    el.querySelector('#cExp').onclick = () => App.download(`${UC.BRAND.name.replace(/\s+/g, '-')}-brain-${App.dateKey(new Date())}.md`, [...B().notes().values()].sort((a, b) => a.section.localeCompare(b.section)).map(n => `<!-- ${n.section}/${n.title}.md -->\n# ${n.title}\n\n${n.body}\n\n## My notes\n${n.mine || ''}`).join('\n\n---\n\n'), 'text/markdown');
  }
})(window.UC);
