/* Growth screen: Claim → Find → Write → Reply, with a scoreboard, pipeline and ready-to-send list. */
(function (UC) {
  const { esc } = App;
  const G = () => UC.growth;
  UC.screens = UC.screens || {};
  let cid = null, filter = 'all', busy = '';
  const STAT = { found: ['Found', ''], read: ['Read', ''], drafted: ['Waiting for you', 'accent'], approved: ['Ready to send', 'live'], sent: ['Sent', ''], replied: ['Replied', 'good'], meeting: ['Meeting', 'good'], won: ['Won', 'good'], lost: ['No', 'bad'], skip: ['Skipped', ''] };
  const FILTERS = [['all', 'All'], ['found', 'Found'], ['read', 'Read'], ['drafted', 'Waiting'], ['approved', 'Ready'], ['sent', 'Sent'], ['replied', 'Replied'], ['meeting', 'Meetings']];

  UC.screens.growth = async (view) => {
    await G().reconcile();
    const camps = G().campaigns();
    if (!cid || !camps.find(c => c.id === cid)) cid = camps[camps.length - 1]?.id || null;
    const c = camps.find(x => x.id === cid);
    const pr = G().profile();
    if (!c) return claim(view, null, true);
    const st = await G().stats(c.id);
    const list = st.list.filter(p => filter === 'all' || p.status === filter).sort((a, b) => (b.fit?.score || 0) - (a.fit?.score || 0) || a.name.localeCompare(b.name));
    const ready = st.list.filter(p => p.status === 'approved');
    const step = !st.found ? 1 : !st.drafted ? 2 : !st.sent ? 3 : 4;
    const toRead = st.list.filter(p => p.website && !p.site && !p.siteError).length;
    const toWrite = st.list.filter(p => ['read', 'found'].includes(p.status) && p.email && !G().isSuppressed(p)).sort((a, b) => (b.fit?.score || 0) - (a.fit?.score || 0));
    view.innerHTML = `
      <section class="card"><div class="row spread"><div style="min-width:0"><div class="uc-sh"><h2>${esc(c.name)}</h2></div><div class="muted small">${esc(c.offer)} · ${esc(G().KINDS.find(k => k[0] === c.kind)?.[1] || c.tag || '')} near ${esc(c.area)}</div></div>
        <div class="row">${camps.length > 1 ? `<select id="gCamp" data-native aria-label="Campaign">${camps.map(x => `<option value="${x.id}" ${x.id === cid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}<button class="btn small" id="gEdit">Edit</button><button class="btn small" id="gNewC">New campaign</button><button class="btn small" id="gProf">Your offer</button></div></div>
        <div class="uc-steps">${['Claim', 'Find', 'Write', 'Reply'].map((s, i) => `<div class="${i + 1 < step ? 'done' : i + 1 === step ? 'on' : ''}"><i>${i + 1 < step ? '✓' : i + 1}</i>${s}</div>`).join('')}</div>
        <div class="uc-tiles uc-gtiles" style="margin-top:14px">${UC.tile('Found', st.found)}${UC.tile('Websites read', st.read)}${UC.tile('Emails written', st.drafted)}${UC.tile('Sent', st.sent, `${G().sentToday()} of ${pr.dailyCap} today`)}${UC.tile('Replies', st.replies, '', st.replies ? 'good' : '')}${UC.tile('Meetings', st.meetings, '', st.meetings ? 'good' : '')}${UC.tile('Waiting on you', st.waiting, st.waiting ? 'in Needs your yes' : '', st.waiting ? 'warn' : '', st.waiting ? 'today' : '')}</div>
        ${pr.address.trim() ? '' : '<div class="uc-demo" style="margin-top:12px"><div><b>Add your business address</b> in <a id="gProf2">Your offer</a>. US law (CAN-SPAM) requires it on every outreach email, with an easy opt-out, which the app adds for you.</div></div>'}</section>
      ${ready.length ? `<section class="card"><div class="uc-sh"><h2>Ready to send</h2><span class="muted small">approved by you · opens in your mail app</span></div>
        <div class="uc-alist">${ready.map(p => `<div class="uc-arow uc-send"><span class="uc-dot" style="background:var(--blue)"></span><span><b>${esc(p.name)}</b><span class="muted tiny">${esc(p.email)} · ${esc(p.draft?.subject || '')}</span></span>
          <span class="row"><a class="btn primary small" href="${esc(G().mailto(p.email, p.draft?.subject || '', p.draft?.body || ''))}" data-sent="${p.id}">Open in Mail</a></span></div>`).join('')}</div>
        <p class="muted tiny" style="margin-top:8px">Tapping “Open in Mail” marks it sent. ${G().sentToday() >= pr.dailyCap ? '<b style="color:var(--orange)">You’ve hit today’s limit; sending more from one address hurts deliverability.</b>' : `Keep it under ${pr.dailyCap} a day from one address.`}</p></section>` : ''}
      <section class="card"><div class="row spread"><div class="uc-sh"><h2>Prospects</h2><span class="muted small">${st.found} found</span></div>
        <div class="row"><button class="btn small" id="gFind">${busy === 'find' ? '<span class="task-spin"></span> Finding…' : 'Find more'}</button><label class="btn small">Import a list<input type="file" id="gImp" hidden accept=".csv,.xlsx,.xls"></label></div></div>
        <div class="row" style="margin:12px 0 4px;gap:8px">${toRead ? `<button class="btn small" id="gRead" ${G().canRead() ? '' : 'disabled title="Reading websites runs in the desktop app"'}>${busy === 'read' ? '<span class="task-spin"></span> Reading…' : `Read ${toRead} website${toRead > 1 ? 's' : ''}`}</button>` : ''}
          ${toWrite.length ? `<button class="btn primary small" id="gWrite">${busy === 'write' ? '<span class="task-spin"></span> Writing…' : `Write emails for the top ${Math.min(10, toWrite.length)}`}</button>` : ''}
          ${!G().canRead() && toRead ? '<span class="muted tiny">Websites are read by the desktop app.</span>' : ''}<span class="muted tiny" id="gProg"></span></div>
        <div class="seg" style="margin-top:8px">${FILTERS.map(([k, l]) => `<button data-gf="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="uc-alist">${list.slice(0, 200).map(p => { const [lab, tone] = STAT[p.status] || ['', '']; return `<button class="uc-arow" data-pros="${p.id}"><span class="uc-ring" style="--p:${p.fit?.score || 0}" title="Fit ${p.fit?.score || 0}"></span>
          <span><b>${esc(p.name)}</b><span class="muted tiny">${esc([p.category, p.address].filter(Boolean).join(' · '))}${p.email ? ' · ✉' : p.website ? ' · site, no email' : ''}${p.site?.facts?.[0] ? ` · ${esc(p.site.facts[0])}` : p.siteError ? ` · ${esc(p.siteError)}` : ''}</span></span><span class="uc-spill ${tone}">${lab}</span></button>`; }).join('') || '<div class="uc-empty">Nothing here yet.</div>'}</div>
        ${list.length > 200 ? '<p class="muted tiny">Showing the best 200.</p>' : ''}</section>`;
    const re = () => UC.go('growth', { keepScroll: true });
    const prog = t => { const el = document.getElementById('gProg'); if (el) el.textContent = t; };
    view.querySelector('#gCamp')?.addEventListener('change', e => { cid = e.target.value; UC.go('growth'); });
    view.querySelector('#gEdit').onclick = () => claim(view, c);
    view.querySelector('#gNewC').onclick = () => claim(view, null);
    view.querySelector('#gProf').onclick = profileSheet; view.querySelector('#gProf2')?.addEventListener('click', profileSheet);
    view.querySelectorAll('[data-gf]').forEach(b => b.onclick = () => { filter = b.dataset.gf; re(); });
    view.querySelectorAll('[data-pros]').forEach(b => b.onclick = () => prospectSheet(b.dataset.pros, c));
    view.querySelectorAll('[data-sent]').forEach(a => a.addEventListener('click', async () => { const p = (await G().all()).find(x => x.id === a.dataset.sent); if (p) { await G().markSent(p); App.ui.toast(`Marked sent: ${p.name}`); setTimeout(re, 600); } }));
    view.querySelector('#gFind').onclick = async () => { busy = 'find'; re(); try { const r = await G().find(c, prog); App.ui.toast(`Found ${r.found} new (${r.total} in the area)`); } catch (e) { App.ui.toast(e.message, 6000); } busy = ''; re(); };
    view.querySelector('#gImp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const n = await G().importList(c, f); App.ui.toast(`Imported ${n} prospects`); } catch (err) { App.ui.toast('Could not read that list: ' + err.message); } re(); };
    view.querySelector('#gRead')?.addEventListener('click', async () => {
      busy = 'read'; re(); const todo = st.list.filter(p => p.website && !p.site && !p.siteError); let i = 0;
      for (const p of todo) { prog(`${++i} of ${todo.length}: ${p.name}`); await G().readSite(p).catch(() => {}); }
      busy = ''; App.ui.toast(`Read ${todo.length} websites`); re();
    });
    view.querySelector('#gWrite')?.addEventListener('click', async () => {
      busy = 'write'; re(); let i = 0, ok = 0;
      for (const p of toWrite.slice(0, 10)) { prog(`${++i} of ${Math.min(10, toWrite.length)}: ${p.name}`); try { await G().write(p, c); ok++; } catch (e) { App.ui.toast(e.message, 6000); if (/address/.test(e.message)) break; } }
      busy = ''; App.ui.toast(`${ok} emails waiting for your yes`); re();
    });
  };

  /* Claim: what you sell, who, where */
  function claim(view, c, first) {
    const k = G().KINDS;
    const html = `<div class="row spread"><h2>${c ? 'Edit campaign' : 'New campaign'}</h2>${first ? '' : '<button class="btn ghost small" data-close aria-label="Close">✕</button>'}</div>
      <p class="muted small">Step 1 of 4 · Claim. Tell it what you sell and who your dream customer is. It finds every match nearby, reads their sites, and writes each one an email built on something real.</p>
      <label class="field">What you sell<input id="cOffer" value="${esc(c?.offer || '')}" placeholder="e.g. Websites for local businesses"></label>
      <label class="field">Your dream customer<input id="cIdeal" value="${esc(c?.ideal || '')}" placeholder="e.g. Independent dental practices with dated websites"></label>
      <div class="sp-two"><label class="field">Kind of business<select id="cKind" data-native>${k.map(([id, l]) => `<option value="${id}" ${c?.kind === id ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field" id="cTagL" ${c?.kind === 'custom' ? '' : 'hidden'}>OSM tag<input id="cTag" value="${esc(c?.tag || '')}" placeholder='"amenity"="pharmacy"'></label></div>
      <div class="sp-two"><label class="field">Area<input id="cArea" value="${esc(c?.area || '')}" placeholder="e.g. Austin, TX"></label><label class="field">Radius (km)<input id="cRad" type="number" min="1" max="50" value="${c?.radiusKm || 10}"></label></div>
      <label class="field">Campaign name<input id="cName" value="${esc(c?.name || '')}" placeholder="e.g. Austin dentists"></label>
      <div class="row" style="justify-content:space-between;margin-top:14px">${c ? '<button class="btn danger" id="cDel">Delete campaign</button>' : '<span></span>'}<div class="row">${first ? '' : '<button class="btn" data-close>Cancel</button>'}<button class="btn primary" id="cGo">${c ? 'Save' : 'Create and find'}</button></div></div>`;
    const bind = (root, close) => {
      root.querySelector('#cKind').onchange = e => { root.querySelector('#cTagL').hidden = e.target.value !== 'custom'; };
      root.querySelector('#cDel')?.addEventListener('click', async () => { if (!confirm('Delete this campaign and its prospects?')) return; for (const p of (await G().all()).filter(p => p.campaign === c.id)) await G().del(p.id); G().saveCampaigns(G().campaigns().filter(x => x.id !== c.id)); cid = null; close?.(); UC.go('growth'); });
      root.querySelector('#cGo').onclick = async e => {
        const v = id => root.querySelector(id).value.trim();
        const n = { id: c?.id || App.uid(), offer: v('#cOffer'), ideal: v('#cIdeal'), kind: v('#cKind'), tag: v('#cTag'), area: v('#cArea'), radiusKm: +v('#cRad') || 10, created: c?.created || Date.now() };
        n.name = v('#cName') || `${G().KINDS.find(x => x[0] === n.kind)?.[1] || 'Businesses'} · ${n.area}`;
        if (!n.offer || !n.area) return App.ui.toast('Say what you sell and where');
        const l = G().campaigns(); const i = l.findIndex(x => x.id === n.id); if (i >= 0) l[i] = n; else l.push(n); G().saveCampaigns(l); cid = n.id;
        close?.();
        if (!c) { e.target.disabled = true; e.target.innerHTML = '<span class="task-spin"></span> Finding…'; try { const r = await G().find(n); App.ui.toast(`Found ${r.found} ${n.name.split(' · ')[0].toLowerCase()} near ${n.area}`); } catch (err) { App.ui.toast(err.message, 6000); } }
        UC.go('growth');
      };
    };
    if (first) { view.innerHTML = `<section class="card">${html}</section>`; bind(view); }
    else App.ui.modal(html, (m, close) => bind(m, close));
  }

  /* Your offer: business details for every email (CAN-SPAM), proof, price, daily cap, do-not-contact */
  function profileSheet() {
    const p = G().profile();
    App.ui.modal(`<div class="row spread"><h2>Your offer</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-two"><label class="field">Business name<input id="pB" value="${esc(p.business)}"></label><label class="field">Your name (signs the emails)<input id="pS" value="${esc(p.sender)}"></label></div>
      <label class="field">Business mailing address (required on every email)<input id="pA" value="${esc(p.address)}" placeholder="Street, City, State ZIP"></label>
      <label class="field">Proof (results, clients, years)<input id="pP" value="${esc(p.proof)}" placeholder="e.g. 40 local sites built, average 2x more bookings"></label>
      <div class="sp-two"><label class="field">Price / offer<input id="pPr" value="${esc(p.price)}" placeholder="e.g. Free homepage mockup, sites from $1,500"></label><label class="field">Emails per day (max)<input id="pC" type="number" min="5" max="200" value="${p.dailyCap}"></label></div>
      <label class="field">Do not contact (emails or domains, one per line)<textarea id="pX" rows="4">${esc(G().suppress().join('\n'))}</textarea></label>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="pGo">Save</button></div>`, (c, close) => {
      c.querySelector('#pGo').onclick = () => {
        const v = id => c.querySelector(id).value.trim();
        G().setProfile({ business: v('#pB'), sender: v('#pS'), address: v('#pA'), proof: v('#pP'), price: v('#pPr'), dailyCap: Math.max(5, +v('#pC') || 30) });
        G().setSuppress([...new Set(v('#pX').split(/\n+/).map(s => s.trim().toLowerCase()).filter(Boolean))]);
        close(); App.ui.toast('Saved'); UC.go('growth', { keepScroll: true });
      };
    });
  }

  /* One prospect */
  async function prospectSheet(id, c) {
    const p = (await G().all()).find(x => x.id === id); if (!p) return;
    const [lab, tone] = STAT[p.status] || ['', ''];
    App.ui.modal(`<div class="row spread"><div style="min-width:0"><span class="uc-spill ${tone}">${lab}</span><h2 style="margin-top:6px">${esc(p.name)}</h2><div class="muted small">${esc([p.category, p.address].filter(Boolean).join(' · '))}</div></div><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="uc-alist" style="margin-top:12px">
        <div class="uc-kv"><span>Email</span><input id="xE" value="${esc(p.email || '')}" placeholder="add an email" inputmode="email"></div>
        <div class="uc-kv"><span>Contact</span><input id="xC" value="${esc(p.contact || '')}" placeholder="owner’s name (optional)"></div>
        <div class="uc-kv"><span>Website</span>${p.website ? `<a href="${esc(/^https?:/.test(p.website) ? p.website : 'https://' + p.website)}" target="_blank" rel="noopener">${esc(G().domain(p.website))}</a>` : '<span class="muted">none</span>'}</div>
        ${p.phone ? `<div class="uc-kv"><span>Phone</span><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></div>` : ''}
        <div class="uc-kv"><span>Fit</span><span>${p.fit?.score ?? '—'}${p.fit?.why ? ` · <span class="muted">${esc(p.fit.why)}</span>` : ''}</span></div></div>
      ${p.site ? `<div class="uc-sub">What their website says</div><ul class="uc-bul small">${(p.site.facts.length ? p.site.facts : ['Nothing stood out.']).map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : p.siteError ? `<p class="muted small">Website: ${esc(p.siteError)}</p>` : ''}
      ${p.draft ? `<div class="uc-sub">Email${p.draft.model ? ` · ${esc(p.draft.model)}` : ''}</div><div class="uc-md small"><b>${esc(p.draft.subject)}</b><br><br>${esc(p.draft.body).replace(/\n/g, '<br>')}</div>` : ''}
      ${(p.thread || []).length ? `<div class="uc-sub">Conversation</div>${p.thread.map(m => `<div class="uc-msg ${m.from}"><span class="muted tiny">${m.from === 'me' ? 'You' : esc(p.name)} · ${UC.ago(m.t)}</span><div>${esc(m.text).replace(/\n/g, '<br>')}</div></div>`).join('')}` : ''}
      ${p.status === 'sent' || p.status === 'replied' ? `<label class="field" style="margin-top:12px">Paste their reply<textarea id="xR" rows="4" placeholder="Paste what they wrote back"></textarea></label>` : ''}
      ${p.replyDraft && p.status === 'replied' ? `<div class="row" style="margin-top:8px"><a class="btn primary" href="${esc(G().mailto(p.email, p.replyDraft.subject, p.replyDraft.body))}">Open reply in Mail</a><span class="muted tiny">approve it in Needs your yes first if you want a check</span></div>` : ''}
      <div class="row" style="justify-content:space-between;margin-top:14px;gap:8px"><div class="row"><button class="btn ghost" id="xNo" style="color:var(--red)">Do not contact</button><button class="btn ghost" id="xDel">Delete</button></div>
        <div class="row">${p.status === 'sent' || p.status === 'replied' ? '<button class="btn" id="xMeet">Booked a meeting</button><button class="btn primary" id="xRep">Add reply</button>' : p.website && !p.site && G().canRead() ? '<button class="btn" id="xRead">Read website</button>' : ''}${['found', 'read', 'drafted'].includes(p.status) ? `<button class="btn primary" id="xWrite">${p.draft ? 'Rewrite email' : 'Write email'}</button>` : ''}</div></div>`, (m, close) => {
      const saveFields = async () => { p.email = m.querySelector('#xE').value.trim(); p.contact = m.querySelector('#xC').value.trim(); G().score(p); await G().put(p); };
      m.querySelector('#xE').onchange = saveFields; m.querySelector('#xC').onchange = saveFields;
      const busyBtn = b => { b.disabled = true; b.innerHTML = '<span class="task-spin"></span>'; };
      m.querySelector('#xRead')?.addEventListener('click', async e => { busyBtn(e.target); await G().readSite(p); close(); prospectSheet(id, c); });
      m.querySelector('#xWrite')?.addEventListener('click', async e => { await saveFields(); busyBtn(e.target); try { await G().write(p, c); App.ui.toast('Draft waiting in Needs your yes (Clients)'); close(); UC.go('growth', { keepScroll: true }); } catch (err) { App.ui.toast(err.message, 6000); close(); prospectSheet(id, c); } });
      m.querySelector('#xRep')?.addEventListener('click', async e => { const t = m.querySelector('#xR').value.trim(); if (!t) return App.ui.toast('Paste their reply first'); busyBtn(e.target); await G().reply(p, t); close(); App.ui.toast(p.lastKind === 'no' ? 'Added to do-not-contact' : 'Answer drafted'); prospectSheet(id, c); UC.go('growth', { keepScroll: true }); });
      m.querySelector('#xMeet')?.addEventListener('click', async () => { p.status = 'meeting'; await G().put(p); close(); App.ui.toast('Nice. Marked as a meeting.'); UC.go('growth', { keepScroll: true }); });
      m.querySelector('#xNo').onclick = async () => { G().setSuppress([...new Set([...G().suppress(), (p.email || G().domain(p.website)).toLowerCase()].filter(Boolean))]); p.status = 'lost'; await G().put(p); close(); UC.go('growth', { keepScroll: true }); };
      m.querySelector('#xDel').onclick = async () => { await G().del(p.id); close(); UC.go('growth', { keepScroll: true }); };
    });
  }
})(window.UC);
