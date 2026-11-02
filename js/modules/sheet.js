/* Manual data entry: create a table from a template and type rows in, or edit any imported table */
(function (App) {
  const { esc } = App;

  const TEMPLATES = {
    sales: { name: 'Daily sales', category: 'operations', headers: ['Date', 'Location', 'Net Sales', 'Guest Count', 'Notes'], hint: 'Feeds Operations (sales, SPLH, avg check) and food cost % in Purchases.' },
    labor: { name: 'Labor hours', category: 'operations', headers: ['Date', 'Employee', 'Position', 'Hours', 'Overtime Hours', 'Pay Rate'], hint: 'Feeds Operations (labor %, overtime, sales per labor hour).' },
    inventory: { name: 'Inventory count', category: 'operations', headers: ['Count Date', 'Item', 'Unit', 'On Hand', 'Unit Cost', 'Value'], hint: 'Use the total Value as beginning/ending inventory for food cost.' },
    pnl: { name: 'Monthly P&L', category: 'financial', headers: ['Month', 'Revenue', 'COGS', 'Labor', 'Operating Expenses', 'Other Expenses'], hint: 'Feeds Financials (margins, trend, budget variance).' },
    expenses: { name: 'Expenses', category: 'financial', headers: ['Date', 'Vendor', 'Category', 'Amount', 'Paid With', 'Notes'], hint: 'Feeds Financials expense mix. For food receipts use Purchases instead.' },
    marketing: { name: 'Marketing spend', category: 'marketing', headers: ['Date', 'Campaign', 'Channel', 'Spend', 'Clicks', 'Conversions', 'Revenue'], hint: 'Feeds Marketing (ROAS, CPA, CTR).' },
    blank: { name: 'New table', category: 'other', headers: ['Column 1', 'Column 2', 'Column 3'], hint: 'Rename columns to anything you like.' }
  };
  const isDateCol = h => /date|month|day|week/i.test(h);
  const isNumCol = h => /sales|count|hours|rate|cost|value|amount|revenue|cogs|labor|expense|spend|clicks|conversions|on hand|qty|price|total/i.test(h) && !/notes|vendor|category|channel|campaign|employee|item|unit$|position|location|paid/i.test(h);

  /* Create a table: a lightweight file record (so it lists in Data Library) + an editable dataset */
  App.newTable = function (preset) {
    const pick = async key => {
      const t = TEMPLATES[key];
      const today = new Date().toISOString().slice(0, 10);
      const fileId = App.uid(), dsId = App.uid();
      const first = Object.fromEntries(t.headers.map(h => [h, isDateCol(h) ? (h === 'Month' ? today.slice(0, 7) : today) : '']));
      await App.store.put('datasets', { id: dsId, fileId, name: t.name, headers: t.headers.slice(), rows: [first], category: t.category, source: 'manual', businessId: App.biz.target(), createdAt: Date.now(), manual: true });
      await App.store.put('files', { id: fileId, name: t.name, size: 0, mime: 'manual', uploadedAt: Date.now(), origin: 'manual', tags: ['Typed in'], notes: '', datasetIds: [dsId], source: 'manual', category: t.category, businessId: App.biz.target(), blob: null });
      App.go('sheet', { id: dsId });
    };
    if (preset) return pick(preset);
    App.ui.modal(`<div class="card-head"><h2>New table: type data in by hand</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="onb-choice">${Object.entries(TEMPLATES).map(([k, t]) => `<button data-t="${k}"><b>${esc(t.name)}</b><span class="muted tiny">${esc(t.headers.join(' · '))}</span><span class="muted tiny">${esc(t.hint)}</span></button>`).join('')}</div>
      <div class="muted tiny" style="margin-top:12px">Receipts from Costco, Restaurant Depot and others go in <a data-go="purchases" data-close>Purchases</a>, which has receipt-specific tools.</div>`, (card, close) => {
      card.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { close(); pick(b.dataset.t); });
    });
  };

  App.modules.sheet = {
    async render(view, { id } = {}) {
      id = id || App.settings.get('sheet.last');
      const ds = id && await App.store.get('datasets', id);
      if (!ds) { view.innerHTML = App.ui.empty('Pick a table to edit from the Data Library, or create a new one.', `<button class="btn primary" onclick="App.newTable()">New table</button>`); return; }
      App.settings.set('sheet.last', id);
      if (ds.live) { view.innerHTML = App.ui.empty('This table is generated from your Purchases. Edit receipts there.', '<a class="btn primary" data-go="purchases">Open Purchases</a>'); return; }
      const file = ds.fileId ? await App.store.get('files', ds.fileId) : null;
      let saveT;
      const persist = (msg) => {
        clearTimeout(saveT);
        view.querySelector('#shStatus').textContent = 'Saving…';
        saveT = setTimeout(async () => {
          await App.store.put('datasets', ds);
          if (file && file.name !== ds.name) { file.name = ds.name; await App.store.put('files', file); }
          const s = view.querySelector('#shStatus'); if (s) s.textContent = msg || `Saved · ${ds.rows.length} rows`;
        }, 350);
      };

      view.innerHTML = `
        <div class="card row spread">
          <div class="row"><input id="shName" value="${esc(ds.name)}" style="font-weight:600;font-size:15px;min-width:220px">
            <select id="shCat">${App.ui.options(Object.entries(App.categories).map(([k, v]) => ({ value: k, label: v.label })), ds.category)}</select>
            <span class="muted small" id="shStatus">${ds.rows.length} rows${ds.manual ? '' : ' · imported table (edits change the copy in this app, not your original file)'}</span></div>
          <div class="row">
            <button class="btn small" id="shCol">${App.fx.icon('plus')} Column</button>
            <button class="btn small" id="shCsv">${App.fx.icon('download')} CSV</button>
            <a class="btn small" data-go="explorer">Analyze</a>
          </div>
        </div>
        <div class="card" style="padding:0">
          <div class="table-wrap sheet" style="max-height:calc(100vh - 260px);border:none"><table><thead><tr><th class="rn">#</th>${ds.headers.map((h, j) => `<th><input class="hd" data-h="${j}" value="${esc(h)}"></th>`).join('')}<th></th></tr></thead><tbody id="shBody"></tbody></table></div>
          <div class="row" style="padding:12px"><button class="btn primary small" id="shAdd">${App.fx.icon('plus')} Add row</button><span class="muted tiny">Tab moves across · Enter on the last row adds a new one · Ctrl+D copies the row above</span></div>
        </div>`;

      const body = view.querySelector('#shBody');
      const inputType = h => isDateCol(h) ? (/month/i.test(h) ? 'month' : 'date') : isNumCol(h) ? 'number' : 'text';
      function draw(focus) {
        body.innerHTML = ds.rows.map((r, i) => `<tr data-i="${i}"><td class="rn muted">${i + 1}</td>${ds.headers.map(h => {
          let v = r[h] ?? ''; const t = inputType(h);
          if (t === 'date' && v) v = App.dateKey(v); if (t === 'month' && v) v = String(App.periodKey(v)).slice(0, 7);
          return `<td><input data-h="${esc(h)}" type="${t}" ${t === 'number' ? 'step="any"' : ''} value="${esc(v)}"></td>`;
        }).join('')}<td><button class="btn ghost small" data-del="${i}" title="Delete row">×</button></td></tr>`).join('');
        body.querySelectorAll('input').forEach(inp => {
          const i = +inp.closest('tr').dataset.i, h = inp.dataset.h;
          inp.oninput = () => { ds.rows[i][h] = inp.type === 'number' && inp.value !== '' ? +inp.value : inp.value; autoValue(i); persist(); };
          inp.onkeydown = e => {
            if (e.key === 'Enter') { e.preventDefault(); if (i === ds.rows.length - 1) addRow(); else body.querySelector(`tr[data-i="${i + 1}"] input[data-h="${CSS.escape(h)}"]`)?.focus(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && i > 0) { e.preventDefault(); ds.rows[i] = { ...ds.rows[i - 1] }; persist(); draw([i, h]); }
          };
        });
        body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { ds.rows.splice(+b.dataset.del, 1); persist(); draw(); });
        if (focus) body.querySelector(`tr[data-i="${focus[0]}"] input[data-h="${CSS.escape(focus[1])}"]`)?.focus();
      }
      /* Inventory convenience: Value = On Hand × Unit Cost */
      function autoValue(i) {
        const r = ds.rows[i];
        if ('Value' in r && 'On Hand' in r && 'Unit Cost' in r && r['On Hand'] !== '' && r['Unit Cost'] !== '') {
          r.Value = +(App.n0(r['On Hand']) * App.n0(r['Unit Cost'])).toFixed(2);
          const cell = body.querySelector(`tr[data-i="${i}"] input[data-h="Value"]`); if (cell) cell.value = r.Value;
        }
      }
      function addRow() {
        const last = ds.rows[ds.rows.length - 1] || {};
        const r = Object.fromEntries(ds.headers.map(h => [h, isDateCol(h) || /location|employee|position|channel|vendor|paid/i.test(h) ? (last[h] ?? '') : '']));
        ds.rows.push(r); persist(); draw([ds.rows.length - 1, ds.headers.find(h => !isDateCol(h)) || ds.headers[0]]);
      }
      view.querySelector('#shAdd').onclick = addRow;
      view.querySelector('#shName').oninput = e => { ds.name = e.target.value || 'Untitled table'; persist(); };
      view.querySelector('#shCat').onchange = async e => { ds.category = e.target.value; if (file) { file.category = ds.category; await App.store.put('files', file); } persist(); };
      view.querySelectorAll('.hd').forEach(inp => inp.onchange = () => {
        const j = +inp.dataset.h, old = ds.headers[j], nu = inp.value.trim() || old;
        if (nu === old || ds.headers.includes(nu)) { inp.value = old; return; }
        ds.headers[j] = nu; ds.rows.forEach(r => { r[nu] = r[old]; delete r[old]; }); persist(); App.go('sheet', { id });
      });
      view.querySelector('#shCol').onclick = () => { let n = ds.headers.length + 1, name; do { name = 'Column ' + n++; } while (ds.headers.includes(name)); ds.headers.push(name); persist(); App.go('sheet', { id }); };
      view.querySelector('#shCsv').onclick = () => App.download(ds.name.replace(/[^\w\- ]/g, '') + '.csv', App.toCSV(ds.headers, ds.rows));
      draw();
      if (ds.rows.length === 1 && ds.manual) body.querySelector('input:not([type=date]):not([type=month])')?.focus();
    }
  };
})(window.App);
