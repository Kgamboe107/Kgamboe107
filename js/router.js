/* Upload router for roll-up views (Everything, Business dashboard, Personal dashboard): works out which unit each
   file belongs to from its name and contents, and asks when it can't tell. */
(function (App) {
  const { esc } = App;
  const BIZ = /crunch\s*time|crunchtime|harri|labor|timesheet|net sales|guest count|\bsmg\b|full ?scale|trend\d?report|purchase ?journal|actual vs|\bavt\b|inventory|employee|roster|payroll register|sysco|us foods|restaurant depot|profit (and|&) loss|\bp&l\b|campaign|impressions|theoretical|store #|food cost|menu item/i;
  const PERSONAL = /cash ?app|venmo|paypal|positions|portfolio|brokerage|fidelity|schwab|vanguard|robinhood|webull|e\*?trade|\b401\(?k|\bira\b|roth|\bhsa\b|paystub|pay stub|\bw-?2\b|1099|mortgage|household|family|monarch|\bmint\b|ynab|rocket money|personal|net worth|amex|discover card/i;

  async function sniff(file) {
    const name = file.name || '';
    let text = '';
    if (/\.(csv|tsv|txt|md|ofx|qfx|qbo)$/i.test(name) || /^text\//.test(file.type)) { try { text = (await file.slice(0, 20000).text()); } catch { /* binary */ } }
    return (name + '\n' + text).replace(/[_]+/g, ' ');
  }
  function guess(sample, units) {
    const low = sample.toLowerCase();
    // 1) A unit's name or store number appears in the file name or contents
    let best = null;
    for (const u of units) {
      const words = String(u.name).toLowerCase().split(/[^a-z0-9#]+/).filter(w => w.length >= 4 && !/^(main|business|personal|family|finances?|the|and|store|household)$/.test(w));
      const nums = String(u.name + ' ' + (u.description || '')).match(/\b\d{3,6}\b/g) || [];
      const score = words.filter(w => low.includes(w)).length * 2 + nums.filter(n => low.includes(n)).length * 3;
      if (score && (!best || score > best.score)) best = { u, score };
    }
    if (best) return { id: best.u.id, why: `mentions “${best.u.name}”`, sure: true };
    // 2) The kind of file (business report vs personal statement)
    const isBiz = BIZ.test(sample), isPer = PERSONAL.test(sample);
    const kind = isBiz && !isPer ? 'business' : isPer && !isBiz ? 'individual' : null;
    if (kind) {
      const of = units.filter(u => App.biz.kindOf(u) === kind);
      if (of.length === 1) return { id: of[0].id, why: kind === 'business' ? 'business report' : 'personal statement', sure: true };
      if (of.length) return { id: of[0].id, why: kind === 'business' ? 'looks like a business report' : 'looks like a personal statement', sure: false };
    }
    return { id: null, why: 'couldn’t tell', sure: false };
  }

  /* Returns [{ file, unit }] or null if cancelled */
  async function plan(files) {
    const units = App.biz.inView().filter(u => !u.archived);
    if (units.length <= 1) return files.map(f => ({ file: f, unit: units[0]?.id || App.biz.target() }));
    const rows = [];
    for (const f of files) rows.push({ file: f, ...guess(await sniff(f), units) });
    if (rows.every(r => r.sure)) {
      const by = {}; rows.forEach(r => by[r.id] = (by[r.id] || 0) + 1);
      App.ui.toast(`Filed ${Object.entries(by).map(([id, n]) => `${n} into ${App.biz.get(id)?.name}`).join(', ')} (detected automatically)`, 4500);
      return rows.map(r => ({ file: r.file, unit: r.id }));
    }
    const opts = sel => ['business', 'individual'].map(k => {
      const us = units.filter(u => App.biz.kindOf(u) === k);
      return us.length ? `<optgroup label="${k === 'business' ? 'Business' : 'Personal'}">${us.map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</optgroup>` : '';
    }).join('');
    return new Promise(resolve => {
      let done = false;
      App.ui.modal(`<div class="row spread"><h2>Which section should ${rows.length > 1 ? 'these files' : 'this file'} go to?</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
        <p class="muted small">You’re on the ${esc(App.biz.masterLabel())} view, which covers several units. Pick where each file belongs; the ones the app recognized are filled in.</p>
        ${rows.length > 1 ? `<label class="field">Put all of them in<select id="rtAll" data-native><option value="">Choose for each file below</option>${opts('')}</select></label>` : ''}
        <div class="rt-list">${rows.map((r, i) => `<div class="rt-row"><div class="rt-file"><b>${esc(r.file.name)}</b><span class="muted tiny">${r.id ? esc(r.why) : 'not sure, please choose'}</span></div>
          <select data-rt="${i}" data-native>${r.id ? '' : '<option value="">Choose…</option>'}${opts(r.id)}</select></div>`).join('')}</div>
        <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="rtGo">Import</button></div>`, (c, close) => {
        c.querySelector('#rtAll')?.addEventListener('change', e => { if (e.target.value) c.querySelectorAll('[data-rt]').forEach(s => { s.value = e.target.value; }); });
        c.querySelector('#rtGo').onclick = () => {
          const picks = [...c.querySelectorAll('[data-rt]')].map(s => s.value);
          if (picks.some(v => !v)) { App.ui.toast('Choose a section for every file'); return; }
          done = true; close(); resolve(rows.map((r, i) => ({ file: r.file, unit: picks[i] })));
        };
        const finish = () => { if (!done) { done = true; resolve(null); } };
        c.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', finish));
        document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') finish(); }, { once: true });
      });
    });
  }

  App.router = { plan, guess };
})(window.App);
