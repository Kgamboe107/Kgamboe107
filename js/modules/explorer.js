/* Data Explorer: pivot any table — group by, aggregate, chart, export */
(function (App) {
  const { esc, fmt, n0 } = App;

  App.modules.explorer = {
    async render(view) {
      const datasets = await App.store.datasets();
      if (!datasets.length) { view.innerHTML = App.ui.empty('No data tables yet.', '<a class="btn primary" data-go="library">Upload data</a>'); return; }
      let ds = datasets.find(d => d.id === App.bsettings.get('explorer.ds')) || datasets[0];
      const st = App.bsettings.get('explorer.state', {});

      function render() {
        const numCols = ds.headers.filter(h => App.isNumericCol(ds.rows, h));
        const catCols = ds.headers.filter(h => !numCols.includes(h));
        const by = ds.headers.includes(st.by) ? st.by : (catCols[0] || ds.headers[0]);
        const val = numCols.includes(st.val) ? st.val : (numCols[0] || '');
        const agg = st.agg || (val ? 'sum' : 'count');
        const chartType = st.chart || 'bar';
        view.innerHTML = `
          <div class="card"><div class="row">
            <label class="field" style="flex:2">Table<select id="xDs">${datasets.map(d => `<option value="${d.id}" ${d.id === ds.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
            <label class="field">Group by<select id="xBy">${App.ui.options(ds.headers, by)}</select></label>
            <label class="field">Bucket dates<select id="xBucket">${App.ui.options([{ value: '', label: 'Keep each date' }, { value: 'day', label: 'Group by day' }, { value: 'month', label: 'Group by month' }], st.bucket || '')}</select></label>
            <label class="field">Value<select id="xVal"><option value="">(row count)</option>${App.ui.options(numCols, val)}</select></label>
            <label class="field">Aggregate<select id="xAgg">${App.ui.options(['sum', 'avg', 'min', 'max', 'count'], agg)}</select></label>
            <label class="field">Chart<select id="xChart">${App.ui.options(['bar', 'line', 'doughnut'], chartType)}</select></label>
            <label class="field" style="flex:1">Filter rows<input id="xF" value="${esc(st.filter || '')}" placeholder="contains…"></label>
          </div></div>
          <div class="grid c2">
            <div class="card"><div class="card-head"><h2>Pivot</h2><button class="btn small" id="xCsv">Export CSV</button></div><div class="chart-box"><canvas id="xC"></canvas></div><div id="xT" style="margin-top:12px"></div></div>
            <div class="card"><div class="card-head"><h2>Column profile</h2></div><div id="xProf"></div></div>
          </div>
          <div class="card"><div class="card-head"><h2>Raw rows</h2><span class="badge">${ds.rows.length} rows</span></div><div id="xRaw"></div></div>`;

        const f = (st.filter || '').toLowerCase();
        const rows = f ? ds.rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(f))) : ds.rows;
        const keyOf = r => {
          const v = r[by];
          if (st.bucket) { const d = App.toDate(v); if (d) return st.bucket === 'month' ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10); }
          return v === '' ? '(blank)' : String(v);
        };
        const g = new Map();
        rows.forEach(r => { const k = keyOf(r); (g.get(k) || g.set(k, []).get(k)).push(val ? n0(r[val]) : 1); });
        let out = [...g.entries()].map(([k, arr]) => {
          let v;
          if (!val || agg === 'count') v = arr.length;
          else if (agg === 'sum') v = App.sum(arr);
          else if (agg === 'avg') v = App.mean(arr);
          else if (agg === 'min') v = Math.min(...arr);
          else v = Math.max(...arr);
          return { key: k, value: v, n: arr.length };
        });
        if (st.bucket) out.sort((a, b) => a.key.localeCompare(b.key)); else out.sort((a, b) => b.value - a.value);
        const total = App.sum(out.map(o => o.value));
        const top = out.slice(0, 30);
        App.ui.chart('xC', chartType, { labels: top.map(o => o.key), datasets: [{ label: `${agg} of ${val || 'rows'}`, data: top.map(o => +o.value.toFixed(2)), multiColor: chartType === 'bar' && !st.bucket }] });
        App.ui.table(view.querySelector('#xT'), [
          { key: 'key', label: by }, { key: 'value', label: `${agg}(${val || 'rows'})`, num: true, fmt: v => fmt.num(v, 2) },
          { key: 'share', label: 'Share', num: true, fmt: (v, r) => fmt.pct(r.value / total) }, { key: 'n', label: 'Rows', num: true }
        ], out, { limit: 200 });
        view.querySelector('#xCsv').onclick = () => App.download('pivot.csv', App.toCSV(['key', 'value', 'n'], out));

        const prof = ds.headers.map(h => {
          const vals = rows.map(r => r[h]).filter(v => v !== '' && v !== null);
          if (numCols.includes(h)) {
            const ns = vals.map(App.num).filter(x => !isNaN(x));
            return { col: h, type: 'number', filled: vals.length, info: `sum ${fmt.num(App.sum(ns), 2)} · avg ${fmt.num(App.mean(ns), 2)} · min ${fmt.num(Math.min(...ns), 2)} · max ${fmt.num(Math.max(...ns), 2)}` };
          }
          return { col: h, type: 'text', filled: vals.length, info: `${new Set(vals.map(String)).size} unique` };
        });
        App.ui.table(view.querySelector('#xProf'), [{ key: 'col', label: 'Column' }, { key: 'type', label: 'Type' }, { key: 'filled', label: 'Filled', num: true }, { key: 'info', label: 'Stats' }], prof);
        App.ui.table(view.querySelector('#xRaw'), ds.headers.map(h => ({ key: h, label: h, num: numCols.includes(h) })), rows, { limit: 300 });

        const upd = (k, v) => { st[k] = v; App.bsettings.set('explorer.state', st); render(); };
        view.querySelector('#xDs').onchange = e => { ds = datasets.find(d => d.id === e.target.value); App.bsettings.set('explorer.ds', ds.id); st.by = st.val = undefined; render(); };
        view.querySelector('#xBy').onchange = e => upd('by', e.target.value);
        view.querySelector('#xBucket').onchange = e => upd('bucket', e.target.value);
        view.querySelector('#xVal').onchange = e => upd('val', e.target.value);
        view.querySelector('#xAgg').onchange = e => upd('agg', e.target.value);
        view.querySelector('#xChart').onchange = e => upd('chart', e.target.value);
        view.querySelector('#xF').onchange = e => upd('filter', e.target.value);
      }
      render();
    }
  };
})(window.App);
