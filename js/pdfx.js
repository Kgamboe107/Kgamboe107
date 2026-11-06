/* PDF table reader: turns report PDFs (CrunchTime, POS, vendor statements) into rows and columns.
   Works on text positions: finds the header band, sets column edges from it, starts a new row
   where most columns have values, and rejoins cell text that wrapped onto several lines. */
(function (root) {
  const squash = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
  /* Same header words (order can differ slightly when cells wrap differently) */
  const headerLike = (a, b) => { if (!a || !b) return false; const A = [...a].sort().join(''), B = [...b].sort().join(''); return A === B || Math.abs(a.length - b.length) <= 6 && (a.includes(b.slice(0, 20)) || b.includes(a.slice(0, 20))); };
  const isNum = s => /^[-–(]?\$?[\d,]*\.?\d+%?\)?$/.test(s.trim()) || /^-?\d[\d,]*\.$/.test(s.trim());

  /* Pages → positioned text items (in reading orientation, rotation applied) */
  async function readItems(pdfjs, data) {
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const items = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const m = pdfjs.Util.transform(vp.transform, it.transform);
        const h = Math.hypot(m[2], m[3]) || 8;
        items.push({ x: m[4], y: m[5], w: it.width, h, str: it.str.replace(/\s+/g, ' ').trim() });
      }
      pages.push({ n: p, width: vp.width, height: vp.height, items });
    }
    return { numPages: doc.numPages, pages };
  }

  /* Group items into visual lines */
  function lines(items) {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    const out = [];
    for (const it of sorted) {
      const L = out[out.length - 1];
      if (L && Math.abs(L.y - it.y) <= Math.max(2, it.h * 0.35)) L.items.push(it);
      else out.push({ y: it.y, items: [it] });
    }
    out.forEach(L => L.items.sort((a, b) => a.x - b.x));
    return out;
  }

  function pageText(page) {
    return lines(page.items).map(L => L.items.map(i => i.str).join(' ')).join('\n');
  }

  /* Rejoin text that wrapped inside a cell: "India"+"napol"+"is" → "Indianapolis", "5,555."+"52" → "5,555.52" */
  function joinCell(parts, right) {
    let s = '';
    let prev = null;
    for (const p of parts) {
      if (!s) { s = p.str; prev = p; continue; }
      const a = s.slice(-1), b = p.str[0];
      const sameLine = Math.abs(p.y - prev.y) < 2;
      const filled = right != null && prev.x + prev.w >= right - Math.max(6, prev.h * 0.9);
      const glue = !sameLine && ((/[\d.,/:]/.test(a) && /[\d/.]/.test(b)) || (/[a-z]/i.test(a) && /[a-z]/.test(b) && filled) || (a === '-' && /\d/.test(b) && !/\s-$/.test(s)));
      s += (glue ? '' : ' ') + p.str;
      prev = p;
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  /* Find header band + columns on one page. Returns null when the page has no table.
     Columns come from how the data lines up (numbers share a right edge, text shares a left edge);
     header text is only used to name them. */
  function layout(page, prev) {
    const L = lines(page.items);
    const numShare = l => l.items.filter(i => isNum(i.str)).length;
    const dataIdx = L.findIndex(l => l.items.length >= 3 && numShare(l) >= 2 && numShare(l) >= l.items.length * 0.35);
    if (dataIdx <= 0) return null;
    let end = L.findIndex((l, i) => i > dataIdx && /^page \d+ of \d+$/i.test(l.items.map(x => x.str).join(' ').trim()));
    if (end < 0) end = L.length;
    const body = L.slice(dataIdx, end);
    // Anchor clusters
    const anchors = [];
    const widths = body.flatMap(l => l.items.map(i => i.w)).sort((a, b) => a - b);
    const medW = widths[Math.floor(widths.length / 2)] || 20;
    // Section labels, totals captions and footers (one wide item on a line) don't define columns
    for (const l of body) for (const it of l.items) {
      if (l.items.length < 2 || it.w > medW * 4) continue;
      const numeric = isNum(it.str);
      anchors.push({ it, kind: numeric ? 'r' : 'l', a: numeric ? it.x + it.w : it.x });
    }
    const clusters = [];
    for (const kind of ['l', 'r']) {
      const xs = anchors.filter(a => a.kind === kind).sort((p, q) => p.a - q.a);
      let cur = null;
      for (const a of xs) {
        if (cur && a.a - cur.last <= 4.5) { cur.items.push(a.it); cur.last = a.a; }
        else { cur = { items: [a.it], last: a.a }; clusters.push(cur); }
      }
    }
    let cols = clusters.map(c => ({ l: Math.min(...c.items.map(i => i.x)), r: Math.max(...c.items.map(i => i.x + i.w)), n: c.items.length }));
    // Merge clusters that overlap in x (a column holding both text and numbers, wrapped dates, totals)
    cols.sort((a, b) => a.l - b.l);
    const merged = [];
    const big = cols.filter(c => c.n >= 2), small = cols.filter(c => c.n < 2);
    for (const c of big.sort((a, b) => a.l - b.l)) {
      const m = merged.find(o => c.l < o.r - 1 && c.r > o.l + 1);
      if (m) { m.l = Math.min(m.l, c.l); m.r = Math.max(m.r, c.r); m.n += c.n; } else merged.push({ ...c });
    }
    // Repeat until stable (merges can chain)
    for (let again = true; again;) {
      again = false;
      merged.sort((a, b) => a.l - b.l);
      for (let i = 0; i + 1 < merged.length; i++) if (merged[i + 1].l < merged[i].r - 1) { merged[i].r = Math.max(merged[i].r, merged[i + 1].r); merged[i].n += merged[i + 1].n; merged.splice(i + 1, 1); again = true; break; }
    }
    cols = merged.length ? merged : small;
    // A short page (a few rows) of the same table reuses the previous page's columns
    const sig = squash(L.slice(Math.max(0, dataIdx - 12), dataIdx).flatMap(l => l.items).filter(i => !isNum(i.str)).map(i => i.str).join(''));
    if (prev && prev.cols.length && (body.length < 12 || cols.length < prev.cols.length) && headerLike(sig, prev.sig)) cols = prev.cols.map(c => ({ l: c.l, r: c.r, n: c.n }));
    cols.forEach((c, k) => {
      c.c = (c.l + c.r) / 2;
      c.left = k ? (cols[k - 1].r + c.l) / 2 : -Infinity;
      c.right = k < cols.length - 1 ? (c.r + cols[k + 1].l) / 2 : Infinity;
      c.parts = [];
    });
    // Header band: lines just above the first data line, stopping at a big gap (the title block)
    const isHeaderish = l => l.items.every(i => i.str.length <= 40) && numShare(l) <= l.items.length * 0.2;
    let top = dataIdx;
    while (top > 0 && isHeaderish(L[top - 1]) && (top === dataIdx || L[top].y - L[top - 1].y <= 22)) top--;
    const colIdx = it => { const cx = it.x + it.w / 2; const k = cols.findIndex(c => cx >= c.left && cx < c.right); return k < 0 ? 0 : k; };
    for (const l of L.slice(top, dataIdx)) for (const it of l.items) cols[colIdx(it)].parts.push(it);
    cols.forEach((c, k) => { c.name = joinCell(c.parts.sort((a, b) => a.y - b.y || a.x - b.x), c.r) || `Column ${k + 1}`; });
    return { lines: L, body, cols, colIdx, sig, title: L.slice(0, top).map(l => l.items.map(i => i.str).join(' ')).join('\n') };
  }

  /* All rows of one page as arrays of cell strings */
  function pageRows(page, lay) {
    const { body, cols, colIdx } = lay;
    const gaps = body.slice(1).map((l, i) => l.y - body[i].y).filter(g => g > 1).sort((a, b) => a - b);
    const lh = gaps.length ? gaps[Math.floor(gaps.length * 0.25)] : 10;
    const rows = [];
    let cur = null, lastY = -1e9;
    const maxCols = Math.max(...body.map(l => new Set(l.items.map(colIdx)).size));
    for (const l of body) {
      const used = new Set(l.items.map(colIdx));
      const startsRow = !cur || l.y - lastY > lh * 1.45 || used.size >= Math.max(2, maxCols * 0.7);
      if (startsRow) { cur = { y: l.y, cells: cols.map(() => []) }; rows.push(cur); }
      for (const it of l.items) cur.cells[colIdx(it)].push(it);
      lastY = l.y;
    }
    return rows.map(r => r.cells.map((parts, k) => joinCell(parts.sort((a, b) => a.y - b.y || a.x - b.x), cols[k].r)));
  }

  /* Whole document → { text, headers, rows } (tables on consecutive pages with the same columns are merged) */
  function tables(docItems) {
    const out = [];
    let prevLay = null;
    for (const page of docItems.pages) {
      const lay = layout(page, prevLay);
      if (lay) prevLay = lay;
      if (!lay) continue;
      const headers = lay.cols.map(c => c.name);
      const rows = pageRows(page, lay);
      if (!out.length) out.title = lay.title;
      const prev = out[out.length - 1];
      if (prev && prev.headers.join('|') === headers.join('|')) prev.rows.push(...rows);
      else out.push({ page: page.n, headers, rows, title: lay.title });
    }
    return out;
  }

  /* Plain number from report text: "5,555.52" → 5555.52, "(12.50)" → -12.5, "-44.59%" → -44.59 */
  function num(s) {
    if (s == null) return NaN;
    const t = String(s).replace(/[$,%\s]/g, '').replace(/^\((.*)\)$/, '-$1').replace('–', '-');
    if (t === '' || t === '-') return NaN;
    return Number(t);
  }

  const api = { readItems, lines, pageText, layout, pageRows, tables, num, isNum };
  root.PDFX = api;
  if (root.App) root.App.pdfx = api;
})(typeof window !== 'undefined' ? window : globalThis);
