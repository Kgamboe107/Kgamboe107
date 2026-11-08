/* Spending (personal units): snap or upload receipts (photos, screenshots, PDFs) to track personal spending.
   Photos are read on the device (Tesseract OCR, works offline on the phone) to fill in the store, date and total;
   PDFs are read as text; the desktop app can also read a photo with AI. Monthly totals, categories, budgets,
   people, and a receipt list. Receipts sync to your other devices with the rest of your data. */
(function (App) {
  const { fmt, esc } = App;
  const P = () => App.period;
  const CATS = ['Groceries', 'Dining & coffee', 'Gas & auto', 'Shopping', 'Household', 'Health & pharmacy', 'Kids & family', 'Personal care', 'Entertainment', 'Travel', 'Bills & utilities', 'Home improvement', 'Pets', 'Gifts & donations', 'Education', 'Other'];
  const COLORS = ['#16a34a', '#ea580c', '#0891b2', '#7c3aed', '#64748b', '#dc2626', '#db2777', '#d946ef', '#f59e0b', '#2563eb', '#0f766e', '#a16207', '#65a30d', '#e11d48', '#4f46e5', '#94a3b8'];
  const PAY = ['Debit card', 'Credit card', 'Cash', 'Cash App', 'Venmo', 'Apple Pay', 'Check', 'Other'];
  const GUESS = [
    [/kroger|walmart|aldi|meijer|costco|sam'?s club|whole foods|trader joe|publix|grocery|safeway|heb\b|food lion|wegmans|market|fresh thyme|sprouts/i, 'Groceries'],
    [/mcdonald|starbucks|chipotle|jersey mike|subway|wendy|taco bell|restaurant|cafe|coffee|pizza|chick-?fil|panera|dunkin|grill|burger|doordash|uber eats|grubhub|kitchen|bar\b/i, 'Dining & coffee'],
    [/shell|bp\b|exxon|chevron|speedway|marathon|circle k|sunoco|fuel|thorntons|casey|valvoline|jiffy|autozone|o'?reilly|car wash/i, 'Gas & auto'],
    [/cvs|walgreens|pharmacy|rite aid|clinic|dental|medical|hospital|optical/i, 'Health & pharmacy'],
    [/home depot|lowe'?s|menards|ace hardware/i, 'Home improvement'],
    [/petsmart|petco|chewy|vet\b/i, 'Pets'],
    [/target|amazon|amzn|best buy|kohl|tj ?maxx|marshalls|old navy|gap\b|nike|macy|ebay|etsy|apple store/i, 'Shopping'],
    [/great clips|salon|barber|ulta|sephora|spa\b/i, 'Personal care'],
    [/amc|regal|cinema|netflix|spotify|hulu|disney|ticketmaster|steam|xbox|playstation/i, 'Entertainment'],
    [/hotel|airbnb|delta|united|southwest|american air|uber|lyft|parking|marriott|hilton/i, 'Travel'],
    [/electric|energy|water|xfinity|comcast|spectrum|verizon|at&t|t-mobile|insurance/i, 'Bills & utilities'],
    [/dollar general|dollar tree|family dollar|bed bath|container store/i, 'Household']
  ];
  const guessCat = s => (GUESS.find(([re]) => re.test(s || '')) || [])[1] || 'Other';
  const colorOf = c => COLORS[Math.max(0, CATS.indexOf(c))] || '#94a3b8';
  let month = null;

  /* ---------- Reading a receipt ---------- */
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const amountsIn = line => [...line.matchAll(/(?:\$\s?)?(-?\d{1,5}(?:,\d{3})*\.\d{2})\b/g)].map(m => +m[1].replace(/,/g, ''));
  function parseText(text) {
    const lines = String(text || '').split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const out = { merchant: '', date: '', total: 0, tax: 0, items: [] };
    // Date
    for (const l of lines) {
      let m = l.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
      if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; if (+m[1] <= 12 && +m[2] <= 31) { out.date = `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`; break; } }
      m = l.match(/\b(20\d\d)-(\d{2})-(\d{2})\b/); if (m) { out.date = `${m[1]}-${m[2]}-${m[3]}`; break; }
      m = l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.? (\d{1,2}),? (20\d\d)\b/i);
      if (m) { out.date = `${m[3]}-${String(MON[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`; break; }
    }
    // Total: the last "total" line that isn't a subtotal; else the largest amount
    const totalLines = lines.filter(l => /\b(total|amount due|balance due|amount paid|grand total|total due|you paid|charged)\b/i.test(l) && !/sub ?-?total|total savings|savings|items? sold|tax/i.test(l));
    for (const l of totalLines.reverse()) { const a = amountsIn(l); if (a.length) { out.total = a[a.length - 1]; break; } }
    const all = lines.flatMap(amountsIn).filter(a => a > 0 && a < 100000);
    if (!out.total && all.length) out.total = Math.max(...all);
    const taxLine = lines.find(l => /\b(sales )?tax\b/i.test(l) && !/before tax|pre-?tax/i.test(l));
    if (taxLine) { const a = amountsIn(taxLine); if (a.length) out.tax = a[a.length - 1]; }
    // Merchant: a known name anywhere, else the first line with letters near the top
    const known = String(text).match(/walmart|target|kroger|costco|aldi|meijer|whole foods|trader joe'?s|publix|safeway|starbucks|mcdonald'?s|chipotle|jersey mike'?s|subway|wendy'?s|taco bell|panera|dunkin|cvs|walgreens|home depot|lowe'?s|best buy|amazon|shell|speedway|marathon|circle k|dollar general|dollar tree|petsmart|sam'?s club|chick-fil-a/i);
    if (known) out.merchant = known[0].toLowerCase().replace(/(^|[\s-])\w/g, c => c.toUpperCase()).replace(/'S\b/g, "'s");
    else out.merchant = (lines.slice(0, 6).find(l => /[a-z]{3}/i.test(l) && !/receipt|welcome|thank|store #|tel|phone|www|http|\d{3}[-) ]\d{3}/i.test(l) && amountsIn(l).length === 0) || '').slice(0, 60);
    // Item lines: "NAME ... 12.34"
    for (const l of lines) {
      if (/total|tax|change|cash|visa|mastercard|debit|credit|balance|tender|approved|auth/i.test(l)) continue;
      const a = amountsIn(l);
      const name = l.replace(/(?:\$\s?)?-?\d{1,5}(?:,\d{3})*\.\d{2}\b.*$/, '').replace(/\s+[A-Z]$/, '').trim();
      if (a.length && name.length >= 3 && /[a-z]{2}/i.test(name)) out.items.push({ name: name.slice(0, 60), amount: a[a.length - 1] });
    }
    out.items = out.items.slice(0, 60);
    return out;
  }

  /* Make phone photos small enough to store and sync (max 1600px, JPEG) */
  async function shrink(file) {
    if (!/^image\//.test(file.type) || /svg/.test(file.type)) return file;
    try {
      const img = await createImageBitmap(file);
      const s = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
      return blob && blob.size < file.size ? new File([blob], (file.name || 'receipt').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch { return file; }
  }

  /* On-device text recognition (loaded the first time it's needed, then cached for offline use) */
  let ocrWorker = null;
  async function ocr(blob, onProgress) {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the receipt reader.')); document.head.appendChild(s); });
    const base = new URL('vendor/tesseract/', location.href).href;
    if (!ocrWorker) ocrWorker = await window.Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base.replace(/\/$/, ''), workerBlobURL: false, logger: m => m.status === 'recognizing text' && onProgress?.(m.progress) });
    const { data } = await ocrWorker.recognize(blob);
    return data.text || '';
  }
  async function readFile(file, onProgress) {
    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name || '')) {
      const pdf = await App.ingest.readPdf(await file.arrayBuffer());
      return { text: pdf?.text || '', how: 'PDF text' };
    }
    if (/^image\//.test(file.type)) return { text: await ocr(file, onProgress), how: 'photo (read on this device)' };
    if (/^text\//.test(file.type)) return { text: await file.text(), how: 'text' };
    return { text: '', how: '' };
  }

  /* ---------- Data ---------- */
  const all = async () => (await App.store.all('spending')).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  const budgets = () => App.bsettings.get('spending.budgets', {});
  const people = () => { try { return App.wealth?.members?.() || []; } catch { return []; } };

  /* ---------- Receipt editor ---------- */
  async function editor(rec, files, onSaved) {
    const r = { id: App.uid(), date: P().today(), merchant: '', total: '', tax: '', category: '', payment: 'Debit card', person: 'joint', note: '', items: [], ...rec };
    let file = files?.[0] || null, preview = '';
    if (file && /^image\//.test(file.type)) preview = URL.createObjectURL(file);
    else if (r.attachment?.blob && /^image\//.test(r.attachment.type || r.attachment.blob.type)) preview = URL.createObjectURL(r.attachment.blob);
    const isPdf = f => f && (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name || ''));
    const aiOk = !App.hosted && !!(await App.ai?.getKey?.('xai'));
    const ppl = people();
    App.ui.modal(`<div class="row spread"><h2>${rec?.id ? 'Edit receipt' : 'New receipt'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-edit">
        <div class="sp-img">${preview ? `<img src="${preview}" alt="Receipt">` : `<div class="sp-noimg">${isPdf(file) || /pdf/.test(r.attachment?.type || '') ? '📄 PDF receipt' : 'No picture'}</div>`}
          <div class="sp-read muted tiny" id="spRead">${file ? 'Reading the receipt…' : ''}</div>
          ${aiOk && preview ? '<button class="btn small" id="spAi">Read with AI (more accurate)</button>' : ''}</div>
        <div class="sp-form">
          <label class="field">Store / merchant<input id="spM" value="${esc(r.merchant)}" placeholder="e.g. Kroger"></label>
          <div class="sp-two"><label class="field">Date<input id="spD" type="date" value="${esc(r.date)}"></label>
            <label class="field">Total ($)<input id="spT" type="number" step="0.01" inputmode="decimal" value="${r.total === '' ? '' : esc(r.total)}" placeholder="0.00"></label></div>
          <div class="sp-two"><label class="field">Category<select id="spC">${CATS.map(c => `<option ${c === (r.category || 'Other') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="field">Paid with<select id="spPay">${PAY.map(p => `<option ${p === r.payment ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
          <div class="sp-two">${ppl.length ? `<label class="field">Who<select id="spWho"><option value="joint">Family / joint</option>${ppl.map(m => `<option value="${m.id}" ${m.id === r.person ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>` : ''}
            <label class="field">Tax ($, optional)<input id="spTax" type="number" step="0.01" inputmode="decimal" value="${r.tax === '' ? '' : esc(r.tax)}"></label></div>
          <label class="field">Note<input id="spN" value="${esc(r.note)}" placeholder="optional"></label>
          ${r.items?.length ? `<details class="small"><summary>${r.items.length} line items read from the receipt</summary><div class="sp-items">${r.items.map(i => `<div><span>${esc(i.name)}</span><b>${fmt.money(i.amount, 2)}</b></div>`).join('')}</div></details>` : ''}
        </div>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:14px">${rec?.id ? '<button class="btn danger" id="spDel">Delete</button>' : '<span></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="spSave">Save receipt</button></div></div>`, (c, close) => {
      const $ = s => c.querySelector(s);
      const fill = (p, how) => {
        if (p.merchant && !$('#spM').value) $('#spM').value = p.merchant;
        if (p.date) $('#spD').value = p.date;
        if (p.total && !$('#spT').value) $('#spT').value = p.total.toFixed(2);
        if (p.tax && !$('#spTax').value) $('#spTax').value = p.tax.toFixed(2);
        if (!catTouched) $('#spC').value = guessCat(p.merchant + ' ' + (p.items || []).map(i => i.name).join(' '));
        r.items = p.items || r.items;
        const found = [p.merchant && 'store', p.date && 'date', p.total && 'total'].filter(Boolean);
        $('#spRead').innerHTML = found.length ? `Filled in ${found.join(', ')} from the ${esc(how)}. Check them, then save.` : 'Couldn’t read this one clearly. Type the total and store, then save.';
      };
      if (file) readFile(file, pr => { const el = $('#spRead'); if (el) el.textContent = `Reading the receipt… ${Math.round(pr * 100)}%`; })
        .then(({ text, how }) => { if (c.isConnected) fill(parseText(text), how); })
        .catch(e => { const el = $('#spRead'); if (el) el.textContent = 'Couldn’t read automatically (' + e.message + '). Type the details instead.'; });
      $('#spAi')?.addEventListener('click', async e => {
        const b = e.target; b.disabled = true; b.textContent = 'Reading…';
        try { const x = await App.ai.scanReceipt(file || r.attachment.blob); $('#spM').value = x.vendor || $('#spM').value; if (x.date) $('#spD').value = x.date; if (x.total) $('#spT').value = (+x.total).toFixed(2); if (x.tax) $('#spTax').value = (+x.tax).toFixed(2); r.items = x.lines.map(l => ({ name: l.item, amount: l.amount })); $('#spC').value = guessCat(x.vendor + ' ' + r.items.map(i => i.name).join(' ')); $('#spRead').textContent = 'Read with AI. Check, then save.'; }
        catch (x) { App.ui.toast(x.message, 5000); }
        b.disabled = false; b.textContent = 'Read with AI (more accurate)';
      });
      let catTouched = !!rec?.category;
      $('#spC').addEventListener('change', () => { catTouched = true; });
      $('#spM').addEventListener('change', () => { if (!catTouched) $('#spC').value = guessCat($('#spM').value); });
      $('#spSave').onclick = async () => {
        const total = parseFloat($('#spT').value);
        if (!Number.isFinite(total)) { App.ui.toast('Enter the total'); $('#spT').focus(); return; }
        const out = { ...r, businessId: rec?.businessId || App.biz.target(), merchant: $('#spM').value.trim() || 'Receipt', date: $('#spD').value || P().today(), total: Math.round(total * 100) / 100,
          tax: parseFloat($('#spTax').value) || 0, category: $('#spC').value, payment: $('#spPay').value, person: $('#spWho')?.value || 'joint', note: $('#spN').value.trim(), updated: Date.now(), createdAt: r.createdAt || Date.now() };
        if (file) out.attachment = { name: file.name || 'receipt', type: file.type || 'application/octet-stream', blob: file };
        await App.store.put('spending', out);
        close(); if (preview) URL.revokeObjectURL(preview);
        App.ui.toast(`Saved ${fmt.money(out.total, 2)} at ${out.merchant}`); onSaved?.();
      };
      $('#spDel')?.addEventListener('click', async () => { await App.store.del('spending', r.id); close(); App.ui.toast('Receipt deleted'); onSaved?.(); });
    });
  }
  async function capture(files, onSaved) {
    const list = [...(files || [])];
    if (!list.length) return;
    const first = await shrink(list[0]);
    await editor(null, [first], async () => {
      onSaved?.();
      if (list.length > 1) setTimeout(() => capture(list.slice(1), onSaved), 300); // one at a time
    });
  }

  function editBudgets(onSaved) {
    const b = budgets();
    App.ui.modal(`<div class="row spread"><h2>Monthly budgets</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="muted small">Set how much you plan to spend each month per category. Leave blank for no budget.</p>
      <div class="sp-budgets">${CATS.map(c => `<label class="sp-brow"><span><i style="background:${colorOf(c)}"></i>${c}</span><span class="rv-in"><span class="muted">$</span><input type="number" step="1" inputmode="decimal" data-b="${esc(c)}" value="${b[c] ?? ''}" placeholder="none"><span></span></span></label>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="sbSave">Save budgets</button></div>`, (c, close) => {
      c.querySelector('#sbSave').onclick = () => {
        const out = {}; c.querySelectorAll('[data-b]').forEach(i => { if (i.value !== '' && +i.value > 0) out[i.dataset.b] = +i.value; });
        App.bsettings.set('spending.budgets', out); close(); App.ui.toast('Budgets saved'); onSaved?.();
      };
    });
  }

  /* ---------- Page ---------- */
  App.modules.spending = {
    CATS, parseText, guessCat,
    async render(view) {
      const t = P().today();
      // Follows the reporting period when one is picked (e.g. Weekly Review); otherwise a month at a time
      const per = P().active() ? P().range() : null;
      month = month || t.slice(0, 7);
      const [y, m] = month.split('-').map(Number);
      const from = per ? per.from : `${month}-01`, to = per ? per.to : P().iso(new Date(y, m, 0, 12));
      const label = per ? per.label : `${P().MON[m - 1]} ${y}`;
      const pm = P().iso(new Date(y, m - 2, 1, 12)).slice(0, 7), pFrom = per?.prev ? per.prev.from : `${pm}-01`, pTo = per?.prev ? per.prev.to : P().iso(new Date(y, m - 1, 0, 12));
      const recs = await all();
      const inR = recs.filter(r => r.date >= from && r.date <= to), prev = recs.filter(r => r.date >= pFrom && r.date <= pTo);
      const sum = l => App.sum(l.map(r => +r.total || 0));
      const total = sum(inR), prevTotal = sum(prev);
      const byCat = {}; inR.forEach(r => byCat[r.category || 'Other'] = (byCat[r.category || 'Other'] || 0) + (+r.total || 0));
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const B = budgets(), budgetTotal = App.sum(Object.values(B));
      const over = Object.entries(B).filter(([c, v]) => (byCat[c] || 0) > v);
      const byMerch = {}; inR.forEach(r => byMerch[r.merchant] = (byMerch[r.merchant] || 0) + (+r.total || 0));
      const merch = Object.entries(byMerch).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const ppl = people(), who = id => id === 'joint' || !id ? 'Family' : (ppl.find(p => p.id === id)?.name || 'Family');
      App.ui.publish('spending', { total, count: inR.length, label, budget: budgetTotal || null, over: over.length, top: cats[0]?.[0] || '' });
      const chg = prevTotal ? `${total >= prevTotal ? '▲' : '▼'} ${Math.abs((total / prevTotal - 1) * 100).toFixed(0)}% vs ${per ? per.prev?.word || 'previous period' : 'last month'}` : 'no receipts last month';
      view.innerHTML = `<div class="card sp-hero">
          <div><h2>Personal spending</h2><div class="muted small">Snap a receipt with your phone, or upload a photo, screenshot or PDF. The store, date and total are filled in for you.</div></div>
          <div class="sp-actions">
            <label class="btn primary sp-snap">${App.fx.icon('upload')} Snap a receipt<input type="file" id="spCam" accept="image/*" capture="environment" hidden></label>
            <label class="btn">Upload photo or file<input type="file" id="spFile" accept="image/*,application/pdf,.pdf,.heic" multiple hidden></label>
            <button class="btn ghost" id="spManual">${App.fx.icon('plus')} Add without a receipt</button>
          </div>
        </div>
        <div class="card sp-bar"><div class="row">${per ? `<b>${esc(label)}</b><span class="muted small">(reporting period)</span>` : `<button class="btn small" id="spPrev" aria-label="Previous month">‹</button><b class="sp-month">${esc(label)}</b><button class="btn small" id="spNext" aria-label="Next month" ${month >= t.slice(0, 7) ? 'disabled' : ''}>›</button>`}</div>
          <div class="row"><button class="btn small" id="spBud">Set budgets</button><button class="btn small" id="spCsv" ${inR.length ? '' : 'disabled'}>${App.fx.icon('download')} Export</button></div></div>
        <div class="grid k4">
          ${App.ui.kpi('Spent', fmt.money(total, 2), chg, budgetTotal ? (total > budgetTotal ? 'bad' : 'good') : '')}
          ${App.ui.kpi('Receipts', fmt.num(inR.length), inR.length ? `avg ${fmt.money(total / inR.length, 2)}` : 'none yet')}
          ${budgetTotal ? App.ui.kpi('Budget left', fmt.money(budgetTotal - total, 2), `of ${fmt.money(budgetTotal)}${over.length ? ` · ${over.length} categor${over.length > 1 ? 'ies' : 'y'} over` : ''}`, total > budgetTotal ? 'bad' : over.length ? 'warn' : 'good') : ''}
          ${cats[0] ? App.ui.kpi('Top category', esc(cats[0][0]), `${fmt.money(cats[0][1], 2)} · ${total ? Math.round(cats[0][1] / total * 100) : 0}%`) : ''}
        </div>
        ${inR.length ? `<div class="grid c2">
          <div class="card"><div class="card-head"><h2>By category</h2></div><div class="sp-cats">${cats.map(([c, v]) => { const b = B[c]; const pct = b ? Math.min(100, v / b * 100) : total ? v / total * 100 : 0; return `<div class="sp-cat"><div class="row spread"><span><i style="background:${colorOf(c)}"></i>${esc(c)}</span><b>${fmt.money(v, 2)}${b ? ` <span class="muted tiny">/ ${fmt.money(b)}</span>` : ''}</b></div><div class="sp-track"><span style="width:${pct}%;background:${b && v > b ? 'var(--bad)' : colorOf(c)}"></span></div></div>`; }).join('')}
            ${Object.keys(B).filter(c => !byCat[c]).map(c => `<div class="sp-cat muted"><div class="row spread"><span><i style="background:${colorOf(c)}"></i>${esc(c)}</span><span class="tiny">$0 / ${fmt.money(B[c])}</span></div></div>`).join('')}</div></div>
          <div class="card"><div class="card-head"><h2>Where it went</h2></div><div style="position:relative;height:210px"><canvas id="spChart"></canvas></div>
            <div class="rv-h">Top stores</div>${merch.map(([n, v]) => `<div class="row spread small" style="padding:3px 0"><span>${esc(n)}</span><b>${fmt.money(v, 2)}</b></div>`).join('')}</div>
        </div>` : ''}
        <div class="card"><div class="card-head"><h2>Receipts</h2><span class="muted small">${inR.length} in ${esc(label)}</span></div>
          ${inR.length ? `<div class="sp-list">${inR.map(r => `<button class="sp-row" data-id="${esc(r.id)}"><span class="sp-thumb">${r.attachment?.blob && /^image\//.test(r.attachment.type || r.attachment.blob.type) ? `<img data-thumb="${esc(r.id)}" alt="">` : r.attachment ? '📄' : '✎'}</span>
            <span class="sp-main"><b>${esc(r.merchant)}</b><span class="muted tiny">${esc(fmt.date(r.date))} · ${esc(r.payment || '')}${ppl.length ? ' · ' + esc(who(r.person)) : ''}${r.note ? ' · ' + esc(r.note) : ''}</span></span>
            <span class="sp-tag" style="--c:${colorOf(r.category)}">${esc(r.category || 'Other')}</span><b class="sp-amt">${fmt.money(r.total, 2)}</b></button>`).join('')}</div>`
          : App.ui.empty(`No receipts ${per ? 'in this period' : 'this month'} yet. Tap <b>Snap a receipt</b> to add your first one.`)}</div>`;
      App.fx.hydrateIcons?.(view);
      const rerender = () => App.go('spending');
      view.querySelector('#spCam').onchange = e => { capture(e.target.files, rerender); e.target.value = ''; };
      view.querySelector('#spFile').onchange = e => { capture(e.target.files, rerender); e.target.value = ''; };
      view.querySelector('#spManual').onclick = () => editor(null, null, rerender);
      view.querySelector('#spPrev')?.addEventListener('click', () => { month = pm; rerender(); });
      view.querySelector('#spNext')?.addEventListener('click', () => { month = P().iso(new Date(y, m, 1, 12)).slice(0, 7); rerender(); });
      view.querySelector('#spBud').onclick = () => editBudgets(rerender);
      view.querySelector('#spCsv').onclick = () => App.download(`spending-${month}.csv`, App.toCSV(['Date', 'Store', 'Category', 'Amount', 'Tax', 'Paid with', 'Who', 'Note'], inR.map(r => ({ Date: r.date, Store: r.merchant, Category: r.category, Amount: r.total, Tax: r.tax || '', 'Paid with': r.payment, Who: who(r.person), Note: r.note || '' }))));
      view.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const r = recs.find(x => x.id === b.dataset.id); if (r) editor(r, null, rerender); });
      view.querySelectorAll('[data-thumb]').forEach(img => { const r = recs.find(x => x.id === img.dataset.thumb); if (r?.attachment?.blob) img.src = URL.createObjectURL(r.attachment.blob); });
      if (cats.length && document.getElementById('spChart')) App.ui.chart('spChart', 'doughnut', { labels: cats.map(c => c[0]), datasets: [{ data: cats.map(c => Math.round(c[1] * 100) / 100), backgroundColor: cats.map(c => colorOf(c[0])), borderWidth: 0 }] }, { maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '62%' });
      // Drop receipts onto the page
      view.ondragover = e => e.preventDefault();
    }
  };
  App.spending = { capture, parseText, all, readFile, shrink, guessCat };
})(window.App);
