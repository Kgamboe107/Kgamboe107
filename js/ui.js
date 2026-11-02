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

  function kpi(label, value, sub = '', tone = '') {
    return `<div class="card kpi ${tone}"><div class="label">${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub muted">${sub}</div>` : ''}</div>`;
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
  async function mapper(el, { title = 'Data source', categories, fields, key, onChange, hint = '' }) {
    let datasets = await App.store.datasets();
    const preferred = datasets.filter(d => !categories || categories.includes(d.category));
    const others = datasets.filter(d => categories && !categories.includes(d.category));
    datasets = [...preferred, ...others];
    if (!datasets.length) {
      el.innerHTML = `<div class="card"><div class="card-head"><h2>${esc(title)}</h2></div>
        <div class="muted">No data tables yet. ${hint} <a data-go="library">Upload a spreadsheet</a> or load the sample data in <a data-go="settings">Settings</a>.</div></div>`;
      onChange(null, {});
      return;
    }
    const saved = App.bsettings.get('map.' + key, {});
    /* Pick the table whose columns best fit this analysis (required fields weigh most) */
    const fit = d => fields.reduce((s, f) => s + (App.findCol(d.headers, f.syn) ? (f.optional ? 1 : 4) : 0), 0)
      + (categories && categories.includes(d.category) ? 2 : 0);
    const best = [...datasets].sort((a, b) => fit(b) - fit(a))[0];
    let ds = datasets.find(d => d.id === saved.ds) || best;

    function autoMap(d, prev = {}) {
      const m = {};
      for (const f of fields) {
        if (prev[f.key] !== undefined && (prev[f.key] === '' || d.headers.includes(prev[f.key]))) m[f.key] = prev[f.key];
        else m[f.key] = App.findCol(d.headers, f.syn);
      }
      return m;
    }
    let map = autoMap(ds, saved.ds === ds.id ? saved.map : {});

    function render() {
      const cat = c => App.categories[c]?.label || c;
      el.innerHTML = `<div class="card"><div class="card-head"><h2>${esc(title)}</h2>
          <span class="badge">${ds.rows.length.toLocaleString()} rows · ${esc(App.sources[ds.source]?.label || ds.source)}</span></div>
        <div class="stack">
          <label class="field">Table
            <select data-ds>${datasets.map(d => `<option value="${d.id}" ${d.id === ds.id ? 'selected' : ''}>${App.biz.isMaster() ? esc(App.biz.get(App.biz.idOf(d))?.name || '') + ' · ' : ''}${esc(d.name)} — ${esc(cat(d.category))}</option>`).join('')}</select>
          </label>
          <details ${fields.some(f => !f.optional && !map[f.key]) ? 'open' : ''}>
            <summary class="small muted" style="cursor:pointer">Column mapping (auto-detected — adjust if needed)</summary>
            <div class="mapper" style="margin-top:10px">${fields.map(f => `<label>${esc(f.label)}${f.optional ? ' <span class="tiny">(optional)</span>' : ''}
              <select data-f="${f.key}"><option value="">— none —</option>${options(ds.headers, map[f.key])}</select></label>`).join('')}</div>
          </details>
        </div></div>`;
      el.querySelector('[data-ds]').onchange = e => {
        ds = datasets.find(d => d.id === e.target.value);
        map = autoMap(ds);
        persist(); render(); onChange(ds, map);
      };
      el.querySelectorAll('[data-f]').forEach(s => s.onchange = () => {
        map[s.dataset.f] = s.value; persist(); onChange(ds, map);
      });
    }
    function persist() { App.bsettings.set('map.' + key, { ds: ds.id, map }); }
    render();
    onChange(ds, map);
  }

  /* Save module KPIs so the dashboard can show a cross-module summary */
  function publish(module, data) {
    const all = App.bsettings.get('kpis', {});
    all[module] = { ...data, at: Date.now() };
    App.bsettings.set('kpis', all);
  }

  App.ui = { toast, modal, kpi, empty, table, chart, options, mapper, publish, PALETTE, cssVar };
})(window.App);
