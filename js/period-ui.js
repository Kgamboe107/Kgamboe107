/* Top-bar period picker: ‹ [Week of Oct 26 – Nov 1] › with a menu for the view, the date range, recent periods,
   and the calendar settings (fiscal year start, week start). */
(function (App) {
  const { esc } = App;
  const P = () => App.period;

  function render() {
    const el = document.getElementById('periodPick');
    if (!el) return;
    const show = P().ROUTES.includes(App.currentRoute?.() || '');
    el.hidden = !show;
    if (!show) return;
    const r = P().range(), all = r.g === 'all';
    el.innerHTML = `<button class="pp-step" data-pstep="-1" ${all ? 'disabled' : ''} aria-label="Previous period" title="Previous period ([)">‹</button>
      <button class="pp-btn" id="ppBtn" aria-haspopup="dialog" aria-expanded="false" title="Change the reporting period"><span class="pp-view">${esc(P().VIEWS[r.g])}</span><span class="pp-label">${esc(all ? 'All time' : r.short)}</span></button>
      <button class="pp-step" data-pstep="1" ${all ? 'disabled' : ''} aria-label="Next period" title="Next period (])">›</button>`;
    el.querySelectorAll('[data-pstep]').forEach(b => b.onclick = () => P().step(+b.dataset.pstep));
    el.querySelector('#ppBtn').onclick = e => { e.stopPropagation(); open(); };
  }

  function close() { document.querySelector('.pp-menu')?.remove(); document.getElementById('ppBtn')?.setAttribute('aria-expanded', 'false'); }

  function open() {
    if (document.querySelector('.pp-menu')) return close();
    const st = P().state(), r = P().range(), c = P().cal(), t = P().today();
    const unit = App.biz.isMaster() ? App.biz.masterLabel() : App.biz.get(App.biz.current())?.name;
    // Recent periods for the chosen view (current one first)
    const recent = g => {
      if (g === 'all' || g === 'day') return [];
      const out = []; let anchor = t;
      for (let i = 0; i < 8; i++) { const [f, to] = P().bounds(g, anchor, st); out.push({ f, to, anchor }); const d = P().parse(f); d.setDate(d.getDate() - 1); anchor = P().iso(d); }
      return out;
    };
    const presets = [['Today', 0, 0], ['Yesterday', 1, 1], ['Last 7 days', 6, 0], ['Last 14 days', 13, 0], ['Last 30 days', 29, 0], ['Last 90 days', 89, 0]];
    const m = document.createElement('div');
    m.className = 'pp-menu glass-pop';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-label', 'Reporting period');
    const body = g => {
      if (g === 'all') return `<div class="muted small">Every date in your data. Pick another view to focus on a period and compare it with the one before.</div>`;
      if (g === 'day') {
        const [f, to] = P().bounds('day', null, st);
        return `<div class="pp-range"><label class="field">From<input type="date" id="ppFrom" value="${f}"></label><label class="field">To<input type="date" id="ppTo" value="${to}"></label></div>
          <div class="pp-presets">${presets.map(([l, a, b]) => `<button data-pre="${a}:${b}">${l}</button>`).join('')}<button data-pre="mtd">Month to date</button><button data-pre="ytd">Year to date</button></div>`;
      }
      return `<div class="pp-list">${recent(g).map(x => `<button data-anchor="${x.anchor}" class="${st.g === g && P().bounds(g, st.anchor, st)[0] === x.f ? 'on' : ''}">${esc(P().labelOf(g, x.f, x.to))}</button>`).join('')}</div>`;
    };
    let g = st.g;
    const draw = () => {
      m.innerHTML = `<div class="pp-views" role="tablist">${Object.entries(P().VIEWS).map(([k, v]) => `<button role="tab" data-g="${k}" class="${k === g ? 'on' : ''}">${v}</button>`).join('')}</div>
        <div class="pp-body">${body(g)}</div>
        <div class="pp-cal"><span class="muted tiny">Calendar for ${esc(unit || 'this unit')}</span>
          <label class="tiny">Fiscal year starts <select id="ppFy" data-native>${P().MON.map((mo, i) => `<option value="${i + 1}" ${c.fyStart === i + 1 ? 'selected' : ''}>${mo}</option>`).join('')}</select></label>
          <label class="tiny">Weeks start <select id="ppWk" data-native><option value="1" ${c.weekStart === 1 ? 'selected' : ''}>Monday</option><option value="0" ${c.weekStart === 0 ? 'selected' : ''}>Sunday</option></select></label></div>
        <div class="pp-foot"><span class="muted tiny">${r.prev ? `Compared with the ${esc(r.prev.word)}` : 'Applies to dashboards, Financials, Purchases, Operations, Trading and Marketing'}</span>${g === 'day' ? '<button class="btn small primary" id="ppApply">Apply range</button>' : ''}</div>`;
      m.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
        g = b.dataset.g;
        if (g === 'all') { P().setState({ g: 'all' }); close(); return; }
        if (g !== 'day') { P().setState({ g, anchor: P().today() }); close(); return; }
        draw();
      });
      m.querySelectorAll('[data-anchor]').forEach(b => b.onclick = () => { P().setState({ g, anchor: b.dataset.anchor }); close(); });
      m.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => {
        const v = b.dataset.pre, now = P().parse(t);
        let f, to = t;
        if (v === 'mtd') f = P().iso(new Date(now.getFullYear(), now.getMonth(), 1));
        else if (v === 'ytd') f = `${now.getFullYear()}-01-01`;
        else { const [a, z] = v.split(':').map(Number); const A = new Date(now); A.setDate(A.getDate() - a); const Z = new Date(now); Z.setDate(Z.getDate() - z); f = P().iso(A); to = P().iso(Z); }
        P().setState({ g: 'day', from: f, to }); close();
      });
      m.querySelector('#ppApply')?.addEventListener('click', () => { const f = m.querySelector('#ppFrom').value, to = m.querySelector('#ppTo').value; if (!f || !to) return; P().setState({ g: 'day', from: f, to }); close(); });
      m.querySelector('#ppFy').onchange = e => { P().setCal({ fyStart: +e.target.value }); App.bus.emit('period-changed'); draw(); };
      m.querySelector('#ppWk').onchange = e => { P().setCal({ weekStart: +e.target.value }); App.bus.emit('period-changed'); draw(); };
    };
    draw();
    document.body.appendChild(m);
    const b = document.getElementById('ppBtn').getBoundingClientRect();
    m.style.top = (b.bottom + 8) + 'px';
    m.style.left = Math.max(8, Math.min(b.left + b.width / 2 - 200, innerWidth - 408)) + 'px';
    document.getElementById('ppBtn').setAttribute('aria-expanded', 'true');
  }

  document.addEventListener('mousedown', e => { if (document.querySelector('.pp-menu') && !e.target.closest('.pp-menu, #ppBtn')) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.querySelector('.pp-menu')) { close(); return; }
    const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
    if (typing || e.ctrlKey || e.metaKey || e.altKey || !P().ROUTES.includes(App.currentRoute?.() || '')) return;
    if (e.key === '[') P().step(-1);
    if (e.key === ']') P().step(1);
  });

  App.periodUI = { render, open, close };
})(window.App);
