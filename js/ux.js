/* UX helpers: clear confirm dialogs, searchable dropdowns, input masks, stepped forms, greeting */
(function (App) {
  const { esc } = App;

  /* ---------- Confirm dialog with specific action labels ----------
     App.confirm({ title, body, ok: 'Delete receipt', cancel: 'Keep it', danger: true }) → Promise<boolean> */
  function confirmDialog(o = {}) {
    if (typeof o === 'string') o = { title: o };
    return new Promise(resolve => {
      const host = document.createElement('div');
      host.className = 'confirm-layer';
      host.innerHTML = `<div class="confirm-card glass-pop" role="alertdialog" aria-modal="true" aria-labelledby="cfT" aria-describedby="cfB">
          <div class="confirm-ico ${o.danger ? 'bad' : ''}">${App.fx?.icon(o.danger ? 'alert' : 'info') || ''}</div>
          <h2 id="cfT">${esc(o.title || 'Are you sure?')}</h2>
          ${o.body ? `<p id="cfB" class="muted">${esc(o.body)}</p>` : ''}
          <div class="confirm-actions">
            <button class="btn" data-a="0">${esc(o.cancel || 'Cancel')}</button>
            <button class="btn ${o.danger ? 'destructive' : 'primary'}" data-a="1">${esc(o.ok || 'Continue')}</button>
          </div></div>`;
      document.body.appendChild(host);
      const prev = document.activeElement;
      const done = v => {
        host.classList.add('out');
        document.removeEventListener('keydown', key, true);
        setTimeout(() => host.remove(), 160);
        prev?.focus?.();
        resolve(v);
      };
      const key = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        if (e.key === 'Tab') { // keep focus inside
          const b = [...host.querySelectorAll('button')];
          const i = b.indexOf(document.activeElement);
          e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
        }
      };
      document.addEventListener('keydown', key, true);
      host.addEventListener('click', e => {
        const b = e.target.closest('[data-a]');
        if (b) done(b.dataset.a === '1');
        else if (e.target === host) done(false);
      });
      // Destructive actions focus the safe choice first
      host.querySelector(o.danger ? '[data-a="0"]' : '[data-a="1"]').focus();
    });
  }

  /* ---------- Searchable dropdown (type to filter + scroll) ----------
     Any <select> with 8+ options is enhanced automatically; add data-native to opt out. */
  const MIN_OPTIONS = 8;
  const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

  function enhance(sel) {
    if (sel._combo || sel.multiple || sel.hasAttribute('data-native') || sel.closest('[data-native]')) return;
    if (sel.options.length < MIN_OPTIONS) return;
    const wrap = document.createElement('span');
    wrap.className = 'combo';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'combo-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (sel.id) btn.dataset.for = sel.id;
    const label = sel.getAttribute('aria-label') || sel.closest('label')?.childNodes[0]?.textContent?.trim();
    if (label) btn.setAttribute('aria-label', label);
    sel.parentNode.insertBefore(wrap, sel);
    wrap.append(sel, btn);
    sel.classList.add('combo-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel._combo = { btn, refresh };
    function refresh() {
      const o = sel.options[sel.selectedIndex];
      btn.innerHTML = `<span>${esc(o ? o.text : 'Choose…')}</span><svg viewBox="0 0 20 20" class="i" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      btn.disabled = sel.disabled;
    }
    // Keep the button in sync when code sets .value directly
    Object.defineProperty(sel, 'value', {
      configurable: true,
      get() { return proto.get.call(this); },
      set(v) { proto.set.call(this, v); refresh(); }
    });
    sel.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    btn.addEventListener('click', () => open(sel));
    sel.addEventListener('focus', () => btn.focus());
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault(); open(sel, e.key.length === 1 ? e.key : '');
      }
    });
    refresh();
  }

  let openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop.owner._combo.btn.setAttribute('aria-expanded', 'false'); openPop = null; } }

  function open(sel, initial = '') {
    closePop();
    const { btn } = sel._combo;
    const pop = document.createElement('div');
    pop.className = 'combo-pop glass-pop';
    pop.owner = sel;
    pop.innerHTML = `<div class="combo-search"><svg viewBox="0 0 20 20" class="i" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M13.2 13.2L17 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><input type="text" placeholder="Type to search ${sel.options.length} options" aria-label="Search options" autocomplete="off"></div><ul role="listbox" tabindex="-1"></ul><div class="combo-foot tiny muted"></div>`;
    document.body.appendChild(pop);
    openPop = pop;
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    const below = innerHeight - r.bottom;
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 240) - 8)) + 'px';
    pop.style.minWidth = Math.max(r.width, 240) + 'px';
    if (below < 300 && r.top > below) { pop.style.bottom = (innerHeight - r.top + 6) + 'px'; pop.classList.add('up'); }
    else pop.style.top = (r.bottom + 6) + 'px';
    const input = pop.querySelector('input'), ul = pop.querySelector('ul'), foot = pop.querySelector('.combo-foot');
    let items = [], active = 0;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      items = [...sel.options].map((o, i) => ({ o, i })).filter(({ o }) => !o.hidden && (!q || o.text.toLowerCase().includes(q)));
      active = Math.max(0, items.findIndex(x => x.i === sel.selectedIndex));
      if (q) active = 0;
      ul.innerHTML = items.map((x, k) => `<li role="option" data-k="${k}" aria-selected="${x.i === sel.selectedIndex}" class="${k === active ? 'on' : ''}${x.o.disabled ? ' dis' : ''}">${q ? hl(x.o.text, q) : esc(x.o.text)}${x.i === sel.selectedIndex ? '<span class="tick">✓</span>' : ''}</li>`).join('') || `<li class="none">No matches for “${esc(input.value)}”</li>`;
      foot.textContent = q ? `${items.length} of ${sel.options.length} match` : `${sel.options.length} options · ↑↓ to move · Enter to pick`;
      scroll();
    };
    const scroll = () => ul.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    const move = d => { if (!items.length) return; active = (active + d + items.length) % items.length; ul.querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', k === active)); scroll(); };
    const pick = k => {
      const x = items[k]; if (!x || x.o.disabled) return;
      if (sel.selectedIndex !== x.i) { proto.set.call(sel, x.o.value); sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
      sel._combo.refresh(); closePop(); btn.focus();
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); btn.focus(); }
      else if (e.key === 'Tab') closePop();
    });
    ul.addEventListener('mousedown', e => e.preventDefault());
    ul.addEventListener('click', e => { const li = e.target.closest('li[data-k]'); if (li) pick(+li.dataset.k); });
    input.value = initial;
    draw();
    input.focus();
  }
  const hl = (t, q) => { const i = t.toLowerCase().indexOf(q); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };

  document.addEventListener('mousedown', e => { if (openPop && !openPop.contains(e.target) && !e.target.closest('.combo-btn')) closePop(); });
  addEventListener('resize', closePop);
  document.addEventListener('scroll', e => { if (openPop && !openPop.contains(e.target)) closePop(); }, true);

  function scan(root = document) {
    if (root.tagName === 'SELECT') return enhance(root);
    root.querySelectorAll?.('select').forEach(enhance);
  }
  new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
      if (m.target.tagName === 'SELECT') enhance(m.target); // options filled in after insert
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- Input masks ----------
     data-mask="phone" → (555) 123-4567 · "zip" → 98101 or 98101-1234 · "state" → WA · "date" → MM/DD/YYYY · "digits" */
  const MASKS = {
    phone: v => { const d = v.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10); return d.length < 4 ? d : d.length < 7 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; },
    zip: v => { const d = v.replace(/\D/g, '').slice(0, 9); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; },
    state: v => v.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase(),
    date: v => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length < 3 ? d : d.length < 5 ? d.slice(0, 2) + '/' + d.slice(2) : d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4); },
    digits: v => v.replace(/\D/g, '')
  };
  const HINT = { phone: '(555) 123-4567', zip: '98101', state: 'WA', date: 'MM/DD/YYYY' };
  document.addEventListener('input', e => {
    const el = e.target, m = el.dataset?.mask;
    if (!m || !MASKS[m] || e.isComposing) return;
    const atEnd = el.selectionStart === el.value.length;
    const next = MASKS[m](el.value);
    if (next !== el.value) { el.value = next; if (atEnd) el.setSelectionRange(next.length, next.length); }
  });
  // Fill placeholder + input mode for masked fields as they appear
  new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) n.querySelectorAll?.('[data-mask]').forEach(prepMask); }).observe(document.documentElement, { childList: true, subtree: true });
  function prepMask(el) {
    const m = el.dataset.mask;
    if (!el.placeholder && HINT[m]) el.placeholder = HINT[m];
    if (m === 'phone') { el.inputMode = 'tel'; el.autocomplete ||= 'tel'; }
    if (m === 'zip' || m === 'digits' || m === 'date') el.inputMode = 'numeric';
    if (el.value && MASKS[m]) el.value = MASKS[m](el.value);
  }

  /* ---------- Stepped forms ----------
     Markup: <div data-steps><section data-step="Title">…</section>…</div>
     Adds a progress bar, step names, and Back / Next buttons. Returns { go(i), index }. */
  function steps(root, { finish } = {}) {
    const secs = [...root.querySelectorAll(':scope > [data-step]')];
    if (!secs.length) return null;
    let i = 0;
    const head = document.createElement('div');
    head.className = 'stepper';
    head.innerHTML = `<div class="stepper-top"><b class="small stepper-count"></b><span class="tiny muted stepper-name"></span></div>
      <div class="stepper-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${secs.length}"><i></i></div>
      <ol class="stepper-dots">${secs.map((s, k) => `<li><button type="button" data-goto="${k}"><span>${k + 1}</span>${esc(s.dataset.step)}</button></li>`).join('')}</ol>`;
    const nav = document.createElement('div');
    nav.className = 'stepper-nav';
    nav.innerHTML = `<button type="button" class="btn" data-back>← Back</button><span class="grow"></span><button type="button" class="btn primary" data-next></button>`;
    root.prepend(head);
    root.append(nav);
    // On the last step the primary button in the nav becomes the form's own submit (same label, same action)
    const finishBtn = finish ? root.querySelector(finish) : null;
    const finishRow = finishBtn?.closest('.form-submit, .row');
    if (finishRow) finishRow.style.display = 'none';
    function go(k) {
      i = Math.max(0, Math.min(secs.length - 1, k));
      secs.forEach((s, n) => { s.hidden = n !== i; if (n === i) s.classList.add('step-in'); });
      head.querySelector('.stepper-count').textContent = `Step ${i + 1} of ${secs.length}: ${secs[i].dataset.step}`;
      head.querySelector('.stepper-name').textContent = i < secs.length - 1 ? `Next: ${secs[i + 1].dataset.step}` : 'Last step';
      head.querySelector('.stepper-bar i').style.width = ((i + 1) / secs.length * 100) + '%';
      head.querySelector('.stepper-bar').setAttribute('aria-valuenow', i + 1);
      head.querySelectorAll('[data-goto]').forEach((b, n) => { b.classList.toggle('on', n === i); b.classList.toggle('done', n < i); });
      nav.querySelector('[data-back]').style.visibility = i ? 'visible' : 'hidden';
      const last = i === secs.length - 1;
      const next = nav.querySelector('[data-next]');
      next.textContent = last ? (finishBtn ? finishBtn.textContent : 'Done') : `Next: ${secs[i + 1].dataset.step} →`;
      next.classList.toggle('finish', last);
      secs[i].querySelector('input:not([type=checkbox]),select,textarea')?.focus({ preventScroll: true });
    }
    nav.querySelector('[data-back]').onclick = () => go(i - 1);
    nav.querySelector('[data-next]').onclick = () => (i === secs.length - 1 ? finishBtn?.click() : go(i + 1));
    head.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => go(+b.dataset.goto));
    go(0);
    return { go, get index() { return i; } };
  }

  /* ---------- Greeting ---------- */
  function greeting() {
    const h = new Date().getHours();
    const part = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const name = (App.settings.get('userName', '') || '').trim().split(/\s+/)[0];
    return name ? `${part}, ${name}` : part;
  }
  function today() { return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }

  /* ---------- Task progress pill: descriptive status for long jobs ---------- */
  let pill = null, pillTimer;
  function task(text, pct) {
    clearTimeout(pillTimer);
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'task-pill glass-pop';
      pill.setAttribute('role', 'status');
      pill.innerHTML = '<span class="task-spin" aria-hidden="true"></span><div class="task-body"><div class="task-text small"></div><div class="task-bar"><i></i></div></div><b class="task-pct tiny"></b>';
      document.body.appendChild(pill);
    }
    pill.classList.remove('out');
    pill.querySelector('.task-text').textContent = text;
    const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    pill.querySelector('.task-bar i').style.width = p + '%';
    pill.querySelector('.task-pct').textContent = p + '%';
  }
  function taskDone(text) {
    if (!pill) return;
    if (text) task(text, 100);
    pill.classList.add('done');
    pillTimer = setTimeout(() => { pill?.classList.add('out'); setTimeout(() => { pill?.remove(); pill = null; }, 250); }, text ? 1400 : 0);
  }

  /* ---------- Surface style (liquid glass vs solid) ---------- */
  function setSurface(v) {
    App.settings.set('surface', v);
    document.documentElement.dataset.surface = v;
  }
  document.documentElement.dataset.surface = App.settings.get('surface', 'glass');

  App.confirm = confirmDialog;
  App.ux = { task, taskDone, setSurface, steps, greeting, today, enhance, scan, masks: MASKS };
})(window.App);
