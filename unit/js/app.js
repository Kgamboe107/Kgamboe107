/* Unit Command app shell: navigation, routing, and the Today and Units screens.
   (Ventures, Agent Map, Agents, Imports and Settings are in screens.js.) */
(function (UC) {
  const { $, $$, esc } = App;
  const E = () => UC.engine;
  const money = v => App.fmt.money(v);
  /* SF Symbols-style line icons (24 grid, 1.7 stroke, round caps) */
  const ICO = {
    today: '<path d="M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0"/><path d="M12 5.5V8M5.2 9.2l1.6 1.6M18.8 9.2l-1.6 1.6M3.5 13.5h1.6M18.9 13.5h1.6"/><path d="M8 20.5h8"/>',
    brain: '<path d="M9.5 4.5a3 3 0 0 0-3 3v.2A3.2 3.2 0 0 0 4.5 13a3 3 0 0 0 1.2 4.3A3 3 0 0 0 9.5 20h.5V4.5z"/><path d="M14.5 4.5a3 3 0 0 1 3 3v.2a3.2 3.2 0 0 1 2 5.3 3 3 0 0 1-1.2 4.3 3 3 0 0 1-3.8 2.7H14V4.5z"/><path d="M10 9.5H8.5M14 13h1.5M10 15H8.7"/>',
    units: '<path d="M3.5 20.5h17"/><rect x="5" y="9" width="6" height="11.5" rx="1.2"/><rect x="11" y="4" width="8" height="16.5" rx="1.2"/><path d="M14 8h2M14 11h2M14 14h2M7.5 12.5h1M7.5 15.5h1"/>',
    agents: '<circle cx="12" cy="5.5" r="2.2"/><circle cx="5" cy="17.5" r="2.2"/><circle cx="19" cy="17.5" r="2.2"/><circle cx="12" cy="13" r="2.6"/><path d="M12 7.7v2.7M7 16.4l2.8-2M17 16.4l-2.8-2"/>',
    more: '<circle cx="12" cy="12" r="9"/><circle cx="7.8" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="16.2" cy="12" r=".9" fill="currentColor"/>',
    ventures: '<path d="M5 21V4M5 4.5h11l-2 3.5 2 3.5H5"/>',
    map: '<path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z"/><path d="M9 4.5v12.7M15 6.8v12.7"/>',
    knowledge: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v14H6.5a2 2 0 0 0-2 2z"/><path d="M4.5 19.5a2 2 0 0 0 2 2H19v-4"/><path d="M8.5 8h6.5M8.5 11h4.5"/>',
    imports: '<path d="M12 3.5v10M8 9.5l4 4 4-4"/><path d="M3.5 14.5l1.7 4.3a1.5 1.5 0 0 0 1.4 1h10.8a1.5 1.5 0 0 0 1.4-1l1.7-4.3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5"/><circle cx="12" cy="12" r="6.8"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/>',
    back: '<path d="M14.5 5 8 12l6.5 7"/>',
    projects: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 9.5h8M8 13h5M8 16.5h3"/><circle cx="17.5" cy="16" r="2.2" fill="currentColor" stroke="none"/>',
    growth: '<path d="M4 18.5 9.5 13l3.5 3.5L20 9.5"/><path d="M15 9.5h5v5"/>'
  };
  UC.icon = (n, cls = '') => ICO[n] ? `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>` : App.fx.icon(n, cls);
  const ROUTES = [
    ['today', 'Today', 'today'], ['projects', 'Projects', 'projects'], ['growth', 'Growth', 'growth'], ['brain', 'Brain', 'brain'], ['units', 'Units', 'units'], ['agents', 'Agents', 'agents'], ['ventures', 'Ventures', 'ventures'],
    ['map', 'Agent Map', 'map'], ['knowledge', 'Knowledge', 'knowledge'], ['imports', 'Imports', 'imports'], ['settings', 'Settings', 'settings']
  ];
  const MORE = ['growth', 'agents', 'ventures', 'map', 'knowledge', 'imports', 'settings'];
  const TABS = ['today', 'projects', 'brain', 'units', 'more'];
  UC.screens = UC.screens || {};
  let current = 'today', token = 0;

  UC.enabledAgent = a => { const p = UC.plan(); if (p !== 'lite') return true; return a.lite && UC.PLANS.lite.depts.includes(a.dept); };
  UC.enabledDept = d => UC.plan() !== 'lite' || UC.PLANS.lite.depts.includes(d.id);

  async function go(route, params = {}) {
    if (!UC.screens[route]) route = 'today';
    if (UC.plan() === 'lite' && route === 'ventures') route = 'today';
    current = route;
    $$('#ucNav [data-go]').forEach(a => a.classList.toggle('on', a.dataset.go === route));
    $$('#ucTabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === route || (b.dataset.tab === 'more' && MORE.includes(route))));
    const title = ROUTES.find(r => r[0] === route)[1];
    $('#ucTitle').textContent = title;
    if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
    const view = $('#ucView'), y = window.scrollY;
    view.innerHTML = `<header class="uc-lt"><h1>${esc(title)}</h1><p id="ucSub"></p></header><div class="uc-body" id="ucBody"></div>`;
    if (!params.keepScroll) { view.classList.remove('uc-enter'); void view.offsetWidth; view.classList.add('uc-enter'); }
    const body = view.querySelector('#ucBody');
    const t = ++token;
    try { await UC.screens[route](body, params); App.fx.hydrateIcons(view); aiChip(); }
    catch (e) { if (t !== token) return; console.error(e); body.innerHTML = `<div class="card empty">Something went wrong on this screen: ${esc(e.message)}</div>`; }
    if (!params.keepScroll) window.scrollTo({ top: 0 }); else window.scrollTo({ top: y });
    onScroll();
    badge();
  }
  App.go = (r, p) => go(UC.screens[r] ? r : 'today', p); // shared helpers (theme, sign-in) call App.go
  App.currentRoute = () => current;
  UC.go = go;
  UC.current = () => current;

  /* Large title collapses into the glass bar as you scroll */
  function onScroll() { const top = document.querySelector('.uc-top'); if (top) top.classList.toggle('scrolled', window.scrollY > 30); }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Appearance: dark glass (default), light, or follow the device */
  const appearance = () => App.settings.get('uc.appearance', 'dark');
  function applyAppearance() {
    const a = appearance(), t = a === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : a;
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F2F2F7' : '#000000');
  }
  UC.appearance = appearance;
  UC.setAppearance = a => { App.settings.set('uc.appearance', a); applyAppearance(); go(current, { keepScroll: true }); };
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (appearance() === 'auto') applyAppearance(); });

  /* "More" (phone): a sheet with the rest of the app, Settings-style */
  function moreSheet() {
    App.ui.modal(`<div class="row spread"><h2>More</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="uc-alist uc-menu-list">${MORE.filter(r => !(UC.plan() === 'lite' && r === 'ventures')).map(r => { const [, l, ic] = ROUTES.find(x => x[0] === r); return `<button class="uc-arow" data-go="${r}"><span class="ico">${UC.icon(ic)}</span><span><b>${l}</b></span></button>`; }).join('')}</div>
      <div class="uc-alist uc-menu-list"><a class="uc-arow" href="index.html" style="text-decoration:none"><span class="ico">${UC.icon('back')}</span><span><b>Ops Command Desk</b></span></a></div>`, (c, close) => {
      c.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => close()));
    });
  }

  function badge() {
    const n = E().state().asks.filter(a => a.status === 'pending').length;
    $$('[data-badge-asks]').forEach(el => { el.hidden = !n; el.textContent = n; });
  }
  UC.badge = badge;
  /* AI status chip (top bar + Today) */
  async function aiChip() {
    const s = await UC.ai.status(), p = UC.ai.progress();
    const html = p.busy || p.running.length ? `<span class="task-spin"></span> ${p.running.length ? esc(UC.agent(p.running[0])?.name || 'Agent') : 'AI'} thinking${p.left ? ` · ${p.left} queued` : ''}`
      : s.running ? `<i class="on"></i> AI ready · ${esc(UC.ai.model())}${UC.ai.auto().on ? ' · autopilot' : ''}` : App.hosted ? '<i></i> AI runs on your computer' : '<i></i> AI off · set up Ollama';
    document.querySelectorAll('[data-aichip]').forEach(el => { el.innerHTML = html; el.onclick = () => go('settings'); });
  }
  UC.aiChip = aiChip;

  /* Shared bits */
  UC.demoBar = d => d.demo ? `<div class="uc-demo"><div><b>You’re looking at demo units.</b> Import your CrunchTime, Harri or POS exports to see your own. <a data-go="imports">Import</a></div></div>` : '';
  UC.tile = (label, value, sub = '', tone = '', go = '') => `<div class="uc-tile ${tone}" ${go ? `data-go="${go}" role="button" tabindex="0"` : ''}><div class="l">${esc(label)}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  UC.ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; };
  UC.clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  UC.logItem = e => {
    const a = UC.agent(e.agent), d = UC.dept(e.dept);
    return `<li class="k-${e.kind}" style="--dc:${d?.color || 'var(--muted)'}"><time>${UC.clock(e.t)}</time><div><div><b class="uc-agentname" data-agent="${esc(e.agent)}">${esc(a?.name || '')}</b></div><div>${esc(e.text)}</div>
      <div class="muted tiny">${esc(d?.name || '')}${e.kind === 'flag' ? ' · <span class="uc-flag">Needs a look</span>' : e.kind === 'waiting' ? ' · <span class="uc-wait">Waiting for you</span>' : ''}${e.demo ? ' · demo' : ''}</div></div></li>`;
  };

  /* Needs your yes (shared by Today) */
  const LANES = { you: ['You', 'Things only you can decide'], team: ['Team', 'Goes to your team once you approve'], clients: ['Clients', 'Goes to clients once you approve'] };
  let lane = 'you', laneChosen = false;
  function asksHtml(st) {
    const pend = st.asks.filter(a => a.status === 'pending');
    const n = k => pend.filter(a => (a.lane || 'you') === k).length;
    if (!n(lane) && pend.length && !laneChosen) lane = Object.keys(LANES).find(k => n(k)) || lane;
    const list = pend.filter(a => (a.lane || 'you') === lane).sort((a, b) => a.created - b.created);
    return `<div class="uc-lanes seg">${Object.entries(LANES).map(([k, [l]]) => `<button data-lane="${k}" class="${lane === k ? 'on' : ''}">${l}${n(k) ? ` <span class="uc-n">${n(k)}</span>` : ''}</button>`).join('')}</div>
      <div class="muted tiny" style="margin:8px 2px 12px">${LANES[lane][1]}${list.length ? ' · swipe right to approve, left to decline' : ''}</div>
      ${list.map(a => { const ag = UC.agent(a.agent), d = UC.dept(a.dept); return `<div class="uc-swipe"><article class="uc-ask" data-ask="${a.id}">
        <div class="uc-askmeta"><span>${esc(ag?.name || d?.name || '')}${a.to ? ' → ' + esc(a.to) : ''}</span><span>${UC.ago(a.created)}</span></div>
        <b>${esc(a.title)}</b>${a.detail ? `<div class="uc-ask-d uc-md">${UC.fullMd ? UC.fullMd(a.detail) : esc(a.detail).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="uc-ask-act"><button class="btn primary" data-yes="${a.id}">Approve</button><button class="btn" data-edit="${a.id}">Edit</button><button class="btn ghost" data-no="${a.id}">Decline</button></div></article></div>`; }).join('')
        || `<div class="uc-empty">Nothing waiting here.${lane === 'clients' ? ' Client-facing drafts land here only after you approve them for sending.' : ''}</div>`}`;
  }
  function bindAsks(root, rerender) {
    root.querySelectorAll('[data-lane]').forEach(b => b.onclick = () => { lane = b.dataset.lane; laneChosen = true; rerender(); });
    root.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => { E().decide(b.dataset.yes, 'approved'); App.ui.toast('Approved'); rerender(); });
    // Swipe like Mail: right = approve, left = decline
    root.querySelectorAll('.uc-ask[data-ask]').forEach(card => {
      let x0 = null, dx = 0, id = null;
      const wrap = card.parentElement;
      card.addEventListener('pointerdown', e => { if (e.target.closest('button,a,textarea,.uc-ask-d')) return; x0 = e.clientX; dx = 0; id = e.pointerId; card.classList.add('dragging'); });
      card.addEventListener('pointermove', e => { if (x0 === null || e.pointerId !== id) return; dx = e.clientX - x0; if (Math.abs(dx) > 8) card.setPointerCapture(id); card.style.transform = `translateX(${dx}px)`; wrap.classList.toggle('go-right', dx > 40); wrap.classList.toggle('go-left', dx < -40); });
      const end = () => { if (x0 === null) return; x0 = null; card.classList.remove('dragging');
        if (Math.abs(dx) > 110) { const yes = dx > 0; card.style.transform = `translateX(${yes ? 120 : -120}%)`; setTimeout(() => { E().decide(card.dataset.ask, yes ? 'approved' : 'rejected'); App.ui.toast(yes ? 'Approved' : 'Declined. Nothing was sent.'); rerender(); }, 220); }
        else { card.style.transform = ''; wrap.classList.remove('go-right', 'go-left'); } };
      card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
    });
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
    const outs = await UC.ai.outputs();
    const end = ctx.end, T = UC.targets();
    const day = UC.data.stats(ctx.units.flatMap(u => UC.data.windowRows(u, end, 1)));
    const wk = UC.data.stats(ctx.units.flatMap(u => UC.data.wtd(u, end)));
    const today = App.dateKey(new Date());
    const todays = st.log.filter(e => e.date === today).sort((a, b) => b.t - a.t);
    const flags = todays.filter(e => e.kind === 'flag');
    const pend = st.asks.filter(a => a.status === 'pending');
    const vs = E().ventures().map(v => ({ v, it: (v.check[v.stage] || []).find(i => !i.done) })).filter(x => x.it && x.v.stage !== 'operating');
    const greet = (h => h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')(new Date().getHours());
    const sub = document.getElementById('ucSub'); if (sub) sub.textContent = `${greet} · ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}`;
    // 14-day trend for the sparkline (all units)
    const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(end + 'T12:00'); d.setDate(d.getDate() - i); days.push(App.dateKey(d)); }
    const series = days.map(k => ctx.units.reduce((acc, u) => acc + (u.days.find(r => r.date === k)?.sales || 0), 0));
    const spark = (() => { const max = Math.max(...series, 1), min = Math.min(...series.filter(Boolean), max), W = 600, H = 56, n = series.length - 1;
      const pts = series.map((v, i) => [i / n * W, H - 6 - (v ? (v - min) / ((max - min) || 1) : 0) * (H - 14)]);
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
      return `<svg class="uc-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Sales, last 14 days"><defs><linearGradient id="spk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".28"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>
        <path d="${line}L${W},${H}L0,${H}Z" fill="url(#spk)"/><path d="${line}" fill="none" stroke="var(--gold)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><circle cx="${pts[n][0]}" cy="${pts[n][1]}" r="3.5" fill="var(--gold)"/></svg>`; })();
    const delta = day.forecast ? `<span class="uc-delta ${day.vsFc >= 0.005 ? 'up' : day.vsFc <= -0.005 ? 'down' : 'flat'}">${day.vsFc >= 0 ? '↑' : '↓'} ${Math.abs(day.vsFc * 100).toFixed(1)}% vs forecast</span>` : '';
    const lp = day.laborPct * 100;
    const row = (agent, title, sub, right = '') => `<button class="uc-arow" ${agent ? `data-agent="${esc(agent)}"` : ''}><span class="uc-dot" style="background:${UC.dept((agent || '').split('/')[0])?.color || 'var(--label-3)'}"></span><span><b>${esc(title)}</b><span class="muted tiny">${esc(sub)}</span></span>${right}</button>`;
    const objHtml = UC.objectivesCard ? await UC.objectivesCard() : '';
    view.innerHTML = `${UC.demoBar(ctx)}${objHtml}
      <div class="uc-grid2 uc-today">
        <div class="uc-col">
          <section class="card uc-hero o1">
            <div class="uc-hero-top"><span>${ctx.units.length > 1 ? `Sales yesterday · ${ctx.units.length} units` : 'Sales yesterday'}</span><button class="btn small icon-btn" id="ucRerun" aria-label="Run the morning agents again" title="Run the morning agents again">${UC.icon('refresh')}</button></div>
            <div class="uc-big">${money(day.sales)}</div>${delta}
            <div class="uc-trio">
              <div><span>Labor</span><b class="${isNaN(lp) ? '' : lp > T.laborPct ? 'bad' : 'good'}">${E().pct(day.laborPct)}</b><small>target ${T.laborPct}%</small></div>
              <div><span>Week to date</span><b>${App.fmt.compact(wk.sales)}</b><small>${wk.forecast ? E().signPct(wk.vsFc) + ' vs forecast' : '&nbsp;'}</small></div>
              <div><span>Overtime</span><b class="${wk.ot > T.otHours ? 'bad' : ''}">${wk.ot.toFixed(1)} h</b><small>this week</small></div>
            </div>
            ${spark}
            <div class="uc-hero-foot">Last 14 days · data through ${E().fmtDay(end)}${m ? ` · morning page ${UC.ago(m.at)}` : ''}</div>
          </section>
          <section class="card o3"><div class="uc-sh"><h2>Needs a look</h2>${flags.length > 3 ? `<span class="muted tiny">${flags.length} today</span>` : ''}</div>
            <div class="uc-alist">${flags.slice(0, 3).map(e => row(e.agent, UC.agent(e.agent)?.name || 'Agent', e.text)).join('') || '<div class="uc-empty">All clear. Every agent came back within your targets.</div>'}</div>
            ${flags.length > 3 ? `<details class="uc-disclose"><summary class="small">Show ${flags.length - 3} more</summary><div class="uc-alist">${flags.slice(3).map(e => row(e.agent, UC.agent(e.agent)?.name || 'Agent', e.text)).join('')}</div></details>` : ''}</section>
          ${UC.plan() === 'lite' || !vs.length ? '' : `<section class="card o5"><div class="uc-sh"><h2>Ventures</h2></div><div class="uc-alist">${vs.slice(0, 3).map(x => `<button class="uc-arow" data-go="ventures"><span class="uc-dot" style="background:var(--gold)"></span><span><b>${esc(x.v.name)}</b><span class="muted tiny">Next: ${esc(x.it.t)}${x.it.due ? ` · due ${E().fmtDay(x.it.due)}` : ''}</span></span></button>`).join('')}</div></section>`}
        </div>
        <div class="uc-col">
          <section class="card uc-yes o2" id="ucYes"><div class="uc-yeshead"><h2 style="font-size:20px;font-weight:700">Needs your yes</h2>${pend.length ? `<span class="uc-count">${pend.length}</span>` : ''}</div>${asksHtml(st)}</section>
          <section class="card o4"><div class="uc-sh" style="justify-content:space-between"><h2>Latest AI work</h2><span class="uc-aichip" data-aichip></span></div>
            <div class="uc-alist">${outs.slice(0, 4).map(o => UC.agent(o.agent) ? row(o.agent, UC.agent(o.agent).name, o.summary, `<span class="muted tiny">${UC.ago(o.t)}</span>`) : '').join('') || `<div class="uc-empty">${App.hosted ? 'Agents think on your computer. Their results appear here.' : 'No AI results yet. Open an agent and tap Run with AI, or turn on Autopilot in Settings.'}</div>`}</div></section>
          <section class="card o6"><details class="uc-disclose"><summary><span><b style="font-size:17px">Today’s log</b> <span class="muted small">${todays.length} run${todays.length === 1 ? '' : 's'}</span></span></summary>
            <div class="seg" style="margin-top:8px">${[['all', 'All'], ['flag', 'Needs a look'], ['waiting', 'Waiting']].map(([k, l]) => `<button data-lk="${k}" class="${logKind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
            <ol class="uc-log">${todays.filter(e => logKind === 'all' || e.kind === logKind).slice(0, 40).map(UC.logItem).join('') || '<li class="uc-empty">Nothing logged today yet.</li>'}</ol></details></section>
        </div>
      </div>`;
    const rerender = () => go('today', { keepScroll: true });
    bindAsks(view, rerender);
    UC.bindObjectives?.(view, rerender);
    view.querySelector('#ucRerun').onclick = async e => { const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="task-spin"></span>'; await E().morningRun(true); App.ui.toast('Morning agents ran'); rerender(); };
    view.querySelectorAll('[data-lk]').forEach(b => b.onclick = e => { e.preventDefault(); logKind = b.dataset.lk; rerender().then(() => { const d = document.querySelector('.uc-disclose:last-of-type'); if (d) d.open = true; }); });
  };

  /* ---------- Units (multi-unit roll-up) ---------- */
  let win = 'wtd', sortBy = 'sales', unitOpen = null;
  const WINDOWS = { day: ['Day', 1], wtd: ['Week', 0], d7: ['7 days', 7], d28: ['4 weeks', 28] };
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
        <tfoot><tr><td>All units</td>${cells(tot)}<td></td></tr></tfoot></table></div>
        <div class="uc-alist uc-ulist">${list.map(({ u, s }) => `<button class="uc-arow" data-unit="${u.id}"><span class="uc-dot" style="background:${u.color}"></span><span><b>${esc(u.name)}</b><span class="muted tiny">Labor ${E().pct(s.laborPct)} · SPLH ${isNaN(s.splh) ? '—' : '$' + s.splh.toFixed(0)}${s.ot ? ` · OT ${s.ot.toFixed(1)} h` : ''}</span></span><span class="uc-uval"><b>${App.fmt.compact(s.sales)}</b>${s.forecast ? `<i class="${s.vsFc >= 0 ? 'up' : 'down'}">${E().signPct(s.vsFc)}</i>` : ''}</span></button>`).join('')}</div></section>
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
    $('#ucNav').innerHTML = ROUTES.map(([r, l, ic]) => `<a data-go="${r}" href="#${r}" ${UC.plan() === 'lite' && r === 'ventures' ? 'hidden' : ''}><span class="ico">${UC.icon(ic)}</span><span>${l}</span>${r === 'today' ? '<span class="uc-pill" data-badge-asks hidden></span>' : ''}</a>`).join('')
      + `<a href="index.html" class="uc-back"><span class="ico">${UC.icon('back')}</span><span>Ops Command Desk</span></a>`;
    $('#ucTabs').innerHTML = TABS.map(t => t === 'more' ? `<button data-tab="more" aria-label="More">${UC.icon('more')}<span>More</span></button>`
      : `<button data-tab="${t}">${UC.icon(ROUTES.find(r => r[0] === t)[2])}<span>${ROUTES.find(r => r[0] === t)[1]}</span>${t === 'today' ? '<i class="uc-tbadge" data-badge-asks hidden></i>' : ''}</button>`).join('');
    $('#ucPlan').textContent = UC.PLANS[UC.plan()].label;
    App.fx.hydrateIcons(document);
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); $('#ucSide').classList.remove('open'); go(a.dataset.go); return; }
      const ag = e.target.closest('[data-agent]'); if (ag && UC.agentDrawer) { e.preventDefault(); UC.agentDrawer(ag.dataset.agent); }
    });
    $$('#ucTabs [data-tab]').forEach(b => b.onclick = () => b.dataset.tab === 'more' ? moreSheet() : go(b.dataset.tab));
    App.bus.on('uc-ai', aiChip);
    window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && r !== current) go(r); });
    App.bus.on('data-changed', () => { if (['units', 'today', 'imports'].includes(current)) go(current, { keepScroll: true }); });
  }

  function init() {
    applyAppearance();
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
      .then(() => { UC.ai.status().then(aiChip); UC.ai.startAutopilot(); setTimeout(() => UC.brain.capture().then(() => UC.brain.startVault()).catch(e => console.warn('brain', e)), 3000); })
      .finally(() => { document.getElementById('ucSplash')?.remove(); });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})(window.UC);
