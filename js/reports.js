/* Report translators: recognize known report layouts and turn them into the tables each page reads.
   - CrunchTime Labor Variance (days across the top)  → daily sales & labor (Operations, Personnel, Food cost)
   - CrunchTime Purchase Journal (PDF)               → Purchases journal → food cost
   - CrunchTime inventory count / variance (PDF)     → Operations inventory variance
   - CrunchTime Actual vs. Theoretical cost (PDF)    → Operations food cost gap
   - PowerPoint decks / Word docs                    → Research notes; scorecard tables → dashboard goals
   - Any other PDF table                              → a data table you can map or explore
   Each translator returns { kind, label, category, datasets, merge, purchases, notes, summary, lands, warnings }. */
(function (root) {
  const P = () => root.PDFX;
  const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const num = s => { const n = P() ? P().num(s) : Number(String(s).replace(/[$,%]/g, '')); return Number.isFinite(n) ? n : 0; };
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const mdY = s => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : ''; };
  const fmtD = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+m}/${+d}/${y}`; };
  const money = v => '$' + (+v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const storeOf = text => (String(text || '').match(/\b(\d{3,6}\s*-\s*[A-Z][\w .'&]+?\s*-\s*[A-Z][\w.'&]+)/) || [])[1]?.replace(/\s+/g, ' ').trim() || '';

  /* ---------------- CrunchTime Labor Variance (CSV/XLSX, days across the top) ---------------- */
  function laborVariance(ctx) {
    for (const { aoa } of ctx.sheets || []) {
      const head = (aoa[0] || []).map(c => String(c).trim());
      const dayCols = head.map((h, i) => [i, h.match(/^(MON|TUE|WED|THU|FRI|SAT|SUN)\w*\s+(\d{1,2})$/i)]).filter(([, m]) => m);
      if (!/^totals?$/i.test(head[1] || '') || dayCols.length < 3) continue;
      if (!aoa.some(r => /labor/i.test(r[0])) || !aoa.some(r => /sales/i.test(r[0]))) continue;

      // Build label paths from the dash indentation (" -- ", " ---- ", " ------ ")
      const rows = [];
      const stack = [];
      for (const r of aoa.slice(1)) {
        const raw = String(r[0] || '');
        const m = raw.match(/^\s*(-*)\s*(.*?)\s*$/);
        const depth = m[1].length ? Math.round(m[1].length / 2) : 0;
        stack.length = depth; stack[depth] = m[2];
        rows.push({ path: stack.slice(0, depth + 1).map(s => String(s || '').toLowerCase()), cells: r });
      }
      const get = (...want) => {
        const row = rows.find(x => x.path.length === want.length && want.every((w, i) => w.test(x.path[i])));
        return row ? dayCols.map(([i]) => num(row.cells[i])) : null;
      };
      const F = {
        sales: get(/^total sales/, /^actual sales/), fc: get(/^total sales/, /^adjusted sales forecast/), sys: get(/^total sales/, /^system sales forecast/),
        bread: get(/^bread/, /^actual bread/), breadF: get(/^bread/, /bread count forecast/),
        lab: get(/^labor - totals/, /^actual/), labF: get(/^labor - totals/, /^forecast/),
        hrs: get(/^labor - totals/, /^actual/, /^hours/), hrsF: get(/^labor - totals/, /^forecast/, /^hours/),
        shifts: get(/^labor - totals/, /^actual/, /^total shifts/), pct: get(/^labor - totals/, /^actual/, /^labor %/), pctF: get(/^labor - totals/, /^forecast/, /^labor %/),
        ot: get(/^labor - hourly/, /^actual/, /^hours/, /^ot hours/), otCost: get(/^labor - hourly/, /^actual/, /^hourly pay/, /^ot cost/),
        splh: get(/^labor - hourly/, /^actual/, /^splh/), hc: get(/^labor - hourly/, /^actual/, /head count/),
        sal: get(/^labor - salaried/, /^actual/)
      };
      if (!F.sales || !F.lab) continue;

      // Dates: the file name carries the week ("Oct_26_2026_-_Nov_01_2026"); the columns carry weekday + day
      const fm = ctx.name.match(/([A-Za-z]{3})[a-z]*[_ ](\d{1,2})[_ ,]+(\d{4})/);
      const named = fm ? new Date(+fm[3], MON[fm[1].toLowerCase()] ?? 0, +fm[2]) : new Date();
      const dates = [];
      let base = named;
      for (const [k, [, m]] of dayCols.entries()) {
        const dow = DOW[m[1].slice(0, 3).toLowerCase()], dom = +m[2];
        let best = null;
        for (let off = -10; off <= 45; off++) {
          const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + off);
          if (d.getDate() === dom && d.getDay() === dow && (!best || Math.abs(off - (k ? 1 : 0)) < Math.abs(best.off - (k ? 1 : 0)))) best = { d, off };
        }
        const d = best ? best.d : new Date(base.getFullYear(), base.getMonth(), base.getDate() + (k ? 1 : 0));
        dates.push(iso(d)); base = d;
      }
      const warnings = [];
      if (fm && dates[0] !== iso(named)) warnings.push(`The file name says the week of ${fmtD(iso(named))}, but the days inside are ${fmtD(dates[0])} – ${fmtD(dates[dates.length - 1])}. It was filed under the dates inside. Re-export that week from CrunchTime if you meant ${fmtD(iso(named))}.`);
      const out = dates.map((d, k) => {
        const v = x => (x ? +x[k].toFixed(2) : 0);
        return {
          Date: d, Week: dates[0], 'Net Sales': v(F.sales), 'Sales Forecast': v(F.fc), 'Sales vs Forecast $': +(v(F.sales) - v(F.fc)).toFixed(2), 'System Forecast': v(F.sys),
          'Labor Cost': +(v(F.lab) + v(F.sal)).toFixed(2), 'Forecast Labor Cost': v(F.labF), 'Actual Hours': v(F.hrs), 'Scheduled Hours': v(F.hrsF),
          'Overtime Hours': v(F.ot), 'OT Cost': v(F.otCost), Shifts: v(F.shifts), 'Hourly Head Count': v(F.hc),
          'Labor %': v(F.sales) ? +((v(F.lab) + v(F.sal)) / v(F.sales) * 100).toFixed(2) : 0, 'Forecast Labor %': v(F.fc) ? +(v(F.labF) / v(F.fc) * 100).toFixed(2) : 0,
          SPLH: v(F.splh), 'Bread Count': v(F.bread), 'Bread Forecast': v(F.breadF)
        };
      });
      const tot = k => out.reduce((a, r) => a + r[k], 0);
      const week = `${fmtD(dates[0])} – ${fmtD(dates[dates.length - 1])}`;
      return {
        kind: 'labor-variance', label: 'CrunchTime labor variance', category: 'operations', source: 'crunchtime',
        merge: [{ id: 'ct-daily', name: 'CrunchTime daily sales & labor', key: 'Date', headers: Object.keys(out[0]), rows: out, category: 'operations', source: 'crunchtime' }],
        summary: [`Week of ${week}: ${money(tot('Net Sales'))} sales vs ${money(tot('Sales Forecast'))} forecast`, `Labor ${money(tot('Labor Cost'))} (${(tot('Labor Cost') / tot('Net Sales') * 100).toFixed(1)}%) · ${tot('Actual Hours').toFixed(1)} hours · ${tot('Overtime Hours').toFixed(1)} OT hours`, `${tot('Bread Count').toFixed(0)} bread baked`],
        lands: [['operations', 'Operations: daily sales, labor %, SPLH'], ['personnel', 'Personnel: hours & overtime'], ['purchases', 'Food cost % (sales side)']],
        warnings, period: [dates[0], dates[dates.length - 1]]
      };
    }
    return null;
  }

  /* ---------------- helpers for PDF tables ---------------- */
  const col = (headers, ...names) => { const H = headers.map(squash); for (const n of names) { const i = H.findIndex(h => h === n); if (i >= 0) return i; } for (const n of names) { const i = H.findIndex(h => h.includes(n)); if (i >= 0) return i; } return -1; };

  /* ---------------- CrunchTime Purchase Journal (PDF) ---------------- */
  function purchaseJournal(ctx) {
    if (!ctx.pdf || !/purchase journal/i.test(ctx.pdf.text)) return null;
    const t = ctx.pdf.tables.find(t => col(t.headers, 'supplier') >= 0 && col(t.headers, 'invoicetotal', 'total') >= 0);
    if (!t) return null;
    const H = t.headers;
    const c = { inv: col(H, 'invoice'), tx: col(H, 'transaction'), type: col(H, 'transtype', 'type'), date: col(H, 'invoicedate'), del: col(H, 'deliverydate'), sup: col(H, 'supplier'), total: col(H, 'actualtotal', 'invoicetotal') };
    const CATMAP = [['beveragesales', 'bev', 'Beverage (resale)'], ['beverage', 'bev', 'Beverage'], ['cleaningsupplies', 'cleaning', 'Cleaning supplies'], ['kitchensupplies', 'smallwares', 'Kitchen supplies'], ['paper', 'paper', 'Paper'], ['produce', 'produce', 'Produce'], ['food', 'food', 'Food'], ['misc', 'other', 'Misc']];
    const catCols = CATMAP.map(([k, cat, label]) => ({ i: H.findIndex(h => squash(h) === k), cat, label })).filter(x => x.i >= 0);
    const store = storeOf(ctx.pdf.text);
    const purchases = [];
    for (const r of t.rows) {
      const date = mdY(r[c.date]) || mdY(r[c.del]);
      const total = num(r[c.total]);
      if (!date || !total || /total/i.test(r[c.sup])) continue;
      const ref = (r[c.inv] || r[c.tx] || '').replace(/\s+/g, '');
      const type = (r[c.type] || '').trim().toUpperCase();
      const lines = catCols.map(x => ({ item: x.label, cat: x.cat, qty: 1, amount: +num(r[x.i]).toFixed(2) })).filter(l => l.amount);
      const vendor = (r[c.sup] || 'Unknown vendor').replace(/\s*-\s*/g, ' - ').trim();
      purchases.push({
        id: 'pj-' + squash(ref || date + vendor + total), date, vendor, ref, payment: type === 'LT' ? 'Transfer from another store' : 'Vendor invoice',
        lines, tax: 0, total: +total.toFixed(2), notes: `${type === 'LT' ? 'Transfer' : 'Invoice'} ${ref}${r[c.tx] && r[c.tx] !== ref ? ' · ' + r[c.tx] : ''} · from CrunchTime purchase journal${store ? ' · ' + store : ''}`,
        imported: 'crunchtime-pj', created: Date.now(), updated: Date.now()
      });
    }
    if (!purchases.length) return null;
    const sum = purchases.reduce((a, p) => a + p.total, 0);
    const food = purchases.reduce((a, p) => a + p.lines.filter(l => ['food', 'produce'].includes(l.cat)).reduce((x, l) => x + l.amount, 0), 0);
    const range = (ctx.pdf.text.match(/(\d\d\/\d\d\/\d{4}) through (\d\d\/\d\d\/\d{4})/) || []);
    const printed = (ctx.pdf.text.match(/Total:\s*([\d,]+\.\d\d)/) || [])[1];
    const warnings = [];
    if (printed && Math.abs(num(printed) - sum) > 0.05) warnings.push(`Read ${money(sum)} of invoices but the report total is ${money(num(printed))}. Some rows may not have been read; check the Purchases page.`);
    const vendors = [...new Set(purchases.map(p => p.vendor))];
    return {
      kind: 'purchase-journal', label: 'CrunchTime purchase journal', category: 'financial', source: 'crunchtime', purchases, store,
      summary: [`${purchases.length} invoices & transfers${range[1] ? ` (${range[1]} – ${range[2]})` : ''} · ${money(sum)}${printed ? ' (matches report total)' : ''}`.replace(' (matches report total)', printed && Math.abs(num(printed) - sum) <= 0.05 ? ' · matches the report total' : ''), `${money(food)} food & produce · ${vendors.slice(0, 3).join(', ')}${vendors.length > 3 ? ` +${vendors.length - 3} more` : ''}`],
      lands: [['purchases', 'Purchases: journal + food cost %'], ['compliance', 'Tax & Compliance: purchase records']], warnings
    };
  }

  /* ---------------- CrunchTime inventory count with variance (PDF) ---------------- */
  function inventoryCount(ctx) {
    if (!ctx.pdf) return null;
    const t = ctx.pdf.tables.find(t => col(t.headers, 'productname') >= 0 && t.headers.some(h => /book/i.test(h)) && t.headers.some(h => /physical/i.test(h)));
    if (!t) return null;
    const tables = ctx.pdf.tables.filter(x => x.headers.length === t.headers.length && col(x.headers, 'productname') >= 0);
    const H = t.headers, iName = col(H, 'productname'), iNo = col(H, 'product'), iUnit = col(H, 'invunit', 'unit'), iPrice = col(H, 'unitprice', 'price');
    const n0 = iPrice + 1;
    const when = mdY((ctx.pdf.text.match(/for (\d{1,2}\/\d{1,2}\/\d{4})/) || [])[1]) || mdY(ctx.pdf.text);
    const rows = [];
    for (const r of tables.flatMap(x => x.rows)) {
      if (!r[iName] || /^total/i.test(r[iNo] || r[iName]) || !P().isNum(r[iPrice] || '')) continue;
      const v = k => num(r[n0 + k]);
      const price = num(r[iPrice]);
      const begin = v(0), rec = v(1), sold = v(2), adj = v(3), book = v(4), phys = v(6);
      const actual = begin + rec + adj - phys;
      rows.push({
        'Item #': r[iNo] || '', Item: r[iName], Unit: r[iUnit] || '', 'Unit Cost': price, 'Begin Qty': begin, Received: rec, Sold: sold, Adjusted: adj,
        'Book Qty': book, 'Physical Qty': phys, 'Actual Usage': +actual.toFixed(2), 'Theoretical Usage': sold, 'Count Variance Qty': v(7),
        'Book Value $': +(book * price).toFixed(2), 'Physical Value $': v(9), 'Variance $': +(-v(10)).toFixed(2)
      });
    }
    if (!rows.length) return null;
    const loss = rows.filter(r => r['Variance $'] > 0).reduce((a, r) => a + r['Variance $'], 0);
    const net = rows.reduce((a, r) => a + r['Variance $'], 0);
    const worst = [...rows].sort((a, b) => b['Variance $'] - a['Variance $']).slice(0, 3);
    const printed = (ctx.pdf.text.match(/Total:\s*[\d,.]+\s+[\d,.]+\s+(-?[\d,]+\.\d\d)/) || [])[1];
    const warnings = [];
    if (printed && Math.abs(-num(printed) - net) > 0.1) warnings.push(`Read a net variance of ${money(net)} but the report shows ${money(-num(printed))}. Check the item list on the Operations page.`);
    return {
      kind: 'inventory-count', label: 'CrunchTime inventory count', category: 'operations', source: 'crunchtime', store: storeOf(ctx.pdf.text),
      datasets: [{ id: 'ct-inv-' + (when || 'latest'), name: `Inventory count ${fmtD(when)} (CrunchTime)`, headers: Object.keys(rows[0]), rows, category: 'operations', source: 'crunchtime', meta: { kind: 'inventory-count', date: when } }],
      summary: [`${rows.length} items counted ${fmtD(when)} · net variance ${money(net)} (${money(loss)} missing)`, `Biggest losses: ${worst.map(r => `${r.Item} ${money(r['Variance $'])}`).join(', ')}`],
      lands: [['operations', 'Operations: inventory variance by item']], warnings
    };
  }

  /* ---------------- CrunchTime Actual vs. Theoretical cost (PDF) ---------------- */
  function actualVsTheo(ctx) {
    if (!ctx.pdf || !/actual\s*\/\s*theoretical|actual\s+vs\.?\s+theoretical/i.test(ctx.pdf.text)) return null;
    const t = ctx.pdf.tables.find(t => t.headers.some(h => /theoretical/i.test(h)));
    if (!t) return null;
    const text = ctx.pdf.text;
    const sales = num((text.match(/Total Net Sales \(\$\):\s*([\d,.]+)/i) || [])[1]);
    const costPct = num((text.match(/Cost \(%\):\s*([\d.]+)/i) || [])[1]);
    const rng = text.match(/between (\d\d\/\d\d\/\d{4}) and (\d\d\/\d\d\/\d{4})/i) || [];
    const from = mdY(rng[1]), to = mdY(rng[2]);
    const rows = [];
    let totals = null;
    for (const r of t.rows) {
      const label = r.find(c => c && !P().isNum(c)) || '';
      const nums = r.filter(c => P().isNum(c)).map(num);
      if (nums.length < 6) continue;
      const [a, ap, th, tp, va, vp, w] = nums;
      if (/^total cost\s*of goods sold/i.test(label.replace(/costof/i, 'cost of'))) { totals = { a, th, va, vp, w }; continue; }
      if (/^total/i.test(label)) continue;
      const m = label.match(/^([\d.]+)\s*-\s*(?:COGS Purchases\s*-\s*)?(.*)$/i);
      rows.push({ Item: m ? m[2].trim() : label, 'GL Code': m ? m[1] : '', 'Actual Cost': a, 'Theoretical Cost': th, 'Variance $': +(a - th).toFixed(2), 'Actual %': ap, 'Theoretical %': tp, 'Variance pts': +(-vp).toFixed(2), 'Logged Waste $': w || 0 });
    }
    if (!rows.length) return null;
    const gap = totals ? -totals.vp : rows.reduce((a, r) => a + r['Variance pts'], 0);
    const over = totals ? -totals.va : rows.reduce((a, r) => a + r['Variance $'], 0);
    const worst = [...rows].sort((a, b) => b['Variance $'] - a['Variance $']).slice(0, 3);
    return {
      kind: 'avt', label: 'CrunchTime actual vs. theoretical', category: 'operations', source: 'crunchtime', store: storeOf(text),
      datasets: [{ id: 'ct-avt-' + (to || 'latest'), name: `Actual vs theoretical ${fmtD(from)} – ${fmtD(to)} (CrunchTime)`, headers: Object.keys(rows[0]), rows, category: 'operations', source: 'crunchtime',
        meta: { kind: 'avt', from, to, netSales: sales, costPct, gapPts: +gap.toFixed(2), overspend: +over.toFixed(2) } }],
      summary: [`${fmtD(from)} – ${fmtD(to)}: food cost ${costPct.toFixed(2)}% of ${money(sales)} sales`, `Actual is ${gap.toFixed(2)} points (${money(over)}) above theoretical. Biggest gaps: ${worst.map(r => `${r.Item} ${money(r['Variance $'])}`).join(', ')}`],
      lands: [['operations', 'Operations: food cost gap by category']], warnings: []
    };
  }

  /* ---------------- PowerPoint / Word ---------------- */
  function deck(ctx) {
    if (!ctx.deck) return null;
    const title = ctx.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
    const datasets = [];
    for (const s of ctx.deck.slides) for (const [k, tb] of s.tables.entries()) {
      if (tb.length < 2) continue;
      const headers = tb[0].map((h, i) => h || `Column ${i + 1}`);
      const rows = tb.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
      const score = /measure|metric|kpi|goal/i.test(headers[0]) && headers.some(h => /now|current|today|actual/i.test(h));
      datasets.push({ id: `deck-${squash(title)}-${s.n}-${k}`, name: `${s.title || 'Slide ' + s.n} (${title}, slide ${s.n})`, headers, rows, category: 'report', source: 'manual', meta: { kind: score ? 'scorecard' : 'slide-table', deck: title, slide: s.n } });
    }
    const goals = datasets.filter(d => d.meta.kind === 'scorecard');
    return {
      kind: 'deck', label: 'Presentation', category: 'research', source: 'manual',
      notes: [{ id: 'note-' + squash(title), module: 'research', title, body: root.PPTX.toMarkdown(ctx.deck, title), tags: ['Presentation', 'Meeting'] }],
      datasets,
      summary: [`${ctx.deck.slides.length} slides turned into a searchable note${ctx.deck.slides.some(s => s.notes) ? ' (speaker notes included)' : ''}`,
        ...(goals.length ? [`Scorecard found: ${goals[0].rows.length} goals (${goals[0].rows.slice(0, 3).map(r => Object.values(r)[0]).join(', ')}…) now shown on the dashboard`] : [])],
      lands: [['research', 'Research: meeting note'], ...(goals.length ? [['dashboard', 'Dashboard: goals scorecard']] : [])], warnings: []
    };
  }

  function document(ctx) {
    if (!ctx.docx) return null;
    const title = ctx.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
    return { kind: 'docx', label: 'Word document', category: 'research', source: 'manual', notes: [{ id: 'note-' + squash(title), module: 'research', title, body: ctx.docx.text, tags: ['Document'] }],
      summary: [`${ctx.docx.text.split(/\s+/).length.toLocaleString()} words turned into a searchable note`], lands: [['research', 'Research: note']], warnings: [] };
  }

  /* ---------------- Any other PDF: keep its tables ---------------- */
  function genericPdf(ctx) {
    if (!ctx.pdf) return null;
    const datasets = [];
    for (const [k, t] of ctx.pdf.tables.entries()) {
      const good = t.rows.filter(r => r.filter(Boolean).length >= Math.max(2, t.headers.length * 0.4));
      if (good.length < 2) continue;
      const seen = {};
      const headers = t.headers.map(h => { const x = h || 'Column'; seen[x] = (seen[x] || 0) + 1; return seen[x] > 1 ? `${x} (${seen[x]})` : x; });
      const rows = good.map(r => Object.fromEntries(headers.map((h, i) => [h, P().isNum(r[i] || '') ? num(r[i]) : (r[i] || '')])));
      datasets.push({ id: null, name: `${ctx.name}${ctx.pdf.tables.length > 1 ? ` › table ${k + 1}` : ''}`, headers, rows });
    }
    return {
      kind: 'pdf', label: 'PDF', datasets,
      summary: datasets.length ? [`${datasets.length} table${datasets.length > 1 ? 's' : ''} read (${datasets.reduce((a, d) => a + d.rows.length, 0)} rows); the full text is searchable`] : ['Text read and searchable (no tables found)'],
      lands: datasets.length ? [['explorer', 'Data Explorer: tables from the PDF']] : [['library', 'Data Library']], warnings: []
    };
  }

  const ORDER = [laborVariance, purchaseJournal, inventoryCount, actualVsTheo, deck, document, genericPdf];
  function translate(ctx) {
    for (const fn of ORDER) {
      try { const r = fn(ctx); if (r) return r; } catch (e) { console.warn('Translator failed', fn.name, e); }
    }
    return null;
  }

  const api = { translate, laborVariance, purchaseJournal, inventoryCount, actualVsTheo, deck, mdY, storeOf };
  root.REPORTS = api;
  if (root.App) root.App.reports = api;
})(typeof window !== 'undefined' ? window : globalThis);
