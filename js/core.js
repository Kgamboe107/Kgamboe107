/* Core namespace + shared helpers */
window.App = window.App || { modules: {} };

(function (App) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Parse "$1,234.50", "(1,200)", "12%", "-" etc. into numbers */
  function num(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    if (!s || s === '-' || s === '—') return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[$€£¥,\s]/g, '').replace(/%$/, '');
    if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
    let mult = 1;
    if (/[kK]$/.test(s)) { mult = 1e3; s = s.slice(0, -1); }
    else if (/[mM]$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
    else if (/[bB]$/.test(s)) { mult = 1e9; s = s.slice(0, -1); }
    const n = parseFloat(s);
    if (isNaN(n)) return NaN;
    return (neg ? -n : n) * mult;
  }
  const n0 = v => { const x = num(v); return isNaN(x) ? 0 : x; };

  function toDate(v) {
    if (v instanceof Date) return v;
    if (typeof v === 'number' && v > 20000 && v < 80000) { // Excel serial
      return new Date(Math.round((v - 25569) * 86400 * 1000));
    }
    if (v === null || v === undefined || v === '') return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  function dateKey(v) {
    const d = toDate(v);
    if (!d) return String(v ?? '');
    return d.toISOString().slice(0, 10);
  }

  const fmt = {
    money(v, dp = 0) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      const s = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
      return (v < 0 ? '-$' : '$') + s;
    },
    compact(v) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return (v < 0 ? '-$' : '$') + Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(v));
    },
    num(v, dp = 0) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
    },
    pct(v, dp = 1) {
      if (v === null || v === undefined || isNaN(v) || !isFinite(v)) return '—';
      return (v * 100).toFixed(dp) + '%';
    },
    bytes(b) {
      if (b < 1024) return b + ' B';
      if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
      return (b / 1048576).toFixed(1) + ' MB';
    },
    date(v) {
      const d = toDate(v);
      return d ? d.toLocaleDateString() : '—';
    }
  };

  /* Column matching: find the header that best matches a list of synonyms */
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9%]/g, '');
  function findCol(headers, synonyms) {
    const H = headers.map(h => ({ h, n: norm(h) }));
    for (const syn of synonyms) {
      const s = norm(syn);
      const exact = H.find(x => x.n === s);
      if (exact) return exact.h;
    }
    for (const syn of synonyms) {
      const s = norm(syn);
      if (s.length < 3) continue;
      const part = H.find(x => x.n.includes(s));
      if (part) return part.h;
    }
    return '';
  }

  function isNumericCol(rows, col) {
    let n = 0, ok = 0;
    for (const r of rows.slice(0, 50)) {
      const v = r[col];
      if (v === '' || v === null || v === undefined) continue;
      n++;
      if (!isNaN(num(v))) ok++;
    }
    return n > 0 && ok / n > 0.8;
  }

  function groupSum(rows, keyCol, valCols) {
    const map = new Map();
    for (const r of rows) {
      const k = r[keyCol] === undefined || r[keyCol] === '' ? '(blank)' : String(r[keyCol]);
      if (!map.has(k)) map.set(k, Object.fromEntries(valCols.map(c => [c, 0])));
      const acc = map.get(k);
      for (const c of valCols) acc[c] += n0(r[c]);
    }
    return map;
  }

  const sum = arr => arr.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
  const mean = arr => arr.length ? sum(arr) / arr.length : NaN;
  function stdev(arr) {
    if (arr.length < 2) return NaN;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
  }
  function quantile(arr, q) {
    if (!arr.length) return NaN;
    const s = [...arr].sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }

  function toCSV(headers, rows) {
    const q = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [headers.map(q).join(','), ...rows.map(r => headers.map(h => q(r[h])).join(','))].join('\n');
  }
  function download(name, content, type = 'text/csv') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* Settings (non-sensitive prefs) in localStorage */
  const settings = {
    get(k, d) {
      try { const v = localStorage.getItem('ocd.' + k); return v === null ? d : JSON.parse(v); } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('ocd.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ }
    }
  };

  /* Event bus */
  const listeners = {};
  const bus = {
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit(ev, data) { (listeners[ev] || []).forEach(fn => fn(data)); }
  };

  Object.assign(App, { $, $$, esc, uid, num, n0, toDate, dateKey, fmt, findCol, isNumericCol, groupSum, sum, mean, stdev, quantile, toCSV, download, settings, bus });
})(window.App);
