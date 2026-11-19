/* Growth: outreach that books meetings. Claim → Find → Write → Reply.
   - Claim: what you sell, who your dream customer is, where.
   - Find: every matching business in the area from OpenStreetMap (free, no key), or import a list.
   - Read: the desktop app reads each website and pulls real, checkable details (dates, copyright year, booking, mobile).
   - Write: Ollama writes a short email built on one real detail. It waits in Needs your yes (Clients lane).
   - Send: after you approve, one tap opens it in your own mail app. Nothing is ever sent automatically.
   - Reply: paste a reply; the agent sorts it and drafts your answer.
   Includes the CAN-SPAM basics: your business address and an opt-out line on every email, and a do-not-contact list. */
(function (UC) {
  const { S } = UC;
  const profile = () => ({ business: '', sender: '', address: '', phone: '', proof: '', price: '', dailyCap: 30, ...S.get('growth.profile', {}) });
  const campaigns = () => S.get('growth.campaigns', []);
  const saveCampaigns = l => S.set('growth.campaigns', l);
  const suppress = () => S.get('growth.suppress', []);
  const isSuppressed = p => { const s = suppress().map(x => String(x).toLowerCase()); const e = String(p.email || '').toLowerCase(), d = domain(p.website || p.email || ''); return (e && s.includes(e)) || (d && s.includes(d)); };
  const domain = u => { try { const s = String(u); return (s.includes('@') && !s.includes('//') ? s.split('@')[1] : new URL(/^https?:/.test(s) ? s : 'https://' + s).hostname).replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

  const KINDS = [
    ['dentists', 'Dentists', '"amenity"="dentist"'], ['doctors', 'Doctors & clinics', '"amenity"~"doctors|clinic"'], ['vets', 'Veterinarians', '"amenity"="veterinary"'],
    ['restaurants', 'Restaurants', '"amenity"="restaurant"'], ['cafes', 'Cafés & coffee', '"amenity"="cafe"'], ['bars', 'Bars & pubs', '"amenity"~"bar|pub"'],
    ['salons', 'Hair & beauty salons', '"shop"~"hairdresser|beauty"'], ['gyms', 'Gyms & fitness', '"leisure"="fitness_centre"'], ['autorepair', 'Auto repair', '"shop"="car_repair"'],
    ['lawyers', 'Lawyers', '"office"="lawyer"'], ['accountants', 'Accountants', '"office"~"accountant|tax_advisor"'], ['realestate', 'Real estate agents', '"office"="estate_agent"'],
    ['insurance', 'Insurance agents', '"office"="insurance"'], ['roofers', 'Roofers', '"craft"="roofer"'], ['plumbers', 'Plumbers', '"craft"="plumber"'], ['electricians', 'Electricians', '"craft"="electrician"'],
    ['hvac', 'HVAC', '"craft"="hvac"'], ['hotels', 'Hotels', '"tourism"~"hotel|motel"'], ['retail', 'Shops (any)', '"shop"'], ['custom', 'Custom OSM tag…', '']
  ];

  /* ---------- prospects store ---------- */
  const all = async () => (await App.store.all('prospects', { raw: true }).catch(() => []));
  const put = async p => { p.updated = Date.now(); await App.store.put('prospects', p); return p; };
  const del = id => App.store.del('prospects', id);

  /* ---------- find: OpenStreetMap (Nominatim geocode + Overpass search) ---------- */
  async function geocode(area) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(area)}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Could not look up that area (OpenStreetMap ' + r.status + ').');
    const j = await r.json(); if (!j[0]) throw new Error(`OpenStreetMap doesn’t know “${area}”. Try “City, State”.`);
    return { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name };
  }
  async function find(c, onStatus) {
    const kind = KINDS.find(k => k[0] === c.kind);
    const tag = c.kind === 'custom' ? c.tag : kind?.[2];
    if (!tag) throw new Error('Pick what kind of business to find.');
    onStatus?.('Finding the area…');
    const g = await geocode(c.area);
    const R = Math.round(Math.min(50, Math.max(1, +c.radiusKm || 10)) * 1000);
    const q = `[out:json][timeout:30];(nwr[${tag}](around:${R},${g.lat},${g.lon});`.replace('nwr["shop"]', 'nwr["shop"]') + `);out center tags 400;`;
    onStatus?.('Searching OpenStreetMap…');
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new Error('OpenStreetMap search is busy (' + r.status + '). Try again in a minute.');
    const j = await r.json();
    const have = new Set((await all()).filter(p => p.campaign === c.id).map(p => p.osm));
    let n = 0;
    for (const e of j.elements || []) {
      const t = e.tags || {}; if (!t.name) continue;
      const osm = `${e.type}/${e.id}`; if (have.has(osm)) continue;
      const site = t.website || t['contact:website'] || t.url || '';
      await App.store.raw('prospects', 'put', { id: App.uid(), campaign: c.id, source: 'osm', osm, name: t.name, category: kind?.[1] || tag,
        address: [t['addr:housenumber'], t['addr:street'], t['addr:city'] || '', t['addr:state'] || '', t['addr:postcode'] || ''].filter(Boolean).join(' ').trim(),
        phone: t.phone || t['contact:phone'] || '', email: t.email || t['contact:email'] || '', website: site, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon,
        status: 'found', created: Date.now(), updated: Date.now(), thread: [] });
      n++;
    }
    App.bus.emit('data-changed', 'prospects');
    return { found: n, total: (j.elements || []).length, area: g.name };
  }
  /* Import a CSV / Excel list (name, website, email, phone, city…) */
  async function importList(c, file) {
    const ds = await App.ingest.parseSpreadsheet(file);
    const tables = Array.isArray(ds) ? ds : [ds];
    let n = 0;
    for (const t of tables) for (const r of t.rows || []) {
      const col = names => { const k = App.findCol(t.headers, names); return k ? String(r[k] ?? '').trim() : ''; };
      const name = col(['Company', 'Business', 'Business Name', 'Name', 'Organization', 'Account']); if (!name) continue;
      await App.store.raw('prospects', 'put', { id: App.uid(), campaign: c.id, source: 'import', name, contact: col(['Contact', 'First Name', 'Owner', 'Contact Name', 'Full Name']),
        email: col(['Email', 'E-mail', 'Email Address', 'Work Email']), website: col(['Website', 'URL', 'Domain', 'Company Website']), phone: col(['Phone', 'Phone Number', 'Telephone']),
        address: col(['Address', 'City', 'Location']), category: col(['Industry', 'Category', 'Type']) || '', status: 'found', created: Date.now(), updated: Date.now(), thread: [] });
      n++;
    }
    App.bus.emit('data-changed', 'prospects');
    return n;
  }

  /* ---------- read websites (desktop app relay) ---------- */
  const canRead = () => !App.hosted && /^https?:$/.test(location.protocol);
  const MON = 'january|february|march|april|may|june|july|august|september|october|november|december';
  function details(html, meta) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript,svg').forEach(n => n.remove());
    const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
    const now = new Date().getFullYear();
    const years = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map(m => +m[1]).filter(y => y > 1995 && y <= now);
    const dates = [...text.matchAll(new RegExp(`\\b(${MON})\\s+(?:\\d{1,2},\\s*)?(20\\d\\d)\\b`, 'gi'))].map(m => ({ s: m[0], t: Date.parse(`${m[1]} 1, ${m[2]}`) })).filter(d => d.t && d.t < Date.now() + 864e5 * 31);
    const iso = [...text.matchAll(/\b(20\d\d)-(\d{2})-(\d{2})\b/g)].map(m => ({ s: m[0], t: Date.parse(m[0]) })).filter(d => d.t && d.t < Date.now());
    const newest = [...dates, ...iso].sort((a, b) => b.t - a.t)[0];
    const emails = [...new Set([...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map(m => decodeURIComponent(m[1]).toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)))].slice(0, 3);
    const gen = doc.querySelector('meta[name="generator"]')?.getAttribute('content') || (/wix\.com/i.test(html) ? 'Wix' : /squarespace/i.test(html) ? 'Squarespace' : /wp-content/i.test(html) ? 'WordPress' : /shopify/i.test(html) ? 'Shopify' : '');
    const out = {
      title: (doc.title || '').trim().slice(0, 140), description: (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').slice(0, 240),
      https: /^https:/.test(meta.url), mobile: !!doc.querySelector('meta[name="viewport"]'), copyright: years.length ? Math.max(...years) : null,
      newest: newest ? newest.s : '', newestT: newest?.t || 0, lastModified: meta.lastModified || '', booking: /\b(book (?:now|online|an appointment)|schedule (?:online|an appointment)|request an appointment)\b/i.test(text),
      emails, builder: gen.slice(0, 40), words: text.split(' ').length, snippet: text.slice(0, 600)
    };
    const facts = [];
    if (out.newest) facts.push(`The newest date on their site is ${out.newest}.`);
    if (out.copyright && out.copyright < now) facts.push(`Their footer says © ${out.copyright}.`);
    if (!out.mobile) facts.push('Their homepage isn’t set up for phones (no mobile viewport).');
    if (!out.https) facts.push('Their site loads without HTTPS (shows “Not secure”).');
    if (!out.booking) facts.push('There’s no online booking or appointment request on the homepage.');
    if (out.builder) facts.push(`The site runs on ${out.builder}.`);
    out.facts = facts;
    return out;
  }
  async function readSite(p) {
    if (!p.website) { p.status = p.status === 'found' ? 'found' : p.status; p.siteError = 'No website on file.'; return put(p); }
    const r = await fetch(`/api/fetch?url=${encodeURIComponent(p.website)}`, { headers: { 'X-OCD-Client': '1' } }).then(x => x.json()).catch(e => ({ error: e.message }));
    if (r.error) { p.siteError = r.error; p.status = p.status === 'found' ? 'read' : p.status; return put(p); }
    p.site = details(r.html, r); delete p.siteError;
    if (!p.email && p.site.emails[0]) p.email = p.site.emails[0];
    p.status = p.status === 'found' ? 'read' : p.status; p.readAt = Date.now();
    score(p);
    return put(p);
  }
  /* Fit score (0–100): reachable, and has a real, specific detail to write about */
  function score(p) {
    let s = 0; const why = [];
    if (p.email) { s += 30; why.push('has an email'); } else why.push('no email yet');
    if (p.website) { s += 10; }
    if (p.site?.facts?.length) { s += Math.min(40, p.site.facts.length * 12); why.push(`${p.site.facts.length} real detail${p.site.facts.length > 1 ? 's' : ''} found`); }
    if (p.site && p.site.newestT && Date.now() - p.site.newestT > 365 * 864e5) { s += 10; why.push('site not updated in a year'); }
    if (p.phone) s += 5;
    if (isSuppressed(p)) { s = 0; why.unshift('on your do-not-contact list'); }
    p.fit = { score: Math.min(100, s), why: why.join(' · ') };
    return p.fit;
  }

  /* ---------- write (Ollama) ---------- */
  const footer = () => { const pr = profile(); return `\n\n—\n${pr.sender || pr.business}${pr.business && pr.sender ? `, ${pr.business}` : ''}\n${pr.address}\nNot interested? Reply “no thanks” and I won’t email again.`; };
  async function write(p, c) {
    const pr = profile();
    if (!pr.address.trim()) throw new Error('Add your business address in Growth → Your offer first (every email needs it by law).');
    if (isSuppressed(p)) throw new Error(`${p.name} is on your do-not-contact list.`);
    if (!p.email) throw new Error(`No email for ${p.name}. Add one before writing.`);
    const st = await UC.ai.status();
    const det = p.site?.facts || [];
    let draft;
    if (st.running) {
      const r = await App.ai.ollamaChat({ format: 'json', messages: [
        { role: 'system', content: `You write short, honest cold emails for ${pr.business || 'a small business'} that real owners actually answer. Rules: under 110 words; open with ONE specific, true detail from the facts list (quote it accurately, never invent or exaggerate); say plainly what you offer and why it helps them; end with one easy yes/no question; no hype, no links, no attachments, no fake familiarity, no "I hope this finds you well"; plain text; first name only in the greeting if a contact name is given, otherwise "Hi there,". Do not add a signature or footer. Reply JSON {"subject": under 7 words, lowercase except names, "body": the email, "detail_used": the fact you used}.` },
        { role: 'user', content: `What we sell: ${c.offer}\nIdeal customer: ${c.ideal || ''}\nProof: ${pr.proof || ''}\nPrice / offer: ${pr.price || ''}\n\nProspect: ${p.name} (${p.category || ''}), ${p.address || c.area}\nContact name: ${p.contact || ''}\nWebsite: ${p.website || 'none'}\nFacts from their website:\n${det.map(f => '- ' + f).join('\n') || '- (no website details; keep it general but specific to their kind of business)'}\nSite title: ${p.site?.title || ''}\nSite description: ${p.site?.description || ''}` }] });
      let j; try { j = JSON.parse(r.text); } catch { const m = r.text.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : { subject: 'quick question', body: r.text }; }
      draft = { subject: String(j.subject || 'quick question').slice(0, 80), body: String(j.body || '').trim(), detail: String(j.detail_used || det[0] || ''), model: r.model };
    } else {
      const d = det[0] || `I came across ${p.name} while looking at ${(p.category || 'local businesses').toLowerCase()} near ${c.area}.`;
      draft = { subject: `a quick idea for ${p.name}`.toLowerCase().replace(p.name.toLowerCase(), p.name), body: `Hi ${p.contact ? p.contact.split(' ')[0] : 'there'},\n\n${d} ${c.offer ? `I help businesses like yours with ${c.offer.toLowerCase()}.` : ''}\n\nWould it be worth a 10-minute call this week?`, detail: d, model: 'template' };
    }
    draft.body = draft.body.replace(/\n*—[\s\S]*$/, '').trim() + footer();
    p.draft = { ...draft, at: Date.now() }; p.status = 'drafted';
    // Into Needs your yes (Clients lane): nothing leaves until you approve
    const stt = UC.engine.state();
    stt.asks = stt.asks.filter(a => !(a.growth === p.id && a.status === 'pending'));
    UC.engine.push('sales/leads', { text: `Drafted an email to ${p.name}${draft.detail ? ` using: ${draft.detail}` : ''}.`, kind: 'waiting', asks: [{ lane: 'clients', to: `${p.name} <${p.email}>`, title: `Email to ${p.name}: ${draft.subject}`, detail: `Subject: ${draft.subject}\n\n${draft.body}`, growth: p.id }] });
    return put(p);
  }

  /* Approvals in Needs your yes flow back to the prospect */
  async function reconcile() {
    const st = UC.engine.state(); const list = await all(); let n = 0;
    for (const a of st.asks.filter(a => a.growth && a.status !== 'pending')) {
      const p = list.find(x => x.id === a.growth); if (!p || p.decided === a.id) continue;
      if (a.status === 'approved') {
        const m = String(a.detail || '').match(/^Subject:\s*(.*)\n\n([\s\S]*)$/);
        if (m) p.draft = { ...(p.draft || {}), subject: m[1], body: m[2] };
        p.status = p.status === 'replied' || p.status === 'meeting' ? p.status : 'approved';
      } else if (p.status === 'drafted') p.status = 'read';
      p.decided = a.id; await put(p); n++;
    }
    return n;
  }
  const mailto = (to, subject, body) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  async function markSent(p) {
    p.status = 'sent'; p.sentAt = Date.now();
    p.thread = [...(p.thread || []), { t: Date.now(), from: 'me', subject: p.draft?.subject, text: p.draft?.body || '' }];
    S.set('growth.sentLog', [...S.get('growth.sentLog', []).filter(t => t > Date.now() - 864e5), Date.now()]);
    return put(p);
  }
  const sentToday = () => S.get('growth.sentLog', []).filter(t => t > Date.now() - 864e5).length;

  /* ---------- replies ---------- */
  async function reply(p, text) {
    p.thread = [...(p.thread || []), { t: Date.now(), from: 'them', text }];
    let kind = /\b(unsubscribe|remove me|no thanks|not interested|stop emailing|do not contact)\b/i.test(text) ? 'no' : /\b(yes|sure|interested|let'?s talk|call|meet|tuesday|wednesday|thursday|friday|monday|available|sounds good)\b/i.test(text) ? 'interested' : 'question';
    let answer = '';
    const st = await UC.ai.status();
    if (kind === 'no') { S.set('growth.suppress', [...new Set([...suppress(), (p.email || '').toLowerCase()].filter(Boolean))]); p.status = 'lost'; }
    else {
      if (st.running) {
        const pr = profile();
        const r = await App.ai.ollamaChat({ format: 'json', messages: [
          { role: 'system', content: `You answer replies to outreach for ${pr.business}. Classify the reply as "interested", "question" or "no". Then draft a short, warm answer (under 90 words) that moves toward a booked call; offer two concrete time options if they're interested; answer questions honestly using only the offer details; never pressure. No signature. JSON {"kind": ..., "answer": ...}.` },
          { role: 'user', content: `Our offer: ${campaigns().find(c => c.id === p.campaign)?.offer || ''}\nPrice/offer: ${pr.price}\n\nThread:\n${p.thread.map(m => `${m.from === 'me' ? 'Us' : p.name}: ${m.text}`).join('\n\n')}` }] });
        try { const j = JSON.parse(r.text); kind = ['interested', 'question', 'no'].includes(j.kind) ? j.kind : kind; answer = String(j.answer || ''); } catch { answer = r.text; }
      } else answer = kind === 'interested' ? `Great, thanks for getting back to me. Would Tuesday at 2pm or Wednesday at 10am work for a 15-minute call?` : `Thanks for the reply. Happy to answer that: `;
      p.status = kind === 'interested' ? 'replied' : 'replied';
      if (answer) {
        const body = answer.trim() + footer();
        p.replyDraft = { subject: 'Re: ' + (p.draft?.subject || ''), body, kind };
        UC.engine.push('sales/leads', { text: `${p.name} replied (${kind}). Answer drafted.`, kind: 'waiting', asks: [{ lane: 'clients', to: `${p.name} <${p.email}>`, title: `Reply to ${p.name} (${kind})`, detail: `Subject: ${p.replyDraft.subject}\n\n${body}`, growth: p.id }] });
      }
    }
    p.lastKind = kind;
    return put(p);
  }

  /* ---------- dashboard ---------- */
  async function stats(cid) {
    const l = (await all()).filter(p => !cid || p.campaign === cid);
    const c = s => l.filter(p => s.includes(p.status)).length;
    const waiting = UC.engine.state().asks.filter(a => a.growth && a.status === 'pending').length;
    return { found: l.length, read: l.filter(p => p.site || p.readAt).length, drafted: c(['drafted', 'approved', 'sent', 'replied', 'meeting', 'won']), sent: c(['sent', 'replied', 'meeting', 'won']), replies: c(['replied', 'meeting', 'won']), meetings: c(['meeting', 'won']), waiting, list: l };
  }

  App.bus.on('uc-changed', () => { reconcile().then(n => { if (n && UC.current?.() === 'growth') UC.go('growth', { keepScroll: true }); }); });

  UC.growth = { profile, setProfile: v => S.set('growth.profile', { ...profile(), ...v }), campaigns, saveCampaigns, KINDS, all, put, del, find, importList, canRead, readSite, score, write, reconcile, mailto, markSent, sentToday, reply, stats, suppress, setSuppress: l => S.set('growth.suppress', l), isSuppressed, domain };
})(window.UC);
