/* Legal & Risk: lawsuit-risk check, legal document generator, signature tracking, incident log */
(function (App) {
  const { esc, fmt } = App;
  const L = () => App.legal;
  let tab = 'risk';
  const TABS = [['risk', 'Risk check'], ['docs', 'Documents'], ['signatures', 'Signatures'], ['incidents', 'Incident log'], ['profile', 'Business details']];
  const FIX = { privacy: 'privacy', webada: 'accessibility', smsconsent: 'sms', emailrules: 'email', contractors: 'contractor', handbook: 'handbook-ack', biometric: 'biometric', breachplan: 'breach', allergen: 'signage', alcoholtrain: 'signage', posters: 'signage', floors: '#incidents', incidents: '#incidents', i9: '@personnel', gl: '@compliance:licenses', liquor: '@compliance:licenses', wc: '@compliance:licenses', epli: '@compliance:licenses', cyber: '@compliance:licenses', auto: '@compliance:licenses', entity: '@compliance:setup', separate: '@purchases', encryption: '@settings', overtime: '@operations' };

  App.modules.legal = {
    async render(view, params = {}) {
      if (params.tab) tab = params.tab;
      if (App.biz.isMaster()) {
        view.innerHTML = App.ui.empty('Legal documents and risk are tracked per business (each has its own legal entity, insurance and policies). Pick a business.', `<div class="row" style="justify-content:center">${App.biz.active().map(b => `<button class="btn" data-biz="${b.id}">${esc(b.name)}</button>`).join('')}</div>`);
        view.querySelectorAll('[data-biz]').forEach(b => b.onclick = () => { App.biz.setCurrent(b.dataset.biz); App.go('legal'); });
        return;
      }
      view.innerHTML = `
        <div class="card row spread no-print"><div class="tabs" style="background:none;padding:0">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div></div>
        <div class="alert small" style="background:var(--panel-2)">Templates and checklists to help you reduce legal risk. They are not legal advice and don't create an attorney-client relationship. Laws vary by state and city, so have a licensed attorney in your state review documents before you rely on them.</div>
        <div id="lgBody" class="stack" style="gap:16px"></div>`;
      view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; App.go('legal'); });
      const body = view.querySelector('#lgBody');
      const a = await L().assess();
      publish(a);
      await ({ risk, docs, signatures, incidents, profile })[tab](body, a);
    }
  };

  function publish(a) {
    const open = App.bsettings.get('legal.incidents', []).filter(i => i.status !== 'Closed' && i.type !== 'Routine safety check').length;
    const flags = a.gaps.filter(g => g.sev === 3).map(g => 'High risk: ' + g.q);
    App.ui.publish('legal', { score: a.score, high: a.gaps.filter(g => g.sev === 3).length, gaps: a.gaps.length, openIncidents: open, alerts: flags.length + (open ? 1 : 0), flags: [...flags, ...(open ? [`${open} open incident${open > 1 ? 's' : ''} in the log`] : [])].slice(0, 12) });
  }

  function go(fix) {
    if (!fix) return;
    if (fix.startsWith('#')) { tab = fix.slice(1); App.go('legal'); return; }
    if (fix.startsWith('@')) { const [r, t] = fix.slice(1).split(':'); App.go(r, t ? { tab: t } : {}); return; }
    openDoc(fix);
  }

  /* ---------- Risk check ---------- */
  async function risk(body, a) {
    const cats = [...new Set(a.items.map(i => i.cat))];
    const tone = isNaN(a.score) ? '' : a.score >= 0.85 ? 'good' : a.score >= 0.6 ? 'warn' : 'bad';
    const sevB = s => s === 3 ? '<span class="badge bad">High</span>' : s === 2 ? '<span class="badge warn">Medium</span>' : '<span class="badge">Low</span>';
    body.innerHTML = `
      <div class="grid k4">
        <div class="card kpi ${tone}"><div class="label">Lawsuit protection</div><div class="value">${isNaN(a.score) ? '—' : Math.round(a.score * 100) + '%'}</div><div class="sub muted">weighted by risk · ${a.items.length - a.unanswered} of ${a.items.length} answered</div><div class="meter"><i style="width:${isNaN(a.score) ? 0 : Math.round(a.score * 100)}%"></i></div></div>
        ${App.ui.kpi('High-risk gaps', fmt.num(a.gaps.filter(g => g.sev === 3).length), 'fix these first', a.gaps.some(g => g.sev === 3) ? 'bad' : 'good')}
        ${App.ui.kpi('All gaps', fmt.num(a.gaps.length), `${a.unanswered} unanswered`)}
        ${App.ui.kpi('Documents saved', fmt.num(Object.keys(App.bsettings.get('legal.docs', {})).length), `of ${L().DOCS.filter(d => d.when(a.p)).length} that apply`)}
      </div>
      ${a.gaps.length ? `<div class="card"><div class="card-head"><h2>Fix first</h2><span class="muted small">highest risk at the top</span></div><div class="stack">
        ${a.gaps.slice(0, 8).map(g => `<div class="alert ${g.sev === 3 ? 'bad' : 'warn'}" style="flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>${esc(g.q)}</b><div class="small muted">${esc(g.why)}</div>${g.auto?.note ? `<div class="small" style="margin-top:4px">${esc(g.auto.note)}</div>` : ''}</div>${FIX[g.id] ? `<button class="btn small" data-fix="${esc(FIX[g.id])}">Fix →</button>` : ''}</div>`).join('')}</div></div>` : ''}
      ${cats.map(c => `<div class="card"><div class="card-head"><h2>${esc(c)}</h2></div><div class="stack">
        ${a.items.filter(i => i.cat === c).map(i => `<div class="risk-q">
          <div style="flex:1;min-width:240px"><div class="row" style="gap:8px">${sevB(i.sev)}<b class="small">${esc(i.q)}</b></div>
            <div class="muted tiny" style="margin-top:3px">${esc(i.why)}</div>
            ${i.auto?.note ? `<div class="tiny" style="margin-top:3px"><span class="badge accent">from your data</span> ${esc(i.auto.note)}</div>` : ''}</div>
          <div class="seg yn">${[['yes', 'Yes'], ['no', 'No'], ['na', 'N/A']].map(([v, l]) => `<button data-q="${i.id}" data-v="${v}" class="${i.ans === v ? 'on ' + v : ''}">${l}</button>`).join('')}</div>
        </div>`).join('')}</div></div>`).join('')}
      <div class="muted tiny">Answers marked "from your data" fill in automatically from your licenses, receipts, timesheets, personnel files and contractors. Clicking an answer overrides them.</div>`;
    body.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => go(b.dataset.fix));
    body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const ans = App.bsettings.get('legal.answers', {});
      ans[b.dataset.q] = ans[b.dataset.q] === b.dataset.v ? 'auto' : b.dataset.v;
      App.bsettings.set('legal.answers', ans);
      App.compliance?.audit('Risk check answered', `${L().Q.find(q => q.id === b.dataset.q)?.q}: ${ans[b.dataset.q]}`);
      App.go('legal');
    });
  }

  /* ---------- Documents ---------- */
  const docText = (d, p) => App.bsettings.get('legal.docs', {})[d.id]?.text || d.body(p);
  function renderDoc(text) {
    return App.ai.md(text).replace(/\[(___|[A-Z0-9][A-Z0-9 _/.,#'’()&:-]{1,60})\]/g, '<mark class="ph">[$1]</mark>');
  }
  function docHTML(title, text) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111;max-width:720px;margin:40px auto;padding:0 24px}
      h1{font-size:20pt;margin:0 0 8px}h2{font-size:13pt;margin:18px 0 6px}h3,h4{font-size:11.5pt}
      blockquote{border-left:3px solid #999;margin:10px 0;padding:6px 12px;background:#f5f5f5}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px 8px;text-align:left}mark{background:#fff3a3}
      .foot{margin-top:28px;font-size:8.5pt;color:#666;border-top:1px solid #ddd;padding-top:8px}</style></head>
      <body>${renderDoc(text)}<div class="foot">Template generated with Ops Command Desk. Not legal advice. Review with a licensed attorney in your state.</div></body></html>`;
  }
  function printHTML(html) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300);
  }

  async function docs(body, a) {
    const p = a.p, saved = App.bsettings.get('legal.docs', {}), sig = App.bsettings.get('legal.signed', []);
    const missing = ['legalName', 'address', 'city', 'state', 'email', 'phone'].filter(k => !p[k]);
    const groups = [...new Set(L().DOCS.map(d => d.audience))];
    body.innerHTML = `
      ${missing.length ? `<div class="alert warn">Fill in your <a data-goprofile>business details</a> (${missing.join(', ')}) so documents come out complete. Missing items show as <mark class="ph">[highlighted]</mark> blanks.</div>` : ''}
      ${groups.map(g => `<div class="card"><div class="card-head"><h2>${esc(g)}</h2></div><div class="grid c3">
        ${L().DOCS.filter(d => d.audience === g).map(d => { const on = d.when(p); const s = saved[d.id]; const n = sig.filter(x => x.doc === d.id).length;
          return `<div class="card doc-card ${on ? '' : 'dim'}" data-doc="${d.id}">
            <div class="row spread"><b>${esc(d.title)}</b>${s ? `<span class="badge good">v${s.version} saved</span>` : on ? '<span class="badge warn">not created</span>' : '<span class="badge">optional</span>'}</div>
            <div class="muted tiny">${esc(d.risk)}</div>
            <div class="row spread"><span class="muted tiny">${s ? 'Saved ' + new Date(s.savedAt).toLocaleDateString() : ''}${d.sign ? ` · ${n} signed` : ''}</span><button class="btn small ${s ? '' : 'primary'}">${s ? 'Open' : 'Create'}</button></div>
          </div>`; }).join('')}</div></div>`).join('')}`;
    body.querySelector('[data-goprofile]')?.addEventListener('click', () => { tab = 'profile'; App.go('legal'); });
    body.querySelectorAll('[data-doc]').forEach(c => c.onclick = () => openDoc(c.dataset.doc));
  }

  function openDoc(id) {
    const d = L().DOCS.find(x => x.id === id); if (!d) return;
    const p = L().profile();
    const saved = App.bsettings.get('legal.docs', {})[id];
    let text = docText(d, p);
    const blanks = () => (text.match(/\[(___|[A-Z0-9][A-Z0-9 _/.,#'’()&:-]{1,60})\]/g) || []).length;
    App.ui.modal(`<div class="card-head"><h2>${esc(d.title)}</h2><div class="row"><span class="muted small" id="dbl"></span><button class="btn small" data-close>Close</button></div></div>
      <div class="muted small" style="margin-bottom:10px">${esc(d.risk)}</div>
      <div class="tabs" style="margin-bottom:10px"><button class="active" data-m="preview">Preview</button><button data-m="edit">Edit text</button></div>
      <div id="dPrev" class="doc-prev">${renderDoc(text)}</div>
      <textarea id="dEdit" rows="22" style="display:none;font-family:ui-monospace,Menlo,monospace;font-size:12.5px">${esc(text)}</textarea>
      <div class="row spread" style="margin-top:12px">
        <div class="row">
          <button class="btn primary" id="dSave">${App.fx.icon('check')} Save version</button>
          <button class="btn" id="dWord">${App.fx.icon('download')} Word</button>
          <button class="btn" id="dPdf">${App.fx.icon('printer')} Print / PDF</button>
          <button class="btn" id="dCopy">Copy text</button>
        </div>
        <div class="row">${saved ? `<button class="btn ghost small" id="dReset">Regenerate from details</button>` : ''}${d.sign ? `<button class="btn small" id="dSign">Record a signature</button>` : ''}</div>
      </div>
      <div class="muted tiny" style="margin-top:8px">${saved ? `Version ${saved.version}, saved ${new Date(saved.savedAt).toLocaleString()}. ` : ''}Saving keeps a dated copy in your Data Library so you can prove which version was in effect.</div>`, (card, close) => {
      card.classList.add('wide');
      const $ = s => card.querySelector(s);
      const upd = () => { $('#dbl').innerHTML = blanks() ? `<span class="badge warn">${blanks()} blank${blanks() > 1 ? 's' : ''} to fill</span>` : '<span class="badge good">complete</span>'; };
      upd();
      card.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
        card.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('active', x === b));
        const edit = b.dataset.m === 'edit';
        if (!edit) { text = $('#dEdit').value; $('#dPrev').innerHTML = renderDoc(text); upd(); }
        $('#dEdit').style.display = edit ? '' : 'none'; $('#dPrev').style.display = edit ? 'none' : '';
      });
      $('#dEdit').oninput = () => { text = $('#dEdit').value; upd(); };
      const cur = () => ($('#dEdit').style.display === 'none' ? text : $('#dEdit').value);
      const fname = `${(p.dba || p.legalName || 'Business').replace(/[^\w\- ]/g, '')} - ${d.title.replace(/[^\w\- ]/g, '')}`;
      $('#dSave').onclick = async () => {
        text = cur();
        const all = App.bsettings.get('legal.docs', {});
        const version = (all[id]?.version || 0) + 1;
        const file = new File([docHTML(d.title, text)], `${fname} v${version} ${new Date().toISOString().slice(0, 10)}.html`, { type: 'text/html' });
        const [f] = await App.ingest.ingestMany([file], { quiet: true, category: 'report', tags: ['Legal', d.title] });
        all[id] = { text, version, savedAt: Date.now(), fileId: f?.id };
        App.bsettings.set('legal.docs', all);
        App.compliance?.audit('Legal document saved', `${d.title} v${version}`);
        App.ui.toast(`${d.title} v${version} saved`); close(); App.go('legal');
      };
      $('#dWord').onclick = () => App.download(fname + '.doc', new Blob(['﻿' + docHTML(d.title, cur())], { type: 'application/msword' }));
      $('#dPdf').onclick = () => printHTML(docHTML(d.title, cur()));
      $('#dCopy').onclick = () => { navigator.clipboard?.writeText(cur()); App.ui.toast('Copied. Paste into your website builder.'); };
      $('#dReset')?.addEventListener('click', async () => { if (!await App.confirm({ title: 'Replace your edits with a fresh draft?', body: 'The editor is refilled from your business details. Versions you already saved stay in the Data Library.', ok: 'Replace with fresh draft', cancel: 'Keep my edits' })) return; text = d.body(L().profile()); $('#dEdit').value = text; $('#dPrev').innerHTML = renderDoc(text); upd(); });
      $('#dSign')?.addEventListener('click', () => { close(); signDialog(id); });
    });
  }

  /* ---------- Signatures ---------- */
  async function people() {
    const out = [];
    const roster = (await App.store.datasets()).find(d => d.category === 'personnel' && App.findCol(d.headers, ['employee name', 'employee', 'name']));
    if (roster) {
      const nc = App.findCol(roster.headers, ['employee name', 'employee', 'name']), sc = App.findCol(roster.headers, ['status']), tc = App.findCol(roster.headers, ['termination date', 'term date']);
      roster.rows.filter(r => !(sc && /term|inactive|former/i.test(r[sc])) && !(tc && r[tc])).forEach(r => out.push({ name: String(r[nc]).trim(), role: 'employee' }));
    }
    if (App.compliance) (await App.compliance.contractors(new Date().getFullYear())).filter(c => c.needs).forEach(c => out.push({ name: c.name, role: 'contractor' }));
    return out;
  }

  function signDialog(docId, person) {
    const signable = L().DOCS.filter(d => d.sign);
    people().then(pp => App.ui.modal(`<div class="card-head"><h2>Record a signature</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="stack"><div class="mapper">
        <label>Document<select id="sgD">${signable.map(d => `<option value="${d.id}" ${d.id === docId ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</select></label>
        <label>Signed by<input id="sgP" list="sgPL" value="${esc(person || '')}" placeholder="Name"><datalist id="sgPL">${pp.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist></label>
        <label>Date signed<input type="date" id="sgDt" value="${new Date().toISOString().slice(0, 10)}"></label>
        <label>How<select id="sgM">${App.ui.options(['Paper (wet signature)', 'E-signature', 'Clicked "I agree"'], 'Paper (wet signature)')}</select></label>
      </div>
      <div class="row"><label class="btn small">${App.fx.icon('upload')} Attach signed copy<input type="file" id="sgF" hidden></label><span class="muted tiny" id="sgFn"></span></div>
      <div class="row"><button class="btn primary" id="sgS">Save</button></div></div>`, (card, close) => {
      let file = null;
      card.querySelector('#sgF').onchange = e => { file = e.target.files[0]; card.querySelector('#sgFn').textContent = file ? '📎 ' + file.name : ''; };
      card.querySelector('#sgS').onclick = async () => {
        const name = card.querySelector('#sgP').value.trim(); if (!name) return App.ui.toast('Who signed?');
        const doc = card.querySelector('#sgD').value, d = L().DOCS.find(x => x.id === doc);
        const rec = { id: App.uid(), doc, person: name, role: d.sign, date: card.querySelector('#sgDt').value, method: card.querySelector('#sgM').value, version: App.bsettings.get('legal.docs', {})[doc]?.version || null };
        if (file) { const tags = ['Legal', d.title]; if (d.sign === 'employee') tags.push(name); const [f] = await App.ingest.ingestMany([file], { quiet: true, category: d.sign === 'employee' ? 'personnel' : 'report', tags }); if (f) { rec.fileId = f.id; rec.fileName = f.name; } }
        const all = App.bsettings.get('legal.signed', []); all.push(rec); App.bsettings.set('legal.signed', all);
        App.compliance?.audit('Signature recorded', `${d.title}: ${name} (${rec.date}, ${rec.method})`);
        close(); tab = 'signatures'; App.go('legal');
      };
    }));
  }

  async function signatures(body, a) {
    const sig = App.bsettings.get('legal.signed', []), pp = await people(), p = a.p;
    const empDocs = L().DOCS.filter(d => d.sign === 'employee' && d.when(p));
    const conDocs = L().DOCS.filter(d => d.sign === 'contractor' && d.when(p));
    const has = (doc, name) => sig.some(s => s.doc === doc && App.purchasing.norm(s.person) === App.purchasing.norm(name));
    const emps = pp.filter(x => x.role === 'employee'), cons = pp.filter(x => x.role === 'contractor');
    const missingE = emps.filter(e => empDocs.some(d => !has(d.id, e.name)));
    body.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Employees fully signed', `${emps.length - missingE.length} / ${emps.length}`, empDocs.map(d => d.title.split(' (')[0]).join(', ') || 'no employee documents apply', missingE.length ? 'warn' : 'good')}
        ${App.ui.kpi('Contractor agreements', `${cons.filter(c => conDocs.every(d => has(d.id, c.name))).length} / ${cons.length}`, '1099 contractors this year', cons.some(c => !conDocs.every(d => has(d.id, c.name))) ? 'warn' : 'good')}
        ${App.ui.kpi('Signatures recorded', fmt.num(sig.length), 'all documents')}
      </div>
      <div class="card"><div class="card-head"><h2>Who still needs to sign</h2><button class="btn small primary" id="sgNew">${App.fx.icon('plus')} Record signature</button></div>
        ${emps.length || cons.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th>${[...empDocs, ...conDocs].map(d => `<th>${esc(d.title.split(' (')[0].replace('Employee ', ''))}</th>`).join('')}</tr></thead><tbody>
          ${[...emps, ...cons].map(x => `<tr><td>${esc(x.name)}</td><td><span class="badge">${x.role}</span></td>${[...empDocs, ...conDocs].map(d => d.sign !== x.role ? '<td class="muted">—</td>' : has(d.id, x.name) ? '<td><span class="badge good">✓ signed</span></td>' : `<td><button class="btn small" data-sign="${d.id}" data-person="${esc(x.name)}">Record</button></td>`).join('')}</tr>`).join('')}
        </tbody></table></div>` : '<div class="muted small">Add an employee roster (Personnel) or mark 1099 contractors (Tax & Compliance) to see who needs to sign what.</div>'}</div>
      <div class="card"><div class="card-head"><h2>Signature records</h2><button class="btn small" id="sgCsv">${App.fx.icon('download')} CSV</button></div><div id="sgT"></div></div>`;
    body.querySelector('#sgNew').onclick = () => signDialog();
    body.querySelectorAll('[data-sign]').forEach(b => b.onclick = () => signDialog(b.dataset.sign, b.dataset.person));
    const rows = sig.map(s => ({ ...s, title: L().DOCS.find(d => d.id === s.doc)?.title || s.doc })).sort((x, y) => y.date.localeCompare(x.date));
    App.ui.table(body.querySelector('#sgT'), [
      { key: 'date', label: 'Date' }, { key: 'person', label: 'Signed by' }, { key: 'title', label: 'Document' }, { key: 'version', label: 'Version', fmt: v => v ? 'v' + v : '—' },
      { key: 'method', label: 'How' }, { key: 'fileName', label: 'Copy', fmt: (v, r) => v ? `<a data-file="${r.fileId}">📎 view</a>` : '<span class="badge warn">no copy</span>' }
    ], rows, { limit: 500 });
    body.querySelectorAll('[data-file]').forEach(x => x.onclick = async () => { const f = await App.store.get('files', x.dataset.file); if (f?.blob) window.open(URL.createObjectURL(f.blob), '_blank'); });
    body.querySelector('#sgCsv').onclick = () => App.download('signatures.csv', App.toCSV(['date', 'person', 'role', 'title', 'version', 'method', 'fileName'], rows));
  }

  /* ---------- Incident log ---------- */
  const TYPES = ['Customer injury (slip, trip, fall)', 'Employee injury', 'Allergic reaction', 'Foodborne illness complaint', 'Alcohol / intoxicated guest', 'Fight / security / police', 'Harassment or discrimination complaint', 'Property damage', 'Theft', 'Data or security breach', 'Customer complaint (other)', 'Routine safety check'];
  async function incidents(body) {
    const list = App.bsettings.get('legal.incidents', []).sort((a, b) => (b.when || '').localeCompare(a.when || ''));
    const open = list.filter(i => i.status !== 'Closed' && i.type !== 'Routine safety check');
    const checks = list.filter(i => i.type === 'Routine safety check');
    const lastCheck = checks[0]?.when;
    body.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Open incidents', fmt.num(open.length), 'need follow-up', open.length ? 'warn' : 'good')}
        ${App.ui.kpi('Incidents this year', fmt.num(list.filter(i => i.type !== 'Routine safety check' && (i.when || '').startsWith(String(new Date().getFullYear()))).length), '')}
        ${App.ui.kpi('Safety checks logged', fmt.num(checks.length), lastCheck ? 'last ' + new Date(lastCheck).toLocaleString() : 'none yet', checks.length ? 'good' : 'warn')}
      </div>
      <div class="card row spread"><div class="muted small" style="flex:1;min-width:240px">Write it up the same day. Claims often arrive months later, and notes, photos and witness names recorded at the time are what win (or prevent) lawsuits. Never admit fault in the report; stick to facts.</div>
        <div class="row"><button class="btn" id="icCheck">${App.fx.icon('check')} Log floor / safety check</button><button class="btn primary" id="icNew">${App.fx.icon('plus')} New incident</button></div></div>
      <div class="card"><div class="card-head"><h2>Incident log</h2><button class="btn small" id="icCsv">${App.fx.icon('download')} CSV</button></div><div id="icT"></div></div>`;
    App.ui.table(body.querySelector('#icT'), [
      { key: 'when', label: 'When', fmt: (v, r) => `<a data-ic="${r.id}">${v ? new Date(v).toLocaleString() : '—'}</a>` }, { key: 'type', label: 'Type' },
      { key: 'location', label: 'Where' }, { key: 'people', label: 'Who' },
      { key: 'insurer', label: 'Insurer notified', fmt: v => v ? `<span class="badge good">${esc(v)}</span>` : '—' },
      { key: 'photos', label: 'Photos', num: true, fmt: v => (v || []).length || '—' },
      { key: 'status', label: 'Status', fmt: (v, r) => r.type === 'Routine safety check' ? '<span class="badge">check</span>' : `<span class="badge ${v === 'Closed' ? 'good' : 'warn'}">${esc(v || 'Open')}</span>` }
    ], list, { limit: 500 });
    body.querySelectorAll('[data-ic]').forEach(x => x.onclick = () => incidentDialog(list.find(i => i.id === x.dataset.ic)));
    body.querySelector('#icNew').onclick = () => incidentDialog();
    body.querySelector('#icCheck').onclick = () => App.ui.modal(`<div class="card-head"><h2>Log safety check</h2><button class="btn small" data-close>Cancel</button></div>
      <div class="stack"><div class="mapper"><label>Area<select id="ckA">${App.ui.options(['Dining room floors', 'Restrooms', 'Entrance & parking', 'Kitchen floors', 'Walk-in / storage', 'Patio'], 'Dining room floors')}</select></label><label>Checked by (initials)<input id="ckB" maxlength="20"></label></div>
      <label class="field">Notes<input id="ckN" placeholder="e.g. Mopped spill by booth 4, wet-floor sign placed"></label><div class="row"><button class="btn primary" id="ckS">Log check</button></div></div>`, (card, close) => {
      card.querySelector('#ckS').onclick = () => {
        const all = App.bsettings.get('legal.incidents', []);
        all.push({ id: App.uid(), type: 'Routine safety check', when: new Date().toISOString(), location: card.querySelector('#ckA').value, people: card.querySelector('#ckB').value, description: card.querySelector('#ckN').value, status: 'Closed', created: Date.now() });
        App.bsettings.set('legal.incidents', all); App.compliance?.audit('Safety check logged', card.querySelector('#ckA').value); close(); App.go('legal');
      };
    });
    body.querySelector('#icCsv').onclick = () => App.download('incident-log.csv', App.toCSV(['when', 'type', 'location', 'people', 'witnesses', 'description', 'injuries', 'actions', 'police', 'insurer', 'status', 'followup'], list));
  }

  function incidentDialog(i) {
    const isNew = !i;
    i = i || { id: App.uid(), when: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), status: 'Open', photos: [] };
    const whenLocal = (i.when || '').slice(0, 16);
    App.ui.modal(`<div class="card-head"><h2>${isNew ? 'New incident report' : 'Incident report'}</h2><button class="btn small" data-close>Close</button></div>
      <div class="stack"><div class="mapper">
        <label>Date & time<input type="datetime-local" id="iW" value="${esc(whenLocal)}"></label>
        <label>Type<select id="iT">${App.ui.options(TYPES, i.type || TYPES[0])}</select></label>
        <label>Where<input id="iL" value="${esc(i.location || '')}" placeholder="e.g. by restroom hallway"></label>
        <label>Status<select id="iS">${App.ui.options(['Open', 'Waiting on insurer', 'Closed'], i.status || 'Open')}</select></label>
      </div>
      <label class="field">People involved (names, contact)<input id="iP" value="${esc(i.people || '')}"></label>
      <label class="field">Witnesses (names, phone)<input id="iWi" value="${esc(i.witnesses || '')}"></label>
      <label class="field">What happened: facts only, in order. Don't guess or admit fault.<textarea id="iD" rows="5">${esc(i.description || '')}</textarea></label>
      <label class="field">Injuries / damage observed<input id="iI" value="${esc(i.injuries || '')}"></label>
      <label class="field">Actions taken (first aid, 911, cleaned up, refused service, footage saved…)<input id="iA" value="${esc(i.actions || '')}"></label>
      <div class="mapper"><label>Police report #<input id="iPo" value="${esc(i.police || '')}"></label><label>Insurer / claim # (date notified)<input id="iIn" value="${esc(i.insurer || '')}"></label></div>
      <label class="field">Follow-up notes<input id="iF" value="${esc(i.followup || '')}"></label>
      <div class="row"><label class="btn small">${App.fx.icon('upload')} Add photos / documents<input type="file" id="iPh" multiple hidden></label><span class="muted tiny" id="iPn">${(i.photos || []).length ? (i.photos.length + ' attached') : ''}</span></div>
      <div class="alert small" style="background:var(--panel-2)">Save security-camera footage of the incident now; most systems overwrite it within days. For injuries, notify your insurer promptly; late notice can void coverage.</div>
      <div class="row"><button class="btn primary" id="iSave">Save report</button></div></div>`, (card, close) => {
      card.classList.add('wide');
      const $ = s => card.querySelector(s);
      let files = [];
      $('#iPh').onchange = e => { files = [...e.target.files]; $('#iPn').textContent = `${(i.photos || []).length + files.length} attached`; };
      $('#iSave').onclick = async () => {
        Object.assign(i, { when: $('#iW').value, type: $('#iT').value, location: $('#iL').value.trim(), status: $('#iS').value, people: $('#iP').value.trim(), witnesses: $('#iWi').value.trim(), description: $('#iD').value.trim(), injuries: $('#iI').value.trim(), actions: $('#iA').value.trim(), police: $('#iPo').value.trim(), insurer: $('#iIn').value.trim(), followup: $('#iF').value.trim(), updated: Date.now() });
        if (!i.description) return App.ui.toast('Describe what happened');
        if (files.length) { const fs = await App.ingest.ingestMany(files, { quiet: true, category: 'report', tags: ['Incident', i.type, i.when.slice(0, 10)] }); i.photos = [...(i.photos || []), ...fs.map(f => f.id)]; }
        const all = App.bsettings.get('legal.incidents', []).filter(x => x.id !== i.id); all.push(i); App.bsettings.set('legal.incidents', all);
        App.compliance?.audit(isNew ? 'Incident reported' : 'Incident updated', `${i.type} · ${i.when} · ${i.status}`);
        close(); App.ui.toast('Incident report saved'); App.go('legal');
      };
    });
  }

  /* ---------- Business details ---------- */
  async function profile(body, a) {
    const p = a.p;
    const f = (k, l, ph = '', type = 'text', mask = '') => `<label>${l}<input data-k="${k}" type="${type}" value="${esc(p[k] || '')}" placeholder="${esc(ph)}"${mask ? ` data-mask="${mask}"` : ''}></label>`;
    body.innerHTML = `<div class="card stack"><div><h2>Business details used in your documents</h2><div class="muted small">Three short steps. Everything stays on this computer.</div></div>
      <div class="stack" data-steps>
        <section data-step="Who you are" class="form-group">
          <div class="mapper">${f('legalName', 'Legal name (as registered)', 'Gamboe Hospitality LLC')}${f('dba', 'DBA / brand name', 'The Corner Diner')}${f('owner', 'Owner / privacy contact', 'Your name')}${f('effective', 'Effective date for policies', '', 'date')}</div>
        </section>
        <section data-step="How to reach you" class="form-group">
          <div class="mapper">${f('address', 'Street address', '123 Main St')}${f('city', 'City')}${f('state', 'State', 'WA', 'text', 'state')}${f('zip', 'ZIP', '98101', 'text', 'zip')}
            ${f('email', 'Contact email', 'hello@yourbusiness.com', 'email')}${f('phone', 'Phone', '(555) 123-4567', 'tel', 'phone')}${f('website', 'Website', 'https://')}</div>
        </section>
        <section data-step="What you do" class="form-group">
          <div class="muted small">This decides which documents and risk checks apply.</div>
          <div class="check-grid">${L().PRACTICES.map(([k, l]) => `<label class="row small" style="color:var(--text)"><input type="checkbox" data-pr="${k}" ${L().has(p, k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
          <div class="row form-submit"><button class="btn primary" id="pfSave">Save business details</button></div>
        </section>
      </div></div>`;
    App.ux.steps(body.querySelector('[data-steps]'), { finish: '#pfSave' });
    body.querySelector('#pfSave').onclick = () => {
      const next = { practices: {} };
      body.querySelectorAll('[data-k]').forEach(i => next[i.dataset.k] = i.value.trim());
      body.querySelectorAll('[data-pr]').forEach(c => next.practices[c.dataset.pr] = c.checked);
      App.bsettings.set('legal.profile', next);
      App.compliance?.audit('Legal profile saved', next.legalName || '');
      App.ui.toast('Details saved'); tab = 'docs'; App.go('legal');
    };
  }

  App.legalOpenDoc = openDoc;
})(window.App);
