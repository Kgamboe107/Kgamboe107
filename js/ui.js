/* Shared UI building blocks: toast, modal, KPI cards, tables, charts, dataset/column mapper */
(function (App) {
  const { $, esc, fmt } = App;
  const charts = {};

  function toast(msg, ms = 2800) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), ms);
  }

  function modal(html, onMount) {
    const m = $('#modal'), c = $('#modalCard');
    c.className = 'modal-card';
    c.innerHTML = html;
    m.hidden = false;
    const close = () => { m.hidden = true; c.innerHTML = ''; };
    m.onclick = e => { if (e.target === m) close(); };
    c.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    if (onMount) onMount(c, close);
    return close;
  }

  const ICO_BY_DRILL = { headcount: 'personnel', employee: 'personnel', turnover: 'personnel', tenure: 'personnel', pay: 'personnel', labor: 'operations',
    sales: 'finance', finance: 'finance', purchases: 'receipt', receipt: 'receipt', foodcost: 'receipt', positions: 'trading', marketing: 'marketing',
    filings: 'shield', contractors: 'shield', licenses: 'shield', audit: 'shield', legal: 'scale' };
  const ICO_BY_LABEL = [[/staff|head|employee|people|turnover|tenure|hire/i, 'personnel'], [/labor|hours|shift|ticket|cover|avt|variance|waste/i, 'operations'],
    [/revenue|sales|income|profit|margin|cash|expense|net|cost|spend/i, 'finance'], [/receipt|purchase|food|vendor|owed/i, 'receipt'],
    [/position|p&l|pnl|trade|win|drawdown|exposure|risk|sharpe/i, 'trading'], [/roas|click|campaign|ctr|lead|conversion|ad|cac/i, 'marketing'],
    [/filing|tax|1099|license|deadline|compliance|audit/i, 'shield'], [/legal|risk score|document|incident/i, 'scale'],
    [/research|note/i, 'research'], [/file|table|upload/i, 'library'], [/business/i, 'businesses']];
  function kpiIcon(label, drill) {
    if (drill && ICO_BY_DRILL[drill]) return ICO_BY_DRILL[drill];
    for (const [re, k] of ICO_BY_LABEL) if (re.test(label)) return k;
    return '';
  }

  function kpi(label, value, sub = '', tone = '', drill) {
    const d = drill === false ? null : (drill || App.drillFor?.(label));
    const attrs = d ? ` data-drill="${esc(d[0])}" data-arg="${esc(d[1] || '')}" tabindex="0" role="button" title="Click for details"` : '';
    const ico = kpiIcon(label, d && d[0]);
    return `<div class="card kpi ${tone}${d ? ' link' : ''}${ico ? ' has-ico' : ''}"${attrs}>${d ? '<span class="kpi-go" aria-hidden="true">↗</span>' : ''}${ico ? `<span class="kpi-ico" aria-hidden="true">${App.fx?.icon(ico) || ''}</span>` : ''}<div class="label">${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub muted">${sub}</div>` : ''}</div>`;
  }

  function empty(msg, action = '') {
    return `<div class="card empty"><div>${msg}</div>${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
  }

  /**
   * Sortable table. cols: [{key, label, num?, fmt?(v,row)}]
   */
  function table(el, cols, rows, opts = {}) {
    let sortKey = opts.sortKey || null, dir = opts.dir || -1;
    const limit = opts.limit || 500;
    function render() {
      let data = rows;
      if (sortKey) {
        const c = cols.find(c => c.key === sortKey);
        data = [...rows].sort((a, b) => {
          const av = a[sortKey], bv = b[sortKey];
          if (c && c.num) return (App.n0(av) - App.n0(bv)) * dir;
          return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true }) * dir;
        });
      }
      const shown = data.slice(0, limit);
      el.innerHTML = `<div class="table-wrap"><table><thead><tr>${cols.map(c =>
        `<th class="${c.num ? 'num' : ''}" data-k="${esc(c.key)}">${esc(c.label ?? c.key)}${sortKey === c.key ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
        <tbody>${shown.map(r => `<tr>${cols.map(c => {
          const v = r[c.key];
          const out = c.fmt ? c.fmt(v, r) : esc(v);
          return `<td class="${c.num ? 'num' : ''}">${out}</td>`;
        }).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="muted">No rows</td></tr>`}</tbody></table></div>
        ${data.length > limit ? `<div class="tiny muted" style="margin-top:6px">Showing ${limit} of ${data.length} rows</div>` : ''}`;
      el.querySelectorAll('th').forEach(th => th.onclick = () => {
        const k = th.dataset.k;
        if (sortKey === k) dir = -dir; else { sortKey = k; dir = -1; }
        render();
      });
    }
    render();
  }

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#64748b', '#f97316'];

  /**
   * chart(canvasId, config) — destroys any prior chart on that canvas
   */
  function chart(canvas, type, data, options = {}) {
    const el = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (!el || !window.Chart) return null;
    if (charts[el.id]) charts[el.id].destroy();
    const text = cssVar('--muted'), grid = cssVar('--border');
    data.datasets.forEach((d, i) => {
      const c = d.color || PALETTE[i % PALETTE.length];
      if (type === 'doughnut' || type === 'pie' || d.multiColor) {
        d.backgroundColor = d.backgroundColor || data.labels.map((_, j) => PALETTE[j % PALETTE.length]);
        d.borderColor = cssVar('--panel');
      } else {
        d.borderColor = d.borderColor || c;
        d.backgroundColor = d.backgroundColor || (type === 'line' ? c + '22' : c);
      }
      if (type === 'line') { d.tension = d.tension ?? 0.35; d.pointRadius = d.pointRadius ?? 0; d.pointHoverRadius = 5; d.borderWidth = 2.25; }
      if (type === 'bar') { d.borderRadius = d.borderRadius ?? 6; d.borderSkipped = false; d.maxBarThickness = 42; }
    });
    const isRadial = type === 'doughnut' || type === 'pie';
    charts[el.id] = new Chart(el, {
      type, data,
      options: Object.assign({
        responsive: true, maintainAspectRatio: false, animation: { duration: 800, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        cutout: isRadial ? '68%' : undefined,
        plugins: { legend: { display: isRadial || data.datasets.length > 1, labels: { color: text, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', padding: 14 } },
          tooltip: { mode: isRadial ? 'nearest' : 'index', intersect: isRadial, backgroundColor: 'rgba(15,19,29,.92)', padding: 10, cornerRadius: 8, titleFont: { weight: '600' }, boxPadding: 4 } },
        scales: isRadial ? {} : {
          x: { ticks: { color: text, maxRotation: 0, autoSkip: true }, grid: { color: grid, display: false } },
          y: { ticks: { color: text }, grid: { color: grid }, border: { display: false } }
        }
      }, options)
    });
    return charts[el.id];
  }

  function options(list, selected) {
    return list.map(o => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('');
  }

  /**
   * Dataset picker + column mapper.
   * fields: [{key, label, syn:[], optional?}]
   * Calls onChange(dataset, map) whenever selection changes and on first render.
   */
  /* Which table should an analysis use?
     Real data beats sample data, then the best column fit, then the newest upload.
     A table the user picked by hand sticks until newer data that fits as well arrives. */
  async function resolve(key, { categories, fields, includeLive = true }) {
    const F = fields.map(f => ({ key: f.key || f.k, syn: f.syn, required: f.req != null ? !!f.req : !f.optional }));
    let all = await App.store.datasets();
    if (!includeLive) all = all.filter(d => !d.live);
    if (!all.length) return { ds: null, map: {}, datasets: [] };
    const sampleFiles = new Set((await App.store.files()).filter(f => (f.tags || []).includes('Sample')).map(f => f.id));
    const isSample = d => !!d.sample || sampleFiles.has(d.fileId);
    const fit = d => F.reduce((s, f) => s + (App.findCol(d.headers, f.syn) ? (f.required ? 4 : 1) : 0), 0) + (categories && categories.includes(d.category) ? 2 : 0);
    const ok = d => F.filter(f => f.required).every(f => App.findCol(d.headers, f.syn));
    const inCat = d => !categories || categories.includes(d.category);
    const ranked = [...all].sort((a, b) => (ok(b) - ok(a)) || (inCat(b) - inCat(a)) || (isSample(a) - isSample(b)) || (fit(b) - fit(a)) || ((b.createdAt || 0) - (a.createdAt || 0)));
    let best = ranked[0];
    // Never fall back to an unrelated table (e.g. labor cost read as ad spend)
    if (!ok(best) && !inCat(best)) best = null;
    const saved = App.bsettings.get('map.' + key, {});
    let ds = best;
    const chosen = saved.ds && all.find(d => d.id === saved.ds);
    if (chosen && saved.manual) {
      const newer = best && best !== chosen && ok(best) && (best.createdAt || 0) > (saved.at || 0) && !isSample(best) && (fit(best) >= fit(chosen) || isSample(chosen));
      ds = newer ? best : chosen;
    }
    if (!ds) return { ds: null, map: {}, datasets: ranked, isSample };
    const map = {};
    for (const f of F) {
      const prev = saved.ds === ds.id ? saved.map?.[f.key] : undefined;
      map[f.key] = prev !== undefined && (prev === '' || ds.headers.includes(prev)) ? prev : App.findCol(ds.headers, f.syn);
    }
    const order = [ds, ...ranked.filter(d => d !== ds && (!categories || categories.includes(d.category))), ...ranked.filter(d => d !== ds && categories && !categories.includes(d.category))];
    return { ds, map, datasets: order, isSample, switched: chosen && chosen !== ds };
  }

  async function mapper(el, { title = 'Data source', categories, fields, key, onChange, hint = '' }) {
    const r = await resolve(key, { categories, fields });
    const datasets = r.datasets;
    if (!r.ds) {
      el.innerHTML = `<div class="card"><div class="card-head"><h2>${esc(title)}</h2></div>
        <div class="muted">${datasets.length ? 'None of your tables have the columns this needs yet.' : 'No data tables yet.'} ${hint} <a data-go="library">Upload a spreadsheet or report</a> or load the sample data in <a data-go="settings">Settings</a>.</div>
        ${datasets.length ? `<label class="field" style="margin-top:10px">Use a table anyway<select data-pick><option value="">Choose a table…</option>${datasets.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label>` : ''}</div>`;
      el.querySelector('[data-pick]')?.addEventListener('change', e => { if (!e.target.value) return; App.bsettings.set('map.' + key, { ds: e.target.value, map: {}, manual: true, at: Date.now() }); mapper(el, { title, categories, fields, key, onChange, hint }); });
      onChange(null, {});
      return;
    }
    let ds = r.ds, map = r.map, manual = !!App.bsettings.get('map.' + key, {}).manual && !r.switched;
    function autoMap(d) { const m = {}; for (const f of fields) m[f.key] = App.findCol(d.headers, f.syn); return m; }

    function render() {
      const cat = c => App.categories[c]?.label || c;
      const age = ds.createdAt ? new Date(ds.createdAt).toLocaleDateString() : '';
      el.innerHTML = `<div class="card"><div class="card-head"><h2>${esc(title)}</h2>
          <span class="badge${r.isSample(ds) ? ' warn' : ''}">${r.isSample(ds) ? 'Sample data · ' : ''}${ds.rows.length.toLocaleString()} rows · ${esc(App.sources[ds.source]?.label || ds.source)}${age ? ' · updated ' + age : ''}</span></div>
        <div class="stack">
          <label class="field">Table <span class="tiny">${manual ? '(picked by you; switches when newer data arrives)' : '(follows your newest matching upload)'}</span>
            <select data-ds>${datasets.map(d => `<option value="${d.id}" ${d.id === ds.id ? 'selected' : ''}>${App.biz.isMaster() ? esc(App.biz.get(App.biz.idOf(d))?.name || '') + ' · ' : ''}${r.isSample(d) ? '[Sample] ' : ''}${esc(d.name)} — ${esc(cat(d.category))}</option>`).join('')}</select>
          </label>
          <details ${fields.some(f => !f.optional && !map[f.key]) ? 'open' : ''}>
            <summary class="small muted" style="cursor:pointer">Column mapping (auto-detected — adjust if needed)</summary>
            <div class="mapper" style="margin-top:10px">${fields.map(f => `<label>${esc(f.label)}${f.optional ? ' <span class="tiny">(optional)</span>' : ''}
              <select data-f="${f.key}"><option value="">— none —</option>${options(ds.headers, map[f.key])}</select></label>`).join('')}</div>
          </details>
        </div></div>`;
      el.querySelector('[data-ds]').onchange = e => {
        ds = datasets.find(d => d.id === e.target.value);
        map = autoMap(ds); manual = true;
        persist(true); render(); onChange(ds, map);
      };
      el.querySelectorAll('[data-f]').forEach(s => s.onchange = () => {
        map[s.dataset.f] = s.value; persist(); onChange(ds, map);
      });
    }
    // `at` marks when the user picked the table by hand, so newer uploads can take over later
    function persist(picked) { const prev = App.bsettings.get('map.' + key, {}); App.bsettings.set('map.' + key, { ds: ds.id, map, manual, at: picked ? Date.now() : (prev.ds === ds.id && prev.at) || 0 }); }
    persist();
    render();
    onChange(ds, map);
  }

  /* Save module KPIs so the dashboard can show a cross-module summary */
  function publish(module, data) {
    const all = App.bsettings.get('kpis', {});
    all[module] = { ...data, at: Date.now() };
    App.bsettings.set('kpis', all);
  }

  App.ui = { toast, modal, kpi, empty, table, chart, options, mapper, resolve, publish, PALETTE, cssVar };
})(window.App);
