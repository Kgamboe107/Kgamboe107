/* Giving (personal units): charitable donations with receipts / acknowledgment letters, the IRS paperwork each gift
   needs, and an estimate of what's deductible. 2026 rules (One Big Beautiful Bill Act): non-itemizers can deduct up to
   $1,000 ($2,000 married filing jointly) of cash gifts to operating charities (not donor-advised funds); itemizers only
   deduct giving above 0.5% of AGI. Charity mileage is 14¢/mile. Estimates only, not tax advice. */
(function (App) {
  const { fmt, esc } = App;
  const P = () => App.period;
  const KINDS = { cash: 'Cash / check / card', noncash: 'Goods (clothes, furniture…)', stock: 'Stock or securities', vehicle: 'Vehicle', mileage: 'Volunteer mileage', daf: 'Donor-advised fund' };
  const CHARITY_MILE = 0.14;
  let year = null;
  const all = async () => (await App.store.all('giving').catch(() => [])).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const valueOf = g => g.kind === 'mileage' ? (+g.miles || 0) * CHARITY_MILE : +g.amount || 0;
  const people = () => { try { return App.wealth?.members?.() || []; } catch { return []; } };
  const prefs = () => ({ status: 'single', itemize: false, agi: '', ...App.bsettings.get('giving.prefs', {}) });

  /* Paperwork the IRS expects for each gift (and for the year) */
  function needs(list) {
    const out = [];
    for (const g of list) {
      const v = valueOf(g);
      if (g.kind !== 'mileage' && v >= 250 && !g.ack) out.push({ g, sev: 'warn', text: `Written acknowledgment from ${g.org} for ${fmt.money(v, 2)} (needed for any single gift of $250 or more, before you file)` });
      if (g.kind === 'vehicle' && v > 500) out.push({ g, sev: 'warn', text: `Form 1098-C from ${g.org} for the vehicle` });
      if ((g.kind === 'noncash' || g.kind === 'stock') && v > 5000 && !g.appraisal) out.push({ g, sev: 'bad', text: `Qualified appraisal for the ${KINDS[g.kind].toLowerCase()} given to ${g.org} (${fmt.money(v)}); Form 8283 Section B` });
    }
    const noncash = App.sum(list.filter(g => ['noncash', 'stock', 'vehicle'].includes(g.kind)).map(valueOf));
    if (noncash > 500) out.push({ sev: 'warn', text: `Form 8283 (non-cash gifts total ${fmt.money(noncash)}, over $500)` });
    return out;
  }
  function estimate(list, y, pr) {
    const cash = App.sum(list.filter(g => g.kind === 'cash' || g.kind === 'mileage').map(valueOf));
    const daf = App.sum(list.filter(g => g.kind === 'daf').map(valueOf));
    const other = App.sum(list.filter(g => !['cash', 'mileage', 'daf'].includes(g.kind)).map(valueOf));
    const total = cash + daf + other;
    if (y < 2026) return { total, cash, deductible: pr.itemize ? total : 0, note: pr.itemize ? 'Itemizing: gifts are deductible (generally up to 60% of AGI for cash).' : 'Before 2026, gifts are only deductible if you itemize.' };
    if (!pr.itemize) {
      const cap = pr.status === 'mfj' ? 2000 : 1000;
      return { total, cash, deductible: Math.min(cash, cap), cap, note: `Taking the standard deduction: up to ${fmt.money(cap)} of cash gifts to operating charities is deductible on top of it (gifts to donor-advised funds and non-cash gifts don't count).` };
    }
    const agi = +pr.agi || 0, floor = agi * 0.005;
    return { total, cash, floor, deductible: Math.max(0, total - floor), note: agi ? `Itemizing: only giving above 0.5% of AGI (${fmt.money(floor)}) counts. Cash is generally limited to 60% of AGI.` : 'Itemizing: enter your AGI to apply the 0.5% floor.' };
  }

  async function editor(rec, file, onSaved) {
    const r = { id: App.uid(), date: P().today(), org: '', ein: '', kind: 'cash', amount: '', miles: '', basis: '', method: 'Card', items: '', ack: false, appraisal: false, person: 'joint', note: '', ...rec };
    let preview = file && /^image\//.test(file.type) ? URL.createObjectURL(file) : r.attachment?.blob && /^image\//.test(r.attachment.type) ? URL.createObjectURL(r.attachment.blob) : '';
    const ppl = people();
    App.ui.modal(`<div class="row spread"><h2>${rec?.id ? 'Edit donation' : 'Add a donation'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-edit"><div class="sp-img">${preview ? `<img src="${preview}" alt="Receipt">` : `<div class="sp-noimg">${file || r.attachment ? '📄 receipt attached' : 'No receipt attached'}</div>`}
        <div class="sp-read muted tiny" id="gRead">${file ? 'Reading the receipt…' : ''}</div>
        <label class="btn small">${r.attachment || file ? 'Replace receipt' : 'Attach receipt / letter'}<input type="file" id="gAtt" accept="image/*,application/pdf,.pdf" hidden></label></div>
      <div class="sp-form">
        <label class="field">Charity / organization<input id="gOrg" value="${esc(r.org)}" placeholder="e.g. Gleaners Food Bank"></label>
        <div class="sp-two"><label class="field">What you gave<select id="gKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field">Date<input id="gDate" type="date" value="${esc(r.date)}"></label></div>
        <div class="sp-two"><label class="field" id="gAmtL">Amount ($)<input id="gAmt" type="number" step="0.01" inputmode="decimal" value="${r.amount === '' ? '' : esc(r.amount)}"></label>
          <label class="field" id="gMilesL">Miles driven<input id="gMiles" type="number" step="0.1" inputmode="decimal" value="${esc(r.miles)}"></label>
          <label class="field" id="gBasisL">Your cost basis ($)<input id="gBasis" type="number" step="0.01" value="${esc(r.basis)}"></label>
          <label class="field" id="gMethL">Paid by<select id="gMeth">${['Card', 'Check', 'Cash', 'Bank transfer', 'Payroll deduction', 'Cash App / Venmo / PayPal'].map(m => `<option ${m === r.method ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
        <label class="field" id="gItemsL">Items and condition<input id="gItems" value="${esc(r.items)}" placeholder="e.g. 2 bags of clothes, good condition"></label>
        <div class="sp-two">${ppl.length ? `<label class="field">Who gave<select id="gWho"><option value="joint">Family / joint</option>${ppl.map(m => `<option value="${m.id}" ${m.id === r.person ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>` : ''}
          <label class="field">Charity's EIN (optional)<input id="gEin" value="${esc(r.ein)}" placeholder="12-3456789"></label></div>
        <label class="row small gv-check"><input type="checkbox" id="gAck" ${r.ack ? 'checked' : ''}> I have the charity's written acknowledgment (needed for gifts of $250+)</label>
        <label class="row small gv-check" id="gAppL"><input type="checkbox" id="gApp" ${r.appraisal ? 'checked' : ''}> I have a qualified appraisal (non-cash over $5,000)</label>
        <label class="field">Note<input id="gNote" value="${esc(r.note)}"></label>
      </div></div>
      <div class="row" style="justify-content:space-between;margin-top:14px">${rec?.id ? '<button class="btn danger" id="gDel">Delete</button>' : '<span></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="gSave">Save donation</button></div></div>`, (c, close) => {
      const $ = s => c.querySelector(s);
      const show = () => { const k = $('#gKind').value; $('#gAmtL').hidden = k === 'mileage'; $('#gMilesL').hidden = k !== 'mileage'; $('#gBasisL').hidden = k !== 'stock'; $('#gMethL').hidden = !['cash', 'daf'].includes(k); $('#gItemsL').hidden = !['noncash', 'vehicle', 'stock'].includes(k); $('#gAppL').hidden = !['noncash', 'stock'].includes(k); $('#gAmtL').firstChild.textContent = ['noncash', 'stock', 'vehicle'].includes(k) ? 'Fair market value ($)' : 'Amount ($)'; };
      $('#gKind').onchange = show; show();
      const read = f => App.spending.readFile(f, pr => { const el = $('#gRead'); if (el) el.textContent = `Reading… ${Math.round(pr * 100)}%`; }).then(({ text }) => {
        const p = App.spending.parseText(text);
        if (p.merchant && !$('#gOrg').value) $('#gOrg').value = p.merchant;
        if (p.date) $('#gDate').value = p.date;
        if (p.total && !$('#gAmt').value) $('#gAmt').value = p.total.toFixed(2);
        if (/acknowledg|no goods or services|tax[- ]deductible|501\(c\)/i.test(text)) $('#gAck').checked = true;
        const ein = text.match(/\b\d{2}-\d{7}\b/); if (ein && !$('#gEin').value) $('#gEin').value = ein[0];
        $('#gRead').textContent = 'Filled in what could be read. Check it, then save.';
      }).catch(() => { $('#gRead').textContent = 'Couldn’t read it automatically; type the details.'; });
      if (file) read(file);
      $('#gAtt').onchange = async e => { const f = await App.spending.shrink(e.target.files[0]); if (!f) return; file = f; if (/^image\//.test(f.type)) { preview = URL.createObjectURL(f); c.querySelector('.sp-img').firstElementChild.outerHTML = `<img src="${preview}" alt="Receipt">`; } read(f); };
      $('#gSave').onclick = async () => {
        const k = $('#gKind').value, amt = parseFloat($('#gAmt').value), miles = parseFloat($('#gMiles').value);
        if (!$('#gOrg').value.trim()) { App.ui.toast('Enter the charity'); return; }
        if (k === 'mileage' ? !Number.isFinite(miles) : !Number.isFinite(amt)) { App.ui.toast(k === 'mileage' ? 'Enter the miles' : 'Enter the amount'); return; }
        const out = { ...r, businessId: rec?.businessId || App.biz.target(), org: $('#gOrg').value.trim(), kind: k, date: $('#gDate').value || P().today(), amount: k === 'mileage' ? Math.round(miles * CHARITY_MILE * 100) / 100 : Math.round(amt * 100) / 100,
          miles: k === 'mileage' ? miles : '', basis: $('#gBasis').value === '' ? '' : +$('#gBasis').value, method: $('#gMeth').value, items: $('#gItems').value.trim(), ack: $('#gAck').checked, appraisal: $('#gApp').checked,
          person: $('#gWho')?.value || 'joint', ein: $('#gEin').value.trim(), note: $('#gNote').value.trim(), updated: Date.now(), createdAt: r.createdAt || Date.now() };
        if (file) out.attachment = { name: file.name || 'receipt', type: file.type, blob: file };
        await App.store.put('giving', out); close(); App.ui.toast(`Saved ${fmt.money(valueOf(out), 2)} to ${out.org}`); onSaved?.();
      };
      $('#gDel')?.addEventListener('click', async () => { await App.store.del('giving', r.id); close(); onSaved?.(); });
    });
  }

  App.modules.giving = {
    KINDS, needs, estimate, valueOf,
    async render(view) {
      year = year || new Date().getFullYear();
      const recs = (await all()).filter(g => (g.date || '').startsWith(String(year)));
      const pr = prefs(), est = estimate(recs, year, pr), todo = needs(recs);
      const byOrg = {}; recs.forEach(g => byOrg[g.org] = (byOrg[g.org] || 0) + valueOf(g));
      const orgs = Object.entries(byOrg).sort((a, b) => b[1] - a[1]);
      const ppl = people(), who = id => !id || id === 'joint' ? 'Family' : ppl.find(p => p.id === id)?.name || 'Family';
      App.ui.publish('giving', { total: est.total, count: recs.length, year, deductible: est.deductible, todo: todo.length });
      view.innerHTML = `<div class="card sp-hero"><div><h2>Charitable giving</h2><div class="muted small">Log donations of money, goods, stock and volunteer miles. Attach the receipt or thank-you letter and the app tracks the paperwork your CPA needs.</div></div>
          <div class="sp-actions"><button class="btn primary" id="gAdd">${App.fx.icon('plus')} Add a donation</button><label class="btn">Snap receipt / letter<input type="file" id="gCam" accept="image/*,application/pdf,.pdf" capture="environment" hidden></label></div></div>
        <div class="card sp-bar"><div class="row"><button class="btn small" id="gPrev" aria-label="Previous year">‹</button><b class="sp-month">${year} tax year</b><button class="btn small" id="gNext" aria-label="Next year" ${year >= new Date().getFullYear() ? 'disabled' : ''}>›</button></div>
          <div class="row"><button class="btn small" id="gCsv" ${recs.length ? '' : 'disabled'}>${App.fx.icon('download')} Export</button></div></div>
        <div class="grid k4">
          ${App.ui.kpi('Given in ' + year, fmt.money(est.total, 2), `${recs.length} gift${recs.length === 1 ? '' : 's'} · ${orgs.length} organization${orgs.length === 1 ? '' : 's'}`)}
          ${App.ui.kpi('Cash & mileage', fmt.money(est.cash, 2), 'money, card, check, miles')}
          ${App.ui.kpi('Estimated deductible', fmt.money(est.deductible, 2), pr.itemize ? 'itemizing' : 'standard deduction', est.deductible > 0 ? 'good' : '')}
          ${App.ui.kpi('Paperwork to get', fmt.num(todo.length), todo.length ? 'see the list below' : 'all set', todo.length ? 'warn' : 'good')}
        </div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Deduction estimate</h2><span class="muted tiny">estimate, not tax advice</span></div>
            <div class="row" style="gap:10px;flex-wrap:wrap"><label class="field">Filing status<select id="gSt" data-native><option value="single" ${pr.status === 'single' ? 'selected' : ''}>Single / head of household</option><option value="mfj" ${pr.status === 'mfj' ? 'selected' : ''}>Married filing jointly</option></select></label>
              <label class="field">Deduction<select id="gIt" data-native><option value="0" ${!pr.itemize ? 'selected' : ''}>Standard deduction</option><option value="1" ${pr.itemize ? 'selected' : ''}>Itemizing</option></select></label>
              <label class="field" ${pr.itemize ? '' : 'hidden'}>AGI ($)<input id="gAgi" type="number" step="100" value="${esc(pr.agi)}" style="width:130px"></label></div>
            <p class="small" style="margin:10px 0 0">${esc(est.note)}</p></div>
          <div class="card"><div class="card-head"><h2>Paperwork checklist</h2></div>${todo.length ? `<div class="stack">${todo.map(t => `<div class="alert ${t.sev} small">${esc(t.text)}${t.g ? ` <button class="linkish" data-gid="${esc(t.g.id)}">open</button>` : ''}</div>`).join('')}</div>` : '<div class="muted small">Nothing missing. Gifts of $250+ need the charity’s written acknowledgment; non-cash over $500 needs Form 8283; over $5,000 needs a qualified appraisal.</div>'}</div>
        </div>
        ${orgs.length ? `<div class="card"><div class="card-head"><h2>By organization</h2></div>${orgs.map(([o, v]) => `<div class="row spread small" style="padding:4px 0;border-bottom:1px solid var(--border)"><span>${esc(o)}</span><b>${fmt.money(v, 2)}</b></div>`).join('')}</div>` : ''}
        <div class="card"><div class="card-head"><h2>Donations</h2><span class="muted small">${recs.length} in ${year}</span></div>
          ${recs.length ? `<div class="sp-list">${recs.map(g => `<button class="sp-row" data-gid="${esc(g.id)}"><span class="sp-thumb">${g.attachment?.blob && /^image\//.test(g.attachment.type) ? `<img data-thumb="${esc(g.id)}" alt="">` : g.attachment ? '📄' : '♡'}</span>
            <span class="sp-main"><b>${esc(g.org)}</b><span class="muted tiny">${esc(fmt.date(g.date))} · ${esc(KINDS[g.kind] || '')}${g.kind === 'mileage' ? ` · ${g.miles} mi` : ''}${ppl.length ? ' · ' + esc(who(g.person)) : ''}${valueOf(g) >= 250 && g.kind !== 'mileage' ? (g.ack ? ' · ✓ acknowledgment' : ' · needs acknowledgment') : ''}</span></span>
            <span class="sp-tag" style="--c:#be185d">${esc(g.kind)}</span><b class="sp-amt">${fmt.money(valueOf(g), 2)}</b></button>`).join('')}</div>` : App.ui.empty('No donations logged for ' + year + ' yet.')}</div>`;
      App.fx.hydrateIcons?.(view);
      const rerender = () => App.go('giving');
      view.querySelector('#gAdd').onclick = () => editor(null, null, rerender);
      view.querySelector('#gCam').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) editor(null, await App.spending.shrink(f), rerender); };
      view.querySelector('#gPrev').onclick = () => { year--; rerender(); };
      view.querySelector('#gNext').onclick = () => { year++; rerender(); };
      const saveP = () => { App.bsettings.set('giving.prefs', { status: view.querySelector('#gSt').value, itemize: view.querySelector('#gIt').value === '1', agi: view.querySelector('#gAgi')?.value || '' }); rerender(); };
      ['#gSt', '#gIt', '#gAgi'].forEach(s => view.querySelector(s)?.addEventListener('change', saveP));
      view.querySelector('#gCsv').onclick = () => App.download(`donations-${year}.csv`, App.toCSV(['Date', 'Organization', 'EIN', 'Type', 'Amount / value', 'Miles', 'Cost basis', 'Items', 'Acknowledgment', 'Appraisal', 'Who', 'Note'],
        recs.map(g => ({ Date: g.date, Organization: g.org, EIN: g.ein, Type: KINDS[g.kind], 'Amount / value': valueOf(g).toFixed(2), Miles: g.miles, 'Cost basis': g.basis, Items: g.items, Acknowledgment: g.ack ? 'yes' : 'no', Appraisal: g.appraisal ? 'yes' : '', Who: who(g.person), Note: g.note }))));
      const allRecs = await all();
      view.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => { const g = allRecs.find(x => x.id === b.dataset.gid); if (g) editor(g, null, rerender); });
      view.querySelectorAll('[data-thumb]').forEach(img => { const g = recs.find(x => x.id === img.dataset.thumb); if (g?.attachment?.blob) img.src = URL.createObjectURL(g.attachment.blob); });
    }
  };
  App.giving = { all, needs, estimate, valueOf, KINDS };
})(window.App);
