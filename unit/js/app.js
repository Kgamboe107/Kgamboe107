/* Unit Command app shell: navigation, routing, and the Today and Units screens.
   (Ventures, Agent Map, Agents, Imports and Settings are in screens.js.) */
(function (UC) {
  const { $, $$, esc } = App;
  const E = () => UC.engine;
  const money = v => App.fmt.money(v);
  const ROUTES = [
    ['today', 'Today', 'dashboard'], ['units', 'Units', 'businesses'], ['ventures', 'Ventures', 'sparkles'],
    ['map', 'Agent Map', 'command'], ['agents', 'Agents', 'layers'], ['imports', 'Imports', 'upload'], ['settings', 'Settings', 'settings']
  ];
  const TABS = ['today', 'units', 'map', 'agents', 'more'];
  UC.screens = UC.screens || {};
  let current = 'today', token = 0;

  UC.enabledAgent = a => { const p = UC.plan(); if (p !== 'lite') return true; return a.lite && UC.PLANS.lite.depts.includes(a.dept); };
  UC.enabledDept = d => UC.plan() !== 'lite' || UC.PLANS.lite.depts.includes(d.id);

  async function go(route, params = {}) {
    if (!UC.screens[route]) route = 'today';
    if (UC.plan() === 'lite' && route === 'ventures') route = 'today';
    current = route;
    $$('#ucNav [data-go]').forEach(a => a.classList.toggle('on', a.dataset.go === route));
    $$('#ucTabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === route || (b.dataset.tab === 'more' && ['ventures', 'imports', 'settings'].includes(route))));
    $('#ucTitle').textContent = ROUTES.find(r => r[0] === route)[1];
    if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
    const view = $('#ucView'); view.innerHTML = ''; view.classList.remove('uc-enter'); void view.offsetWidth; view.classList.add('uc-enter');
    const t = ++token;
    try { await UC.screens[route](view, params); App.fx.hydrateIcons(view); }
    catch (e) { if (t !== token) return; console.error(e); view.innerHTML = `<div class="card empty">Something went wrong on this screen: ${esc(e.message)}</div>`; }
    if (!params.keepScroll) window.scrollTo({ top: 0 });
    badge();
  }
  App.go = (r, p) => go(UC.screens[r] ? r : 'today', p); // shared helpers (theme, sign-in) call App.go
  App.currentRoute = () => current;
  UC.go = go;
  UC.current = () => current;

  function badge() {
    const n = E().state().asks.filter(a => a.status === 'pending').length;
    $$('[data-badge-asks]').forEach(el => { el.hidden = !n; el.textContent = n; });
  }
  UC.badge = badge;

  /* Shared bits */
  UC.demoBar = d => d.demo ? `<div class="uc-demo small"><b>Demo units.</b> You're seeing four made-up units so you can try everything. Bring in your own CrunchTime, Harri or POS exports in <a data-go="imports">Imports</a>, or turn demo units off in <a data-go="settings">Settings</a>.</div>` : '';
  UC.tile = (label, value, sub = '', tone = '', go = '') => `<div class="uc-tile ${tone}" ${go ? `data-go="${go}" role="button" tabindex="0"` : ''}><div class="l">${esc(label)}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  UC.ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; };
  UC.clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  UC.logItem = e => {
    const a = UC.agent(e.agent), d = UC.dept(e.dept);
    return `<li class="k-${e.kind}" style="--dc:${d?.color || 'var(--muted)'}"><time>${UC.clock(e.t)}</time><div><div><b class="uc-agentname" data-agent="${esc(e.agent)}">${esc(a?.key || '')}</b> ${esc(e.text)}</div>
      <div class="muted tiny">${esc(d?.name || '')}${e.kind === 'flag' ? ' · <span class="uc-flag">flagged</span>' : e.kind === 'waiting' ? ' · <span class="uc-wait">waiting for you</span>' : ''}${e.sample ? ' · sample' : ''}${e.demo ? ' · demo data' : ''}</div></div></li>`;
  };

  /* Needs your yes (shared by Today) */
  const LANES = { you: ['You', 'approve from your phone'], team: ['Your team', 'tagged when it’s theirs'], clients: ['Clients', 'only after you say yes'] };
  let lane = 'you', laneChosen = false;
  function asksHtml(st) {
    const pend = st.asks.filter(a => a.status === 'pending');
    const n = k => pend.filter(a => (a.lane || 'you') === k).length;
    if (!n(lane) && pend.length && !laneChosen) lane = Object.keys(LANES).find(k => n(k)) || lane;
    const list = pend.filter(a => (a.lane || 'you') === lane).sort((a, b) => a.created - b.created);
    return `<div class="uc-lanes seg">${Object.entries(LANES).map(([k, [l]]) => `<button data-lane="${k}" class="${lane === k ? 'on' : ''}">${l}${n(k) ? ` <span class="uc-n">${n(k)}</span>` : ''}</button>`).join('')}</div>
      <div class="muted tiny" style="margin:6px 0 10px">${LANES[lane][1]}</div>
      ${list.map(a => { const ag = UC.agent(a.agent), d = UC.dept(a.dept); return `<article class="uc-ask" style="--dc:${d?.color}">
        <div class="row spread tiny muted"><span>${esc(d?.short || '')} · ${esc(ag?.name || '')}${a.to ? ' → ' + esc(a.to) : ''}</span><span>${UC.ago(a.created)}</span></div>
        <b>${esc(a.title)}</b>${a.detail ? `<div class="uc-ask-d small">${esc(a.detail).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="row uc-ask-act"><button class="btn primary small" data-yes="${a.id}">${App.fx.icon('check')} Yes</button><button class="btn small" data-edit="${a.id}">Edit first</button><button class="btn small ghost" data-no="${a.id}">No</button></div></article>`; }).join('')
        || `<div class="uc-empty">Nothing waiting here.${lane === 'clients' ? ' Client-facing drafts land here only after you approve them for sending.' : ''}</div>`}`;
  }
  function bindAsks(root, rerender) {
    root.querySelectorAll('[data-lane]').forEach(b => b.onclick = () => { lane = b.dataset.lane; laneChosen = true; rerender(); });
    root.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => { E().decide(b.dataset.yes, 'approved'); App.ui.toast('Approved'); rerender(); });
    root.querySelectorAll('[data-no]').forEach(b => b.onclick = () => { E().decide(b.dataset.no, 'rejected'); App.ui.toast('Declined. Nothing was sent.'); rerender(); });
    root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const a = E().state().asks.find(x => x.id === b.dataset.edit);
      App.ui.modal(`<div class="row spread"><h2>Edit before it goes</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div><p class="muted small">${esc(a.title)}</p>
        <label class="field">Draft<textarea id="ucEd" rows="8">${esc(a.detail || '')}</textarea></label>
        <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ucEdGo">Approve with my edits</button></div>`, (c, close) => {
        c.querySelector('#ucEdGo').onclick = () => { E().decide(a.id, 'approved', c.querySelector('#ucEd').value); close(); App.ui.toast('Approved with your edits'); rerender(); };
      });
    });
  }

  /* ---------- Today ---------- */
  let logKind = 'all';
  UC.screens.today = async (view) => {
    await E().morningRun();
    const ctx = await E().context();
    const st = E().state(), m = st.morning;
    const end = ctx.end;
    const wk = UC.data.stats(ctx.units.flatMap(u => UC.data.wtd(u, end)));
    const today = App.dateKey(new Date());
    const todays = st.log.filter(e => e.date === today);
    const flags = todays.filter(e => e.kind === 'flag');
    const vs = E().ventures();
    const live = UC.AGENTS.filter(a => a.rule && UC.enabledAgent(a)).length, total = UC.AGENTS.filter(UC.enabledAgent).length;
    const T = UC.targets();
    const lp = wk.laborPct * 100;
    const pend = st.asks.filter(a => a.status === 'pending').length;
    const greet = (h => h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')(new Date().getHours());
    view.innerHTML = `${UC.demoBar(ctx)}
      <section class="uc-morning card">
        <div class="row spread"><div><div class="uc-eyebrow">Morning page · ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h2 class="uc-h1">${greet}. ${m ? esc(m.headline) : 'Run the morning agents to build today’s page.'}</h2></div>
          <button class="btn" id="ucRerun">${App.fx.icon('sparkles')} Run morning agents</button></div>
        ${m ? `<div class="uc-mnums">${m.numbers.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="uc-mcols"><div><div class="uc-sub">Needs a look</div>${m.flags.length ? `<ul class="uc-bul">${m.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<div class="muted small">Nothing flagged. Every live agent came back clean.</div>'}</div>
          <div><div class="uc-sub">Ventures, next step</div>${m.ventures.length ? `<ul class="uc-bul">${m.ventures.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<div class="muted small">No ventures in progress.</div>'}</div></div>
        <div class="muted tiny">Built ${UC.ago(m.at)} from data through ${E().fmtDay(m.end)}${m.demo ? ' (demo units)' : ''}.</div>` : ''}
      </section>
      <div class="uc-grid2">
        <div class="uc-col">
          <section class="card"><div class="uc-sh"><span class="uc-num">02</span><h2>Scoreboard</h2></div>
            <div class="uc-tiles">
              ${UC.tile('Sales, week to date', money(wk.sales), wk.forecast ? `${E().signPct(wk.vsFc)} vs forecast` : '', wk.vsFc < 0 ? 'warn' : 'good', 'units')}
              ${UC.tile('Labor %, week to date', E().pct(wk.laborPct), `target ${T.laborPct}%`, lp > T.laborPct ? 'bad' : 'good', 'units')}
              ${UC.tile('Units reporting', ctx.units.length, ctx.demo ? 'demo units' : 'with sales data', '', 'units')}
              ${UC.tile('Waiting on you', pend, pend ? 'see Needs your yes' : 'all clear', pend ? 'warn' : 'good')}
              ${UC.tile('Agent runs today', todays.length, `${flags.length} flagged`, flags.length ? 'warn' : '', 'agents')}
              ${UC.plan() === 'lite' ? '' : UC.tile('Ventures in progress', vs.filter(v => v.stage !== 'operating').length, vs.length ? `${vs.filter(v => v.stage === 'build' || v.stage === 'open').length} in build-out or opening` : 'add one in Ventures', '', 'ventures')}
              ${UC.tile('Agents live', `${live}/${total}`, 'the rest are designed and waiting for AI', '', 'agents')}
            </div></section>
          <section class="card"><div class="row spread"><div class="uc-sh"><span class="uc-num">04</span><h2>Agent log</h2><span class="muted tiny">today</span></div>
            <div class="seg">${[['all', 'All'], ['flag', 'Flags'], ['waiting', 'Waiting']].map(([k, l]) => `<button data-lk="${k}" class="${logKind === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
            <ol class="uc-log">${todays.filter(e => logKind === 'all' || e.kind === logKind).sort((a, b) => b.t - a.t).slice(0, 40).map(UC.logItem).join('') || '<li class="uc-empty">Nothing logged today yet.</li>'}</ol></section>
        </div>
        <div class="uc-col"><section class="card uc-yes" id="ucYes"><div class="uc-sh"><span class="uc-num">03</span><div><h2>Needs your yes</h2><div class="muted tiny">nothing leaves without a human sign-off</div></div></div>${asksHtml(st)}</section></div>
      </div>`;
    const rerender = () => go('today', { keepScroll: true });
    bindAsks(view, rerender);
    view.querySelector('#ucRerun').onclick = async () => { await E().morningRun(true); App.ui.toast('Morning agents ran'); rerender(); };
    view.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => { logKind = b.dataset.lk; rerender(); });
  };

  /* ---------- Units (multi-unit roll-up) ---------- */
  let win = 'wtd', sortBy = 'sales', unitOpen = null;
  const WINDOWS = { day: ['Latest day', 1], wtd: ['Week to date', 0], d7: ['Last 7 days', 7], d28: ['Last 4 weeks', 28] };
  UC.screens.units = async (view, params = {}) => {
    const ctx = await E().context();
    if (params.unit) unitOpen = params.unit;
    const T = UC.targets(), end = ctx.end;
    if (!ctx.units.length) {
      view.innerHTML = `<div class="card empty"><h2>No unit data yet</h2><p>Import a CrunchTime daily sales &amp; labor export, a Harri timesheet or a POS sales export for each unit.</p><button class="btn primary" data-go="imports">Go to Imports</button></div>`;
      return;
    }
    const rowsOf = u => win === 'wtd' ? UC.data.wtd(u, end) : UC.data.windowRows(u, end, WINDOWS[win][1]);
    const list = ctx.units.map(u => ({ u, s: UC.data.stats(rowsOf(u)), p: UC.data.stats(UC.data.prior(u, end, 7)), w: UC.data.stats(UC.data.windowRows(u, end, 7)) }));
    const key = { sales: x => -x.s.sales, vsFc: x => x.s.vsFc, labor: x => -x.s.laborPct, splh: x => x.s.splh, ot: x => -x.s.ot, name: x => x.u.name };
    list.sort((a, b) => { const f = key[sortBy] || key.sales, A = f(a), B = f(b); return typeof A === 'string' ? A.localeCompare(B) : (A || 0) - (B || 0); });
    const tot = UC.data.stats(ctx.units.flatMap(rowsOf));
    const tone = (v, t, hi) => isNaN(v) ? '' : (hi ? v > t : v < t) ? 'bad' : 'good';
    const th = (k, l, n) => `<th class="${n ? 'n' : ''}"><button data-sort="${k}" class="${sortBy === k ? 'on' : ''}">${l}</button></th>`;
    const cells = (s, u) => `<td class="n">${money(s.sales)}</td><td class="n ${s.forecast ? tone(s.vsFc, -T.forecastMiss / 100) : ''}">${s.forecast ? E().signPct(s.vsFc) : '—'}</td>
      <td class="n ${tone(s.laborPct * 100, T.laborPct, true)}">${E().pct(s.laborPct)}</td><td class="n ${tone(s.splh, T.splh)}">${isNaN(s.splh) ? '—' : '$' + s.splh.toFixed(0)}</td>
      <td class="n ${s.ot > T.otHours ? 'bad' : ''}">${s.ot.toFixed(1)}</td><td class="n ${s.sched ? tone(s.schedVar * 100, T.schedVar, true) : ''}">${s.sched ? E().signPct(s.schedVar) : '—'}</td>
      <td class="n ${u?.avt ? tone(u.avt.gapPts, T.avtGap, true) : ''}">${u?.avt ? '+' + u.avt.gapPts.toFixed(1) + ' pts' : '—'}</td>`;
    view.innerHTML = `${UC.demoBar(ctx)}
      <section class="card"><div class="row spread"><div class="uc-sh"><span class="uc-num">∑</span><div><h2>All units</h2><div class="muted tiny">through ${E().fmtDay(end)} · tap a unit for its days</div></div></div>
        <div class="seg">${Object.entries(WINDOWS).map(([k, [l]]) => `<button data-win="${k}" class="${win === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="uc-tiles" style="margin:12px 0">${UC.tile('Sales', money(tot.sales), tot.forecast ? `${E().signPct(tot.vsFc)} vs forecast` : '')}${UC.tile('Labor %', E().pct(tot.laborPct), `target ${T.laborPct}%`, tot.laborPct * 100 > T.laborPct ? 'bad' : 'good')}${UC.tile('Sales / labor hour', isNaN(tot.splh) ? '—' : '$' + tot.splh.toFixed(0), `target $${T.splh}`)}${UC.tile('Overtime', tot.ot.toFixed(1) + ' h', '')}</div>
        <div class="uc-tablewrap"><table class="uc-table"><thead><tr>${th('name', 'Unit')}${th('sales', 'Sales', 1)}${th('vsFc', 'vs forecast', 1)}${th('labor', 'Labor %', 1)}${th('splh', 'SPLH', 1)}${th('ot', 'OT h', 1)}<th class="n">Hours vs sched</th><th class="n">Food vs theo</th><th class="n">7-day trend</th></tr></thead>
        <tbody>${list.map(({ u, s, p, w }) => `<tr data-unit="${u.id}" class="${unitOpen === u.id ? 'on' : ''}"><td><span class="uc-dot" style="background:${u.color}"></span>${esc(u.name)}</td>${cells(s, u)}<td class="n ${p.sales && (w.sales - p.sales) / p.sales < -T.trendDrop / 100 ? 'bad' : ''}">${p.sales ? E().signPct((w.sales - p.sales) / p.sales) : '—'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>All units</td>${cells(tot)}<td></td></tr></tfoot></table></div></section>
      <div id="ucUnit"></div>`;
    view.querySelectorAll('[data-win]').forEach(b => b.onclick = () => { win = b.dataset.win; go('units', { keepScroll: true }); });
    view.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { sortBy = b.dataset.sort; go('units', { keepScroll: true }); });
    view.querySelectorAll('[data-unit]').forEach(r => r.onclick = () => { unitOpen = unitOpen === r.dataset.unit ? null : r.dataset.unit; go('units', { keepScroll: true }).then(() => unitOpen && $('#ucUnit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); });
    const u = ctx.units.find(x => x.id === unitOpen);
    if (u) unitDetail($('#ucUnit'), u, end, T);
  };
  function unitDetail(el, u, end, T) {
    const days = UC.data.windowRows(u, end, 28);
    const st = E().state();
    const flags = st.log.filter(e => e.units?.includes(u.id) && e.kind !== 'done').slice(-5).reverse();
    el.innerHTML = `<section class="card"><div class="row spread"><div class="uc-sh"><span class="uc-dot lg" style="background:${u.color}"></span><div><h2>${esc(u.name)}</h2><div class="muted tiny">last 4 weeks</div></div></div><button class="btn small ghost" id="ucUClose">Close</button></div>
      <div class="uc-chart"><canvas id="ucUChart"></canvas></div>
      ${flags.length ? `<div class="uc-sub">Recent flags</div><ul class="uc-bul small">${flags.map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>` : ''}
      <div class="uc-tablewrap"><table class="uc-table sm"><thead><tr><th>Day</th><th class="n">Sales</th><th class="n">Forecast</th><th class="n">Labor %</th><th class="n">Hours</th><th class="n">Sched</th><th class="n">OT</th><th class="n">SPLH</th></tr></thead>
      <tbody>${days.slice().reverse().map(r => { const lp = r.sales ? r.labor / r.sales * 100 : NaN; return `<tr><td>${E().fmtDay(r.date)}</td><td class="n">${money(r.sales)}</td><td class="n">${r.forecast ? money(r.forecast) : '—'}</td><td class="n ${lp > T.laborPct ? 'bad' : ''}">${isNaN(lp) ? '—' : lp.toFixed(1) + '%'}</td><td class="n">${r.hours ?? '—'}</td><td class="n">${r.sched ?? '—'}</td><td class="n ${r.ot ? 'bad' : ''}">${r.ot || 0}</td><td class="n">${r.hours ? '$' + (r.sales / r.hours).toFixed(0) : '—'}</td></tr>`; }).join('')}</tbody></table></div></section>`;
    el.querySelector('#ucUClose').onclick = () => { unitOpen = null; el.innerHTML = ''; $$('[data-unit]').forEach(r => r.classList.remove('on')); };
    if (window.Chart) {
      const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      new Chart(el.querySelector('#ucUChart'), {
        data: { labels: days.map(r => new Date(r.date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' })), datasets: [
          { type: 'bar', label: 'Sales', data: days.map(r => r.sales), backgroundColor: u.color + 'cc', borderRadius: 4, yAxisID: 'y' },
          { type: 'line', label: 'Forecast', data: days.map(r => r.forecast || null), borderColor: css('--muted'), borderDash: [4, 4], pointRadius: 0, yAxisID: 'y' },
          { type: 'line', label: 'Labor %', data: days.map(r => r.sales ? +(r.labor / r.sales * 100).toFixed(1) : null), borderColor: css('--warn'), pointRadius: 2, yAxisID: 'y2' }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: css('--muted'), boxWidth: 10 } } },
          scales: { x: { ticks: { color: css('--muted'), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } }, y: { ticks: { color: css('--muted') }, grid: { color: css('--border') } }, y2: { position: 'right', ticks: { color: css('--muted'), callback: v => v + '%' }, grid: { display: false } } } }
      });
    }
  }

  /* ---------- shell ---------- */
  function shell() {
    document.title = UC.BRAND.name;
    $('#ucBrand').textContent = UC.BRAND.name; $('#ucMark').textContent = UC.BRAND.mark; $('#ucTag').textContent = UC.BRAND.tagline;
    $('#ucNav').innerHTML = ROUTES.map(([r, l, ic]) => `<a data-go="${r}" href="#${r}" ${UC.plan() === 'lite' && r === 'ventures' ? 'hidden' : ''}><span class="ico">${App.fx.icon(ic)}</span><span>${l}</span>${r === 'today' ? '<span class="uc-pill" data-badge-asks hidden></span>' : ''}</a>`).join('')
      + `<a href="index.html" class="uc-back"><span class="ico">${App.fx.icon('arrow')}</span><span>Ops Command Desk</span></a>`;
    $('#ucTabs').innerHTML = TABS.map(t => t === 'more' ? `<button data-tab="more">${App.fx.icon('menu')}<span>More</span></button>`
      : `<button data-tab="${t}">${App.fx.icon(ROUTES.find(r => r[0] === t)[2])}<span>${ROUTES.find(r => r[0] === t)[1].replace('Agent ', '')}</span>${t === 'today' ? '<i class="uc-tbadge" data-badge-asks hidden></i>' : ''}</button>`).join('');
    $('#ucPlan').textContent = UC.PLANS[UC.plan()].label;
    App.fx.hydrateIcons(document);
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); $('#ucSide').classList.remove('open'); go(a.dataset.go); return; }
      const ag = e.target.closest('[data-agent]'); if (ag && UC.agentDrawer) { e.preventDefault(); UC.agentDrawer(ag.dataset.agent); }
    });
    $$('#ucTabs [data-tab]').forEach(b => b.onclick = () => b.dataset.tab === 'more' ? $('#ucSide').classList.toggle('open') : go(b.dataset.tab));
    $('#ucMenu').onclick = () => $('#ucSide').classList.toggle('open');
    $('#ucTheme').onclick = e => App.fx.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', { x: e.clientX, y: e.clientY });
    window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && r !== current) go(r); });
    App.bus.on('data-changed', () => { if (['units', 'today', 'imports'].includes(current)) go(current, { keepScroll: true }); });
  }

  function init() {
    document.documentElement.dataset.theme = App.settings.get('theme', 'dark');
    if (window.desktop) {
      document.documentElement.classList.add('desktop', window.desktop.platform);
      if (window.desktop.win && window.desktop.platform !== 'darwin') {
        $('#winCtl').hidden = false;
        $('#wcMin').onclick = () => window.desktop.win('min'); $('#wcMax').onclick = () => window.desktop.win('max'); $('#wcClose').onclick = () => window.desktop.win('close');
      }
    }
    shell();
    if (App.hosted && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) document.documentElement.classList.add('standalone');
    (App.cloud ? App.cloud.gate() : Promise.resolve())
      .then(() => go(location.hash.slice(1) || 'today'))
      .finally(() => { document.getElementById('ucSplash')?.remove(); });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})(window.UC);
