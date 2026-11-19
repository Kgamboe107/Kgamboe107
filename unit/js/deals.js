/* Deals: find, research and contact acquisition and expansion opportunities.
   Four lead sources, all free:
   - Owners open to selling: independent businesses from OpenStreetMap (chains left out), with succession signals
     read from their websites (years in business, family owned, retirement, a site nobody has touched in years).
   - Businesses for sale: paste listing links or listing text, or import a broker's list. Price, cash flow,
     revenue and the asking multiple are pulled out. Search links open the big marketplaces for your kind and area.
   - Franchise brands: brands that are common in the wider region but absent in your area (white space), from
     OpenStreetMap brand tags, with the brand's website from Wikidata. Links open the public state franchise
     disclosure (FDD) databases.
   - Market gaps: people per business for each area you list (OpenStreetMap counts + population; Census County
     Business Patterns and population when you add a free Census key).
   Deals live in the same synced, encrypted store as Growth prospects (campaign = hunt id, deal: true).
   Contact drafts wait in Needs your yes and open in your own mail app. Nothing is sent automatically. */
(function (UC) {
  const { S } = UC;
  const G = () => UC.growth;
  const STAGES = [['lead', 'Lead'], ['research', 'Researching'], ['contacted', 'Contacted'], ['talking', 'Talking'], ['nda', 'Under NDA'], ['loi', 'LOI'], ['diligence', 'Due diligence'], ['closed', 'Closed'], ['passed', 'Passed']];
  const BIG = ['loi', 'closed', 'passed']; // moves that go through "Before you decide"
  const TYPES = { owner: ['Owner', 'Independent owner who may sell or partner'], listing: ['For sale', 'Listed for sale'], franchise: ['Franchise', 'Franchise brand with open territory'] };
  const NAICS = { dentists: ['621210', 'Offices of dentists'], doctors: ['621111', 'Offices of physicians'], vets: ['541940', 'Veterinary services'], restaurants: ['7225', 'Restaurants'], cafes: ['722515', 'Snack and coffee bars'], bars: ['722410', 'Drinking places'], salons: ['812112', 'Beauty salons'], gyms: ['713940', 'Fitness centers'], autorepair: ['811111', 'General auto repair'], lawyers: ['541110', 'Offices of lawyers'], accountants: ['541211', 'Offices of CPAs'], realestate: ['531210', 'Real estate agents'], insurance: ['524210', 'Insurance agencies'], roofers: ['238160', 'Roofing contractors'], plumbers: ['238220', 'Plumbing & HVAC contractors'], hvac: ['238220', 'Plumbing & HVAC contractors'], electricians: ['238210', 'Electrical contractors'], hotels: ['721110', 'Hotels and motels'], retail: ['44-45', 'Retail trade'] };
  const FDD = [['California DFPI (Docqnet)', 'https://docqnet.dfpi.ca.gov/'], ['Wisconsin DFI franchise search', 'https://apps.dfi.wi.gov/apps/FranchiseSearch/MainSearch.aspx'], ['Minnesota CARDS', 'https://www.cards.commerce.state.mn.us/']];
  const ST_FIPS = { AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56' };
  const ST_NAME = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY' };

  /* ---------- hunts (a search: what, where, why) ---------- */
  const hunts = () => S.get('deals.hunts', []);
  const saveHunts = l => S.set('deals.hunts', l);
  const profile = () => ({ buyer: '', experience: '', budget: '', criteria: '', ...S.get('deals.profile', {}) });
  const all = async hid => (await G().all()).filter(p => p.deal && (!hid || p.campaign === hid));
  const put = p => G().put(p);
  const tagOf = h => h.kind === 'custom' ? h.tag : G().KINDS.find(k => k[0] === h.kind)?.[2];
  const kindLabel = h => G().KINDS.find(k => k[0] === h.kind)?.[1] || h.tag || 'businesses';

  /* ---------- OpenStreetMap ---------- */
  async function place(area) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&extratags=1&q=${encodeURIComponent(area)}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Could not look up that area (OpenStreetMap ' + r.status + ').');
    const j = await r.json(); if (!j[0]) throw new Error(`OpenStreetMap doesn’t know “${area}”. Try “City, State”.`);
    const a = j[0].address || {}, st = a['ISO3166-2-lvl4']?.split('-')[1] || ST_NAME[String(a.state || '').toLowerCase()] || '';
    return { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name, population: +(j[0].extratags?.population || 0) || null, county: a.county || '', state: st };
  }
  async function overpass(q) {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new Error('OpenStreetMap search is busy (' + r.status + '). Try again in a minute.');
    return r.json();
  }
  const sel = (tag, R, g) => {
    const t = tag === '"amenity"="restaurant"' ? ['"amenity"~"restaurant|fast_food"'] : tag === '"amenity"="cafe"' ? ['"amenity"~"cafe|fast_food"', '"cuisine"~"coffee"'] : [tag];
    return t.length > 1 ? `nwr[${t[0]}][${t[1]}](around:${R},${g.lat},${g.lon});` : `nwr[${t[0]}](around:${R},${g.lat},${g.lon});`;
  };
  const addr = t => [t['addr:housenumber'], t['addr:street'], t['addr:city'] || '', t['addr:state'] || '', t['addr:postcode'] || ''].filter(Boolean).join(' ').trim();

  /* A. Independent owners (chains left out) */
  async function findOwners(h, onStatus) {
    const tag = tagOf(h); if (!tag) throw new Error('Pick what kind of business to look for.');
    onStatus?.('Finding the area…'); const g = await place(h.area);
    onStatus?.('Searching OpenStreetMap for independent owners…');
    const R = Math.round(Math.min(50, Math.max(1, +h.radiusKm || 15)) * 1000);
    const j = await overpass(`[out:json][timeout:40];(${sel(tag, R, g)});out center tags 600;`);
    const have = new Set((await all(h.id)).map(p => p.osm).filter(Boolean)); let n = 0;
    for (const e of j.elements || []) {
      const t = e.tags || {}; if (!t.name || t.brand || t['brand:wikidata'] || t.operator && /inc|corp|llc|group/i.test(t.operator) && t.operator !== t.name) continue;
      const osm = `${e.type}/${e.id}`; if (have.has(osm)) continue;
      await App.store.raw('prospects', 'put', { id: App.uid(), campaign: h.id, deal: true, dtype: 'owner', source: 'osm', osm, name: t.name, category: kindLabel(h), address: addr(t),
        phone: t.phone || t['contact:phone'] || '', email: t.email || t['contact:email'] || '', website: t.website || t['contact:website'] || '', lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon,
        established: t.start_date || '', stage: 'lead', status: 'found', created: Date.now(), updated: Date.now(), thread: [], signals: [] });
      n++;
    }
    App.bus.emit('data-changed', 'prospects');
    return { found: n, area: g.name };
  }

  /* B. Franchise white space: brands common in the region, missing in your area */
  async function findFranchises(h, onStatus) {
    const tag = tagOf(h); if (!tag) throw new Error('Pick what kind of business to look for.');
    onStatus?.('Finding the area…'); const g = await place(h.area);
    const R = Math.round(Math.min(50, Math.max(1, +h.radiusKm || 15)) * 1000), RR = Math.round(Math.min(150, Math.max(30, +h.regionKm || 80)) * 1000);
    onStatus?.('Counting franchise brands across the region…');
    const reg = await overpass(`[out:json][timeout:60];(${sel(tag, RR, g).replace(');', ');').replace(/^nwr/, 'nwr["brand"]')});out center tags 4000;`);
    const count = {}, local = {};
    for (const e of reg.elements || []) {
      const t = e.tags || {}; const b = t.brand; if (!b) continue;
      const k = b.toLowerCase(); const c = count[k] = count[k] || { brand: b, wikidata: t['brand:wikidata'] || '', n: 0 }; c.n++;
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      if (lat && dist(g, { lat, lon }) <= R / 1000) local[k] = (local[k] || 0) + 1;
    }
    const gaps = Object.entries(count).filter(([k, c]) => c.n >= (+h.minRegion || 3) && !local[k]).sort((a, b) => b[1].n - a[1].n).slice(0, 30);
    const thin = Object.entries(count).filter(([k, c]) => local[k] === 1 && c.n >= 10).slice(0, 10);
    const sites = await brandSites([...gaps, ...thin].map(([, c]) => c.wikidata).filter(Boolean));
    const have = new Set((await all(h.id)).filter(p => p.dtype === 'franchise').map(p => p.name.toLowerCase())); let n = 0;
    for (const [k, c] of [...gaps, ...thin]) {
      if (have.has(k)) continue;
      await App.store.raw('prospects', 'put', { id: App.uid(), campaign: h.id, deal: true, dtype: 'franchise', source: 'osm-brands', name: c.brand, category: `${kindLabel(h)} franchise`, address: '',
        website: sites[c.wikidata] || '', email: '', phone: '', fr: { brand: c.brand, wikidata: c.wikidata, regionCount: c.n, localCount: local[k] || 0, regionKm: RR / 1000, localKm: R / 1000 },
        stage: 'lead', status: 'found', created: Date.now(), updated: Date.now(), thread: [], signals: [] });
      n++;
    }
    App.bus.emit('data-changed', 'prospects');
    return { found: n, brands: Object.keys(count).length, area: g.name };
  }
  function dist(a, b) { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; }
  async function brandSites(ids) {
    const out = {}; ids = [...new Set(ids)].filter(id => /^Q\d+$/.test(id));
    for (let i = 0; i < ids.length; i += 45) {
      try {
        const j = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.slice(i, i + 45).join('|')}&props=claims&format=json&origin=*`).then(r => r.json());
        for (const [id, e] of Object.entries(j.entities || {})) { const v = e.claims?.P856?.[0]?.mainsnak?.datavalue?.value; if (v) out[id] = v; }
      } catch { /* optional */ }
    }
    return out;
  }

  /* C. Businesses for sale */
  const money = s => { if (!s) return null; const m = String(s).replace(/,/g, '').match(/\$?\s*([\d.]+)\s*(k|m|mm|million|thousand)?/i); if (!m) return null; let v = +m[1]; const u = (m[2] || '').toLowerCase(); if (u === 'k' || u === 'thousand') v *= 1e3; if (u === 'm' || u === 'mm' || u === 'million') v *= 1e6; return v > 0 ? Math.round(v) : null; };
  function parseListing(text) {
    const T = String(text).replace(/\s+/g, ' ');
    const grab = re => { const m = T.match(re); return m ? m[1].trim() : ''; };
    const amt = '(\\$\\s?[\\d,.]+\\s?(?:k|m|mm|million|thousand)?)';
    const f = {
      price: money(grab(new RegExp(`(?:asking price|list(?:ing)? price|price)\\s*[:\\-]?\\s*${amt}`, 'i'))),
      cashFlow: money(grab(new RegExp(`(?:cash flow|seller'?s? discretionary earnings|sde|owner'?s? benefit)\\s*[:\\-]?\\s*${amt}`, 'i'))),
      revenue: money(grab(new RegExp(`(?:gross revenue|gross sales|annual revenue|revenue|sales)\\s*[:\\-]?\\s*${amt}`, 'i'))),
      ebitda: money(grab(new RegExp(`ebitda\\s*[:\\-]?\\s*${amt}`, 'i'))),
      inventory: money(grab(new RegExp(`inventory\\s*[:\\-]?\\s*${amt}`, 'i'))),
      ffe: money(grab(new RegExp(`(?:ff&e|furniture,? fixtures)[^$]{0,30}${amt}`, 'i'))),
      established: grab(/(?:established|year established|founded|in business since)\s*[:\-]?\s*((?:19|20)\d\d)/i),
      employees: grab(/employees\s*[:\-]?\s*(\d{1,4}(?:\s*(?:ft|full[- ]time|pt|part[- ]time))?)/i),
      realEstate: /real estate\s*[:\-]?\s*(?:included|owned|available)/i.test(T) ? 'Included or available' : /real estate\s*[:\-]?\s*leased/i.test(T) ? 'Leased' : '',
      location: grab(/location\s*[:\-]?\s*([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})\b/),
      reason: grab(/reason for sell(?:ing)?\s*[:\-]?\s*([^.]{3,120})/i),
      financing: /seller financing|owner financing/i.test(T) ? (grab(/((?:seller|owner) financing[^.]{0,80})/i) || 'Seller financing mentioned') : '',
      franchise: /franchise resale|this is a franchise|franchised/i.test(T)
    };
    if (f.price && f.cashFlow) f.multiple = +(f.price / f.cashFlow).toFixed(2);
    return f;
  }
  async function addListing(h, { url = '', text = '', name = '' }) {
    const p = { id: App.uid(), campaign: h.id, deal: true, dtype: 'listing', source: url ? 'link' : 'pasted', name: name || '', category: kindLabel(h), address: '', website: url, email: '', phone: '', stage: 'lead', status: 'found', created: Date.now(), updated: Date.now(), thread: [], signals: [] };
    if (text) { p.fin = parseListing(text); p.listingText = text.slice(0, 8000); p.name = p.name || (text.match(/^\s*([^\n]{4,80})/) || [])[1]?.trim() || 'Listing'; p.address = p.fin.location || ''; }
    if (url && !text && canRead()) await readDeal(p, true);
    if (!p.name) p.name = url ? G().domain(url) : 'Listing';
    score(p); await put(p); App.bus.emit('data-changed', 'prospects'); return p;
  }
  async function importListings(h, file) {
    const ds = await App.ingest.parseSpreadsheet(file); const tables = Array.isArray(ds) ? ds : [ds]; let n = 0;
    for (const t of tables) for (const r of t.rows || []) {
      const col = names => { const k = App.findCol(t.headers, names); return k ? String(r[k] ?? '').trim() : ''; };
      const name = col(['Business', 'Business Name', 'Name', 'Listing', 'Title', 'Company']); if (!name) continue;
      const fin = { price: money(col(['Asking Price', 'Price', 'List Price'])), cashFlow: money(col(['Cash Flow', 'SDE', 'Discretionary Earnings'])), revenue: money(col(['Revenue', 'Gross Revenue', 'Sales', 'Gross Sales'])), ebitda: money(col(['EBITDA'])), established: col(['Established', 'Year Established', 'Founded']), location: col(['Location', 'City', 'Address']), reason: col(['Reason', 'Reason for Selling']) };
      if (fin.price && fin.cashFlow) fin.multiple = +(fin.price / fin.cashFlow).toFixed(2);
      const p = { id: App.uid(), campaign: h.id, deal: true, dtype: /franchise/i.test(col(['Type', 'Category'])) ? 'franchise' : 'listing', source: 'import', name, category: col(['Industry', 'Category', 'Type']) || kindLabel(h), address: fin.location, website: col(['URL', 'Link', 'Website']), email: col(['Email', 'Broker Email', 'Contact Email']), contact: col(['Broker', 'Contact', 'Owner']), phone: col(['Phone', 'Broker Phone']), fin, stage: 'lead', status: 'found', created: Date.now(), updated: Date.now(), thread: [], signals: [] };
      score(p); await App.store.raw('prospects', 'put', p); n++;
    }
    App.bus.emit('data-changed', 'prospects'); return n;
  }
  function searchLinks(h) {
    const k = kindLabel(h), a = h.area, q = s => 'https://www.google.com/search?q=' + encodeURIComponent(s);
    return [
      ['Businesses for sale (all marketplaces)', q(`${k} business for sale ${a} site:bizbuysell.com OR site:bizquest.com OR site:businessbroker.net OR site:dealstream.com OR site:loopnet.com`)],
      ['Franchise resales', q(`${k} franchise resale for sale ${a}`)],
      ['Business brokers near the area', q(`business broker ${a}`)],
      ['Owner retiring / closing notices', q(`"${k.toLowerCase()}" "${a}" owner retiring OR "for sale" OR "new ownership" OR "closing after"`)],
      ['Franchise opportunities for this kind of business', q(`${k} franchise opportunities ${a} territory available`)]
    ];
  }

  /* D. Market gaps: people per business, by area */
  async function markets(h, areas, onStatus) {
    const tag = tagOf(h); const rows = []; const key = S.get('census.key', '');
    for (const a of areas.map(s => s.trim()).filter(Boolean).slice(0, 12)) {
      try {
        onStatus?.(`Checking ${a}…`);
        const g = await place(a); const R = Math.round(Math.min(50, Math.max(1, +h.radiusKm || 15)) * 1000);
        const j = await overpass(`[out:json][timeout:40];(${sel(tag, R, g)});out count;`);
        const count = +(j.elements?.[0]?.tags?.total || 0);
        const row = { area: a, name: g.name, population: g.population, count, county: g.county, state: g.state, source: 'OpenStreetMap' };
        if (key && g.state && ST_FIPS[g.state] && g.county) { try { Object.assign(row, await census(key, g.state, g.county, h.kind)); } catch (e) { row.censusError = e.message; } }
        const pop = row.countyPop || row.population;
        row.perBiz = pop && (row.estab || count) ? Math.round(pop / (row.estab || count)) : null;
        rows.push(row);
      } catch (e) { rows.push({ area: a, error: e.message }); }
    }
    const ok = rows.filter(r => r.perBiz); const med = ok.length ? ok.reduce((a, r) => a + r.perBiz, 0) / ok.length : 0;
    ok.forEach(r => { r.vsMedian = med ? +(r.perBiz / med - 1).toFixed(2) : 0; r.read = r.vsMedian >= 0.25 ? 'Under-served' : r.vsMedian <= -0.25 ? 'Crowded' : 'Average'; });
    rows.sort((a, b) => (b.perBiz || 0) - (a.perBiz || 0));
    const l = S.get('deals.markets', []).filter(m => m.hunt !== h.id); l.push({ hunt: h.id, at: Date.now(), rows, kind: kindLabel(h) }); S.set('deals.markets', l.slice(-40));
    return rows;
  }
  async function census(key, st, county, kind) {
    const fips = ST_FIPS[st];
    const pop = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E&for=county:*&in=state:${fips}&key=${encodeURIComponent(key)}`).then(r => { if (!r.ok) throw new Error('Census ' + r.status); return r.json(); });
    const c = String(county).toLowerCase().replace(/ county| parish| borough/g, '').trim();
    const row = pop.slice(1).find(r => r[0].toLowerCase().startsWith(c)); if (!row) throw new Error('County not found in Census data');
    const out = { countyName: row[0], countyPop: +row[1] };
    const n = NAICS[kind];
    if (n) {
      const cbp = await fetch(`https://api.census.gov/data/2021/cbp?get=ESTAB,EMP&for=county:${row[3]}&in=state:${fips}&NAICS2017=${n[0]}&key=${encodeURIComponent(key)}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (cbp?.[1]) { out.estab = +cbp[1][0]; out.emp = +cbp[1][1]; out.naics = n[1]; out.source = 'Census (County Business Patterns 2021, ACS 2022)'; }
    }
    return out;
  }

  /* ---------- research: read the website or listing page ---------- */
  const canRead = () => G().canRead();
  async function readDeal(p, noSave) {
    if (!p.website) { p.siteError = 'No website on file.'; return noSave ? p : put(p); }
    const r = await fetch(`/api/fetch?url=${encodeURIComponent(p.website)}`, { headers: { 'X-OCD-Client': '1' } }).then(x => x.json()).catch(e => ({ error: e.message }));
    if (r.error) { p.siteError = r.error; return noSave ? p : put(p); }
    const doc = new DOMParser().parseFromString(r.html, 'text/html'); doc.querySelectorAll('script,style,noscript,svg').forEach(n => n.remove());
    const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim(), now = new Date().getFullYear();
    const sig = [];
    const est = text.match(/(?:since|established|est\.?|founded(?: in)?|serving [^.]{0,40} since)\s*((?:19|20)\d\d)/i)?.[1] || p.established?.slice(0, 4) || '';
    if (est && +est < now) sig.push(`In business since ${est} (${now - +est} years).`);
    if (/family[- ]owned|family[- ]run|third[- ]generation|second[- ]generation/i.test(text)) sig.push('Family owned.');
    if (/retir(e|ing|ement)|succession|new ownership|for sale|selling the business/i.test(text)) sig.push('The site mentions retirement, succession or a sale.');
    const cr = [...text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map(m => +m[1]).filter(y => y > 1995 && y <= now);
    if (cr.length && Math.max(...cr) <= now - 3) sig.push(`Website footer says © ${Math.max(...cr)}; it hasn’t been updated in years.`);
    if (!doc.querySelector('meta[name="viewport"]')) sig.push('Website isn’t set up for phones.');
    const emails = [...new Set([...r.html.matchAll(/mailto:([^"'?>\s]+)/gi)].map(m => decodeURIComponent(m[1]).toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)))];
    const frPage = [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).find(h => /franchis|own-a|ownership-opportunit/i.test(h || ''));
    if (p.dtype === 'franchise') {
      const fe = text.match(/franchise fee[^$]{0,30}(\$[\d,]+(?:\s?(?:k|m))?)/i)?.[1], inv = text.match(/(?:total )?(?:initial )?investment[^$]{0,40}(\$[\d,.]+\s?(?:k|m|million)?\s*(?:[-–to]+\s*\$[\d,.]+\s?(?:k|m|million)?)?)/i)?.[1], roy = text.match(/royalt(?:y|ies)[^%]{0,30}?(\d{1,2}(?:\.\d)?\s?%)/i)?.[1];
      p.fr = { ...(p.fr || {}), fee: fe || p.fr?.fee || '', investment: (inv || '').replace(/[.,;\s]+$/, '') || p.fr?.investment || '', royalty: roy || p.fr?.royalty || '', franchisingUrl: frPage ? new URL(frPage, r.url || p.website).href : p.fr?.franchisingUrl || '' };
      const fem = emails.find(e => /franchis|develop|growth|expan/i.test(e)); if (!p.email && (fem || emails[0])) p.email = fem || emails[0];
    } else {
      if (!p.email && emails[0]) p.email = emails[0];
      if (p.dtype === 'listing') { p.fin = { ...parseListing(text), ...(p.fin || {}) }; if (!p.name || p.name === 'Listing') p.name = (doc.title || '').split(/[|–-]/)[0].trim().slice(0, 80) || p.name; if (!p.address) p.address = p.fin.location || ''; }
    }
    p.established = est || p.established || '';
    p.signals = sig; p.site = { title: (doc.title || '').slice(0, 140), description: (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').slice(0, 240), facts: sig, emails: emails.slice(0, 3) };
    delete p.siteError; p.readAt = Date.now(); if (p.stage === 'lead') p.stage = 'research';
    score(p);
    return noSave ? p : put(p);
  }

  /* ---------- score (0–100) ---------- */
  function score(p) {
    let s = 0; const why = []; const now = new Date().getFullYear(), pr = profile();
    if (p.dtype === 'owner') {
      const yrs = p.established ? now - +String(p.established).slice(0, 4) : 0;
      if (yrs >= 25) { s += 30; why.push(`${yrs} years in business`); } else if (yrs >= 12) { s += 18; why.push(`${yrs} years in business`); }
      (p.signals || []).forEach(x => { if (/family/i.test(x)) { s += 10; why.push('family owned'); } if (/retire|succession|sale/i.test(x)) { s += 30; why.push('mentions retirement or sale'); } if (/©/.test(x)) { s += 12; why.push('website untouched for years'); } });
      if (!p.website) { s += 6; why.push('no website'); }
    } else if (p.dtype === 'listing') {
      const f = p.fin || {};
      if (f.price) s += 10; if (f.cashFlow) s += 15; if (f.revenue) s += 5;
      if (f.multiple) { if (f.multiple <= 3.5) { s += 30; why.push(`${f.multiple}× cash flow`); } else if (f.multiple <= 5) { s += 15; why.push(`${f.multiple}× cash flow`); } else why.push(`${f.multiple}× cash flow (high)`); }
      const budget = money(pr.budget); if (budget && f.price) { if (f.price <= budget) { s += 10; why.push('within budget'); } else { s -= 15; why.push('over budget'); } }
      if (f.financing) { s += 8; why.push('seller financing'); }
      if (f.established && now - +f.established >= 10) { s += 5; why.push(`since ${f.established}`); }
    } else if (p.dtype === 'franchise') {
      const fr = p.fr || {};
      if (fr.localCount === 0) { s += 25 + Math.min(25, fr.regionCount * 2); why.push(`${fr.regionCount} in the region, none in your area`); } else if (fr.localCount === 1) { s += 15; why.push(`${fr.regionCount} in region, only 1 nearby`); }
      if (fr.franchisingUrl) { s += 10; why.push('has a franchising page'); } if (fr.investment) { s += 5; why.push('investment listed'); }
    }
    if (p.email) { s += 12; why.push('has an email'); } else why.push('no email yet');
    if (p.phone) s += 3;
    if (G().isSuppressed(p)) { s = 0; why.unshift('on your do-not-contact list'); }
    p.fit = { score: Math.max(0, Math.min(100, s)), why: why.join(' · ') };
    return p.fit;
  }

  /* ---------- contact drafts (into Needs your yes) ---------- */
  async function draft(p) {
    const gp = G().profile(), pr = profile();
    if (!gp.address.trim()) throw new Error('Add your business address in Deals → Your buyer profile first (every outreach email needs it by law).');
    if (G().isSuppressed(p)) throw new Error(`${p.name} is on your do-not-contact list.`);
    if (!p.email) throw new Error(`No email for ${p.name}. Add one first.`);
    const who = pr.buyer || gp.business || gp.sender, exp = pr.experience;
    const GOAL = { owner: `ask, respectfully and confidentially, whether the owner would ever consider selling, bringing in a partner, or planning a succession; make clear there is no pressure and that a "not now" is completely fine; offer a short, private conversation`, listing: `ask the broker or seller for the confidential information memorandum (CIM) and financials (3 years of P&Ls and tax returns), offer to sign their NDA, and ask the reason for selling and whether seller financing is possible`, franchise: `tell the franchise development team you want to open in a specific area, briefly state relevant operating experience, ask whether the territory is available, and request the current Franchise Disclosure Document (FDD) and the initial investment range` }[p.dtype];
    const facts = [...(p.signals || []), ...(p.fr ? [`${p.fr.regionCount} locations in the wider region and ${p.fr.localCount} in ${UC.deals.hunt(p.campaign)?.area || 'our area'}`] : []), ...(p.fin?.price ? [`asking ${App.fmt.money(p.fin.price)}${p.fin.cashFlow ? `, cash flow ${App.fmt.money(p.fin.cashFlow)}` : ''}`] : [])];
    const st = await UC.ai.status(); let d;
    if (st.running) {
      const r = await App.ai.ollamaChat({ format: 'json', messages: [
        { role: 'system', content: `You write short, professional first-contact emails for a business buyer and operator. Goal: ${GOAL}. Rules: under 140 words; plain, warm, respectful; use at most one true fact from the list (never invent); no hype, no flattery, no links; plain text; greeting "Hi there," unless a contact name is given. No signature. JSON {"subject": under 8 words, "body": the email}.` },
        { role: 'user', content: `Buyer: ${who}\nExperience: ${exp || '(not given)'}\nWhat they look for: ${pr.criteria || ''}\nArea: ${UC.deals.hunt(p.campaign)?.area || p.address}\n\nTo: ${p.name} (${TYPES[p.dtype][1]}), ${p.address || ''}\nContact name: ${p.contact || ''}\nFacts:\n${facts.map(f => '- ' + f).join('\n') || '- none'}` }] });
      let j; try { j = JSON.parse(r.text); } catch { const m = r.text.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : { subject: 'a quick question', body: r.text }; }
      d = { subject: String(j.subject || 'a quick question').slice(0, 90), body: String(j.body || '').trim(), model: r.model };
    } else {
      const hi = `Hi ${p.contact ? p.contact.split(' ')[0] : 'there'},\n\n`;
      d = { model: 'template', ...({
        owner: { subject: `a confidential question about ${p.name}`, body: `${hi}${p.established ? `${p.name} has served the area since ${String(p.established).slice(0, 4)}, which is rare. ` : ''}I ${exp ? `${exp.replace(/^i /i, '').replace(/\.$/, '')}, and I` : ''} am looking to invest in a well-run ${p.category?.toLowerCase() || 'business'} nearby.\n\nIf you ever think about selling, bringing in a partner or planning for retirement, I’d value a short, private conversation. If not, no problem at all, and I won’t follow up.\n\nWould you be open to a 15-minute call?` },
        listing: { subject: `inquiry: ${p.name}`.slice(0, 80), body: `${hi}I’m interested in ${p.name}${p.fin?.price ? ` (listed at ${App.fmt.money(p.fin.price)})` : ''}. ${exp ? exp.replace(/\.$/, '') + '. ' : ''}\n\nI’m happy to sign your NDA. Could you send the information memorandum, the last three years of P&Ls and tax returns, and let me know the reason for selling and whether seller financing is possible?\n\nThank you.` },
        franchise: { subject: `territory inquiry: ${UC.deals.hunt(p.campaign)?.area || ''}`.trim(), body: `${hi}I’m interested in opening ${p.name} in ${UC.deals.hunt(p.campaign)?.area || 'my area'}. ${exp ? exp.replace(/\.$/, '') + '. ' : ''}\n\nIs that territory available? Please send your current Franchise Disclosure Document and the initial investment range.\n\nThank you.` }
      })[p.dtype] };
    }
    d.body = d.body.replace(/\n*—[\s\S]*$/, '').trim() + `\n\n—\n${gp.sender || who}${gp.sender && who && who !== gp.sender ? `, ${who}` : ''}\n${gp.address}\nNot interested? Reply “no thanks” and I won’t email again.`;
    p.draft = { ...d, at: Date.now() }; p.status = 'drafted';
    const stt = UC.engine.state(); stt.asks = stt.asks.filter(a => !(a.growth === p.id && a.status === 'pending'));
    UC.engine.push(p.dtype === 'franchise' ? 'multi/territory' : 'multi/acquisition', { text: `Drafted a first contact to ${p.name} (${TYPES[p.dtype][0].toLowerCase()}).`, kind: 'waiting', asks: [{ lane: 'clients', to: `${p.name} <${p.email}>`, title: `Deal contact: ${p.name}`, detail: `Subject: ${d.subject}\n\n${d.body}`, growth: p.id }] });
    return put(p);
  }

  /* ---------- pipeline ---------- */
  async function setStage(p, stage) { p.stage = stage; p.stageAt = { ...(p.stageAt || {}), [stage]: Date.now() }; if (stage === 'contacted' && p.status === 'approved') p.status = 'sent'; return put(p); }
  async function toVenture(p) {
    const vs = UC.engine.ventures(); const S2 = UC.engine.STAGES;
    const v = { id: App.uid(), name: p.dtype === 'franchise' ? `${p.name} · ${UC.deals.hunt(p.campaign)?.area || ''}` : `Acquire ${p.name}`, type: 'custom', stage: 'idea', open: '', owner: 'You', notes: `From Deals (${TYPES[p.dtype][0]}). ${p.fit?.why || ''}`, check: Object.fromEntries(S2.map(s => [s.id, UC.engine.blankChecklist(s.id)])), deal: p.id };
    UC.engine.saveVentures([...vs, v]); p.venture = v.id; await put(p); return v;
  }
  async function stats(hid) {
    const l = await all(hid); const by = k => l.filter(p => p.stage === k).length;
    return { total: l.length, owners: l.filter(p => p.dtype === 'owner').length, listings: l.filter(p => p.dtype === 'listing').length, franchises: l.filter(p => p.dtype === 'franchise').length, active: l.filter(p => !['lead', 'research', 'passed', 'closed'].includes(p.stage)).length, by, list: l };
  }

  UC.deals = { STAGES, BIG, TYPES, FDD, NAICS, hunts, saveHunts, hunt: id => hunts().find(h => h.id === id), profile, setProfile: v => S.set('deals.profile', { ...profile(), ...v }), all, put, findOwners, findFranchises, addListing, importListings, parseListing, searchLinks, markets, readDeal, canRead, score, draft, setStage, toVenture, stats, kindLabel };
})(window.UC);
