/* File ingestion: parse spreadsheets, detect source system + business category, persist */
(function (App) {
  const CATEGORIES = {
    financial: { label: 'Financial', color: '#2563eb' },
    operations: { label: 'Operations', color: '#0891b2' },
    trading: { label: 'Trading', color: '#7c3aed' },
    marketing: { label: 'Marketing', color: '#db2777' },
    research: { label: 'Research', color: '#ea580c' },
    personnel: { label: 'Personnel', color: '#059669' },
    report: { label: 'Report', color: '#475569' },
    other: { label: 'Other', color: '#64748b' }
  };

  /* Source systems. `headers` are signature columns (any 2+ match), `name` matches file names. */
  const SOURCES = {
    harri: { label: 'Harri', color: '#ff5a5f', name: /harri/i,
      headers: ['clock in', 'clock out', 'regular hours', 'overtime hours', 'employee id', 'position', 'hire date', 'scheduled hours', 'actual hours', 'pay rate', 'location'] },
    crunchtime: { label: 'CrunchTime', color: '#f59e0b', name: /crunch\s*time|crunchtime|ct_/i,
      headers: ['theoretical', 'actual usage', 'variance', 'net sales', 'menu item', 'item', 'count unit', 'ending inventory', 'beginning inventory', 'waste', 'food cost', 'avt'] },
    webull: { label: 'Webull', color: '#1e40af', name: /webull/i,
      headers: ['symbol', 'side', 'filled', 'avg price', 'filled time', 'placed time', 'total qty', 'time-in-force', 'last price', 'mkt value', 'unrealized p&l'] },
    dub: { label: 'Dub', color: '#111827', name: /\bdub\b|dub[_\- ]/i,
      headers: ['portfolio', 'creator', 'copied', 'allocation', 'copy amount', 'trader'] },
    outlook: { label: 'Outlook', color: '#0078d4', name: /\.(msg|eml)$/i, headers: [] },
    anara: { label: 'Anara', color: '#6d28d9', name: /anara/i, headers: [] },
    smg: { label: 'SMG', color: '#0b6e4f', name: /^smg[_\- ]|fullscale|full[_ ]scale|trend\d?report/i, headers: [] },
    bank: { label: 'Bank & payments', color: '#0f766e', name: /^$/, headers: [] },
    gdrive: { label: 'Google Drive', color: '#16a34a', name: /^$/, headers: [] },
    manual: { label: 'Manual upload', color: '#64748b', name: /^$/, headers: [] }
  };

  const CATEGORY_SIGNALS = {
    trading: ['symbol', 'ticker', 'quantity', 'qty', 'avg price', 'avg cost', 'market value', 'unrealized', 'realized', 'side', 'shares', 'strike'],
    personnel: ['employee', 'hire date', 'department', 'position', 'job title', 'manager', 'pay rate', 'wage', 'salary', 'status', 'email', 'phone'],
    operations: ['labor', 'hours', 'clock in', 'inventory', 'variance', 'theoretical', 'waste', 'covers', 'transactions', 'guest count', 'splh', 'store', 'location'],
    marketing: ['campaign', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions', 'roas', 'channel', 'spend', 'leads', 'reach', 'engagement'],
    financial: ['revenue', 'net income', 'cogs', 'cost of goods', 'gross profit', 'expenses', 'ebitda', 'operating income', 'account', 'debit', 'credit', 'budget', 'actual']
  };

  const SHEET_EXT = /\.(csv|tsv|txt|xlsx|xlsm|xls|ods|numbers)$/i;
  const NOTE_EXT = /\.(md|markdown)$/i;

  function scoreSignals(headers, list) {
    const hs = headers.map(h => String(h).toLowerCase());
    return list.reduce((acc, sig) => acc + (hs.some(h => h.includes(sig)) ? 1 : 0), 0);
  }

  function detectSource(fileName, headers = []) {
    for (const [key, s] of Object.entries(SOURCES)) {
      if (s.name && s.name.source !== '^$' && s.name.test(fileName)) return key;
    }
    let best = 'manual', bestScore = 1;
    for (const [key, s] of Object.entries(SOURCES)) {
      const sc = scoreSignals(headers, s.headers);
      if (sc > bestScore) { best = key; bestScore = sc; }
    }
    return best;
  }

  function detectCategory(fileName, headers = [], source) {
    const fn = fileName.toLowerCase();
    if (/personnel|employee|roster|staff|hr[_\- ]|onboard|performance.?review|w-?4|i-?9/.test(fn)) return 'personnel';
    if (/p&l|pnl|profit|balance|cash ?flow|budget|ledger|financ|invoice/.test(fn)) return 'financial';
    if (/timesheet|labor|schedul|inventory|avt|actual.?vs|theoretical|variance|daily.?sales/.test(fn)) return 'operations';
    if (/purchase.?journal|purchases/.test(fn)) return 'financial';
    if (/trade|position|portfolio|brokerage|order/.test(fn)) return 'trading';
    if (/campaign|marketing|ads|seo|social/.test(fn)) return 'marketing';
    if (/research|study|whitepaper|analysis|notes/.test(fn)) return 'research';
    if (headers.length) {
      let best = null, bestScore = 1;
      for (const [cat, sig] of Object.entries(CATEGORY_SIGNALS)) {
        const sc = scoreSignals(headers, sig);
        if (sc > bestScore) { best = cat; bestScore = sc; }
      }
      if (best) return best;
    }
    if (source === 'webull' || source === 'dub') return 'trading';
    if (source === 'crunchtime') return 'operations';
    if (source === 'harri') return 'personnel';
    if (source === 'anara') return 'research';
    if (/\.(pdf|docx?|pptx?)$/i.test(fn)) return 'report';
    return 'other';
  }

  /* Find the header row (exports often have title rows above the real header) */
  function sheetToTable(ws) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
    if (!aoa.length) return null;
    const filled = r => r.filter(c => c !== '' && c !== null).length;
    const maxFilled = Math.max(...aoa.slice(0, 30).map(filled));
    let hIdx = 0;
    for (let i = 0; i < Math.min(15, aoa.length); i++) {
      const r = aoa[i];
      const textCells = r.filter(c => typeof c === 'string' && c.trim() && isNaN(App.num(c))).length;
      if (filled(r) >= Math.max(2, maxFilled * 0.6) && textCells >= filled(r) * 0.6) { hIdx = i; break; }
    }
    const rawHeaders = aoa[hIdx].map((h, i) => String(h || '').trim() || `Column ${i + 1}`);
    const seen = {};
    const headers = rawHeaders.map(h => { seen[h] = (seen[h] || 0) + 1; return seen[h] > 1 ? `${h} (${seen[h]})` : h; });
    const rows = [];
    for (const r of aoa.slice(hIdx + 1)) {
      if (!filled(r)) continue;
      const o = {};
      headers.forEach((h, i) => { let v = r[i]; if (v instanceof Date) v = v.toISOString().slice(0, 10); o[h] = v ?? ''; });
      rows.push(o);
    }
    return { headers, rows };
  }

  async function parseSpreadsheet(file, buf) {
    buf = buf || await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const out = [], sheets = [];
    for (const name of wb.SheetNames) {
      sheets.push({ sheet: name, aoa: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, blankrows: false }) });
      const t = sheetToTable(wb.Sheets[name]);
      if (t && t.rows.length) out.push({ sheet: name, ...t });
    }
    out.sheets = sheets;
    return out;
  }

  /* PDF text + tables (pdf.js) */
  let pdfReady = null;
  function pdfjs() {
    if (!window.pdfjsLib) return null;
    if (!pdfReady) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; pdfReady = true; }
    return window.pdfjsLib;
  }
  async function readPdf(buf) {
    const lib = pdfjs();
    if (!lib || !App.pdfx) return null;
    const doc = await App.pdfx.readItems(lib, new Uint8Array(buf));
    return { tables: App.pdfx.tables(doc), text: doc.pages.map(App.pdfx.pageText).join('\n\n'), pages: doc.numPages };
  }

  const DOC_EXT = /\.(pdf|pptx|docx)$/i;
  const fmtDay = d => { const [y, m, dd] = d.split('-'); return `${+m}/${+dd}/${y}`; };

  /* Merge rows into a rolling table (one row per key, newest file wins) */
  async function mergeRolling(m, rec) {
    const id = `${m.id}-${rec.businessId}`;
    const prev = await App.store.get('datasets', id);
    const byKey = new Map((prev?.rows || []).map(r => [r[m.key], r]));
    let replaced = 0, same = 0;
    for (const r of m.rows) {
      const old = byKey.get(r[m.key]);
      if (old) { replaced++; if (m.headers.every(h => String(old[h]) === String(r[h]))) same++; }
      byKey.set(r[m.key], { ...r, __f: rec.id });
    }
    const rows = [...byKey.values()].sort((a, b) => String(a[m.key]).localeCompare(String(b[m.key])));
    const headers = [...new Set([...(prev?.headers || []), ...m.headers])];
    await App.store.put('datasets', { id, fileId: null, name: m.name, headers, rows, category: m.category, source: m.source, businessId: rec.businessId, createdAt: Date.now(), rolling: true });
    const warnings = [];
    if (same && same === m.rows.length) warnings.push('These exact days were already imported from another file (same numbers), so nothing changed. You may have uploaded the same week twice.');
    else if (replaced) warnings.push(`${replaced} day${replaced > 1 ? 's were' : ' was'} already imported; the numbers from this file replaced them.`);
    return { id, rows: rows.length, warnings };
  }

  /**
   * Ingest one File/Blob. opts: { source, category, tags, origin, businessId }
   * Known reports (CrunchTime labor variance, purchase journal, inventory, AvT, decks…) are translated
   * into the tables each page reads; everything else is kept as tables / searchable text.
   * Returns the stored file record (without blob) plus `report` describing where the data went.
   */
  async function ingestFile(file, opts = {}) {
    const name = file.name || opts.name || 'untitled';
    const rec = {
      id: App.uid(), name, size: file.size, mime: file.type || '', uploadedAt: Date.now(),
      origin: opts.origin || 'upload', tags: opts.tags || [], notes: '', datasetIds: [],
      businessId: opts.businessId || App.biz.target()
    };
    const sample = (opts.tags || []).includes('Sample');
    let tables = [];
    const ctx = { name, businessId: rec.businessId };
    const isSheet = SHEET_EXT.test(name) || /spreadsheet|csv|excel/.test(file.type);
    if (isSheet || DOC_EXT.test(name)) {
      const buf = await file.arrayBuffer();
      try {
        if (isSheet) { tables = await parseSpreadsheet(file, buf); ctx.sheets = tables.sheets; }
        else if (/\.pdf$/i.test(name)) { ctx.pdf = await readPdf(buf); if (ctx.pdf) rec.text = ctx.pdf.text.slice(0, 300000); }
        else if (/\.pptx$/i.test(name)) { ctx.deck = await App.pptx.readPptx(buf); rec.text = App.pptx.toMarkdown(ctx.deck, name).slice(0, 300000); }
        else if (/\.docx$/i.test(name)) { ctx.docx = await App.pptx.readDocx(buf); rec.text = ctx.docx.text.slice(0, 300000); }
      } catch (e) { console.warn('Parse failed', name, e); rec.parseError = String(e.message || e); }
    }
    if (/\.(ofx|qfx|qbo)$/i.test(name)) { try { ctx.ofx = await file.text(); rec.text = ctx.ofx.slice(0, 300000); } catch (e) { rec.parseError = String(e.message || e); } }
    const report = App.reports ? App.reports.translate(ctx) : null;
    const allHeaders = report?.kind === 'labor-variance' ? [] : tables.flatMap(t => t.headers);
    rec.source = opts.source || report?.source || detectSource(name, allHeaders);
    rec.category = opts.category || report?.category || detectCategory(name, allHeaders, rec.source);
    rec.blob = file;

    // Plain spreadsheets keep their tables as-is (a translated report replaces its raw layout)
    if (!report || report.kind === 'pdf' || report.kind === 'deck') {
      for (const t of tables) {
        const ds = {
          id: App.uid(), fileId: rec.id, name: tables.length > 1 ? `${name} › ${t.sheet}` : name,
          sheet: t.sheet, headers: t.headers, rows: t.rows.slice(0, 250000),
          category: rec.category, source: rec.source, businessId: rec.businessId, createdAt: Date.now(), sample
        };
        await App.store.put('datasets', ds);
        rec.datasetIds.push(ds.id);
      }
    }

    const warnings = [...(report?.warnings || [])];
    if (report) {
      for (const d of report.datasets || []) {
        const ds = { ...d, id: d.id ? `${d.id}-${rec.businessId}` : App.uid(), fileId: rec.id, category: d.category || rec.category, source: d.source || rec.source, businessId: rec.businessId, createdAt: Date.now(), sample };
        await App.store.put('datasets', ds);
        rec.datasetIds.push(ds.id);
      }
      for (const m of report.merge || []) { const r = await mergeRolling(m, rec); warnings.push(...(report.kind === 'statement' ? r.warnings.map(w => w.replace(/day(s?) (were|was)/, 'transaction$1 $2').replace('These exact days', 'These exact transactions')) : r.warnings)); }
      if (report.kind === 'statement') await App.banking?.rebuild(rec.businessId, report.statement);
      for (const n of report.notes || []) await App.store.put('notes', { ...n, id: `${n.id}-${rec.businessId}`, fileId: rec.id, businessId: rec.businessId, updated: Date.now() });
      if (report.purchases?.length) {
        for (const p of report.purchases) await App.store.put('purchases', { ...p, id: `${p.id}-${rec.businessId}`, fileId: rec.id, businessId: rec.businessId });
        await App.purchasing?.syncDataset();
      }
      if (report.smg?.length) {
        const where = new Map();
        for (const e of report.smg) {
          const b = App.guest?.bizForStore(e.store);
          const bid = b ? b.id : rec.businessId;
          await App.biz.withBiz(bid, () => App.guest.save('smg', { ...e, fileId: rec.id }));
          where.set(bid, (where.get(bid) || 0) + 1);
        }
        report.summary.push(...[...where].map(([bid, n]) => `Saved ${n} period${n > 1 ? 's' : ''} to ${App.biz.get(bid)?.name || 'this business'}${bid !== rec.businessId ? ' (matched by store number)' : ''}`));
      }
      rec.report = { kind: report.kind, label: report.label, summary: report.summary, lands: report.lands, warnings, store: report.store || '' };
    }

    /* Markdown / text research exports (e.g. Anara) become notes too */
    if (NOTE_EXT.test(name) || (rec.source === 'anara' && /\.txt$/i.test(name))) {
      const body = await file.text();
      await App.store.put('notes', {
        id: App.uid(), module: rec.category === 'marketing' ? 'marketing' : 'research', title: name.replace(/\.[^.]+$/, ''),
        body, tags: [App.sources[rec.source]?.label || rec.source], fileId: rec.id, businessId: rec.businessId, updated: Date.now()
      });
    }

    await App.store.put('files', rec);
    const { blob, ...meta } = rec;
    return meta;
  }

  /* Whole weeks missing in a rolling daily table (checked once, after a batch) */
  async function weekGaps(bizIds) {
    const out = [];
    for (const d of (await App.store.all('datasets', { raw: true })).filter(d => d.rolling && d.headers.includes('Date') && bizIds.includes(d.businessId))) {
      const days = d.rows.map(r => r.Date).filter(Boolean).sort();
      if (days.length < 8) continue;
      const have = new Set(days), missing = [];
      for (let x = new Date(days[0] + 'T12:00'); x <= new Date(days[days.length - 1] + 'T12:00'); x.setDate(x.getDate() + 7)) {
        const wk = [...Array(7)].map((_, i) => { const y = new Date(x); y.setDate(y.getDate() + i); return y.toISOString().slice(0, 10); });
        if (!wk.some(k => have.has(k))) missing.push(fmtDay(wk[0]));
      }
      out.push({ name: d.name, from: days[0], to: days[days.length - 1], days: days.length, missing });
    }
    return out;
  }

  async function ingestMany(files, opts = {}) {
    const results = [];
    const list = [...files], many = list.length > 1;
    for (const [i, f] of list.entries()) {
      if (many || f.size > 2e6 || DOC_EXT.test(f.name)) App.ux?.task(`Reading ${many ? `${i + 1} of ${list.length} · ` : ''}${f.name}`, i / list.length * 100);
      try { results.push(await ingestFile(f, opts)); }
      catch (e) { console.error(e); App.ui.toast(`Could not import ${f.name}: ${e.message}`); }
    }
    if (many || list.some(f => f.size > 2e6 || DOC_EXT.test(f.name))) App.ux?.taskDone(`Imported ${results.length} of ${list.length} file${list.length > 1 ? 's' : ''}`);
    if (results.length) {
      App.bus?.emit?.('data-changed', results);
      if (!opts.quiet && !(opts.tags || []).includes('Sample') && App.importSummary) App.importSummary(results, { gaps: await weekGaps([...new Set(results.map(r => r.businessId))]) });
      else {
        const ds = results.reduce((a, r) => a + r.datasetIds.length, 0);
        App.ui.toast(`Imported ${results.length} file${results.length > 1 ? 's' : ''}${ds ? ` · ${ds} data table${ds > 1 ? 's' : ''}` : ''}`);
      }
    }
    return results;
  }

  /* Re-file an import under another business (re-reads the stored originals) */
  async function moveImport(fileIds, toId) {
    const out = [];
    for (const id of fileIds) {
      const f = await App.store.get('files', id);
      if (!f?.blob) continue;
      const blob = f.blob instanceof File ? f.blob : new File([f.blob], f.name, { type: f.mime });
      await App.store.deleteFile(id);
      out.push(await ingestFile(blob, { businessId: toId, tags: f.tags, origin: f.origin }));
    }
    return out;
  }

  App.categories = CATEGORIES;
  App.sources = SOURCES;
  App.ingest = { ingestFile, ingestMany, moveImport, detectSource, detectCategory, parseSpreadsheet, readPdf };
})(window.App);
