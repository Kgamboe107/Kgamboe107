/* 1099 Work (personal units): contractor / side-gig income by client, expenses, mileage, and what to set aside for taxes.
   Rules used (2026): payers send a 1099-NEC / 1099-MISC once they've paid you $2,000+ in the year ($600 before 2026);
   payment apps send a 1099-K over $20,000 and 200 payments. All of it is taxable whether or not a form arrives.
   Self-employment tax = 15.3% of 92.35% of net profit (Social Security part up to the wage base). Business mileage:
   70¢ (2025), 72.5¢ (Jan–Jun 2026), 76¢ (Jul–Dec 2026). Estimates only, not tax advice. */
(function (App) {
  const { fmt, esc } = App;
  const P = () => App.period;
  const EXP = ['Supplies & materials', 'Software & subscriptions', 'Phone & internet (work share)', 'Equipment & tools', 'Advertising & marketing', 'Professional fees', 'Insurance', 'Travel', 'Meals (50% deductible)', 'Home office', 'Platform & payment fees', 'Education & training', 'Other'];
  const FORMS = { nec: '1099-NEC', k: '1099-K (payment app / marketplace)', misc: '1099-MISC', none: 'No form / not sure' };
  const SS_BASE = { 2025: 176100, 2026: 184500 };
  const mileRate = d => d >= '2026-07-01' ? 0.76 : d >= '2026-01-01' ? 0.725 : 0.70;
  let year = null;
  const all = async () => (await App.store.all('gigs').catch(() => [])).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const prefs = () => ({ fed: 0.22, state: 0.0323, ...App.bsettings.get('gigs.prefs', {}) });
  const formsGot = y => App.bsettings.get('gigs.forms.' + y, {});

  function summarize(list, y) {
    const paid = list.filter(r => r.kind === 'income' && r.status !== 'invoiced');
    const unpaid = list.filter(r => r.kind === 'income' && r.status === 'invoiced');
    const gross = App.sum(paid.map(r => +r.amount || 0));
    const exp = list.filter(r => r.kind === 'expense'), miles = list.filter(r => r.kind === 'mileage');
    const expTotal = App.sum(exp.map(r => (+r.amount || 0) * (/^Meals/.test(r.category) ? 0.5 : 1)));
    const mileDed = App.sum(miles.map(r => (+r.miles || 0) * mileRate(r.date)));
    const net = gross - expTotal - mileDed;
    const base = Math.max(0, net) * 0.9235;
    const se = net < 400 ? 0 : Math.min(base, SS_BASE[y] || SS_BASE[2026]) * 0.124 + base * 0.029; // no SE tax under $400 of profit
    const pr = prefs();
    const income = Math.max(0, net - se / 2) * (pr.fed + pr.state);
    const payers = {};
    for (const r of paid) { const k = r.payer || 'Unknown'; const p = payers[k] || (payers[k] = { name: k, total: 0, n: 0, form: r.form }); p.total += +r.amount || 0; p.n++; if (r.form && r.form !== 'none') p.form = r.form; }
    const threshold = y >= 2026 ? 2000 : 600;
    Object.values(payers).forEach(p => { p.expect = p.form === 'k' ? (p.total > 20000 && p.n >= 200 ? '1099-K expected' : 'no 1099-K unless over $20,000 and 200 payments') : p.total >= threshold ? `${p.form === 'misc' ? '1099-MISC' : '1099-NEC'} expected by Jan 31` : `under ${fmt.money(threshold)}: no form expected (still taxable)`; p.due = p.form !== 'k' && p.total >= threshold; });
    const cats = {}; exp.forEach(r => cats[r.category || 'Other'] = (cats[r.category || 'Other'] || 0) + (+r.amount || 0));
    // Estimated-tax quarters: income earned Jan–Mar, Apr–May, Jun–Aug, Sep–Dec
    const Q = [['Q1', `${y}-01-01`, `${y}-03-31`, `${y}-04-15`], ['Q2', `${y}-04-01`, `${y}-05-31`, `${y}-06-15`], ['Q3', `${y}-06-01`, `${y}-08-31`, `${y}-09-15`], ['Q4', `${y}-09-01`, `${y}-12-31`, `${y + 1}-01-15`]];
    const rate = net > 0 ? (se + income) / net : 0;
    const quarters = Q.map(([q, f, t, due]) => {
      const inQ = list.filter(r => r.date >= f && r.date <= t);
      const n = App.sum(inQ.filter(r => r.kind === 'income' && r.status !== 'invoiced').map(r => +r.amount || 0)) - App.sum(inQ.filter(r => r.kind === 'expense').map(r => (+r.amount || 0) * (/^Meals/.test(r.category) ? 0.5 : 1))) - App.sum(inQ.filter(r => r.kind === 'mileage').map(r => (+r.miles || 0) * mileRate(r.date)));
      return { q, from: f, to: t, due, net: n, pay: Math.max(0, n * rate) };
    });
    return { gross, unpaid: App.sum(unpaid.map(r => +r.amount || 0)), unpaidN: unpaid.length, expTotal, mileDed, miles: App.sum(miles.map(r => +r.miles || 0)), net, se, income, setAside: se + income, rate, payers: Object.values(payers).sort((a, b) => b.total - a.total), threshold, cats, quarters };
  }

  async function editor(rec, kind, file, onSaved) {
    const r = { id: App.uid(), kind: kind || 'income', date: P().today(), payer: '', description: '', amount: '', status: 'paid', form: 'nec', category: 'Supplies & materials', miles: '', note: '', ...rec };
    const k = r.kind;
    let preview = file && /^image\//.test(file.type) ? URL.createObjectURL(file) : r.attachment?.blob && /^image\//.test(r.attachment.type) ? URL.createObjectURL(r.attachment.blob) : '';
    const payers = [...new Set((await all()).filter(x => x.payer).map(x => x.payer))];
    const title = { income: 'Payment / job', expense: 'Work expense', mileage: 'Work mileage' }[k];
    App.ui.modal(`<div class="row spread"><h2>${rec?.id ? 'Edit' : 'Add'} ${title.toLowerCase()}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-edit"><div class="sp-img">${preview ? `<img src="${preview}" alt="">` : `<div class="sp-noimg">${file || r.attachment ? '📄 attached' : k === 'income' ? 'Invoice / 1099 (optional)' : 'Receipt (optional)'}</div>`}
          <div class="sp-read muted tiny" id="wRead">${file ? 'Reading…' : ''}</div>
          <label class="btn small">${file || r.attachment ? 'Replace file' : 'Attach file'}<input type="file" id="wAtt" accept="image/*,application/pdf,.pdf" hidden></label></div>
        <div class="sp-form">
          ${k !== 'mileage' ? `<label class="field">${k === 'income' ? 'Client / payer' : 'Store / vendor'}<input id="wPayer" list="wPayers" value="${esc(r.payer)}" placeholder="${k === 'income' ? 'e.g. Acme Corp, DoorDash, Upwork' : 'e.g. Staples'}"><datalist id="wPayers">${payers.map(p => `<option value="${esc(p)}">`).join('')}</datalist></label>` : ''}
          <label class="field">${k === 'mileage' ? 'Trip (from → to, purpose)' : 'What it was for'}<input id="wDesc" value="${esc(r.description)}" placeholder="${k === 'income' ? 'e.g. Website redesign, invoice #14' : k === 'mileage' ? 'e.g. Home → client site, install' : 'e.g. printer ink'}"></label>
          <div class="sp-two"><label class="field">Date<input id="wDate" type="date" value="${esc(r.date)}"></label>
            ${k === 'mileage' ? `<label class="field">Miles<input id="wMiles" type="number" step="0.1" inputmode="decimal" value="${esc(r.miles)}"></label>` : `<label class="field">Amount ($)<input id="wAmt" type="number" step="0.01" inputmode="decimal" value="${r.amount === '' ? '' : esc(r.amount)}"></label>`}</div>
          ${k === 'income' ? `<div class="sp-two"><label class="field">Status<select id="wStatus"><option value="paid" ${r.status !== 'invoiced' ? 'selected' : ''}>Paid</option><option value="invoiced" ${r.status === 'invoiced' ? 'selected' : ''}>Invoiced, not paid yet</option></select></label>
            <label class="field">Form they'll send<select id="wForm">${Object.entries(FORMS).map(([v, l]) => `<option value="${v}" ${v === r.form ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>` : ''}
          ${k === 'expense' ? `<label class="field">Category<select id="wCat">${EXP.map(c => `<option ${c === r.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` : ''}
          ${k === 'mileage' ? `<div class="muted tiny" id="wMileNote"></div>` : ''}
          <label class="field">Note<input id="wNote" value="${esc(r.note)}"></label>
        </div></div>
      <div class="row" style="justify-content:space-between;margin-top:14px">${rec?.id ? '<button class="btn danger" id="wDel">Delete</button>' : '<span></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="wSave">Save</button></div></div>`, (c, close) => {
      const $ = s => c.querySelector(s);
      const mn = () => { const m = $('#wMileNote'); if (m) m.textContent = `Deduction at ${Math.round(mileRate($('#wDate').value) * 1000) / 10}¢/mile: ${fmt.money((+$('#wMiles').value || 0) * mileRate($('#wDate').value), 2)}`; };
      if (k === 'mileage') { $('#wMiles').oninput = mn; $('#wDate').onchange = mn; mn(); }
      const read = f => App.spending.readFile(f, pr => { const el = $('#wRead'); if (el) el.textContent = `Reading… ${Math.round(pr * 100)}%`; }).then(({ text }) => {
        const p = App.spending.parseText(text);
        if (p.merchant && $('#wPayer') && !$('#wPayer').value) $('#wPayer').value = p.merchant;
        if (p.date) $('#wDate').value = p.date;
        if (p.total && $('#wAmt') && !$('#wAmt').value) $('#wAmt').value = p.total.toFixed(2);
        if (k === 'income' && /1099-?nec|nonemployee compensation/i.test(text)) $('#wForm').value = 'nec';
        $('#wRead').textContent = 'Filled in what could be read. Check it, then save.';
      }).catch(() => { $('#wRead').textContent = 'Couldn’t read it automatically; type the details.'; });
      if (file) read(file);
      $('#wAtt').onchange = async e => { const f = await App.spending.shrink(e.target.files[0]); if (!f) return; file = f; if (/^image\//.test(f.type)) { preview = URL.createObjectURL(f); c.querySelector('.sp-img').firstElementChild.outerHTML = `<img src="${preview}" alt="">`; } read(f); };
      $('#wSave').onclick = async () => {
        const amt = parseFloat($('#wAmt')?.value), miles = parseFloat($('#wMiles')?.value);
        if (k === 'mileage' ? !Number.isFinite(miles) : !Number.isFinite(amt)) { App.ui.toast(k === 'mileage' ? 'Enter the miles' : 'Enter the amount'); return; }
        if (k === 'income' && !$('#wPayer').value.trim()) { App.ui.toast('Enter who paid you'); return; }
        const out = { ...r, businessId: rec?.businessId || App.biz.target(), date: $('#wDate').value || P().today(), payer: $('#wPayer')?.value.trim() || '', description: $('#wDesc').value.trim(), note: $('#wNote').value.trim(),
          amount: k === 'mileage' ? '' : Math.round(amt * 100) / 100, miles: k === 'mileage' ? miles : '', status: $('#wStatus')?.value || r.status, form: $('#wForm')?.value || r.form, category: $('#wCat')?.value || r.category, updated: Date.now(), createdAt: r.createdAt || Date.now() };
        if (file) out.attachment = { name: file.name || 'file', type: file.type, blob: file };
        await App.store.put('gigs', out); close(); App.ui.toast('Saved'); onSaved?.();
      };
      $('#wDel')?.addEventListener('click', async () => { await App.store.del('gigs', r.id); close(); onSaved?.(); });
    });
  }

  App.modules.gigs = {
    summarize, mileRate,
    async render(view) {
      year = year || new Date().getFullYear();
      const recs = (await all()).filter(r => (r.date || '').startsWith(String(year)));
      const s = summarize(recs, year), pr = prefs(), got = formsGot(year), t = P().today();
      App.ui.publish('gigs', { gross: s.gross, net: s.net, setAside: s.setAside, unpaid: s.unpaid, year, payers: s.payers.length });
      const kindIco = { income: '$', expense: '−', mileage: '🚗' };
      view.innerHTML = `<div class="card sp-hero"><div><h2>1099 work</h2><div class="muted small">Track freelance, contract and gig income by client, plus work expenses and mileage. See your Schedule C profit, which 1099s to expect, and what to set aside for taxes.</div></div>
          <div class="sp-actions"><button class="btn primary" id="wInc">${App.fx.icon('plus')} Payment / job</button><button class="btn" id="wExp">${App.fx.icon('plus')} Expense</button><button class="btn" id="wMile">${App.fx.icon('plus')} Mileage</button>
            <label class="btn ghost">Snap a receipt<input type="file" id="wCam" accept="image/*,application/pdf,.pdf" capture="environment" hidden></label></div></div>
        <div class="card sp-bar"><div class="row"><button class="btn small" id="wPrev" aria-label="Previous year">‹</button><b class="sp-month">${year} tax year</b><button class="btn small" id="wNext" aria-label="Next year" ${year >= new Date().getFullYear() ? 'disabled' : ''}>›</button></div>
          <div class="row"><button class="btn small" id="wCsv" ${recs.length ? '' : 'disabled'}>${App.fx.icon('download')} Schedule C export</button></div></div>
        <div class="grid k4">
          ${App.ui.kpi('1099 income (paid)', fmt.money(s.gross, 2), `${s.payers.length} client${s.payers.length === 1 ? '' : 's'}${s.unpaidN ? ` · ${fmt.money(s.unpaid)} unpaid` : ''}`)}
          ${App.ui.kpi('Expenses & mileage', fmt.money(s.expTotal + s.mileDed, 2), `${fmt.money(s.expTotal)} expenses · ${fmt.num(s.miles, 0)} mi`)}
          ${App.ui.kpi('Net profit (Schedule C)', fmt.money(s.net, 2), 'income − expenses − mileage', s.net >= 0 ? 'good' : 'bad')}
          ${App.ui.kpi('Set aside for taxes', fmt.money(s.setAside, 2), s.net > 0 ? `≈ ${Math.round(s.rate * 100)}% of profit · SE tax ${fmt.money(s.se)}` : 'no profit yet', s.setAside ? 'warn' : '')}
        </div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Clients &amp; 1099 forms</h2><span class="muted tiny">${year >= 2026 ? '1099-NEC at $2,000+' : '1099-NEC at $600+'}</span></div>
            ${s.payers.length ? s.payers.map(p => `<div class="pl-biz"><div><b>${esc(p.name)}</b><div class="muted tiny">${esc(p.expect)}</div></div><div class="row" style="gap:8px"><b>${fmt.money(p.total, 2)}</b>${p.due ? `<label class="row tiny"><input type="checkbox" data-form="${esc(p.name)}" ${got[p.name] ? 'checked' : ''}> received</label>` : ''}</div></div>`).join('')
              : '<div class="muted small">Add your first payment to see clients here.</div>'}</div>
          <div class="card"><div class="card-head"><h2>Estimated taxes</h2><span class="muted tiny">estimate, not tax advice</span></div>
            <div class="row" style="gap:10px;flex-wrap:wrap"><label class="field">Federal bracket<select id="wFed" data-native>${[0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37].map(r => `<option value="${r}" ${Math.abs(r - pr.fed) < 1e-6 ? 'selected' : ''}>${Math.round(r * 100)}%</option>`).join('')}</select></label>
              <label class="field">State income tax (%)<input id="wState" type="number" step="0.01" value="${+(pr.state * 100).toFixed(2)}" style="width:110px"></label></div>
            <div class="stack small" style="margin-top:10px">${s.quarters.map(q => `<div class="row spread est-row"><span><b>${q.q}</b> · earned ${esc(fmt.date(q.from))}–${esc(fmt.date(q.to))} · due ${esc(fmt.date(q.due))}${q.due < t && q.pay > 0 ? ' <span class="badge warn">due date passed</span>' : ''}</span><b>${fmt.money(q.pay)}</b></div>`).join('')}</div>
            <div class="muted tiny" style="margin-top:8px">Self-employment tax ${fmt.money(s.se)} + income tax ${fmt.money(s.income)} (after deducting half the SE tax). Record what you actually pay in <a href="#tax" data-go="tax">Taxes &amp; CPA</a>.</div></div>
        </div>
        ${Object.keys(s.cats).length ? `<div class="card"><div class="card-head"><h2>Expenses by category</h2></div>${Object.entries(s.cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="row spread small" style="padding:4px 0;border-bottom:1px solid var(--border)"><span>${esc(c)}</span><b>${fmt.money(v, 2)}</b></div>`).join('')}${s.mileDed ? `<div class="row spread small" style="padding:4px 0"><span>Car (mileage, ${fmt.num(s.miles, 1)} mi)</span><b>${fmt.money(s.mileDed, 2)}</b></div>` : ''}</div>` : ''}
        <div class="card"><div class="card-head"><h2>Entries</h2><span class="muted small">${recs.length} in ${year}</span></div>
          ${recs.length ? `<div class="sp-list">${recs.map(r => `<button class="sp-row" data-wid="${esc(r.id)}"><span class="sp-thumb">${r.attachment?.blob && /^image\//.test(r.attachment.type) ? `<img data-thumb="${esc(r.id)}" alt="">` : kindIco[r.kind]}</span>
            <span class="sp-main"><b>${esc(r.kind === 'mileage' ? (r.description || 'Mileage') : r.payer || r.description || '—')}</b><span class="muted tiny">${esc(fmt.date(r.date))} · ${r.kind === 'income' ? esc((FORMS[r.form] || '').split(' ')[0]) + (r.status === 'invoiced' ? ' · unpaid' : '') : r.kind === 'expense' ? esc(r.category) : `${r.miles} mi`}${r.description && r.kind !== 'mileage' ? ' · ' + esc(r.description) : ''}</span></span>
            <span class="sp-tag" style="--c:${r.kind === 'income' ? '#16a34a' : r.kind === 'expense' ? '#dc2626' : '#0891b2'}">${r.kind}</span><b class="sp-amt ${r.kind === 'income' ? 'up' : ''}">${r.kind === 'mileage' ? fmt.money((+r.miles || 0) * mileRate(r.date), 2) : (r.kind === 'expense' ? '−' : '') + fmt.money(r.amount, 2)}</b></button>`).join('')}</div>` : App.ui.empty('Nothing logged for ' + year + ' yet. Add a payment to start.')}</div>`;
      App.fx.hydrateIcons?.(view);
      const rerender = () => App.go('gigs');
      view.querySelector('#wInc').onclick = () => editor(null, 'income', null, rerender);
      view.querySelector('#wExp').onclick = () => editor(null, 'expense', null, rerender);
      view.querySelector('#wMile').onclick = () => editor(null, 'mileage', null, rerender);
      view.querySelector('#wCam').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) editor(null, 'expense', await App.spending.shrink(f), rerender); };
      view.querySelector('#wPrev').onclick = () => { year--; rerender(); };
      view.querySelector('#wNext').onclick = () => { year++; rerender(); };
      const saveP = () => { App.bsettings.set('gigs.prefs', { fed: +view.querySelector('#wFed').value, state: (+view.querySelector('#wState').value || 0) / 100 }); rerender(); };
      view.querySelector('#wFed').onchange = saveP; view.querySelector('#wState').onchange = saveP;
      view.querySelectorAll('[data-form]').forEach(c => c.onchange = () => App.bsettings.set('gigs.forms.' + year, { ...formsGot(year), [c.dataset.form]: c.checked }));
      view.querySelectorAll('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); App.go(a.dataset.go); });
      view.querySelector('#wCsv').onclick = () => {
        const sum = [{ Line: 'Gross receipts (1099 income paid)', Amount: s.gross.toFixed(2) }, ...Object.entries(s.cats).map(([c, v]) => ({ Line: 'Expense: ' + c + (/^Meals/.test(c) ? ' (50% deductible)' : ''), Amount: (-v * (/^Meals/.test(c) ? 0.5 : 1)).toFixed(2) })), { Line: `Car & truck: ${s.miles} miles at standard rate`, Amount: (-s.mileDed).toFixed(2) }, { Line: 'Net profit', Amount: s.net.toFixed(2) }, { Line: 'Estimated self-employment tax', Amount: s.se.toFixed(2) }];
        App.download(`1099-work-${year}.csv`, App.toCSV(['Line', 'Amount'], sum) + '\n\n' + App.toCSV(['Date', 'Type', 'Client / vendor', 'Description', 'Amount', 'Miles', 'Status', 'Form', 'Category', 'Note'], recs.map(r => ({ Date: r.date, Type: r.kind, 'Client / vendor': r.payer, Description: r.description, Amount: r.amount, Miles: r.miles, Status: r.status, Form: r.kind === 'income' ? FORMS[r.form] : '', Category: r.kind === 'expense' ? r.category : '', Note: r.note }))));
      };
      const allRecs = await all();
      view.querySelectorAll('[data-wid]').forEach(b => b.onclick = () => { const r = allRecs.find(x => x.id === b.dataset.wid); if (r) editor(r, r.kind, null, rerender); });
      view.querySelectorAll('[data-thumb]').forEach(img => { const r = recs.find(x => x.id === img.dataset.thumb); if (r?.attachment?.blob) img.src = URL.createObjectURL(r.attachment.blob); });
    }
  };
  App.gigs = { all, summarize, FORMS };
})(window.App);
