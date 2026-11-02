/* Purchases: receipt entry (manual, pasted text, AI photo scan) → purchase journal → food cost % */
(function (App) {
  const { esc, fmt } = App;
  const PU = () => App.purchasing;
  let state = { period: null, vendor: '', q: '' };

  const all = async () => (await App.store.all('purchases')).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  /* Sales for the period: from the Operations sales mapping (uploaded or manual table), else typed in */
  async function salesFor(from, to, key) {
    let saved = App.bsettings.get('map.ops-sales', {});
    const manual = App.bsettings.get('pur.sales', {})[key];
    if (!saved.ds) {
      // No mapping chosen yet: find a daily sales table (uploaded or typed in) on our own
      const cands = (await App.store.datasets()).filter(d => !d.live && ['operations', 'financial'].includes(d.category));
      for (const d of cands) {
        const sales = App.findCol(d.headers, ['net sales', 'sales', 'gross sales']);
        const date = App.findCol(d.headers, ['business date', 'date', 'day']);
        if (sales && date && !/^month$/i.test(date)) { saved = { ds: d.id, map: { sales, date } }; break; }
      }
    }
    if (saved.ds && saved.map?.sales) {
      const d = await App.store.get('datasets', saved.ds);
      if (d) {
        let sum = 0, n = 0;
        for (const r of d.rows) {
          const dk = saved.map.date ? App.dateKey(r[saved.map.date]) : null;
          if (dk && (dk < from || dk > to)) continue;
          sum += App.n0(r[saved.map.sales]); n++;
        }
        if (n) return { sales: sum, source: d.name, auto: true };
      }
    }
    return { sales: manual ? +manual : NaN, source: 'entered manually', auto: false };
  }

  App.modules.purchases = {
    async render(view) {
      if (!state.period) state.period = 'all';
      const custom = App.bsettings.get('pur.custom', {});
      const [from, to, label] = PU().periodRange(state.period, custom);
      const purchases = await all();
      const inRange = purchases.filter(p => p.date >= from && p.date <= to);
      const list = inRange.filter(p => (!state.vendor || p.vendor === state.vendor) &&
        (!state.q || (p.vendor + ' ' + (p.ref || '') + ' ' + (p.notes || '') + ' ' + p.lines.map(l => l.item).join(' ')).toLowerCase().includes(state.q.toLowerCase())));
      const T = list.map(p => ({ p, t: PU().totals(p) }));
      const sum = f => App.sum(T.map(f));
      const business = sum(x => x.t.business), food = sum(x => x.t.food), bev = sum(x => x.t.bev);
      const supplies = sum(x => x.t.groups.supplies || 0), personal = sum(x => x.t.groups.excluded || 0), taxes = sum(x => x.t.tax);
      const owed = sum(x => x.p.reimburse ? x.t.business + x.t.tax * (x.t.sub ? x.t.business / x.t.sub : 1) : 0);
      const pkey = state.period === 'custom' ? `${from}_${to}` : `${state.period}:${from}`;
      const sales = await salesFor(from, to, pkey);
      const inv = App.bsettings.get('pur.inv', {})[pkey] || {};
      const cogs = (+inv.beg || 0) + food - (+inv.end || 0);
      const foodPct = sales.sales ? cogs / sales.sales : NaN;
      const target = App.bsettings.get('ops.targets', { food: 0.30 }).food || 0.30;
      const changes = PU().priceChanges(purchases);
      const ups = changes.filter(c => c.change >= 0.05);
      const mismatched = T.filter(x => x.p.total && Math.abs(x.t.diff) >= 0.02);

      const flags = [];
      if (foodPct > target) flags.push(['bad', `Food cost ${fmt.pct(foodPct)} is above your ${fmt.pct(target)} target for ${label.toLowerCase()}`]);
      ups.slice(0, 6).forEach(c => flags.push(['warn', `${c.item} went up ${fmt.pct(c.change)}: ${fmt.money(c.from, 2)} → ${fmt.money(c.to, 2)} per unit (${c.vendor}, ${c.date})`]));
      mismatched.slice(0, 4).forEach(x => flags.push(['warn', `${x.p.vendor} ${x.p.date}: lines + tax don't match the receipt total (off by ${fmt.money(x.t.diff, 2)})`]));
      if (owed > 0.005) flags.push(['warn', `Business owes you ${fmt.money(owed, 2)} for purchases made on a personal card`]);
      App.ui.publish('purchases', { total: business, food, foodPct, sales: sales.sales, period: label, receipts: list.length, alerts: flags.length, flags: flags.map(f => f[1]) });

      const vendors = [...new Set(purchases.map(p => p.vendor).filter(Boolean))].sort();
      const periods = [['all', 'All time'], ['thisweek', 'This week'], ['lastweek', 'Last week'], ['thismonth', 'This month'], ['lastmonth', 'Last month'], ['ytd', 'Year to date'], ['custom', 'Custom range']];
      view.innerHTML = `
        <div class="card row spread">
          <div class="row">
            <button class="btn primary" id="pNew">${App.fx.icon('plus')} New receipt</button>
            <button class="btn" id="pPaste">Paste receipt text</button>
            <label class="btn">${App.fx.icon('sparkles')} Scan photo with AI<input type="file" id="pScan" accept="image/*" hidden></label>
          </div>
          <div class="row">
            <select id="pPeriod">${App.ui.options(periods.map(([value, label]) => ({ value, label })), state.period)}</select>
            ${state.period === 'custom' ? `<input type="date" id="pFrom" value="${esc(custom.from || '')}"><input type="date" id="pTo" value="${esc(custom.to || '')}">` : ''}
            <select id="pVendor"><option value="">All vendors</option>${App.ui.options(vendors, state.vendor)}</select>
            <input type="search" id="pQ" placeholder="Search items…" value="${esc(state.q)}" style="width:160px">
          </div>
        </div>
        ${purchases.length ? '' : `<div class="card hero"><div class="hero-grid"></div><h2>Track every receipt, see your real food cost</h2>
          <p class="muted">Enter a Costco or Restaurant Depot receipt in under a minute: type it, paste the text from the Costco app, or snap a photo and let AI read it. Personal items are kept out of business totals, and prices are remembered so you're warned when something goes up.</p>
          <div class="row"><button class="btn primary" onclick="document.getElementById('pNew').click()">Enter my first receipt</button></div></div>`}
        <div class="grid k4">
          ${App.ui.kpi('Business purchases', fmt.money(business, 2), `${list.length} receipt${list.length === 1 ? '' : 's'} · ${esc(label)}`)}
          ${App.ui.kpi('Food purchases', fmt.money(food, 2), business ? fmt.pct(food / business) + ' of purchases' : '')}
          ${App.ui.kpi('Food cost %', fmt.pct(foodPct), sales.sales ? `on ${fmt.money(sales.sales)} sales · target ${fmt.pct(target)}` : 'add sales below', isNaN(foodPct) ? '' : foodPct <= target ? 'good' : 'bad')}
          ${App.ui.kpi('Beverage & alcohol', fmt.money(bev, 2), '')}
          ${App.ui.kpi('Supplies & paper', fmt.money(supplies, 2), `tax paid ${fmt.money(taxes, 2)}`)}
          ${personal ? App.ui.kpi('Personal (excluded)', fmt.money(personal, 2), 'not counted as business', 'warn') : ''}
          ${owed > 0.005 ? App.ui.kpi('Owed to you', fmt.money(owed, 2), 'paid on personal card', 'warn') : ''}
        </div>
        ${flags.length ? `<div class="card"><div class="card-head"><h2>Needs attention</h2><span class="badge warn">${flags.length}</span></div><div class="stack">${flags.map(([c, s]) => `<div class="alert ${c}">${esc(s)}</div>`).join('')}</div></div>` : ''}
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Food cost</h2><span class="muted small">${esc(label)}${state.period !== 'all' ? ` · ${from} → ${to}` : ''}</span></div>
            <div class="mapper">
              <label><span>Food sales for the period${sales.auto ? ' <span class="badge good">auto</span>' : ''}</span><input type="number" step="0.01" id="fcSales" value="${isNaN(sales.sales) ? '' : sales.sales.toFixed(2)}" ${sales.auto ? 'disabled' : ''} placeholder="e.g. 12500"></label>
              <label>Beginning inventory (optional)<input type="number" step="0.01" id="fcBeg" value="${esc(inv.beg ?? '')}" placeholder="$ on hand at start"></label>
              <label>Ending inventory (optional)<input type="number" step="0.01" id="fcEnd" value="${esc(inv.end ?? '')}" placeholder="$ on hand at end"></label>
            </div>
            <div class="fc-eq">
              <span><b>${fmt.money(+inv.beg || 0, 2)}</b><i>beginning</i></span><span>+</span>
              <span><b>${fmt.money(food, 2)}</b><i>food purchases</i></span><span>−</span>
              <span><b>${fmt.money(+inv.end || 0, 2)}</b><i>ending</i></span><span>=</span>
              <span><b>${fmt.money(cogs, 2)}</b><i>food used</i></span><span>÷</span>
              <span><b>${isNaN(sales.sales) ? '—' : fmt.money(sales.sales)}</b><i>sales</i></span><span>=</span>
              <span class="fc-res ${isNaN(foodPct) ? '' : foodPct <= target ? 'good' : 'bad'}"><b>${fmt.pct(foodPct)}</b><i>food cost</i></span>
            </div>
            <div class="muted tiny">${sales.auto ? `Sales come from <b>${esc(sales.source)}</b> (your Operations sales table). ` : 'Type sales here, or add a Daily sales table in Data Library and map it in Operations to fill this automatically. '}Without inventory counts this is purchases-based food cost; add counts for the true number.</div>
          </div>
          <div class="card"><div class="card-head"><h2>Where the money went</h2></div><div class="chart-box" style="height:250px"><canvas id="pMix"></canvas></div></div>
        </div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Spend by vendor</h2></div><div class="chart-box" style="height:240px"><canvas id="pVend"></canvas></div></div>
          <div class="card"><div class="card-head"><h2>Price watch</h2><span class="muted small">latest vs previous purchase</span></div>
            <div class="stack">${changes.slice(0, 8).map(c => `<div class="row spread small"><span>${esc(c.item)}</span><span class="row"><span class="muted">${fmt.money(c.from, 2)} → ${fmt.money(c.to, 2)}</span><span class="badge ${c.change > 0 ? 'bad' : 'good'}">${c.change > 0 ? '▲' : '▼'} ${fmt.pct(Math.abs(c.change))}</span></span></div>`).join('') || '<div class="muted small">Prices show up here once you\'ve bought the same item twice.</div>'}</div></div>
        </div>
        <div class="card"><div class="card-head"><h2>Purchase journal</h2>
          <div class="row"><button class="btn small" id="pCsv">${App.fx.icon('download')} Journal CSV</button><button class="btn small" id="pCsv2">${App.fx.icon('download')} Line items CSV</button></div></div>
          <div id="pTable"></div></div>`;

      /* charts */
      const gsum = {};
      T.forEach(x => Object.entries(x.t.groups).forEach(([g, v]) => { if (g !== 'excluded') gsum[g] = (gsum[g] || 0) + v; }));
      const gk = Object.keys(gsum).filter(k => gsum[k] > 0);
      const gcol = { food: '#10b981', beverage: '#06b6d4', alcohol: '#8b5cf6', supplies: '#f59e0b', other: '#64748b' };
      if (gk.length) App.ui.chart('pMix', 'doughnut', { labels: gk.map(g => PU().GROUPS[g]), datasets: [{ data: gk.map(g => +gsum[g].toFixed(2)), backgroundColor: gk.map(g => gcol[g]) }] }, { plugins: { legend: { position: 'right', labels: { color: App.ui.cssVar('--muted') } } } });
      const vsum = {};
      T.forEach(x => vsum[x.p.vendor || 'Unknown'] = (vsum[x.p.vendor || 'Unknown'] || 0) + x.t.business);
      const vk = Object.entries(vsum).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (vk.length) App.ui.chart('pVend', 'bar', { labels: vk.map(v => v[0]), datasets: [{ label: 'Business spend', data: vk.map(v => +v[1].toFixed(2)), multiColor: true }] }, { indexAxis: 'y' });

      /* journal table */
      const rows = T.map(({ p, t }) => ({ id: p.id, date: p.date, vendor: p.vendor, items: p.lines.length, food: t.food, other: t.business - t.food, personal: t.groups.excluded || 0, tax: t.tax, total: p.total || t.computed, payment: p.payment || '', ok: !p.total || Math.abs(t.diff) < 0.02, att: !!p.attachment, reimburse: p.reimburse }));
      App.ui.table(view.querySelector('#pTable'), [
        { key: 'date', label: 'Date', fmt: (v, r) => `<a data-edit="${r.id}">${esc(v)}</a>` },
        { key: 'vendor', label: 'Vendor', fmt: (v, r) => `${esc(v)}${r.att ? ' <span title="Receipt photo attached">📎</span>' : ''}` },
        { key: 'items', label: 'Lines', num: true },
        { key: 'food', label: 'Food', num: true, fmt: v => fmt.money(v, 2) },
        { key: 'other', label: 'Other business', num: true, fmt: v => fmt.money(v, 2) },
        { key: 'personal', label: 'Personal', num: true, fmt: v => v ? `<span class="muted">${fmt.money(v, 2)}</span>` : '—' },
        { key: 'tax', label: 'Tax', num: true, fmt: v => fmt.money(v, 2) },
        { key: 'total', label: 'Total', num: true, fmt: (v, r) => `${fmt.money(v, 2)}${r.ok ? '' : ' <span class="badge warn" title="Lines + tax don\'t match the receipt total">check</span>'}` },
        { key: 'payment', label: 'Paid with', fmt: (v, r) => `${esc(v)}${r.reimburse ? ' <span class="badge warn">owed to you</span>' : ''}` },
        { key: 'id', label: '', fmt: (v) => `<button class="btn small ghost" data-edit="${v}">Edit</button>` }
      ], rows, { sortKey: 'date', limit: 300 });
      view.querySelectorAll('[data-edit]').forEach(a => a.onclick = async () => openEditor(await App.store.get('purchases', a.dataset.edit)));
      if (!rows.length && purchases.length) view.querySelector('#pTable').innerHTML = '<div class="empty">No receipts in this period. Try "All time".</div>';

      /* controls */
      const $ = s => view.querySelector(s);
      $('#pNew').onclick = () => openEditor();
      $('#pPaste').onclick = () => pasteDialog();
      $('#pScan').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) openEditor(null, { scanFile: f }); };
      $('#pPeriod').onchange = e => { state.period = e.target.value; App.go('purchases'); };
      $('#pFrom')?.addEventListener('change', e => { App.bsettings.set('pur.custom', { ...custom, from: e.target.value }); App.go('purchases'); });
      $('#pTo')?.addEventListener('change', e => { App.bsettings.set('pur.custom', { ...App.bsettings.get('pur.custom', {}), to: e.target.value }); App.go('purchases'); });
      $('#pVendor').onchange = e => { state.vendor = e.target.value; App.go('purchases'); };
      let qt; $('#pQ').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; App.go('purchases').then(() => { const i = document.getElementById('pQ'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }); }, 350); };
      const saveFc = () => {
        const invAll = App.bsettings.get('pur.inv', {}); invAll[pkey] = { beg: $('#fcBeg').value, end: $('#fcEnd').value }; App.bsettings.set('pur.inv', invAll);
        if (!sales.auto) { const s = App.bsettings.get('pur.sales', {}); s[pkey] = $('#fcSales').value; App.bsettings.set('pur.sales', s); }
        App.go('purchases');
      };
      ['#fcSales', '#fcBeg', '#fcEnd'].forEach(id => $(id).addEventListener('change', saveFc));
      $('#pCsv').onclick = () => App.download('purchase-journal.csv', App.toCSV(['date', 'vendor', 'items', 'food', 'other', 'personal', 'tax', 'total', 'payment'], rows.map(r => ({ ...r, food: r.food.toFixed(2), other: r.other.toFixed(2), personal: r.personal.toFixed(2), tax: r.tax.toFixed(2), total: (+r.total).toFixed(2) }))));
      $('#pCsv2').onclick = () => {
        const lines = list.flatMap(p => p.lines.map(l => ({ Date: p.date, Vendor: p.vendor, Item: l.item, Category: PU().CAT[l.cat]?.label || '', Qty: l.qty, 'Unit Price': l.qty ? (l.amount / l.qty).toFixed(2) : '', Amount: (+l.amount).toFixed(2), Payment: p.payment || '' })));
        App.download('purchase-lines.csv', App.toCSV(['Date', 'Vendor', 'Item', 'Category', 'Qty', 'Unit Price', 'Amount', 'Payment'], lines));
      };
    }
  };

  /* ---------- Paste receipt text ---------- */
  function pasteDialog() {
    App.ui.modal(`<div class="card-head"><h2>Paste receipt text</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="stack">
        <div class="muted small">Costco app → <b>Account → Orders & Purchases → Warehouse</b> → open a receipt → select all and copy. Restaurant Depot and Sam's Club emailed receipts work too.</div>
        <textarea id="ptText" rows="14" placeholder="E  1234567 KS CHKN BRST   23.99 E&#10;   512345 AVOCADO HASS     6.99 E&#10;   /512345                1.50-&#10;SUBTOTAL ...&#10;TAX ...&#10;**** TOTAL ..." style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px"></textarea>
        <div class="row"><button class="btn primary" id="ptGo">Read receipt</button></div>
      </div>`, (card, close) => {
      card.querySelector('#ptGo').onclick = () => {
        const r = App.purchasing.parseReceipt(card.querySelector('#ptText').value);
        if (!r.lines.length) return App.ui.toast('No items found. Check that prices are at the end of each line.', 5000);
        close();
        openEditor({ vendor: r.vendor, date: r.date || todayISO(), lines: r.lines, tax: r.tax, total: r.total }, { fresh: true });
      };
      setTimeout(() => card.querySelector('#ptText').focus(), 50);
    });
  }

  /* ---------- Receipt editor ---------- */
  function openEditor(existing, opts = {}) {
    const isNew = !existing || opts.fresh;
    const p = existing ? JSON.parse(JSON.stringify({ ...existing, attachment: null })) : { date: todayISO(), vendor: '', payment: 'Business card', lines: [], tax: 0, total: 0 };
    let attachment = existing?.attachment || null;
    if (!p.lines.length) p.lines.push({ item: '', cat: '', qty: 1, amount: 0 });
    const mem = App.bsettings.get('pur.items', {});
    const vendors = [...new Set([...App.purchasing.VENDORS])];

    App.ui.modal(`
      <div class="card-head"><h2>${isNew ? 'New receipt' : 'Edit receipt'}</h2><button class="btn small" data-close>Close</button></div>
      <div class="stack">
        <div class="mapper">
          <label>Vendor<input id="rV" list="rVList" value="${esc(p.vendor)}" placeholder="Costco"><datalist id="rVList">${vendors.map(v => `<option value="${esc(v)}">`).join('')}</datalist></label>
          <label>Date<input type="date" id="rD" value="${esc(p.date)}"></label>
          <label>Paid with<select id="rPay">${App.ui.options(App.purchasing.PAYMENTS, p.payment)}</select></label>
          <label>Receipt / invoice #<input id="rRef" value="${esc(p.ref || '')}" placeholder="optional"></label>
        </div>
        <div class="row small"><label class="row"><input type="checkbox" id="rReimb" ${p.reimburse ? 'checked' : ''}> Owner paid personally. Track as owed to me.</label></div>
        <div class="table-wrap rcpt" style="max-height:340px"><table><thead><tr><th>Item</th><th>Category</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th><th></th></tr></thead><tbody id="rLines"></tbody></table></div>
        <datalist id="rItems">${Object.values(mem).map(m => `<option value="${esc(m.item)}">`).join('')}</datalist>
        <div class="row">
          <button class="btn small" id="rAdd">${App.fx.icon('plus')} Add line</button>
          <span class="muted tiny">Enter on the last amount adds a line. Leave Item blank for a quick split (e.g. "Food $212"). Use a negative amount for coupons.</span>
        </div>
        <div class="rcpt-foot">
          <div class="rcpt-cats" id="rCats"></div>
          <div class="rcpt-tot">
            <div class="row spread"><span class="muted">Lines</span><b id="rSub">$0.00</b></div>
            <div class="row spread"><span class="muted">Tax</span><input type="number" step="0.01" id="rTax" value="${p.tax || ''}" placeholder="0.00" style="width:110px;text-align:right"></div>
            <div class="row spread"><span class="muted">Calculated total</span><b id="rCalc">$0.00</b></div>
            <div class="row spread"><span>Total on receipt</span><input type="number" step="0.01" id="rTotal" value="${p.total || ''}" placeholder="optional" style="width:110px;text-align:right"></div>
            <div id="rMatch" class="small"></div>
          </div>
        </div>
        <div class="row">
          <label class="btn small">${App.fx.icon('upload')} ${attachment ? 'Replace' : 'Attach'} receipt photo<input type="file" id="rFile" accept="image/*,application/pdf" hidden></label>
          <button class="btn small" id="rScan">${App.fx.icon('sparkles')} Read photo with AI</button>
          <button class="btn small" id="rPasteBtn">Paste receipt text</button>
          <span class="muted tiny" id="rAtt">${attachment ? '📎 ' + esc(attachment.name) : ''}</span>
        </div>
        <label class="field">Notes<input id="rNotes" value="${esc(p.notes || '')}" placeholder="optional"></label>
        <div class="row spread">
          <div class="row"><button class="btn primary" id="rSave">Save receipt</button><button class="btn" id="rSaveNew">Save &amp; add another</button></div>
          ${!isNew ? '<button class="btn danger" id="rDel">Delete</button>' : ''}
        </div>
      </div>`, (card, close) => {
      card.classList.add('wide');
      const $ = s => card.querySelector(s);
      const catOpts = sel => `<option value="">Choose…</option>` + App.purchasing.CATS.map(c => `<option value="${c.k}" ${c.k === sel ? 'selected' : ''}>${esc(c.label)}</option>`).join('');

      function drawLines(focusIdx) {
        $('#rLines').innerHTML = p.lines.map((l, i) => `<tr data-i="${i}" class="${App.purchasing.CAT[l.cat]?.group === 'excluded' ? 'personal' : ''}">
          <td><input data-f="item" list="rItems" value="${esc(l.item)}" placeholder="${i === 0 ? 'e.g. KS chicken breast' : ''}"></td>
          <td><select data-f="cat">${catOpts(l.cat)}</select></td>
          <td class="num"><input data-f="qty" type="number" step="any" value="${l.qty ?? 1}" style="width:64px"></td>
          <td class="num"><input data-f="price" type="number" step="0.01" value="${l.qty ? (+l.amount / +l.qty || '') && (+l.amount / +l.qty).toFixed(2) : ''}" style="width:90px"></td>
          <td class="num"><input data-f="amount" type="number" step="0.01" value="${l.amount ? (+l.amount).toFixed(2) : ''}" style="width:96px"></td>
          <td><button class="btn ghost small" data-rm="${i}" title="Remove line">×</button></td></tr>`).join('');
        $('#rLines').querySelectorAll('tr').forEach(tr => {
          const i = +tr.dataset.i, l = p.lines[i];
          const get = f => tr.querySelector(`[data-f="${f}"]`);
          get('item').addEventListener('change', () => {
            l.item = get('item').value.trim();
            const m = App.purchasing.recall(l.item);
            if (m) { l.cat = m.cat; if (!+l.amount) { l.amount = +(m.price * (+l.qty || 1)).toFixed(2); } }
            else if (!l.cat) l.cat = App.purchasing.categorize(l.item);
            drawLines(); refresh();
            if (m) App.ui.toast(`Remembered: ${App.purchasing.CAT[m.cat]?.label} · last paid ${fmt.money(m.price, 2)}/unit`, 2200);
          });
          get('cat').onchange = () => { l.cat = get('cat').value; tr.classList.toggle('personal', App.purchasing.CAT[l.cat]?.group === 'excluded'); refresh(); };
          get('qty').oninput = () => { const pr = +get('price').value; l.qty = +get('qty').value || 0; if (pr) { l.amount = +(pr * l.qty).toFixed(2); get('amount').value = l.amount.toFixed(2); } refresh(); };
          get('price').oninput = () => { l.amount = +((+get('price').value || 0) * (+l.qty || 1)).toFixed(2); get('amount').value = l.amount ? l.amount.toFixed(2) : ''; refresh(); };
          get('amount').oninput = () => { l.amount = +get('amount').value || 0; if (+l.qty) get('price').value = (l.amount / l.qty).toFixed(2); refresh(); };
          get('amount').addEventListener('keydown', e => { if (e.key === 'Enter' && i === p.lines.length - 1) { e.preventDefault(); addLine(); } });
        });
        $('#rLines').querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { p.lines.splice(+b.dataset.rm, 1); if (!p.lines.length) p.lines.push({ item: '', cat: '', qty: 1, amount: 0 }); drawLines(); refresh(); });
        if (focusIdx !== undefined) $('#rLines').querySelector(`tr[data-i="${focusIdx}"] [data-f="item"]`)?.focus();
      }
      function addLine() { p.lines.push({ item: '', cat: '', qty: 1, amount: 0 }); drawLines(p.lines.length - 1); }
      function refresh() {
        p.tax = +$('#rTax').value || 0; p.total = +$('#rTotal').value || 0;
        const t = App.purchasing.totals(p);
        $('#rSub').textContent = fmt.money(t.sub, 2);
        $('#rCalc').textContent = fmt.money(t.computed, 2);
        $('#rMatch').innerHTML = !p.total ? '<span class="muted">Enter the receipt total to double-check your entry.</span>'
          : Math.abs(t.diff) < 0.02 ? '<span style="color:var(--good)">✓ Matches the receipt</span>'
          : `<span style="color:var(--warn)">Off by ${fmt.money(t.diff, 2)}: a line may be missing or mistyped</span>`;
        const cats = Object.entries(t.by).filter(([, v]) => v);
        $('#rCats').innerHTML = cats.map(([k, v]) => `<span class="badge ${App.purchasing.CAT[k]?.group === 'excluded' ? 'warn' : App.purchasing.CAT[k]?.group === 'food' ? 'good' : ''}">${esc(App.purchasing.CAT[k]?.label || 'Uncategorized')} ${fmt.money(v, 2)}</span>`).join(' ')
          + (t.groups.excluded ? `<div class="muted tiny" style="margin-top:6px">Personal items are recorded but not counted as business spend.</div>` : '');
      }
      function loadParsed(r, src) {
        if (r.vendor && !$('#rV').value) $('#rV').value = r.vendor;
        if (r.date) $('#rD').value = r.date;
        const real = p.lines.filter(l => l.item || +l.amount);
        p.lines = [...real, ...r.lines.map(l => ({ item: l.item, cat: l.cat || App.purchasing.categorize(l.item), qty: l.qty || 1, amount: +l.amount || 0 }))];
        if (r.tax) $('#rTax').value = (+r.tax).toFixed(2);
        if (r.total) $('#rTotal').value = (+r.total).toFixed(2);
        drawLines(); refresh();
        const unc = p.lines.filter(l => !l.cat).length;
        App.ui.toast(`${src}: ${r.lines.length} lines added${unc ? ` · ${unc} need a category` : ''}. Please review.`, 4500);
      }
      async function scan(file) {
        const btn = $('#rScan'); btn.disabled = true; btn.innerHTML = `<span class="typing" style="padding:0"><i></i><i></i><i></i></span> Reading receipt…`;
        try { loadParsed(await App.ai.scanReceipt(file), 'AI read the photo'); }
        catch (e) { App.ui.toast(e.message, 7000); }
        btn.disabled = false; btn.innerHTML = `${App.fx.icon('sparkles')} Read photo with AI`;
      }

      $('#rAdd').onclick = addLine;
      ['#rTax', '#rTotal'].forEach(id => $(id).oninput = refresh);
      $('#rPay').onchange = e => { if (/personal/i.test(e.target.value)) $('#rReimb').checked = true; };
      $('#rFile').onchange = e => { const f = e.target.files[0]; if (!f) return; attachment = { name: f.name, type: f.type, blob: f }; $('#rAtt').textContent = '📎 ' + f.name; };
      $('#rScan').onclick = () => {
        if (!attachment) { $('#rFile').click(); $('#rFile').addEventListener('change', () => attachment && /^image\//.test(attachment.type) && scan(attachment.blob), { once: true }); return; }
        if (!/^image\//.test(attachment.type || '')) return App.ui.toast('AI reading works with photos (JPG/PNG). For PDFs, paste the text instead.', 5000);
        scan(attachment.blob);
      };
      $('#rPasteBtn').onclick = () => {
        const box = document.createElement('div');
        box.className = 'stack';
        box.innerHTML = `<textarea rows="8" placeholder="Paste receipt text…" style="font-family:ui-monospace,Menlo,monospace;font-size:12.5px"></textarea><div class="row"><button class="btn primary small">Add these lines</button></div>`;
        $('#rPasteBtn').closest('.row').after(box);
        box.querySelector('textarea').focus();
        box.querySelector('button').onclick = () => { const r = App.purchasing.parseReceipt(box.querySelector('textarea').value); box.remove(); r.lines.length ? loadParsed(r, 'Receipt text') : App.ui.toast('No items found in that text.'); };
      };
      async function save(again) {
        const lines = p.lines.filter(l => l.item || +l.amount).map(l => ({ item: (l.item || '').trim(), cat: l.cat || (l.item ? App.purchasing.categorize(l.item) : '') || 'other', qty: +l.qty || 1, amount: +(+l.amount || 0).toFixed(2) }));
        if (!lines.length) return App.ui.toast('Add at least one line (an item or a category amount).');
        const rec = {
          id: existing?.id && !opts.fresh ? existing.id : App.uid(), businessId: existing?.businessId || App.biz.target(),
          date: $('#rD').value || todayISO(), vendor: $('#rV').value.trim() || 'Unknown vendor', payment: $('#rPay').value, ref: $('#rRef').value.trim(),
          reimburse: $('#rReimb').checked, notes: $('#rNotes').value.trim(), lines, tax: +$('#rTax').value || 0, total: +$('#rTotal').value || 0,
          attachment, created: existing?.created || Date.now(), updated: Date.now()
        };
        await App.store.put('purchases', rec);
        App.compliance?.audit(isNew ? 'Receipt added' : 'Receipt edited', `${rec.vendor} ${rec.date} · ${fmt.money(App.purchasing.totals(rec).computed, 2)} · ${rec.lines.length} lines${rec.attachment ? ' · photo attached' : ''}`, rec.businessId);
        App.biz.withBiz(rec.businessId, () => App.purchasing.remember(lines.filter(l => l.item), rec.date));
        await App.purchasing.syncDataset();
        const t = App.purchasing.totals(rec);
        App.ui.toast(`Saved ${rec.vendor} receipt · ${fmt.money(t.business, 2)} business${t.food ? ` (${fmt.money(t.food, 2)} food)` : ''}`);
        close();
        await App.go('purchases');
        if (again) openEditor(null);
      }
      $('#rSave').onclick = () => save(false);
      $('#rSaveNew').onclick = () => save(true);
      $('#rDel')?.addEventListener('click', async () => {
        if (!confirm('Delete this receipt?')) return;
        await App.store.del('purchases', existing.id); await App.purchasing.syncDataset();
        App.compliance?.audit('Receipt deleted', `${existing.vendor} ${existing.date} · ${fmt.money(App.purchasing.totals(existing).computed, 2)}`, existing.businessId);
        close(); App.ui.toast('Receipt deleted'); App.go('purchases');
      });
      drawLines(); refresh();
      setTimeout(() => (isNew && !existing ? $('#rV') : null)?.focus(), 60);
      if (opts.scanFile) { attachment = { name: opts.scanFile.name, type: opts.scanFile.type, blob: opts.scanFile }; $('#rAtt').textContent = '📎 ' + opts.scanFile.name; scan(opts.scanFile); }
    });
  }

  App.purchasesEditor = openEditor;
})(window.App);
