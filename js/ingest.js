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
    if (/personnel|employee|roster|staff|hr[_\- ]|onboard|review|w-?4|i-?9/.test(fn)) return 'personnel';
    if (/p&l|pnl|profit|balance|cash ?flow|budget|ledger|financ|invoice/.test(fn)) return 'financial';
    if (/timesheet|labor|schedul|inventory|avt|variance|daily.?sales/.test(fn)) return 'operations';
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

  async function parseSpreadsheet(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const out = [];
    for (const name of wb.SheetNames) {
      const t = sheetToTable(wb.Sheets[name]);
      if (t && t.rows.length) out.push({ sheet: name, ...t });
    }
    return out;
  }

  /**
   * Ingest one File/Blob. opts: { source, category, tags, origin }
   * Returns the stored file record (without blob).
   */
  async function ingestFile(file, opts = {}) {
    const name = file.name || opts.name || 'untitled';
    const rec = {
      id: App.uid(), name, size: file.size, mime: file.type || '', uploadedAt: Date.now(),
      origin: opts.origin || 'upload', tags: opts.tags || [], notes: '', datasetIds: []
    };
    let tables = [];
    if (SHEET_EXT.test(name) || /spreadsheet|csv|excel/.test(file.type)) {
      try { tables = await parseSpreadsheet(file); } catch (e) { console.warn('Parse failed', name, e); }
    }
    const allHeaders = tables.flatMap(t => t.headers);
    rec.source = opts.source || detectSource(name, allHeaders);
    rec.category = opts.category || detectCategory(name, allHeaders, rec.source);
    rec.blob = file;

    for (const t of tables) {
      const ds = {
        id: App.uid(), fileId: rec.id, name: tables.length > 1 ? `${name} › ${t.sheet}` : name,
        sheet: t.sheet, headers: t.headers, rows: t.rows.slice(0, 250000),
        category: rec.category, source: rec.source, createdAt: Date.now()
      };
      await App.store.put('datasets', ds);
      rec.datasetIds.push(ds.id);
    }

    /* Markdown / text research exports (e.g. Anara) become notes too */
    if (NOTE_EXT.test(name) || (rec.source === 'anara' && /\.txt$/i.test(name))) {
      const body = await file.text();
      await App.store.put('notes', {
        id: App.uid(), module: rec.category === 'marketing' ? 'marketing' : 'research', title: name.replace(/\.[^.]+$/, ''),
        body, tags: [App.sources[rec.source]?.label || rec.source], fileId: rec.id, updated: Date.now()
      });
    }

    await App.store.put('files', rec);
    const { blob, ...meta } = rec;
    return meta;
  }

  async function ingestMany(files, opts = {}) {
    const results = [];
    for (const f of files) {
      try { results.push(await ingestFile(f, opts)); }
      catch (e) { console.error(e); App.ui.toast(`Could not import ${f.name}: ${e.message}`); }
    }
    if (results.length) {
      const ds = results.reduce((a, r) => a + r.datasetIds.length, 0);
      App.ui.toast(`Imported ${results.length} file${results.length > 1 ? 's' : ''}${ds ? ` · ${ds} data table${ds > 1 ? 's' : ''}` : ''}`);
    }
    return results;
  }

  App.categories = CATEGORIES;
  App.sources = SOURCES;
  App.ingest = { ingestFile, ingestMany, detectSource, detectCategory, parseSpreadsheet };
})(window.App);
