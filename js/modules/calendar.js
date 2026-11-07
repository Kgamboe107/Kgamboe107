/* Calendar (Everything view only): every addition dated and color-coded by the section it went into
   (uploads, receipts, notes, SMG scores, store audits, balance updates), plus pay dates and expenses
   you schedule (one-off or recurring) and the ones the app spots in your data. */
(function (App) {
  const { fmt, esc } = App;
  const P = () => App.period;

  /* Sections and their colors (same hues as the rest of the app) */
  const SECTIONS = {
    pay: { label: 'Pay dates', color: '#16a34a' },
    expense: { label: 'Expenses', color: '#dc2626' },
    finance: { label: 'Financials', color: '#2563eb' },
    purchases: { label: 'Purchases', color: '#d97706' },
    operations: { label: 'Operations', color: '#0891b2' },
    marketing: { label: 'Marketing', color: '#db2777' },
    trading: { label: 'Trading', color: '#7c3aed' },
    research: { label: 'Research', color: '#ea580c' },
    personnel: { label: 'Personnel', color: '#059669' },
    wealth: { label: 'Net Worth', color: '#0d9488' },
    reports: { label: 'Reports & other', color: '#64748b' },
    filings: { label: 'Filing due dates', color: '#475569' }
  };
  const CAT_TO_SEC = { financial: 'finance', operations: 'operations', trading: 'trading', marketing: 'marketing', research: 'research', personnel: 'personnel', report: 'reports', other: 'reports' };
  const FREQ = { once: 'One time', weekly: 'Every week', biweekly: 'Every 2 weeks', semimonthly: 'Twice a month (1st & 15th)', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };

  const items = () => App.settings.get('calendar.items', []);
  const saveItems = l => App.settings.set('calendar.items', l);
  const hidden = () => new Set(App.settings.get('calendar.hidden', ['filings']));
  const unitName = id => App.biz.get(id)?.name || '';
  const iso = d => P().iso(d);
  const parse = s => P().parse(s);
  const dayKey = v => { const k = App.dateKey(v); return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : ''; };
  let month = null, kindFilter = 'all';
  const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

  /* ---------- Recurring dates ---------- */
  function occurrences(it, from, to) {
    const out = [], start = parse(it.start), end = it.until ? parse(it.until) : null;
    const push = d => { const k = iso(d); if (k >= from && k <= to && k >= it.start && (!end || d <= end)) out.push(k); };
    const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
    const fromD = parse(from), toD = parse(to);
    if (it.freq === 'once') { push(start); return out; }
    if (it.freq === 'weekly' || it.freq === 'biweekly') {
      const step = it.freq === 'weekly' ? 7 : 14;
      const d = new Date(start);
      if (d < fromD) d.setDate(d.getDate() + Math.floor((fromD - d) / (step * 864e5)) * step);
      for (; d <= toD; d.setDate(d.getDate() + step)) push(d);
      return out;
    }
    const months = { semimonthly: 1, monthly: 1, quarterly: 3, yearly: 12 }[it.freq] || 1;
    for (let y = fromD.getFullYear(), m = fromD.getMonth() - 1; new Date(y, m, 1) <= toD; m++) {
      const mm = ((m % 12) + 12) % 12, yy = y + Math.floor(m / 12);
      const diff = (yy - start.getFullYear()) * 12 + (mm - start.getMonth());
      if (diff < 0 || diff % months) continue;
      const days = it.freq === 'semimonthly' ? [1, 15] : [start.getDate()];
      for (const dd of days) push(new Date(yy, mm, Math.min(dd, lastDay(yy, mm)), 12));
    }
    return out;
  }

  /* ---------- Spot recurring pay and expenses in uploaded tables ---------- */
  async function suggestions() {
    const ds = (await App.store.all('datasets')).filter(d => !d.sample && Array.isArray(d.rows) && d.rows.length >= 3);
    const have = new Set(items().map(i => i.title.toLowerCase()));
    const out = [];
    for (const d of ds) {
      const H = d.headers || [];
      const dateC = H.find(h => /^(date|posted|posting date|transaction date|trans date|pay date)$/i.test(h)) || H.find(h => /date/i.test(h));
      const amtC = H.find(h => /^(amount|debit|withdrawal|payment|net pay|gross pay|total)$/i.test(h)) || H.find(h => /amount/i.test(h));
      const labC = H.find(h => /^(payee|vendor|merchant|description|memo|category|name|expense)$/i.test(h)) || H.find(h => /payee|vendor|merchant|description|category/i.test(h));
      if (!dateC || !amtC || !labC) continue;
      const groups = new Map();
      for (const r of d.rows) {
        const k = dayKey(r[dateC]), a = App.num(r[amtC]), lab = String(r[labC] || '').trim();
        if (!k || !lab || !Number.isFinite(a) || !a) continue;
        const g = groups.get(lab.toLowerCase()) || { lab, pts: [] };
        g.pts.push({ k, a }); groups.set(lab.toLowerCase(), g);
      }
      for (const g of groups.values()) {
        const months = new Set(g.pts.map(p => p.k.slice(0, 7)));
        if (months.size < 3 || have.has(g.lab.toLowerCase())) continue;
        const days = g.pts.map(p => +p.k.slice(8)).sort((a, b) => a - b), amts = g.pts.map(p => Math.abs(p.a)).sort((a, b) => a - b);
        if (days[days.length - 1] - days[0] > 5) continue;
        const med = amts[Math.floor(amts.length / 2)], mean = App.mean(amts), sd = App.stdev ? App.stdev(amts) : 0;
        if (mean && sd / mean > 0.25) continue;
        const pay = /payroll|salary|paycheck|direct dep|deposit|income|wages|net pay/i.test(g.lab + ' ' + amtC) || g.pts.every(p => p.a > 0) && /credit|deposit/i.test(H.join(' '));
        const day = days[Math.floor(days.length / 2)];
        const firstK = g.pts.map(p => p.k).sort()[0];
        const start = `${firstK.slice(0, 8)}${String(day).padStart(2, '0')}`;
        out.push({ title: g.lab, type: pay ? 'pay' : 'expense', amount: Math.round(med * 100) / 100, freq: 'monthly', start, unit: d.businessId || '', from: d.name, months: months.size });
        have.add(g.lab.toLowerCase());
      }
    }
    return out.slice(0, 12);
  }

  /* ---------- Everything that was added, by date ---------- */
  async function additions(from, to) {
    const ev = [];
    const inRange = k => k && k >= from && k <= to;
    const units = App.biz.active();
    const kindOk = id => kindFilter === 'all' || App.biz.kindOf(App.biz.get(id)) === kindFilter;
    for (const f of await App.store.files()) {
      const k = dayKey(new Date(f.uploadedAt || f.createdAt || 0));
      if (!inRange(k) || !kindOk(App.biz.idOf(f))) continue;
      ev.push({ date: k, sec: CAT_TO_SEC[f.category] || 'reports', title: `Uploaded ${f.name}`, unit: App.biz.idOf(f), sample: f.sample });
    }
    const receipts = new Map();
    for (const p of await App.store.all('purchases')) {
      const k = dayKey(p.date) || dayKey(new Date(p.createdAt || 0));
      if (!inRange(k) || !kindOk(App.biz.idOf(p))) continue;
      const key = k + '|' + App.biz.idOf(p);
      const r = receipts.get(key) || { date: k, unit: App.biz.idOf(p), n: 0, total: 0, vendors: new Set() };
      r.n++; r.total += +p.total || 0; if (p.vendor) r.vendors.add(p.vendor); receipts.set(key, r);
    }
    for (const r of receipts.values()) ev.push({ date: r.date, sec: 'purchases', title: `${r.n} receipt${r.n > 1 ? 's' : ''} · ${fmt.money(r.total)}`, detail: [...r.vendors].join(', '), unit: r.unit, amount: r.total });
    for (const n of await App.store.all('notes')) {
      const k = dayKey(new Date(n.createdAt || n.updatedAt || 0));
      if (inRange(k) && kindOk(App.biz.idOf(n))) ev.push({ date: k, sec: n.module === 'marketing' ? 'marketing' : 'research', title: `Note: ${n.title || 'Untitled'}`, unit: App.biz.idOf(n) });
    }
    for (const b of units) {
      if (!kindOk(b.id)) continue;
      await App.biz.withBiz(b.id, async () => {
        for (const s of App.guest?.smg?.() || []) { const k = dayKey(s.to || s.from); if (inRange(k)) ev.push({ date: k, sec: 'marketing', title: `SMG scores${s.scores?.overall != null ? ` · ${s.scores.overall}% overall` : ''}`, unit: b.id }); }
        for (const a of App.guest?.audits?.() || []) { const k = dayKey(a.date); if (inRange(k)) ev.push({ date: k, sec: 'marketing', title: `${a.type || 'Store audit'}${App.guest.scoreAudit ? ` · ${Math.round(App.guest.scoreAudit(a).score * 100)}%` : ''}`, unit: b.id }); }
        const seen = new Set();
        for (const a of App.bsettings.get('wealth.accounts', [])) for (const h of a.history || []) {
          if (!inRange(h.date) || seen.has(h.date + a.id)) continue;
          seen.add(h.date + a.id);
          ev.push({ date: h.date, sec: 'wealth', title: `Balance: ${a.name} ${fmt.money(h.balance)}`, unit: b.id });
        }
        if (App.biz.kindOf(b) === 'business' && App.compliance?.deadlines && !hidden().has('filings')) {
          const ys = [...new Set([from.slice(0, 4), to.slice(0, 4)])].map(Number);
          for (const y of ys) for (const d of await App.compliance.deadlines(y).catch(() => [])) if (!d.done && inRange(d.due)) ev.push({ date: d.due, sec: 'filings', title: d.title, unit: b.id, amount: d.amount });
        }
      });
    }
    // Merge many uploads on one day into one line per section
    const byKey = new Map();
    for (const e of ev) {
      if (!/^Uploaded /.test(e.title)) { byKey.set(Math.random(), e); continue; }
      const key = `${e.date}|${e.sec}|${e.unit}`, x = byKey.get(key);
      if (!x) byKey.set(key, { ...e, files: [e.title.slice(9)] });
      else { x.files.push(e.title.slice(9)); x.title = `Uploaded ${x.files.length} files`; x.detail = x.files.join(', '); }
    }
    return [...byKey.values()];
  }

  function scheduled(from, to) {
    const out = [];
    for (const it of items()) {
      if (it.unit && kindFilter !== 'all' && App.biz.kindOf(App.biz.get(it.unit)) !== kindFilter) continue;
      for (const k of occurrences(it, from, to)) out.push({ date: k, sec: it.type === 'pay' ? 'pay' : 'expense', title: it.title, amount: +it.amount || null, unit: it.unit, item: it, detail: [FREQ[it.freq], it.note].filter(Boolean).join(' · ') });
    }
    return out;
  }

  /* ---------- Add / edit a pay date or expense ---------- */
  function editItem(it, onSaved) {
    const units = App.biz.active();
    const x = it || { type: 'expense', freq: 'monthly', start: P().today() };
    App.ui.modal(`<div class="row spread"><h2>${it?.id ? 'Edit' : 'Add'} ${x.type === 'pay' ? 'pay date' : 'expense'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="seg" role="tablist" style="margin:10px 0"><button data-ty="pay" class="${x.type === 'pay' ? 'on' : ''}">Pay date</button><button data-ty="expense" class="${x.type !== 'pay' ? 'on' : ''}">Expense comes out</button></div>
      <div class="cal-form">
        <label class="field">What<input id="ciTitle" value="${esc(x.title || '')}" placeholder="${x.type === 'pay' ? 'e.g. Payroll, Koen paycheck' : 'e.g. Rent, Sysco autopay, car loan'}"></label>
        <label class="field">Amount ($, optional)<input id="ciAmt" type="number" step="0.01" value="${x.amount ?? ''}"></label>
        <label class="field">First date<input id="ciStart" type="date" value="${esc(x.start)}"></label>
        <label class="field">Repeats<select id="ciFreq">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}" ${x.freq === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field">Ends (optional)<input id="ciUntil" type="date" value="${esc(x.until || '')}"></label>
        <label class="field">Unit<select id="ciUnit"><option value="">General / household</option>${units.map(u => `<option value="${u.id}" ${x.unit === u.id ? 'selected' : ''}>${esc(u.name)} (${App.biz.kindOf(u) === 'individual' ? 'personal' : 'business'})</option>`).join('')}</select></label>
        <label class="field cal-wide">Note (optional)<input id="ciNote" value="${esc(x.note || '')}" placeholder="e.g. paid from Chase checking, autopay"></label>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:14px">${it?.id ? '<button class="btn danger" id="ciDel">Delete</button>' : '<span></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ciSave">Save</button></div></div>`, (c, close) => {
      let type = x.type;
      c.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { type = b.dataset.ty; c.querySelectorAll('[data-ty]').forEach(y => y.classList.toggle('on', y === b)); c.querySelector('h2').textContent = `${it?.id ? 'Edit' : 'Add'} ${type === 'pay' ? 'pay date' : 'expense'}`; });
      c.querySelector('#ciSave').onclick = () => {
        const title = c.querySelector('#ciTitle').value.trim(), start = c.querySelector('#ciStart').value;
        if (!title || !start) { App.ui.toast('Add a name and a first date'); return; }
        const rec = { id: x.id || App.uid(), type, title, amount: c.querySelector('#ciAmt').value === '' ? null : +c.querySelector('#ciAmt').value, start, freq: c.querySelector('#ciFreq').value, until: c.querySelector('#ciUntil').value || '', unit: c.querySelector('#ciUnit').value, note: c.querySelector('#ciNote').value.trim() };
        saveItems(items().filter(i => i.id !== rec.id).concat(rec));
        close(); App.ui.toast(type === 'pay' ? 'Pay date saved' : 'Expense saved'); onSaved?.();
      };
      c.querySelector('#ciDel')?.addEventListener('click', () => { saveItems(items().filter(i => i.id !== x.id)); close(); App.ui.toast('Removed'); onSaved?.(); });
    });
  }

  /* ---------- Page ---------- */
  const chip = e => `<div class="cal-chip" style="--c:${SECTIONS[e.sec].color}" title="${esc(SECTIONS[e.sec].label + ': ' + e.title + (e.unit ? ' · ' + unitName(e.unit) : ''))}"><i></i><span>${esc(e.title)}</span></div>`;
  function line(e) {
    const s = SECTIONS[e.sec];
    return `<div class="cal-line" style="--c:${s.color}"><i></i><div class="cal-line-main"><div><b>${esc(e.title)}</b>${e.amount && (e.sec === 'pay' || e.sec === 'expense') ? ` <span class="${e.sec === 'pay' ? 'up' : 'down'}">${e.sec === 'pay' ? '+' : '−'}${fmt.money(e.amount, 2)}</span>` : ''}</div>
      <div class="muted tiny">${esc(s.label)}${e.unit ? ' · ' + esc(unitName(e.unit)) : ''}${e.detail ? ' · ' + esc(e.detail) : ''}</div></div>${e.item ? `<button class="btn ghost small" data-item="${e.item.id}">Edit</button>` : ''}</div>`;
  }

  App.modules.calendar = {
    SECTIONS, occurrences,
    async render(view) {
      const t = P().today();
      month = month || t.slice(0, 7);
      const [y, m] = month.split('-').map(Number);
      const first = new Date(y, m - 1, 1, 12), last = new Date(y, m, 0, 12);
      const ws = App.settings.get('calendar.weekStart', 0); // Sunday-first like a wall calendar
      const gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() - ws + 7) % 7));
      const gridEnd = new Date(last); gridEnd.setDate(last.getDate() + ((ws + 6 - last.getDay() + 7) % 7));
      const from = iso(gridStart), to = iso(gridEnd);
      const soonTo = iso(new Date(parse(t).getTime() + 30 * 864e5));
      view.innerHTML = `<div class="card cal-bar">
          <div class="row"><button class="btn small" id="calPrev" aria-label="Previous month">‹</button><h2 class="cal-title">${P().MON[m - 1]} ${y}</h2><button class="btn small" id="calNext" aria-label="Next month">›</button><button class="btn small ghost" id="calToday">Today</button></div>
          <div class="row"><div class="seg" role="tablist" aria-label="Show units">${[['all', 'Business + personal'], ['business', 'Business'], ['individual', 'Personal']].map(([k, l]) => `<button data-kf="${k}" class="${kindFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
            <button class="btn" id="calPay">${App.fx.icon('plus')} Pay date</button><button class="btn primary" id="calExp">${App.fx.icon('plus')} Expense</button></div>
        </div><div id="calOut">${App.fx.skeleton ? App.fx.skeleton(2) : ''}</div>`;
      const rerender = () => App.go('calendar');
      view.querySelector('#calPrev').onclick = () => { month = iso(new Date(y, m - 2, 1, 12)).slice(0, 7); rerender(); };
      view.querySelector('#calNext').onclick = () => { month = iso(new Date(y, m, 1, 12)).slice(0, 7); rerender(); };
      view.querySelector('#calToday').onclick = () => { month = t.slice(0, 7); rerender(); };
      view.querySelectorAll('[data-kf]').forEach(b => b.onclick = () => { kindFilter = b.dataset.kf; rerender(); });
      view.querySelector('#calPay').onclick = () => editItem({ type: 'pay', freq: 'biweekly', start: t }, rerender);
      view.querySelector('#calExp').onclick = () => editItem({ type: 'expense', freq: 'monthly', start: t }, rerender);

      const hid = hidden();
      const all = [...await additions(from, to < soonTo ? soonTo : to), ...scheduled(from, to < soonTo ? soonTo : to)];
      const sugg = await suggestions();
      const out = view.querySelector('#calOut');
      if (!out?.isConnected) return;
      const shown = all.filter(e => !hid.has(e.sec));
      const byDay = new Map();
      for (const e of shown) { if (e.date < from || e.date > to) continue; (byDay.get(e.date) || byDay.set(e.date, []).get(e.date)).push(e); }
      const order = Object.keys(SECTIONS);
      for (const l of byDay.values()) l.sort((a, b) => order.indexOf(a.sec) - order.indexOf(b.sec));
      const days = [];
      for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) days.push(iso(d));
      const wk = Array.from({ length: 7 }, (_, i) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(ws + i) % 7]);
      const inMonth = shown.filter(e => e.date.slice(0, 7) === month);
      const money = sec => App.sum(inMonth.filter(e => e.sec === sec).map(e => +e.amount || 0));
      const upcoming = shown.filter(e => (e.sec === 'pay' || e.sec === 'expense' || e.sec === 'filings') && e.date >= t && e.date <= soonTo).sort((a, b) => a.date.localeCompare(b.date));
      const counts = {}; all.filter(e => e.date.slice(0, 7) === month).forEach(e => counts[e.sec] = (counts[e.sec] || 0) + 1);

      out.innerHTML = `<div class="cal-legend card">${Object.entries(SECTIONS).map(([k, s]) => `<button class="cal-key ${hid.has(k) ? 'off' : ''}" data-sec="${k}" style="--c:${s.color}" aria-pressed="${!hid.has(k)}"><i></i>${s.label}${counts[k] ? ` <span class="muted">${counts[k]}</span>` : ''}</button>`).join('')}</div>
        <div class="cal-layout">
          <div class="card cal-card"><div class="cal-grid" role="grid">
            ${wk.map(w => `<div class="cal-wd">${w}</div>`).join('')}
            ${days.map(k => { const l = byDay.get(k) || []; return `<button class="cal-day ${k.slice(0, 7) !== month ? 'out' : ''} ${k === t ? 'today' : ''}" data-day="${k}" aria-label="${esc(fmt.date(k))}: ${l.length} item${l.length === 1 ? '' : 's'}">
              <span class="cal-n">${+k.slice(8)}</span>
              <span class="cal-chips">${l.slice(0, 3).map(chip).join('')}${l.length > 3 ? `<span class="cal-more">+${l.length - 3} more</span>` : ''}</span>
              <span class="cal-dots">${l.slice(0, 6).map(e => `<i style="--c:${SECTIONS[e.sec].color}"></i>`).join('')}</span></button>`; }).join('')}
          </div></div>
          <div class="stack cal-side">
            <div class="card"><div class="card-head"><h2>${P().MON[m - 1]} money</h2></div>
              <div class="cal-money"><div><span class="muted tiny">Pay coming in</span><b class="up">${fmt.money(money('pay'))}</b></div><div><span class="muted tiny">Expenses going out</span><b class="down">${fmt.money(money('expense'))}</b></div><div><span class="muted tiny">Difference</span><b>${fmt.money(money('pay') - money('expense'))}</b></div></div>
              <div class="muted tiny" style="margin-top:8px">From the pay dates and expenses you've added.</div></div>
            <div class="card"><div class="card-head"><h2>Next 30 days</h2></div>${upcoming.length ? upcoming.slice(0, 14).map(e => `<div class="cal-up"><span class="cal-date">${esc(fmt.date(e.date))}</span>${line(e)}</div>`).join('') : '<div class="muted small">No pay dates or expenses coming up. Add them with the buttons above.</div>'}</div>
            ${sugg.length ? `<div class="card"><div class="card-head"><h2>Found in your data</h2><span class="muted tiny">repeats every month</span></div>${sugg.map((s, i) => `<div class="cal-sug"><div><b>${esc(s.title)}</b> <span class="${s.type === 'pay' ? 'up' : 'down'}">${fmt.money(s.amount, 2)}</span><div class="muted tiny">${s.type === 'pay' ? 'Pay date' : 'Expense'} around the ${ord(+s.start.slice(8))} · ${s.months} months in ${esc(s.from)}</div></div><button class="btn small" data-sug="${i}">Add</button></div>`).join('')}</div>` : ''}
          </div>
        </div>`;
      out.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { const h = hidden(); h.has(b.dataset.sec) ? h.delete(b.dataset.sec) : h.add(b.dataset.sec); App.settings.set('calendar.hidden', [...h]); rerender(); });
      out.querySelectorAll('[data-sug]').forEach(b => b.onclick = () => { const s = sugg[+b.dataset.sug]; editItem({ type: s.type, title: s.title, amount: s.amount, freq: s.freq, start: s.start, unit: s.unit, note: `found in ${s.from}` }, rerender); });
      const bindEdit = root => root.querySelectorAll('[data-item]').forEach(b => b.onclick = () => editItem(items().find(i => i.id === b.dataset.item), rerender));
      bindEdit(out);
      out.querySelectorAll('[data-day]').forEach(b => b.onclick = () => {
        const k = b.dataset.day, l = all.filter(e => e.date === k && !hid.has(e.sec)).sort((a, c) => order.indexOf(a.sec) - order.indexOf(c.sec));
        App.ui.modal(`<div class="row spread"><h2>${esc(fmt.date(k))}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
          <div class="stack" style="margin-top:10px">${l.length ? l.map(line).join('') : '<div class="muted small">Nothing on this day.</div>'}</div>
          <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn small" id="dPay">${App.fx.icon('plus')} Pay date</button><button class="btn small primary" id="dExp">${App.fx.icon('plus')} Expense</button></div>`, (c, close) => {
          bindEdit(c);
          c.querySelector('#dPay').onclick = () => { close(); editItem({ type: 'pay', freq: 'biweekly', start: k }, rerender); };
          c.querySelector('#dExp').onclick = () => { close(); editItem({ type: 'expense', freq: 'monthly', start: k }, rerender); };
        });
      });
    }
  };
})(window.App);
