/* Visual polish + interaction layer: icons, motion, toasts, command palette, onboarding */
(function (App) {
  const { $, $$, esc } = App;
  if (window.Chart) { Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.font.size = 12; }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Icons (24px stroke icons) ---------- */
  const P = {
    wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2"/><rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M16 13.5h2.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8 12h1M11.5 12h1M15 12h1M8 16h1M11.5 16h1M15 16h1"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/><path d="M15 10l-2 2 2 2"/>',
    chevrons: '<path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    library: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M12 11v5M9.5 13.5 12 11l2.5 2.5"/>',
    finance: '<path d="M3 3v18h18"/><path d="M7 15l3.5-4 3 2.5L20 7"/><path d="M16 7h4v4"/>',
    operations: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    trading: '<path d="M7 4v16M17 4v16"/><rect x="4.5" y="7" width="5" height="7" rx="1"/><rect x="14.5" y="10" width="5" height="6" rx="1"/>',
    marketing: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
    research: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5V5.5M20 18v3H6.5"/><path d="M9 8h7M9 11.5h5"/>',
    personnel: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4A6.5 6.5 0 0 1 21.5 20"/>',
    businesses: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18M11 13v2h2v-2"/>',
    explorer: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
    integrations: '<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    sparkles: '<path d="M10 3l1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'
  };
  const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.info}</svg>`;

  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => { if (!el.dataset.iconDone) { el.innerHTML = icon(el.dataset.icon); el.dataset.iconDone = '1'; } });
  }

  /* ---------- Toasts ---------- */
  function toast(msg, ms = 3200, kind) {
    let stack = $('.toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
    const k = kind || (/fail|error|could not|cannot/i.test(msg) ? 'alert' : /saved|imported|created|updated|restored|moved|deleted|removed/i.test(msg) ? 'check' : 'info');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="t-ico" style="${k === 'alert' ? 'background:var(--bad-soft);color:var(--bad)' : k === 'check' ? 'background:var(--good-soft);color:var(--good)' : ''}">${icon(k)}</span><span>${esc(msg)}</span>`;
    stack.appendChild(t);
    while (stack.children.length > 4) stack.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
  }

  /* ---------- Count-up numbers ---------- */
  function countUp(el) {
    if (el.dataset.counted || el.children.length) return;
    el.dataset.counted = '1';
    const txt = el.textContent.trim();
    const m = txt.match(/^([^\d-]*?)(-?)([$€£]?)([\d,]*\.?\d+)(.*)$/);
    if (!m || reduced()) return;
    const [, pre, neg, cur, numStr, suf] = m;
    const target = parseFloat(numStr.replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;
    const dp = (numStr.split('.')[1] || '').length;
    const comma = numStr.includes(',');
    const dur = 900, t0 = performance.now();
    const ease = x => 1 - Math.pow(1 - x, 4);
    const f = v => { const s = v.toFixed(dp); return comma ? Number(s).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : s; };
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = pre + neg + cur + f(target * ease(p)) + suf;
      if (p < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  }

  /* ---------- Staggered entrance for new content ---------- */
  let pending = [];
  let scheduled = false;
  function flushEnter() {
    scheduled = false;
    const items = pending; pending = [];
    let i = 0;
    for (const el of items) {
      if (!el.isConnected || el.dataset.risen) continue;
      el.dataset.risen = '1';
      if (!reduced()) { el.style.setProperty('--d', Math.min(i, 14) * 35 + 'ms'); el.classList.add('rise'); i++; }
      el.querySelectorAll('.kpi .value, .mini-kpis .v').forEach(countUp);
      if (el.matches('.kpi')) el.querySelectorAll('.value').forEach(countUp);
    }
  }
  function watch(root) {
    new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches('.card, .alert, .tabs')) pending.push(n);
        n.querySelectorAll?.('.card, .grid > a, .alert').forEach(c => pending.push(c));
        hydrateIcons(n);
      }
      if (pending.length && !scheduled) { scheduled = true; requestAnimationFrame(flushEnter); }
    }).observe(root, { childList: true, subtree: true });
  }

  /* ---------- Button ripple ---------- */
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn');
    if (!b || reduced() || b.disabled) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(span);
    setTimeout(() => span.remove(), 650);
  });

  /* ---------- Theme switch with circular reveal ---------- */
  function setTheme(t, origin) {
    const apply = () => {
      document.documentElement.dataset.theme = t;
      App.settings.set('theme', t);
      updateThemeButton();
      window.desktop?.setTheme?.(t);
    };
    if (!document.startViewTransition || reduced()) { apply(); App.go(App.currentRoute()); return; }
    const x = origin?.x ?? innerWidth / 2, y = origin?.y ?? innerHeight / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' }));
    vt.finished.then(() => App.go(App.currentRoute()));
  }
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-set]').forEach(x => { x.classList.toggle('on', x.dataset.themeSet === (dark ? 'dark' : 'light')); x.setAttribute('aria-checked', x.classList.contains('on')); });
  }

  /* ---------- AI shortcuts ---------- */
  async function aiBriefing() {
    const c = await App.ai.connected();
    const provider = ['ollama', 'xai', 'groq', 'perplexity'].find(k => c[k]) || 'ollama';
    App.go('ai', { newThread: true, send: !!c[provider], provider,
      prompt: App.biz.isMaster()
        ? 'Give me an executive briefing across all my businesses: the top 5 things that need my attention, ranked by impact, with the numbers behind each and the next step.'
        : 'Give me a briefing on this business: the top 5 things that need my attention, ranked by impact, with the numbers behind each and the next step.' });
  }

  /* ---------- Command palette ---------- */
  const PAGES = [['dashboard', 'Dashboard'], ['library', 'Data Library'], ['finance', 'Financials'], ['purchases', 'Purchases'], ['operations', 'Operations'], ['trading', 'Trading Risk'],
    ['marketing', 'Marketing'], ['research', 'Research'], ['personnel', 'Personnel'], ['compliance', 'Reports: Tax & Compliance'], ['legal', 'Legal & Risk: documents, incidents'], ['wealth', 'Net worth & family wealth'], ['tax', 'Taxes & CPA: documents, contributions, CPA packet'], ['businesses', 'Units: businesses & personal'], ['explorer', 'Data Explorer'], ['integrations', 'Integrations'], ['settings', 'Settings']];
  function commands(q) {
    const items = [];
    PAGES.filter(([r]) => App.biz.enabled(r)).forEach(([r, l]) => items.push({ g: 'Go to', icon: r, label: l, run: () => App.go(r) }));
    [['all:business', 'Business dashboard: all businesses', 'businesses'], ['all:individual', 'Personal dashboard: all personal units', 'user'], ['all', 'Everything: businesses + personal', 'layers']]
      .forEach(([id, label, ic]) => items.push({ g: 'Units', icon: ic, label, run: () => { App.biz.setCurrent(id); App.go('dashboard'); } }));
    App.biz.active().forEach(b => items.push({ g: 'Units', icon: 'businesses', label: `Switch to ${b.name}`, color: b.color, run: () => { App.biz.setCurrent(b.id); App.go('dashboard'); } }));
    items.push(
      { g: 'Actions', icon: 'sparkles', label: 'AI briefing: what needs my attention?', run: () => aiBriefing() },
      ...(App.biz.enabled('purchases') && !App.biz.isMaster() ? [{ g: 'Actions', icon: 'receipt', label: 'New receipt (purchase journal)', run: () => App.go('purchases').then(() => App.purchasesEditor()) }] : []),
      ...(!App.biz.isMaster() ? [{ g: 'Actions', icon: 'download', label: 'Download accountant workbook (tax & compliance)', run: () => App.go('compliance').then(() => App.complianceWorkbook()) }] : []),
      ...(!App.biz.isMaster() ? [{ g: 'Actions', icon: 'alert', label: 'Report an incident (injury, allergy, complaint)', run: () => App.go('legal', { tab: 'incidents' }).then(() => document.getElementById('icNew')?.click()) }] : []),
      ...(App.lock?.enabled() ? [{ g: 'Actions', icon: 'lock', label: 'Lock the app now', run: () => App.lock.lock() }] : []),
      { g: 'Actions', icon: 'explorer', label: 'New table (type data in by hand)', run: () => App.newTable() },
      { g: 'Actions', icon: 'upload', label: 'Upload files', hint: '', run: () => $('#quickUpload').click() },
      { g: 'Actions', icon: 'plus', label: 'New business or venture', run: () => App.businessForm(null, id => { App.biz.setCurrent(id); App.go('dashboard'); }) },
      { g: 'Actions', icon: 'sparkles', label: 'Load sample data', run: async () => { await App.samples.load(); App.go('dashboard'); } },
      { g: 'Actions', icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', label: 'Toggle light / dark mode', run: () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') },
      { g: 'Actions', icon: 'download', label: 'Export backup', run: () => { App.go('settings').then(() => $('#sExport')?.click()); } },
      { g: 'Actions', icon: 'printer', label: 'Print / save page as PDF', run: () => setTimeout(() => print(), 100) },
      { g: 'Actions', icon: 'keyboard', label: 'Keyboard shortcuts', run: shortcuts },
      { g: 'Actions', icon: 'info', label: 'Help & tutorial (step-by-step guides)', run: () => App.help?.open('') },
      { g: 'Actions', icon: 'sparkles', label: 'Take the guided tour', run: () => App.go('dashboard').then(() => setTimeout(() => App.help?.tour(0), 400)) }
    );
    if (!q) return items;
    const ql = q.toLowerCase();
    const score = s => { s = s.toLowerCase(); if (s.startsWith(ql)) return 3; if (s.split(/\s+/).some(w => w.startsWith(ql))) return 2; return s.includes(ql) ? 1 : 0; };
    const out = items.map(it => ({ it, s: score(it.label) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.it);
    out.unshift({ g: 'Ask AI', icon: 'sparkles', label: `Ask Grok: “${q}”`, run: () => App.go('ai', { prompt: q, send: true, provider: 'xai', newThread: true }) },
      { g: 'Ask AI', icon: 'sparkles', label: `Research with Perplexity: “${q}”`, run: () => App.go('ai', { prompt: q, send: true, provider: 'perplexity', newThread: true }) });
    out.push({ g: 'Search', icon: 'search', label: `Search everything for “${q}”`, run: () => App.go('search', { q }) });
    return out;
  }
  let sel = 0, list = [];
  function openPalette() {
    let el = $('#cmdk');
    if (!el) {
      el = document.createElement('div'); el.id = 'cmdk'; el.className = 'cmdk';
      el.innerHTML = `<div class="cmdk-box" role="dialog" aria-label="Command palette">
        <div class="cmdk-input">${icon('search')}<input id="cmdkQ" placeholder="Jump to a page, switch business, or run an action…" autocomplete="off"><kbd>Esc</kbd></div>
        <div class="cmdk-list" id="cmdkList"></div>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span><kbd>Esc</kbd> close</span></div></div>`;
      document.body.appendChild(el);
      el.onclick = e => { if (e.target === el) closePalette(); };
      const inp = el.querySelector('#cmdkQ');
      inp.oninput = () => { sel = 0; renderPalette(inp.value.trim()); };
      inp.onkeydown = e => {
        if (e.key === 'ArrowDown') { sel = Math.min(list.length - 1, sel + 1); paintSel(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paintSel(); e.preventDefault(); }
        else if (e.key === 'Enter') { const it = list[sel]; if (it) { closePalette(); it.run(); } }
        else if (e.key === 'Escape') closePalette();
      };
    }
    el.hidden = false;
    const inp = el.querySelector('#cmdkQ'); inp.value = ''; sel = 0; renderPalette('');
    setTimeout(() => inp.focus(), 10);
  }
  function closePalette() { const el = $('#cmdk'); if (el) el.hidden = true; }
  function renderPalette(q) {
    list = commands(q);
    let g = '';
    $('#cmdkList').innerHTML = list.map((it, i) => {
      const head = it.g !== g ? `<div class="cmdk-group">${esc(g = it.g)}</div>` : '';
      return `${head}<div class="cmdk-item" data-i="${i}"><span class="ci" ${it.color ? `style="background:${it.color};color:#fff"` : ''}>${icon(it.icon)}</span><span>${esc(it.label)}</span>${it.hint ? `<span class="hint">${esc(it.hint)}</span>` : ''}</div>`;
    }).join('') || '<div class="empty">No matches</div>';
    $$('#cmdkList .cmdk-item').forEach(n => {
      n.onmousemove = () => { if (sel !== +n.dataset.i) { sel = +n.dataset.i; paintSel(); } };
      n.onclick = () => { const it = list[+n.dataset.i]; closePalette(); it.run(); };
    });
    paintSel();
  }
  function paintSel() {
    $$('#cmdkList .cmdk-item').forEach(n => n.classList.toggle('sel', +n.dataset.i === sel));
    $(`#cmdkList .cmdk-item[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function shortcuts() {
    const mod = /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl';
    App.ui.modal(`<div class="card-head"><h2>Keyboard shortcuts</h2><button class="btn small" data-close>Close</button></div>
      <div class="stack">${[[`${mod} K`, 'Command palette'], [`${mod} U`, 'Upload files'], [`${mod} B`, 'New business'], [`${mod} J`, 'Toggle light / dark'], [`${mod} /`, 'AI Assistant'], [`${mod} E`, 'New receipt'], [`${mod} Shift L`, 'Lock the app'],
        ['G then D', 'Go to dashboard'], ['G then L', 'Go to Data Library'], ['G then M', 'Master dashboard'], ['?', 'Show this list'], ['F1', 'Help for this page']]
        .map(([k, l]) => `<div class="row spread"><span>${l}</span><span class="row" style="gap:4px">${k.split(' ').map(x => x === 'then' ? '<span class="muted small">then</span>' : `<kbd>${x}</kbd>`).join('')}</span></div>`).join('')}</div>`);
  }

  let gPending = 0;
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#cmdk') && !$('#cmdk').hidden ? closePalette() : openPalette(); return; }
    if (mod && e.key.toLowerCase() === 'e' && !e.shiftKey && App.biz.enabled('purchases') && !App.biz.isMaster()) { e.preventDefault(); App.go('purchases').then(() => App.purchasesEditor()); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'l' && App.lock?.enabled()) { e.preventDefault(); App.lock.lock(); return; }
    if (mod && e.key === '/') { e.preventDefault(); App.go('ai'); return; }
    if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); $('#quickUpload').click(); return; }
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); App.businessForm(null, id => { App.biz.setCurrent(id); App.go('dashboard'); }); return; }
    if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); return; }
    if (e.key === 'Escape') { if (!$('#modal').hidden) $('#modal').click(); closePalette(); return; }
    if (typing || mod || e.altKey) return;
    if (e.key === '?') { shortcuts(); return; }
    if (e.key === 'g') { gPending = Date.now(); return; }
    if (Date.now() - gPending < 1000) {
      gPending = 0;
      const k = e.key.toLowerCase();
      if (k === 'd') App.go('dashboard');
      if (k === 'l') App.go('library');
      if (k === 'm') { App.biz.setCurrent(App.biz.currentKind() === 'individual' ? 'all:individual' : 'all:business'); App.go('dashboard'); }
    }
  });

  /* ---------- First-run onboarding ---------- */
  function onboarding() {
    let step = 0;
    const data = { name: '', type: 'restaurant' };
    const types = Object.entries(App.biz.TEMPLATES);
    const render = (card, close) => {
      const steps = `<div class="onb-steps">${[0, 1, 2].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
      if (step === 0) card.innerHTML = `${steps}
        <div class="onb-logo">OC</div>
        <h2 style="font-size:22px">Welcome to Ops Command Desk</h2>
        <p class="muted">One place for financials, operations, trading risk, marketing, research, and personnel, across every business you run. Your data stays on this ${App.hosted ? 'device' : 'computer'}.</p>
        <div class="row" style="margin-top:18px"><button class="btn primary" data-next>Get started ${icon('arrow')}</button><button class="btn ghost" data-skip>Skip setup</button></div>`;
      if (step === 1) card.innerHTML = `${steps}
        <h2 style="font-size:20px">Name your first business</h2>
        <p class="muted small">You can add more ventures any time. The Master dashboard rolls them all up.</p>
        <div class="stack" style="margin-top:12px">
          <input id="onbName" placeholder="e.g. Gamboe Consulting" value="${esc(data.name)}" style="font-size:16px;padding:11px 13px">
          <div class="onb-choice">${types.map(([k, t]) => `<button data-type="${k}" class="${k === data.type ? 'sel' : ''}"><b>${esc(t.label)}</b><span class="muted tiny">${t.modules.map(m => App.biz.MODULE_LABELS[m]).join(' · ')}</span></button>`).join('')}</div>
        </div>
        <div class="row" style="margin-top:18px"><button class="btn primary" data-next>Continue ${icon('arrow')}</button><button class="btn ghost" data-back>Back</button></div>`;
      if (step === 2) card.innerHTML = `${steps}
        <h2 style="font-size:20px">Add your data</h2>
        <p class="muted small">Pick how you'd like to start. You can always do the others later.</p>
        <div class="onb-choice" style="margin-top:12px">
          <button data-act="upload"><span class="oc-i">${icon('upload')}</span><b>Upload files</b><span class="muted tiny">Spreadsheets, reports, exports from Harri, CrunchTime, Webull…</span></button>
          <button data-act="sample"><span class="oc-i">${icon('sparkles')}</span><b>Explore with sample data</b><span class="muted tiny">See every module filled in. Remove it anytime.</span></button>
          <button data-act="connect"><span class="oc-i">${icon('integrations')}</span><b>Connect apps</b><span class="muted tiny">Google Drive and Outlook sign-in.</span></button>
        </div>`;
      card.querySelector('[data-skip]')?.addEventListener('click', () => { App.settings.set('onboarded', true); close(); });
      card.querySelector('[data-back]')?.addEventListener('click', () => { step--; render(card, close); });
      card.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { data.type = b.dataset.type; card.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('sel', x === b)); });
      const nameInp = card.querySelector('#onbName');
      if (nameInp) { nameInp.oninput = () => data.name = nameInp.value; setTimeout(() => nameInp.focus(), 50); nameInp.onkeydown = e => { if (e.key === 'Enter') card.querySelector('[data-next]').click(); }; }
      card.querySelector('[data-next]')?.addEventListener('click', () => {
        if (step === 1) {
          const first = App.biz.list()[0];
          App.biz.update(first.id, { name: data.name.trim() || 'My Business', type: data.type, modules: App.biz.TEMPLATES[data.type].modules.slice() });
          App.biz.setCurrent(first.id);
        }
        step++; render(card, close);
      });
      card.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
        App.settings.set('onboarded', true); close();
        if (b.dataset.act === 'upload') { await App.go('library'); }
        if (b.dataset.act === 'sample') { await App.samples.load(); App.go('dashboard'); }
        if (b.dataset.act === 'connect') App.go('integrations');
      });
    };
    App.ui.modal('', (card, close) => render(card, close));
  }

  async function maybeOnboard() {
    if (App.settings.get('onboarded', false)) return;
    const files = await App.store.all('files', { raw: true });
    if (files.length || App.biz.list().length > 1) { App.settings.set('onboarded', true); return; }
    onboarding();
  }

  function hideSplash() {
    const s = $('#splash');
    if (!s) return;
    setTimeout(() => { s.classList.add('done'); setTimeout(() => s.remove(), 500); }, 350);
  }

  /* Skeleton placeholder used while analyses refresh */
  function skeleton(cards = 4) {
    return `<div class="grid k4">${Array.from({ length: cards }, () => '<div class="skel" style="height:104px"></div>').join('')}</div>
      <div class="grid c2"><div class="skel" style="height:300px"></div><div class="skel" style="height:300px"></div></div>`;
  }

  App.fx = { aiBriefing, icon, hydrateIcons, toast, countUp, watch, setTheme, updateThemeButton, openPalette, closePalette, shortcuts, onboarding, maybeOnboard, hideSplash, skeleton };
  App.ui.toast = toast;
  App.ui.skeleton = skeleton;
})(window.App);
