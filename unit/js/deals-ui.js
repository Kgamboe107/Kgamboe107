/* Growth → Deals: find, research and contact acquisition and expansion opportunities. */
(function (UC) {
  const { esc } = App;
  const D = () => UC.deals, G = () => UC.growth;
  const outreach = UC.screens.growth;
  let hid = null, stageF = 'open', typeF = 'all', busy = '', msg = '';
  const money = v => v ? App.fmt.money(v) : '—';
  const stageLabel = k => D().STAGES.find(s => s[0] === k)?.[1] || k;

  const modeBar = m => `<div class="seg uc-gmode">${[['outreach', 'Outreach'], ['deals', 'Deals']].map(([k, l]) => `<button data-gmode="${k}" class="${m === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  UC.screens.growth = async (view, params = {}) => {
    if (params.mode) UC.S.set('growth.mode', params.mode);
    const m = UC.S.get('growth.mode', 'outreach');
    if (m === 'deals') await deals(view, params); else await outreach(view, params);
    view.insertAdjacentHTML('afterbegin', modeBar(m));
    view.querySelectorAll('[data-gmode]').forEach(b => b.onclick = () => UC.go('growth', { mode: b.dataset.gmode }));
  };

  /* ---------- hunt setup ---------- */
  function huntForm(view, h, first) {
    h = h || { id: App.uid(), name: '', goal: 'buy', kind: 'restaurants', tag: '', area: '', radiusKm: 15, regionKm: 80, created: Date.now() };
    const pr = D().profile(), gp = G().profile();
    const html = `<div class="uc-sh"><h2>${first ? 'Find your next deal' : 'Edit this search'}</h2></div>
      <p class="muted small">Tell it what you’re looking for and where. It looks four ways: owners who may sell, businesses listed for sale, franchise brands with open territory, and markets with room for one more.</p>
      <div class="uc-form">
        <label class="field">Name this search<input id="hN" value="${esc(h.name)}" placeholder="e.g. Coffee shops, Central Texas"></label>
        <label class="field">What kind of business<select id="hK">${G().KINDS.map(k => `<option value="${k[0]}" ${k[0] === h.kind ? 'selected' : ''}>${k[1]}</option>`).join('')}</select></label>
        <label class="field" id="hTagW" ${h.kind === 'custom' ? '' : 'hidden'}>OpenStreetMap tag<input id="hT" value="${esc(h.tag || '')}" placeholder='"shop"="bakery"'></label>
        <label class="field">Area<input id="hA" value="${esc(h.area)}" placeholder="City, State"></label>
        <div class="uc-q3"><label class="field">Your area (km)<input id="hR" type="number" min="1" max="50" value="${h.radiusKm}"></label><label class="field">Region to compare (km)<input id="hRR" type="number" min="30" max="150" value="${h.regionKm}"></label></div>
        <div class="uc-sh" style="margin-top:8px"><h3>About you as a buyer</h3></div>
        <label class="field">Buyer name (you or your company)<input id="pB" value="${esc(pr.buyer || gp.business)}"></label>
        <label class="field">Your experience, one line<input id="pE" value="${esc(pr.experience)}" placeholder="e.g. I operate four restaurants in Central Texas"></label>
        <div class="uc-q3"><label class="field">Budget<input id="pBu" value="${esc(pr.budget)}" placeholder="$500k"></label><label class="field">Your address (required on outreach)<input id="pA" value="${esc(gp.address)}"></label><label class="field">Your name<input id="pS" value="${esc(gp.sender)}"></label></div>
        <label class="field">What makes a good deal for you<input id="pC" value="${esc(pr.criteria)}" placeholder="e.g. $150k+ cash flow, under 3.5×, owner willing to stay 6 months"></label>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:12px">${first ? '' : '<button class="btn" data-close>Cancel</button>'}<button class="btn primary" id="hGo">${first ? 'Start looking' : 'Save'}</button></div>`;
    const bind = (root, close) => {
      root.querySelector('#hK').onchange = e => root.querySelector('#hTagW').hidden = e.target.value !== 'custom';
      root.querySelector('#hGo').onclick = () => {
        Object.assign(h, { name: root.querySelector('#hN').value.trim(), kind: root.querySelector('#hK').value, tag: root.querySelector('#hT').value.trim(), area: root.querySelector('#hA').value.trim(), radiusKm: +root.querySelector('#hR').value || 15, regionKm: +root.querySelector('#hRR').value || 80 });
        if (!h.area) return App.ui.toast('Add an area, like “Austin, TX”');
        if (!h.name) h.name = `${D().kindLabel(h)} · ${h.area}`;
        D().setProfile({ buyer: root.querySelector('#pB').value.trim(), experience: root.querySelector('#pE').value.trim(), budget: root.querySelector('#pBu').value.trim(), criteria: root.querySelector('#pC').value.trim() });
        G().setProfile({ address: root.querySelector('#pA').value.trim(), sender: root.querySelector('#pS').value.trim() });
        D().saveHunts([...D().hunts().filter(x => x.id !== h.id), h]); hid = h.id; close?.(); UC.go('growth', { keepScroll: !first });
      };
    };
    if (first) { view.innerHTML = `<section class="card">${html}</section>`; bind(view); }
    else App.ui.modal(html, (c, close) => bind(c, close));
  }

  /* ---------- main ---------- */
  async function deals(view) {
    await G().reconcile();
    const hs = D().hunts();
    if (!hid || !hs.find(h => h.id === hid)) hid = hs[hs.length - 1]?.id || null;
    const h = hs.find(x => x.id === hid);
    if (!h) return huntForm(view, null, true);
    const st = await D().stats(h.id);
    const waiting = UC.engine.state().asks.filter(a => a.status === 'pending' && st.list.some(p => p.id === a.growth)).length;
    const ready = st.list.filter(p => p.status === 'approved');
    const OPEN = ['lead', 'research', 'contacted', 'talking', 'nda', 'loi', 'diligence'];
    const rows = st.list.filter(p => (stageF === 'all' || (stageF === 'open' ? OPEN.includes(p.stage) : p.stage === stageF)) && (typeF === 'all' || p.dtype === typeF)).sort((a, b) => (b.fit?.score || 0) - (a.fit?.score || 0));
    const mk = UC.S.get('deals.markets', []).find(x => x.hunt === h.id);
    const toRead = st.list.filter(p => p.website && !p.readAt && !p.siteError && p.stage !== 'passed').length;
    const toWrite = st.list.filter(p => p.email && !p.draft && !G().isSuppressed(p) && ['lead', 'research'].includes(p.stage)).sort((a, b) => (b.fit?.score || 0) - (a.fit?.score || 0));
    view.innerHTML = `
      <section class="card"><div class="row spread"><div style="min-width:0"><div class="uc-sh"><h2>${esc(h.name)}</h2></div><div class="muted small">${esc(D().kindLabel(h))} · ${esc(h.area)} · ${h.radiusKm} km${D().profile().budget ? ` · budget ${esc(D().profile().budget)}` : ''}</div></div>
        <div class="row">${hs.length > 1 ? `<select id="dHunt" data-native aria-label="Search">${hs.map(x => `<option value="${x.id}" ${x.id === hid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}<button class="btn small" id="dEdit">Edit</button><button class="btn small" id="dNewH">New search</button></div></div>
        <div class="uc-tiles uc-gtiles" style="margin-top:14px">${UC.tile('Leads', st.total)}${UC.tile('Owners', st.owners)}${UC.tile('For sale', st.listings)}${UC.tile('Franchises', st.franchises)}${UC.tile('In talks', st.active, '', st.active ? 'good' : '')}${UC.tile('Waiting for you', waiting, '', waiting ? 'accent' : '', waiting ? 'today' : '')}</div>
        ${msg ? `<div class="muted small" style="margin-top:10px">${esc(msg)}</div>` : ''}</section>

      <div class="uc-grid2"><div class="uc-col">
        <section class="card"><div class="uc-sh"><h2>Owners open to selling</h2></div><p class="muted small">Independent ${esc(D().kindLabel(h).toLowerCase())} near ${esc(h.area)} (chains left out). Reading their websites looks for years in business, family ownership, retirement and sites nobody has touched in years.</p>
          <button class="btn" id="dOwn">${busy === 'own' ? '<span class="task-spin"></span> Finding…' : 'Find owners'}</button></section>
        <section class="card"><div class="uc-sh"><h2>Franchise brands with open territory</h2></div><p class="muted small">Brands with ${h.minRegion || 3}+ locations within ${h.regionKm} km and none within ${h.radiusKm} km of ${esc(h.area)}.</p>
          <button class="btn" id="dFr">${busy === 'fr' ? '<span class="task-spin"></span> Counting brands…' : 'Find open territories'}</button>
          <details class="uc-disclose" style="margin-top:10px"><summary class="small">Franchise disclosure (FDD) databases</summary><div class="muted tiny" style="margin:6px 0">Public, free state filings. Search the brand name for its latest FDD: fees, investment range, Item 19 earnings, turnover.</div>${D().FDD.map(([l, u]) => `<a class="uc-wl small" href="${u}" target="_blank" rel="noopener">${esc(l)} ↗</a><br>`).join('')}</details></section>
      </div><div class="uc-col">
        <section class="card"><div class="uc-sh"><h2>Businesses for sale</h2></div><p class="muted small">Paste a listing link or the listing text. Price, cash flow, revenue and the asking multiple are pulled out.</p>
          <div class="row"><button class="btn" id="dList">Add a listing</button><label class="btn">Import a broker list<input type="file" id="dImp" hidden accept=".csv,.xlsx,.xls"></label></div>
          <details class="uc-disclose" style="margin-top:10px"><summary class="small">Search the marketplaces</summary>${D().searchLinks(h).map(([l, u]) => `<a class="uc-wl small" href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a><br>`).join('')}</details></section>
        <section class="card"><div class="uc-sh"><h2>Market gaps</h2></div><p class="muted small">People per ${esc(D().kindLabel(h).toLowerCase().replace(/s$/, ''))} in each area. More people per business means room for one more.${UC.S.get('census.key', '') ? ' Using Census data.' : ' <a class="uc-wl" id="dCen">Add a free Census key</a> for official counts.'}</p>
          <textarea id="dAreas" rows="2" placeholder="One area per line: Austin, TX · Round Rock, TX · Georgetown, TX">${esc((mk?.rows || []).map(r => r.area).join('\n') || h.area)}</textarea>
          <button class="btn" id="dMk" style="margin-top:8px">${busy === 'mk' ? '<span class="task-spin"></span> Comparing…' : 'Compare markets'}</button>
          ${mk ? `<div class="table-wrap" style="margin-top:10px"><table class="uc-mtab"><thead><tr><th>Area</th><th>People</th><th>Businesses</th><th>People per business</th></tr></thead><tbody>${mk.rows.map(r => r.error ? `<tr><td>${esc(r.area)}</td><td colspan="3" class="muted">${esc(r.error)}</td></tr>` : `<tr><td>${esc(r.area)}</td><td>${(r.countyPop || r.population)?.toLocaleString() || '—'}${r.countyPop ? '<span class="muted tiny"> county</span>' : ''}</td><td>${(r.estab ?? r.count).toLocaleString()}</td><td><b>${r.perBiz?.toLocaleString() || '—'}</b> <span class="uc-chipt ${r.read === 'Under-served' ? 'good' : r.read === 'Crowded' ? 'bad' : ''}">${r.read || ''}</span></td></tr>`).join('')}</tbody></table></div><div class="muted tiny">${esc(mk.rows.find(r => r.source)?.source || '')} · ${UC.ago(mk.at)}</div>` : ''}</section>
      </div></div>

      ${ready.length ? `<section class="card"><div class="uc-sh"><h2>Ready to send</h2><span class="muted small">approved by you · opens in your mail app</span></div><div class="uc-alist">${ready.map(p => `<div class="uc-arow uc-send"><span class="uc-dot" style="background:var(--gold)"></span><span><b>${esc(p.name)}</b><span class="muted tiny">${esc(p.email)} · ${esc(p.draft?.subject || '')}</span></span><span class="row"><a class="btn primary small" href="${esc(G().mailto(p.email, p.draft?.subject || '', p.draft?.body || ''))}" data-dsent="${p.id}">Open in Mail</a></span></div>`).join('')}</div></section>` : ''}

      <section class="card"><div class="row spread"><div class="uc-sh"><h2>Pipeline</h2><span class="muted small">${st.total} leads</span></div>
        <div class="row">${toRead ? `<button class="btn small" id="dRead" ${D().canRead() ? '' : 'disabled title="Reading websites runs in the desktop app"'}>${busy === 'read' ? '<span class="task-spin"></span> Reading…' : `Read ${Math.min(25, toRead)} websites`}</button>` : ''}${toWrite.length ? `<button class="btn primary small" id="dWrite">${busy === 'write' ? '<span class="task-spin"></span> Writing…' : `Write first contact for the top ${Math.min(10, toWrite.length)}`}</button>` : ''}</div></div>
        <div class="seg" style="margin-top:10px">${[['open', 'Open'], ['lead', 'Lead'], ['research', 'Researching'], ['contacted', 'Contacted'], ['talking', 'Talking'], ['nda', 'NDA'], ['loi', 'LOI'], ['diligence', 'Diligence'], ['closed', 'Closed'], ['passed', 'Passed'], ['all', 'All']].map(([k, l]) => `<button data-sf="${k}" class="${stageF === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg" style="margin-top:8px">${[['all', 'All types'], ['owner', 'Owners'], ['listing', 'For sale'], ['franchise', 'Franchises']].map(([k, l]) => `<button data-tf="${k}" class="${typeF === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="uc-alist">${rows.slice(0, 250).map(p => `<button class="uc-arow" data-deal="${p.id}"><span class="uc-ring" style="--p:${p.fit?.score || 0}" title="Fit ${p.fit?.score || 0}"></span><span><b>${esc(p.name)}</b><span class="muted tiny">${esc(D().TYPES[p.dtype]?.[0] || '')} · ${esc(stageLabel(p.stage))}${p.fin?.price ? ` · ${money(p.fin.price)}${p.fin.multiple ? ` (${p.fin.multiple}×)` : ''}` : ''}${p.fr ? ` · ${p.fr.regionCount} in region, ${p.fr.localCount} here` : ''}${p.fit?.why ? ` · ${esc(p.fit.why)}` : ''}</span></span></button>`).join('') || '<div class="uc-empty">No leads here yet. Use one of the four ways above.</div>'}</div></section>`;

    const re = () => UC.go('growth', { keepScroll: true });
    const run = async (k, fn) => { busy = k; re(); try { msg = await fn(); } catch (e) { msg = e.message; App.ui.toast(e.message, 6000); } busy = ''; re(); };
    view.querySelector('#dHunt')?.addEventListener('change', e => { hid = e.target.value; re(); });
    view.querySelector('#dEdit').onclick = () => huntForm(view, { ...h });
    view.querySelector('#dNewH').onclick = () => huntForm(view, null);
    view.querySelector('#dOwn').onclick = () => run('own', async () => { const r = await D().findOwners(h, s => msg = s); return `Found ${r.found} new independent owners near ${r.area.split(',')[0]}.`; });
    view.querySelector('#dFr').onclick = () => run('fr', async () => { const r = await D().findFranchises(h, s => msg = s); return `${r.brands} brands in the region; ${r.found} new with open territory near ${h.area}.`; });
    view.querySelector('#dMk').onclick = () => run('mk', async () => { const r = await D().markets(h, view.querySelector('#dAreas').value.split(/\n|·|;/)); return `Compared ${r.length} areas.`; });
    view.querySelector('#dCen')?.addEventListener('click', () => { const k = prompt('Paste your free Census API key (get one at api.census.gov/data/key_signup.html). It stays on this device.'); if (k) { UC.S.set('census.key', k.trim()); re(); } });
    view.querySelector('#dImp').onchange = e => run('imp', async () => `Imported ${await D().importListings(h, e.target.files[0])} listings.`);
    view.querySelector('#dList').onclick = () => App.ui.modal(`<div class="row spread"><h2>Add a listing</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <label class="field">Listing link<input id="lU" placeholder="https://…"></label><label class="field">Or paste the listing text<textarea id="lX" rows="7" placeholder="Paste everything on the listing page: price, cash flow, revenue, location…"></textarea></label>
      <label class="field">Name (optional)<input id="lN"></label><div class="muted tiny">${D().canRead() ? 'The desktop app reads the link. Some marketplaces block apps; if so, paste the text.' : 'Reading links runs in the desktop app. On the web, paste the text.'}</div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="lGo">Add</button></div>`, (c, close) => {
      c.querySelector('#lGo').onclick = async e => { e.target.disabled = true; e.target.innerHTML = '<span class="task-spin"></span>'; try { const p = await D().addListing(h, { url: c.querySelector('#lU').value.trim(), text: c.querySelector('#lX').value.trim(), name: c.querySelector('#lN').value.trim() }); close(); openDeal(p.id, re); } catch (err) { App.ui.toast(err.message); e.target.disabled = false; e.target.textContent = 'Add'; } };
    });
    view.querySelector('#dRead')?.addEventListener('click', () => run('read', async () => { const l = st.list.filter(p => p.website && !p.readAt && !p.siteError && p.stage !== 'passed').slice(0, 25); let i = 0; for (const p of l) { await D().readDeal(p); i++; const g = document.getElementById('dRead'); if (g) g.innerHTML = `<span class="task-spin"></span> ${i} of ${l.length}`; } return `Read ${l.length} websites.`; }));
    view.querySelector('#dWrite')?.addEventListener('click', () => run('write', async () => { let n = 0, err = ''; for (const p of toWrite.slice(0, 10)) { try { await D().draft(p); n++; } catch (e) { err = e.message; if (/address/.test(err)) break; } } return n ? `${n} first contacts wait in Needs your yes (Clients).` : err; }));
    view.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { stageF = b.dataset.sf; re(); });
    view.querySelectorAll('[data-tf]').forEach(b => b.onclick = () => { typeF = b.dataset.tf; re(); });
    view.querySelectorAll('[data-deal]').forEach(b => b.onclick = () => openDeal(b.dataset.deal, re));
    view.querySelectorAll('[data-dsent]').forEach(a => a.addEventListener('click', async () => { const p = st.list.find(x => x.id === a.dataset.dsent); await G().markSent(p); await D().setStage(p, 'contacted'); setTimeout(re, 400); }));
  }

  /* ---------- deal sheet ---------- */
  async function openDeal(id, re) {
    const p = (await D().all()).find(x => x.id === id); if (!p) return;
    const f = p.fin || {}, fr = p.fr || {}, h = D().hunt(p.campaign);
    const brief = UC.decide?.forRef(p.id);
    const kv = (k, v) => v ? `<div><span>${k}</span><b>${v}</b></div>` : '';
    App.ui.modal(`<div class="row spread"><div><div class="uc-qk">${esc(D().TYPES[p.dtype][1].toUpperCase())}</div><h2 style="margin:4px 0 0">${esc(p.name)}</h2></div><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="muted small" style="margin-top:4px">${esc([p.category, p.address].filter(Boolean).join(' · '))}</div>
      <div class="row" style="margin-top:10px;gap:8px"><span class="uc-ring" style="--p:${p.fit?.score || 0}"></span><span class="small">${esc(p.fit?.why || '')}</span></div>
      ${p.dtype === 'listing' ? `<div class="uc-kv" style="margin-top:12px">${kv('Asking', money(f.price))}${kv('Cash flow', money(f.cashFlow))}${kv('Revenue', money(f.revenue))}${kv('EBITDA', f.ebitda ? money(f.ebitda) : '')}${kv('Multiple', f.multiple ? f.multiple + '×' : '')}${kv('Established', esc(f.established || ''))}${kv('Employees', esc(f.employees || ''))}${kv('Real estate', esc(f.realEstate || ''))}${kv('Inventory', f.inventory ? money(f.inventory) : '')}${kv('Financing', esc(f.financing || ''))}${kv('Reason for selling', esc(f.reason || ''))}</div>` : ''}
      ${p.dtype === 'franchise' ? `<div class="uc-kv" style="margin-top:12px">${kv('In the region', `${fr.regionCount} within ${fr.regionKm} km`)}${kv('In your area', `${fr.localCount} within ${fr.localKm} km`)}${kv('Franchise fee', esc(fr.fee || ''))}${kv('Investment', esc(fr.investment || ''))}${kv('Royalty', esc(fr.royalty || ''))}</div>${fr.franchisingUrl ? `<a class="uc-wl small" href="${esc(fr.franchisingUrl)}" target="_blank" rel="noopener">Their franchising page ↗</a> · ` : ''}${D().FDD.map(([l, u]) => `<a class="uc-wl small" href="${u}" target="_blank" rel="noopener">${esc(l.split(' (')[0])} ↗</a>`).join(' · ')}` : ''}
      ${(p.signals || []).length ? `<div class="uc-sh" style="margin-top:12px"><h3>What we found</h3></div><ul class="small">${p.signals.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <div class="uc-form" style="margin-top:12px"><div class="uc-q3"><label class="field">Website<input id="xW" value="${esc(p.website || '')}"></label><label class="field">Email<input id="xE" value="${esc(p.email || '')}"></label><label class="field">Contact<input id="xC" value="${esc(p.contact || '')}"></label></div>
        <label class="field">Stage<select id="xS">${D().STAGES.map(([k, l]) => `<option value="${k}" ${p.stage === k ? 'selected' : ''}>${l}${D().BIG.includes(k) ? ' (decision)' : ''}</option>`).join('')}</select></label>
        <label class="field">Notes<textarea id="xN" rows="3">${esc(p.notes || '')}</textarea></label></div>
      ${p.draft ? `<details class="uc-disclose"><summary class="small">First contact: ${esc(p.draft.subject)} (${esc(p.status)})</summary><pre class="uc-pre small">${esc(p.draft.body)}</pre></details>` : ''}
      <div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px">
        ${p.website ? `<button class="btn small" id="xRead" ${D().canRead() ? '' : 'disabled title="Desktop app"'}>Read website</button>` : ''}
        <button class="btn small" id="xDraft">${p.draft ? 'Rewrite first contact' : 'Write first contact'}</button>
        ${p.status === 'sent' || p.thread?.length ? '<button class="btn small" id="xReply">Paste their reply</button>' : ''}
        <button class="btn small" id="xBrief">${brief ? (brief.status === 'thinking' ? 'Before you decide (open)' : `Decided: ${esc(brief.choice)}`) : 'Before you decide'}</button>
        <button class="btn small" id="xLegal">Deal legal</button>
        ${p.venture ? '<button class="btn small" data-go="ventures">Open venture</button>' : '<button class="btn small" id="xVen">Make it a venture</button>'}
      </div>
      <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn ghost small danger" id="xDel">Delete</button><button class="btn primary" id="xSave">Save</button></div>`, (c, close) => {
      const grab = () => { p.website = c.querySelector('#xW').value.trim(); p.email = c.querySelector('#xE').value.trim(); p.contact = c.querySelector('#xC').value.trim(); p.notes = c.querySelector('#xN').value; D().score(p); };
      const afterDecide = async b => { if (b?.status === 'decided') { const no = b.choice === b.options[2]; await D().setStage(p, no ? 'passed' : c._want); App.ui.toast(no ? 'Marked as passed' : `Moved to ${stageLabel(c._want)}`); } re(); };
      c.querySelector('#xSave').onclick = async () => {
        grab(); const want = c.querySelector('#xS').value;
        if (want !== p.stage && D().BIG.includes(want)) { const b = UC.decide.forRef(p.id); if (!b || b.status !== 'decided') { await D().put(p); close(); c._want = want; return UC.decide.think(`${want === 'passed' ? 'Pass on' : want === 'loi' ? 'Send a letter of intent for' : 'Close on'} ${p.name}?`, 'deal', p.id, afterDecide); } }
        if (want !== p.stage) await D().setStage(p, want); else await D().put(p);
        close(); re();
      };
      c.querySelector('#xRead')?.addEventListener('click', async e => { grab(); e.target.innerHTML = '<span class="task-spin"></span>'; await D().readDeal(p); close(); openDeal(p.id, re); });
      c.querySelector('#xDraft').onclick = async e => { grab(); e.target.innerHTML = '<span class="task-spin"></span> Writing…'; try { await D().draft(p); App.ui.toast('Waiting in Needs your yes (Clients)'); close(); re(); } catch (err) { App.ui.toast(err.message, 6000); e.target.textContent = 'Write first contact'; } };
      c.querySelector('#xReply')?.addEventListener('click', () => { const t = prompt(`Paste ${p.name}’s reply`); if (!t) return; G().reply(p, t).then(async () => { if (p.stage === 'contacted') await D().setStage(p, p.lastKind === 'no' ? 'passed' : 'talking'); close(); re(); }); });
      c.querySelector('#xBrief').onclick = async () => { grab(); await D().put(p); close(); c._want = p.stage; UC.decide.think(`Pursue ${p.name}?`, 'deal', p.id, () => re()); };
      c.querySelector('#xLegal').onclick = async () => { grab(); await D().put(p); close(); UC.legalDeal(p, re); };
      c.querySelector('#xVen')?.addEventListener('click', async () => { grab(); const v = await D().toVenture(p); App.ui.toast(`Venture “${v.name}” created`); close(); re(); });
      c.querySelector('#xDel').onclick = async () => { if (!confirm(`Delete ${p.name}?`)) return; await G().del(p.id); App.bus.emit('data-changed', 'prospects'); close(); re(); };
    });
  }
  UC.openDeal = openDeal;
})(window.UC);
