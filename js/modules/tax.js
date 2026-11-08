/* Taxes & CPA (personal / family): document checklist built from your accounts and units, contributions vs IRS limits,
   realized gains, tax-loss harvesting candidates, estimated payments, and a CPA packet workbook.
   Organizer and estimates only: not tax advice. */
(function (App) {
  const { fmt, esc } = App;
  const W = () => App.wealth;
  const money = v => fmt.money(v);
  let year = null;

  const defaultYear = () => { const d = new Date(); return d.getMonth() < 4 ? d.getFullYear() - 1 : d.getFullYear(); };
  const key = (k) => `tax.${k}.${year}`;
  const nextBiz = d => { const x = new Date(d + 'T12:00'); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };

  /* Documents your CPA will ask for, built from members, accounts and personal units */
  function checklist(list, units, extra = {}) {
    const items = [];
    const add = (id, owner, label, why, optional = false) => { if (!items.some(i => i.id === id)) items.push({ id, owner, label, why, optional }); };
    for (const m of W().members()) {
      if (m.role === 'self' || m.role === 'spouse') add(`w2-${m.id}`, m.id, `${m.name}: W-2 from each employer`, 'Wages and withholding', false);
      if (m.role === 'child') add(`child-${m.id}`, m.id, `${m.name}: childcare provider name, address, tax ID and amount paid`, 'Child & dependent care credit (under 13)', true);
    }
    const inst = a => a.institution || a.name;
    for (const a of list) {
      const o = a.owner;
      if (a.type === 'brokerage' || a.type === 'crypto') add(`1099b-${inst(a)}-${o}`, o, `Consolidated 1099 (1099-B / DIV / INT) from ${inst(a)}`, 'Sales, dividends and interest');
      if (a.type === 'savings' || a.type === 'checking') add(`1099int-${inst(a)}`, o, `1099-INT from ${inst(a)} (if it paid $10+ interest)`, 'Interest income', true);
      if (a.type === 'k401' || a.type === 'ira' || a.type === 'roth') add(`5498-${inst(a)}-${o}`, o, `Form 5498 / year-end statement from ${inst(a)}; 1099-R if money was taken out`, 'Contributions, rollovers and withdrawals', true);
      if (a.type === 'hsa') add(`hsa-${inst(a)}-${o}`, o, `HSA forms 5498-SA and 1099-SA from ${inst(a)}`, 'HSA contributions and spending (Form 8889)');
      if (a.type === 'edu') add(`529-${inst(a)}`, o, `1099-Q from ${inst(a)} (if you withdrew)`, 'Education withdrawals', true);
      if (a.type === 'mortgage') add(`1098-${inst(a)}`, o, `Form 1098 mortgage interest from ${inst(a)}`, 'Mortgage interest deduction');
      if (a.type === 'student') add(`1098e-${inst(a)}`, o, `Form 1098-E student loan interest from ${inst(a)}`, 'Student loan interest deduction');
      if (a.type === 'home') add(`proptax-${a.id}`, o, `Property tax bill / statement for ${a.name}`, 'State & local tax deduction (SALT)');
    }
    for (const u of units) {
      if (u.type === 'freelance') add(`sched-c-${u.id}`, u.owner || 'joint', `${u.name}: 1099-NEC / 1099-K forms and a year-end income & expense summary`, 'Self-employment income (Schedule C) and estimated taxes');
      if (u.type === 'rental') add(`sched-e-${u.id}`, u.owner || 'joint', `${u.name}: rents received, expenses, 1098 and property tax`, 'Rental income (Schedule E) and depreciation');
      if (u.type === 'investing' && !list.some(a => a.unit.id === u.id)) add(`1099b-${u.id}`, u.owner || 'joint', `${u.name}: consolidated 1099 from the brokerage`, 'Trades and dividends');
    }
    add('prior', 'joint', `Last year's tax return (federal and state)`, 'Carryovers and a starting point');
    add('est', 'joint', `Estimated tax payments you made for ${year} (dates and amounts)`, 'Credits against what you owe', true);
    if (extra.giving?.length) {
      for (const n of App.giving.needs(extra.giving)) add('give-' + (n.g?.id || n.text.slice(0, 20)), n.g?.person || 'joint', n.text, 'Charitable deduction paperwork');
      add('charity', 'joint', `Donation records: ${extra.giving.length} gifts logged in Giving (${fmt.money(App.sum(extra.giving.map(App.giving.valueOf)))})`, 'Charitable deduction (CPA packet has the list)', true);
    } else add('charity', 'joint', 'Charitable donation receipts (cash and items)', 'Itemized deductions', true);
    for (const p of extra.gigs?.payers || []) add('gig-' + p.name, 'joint', p.due ? `${p.form === 'misc' ? '1099-MISC' : '1099-NEC'} from ${p.name} (paid you ${fmt.money(p.total)})` : `Payment records from ${p.name} (${fmt.money(p.total)}; ${p.expect})`, 'Self-employment income (Schedule C)', !p.due);
    if (extra.gigs?.gross) add('gig-sum', 'joint', `1099 work summary: income ${fmt.money(extra.gigs.gross)}, expenses & mileage ${fmt.money(extra.gigs.expTotal + extra.gigs.mileDed)}, net ${fmt.money(extra.gigs.net)}`, 'Schedule C and self-employment tax (CPA packet has the detail)');
    add('1095a', 'joint', 'Form 1095-A if you had Marketplace health insurance', 'Premium tax credit', true);
    add('ids', 'joint', 'Photo ID, Social Security numbers and bank info for the refund', 'Needed to file', false);
    for (const c of App.settings.get(key('custom'), [])) add(c.id, c.owner || 'joint', c.label, 'Added by you', false);
    return items;
  }

  const ageAtYearEnd = m => (m?.birthYear ? year - +m.birthYear : NaN);

  App.modules.tax = {
    async render(view) {
      year = year || defaultYear();
      const rerender = () => App.go('tax');
      const list = await W().collect();
      const s = W().summarize(list);
      const p = W().person();
      const units = App.biz.inView().filter(b => App.biz.kindOf(b) === 'individual');
      const docs = App.settings.get(key('docs'), {});
      const contrib = App.settings.get(key('contrib'), {});
      const est = App.settings.get(key('est'), {});
      const L = W().limits(year);
      const giv = (await App.giving.all()).filter(g => (g.date || '').startsWith(String(year)));
      const gigRecs = (await App.gigs.all()).filter(g => (g.date || '').startsWith(String(year)));
      const gigS = gigRecs.length ? App.gigs.summarize(gigRecs, year) : null;
      const all = checklist(list, units, { giving: giv, gigs: gigS }).filter(i => p === 'all' || i.owner === p || i.owner === 'joint');
      const got = all.filter(i => docs[i.id]?.done).length;
      // Realized gains from the trade history of personal units (Trading Risk), as last computed
      let realized = 0, realizedUnits = 0;
      for (const u of units) {
        const k = App.settings.get(`b.${u.id}.kpis`, {})?.['trading-perf'];
        // Only a real trade history counts (it has trade dates); a positions file read as trades doesn't
        const mp = App.settings.get(`b.${u.id}.map.trade-hist`, {});
        if (k && typeof k.total === 'number' && mp.map?.date) { realized += k.total; realizedUnits++; }
      }
      const harvest = W().harvestable(s.holdings);
      const loss = harvest.reduce((a, h) => a + h.upl, 0);
      const people = W().members().filter(m => p === 'all' || m.id === p);
      const roomOf = m => {
        const c = contrib[m.id] || {}, age = ageAtYearEnd(m);
        const k401Lim = L.k401 + (age >= 60 && age <= 63 ? L.k401CatchUp60 : age >= 50 ? L.k401CatchUp50 : 0);
        const iraLim = L.ira + (age >= 50 ? L.iraCatchUp50 : 0);
        const hsaLim = (c.hsaCov === 'family' ? L.hsaFamily : L.hsaSelf) + (age >= 55 ? L.hsaCatchUp55 : 0);
        return { c, age, rows: [['k401', '401(k) / 403(b) employee deferrals', k401Lim], ['ira', 'IRA (traditional + Roth combined)', iraLim], ['hsa', `HSA (${c.hsaCov === 'family' ? 'family' : 'self-only'} coverage)`, hsaLim]] };
      };
      const room = people.reduce((t, m) => t + roomOf(m).rows.reduce((a, [k, , lim]) => a + Math.max(0, lim - (+roomOf(m).c[k] || 0)), 0), 0);
      const hasSE = units.some(u => u.type === 'freelance' || u.type === 'rental');
      const quarters = [[`${year}-04-15`, 'Q1'], [`${year}-06-15`, 'Q2'], [`${year}-09-15`, 'Q3'], [`${year + 1}-01-15`, 'Q4']].map(([d, q]) => ({ q, due: nextBiz(d) }));

      view.innerHTML = `
        <div class="card stack" style="gap:14px">
          <div class="row spread"><div><h2>Taxes &amp; CPA</h2><div class="muted small">Everything your CPA will ask for, built from your accounts and units. ${p === 'all' ? 'Whole family' : esc(W().memberName(p))} · tax year ${year}</div></div>
            <div class="row"><div class="seg" role="tablist">${[year - 1, year, year + 1].filter(y => y <= new Date().getFullYear() + 1).map(y => `<button data-year="${y}" class="${y === year ? 'on' : ''}">${y}</button>`).join('')}</div>
              <button class="btn primary" id="tPack">${App.fx.icon('download')} CPA packet (Excel)</button>
              <button class="btn" id="tAI">${App.fx.icon('sparkles')} Ask AI to review</button></div></div>
          ${App.modules.wealth.personBar()}
          <div class="alert small" style="background:var(--panel-2)">An organizer and estimates built from your own data, not tax advice. Your CPA and the actual forms are what count. Limits shown are the IRS figures for ${year}${L.note ? ` (${esc(L.note)})` : ''}.</div>
        </div>
        <div class="grid k4">
          ${App.ui.kpi('Documents gathered', `${got} of ${all.length}`, all.length - got ? `${all.length - got} still to collect` : 'ready for your CPA', got === all.length ? 'good' : 'warn', false)}
          ${App.ui.kpi('Realized gains', realizedUnits ? money(realized) : '—', realizedUnits ? 'from trade history in Trading Risk' : 'import trade history in Trading Risk', realized < 0 ? 'good' : '', false)}
          ${App.ui.kpi('Tax-loss candidates', harvest.length ? money(loss) : '$0', harvest.length ? `${harvest.length} taxable position${harvest.length === 1 ? '' : 's'} below cost` : 'none in taxable accounts', harvest.length ? 'warn' : '', false)}
          ${App.ui.kpi('Contribution room left', money(room), `401(k), IRA and HSA for ${year}`, '', false)}
        </div>
        <div class="card"><div class="card-head"><div><h2>CPA document checklist</h2><div class="muted small">Built from your family members, accounts and personal units. Tick items as they arrive and attach the PDF.</div></div>
          <button class="btn small" id="tAddDoc">+ Add item</button></div>
          <div class="stack doc-list">${all.map(i => { const d = docs[i.id] || {}; return `<div class="doc-row ${d.done ? 'done' : ''}">
            <label class="row" style="gap:10px;flex:1;min-width:0;flex-wrap:nowrap"><input type="checkbox" data-doc="${esc(i.id)}" ${d.done ? 'checked' : ''}><span style="min-width:0"><b class="small">${esc(i.label)}</b>${i.optional ? ' <span class="badge">if it applies</span>' : ''}<div class="muted tiny">${esc(i.why)} · ${esc(W().memberName(i.owner))}${d.fileName ? ` · ${esc(d.fileName)}` : ''}</div></span></label>
            <label class="btn small ghost">${d.fileId ? 'Replace' : 'Attach'}<input type="file" data-att="${esc(i.id)}" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx" hidden></label></div>`; }).join('')}</div></div>
        <div class="card"><div class="card-head"><div><h2>Retirement &amp; HSA contributions</h2><div class="muted small">Enter what each person put in for ${year} (from pay stubs or year-end statements). Catch-up amounts apply automatically from birth year.</div></div><button class="btn small" data-members>Family members</button></div>
          <div class="stack">${people.map(m => { const r = roomOf(m); return `<div class="contrib">
            <div class="row spread"><b>${esc(m.name)}</b><span class="muted tiny">${isNaN(r.age) ? 'Add a birth year for catch-up limits' : `age ${r.age} at year end${r.age >= 50 ? ' · catch-up eligible' : ''}`}</span></div>
            ${r.rows.map(([k, label, lim]) => { const v = +r.c[k] || 0, left = lim - v; return `<div class="contrib-row"><span class="small">${esc(label)}</span>
              <input type="number" step="1" min="0" data-ct="${m.id}:${k}" value="${r.c[k] ?? ''}" placeholder="0" aria-label="${esc(m.name)} ${esc(label)}">
              <span class="tb-bar"><i style="width:${Math.min(100, Math.round(v / lim * 100))}%;${v > lim ? 'background:var(--bad)' : ''}"></i></span>
              <span class="tiny ${left < 0 ? 'neg' : 'muted'}">${left < 0 ? `${money(-left)} over the ${money(lim)} limit` : `${money(left)} left of ${money(lim)}`}</span>
              ${k === 'hsa' ? `<select data-cov="${m.id}" data-native class="small">${App.ui.options([{ value: 'self', label: 'Self-only' }, { value: 'family', label: 'Family' }], r.c.hsaCov || 'self')}</select>` : '<span></span>'}</div>`; }).join('')}
          </div>`; }).join('')}</div>
          <div class="muted tiny" style="margin-top:8px">IRA contributions for ${year} can usually be made until the filing deadline in April ${year + 1}. Roth eligibility and IRA deductibility depend on income; your CPA will check.</div></div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Tax-loss harvesting candidates</h2><span class="muted small">taxable accounts only</span></div>
            ${harvest.length ? `<div class="stack">${harvest.slice(0, 10).map(h => `<div class="row spread small"><span><b>${esc(h.symbol)}</b> <span class="muted tiny">${esc(h.account)} · ${esc(W().memberName(h.owner))}</span></span><span class="neg"><b>${money(h.upl)}</b></span></div>`).join('')}</div>
              <div class="muted tiny" style="margin-top:8px">Selling at a loss can offset gains (plus up to $3,000 of income a year). Wash-sale rule: don't buy the same or a substantially identical investment within 30 days before or after, in any account (IRAs included). Talk it through with your CPA or advisor first.</div>`
              : `<div class="muted small">${s.holdings.length ? 'No taxable positions are below cost right now.' : 'Import brokerage positions on the Net Worth page to see candidates.'}</div>`}</div>
          <div class="card"><div class="card-head"><h2>Estimated tax payments</h2><span class="muted small">${hasSE ? 'you have side or rental income' : 'only if you have income without withholding'}</span></div>
            <div class="stack">${quarters.map(qq => { const e = est[qq.q] || {}; const late = !e.paid && qq.due < new Date().toISOString().slice(0, 10); return `<div class="row spread small est-row"><span><b>${qq.q}</b> due ${fmt.date(qq.due)}${late ? ' <span class="badge bad">past due</span>' : ''}</span>
              <span class="row" style="gap:6px"><input type="number" step="1" data-est="${qq.q}" value="${e.amount ?? ''}" placeholder="amount" style="width:110px" aria-label="${qq.q} amount"><label class="row tiny"><input type="checkbox" data-estp="${qq.q}" ${e.paid ? 'checked' : ''}> paid</label></span></div>`; }).join('')}</div>
            <div class="muted tiny" style="margin-top:8px">Pay at IRS Direct Pay or with your state. Dates move to the next business day when they land on a weekend; holidays can shift them too.</div></div>
        </div>`;

      const $ = q => view.querySelector(q);
      App.modules.wealth.wirePersonBar(view, rerender);
      view.querySelectorAll('[data-year]').forEach(b => b.onclick = () => { year = +b.dataset.year; rerender(); });
      const saveDocs = d => App.settings.set(key('docs'), d);
      view.querySelectorAll('[data-doc]').forEach(c => c.onchange = () => { const d = App.settings.get(key('docs'), {}); d[c.dataset.doc] = { ...(d[c.dataset.doc] || {}), done: c.checked }; saveDocs(d); c.closest('.doc-row').classList.toggle('done', c.checked); });
      view.querySelectorAll('[data-att]').forEach(inp => inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        const [r] = await App.ingest.ingestMany([f], { quiet: true, category: 'report', tags: ['Tax document', String(year)] });
        if (r) { const d = App.settings.get(key('docs'), {}); d[inp.dataset.att] = { ...(d[inp.dataset.att] || {}), done: true, fileId: r.id, fileName: r.name }; saveDocs(d); App.ui.toast('Attached and checked off'); rerender(); }
      });
      $('#tAddDoc').onclick = () => App.ui.modal(`<div class="card-head"><h2>Add a checklist item</h2><button class="btn small ghost" data-close>Cancel</button></div>
        <div class="stack"><label class="field">What to collect<input id="cdL" placeholder="e.g. K-1 from family LLC"></label>
        <label class="field">For<select id="cdO" data-native>${App.ui.options([...W().members().map(m => ({ value: m.id, label: m.name })), { value: 'joint', label: 'Joint / family' }], p === 'all' ? 'joint' : p)}</select></label>
        <div class="confirm-actions"><button class="btn primary" id="cdS">Add item</button></div></div>`, (card, close) => {
        card.querySelector('#cdS').onclick = () => { const label = card.querySelector('#cdL').value.trim(); if (!label) return; const c = App.settings.get(key('custom'), []); c.push({ id: 'c-' + App.uid(), label, owner: card.querySelector('#cdO').value }); App.settings.set(key('custom'), c); close(); rerender(); };
      });
      view.querySelectorAll('[data-ct]').forEach(inp => inp.onchange = () => { const [m, k] = inp.dataset.ct.split(':'); const c = App.settings.get(key('contrib'), {}); c[m] = { ...(c[m] || {}), [k]: inp.value === '' ? '' : +inp.value }; App.settings.set(key('contrib'), c); rerender(); });
      view.querySelectorAll('[data-cov]').forEach(sel => sel.onchange = () => { const c = App.settings.get(key('contrib'), {}); c[sel.dataset.cov] = { ...(c[sel.dataset.cov] || {}), hsaCov: sel.value }; App.settings.set(key('contrib'), c); rerender(); });
      const saveEst = () => { const e = {}; quarters.forEach(qq => { e[qq.q] = { amount: $(`[data-est="${qq.q}"]`).value === '' ? '' : +$(`[data-est="${qq.q}"]`).value, paid: $(`[data-estp="${qq.q}"]`).checked }; }); App.settings.set(key('est'), e); };
      view.querySelectorAll('[data-est],[data-estp]').forEach(i => i.onchange = saveEst);
      $('#tAI').onclick = () => App.go('ai', { newThread: true, send: true, prompt: `Review my ${year} family tax picture like a careful CPA would before filing. Using my accounts, contributions, realized gains and tax-loss candidates, list (1) documents I'm still missing, (2) contribution room I could still use, (3) tax-loss harvesting ideas with wash-sale cautions, and (4) questions to ask my CPA. Be specific with the numbers. Remind me this isn't tax advice.` });
      $('#tPack').onclick = () => packet({ giv, gigRecs, gigS, list, s, all, docs, contrib: App.settings.get(key('contrib'), {}), est: App.settings.get(key('est'), {}), people, roomOf, harvest, realized, realizedUnits, units });
    }
  };

  /* CPA packet: one workbook with every sheet a preparer asks for */
  function packet({ giv = [], gigRecs = [], gigS = null, list, s, all, docs, contrib, est, people, roomOf, harvest, realized, realizedUnits, units }) {
    const wb = XLSX.utils.book_new();
    const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'Nothing recorded' }]), name.slice(0, 31));
    const ye = `${year}-12-31`;
    const yearEnd = a => { const h = (a.history || []).filter(x => x.date <= ye).pop(); return h ? h.balance : ''; };
    add('Summary', [
      { Item: 'Tax year', Value: year }, { Item: 'Prepared', Value: new Date().toLocaleString() },
      { Item: 'Family members', Value: W().members().map(m => `${m.name}${m.birthYear ? ` (born ${m.birthYear})` : ''}`).join(', ') },
      { Item: 'Net worth (today)', Value: +s.net.toFixed(2) }, { Item: 'Invested assets', Value: +s.invested.toFixed(2) }, { Item: 'Debts', Value: +s.debts.toFixed(2) },
      { Item: 'Realized gains (trade history)', Value: realizedUnits ? +realized.toFixed(2) : 'not imported' },
      { Item: 'Documents gathered', Value: `${all.filter(i => docs[i.id]?.done).length} of ${all.length}` },
      { Item: 'Note', Value: 'Organizer built from the family’s own records. Figures are estimates; source documents govern.' }
    ]);
    add('Documents', all.map(i => ({ Item: i.label, For: W().memberName(i.owner), Why: i.why, Optional: i.optional ? 'If it applies' : '', Received: docs[i.id]?.done ? 'Yes' : 'No', File: docs[i.id]?.fileName || '' })));
    add('Accounts', list.map(a => ({ Account: a.name, Institution: a.institution || '', Type: W().TYPES[a.type]?.label, Owner: W().memberName(a.owner), Unit: a.unit.name, 'Tax treatment': W().TAX[a.tax] || '', [`Balance ${ye}`]: yearEnd(a), 'Balance today': a.signed, 'As of': a.asOf || '', 'Rate %': a.rate ?? '' })));
    add('Contributions', people.flatMap(m => roomOf(m).rows.map(([k, label, lim]) => ({ Person: m.name, Account: label, Contributed: +contrib[m.id]?.[k] || 0, Limit: lim, Remaining: lim - (+contrib[m.id]?.[k] || 0) }))));
    add('Holdings', s.holdings.map(h => ({ Account: h.account, Owner: W().memberName(h.owner), 'Tax treatment': W().TAX[h.tax] || '', Symbol: h.symbol, Description: h.name || '', Shares: isNaN(h.qty) ? '' : h.qty, Value: h.value, 'Cost basis': isNaN(h.cost) ? '' : h.cost, 'Unrealized gain/loss': isNaN(h.upl) ? '' : h.upl })));
    add('Tax-loss candidates', harvest.map(h => ({ Symbol: h.symbol, Account: h.account, Owner: W().memberName(h.owner), 'Unrealized loss': h.upl, Value: h.value })));
    add('Estimated payments', Object.entries(est).map(([q, e]) => ({ Quarter: q, Amount: e.amount ?? '', Paid: e.paid ? 'Yes' : 'No' })));
    add('Side income & rentals', units.filter(u => u.type === 'freelance' || u.type === 'rental').map(u => { const f = App.settings.get(`b.${u.id}.kpis`, {})?.finance || {}; return { Unit: u.name, Kind: App.biz.TEMPLATES[u.type]?.label, Owner: W().memberName(u.owner), Income: f.revenue ?? '', 'Net income': f.net ?? '' }; }));
    add('Donations', giv.map(g => ({ Date: g.date, Organization: g.org, EIN: g.ein || '', Type: App.giving.KINDS[g.kind], 'Amount / value': +App.giving.valueOf(g).toFixed(2), Miles: g.miles || '', 'Cost basis': g.basis || '', Items: g.items || '', 'Written acknowledgment': g.ack ? 'yes' : 'no', Appraisal: g.appraisal ? 'yes' : '', Note: g.note || '' })));
    add('1099 work', gigS ? [{ Line: 'Gross receipts', Amount: +gigS.gross.toFixed(2) }, ...Object.entries(gigS.cats).map(([c, v]) => ({ Line: 'Expense: ' + c, Amount: -(+v.toFixed(2)) })), { Line: `Mileage ${gigS.miles} mi (standard rate)`, Amount: -(+gigS.mileDed.toFixed(2)) }, { Line: 'Net profit', Amount: +gigS.net.toFixed(2) }, { Line: 'Estimated SE tax', Amount: +gigS.se.toFixed(2) },
      ...gigS.payers.map(p => ({ Line: `Client: ${p.name} (${p.expect})`, Amount: +p.total.toFixed(2) })), ...gigRecs.map(r => ({ Line: `${r.date} ${r.kind}: ${r.payer || ''} ${r.description || ''}`.trim(), Amount: r.kind === 'mileage' ? `${r.miles} mi` : (r.kind === 'expense' ? -r.amount : r.amount) }))] : []);
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    App.download(`CPA packet ${year}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    App.ui.toast('CPA packet downloaded');
  }
})(window.App);
