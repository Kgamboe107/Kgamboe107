/* Legal in Unit Command: the same engine and data as the Ops Command Desk's Legal & Risk (per-unit risk check,
   documents, signatures, incident log, business details), on one screen for every unit, plus Deal legal:
   an acquisition / franchise checklist and NDA and letter-of-intent drafts for each deal.
   Templates and checklists reduce risk; they are not legal advice. */
(function (UC) {
  const { esc } = App;
  const L = () => App.legal;
  UC.screens = UC.screens || {};
  let unitId = null, tab = 'fix';
  const units = () => App.biz.list().filter(b => !b.archived && App.biz.kindOf(b) === 'business');
  const W = (id, fn) => App.biz.withBiz(id, fn);
  const TYPES = ['Customer injury (slip, trip, fall)', 'Employee injury', 'Allergic reaction', 'Foodborne illness complaint', 'Alcohol / intoxicated guest', 'Fight / security / police', 'Harassment or discrimination complaint', 'Property damage', 'Theft', 'Data or security breach', 'Customer complaint (other)', 'Routine safety check'];
  const NOTE = 'Checklists and templates to reduce legal risk. Not legal advice; have a licensed attorney in your state review documents before you rely on them.';

  async function assessAll() {
    const out = [];
    for (const u of units()) { try { out.push({ u, a: await W(u.id, () => L().assess()) }); } catch (e) { out.push({ u, err: e.message }); } }
    return out;
  }
  UC.legalAssessAll = assessAll;

  UC.screens.legal = async (view, params = {}) => {
    if (params.tab) tab = params.tab;
    if (params.unit) unitId = params.unit;
    const us = units();
    const dealsInPlay = (await UC.deals.all()).filter(p => ['nda', 'loi', 'diligence', 'closed'].includes(p.stage) || p.legal);
    if (!us.length && tab !== 'deals') tab = 'deals';
    if (!unitId || !us.find(u => u.id === unitId)) unitId = us[0]?.id || null;
    const all = await assessAll();
    const cur = all.find(x => x.u.id === unitId);
    const pct = a => isNaN(a?.score) ? null : Math.round(a.score * 100);
    view.innerHTML = `
      <section class="card"><div class="uc-sh"><h2>Every unit</h2><span class="muted small">${NOTE}</span></div>
        <div class="uc-alist">${all.map(({ u, a, err }) => `<button class="uc-arow ${u.id === unitId ? 'on' : ''}" data-unit="${u.id}"><span class="uc-ring" style="--p:${pct(a) ?? 0}" title="${pct(a) ?? '—'}%"></span><span><b>${esc(u.name)}</b><span class="muted tiny">${err ? esc(err) : `${pct(a) === null ? 'Not checked yet' : pct(a) + '% protected'} · ${a.gaps.filter(g => g.sev === 3).length} high risk · ${a.unanswered} unanswered`}</span></span></button>`).join('') || '<div class="uc-empty">Add your units in Settings or Imports to check each one. Deal legal works without them.</div>'}
        ${dealsInPlay.length ? `<button class="uc-arow" data-ltab="deals"><span class="uc-dot" style="background:var(--gold)"></span><span><b>Deals in progress</b><span class="muted tiny">${dealsInPlay.length} under NDA, LOI or due diligence</span></span></button>` : ''}</div></section>
      <section class="card"><div class="seg uc-btabs">${[['fix', 'Fix first'], ['docs', 'Documents'], ['sign', 'Signatures'], ['inc', 'Incidents'], ['details', 'Details'], ['deals', 'Deals']].map(([k, l]) => `<button data-ltab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${tab !== 'deals' && cur ? `<div class="muted small" style="margin-top:10px">${esc(cur.u.name)}</div>` : ''}<div id="lgB" style="margin-top:10px"></div></section>`;
    const re = () => UC.go('legal', { keepScroll: true });
    view.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => { unitId = b.dataset.unit; if (tab === 'deals') tab = 'fix'; re(); });
    view.querySelectorAll('[data-ltab]').forEach(b => b.onclick = () => { tab = b.dataset.ltab; re(); });
    const body = view.querySelector('#lgB');
    if (tab === 'deals') return dealsTab(body, dealsInPlay, re);
    if (!cur || cur.err) { body.innerHTML = `<div class="uc-empty">${esc(cur?.err || 'Pick a unit.')}</div>`; return; }
    await W(unitId, () => ({ fix, docs, sign, inc, details })[tab](body, cur.a, re));
  };

  /* Fix first: gaps by severity, quick answers */
  function fix(el, a, re) {
    const sev = s => s === 3 ? ['High', 'bad'] : s === 2 ? ['Medium', 'accent'] : ['Low', ''];
    const row = i => `<div class="uc-lq"><div><span class="uc-chipt ${sev(i.sev)[1]}">${sev(i.sev)[0]}</span> <b>${esc(i.q)}</b><div class="muted tiny">${esc(i.why)}${i.auto?.note ? ` · <i>${esc(i.auto.note)}</i>` : ''}</div></div>
      <div class="seg uc-yn">${[['yes', 'Yes'], ['no', 'No']].map(([k, l]) => `<button data-ans="${i.id}" data-v="${k}" class="${i.ans === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    const gaps = a.items.filter(i => i.ans === 'no').sort((x, y) => y.sev - x.sev), open = a.items.filter(i => !i.ans).sort((x, y) => y.sev - x.sev), ok = a.items.filter(i => i.ans === 'yes');
    el.innerHTML = `<div class="uc-tiles">${UC.tile('Protected', isNaN(a.score) ? '—' : Math.round(a.score * 100) + '%')}${UC.tile('High risk', a.gaps.filter(g => g.sev === 3).length, '', a.gaps.some(g => g.sev === 3) ? 'bad' : '')}${UC.tile('Gaps', a.gaps.length)}${UC.tile('Unanswered', a.unanswered)}</div>
      ${gaps.length ? `<div class="uc-sh" style="margin-top:14px"><h3>Fix these</h3></div>${gaps.map(row).join('')}` : ''}
      ${open.length ? `<div class="uc-sh" style="margin-top:14px"><h3>Answer these</h3><span class="muted small">${open.length}</span></div>${open.map(row).join('')}` : ''}
      ${ok.length ? `<details class="uc-disclose" style="margin-top:12px"><summary class="small">${ok.length} already covered</summary>${ok.map(row).join('')}</details>` : ''}`;
    el.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => W(unitId, () => { const ans = App.bsettings.get('legal.answers', {}); ans[b.dataset.ans] = ans[b.dataset.ans] === b.dataset.v ? 'auto' : b.dataset.v; App.bsettings.set('legal.answers', ans); }).then(re));
  }

  /* Documents */
  function docs(el, a, re) {
    const saved = App.bsettings.get('legal.docs', {}), list = L().DOCS.filter(d => d.when(a.p));
    el.innerHTML = `<div class="uc-alist">${list.map(d => `<button class="uc-arow" data-doc="${d.id}"><span class="uc-dot" style="background:${saved[d.id] ? 'var(--green)' : 'var(--label-3)'}"></span><span><b>${esc(d.title)}</b><span class="muted tiny">${saved[d.id] ? `Saved v${saved[d.id].version} · ${new Date(saved[d.id].savedAt).toLocaleDateString()}` : 'Not made yet'} · ${esc(d.audience)}</span></span></button>`).join('')}</div>
      <p class="muted tiny" style="margin-top:8px">Drafts fill in from Details. Fill in your legal name, address and state there first.</p>`;
    el.querySelectorAll('[data-doc]').forEach(b => b.onclick = () => { const d = L().DOCS.find(x => x.id === b.dataset.doc); const text = saved[d.id]?.text || d.body(a.p); docSheet(d.title, text, d.risk, async t => W(unitId, () => { const all = App.bsettings.get('legal.docs', {}); all[d.id] = { text: t, version: (all[d.id]?.version || 0) + 1, savedAt: Date.now() }; App.bsettings.set('legal.docs', all); App.compliance?.audit?.('Legal document saved', d.title); }).then(re), () => d.body(a.p)); });
  }
  function docSheet(title, text, why, onSave, fresh) {
    App.ui.modal(`<div class="row spread"><h2>${esc(title)}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>${why ? `<p class="muted small">${esc(why)}</p>` : ''}
      <div class="seg" style="margin:8px 0"><button data-dm="p" class="on">Preview</button><button data-dm="e">Edit</button></div>
      <div class="uc-md uc-doc" id="dP">${UC.brainRender(text)}</div><textarea id="dE" rows="18" hidden>${esc(text)}</textarea>
      <div class="muted tiny" style="margin-top:8px">${NOTE}</div>
      <div class="row" style="justify-content:space-between;margin-top:12px"><div class="row">${fresh ? '<button class="btn ghost small" id="dF">Fresh draft</button>' : ''}<button class="btn small" id="dC">Copy</button><button class="btn small" id="dW">Download .doc</button><button class="btn small" id="dPr">Print / PDF</button></div>${onSave ? '<button class="btn primary" id="dS">Save version</button>' : ''}</div>`, (c, close) => {
      c.classList.add('wide');
      const cur = () => c.querySelector('#dE').value;
      const html = () => `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.55 Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px}h1,h2,h3{font-family:-apple-system,Helvetica,sans-serif}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:5px 8px}</style>${UC.brainRender(cur())}<p style="color:#666;font-size:12px;margin-top:40px">${NOTE}</p>`;
      c.querySelectorAll('[data-dm]').forEach(b => b.onclick = () => { const e = b.dataset.dm === 'e'; c.querySelectorAll('[data-dm]').forEach(x => x.classList.toggle('on', x === b)); c.querySelector('#dE').hidden = !e; c.querySelector('#dP').hidden = e; if (!e) c.querySelector('#dP').innerHTML = UC.brainRender(cur()); });
      c.querySelector('#dF')?.addEventListener('click', () => { if (!confirm('Replace your edits with a fresh draft?')) return; c.querySelector('#dE').value = fresh(); c.querySelector('#dP').innerHTML = UC.brainRender(cur()); });
      c.querySelector('#dC').onclick = () => { navigator.clipboard?.writeText(cur()); App.ui.toast('Copied'); };
      c.querySelector('#dW').onclick = () => App.download(`${title.replace(/[^\w\- ]/g, '')}.doc`, new Blob(['﻿' + html()], { type: 'application/msword' }));
      c.querySelector('#dPr').onclick = () => { const w = window.open('', '_blank'); if (!w) return App.ui.toast('Allow pop-ups to print'); w.document.write(html()); w.document.close(); setTimeout(() => w.print(), 300); };
      c.querySelector('#dS')?.addEventListener('click', async () => { await onSave(cur()); App.ui.toast('Saved'); close(); });
    });
  }
  UC.legalDocSheet = docSheet;

  /* Signatures */
  function sign(el, a, re) {
    const sig = App.bsettings.get('legal.signed', []).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    const sd = L().DOCS.filter(d => d.sign && d.when(a.p));
    el.innerHTML = `<div class="row" style="justify-content:flex-end"><button class="btn small primary" id="sgN">Record a signature</button></div>
      <div class="uc-alist">${sig.map(s => `<div class="uc-arow"><span class="uc-dot" style="background:var(--green)"></span><span><b>${esc(s.person)}</b><span class="muted tiny">${esc(L().DOCS.find(d => d.id === s.doc)?.title || s.doc)} · ${esc(s.date || '')} · ${esc(s.method || '')}</span></span></div>`).join('') || '<div class="uc-empty">No signatures recorded.</div>'}</div>`;
    el.querySelector('#sgN').onclick = () => App.ui.modal(`<div class="row spread"><h2>Record a signature</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <label class="field">Document<select id="sD">${sd.map(d => `<option value="${d.id}">${esc(d.title)}</option>`).join('')}</select></label><label class="field">Signed by<input id="sP"></label>
      <div class="uc-q3"><label class="field">Date<input type="date" id="sT" value="${App.dateKey(new Date())}"></label><label class="field">How<select id="sM"><option>Paper</option><option>E-signature</option><option>Email acknowledgment</option></select></label></div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" id="sGo">Save</button></div>`, (c, close) => {
      c.querySelector('#sGo').onclick = () => { const person = c.querySelector('#sP').value.trim(); if (!person) return App.ui.toast('Who signed?'); const doc = c.querySelector('#sD').value; W(unitId, () => { const d = L().DOCS.find(x => x.id === doc); const all = App.bsettings.get('legal.signed', []); all.push({ id: App.uid(), doc, person, role: d?.sign, date: c.querySelector('#sT').value, method: c.querySelector('#sM').value, version: App.bsettings.get('legal.docs', {})[doc]?.version || null }); App.bsettings.set('legal.signed', all); }).then(() => { close(); re(); }); };
    });
  }

  /* Incidents */
  function inc(el, a, re) {
    const list = App.bsettings.get('legal.incidents', []).slice().sort((x, y) => (y.when || '').localeCompare(x.when || ''));
    el.innerHTML = `<div class="row" style="justify-content:flex-end"><button class="btn small primary" id="icN">Report an incident</button></div>
      <div class="uc-alist">${list.map(i => `<button class="uc-arow" data-inc="${i.id}"><span class="uc-dot" style="background:${i.status === 'Closed' ? 'var(--label-3)' : 'var(--orange)'}"></span><span><b>${esc(i.type || 'Incident')}</b><span class="muted tiny">${esc((i.when || '').replace('T', ' '))} · ${esc(i.status || '')} · ${esc((i.description || '').slice(0, 90))}</span></span></button>`).join('') || '<div class="uc-empty">No incidents logged. Write one up the same day anything happens: notes made at the time win cases.</div>'}</div>`;
    const form = i => {
      const isNew = !i; i = i || { id: App.uid(), when: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), status: 'Open' };
      App.ui.modal(`<div class="row spread"><h2>${isNew ? 'Report an incident' : 'Incident'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
        <div class="uc-q3"><label class="field">When<input type="datetime-local" id="iW" value="${esc((i.when || '').slice(0, 16))}"></label><label class="field">Type<select id="iT">${TYPES.map(t => `<option ${t === i.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="field">Status<select id="iS">${['Open', 'Waiting on insurer', 'Closed'].map(t => `<option ${t === i.status ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <label class="field">Where<input id="iL" value="${esc(i.location || '')}"></label><label class="field">People involved and witnesses<input id="iP" value="${esc(i.people || '')}"></label>
        <label class="field">What happened: facts only, in order. Don’t guess or admit fault.<textarea id="iD" rows="5">${esc(i.description || '')}</textarea></label>
        <label class="field">Injuries / damage, and what you did<input id="iA" value="${esc(i.actions || '')}"></label>
        <div class="muted tiny">Save camera footage now; most systems overwrite it within days. For injuries, tell your insurer promptly.</div>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="iGo">Save</button></div>`, (c, close) => {
        c.querySelector('#iGo').onclick = () => { Object.assign(i, { when: c.querySelector('#iW').value, type: c.querySelector('#iT').value, status: c.querySelector('#iS').value, location: c.querySelector('#iL').value.trim(), people: c.querySelector('#iP').value.trim(), description: c.querySelector('#iD').value.trim(), actions: c.querySelector('#iA').value.trim(), updated: Date.now() }); if (!i.description) return App.ui.toast('Describe what happened'); W(unitId, () => { const all = App.bsettings.get('legal.incidents', []).filter(x => x.id !== i.id); all.push(i); App.bsettings.set('legal.incidents', all); }).then(() => { close(); re(); }); };
      });
    };
    el.querySelector('#icN').onclick = () => form(null);
    el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => form(list.find(x => x.id === b.dataset.inc)));
  }

  /* Business details (legal profile, shared with the desk) */
  function details(el, a, re) {
    const p = a.p, F = [['legalName', 'Legal name'], ['dba', 'Doing business as'], ['owner', 'Owner / signer'], ['address', 'Street address'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['email', 'Contact email'], ['phone', 'Phone'], ['website', 'Website']];
    el.innerHTML = `<div class="uc-q3">${F.map(([k, l]) => `<label class="field">${l}<input data-p="${k}" value="${esc(p[k] || '')}"></label>`).join('')}</div>
      <div class="uc-sh" style="margin-top:10px"><h3>What this unit does</h3><span class="muted small">decides which risks and documents apply</span></div>
      <div class="uc-chks">${L().PRACTICES.map(([k, l]) => `<label class="uc-cb"><input type="checkbox" data-pr="${k}" ${p.practices?.[k] ? 'checked' : ''}> <span>${esc(l)}</span></label>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="pGo">Save details</button></div>`;
    el.querySelector('#pGo').onclick = () => W(unitId, () => {
      const next = { ...App.bsettings.get('legal.profile', {}) }; el.querySelectorAll('[data-p]').forEach(x => next[x.dataset.p] = x.value.trim());
      next.practices = {}; el.querySelectorAll('[data-pr]').forEach(x => next.practices[x.dataset.pr] = x.checked); App.bsettings.set('legal.profile', next);
    }).then(() => { App.ui.toast('Details saved'); re(); });
  }

  /* ---------- Deal legal ---------- */
  const CHECK = {
    all: [['nda', 'NDA signed before you receive financials'], ['entity', 'Seller’s entity and ownership verified (Secretary of State, good standing)'], ['liens', 'Lien / UCC and tax-lien search is clean'], ['litigation', 'Court records searched for lawsuits and judgments'], ['lease', 'Lease reviewed: term, renewal options, assignment needs landlord consent'], ['licenses', 'Licenses and permits: which transfer and which must be re-applied for (health, liquor, signage)'], ['structure', 'Asset vs. stock purchase decided with your CPA and attorney'], ['employees', 'Employees: who transfers, accrued PTO, contracts, I-9s'], ['bulksale', 'State bulk-sale / tax clearance from the seller (avoids inheriting their sales-tax debt)'], ['insurance', 'Your insurance is bound to start at closing'], ['apa', 'Purchase agreement reviewed by your attorney'], ['escrow', 'Funds go through escrow or your attorney at closing']],
    buy: [['loi', 'Non-binding letter of intent with exclusivity period signed'], ['qoe', 'Cash flow verified against tax returns and bank statements (quality of earnings)'], ['noncompete', 'Seller non-compete and non-solicit'], ['transition', 'Seller transition / training period agreed'], ['sellernote', 'Seller note terms (if any) written down'], ['contracts', 'Key supplier and customer contracts can be assigned']],
    franchise: [['fdd', 'Received the current FDD (the FTC rule requires 14 days before you sign or pay)'], ['item7', 'FDD Items 5–7: fees and total investment understood'], ['item19', 'FDD Item 19: earnings claims reviewed (or none given)'], ['item20', 'FDD Item 20: openings, closings and transfers; called former franchisees'], ['item12', 'FDD Item 12: territory protection in writing'], ['item21', 'FDD Item 21: franchisor’s audited financials reviewed'], ['calls', 'Talked to 5+ current franchisees'], ['fa', 'Franchise agreement reviewed by a franchise attorney'], ['sba', 'Brand checked in the SBA Franchise Directory if you will use an SBA loan'], ['transfer', 'Resale only: franchisor approved the transfer and the transfer fee']]
  };
  const itemsFor = p => [...CHECK.all, ...(p.dtype === 'franchise' ? CHECK.franchise : CHECK.buy), ...(p.dtype === 'franchise' && p.fin ? [] : [])];
  function dealsTab(el, list, re) {
    el.innerHTML = `<p class="muted small">Every deal gets a checklist and drafts of an NDA and a letter of intent. ${NOTE}</p>
      <div class="uc-alist">${list.map(p => { const it = itemsFor(p), done = it.filter(([k]) => p.legal?.check?.[k]).length; return `<button class="uc-arow" data-ld="${p.id}"><span class="uc-ring" style="--p:${Math.round(done / it.length * 100)}"></span><span><b>${esc(p.name)}</b><span class="muted tiny">${esc(UC.deals.TYPES[p.dtype]?.[0])} · ${esc(UC.deals.STAGES.find(s => s[0] === p.stage)?.[1] || '')} · ${done} of ${it.length} done</span></span></button>`; }).join('') || '<div class="uc-empty">No deals under NDA, LOI or due diligence yet. Open any deal in Growth → Deals and tap Deal legal.</div>'}</div>`;
    el.querySelectorAll('[data-ld]').forEach(b => b.onclick = async () => UC.legalDeal((await UC.deals.all()).find(x => x.id === b.dataset.ld), re));
  }
  function dealDoc(kind, p) {
    const gp = UC.growth.profile(), pr = UC.deals.profile(), buyer = pr.buyer || gp.business || '[BUYER NAME]', today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), f = p.fin || {};
    if (kind === 'nda') return `# Mutual Confidentiality Agreement\n\n**Date:** ${today}\n\n**Between:** ${buyer} ("Buyer") and ${p.name} and its owners ("Seller").\n\n## 1. Purpose\nThe parties are discussing a possible purchase of, investment in, or partnership with ${p.name} (the "Transaction"). To evaluate it, each may share confidential information.\n\n## 2. Confidential information\nFinancial statements, tax returns, sales and labor data, leases, contracts, supplier pricing, recipes and methods, employee and customer information, and the fact that these discussions are taking place.\n\n## 3. Obligations\nThe receiving party will (a) use confidential information only to evaluate the Transaction; (b) share it only with its advisors, lenders and investors who need it and are bound to keep it confidential; and (c) protect it with at least reasonable care.\n\n## 4. No contact\nBuyer will not contact the Seller's employees, landlord, suppliers or customers about the Transaction without the Seller's permission.\n\n## 5. Exclusions\nInformation that is public, already known, independently developed or lawfully received from someone else is not confidential.\n\n## 6. Return or destroy\nOn request, or if discussions end, the receiving party will return or destroy confidential information.\n\n## 7. No obligation\nThis agreement does not obligate either party to complete a Transaction.\n\n## 8. Term and law\nObligations last [2] years from the date above. This agreement is governed by the laws of the State of [STATE].\n\n| Buyer | Seller |\n|---|---|\n| ${buyer} | ${p.name} |\n| Signature: ______________ | Signature: ______________ |\n| Name: ${gp.sender || '______________'} | Name: ${p.contact || '______________'} |\n| Date: ______________ | Date: ______________ |`;
    return `# Letter of Intent (Non-Binding)\n\n**Date:** ${today}\n\n**To:** ${p.contact || 'Owner'}, ${p.name}${p.address ? `, ${p.address}` : ''}\n\n**From:** ${buyer}\n\nThis letter sets out the main terms on which ${buyer} ("Buyer") proposes to acquire ${p.name} ("the Business"). Except for the Exclusivity, Confidentiality and Costs sections, it is **not binding**; a binding deal exists only in a signed purchase agreement.\n\n## 1. What is being bought\n[An asset purchase of] the Business's equipment, inventory, trade name, phone numbers, website, customer lists, goodwill and assignable contracts, free of liens and debts. [Excluded: cash, receivables, and ___.]\n\n## 2. Price\n$[PRICE]${f.price ? ` (asking was ${App.fmt.money(f.price)}${f.cashFlow ? `; stated cash flow ${App.fmt.money(f.cashFlow)}` : ''})` : ''}, paid as: $[___] cash at closing; $[___] seller note over [__] years at [__]%; $[___] contingent on [___]. Inventory at cost, counted at closing, up to $[___].\n\n## 3. Conditions\nSatisfactory due diligence (financials, tax returns, bank statements, leases, licenses, employees, legal); landlord consent to assign or a new lease on acceptable terms; transfer or issuance of all required licenses; financing on acceptable terms; a signed purchase agreement.\n\n## 4. Seller commitments\nA [__]-week paid/unpaid transition and training period; a non-compete within [__] miles for [__] years; running the Business normally until closing.\n\n## 5. Timing\nDue diligence within [45] days of acceptance; target closing by [DATE].\n\n## 6. Exclusivity (binding)\nFor [60] days after signing, Seller will not market the Business or negotiate with anyone else.\n\n## 7. Confidentiality (binding)\nThe terms of this letter and the discussions are confidential, as set out in the parties' confidentiality agreement.\n\n## 8. Costs (binding)\nEach party pays its own advisors.\n\n| Buyer | Seller |\n|---|---|\n| ${buyer} | ${p.name} |\n| Signature: ______________ | Signature: ______________ |\n| Date: ______________ | Date: ______________ |`;
  }
  UC.legalDeal = (p, after) => {
    if (!p) return;
    const it = itemsFor(p); p.legal = p.legal || { check: {}, docs: {} };
    App.ui.modal(`<div class="row spread"><div><div class="uc-qk">DEAL LEGAL</div><h2 style="margin:4px 0 0">${esc(p.name)}</h2></div><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="muted small">${NOTE}</p>
      <div class="row" style="gap:8px;margin:6px 0 12px"><button class="btn small" data-ddoc="nda">${p.legal.docs?.nda ? 'NDA (saved)' : 'Draft the NDA'}</button>${p.dtype !== 'franchise' ? `<button class="btn small" data-ddoc="loi">${p.legal.docs?.loi ? 'Letter of intent (saved)' : 'Draft a letter of intent'}</button>` : UC.deals.FDD.map(([l, u]) => `<a class="btn small" href="${u}" target="_blank" rel="noopener">${esc(l.split(' (')[0])} ↗</a>`).join('')}</div>
      <div class="uc-chks">${it.map(([k, l]) => `<label class="uc-cb"><input type="checkbox" data-lc="${k}" ${p.legal.check?.[k] ? 'checked' : ''}> <span>${esc(l)}</span></label>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-close>Done</button></div>`, (c) => {
      c.querySelectorAll('[data-lc]').forEach(x => x.onchange = async () => { p.legal.check[x.dataset.lc] = x.checked; await UC.deals.put(p); });
      c.querySelectorAll('[data-ddoc]').forEach(x => x.onclick = () => { const k = x.dataset.ddoc; const title = k === 'nda' ? `Mutual NDA · ${p.name}` : `Letter of Intent · ${p.name}`;
        docSheet(title, p.legal.docs?.[k]?.text || dealDoc(k, p), k === 'nda' ? 'Sign this before the seller sends financials.' : 'Sets the price and terms before you spend money on due diligence. Mostly non-binding.', async t => { p.legal.docs = { ...(p.legal.docs || {}), [k]: { text: t, savedAt: Date.now() } }; if (k === 'nda') p.legal.check.nda = p.legal.check.nda || false; await UC.deals.put(p); }, () => dealDoc(k, p)); });
    });
    // refresh the caller when the sheet closes
    const m = document.getElementById('modal'); const obs = new MutationObserver(() => { if (m.hidden) { obs.disconnect(); after?.(); } }); if (m) obs.observe(m, { attributes: true, attributeFilter: ['hidden'] });
  };
})(window.UC);
