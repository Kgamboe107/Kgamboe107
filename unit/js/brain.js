/* The Brain: a second-brain memory for everything the business (and you) do.
   - Captures every detail, sectioned: units and their daily numbers, monthly reports, imports, purchases and vendors,
     agent results, your decisions, ventures, knowledge, research notes, personal finances, and your own notes.
   - Notes link to each other ([[wiki links]]), so it reads like an Obsidian vault and shows as a graph.
   - Daily unit numbers are kept forever as "facts", so year-over-year comparisons work even after files are deleted.
   - Recall: keyword search everywhere; search by meaning with Ollama embeddings on the computer.
   - Synced, encrypted on the device, through your account (stores 'brain' and 'facts'); search vectors stay per device.
   - Two-way sync with an Obsidian vault folder (desktop app, or Chrome/Edge folder access). */
(function (UC) {
  const { esc } = App;
  const money = v => App.fmt.money(v);
  const P = (...a) => a.filter(Boolean).join('/');
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const clean = s => String(s || '').replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Untitled';
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = ym => { const [y, m] = ym.split('-'); return `${MON[+m - 1]} ${y}`; };
  const fmtDay = d => d ? new Date(d + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';

  /* Types and their top-level sections */
  const TYPES = {
    unit: ['Business', 'Unit'], month: ['Business', 'Monthly report'], import: ['Imports', 'Import'], purchases: ['Business', 'Purchases'], vendor: ['Vendors', 'Vendor'],
    agent: ['Agents', 'Agent result'], log: ['Journal', 'Agent log'], decision: ['Decisions', 'Decision'], venture: ['Ventures', 'Venture'], knowledge: ['Knowledge', 'Knowledge'],
    research: ['Research', 'Research note'], project: ['Projects', 'Project'], prospect: ['Growth', 'Prospect'], objectives: ['Journal', 'Daily objectives'], deal: ['Deals', 'Deal'], brief: ['Decisions', 'Decision brief'], legal: ['Legal', 'Legal check'], personal: ['Personal', 'Personal'], note: ['Notes', 'Note'], meeting: ['Notes', 'Meeting'], person: ['People', 'Person']
  };
  UC.BRAIN_TYPES = TYPES;
  const SECTION_COLORS = { Projects: '#E9B949', Growth: '#2F9BFF', Business: '#6366f1', Imports: '#06b6d4', Vendors: '#14b8a6', Agents: '#f59e0b', Journal: '#94a3b8', Decisions: '#ef4444', Deals: '#D4A23C', Legal: '#64748b', Ventures: '#f97316', Knowledge: '#a3a3a3', Research: '#8b5cf6', Personal: '#ec4899', Notes: '#22c55e', People: '#eab308' };
  UC.sectionColor = s => SECTION_COLORS[String(s).split('/')[0]] || '#64748b';

  /* ---------- in-memory index ---------- */
  let notes = new Map(), byTitle = new Map(), loaded = false, vecs = new Map();
  const tokens = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9$%.\s-]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  const STOP = new Set('the a an and or of to in on for with at by from is are was were be been it this that as not no but if so we you your our they them their its i me my he she his her has have had do did does will would can could should may might than then there here what which who how when where why all any each more most other some such only own same too very just over under about into up out also per vs'.split(' '));
  let inv = new Map(); // token -> Map(noteId -> weight)
  function indexNote(n) {
    const w = new Map();
    for (const t of tokens(n.title)) w.set(t, (w.get(t) || 0) + 4);
    for (const t of tokens((n.tags || []).join(' ') + ' ' + n.section)) w.set(t, (w.get(t) || 0) + 2);
    for (const t of tokens(n.body).slice(0, 4000)) w.set(t, (w.get(t) || 0) + 1);
    for (const [t, c] of w) { if (!inv.has(t)) inv.set(t, new Map()); inv.get(t).set(n.id, c); }
  }
  function unindex(id) { for (const m of inv.values()) m.delete(id); }
  async function load(force) {
    if (loaded && !force) return;
    const all = await App.store.all('brain', { raw: true }).catch(() => []);
    notes = new Map(all.map(n => [n.id, n])); byTitle = new Map(all.map(n => [n.title.toLowerCase(), n.id])); inv = new Map();
    all.forEach(indexNote);
    vecs = new Map((await App.store.all('brainvec', { raw: true }).catch(() => [])).filter(v => v.v).map(v => [v.id, v]));
    loaded = true;
  }

  /* Upsert a note only when its content changed (keeps sync quiet and devices in agreement) */
  async function put(n) {
    const prev = notes.get(n.id);
    const [sec] = TYPES[n.type] || TYPES.note;
    const note = { section: sec, tags: [], links: [], date: '', ...prev, ...n };
    note.title = clean(note.title);
    const wiki = [...String(note.body || '').matchAll(/\[\[([^\]|#]+)/g)].map(m => byTitle.get(clean(m[1]).toLowerCase())).filter(x => x && x !== note.id);
    if (wiki.length) note.links = [...new Set([...(note.links || []), ...wiki])];
    if (n.mine === undefined && prev?.mine) note.mine = prev.mine; // your own lines under "My notes" survive regeneration
    note.h = hash(JSON.stringify([note.title, note.section, note.body, note.tags, note.links, note.date, note.mine || '']));
    if (prev && prev.h === note.h) return prev;
    note.updated = n.updated || prev?.updated || Date.now();
    if (prev && prev.h !== note.h && !n.updated) note.updated = Date.now();
    note.created = prev?.created || n.created || note.updated;
    notes.set(note.id, note); byTitle.set(note.title.toLowerCase(), note.id); unindex(note.id); indexNote(note);
    await App.store.raw('brain', 'put', note);
    dirty = true;
    return note;
  }
  let dirty = false;
  async function remove(id) { notes.delete(id); unindex(id); await App.store.raw('brain', 'delete', id); await App.store.raw('brainvec', 'delete', id).catch(() => {}); dirty = true; }

  /* ---------- permanent daily facts (year over year) ---------- */
  async function syncFacts(ctx) {
    const have = new Map((await App.store.all('facts', { raw: true }).catch(() => [])).map(f => [f.id, f]));
    let n = 0;
    for (const u of ctx.real || []) for (const r of u.days) {
      const id = `${u.id}|${r.date}`, f = { id, unit: u.id, unitName: u.name, date: r.date, sales: r.sales ?? null, forecast: r.forecast ?? null, labor: r.labor ?? null, hours: r.hours ?? null, sched: r.sched ?? null, ot: r.ot ?? null, guests: r.guests ?? null };
      const old = have.get(id);
      if (!old || JSON.stringify({ ...old, unitName: '' }) !== JSON.stringify({ ...f, unitName: '' }) || old.unitName !== f.unitName) { await App.store.raw('facts', 'put', f); have.set(id, f); n++; }
    }
    return [...have.values()];
  }
  const factsAll = async () => App.store.all('facts', { raw: true }).catch(() => []);
  const agg = rows => { const s = k => rows.reduce((a, r) => a + (+r[k] || 0), 0); const sales = s('sales'), labor = s('labor'), hours = s('hours'), fc = s('forecast');
    return { days: rows.length, sales, labor, hours, forecast: fc, guests: s('guests'), ot: s('ot'), laborPct: sales ? labor / sales : NaN, splh: hours ? sales / hours : NaN }; };
  const shift = (d, days) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + days); return App.dateKey(x); };
  const shiftYear = (d, years) => { const x = new Date(d + 'T12:00'); x.setFullYear(x.getFullYear() + years); return App.dateKey(x); };
  /* Period ranges ending at `end`, and the same period a year earlier (day/week align by weekday: 364 days back) */
  function periods(end) {
    const e = new Date(end + 'T12:00'), y = e.getFullYear(), m = e.getMonth();
    const wk = (() => { const x = new Date(e); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return App.dateKey(x); })();
    const qs = App.dateKey(new Date(y, Math.floor(m / 3) * 3, 1, 12));
    const P = [
      ['day', 'Latest day', end, end, shift(end, -364), shift(end, -364)],
      ['wtd', 'Week to date', wk, end, shift(wk, -364), shift(end, -364)],
      ['d28', 'Last 4 weeks', shift(end, -27), end, shift(end, -27 - 364), shift(end, -364)],
      ['mtd', 'Month to date', App.dateKey(new Date(y, m, 1, 12)), end, shiftYear(App.dateKey(new Date(y, m, 1, 12)), -1), shiftYear(end, -1)],
      ['qtd', 'Quarter to date', qs, end, shiftYear(qs, -1), shiftYear(end, -1)],
      ['ytd', 'Year to date', `${y}-01-01`, end, `${y - 1}-01-01`, shiftYear(end, -1)]
    ];
    return P.map(([id, label, a, b, la, lb]) => ({ id, label, a, b, la, lb }));
  }
  /* Like-for-like: only days that exist in both years count toward the change (partial history can't inflate it) */
  function compare(facts, unitIds, end) {
    const mine = facts.filter(f => !unitIds || unitIds.includes(f.unit));
    const key = new Map(mine.map(f => [`${f.unit}|${f.date}`, f]));
    return periods(end).map(p => {
      const ty = mine.filter(f => f.date >= p.a && f.date <= p.b), ly = mine.filter(f => f.date >= p.la && f.date <= p.lb);
      const back = ['day', 'wtd', 'd28'].includes(p.id) ? d => shift(d, -364) : d => shiftYear(d, -1);
      const pairs = ty.map(f => [f, key.get(`${f.unit}|${back(f.date)}`)]).filter(x => x[1]);
      return { ...p, ty: agg(ty), ly: agg(ly), lfl: { ty: agg(pairs.map(x => x[0])), ly: agg(pairs.map(x => x[1])), days: pairs.length }, coverage: ty.length ? pairs.length / ty.length : 0 };
    });
  }
  function monthly(facts, unitIds) {
    const by = {};
    for (const f of facts) if (!unitIds || unitIds.includes(f.unit)) { const k = f.date.slice(0, 7); (by[k] = by[k] || []).push(f); }
    return Object.fromEntries(Object.entries(by).map(([k, rows]) => [k, agg(rows)]));
  }
  /* A compact year-over-year text block for agents and the Ask box */
  function yoyText(facts, unitIds, end) {
    if (!facts.length || !end) return '';
    const rows = compare(facts, unitIds, end).filter(r => r.ty.days);
    const ch = r => r.lfl.days ? ((r.lfl.ty.sales - r.lfl.ly.sales) / (r.lfl.ly.sales || 1) * 100).toFixed(1) + '%' + (r.coverage < 0.95 ? ` (same ${r.lfl.days} days only)` : '') : 'no data last year';
    return `## Year over year (${unitIds ? 'selected units' : 'all units'}, through ${end}; change compares the same days in both years)\n| Period | This year | Last year (same days) | Change | Labor % TY | Labor % LY |\n|---|---|---|---|---|---|\n` +
      rows.map(r => `| ${r.label} | ${money(r.ty.sales)} | ${r.lfl.days ? money(r.lfl.ly.sales) : '—'} | ${ch(r)} | ${isNaN(r.ty.laborPct) ? '—' : (r.ty.laborPct * 100).toFixed(1) + '%'} | ${isNaN(r.lfl.ly.laborPct) ? '—' : (r.lfl.ly.laborPct * 100).toFixed(1) + '%'} |`).join('\n');
  }

  /* ---------- capture: build notes from every source (idempotent) ---------- */
  let syncing = null;
  function capture(opts = {}) { if (!syncing) syncing = doCapture(opts).finally(() => { syncing = null; }); return syncing; }
  let captureTimer;
  const soon = () => { clearTimeout(captureTimer); captureTimer = setTimeout(() => capture(), 1500); };
  async function doCapture() {
    await load();
    const want = new Set();
    const keep = async n => { want.add(n.id); return put(n); };
    const ctx = await UC.data.load();
    const units = App.biz.list().filter(b => !b.archived);
    const unitName = id => units.find(b => b.id === id)?.name || 'Unknown unit';
    const kindLabel = b => App.biz.kindOf(b) === 'individual' ? 'Personal' : 'Business';
    const facts = await syncFacts(ctx);
    const vendors = new Map();

    // Units: profile note + one report per month (with last year's month beside it)
    for (const b of units) {
      const top = kindLabel(b);
      const mine = facts.filter(f => f.unit === b.id);
      const months = monthly(mine);
      const ms = Object.keys(months).sort();
      if (top === 'Business') {
        await keep({ id: `unit:${b.id}`, type: 'unit', title: b.name, section: P('Business', clean(b.name)), tags: ['unit', App.biz.TEMPLATES[b.type]?.label || b.type],
          body: `**${b.name}**, ${App.biz.TEMPLATES[b.type]?.label || 'business'}${b.description ? `. ${b.description}` : ''}\n\n${ms.length ? `Daily numbers on file: ${mine.length} days, ${fmtDay(mine.reduce((a, f) => f.date < a ? f.date : a, '9999'))} to ${fmtDay(mine.reduce((a, f) => f.date > a ? f.date : a, ''))}.\n\n| Month | Sales | Labor % | Same month last year | Change |\n|---|---|---|---|---|\n${ms.slice(-24).reverse().map(k => { const t = months[k], ly = months[`${+k.slice(0, 4) - 1}${k.slice(4)}`]; return `| [[${b.name} · ${monthName(k)}]] | ${money(t.sales)} | ${isNaN(t.laborPct) ? '—' : (t.laborPct * 100).toFixed(1) + '%'} | ${ly ? money(ly.sales) : '—'} | ${ly?.sales ? ((t.sales - ly.sales) / ly.sales * 100).toFixed(1) + '%' : '—'} |`; }).join('\n')}` : 'No daily numbers imported yet.'}`,
          updated: b.createdAt || 1 });
        for (const k of ms) {
          const t = months[k], ly = months[`${+k.slice(0, 4) - 1}${k.slice(4)}`];
          const days = mine.filter(f => f.date.startsWith(k)).sort((a, c) => a.date.localeCompare(c.date));
          const best = days.reduce((a, f) => (+f.sales || 0) > (+a?.sales || 0) ? f : a, null), worst = days.reduce((a, f) => (+f.sales || Infinity) < (+a?.sales || Infinity) ? f : a, null);
          await keep({ id: `month:${b.id}:${k}`, type: 'month', title: `${b.name} · ${monthName(k)}`, section: P('Business', clean(b.name), 'Monthly'), date: `${k}-01`, tags: ['monthly', k.slice(0, 4)],
            links: [`unit:${b.id}`, ly ? `month:${b.id}:${+k.slice(0, 4) - 1}${k.slice(4)}` : ''].filter(Boolean),
            body: `Monthly report for [[${b.name}]], ${monthName(k)} (${t.days} days on file).\n\n| | ${monthName(k)} | ${ly ? `[[${b.name} · ${monthName(`${+k.slice(0, 4) - 1}${k.slice(4)}`)}]]` : 'Last year'} |\n|---|---|---|\n| Sales | ${money(t.sales)} | ${ly ? money(ly.sales) : '—'} |\n| vs forecast | ${t.forecast ? ((t.sales - t.forecast) / t.forecast * 100).toFixed(1) + '%' : '—'} | ${ly?.forecast ? ((ly.sales - ly.forecast) / ly.forecast * 100).toFixed(1) + '%' : '—'} |\n| Labor $ | ${money(t.labor)} | ${ly ? money(ly.labor) : '—'} |\n| Labor % | ${isNaN(t.laborPct) ? '—' : (t.laborPct * 100).toFixed(1) + '%'} | ${ly && !isNaN(ly.laborPct) ? (ly.laborPct * 100).toFixed(1) + '%' : '—'} |\n| Hours | ${t.hours.toFixed(0)} | ${ly ? ly.hours.toFixed(0) : '—'} |\n| SPLH | ${isNaN(t.splh) ? '—' : '$' + t.splh.toFixed(0)} | ${ly && !isNaN(ly.splh) ? '$' + ly.splh.toFixed(0) : '—'} |\n| Overtime h | ${t.ot.toFixed(1)} | ${ly ? ly.ot.toFixed(1) : '—'} |\n| Guests | ${t.guests || '—'} | ${ly?.guests || '—'} |\n\n${best ? `Best day: ${fmtDay(best.date)} (${money(best.sales)}). ` : ''}${worst && worst !== best ? `Slowest day: ${fmtDay(worst.date)} (${money(worst.sales)}).` : ''}\n\n## Days\n${days.map(f => `- ${f.date}: ${money(f.sales)}${f.forecast ? ` (forecast ${money(f.forecast)})` : ''}${f.labor && f.sales ? `, labor ${(f.labor / f.sales * 100).toFixed(1)}%` : ''}${f.ot ? `, OT ${f.ot} h` : ''}`).join('\n')}`,
            updated: Date.parse(`${k}-28T12:00`) || 1 });
        }
      }
    }

    // Imports (every file in the shared library, desk or Unit Command)
    for (const f of await App.store.all('files', { raw: true }).catch(() => [])) {
      const b = units.find(x => x.id === App.biz.idOf(f)); const top = b ? kindLabel(b) : 'Business';
      const ds = (f.datasetIds || []).length;
      await keep({ id: `import:${f.id}`, type: 'import', title: `${f.name}`, section: P('Imports', top, clean(b?.name || 'Unsorted')), date: App.dateKey(new Date(f.uploadedAt || f.createdAt || f.added || Date.now())), tags: ['import', f.source, f.category].filter(Boolean),
        links: b && top === 'Business' ? [`unit:${b.id}`] : [],
        body: `Imported into **${b ? `[[${b.name}]]` : 'a unit'}**${f.source ? ` from ${App.sources?.[f.source]?.label || f.source}` : ''}${f.category ? ` (${f.category})` : ''}.\n\n${f.report?.label ? `Recognized as: ${f.report.label}\n\n` : ''}${(f.report?.summary || []).map(s => `- ${s}`).join('\n')}${f.report?.lands?.length ? `\n\nWent to: ${f.report.lands.map(l => l[1]).join('; ')}` : ''}${ds ? `\n\n${ds} data table${ds > 1 ? 's' : ''}.` : ''}${(f.tags || []).length ? `\n\nTags: ${f.tags.join(', ')}` : ''}${f.notes ? `\n\nNotes: ${f.notes}` : ''}`,
        updated: f.uploadedAt || f.createdAt || 1 });
    }

    // Purchases: monthly by unit + one note per vendor
    const purchases = await App.store.all('purchases', { raw: true }).catch(() => []);
    const pBy = {};
    for (const p of purchases.filter(p => !p.sample && p.date)) { const k = `${App.biz.idOf(p)}|${p.date.slice(0, 7)}`; (pBy[k] = pBy[k] || []).push(p); const v = clean(p.vendor || 'Unknown vendor'); if (!vendors.has(v)) vendors.set(v, []); vendors.get(v).push(p); }
    for (const [k, list] of Object.entries(pBy)) {
      const [bid, ym] = k.split('|'); const tot = list.reduce((a, p) => a + (+p.total || 0), 0);
      const byV = {}; list.forEach(p => { const v = clean(p.vendor || 'Unknown vendor'); byV[v] = (byV[v] || 0) + (+p.total || 0); });
      await keep({ id: `purch:${k}`, type: 'purchases', title: `${unitName(bid)} purchases · ${monthName(ym)}`, section: P('Business', clean(unitName(bid)), 'Purchases'), date: `${ym}-01`, tags: ['purchases', ym.slice(0, 4)],
        links: [`unit:${bid}`, ...Object.keys(byV).map(v => `vendor:${slug(v)}`)],
        body: `${list.length} invoices/receipts, ${money(tot)} total.\n\n| Vendor | Total |\n|---|---|\n${Object.entries(byV).sort((a, b) => b[1] - a[1]).map(([v, t]) => `| [[${v}]] | ${money(t)} |`).join('\n')}\n\n## Invoices\n${list.sort((a, b) => a.date.localeCompare(b.date)).map(p => `- ${p.date} ${p.vendor || ''} ${money(+p.total || 0)}${p.invoice ? ` #${p.invoice}` : ''}${(p.lines || []).length ? ` (${p.lines.length} lines)` : ''}`).join('\n')}`,
        updated: Date.parse(`${ym}-28T12:00`) || 1 });
    }
    const changes = App.purchasing?.priceChanges ? App.purchasing.priceChanges(purchases.filter(p => !p.sample && p.date)) : [];
    for (const [v, list] of vendors) {
      const tot = list.reduce((a, p) => a + (+p.total || 0), 0); const ch = changes.filter(c => clean(c.vendor) === v).slice(0, 15);
      await keep({ id: `vendor:${slug(v)}`, type: 'vendor', title: v, section: 'Vendors', tags: ['vendor'], links: [...new Set(list.map(p => `unit:${App.biz.idOf(p)}`))],
        body: `Vendor. ${list.length} invoices, ${money(tot)} total, ${list.map(p => p.date).sort()[0]} to ${list.map(p => p.date).sort().pop()}.\n\nUnits: ${[...new Set(list.map(p => `[[${unitName(App.biz.idOf(p))}]]`))].join(', ')}${ch.length ? `\n\n## Price changes\n${ch.map(c => `- ${c.date} ${c.item}: ${money(c.from, 2)} → ${money(c.to, 2)} (${(c.change * 100).toFixed(0)}%)`).join('\n')}` : ''}`,
        updated: Date.parse(list.map(p => p.date).sort().pop() + 'T12:00') || 1 });
    }

    // Agent results, the daily agent log, and every decision
    for (const o of await App.store.all('agentout', { raw: true }).catch(() => [])) {
      const a = UC.agent(o.agent), d = UC.dept(o.dept); if (!a) continue;
      const v = o.venture && UC.engine.ventures().find(x => x.id === o.venture);
      await keep({ id: `agent:${o.id}`, type: 'agent', title: `${a.name} · ${new Date(o.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')} · ${new Date(o.t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':', '.')}`, section: P('Agents', d.name, a.name), date: App.dateKey(new Date(o.t)), tags: ['agent', a.key, d.id, ...(o.demo ? ['demo'] : [])],
        links: [v ? `venture:${v.id}` : '', `day:${App.dateKey(new Date(o.t))}`].filter(Boolean),
        body: `**${a.name}** (${d.name})${v ? ` on [[${v.name}]]` : ''}${o.demo ? ', on demo data' : ''}. Model ${o.model || 'unknown'}${o.auto ? ', autopilot' : ''}.\n\n**Summary:** ${o.summary}\n${o.flags?.length ? `\n**Flags**\n${o.flags.map(f => `- ${f}`).join('\n')}\n` : ''}${o.missing?.length ? `\n**It needed**\n${o.missing.map(f => `- ${f}`).join('\n')}\n` : ''}${o.input ? `\n**You gave it**\n> ${o.input.slice(0, 1500).replace(/\n/g, '\n> ')}\n` : ''}\n## Result\n${o.output}`,
        updated: o.t });
    }
    const st = UC.engine.state();
    const byDay = {}; st.log.forEach(e => (byDay[e.date] = byDay[e.date] || []).push(e));
    for (const [day, list] of Object.entries(byDay)) await keep({ id: `log:${day}`, type: 'log', title: `Agent log · ${day}`, section: P('Journal', day.slice(0, 4), day.slice(5, 7)), date: day, tags: ['log'],
      body: list.sort((a, b) => a.t - b.t).map(e => `- ${new Date(e.t).toTimeString().slice(0, 5)} **${UC.agent(e.agent)?.name || e.agent}** (${e.kind})${e.demo ? ' [demo]' : ''}: ${e.text}`).join('\n'), updated: Math.max(...list.map(e => e.t)) });
    for (const q of st.asks.filter(a => a.status !== 'pending')) {
      const a = UC.agent(q.agent);
      await keep({ id: `decision:${q.id}`, type: 'decision', title: `${q.status === 'approved' ? 'Yes' : 'No'} · ${q.title}`.slice(0, 90), section: P('Decisions', String(new Date(q.decidedAt).getFullYear())), date: App.dateKey(new Date(q.decidedAt)), tags: ['decision', q.status, a?.key].filter(Boolean),
        links: q.out ? [`agent:${q.out}`] : [],
        body: `You **${q.status === 'approved' ? 'approved' : 'declined'}** a draft from ${a ? a.name : 'an agent'}${q.to ? ` for ${q.to}` : ''} on ${fmtDay(App.dateKey(new Date(q.decidedAt)))}${q.demo ? ' (demo data)' : ''}.\n\n## Draft\n${q.detail || ''}`, updated: q.decidedAt });
    }

    // Growth: every prospect you've written to or heard from
    for (const pr of (await App.store.all('prospects', { raw: true }).catch(() => [])).filter(x => !x.deal).filter(x => x.draft || (x.thread || []).length || ['meeting', 'won', 'lost'].includes(x.status))) {
      const camp = (UC.growth?.campaigns() || []).find(c => c.id === pr.campaign);
      await keep({ id: `prospect:${pr.id}`, type: 'prospect', title: pr.name, section: P('Growth', clean(camp?.name || 'Outreach')), date: App.dateKey(new Date(pr.created)), tags: ['prospect', pr.status, ...(pr.category ? [pr.category] : [])],
        body: `**${pr.name}**${pr.category ? `, ${pr.category}` : ''}${pr.address ? `, ${pr.address}` : ''}. Status: ${pr.status}.${pr.email ? ` Email: ${pr.email}.` : ''}${pr.website ? ` Website: ${pr.website}.` : ''}\n\n${pr.site?.facts?.length ? `## From their website\n${pr.site.facts.map(f => `- ${f}`).join('\n')}\n\n` : ''}${pr.draft ? `## Email\n**${pr.draft.subject}**\n\n${pr.draft.body}\n\n` : ''}${(pr.thread || []).length ? `## Conversation\n${pr.thread.map(m => `- ${m.from === 'me' ? 'Us' : pr.name} (${App.dateKey(new Date(m.t))}): ${m.text.slice(0, 600)}`).join('\n')}` : ''}`,
        updated: pr.updated || pr.created });
    }

    // Projects run by the Coordinator
    for (const pr of (UC.coord?.list() || [])) {
      const st = { todo: ' ', running: '~', done: 'x', waiting: 'x', failed: '!', skipped: '-' };
      await keep({ id: `project:${pr.id}`, type: 'project', title: pr.name || pr.goal.slice(0, 80), section: P('Projects', String(new Date(pr.created).getFullYear())), date: App.dateKey(new Date(pr.created)), tags: ['project', pr.status],
        links: pr.tasks.filter(t => t.out).map(t => `agent:${t.out}`).concat(pr.forkOf ? [`project:${pr.forkOf}`] : []),
        body: `**Goal:** ${pr.goal}${pr.approach ? `\n\n**Approach:** ${pr.approach}` : ''}\n\nStatus: ${pr.status}. ${pr.summary || ''}\n\n## Steps\n${pr.tasks.map(t => `- [${st[t.status] || ' '}] ${t.title} (${UC.agent(t.agent)?.name || t.agent})${t.summary ? `: ${t.summary}` : ''}`).join('\n')}${(pr.asks || []).length ? `\n\n## Side questions\n${pr.asks.map(a => `- **${a.q}** ${a.a.slice(0, 300)}`).join('\n')}` : ''}`,
        updated: pr.updated || pr.created });
    }

    // Deals: every acquisition / franchise / market lead you researched, contacted or moved
    for (const d of (await App.store.all('prospects', { raw: true }).catch(() => [])).filter(x => x.deal && (x.readAt || x.draft || x.notes || x.stage !== 'lead' || x.fin))) {
      const h = UC.deals?.hunt(d.campaign), f = d.fin || {}, fr = d.fr || {}, stl = UC.deals?.STAGES.find(s => s[0] === d.stage)?.[1] || d.stage;
      await keep({ id: `deal:${d.id}`, type: 'deal', title: d.name, section: P('Deals', clean(h?.name || 'Search')), date: App.dateKey(new Date(d.created)), tags: ['deal', d.dtype, d.stage],
        links: [d.venture ? `venture:${d.venture}` : '', UC.decide?.forRef(d.id) ? `brief:${UC.decide.forRef(d.id).id}` : ''].filter(Boolean),
        body: `**${d.name}** (${UC.deals?.TYPES[d.dtype]?.[1] || d.dtype}). Stage: ${stl}. Fit ${d.fit?.score ?? '—'}: ${d.fit?.why || ''}.${d.address ? `\n\nWhere: ${d.address}` : ''}${d.website ? `\nWebsite: ${d.website}` : ''}${d.email ? `\nEmail: ${d.email}` : ''}${f.price ? `\n\n| Asking | Cash flow | Revenue | Multiple |\n|---|---|---|---|\n| ${money(f.price)} | ${f.cashFlow ? money(f.cashFlow) : '—'} | ${f.revenue ? money(f.revenue) : '—'} | ${f.multiple ? f.multiple + '×' : '—'} |` : ''}${fr.brand ? `\n\nFranchise: ${fr.regionCount} locations within ${fr.regionKm} km, ${fr.localCount} within ${fr.localKm} km.${fr.investment ? ` Investment ${fr.investment}.` : ''}${fr.fee ? ` Fee ${fr.fee}.` : ''}` : ''}${(d.signals || []).length ? `\n\n## Signals\n${d.signals.map(x => `- ${x}`).join('\n')}` : ''}${d.notes ? `\n\n## Notes\n${d.notes}` : ''}${d.draft ? `\n\n## First contact\n**${d.draft.subject}**\n\n${d.draft.body}` : ''}${(d.thread || []).length ? `\n\n## Conversation\n${d.thread.map(m => `- ${m.from === 'me' ? 'Us' : d.name} (${App.dateKey(new Date(m.t))}): ${m.text.slice(0, 600)}`).join('\n')}` : ''}${d.legal ? `\n\n## Deal legal\n${Object.entries(d.legal.check || {}).filter(([, v]) => v).length} checklist items done${Object.keys(d.legal.docs || {}).length ? `; drafts saved: ${Object.keys(d.legal.docs).join(', ')}` : ''}` : ''}`,
        updated: d.updated || d.created });
    }
    // Decision briefs: the 7-question thought process behind each big decision
    for (const b of (UC.decide?.list() || [])) {
      const L = a => (a || []).map(x => `- ${x}`).join('\n') || '- —';
      await keep({ id: `brief:${b.id}`, type: 'brief', title: b.title, section: P('Decisions', 'Briefs', String(new Date(b.created).getFullYear())), date: App.dateKey(new Date(b.decidedAt || b.created)), tags: ['brief', b.status, b.kind, b.reversible].filter(Boolean),
        links: b.kind === 'deal' ? [`deal:${b.ref}`] : b.kind === 'project' ? [`project:${b.ref}`] : b.kind === 'venture' ? [`venture:${b.ref}`] : [],
        body: `${b.status === 'thinking' ? 'Still thinking.' : `**Decided:** ${b.choice} (${b.decidedAt ? App.dateKey(new Date(b.decidedAt)) : ''}). Review on ${b.reviewOn || '—'}.`}\n\n## 01 The problem\n${b.problem || '—'}\n\n## 02 What I know / what I’m assuming\n**Know**\n${L(b.know)}\n\n**Assuming**\n${L(b.assume)}${b.testFirst ? `\n\nTest first: ${b.testFirst}` : ''}\n\n## 03 Options\n${L(b.options)}${b.pilot ? `\n\nPilot: ${b.pilot}` : ''}\n\n## 04 What I’m giving up\n${b.givingUp || '—'}\n\n## 05 Beyond the first result\nResult: ${b.result || '—'}\nNew demands: ${b.demands || '—'}\nWho sustains it: ${b.who || '—'}\n\n## 06 Reversibility\n${b.reversible || '—'}${b.reverseCost ? `: ${b.reverseCost}` : ''}\n\n## 07 What would change my mind\nContinue if: ${b.cont || '—'}\nAdjust if: ${b.adjust || '—'}\nStop if: ${b.stop || '—'}${b.outcome || b.duty || b.character ? `\n\n## Ethics check\nOutcome: ${b.outcome || "—"}\nDuty: ${b.duty || "—"}\nCharacter: ${b.character || '—'}` : ''}${(b.reviews || []).length ? `\n\n## Reviews\n${b.reviews.map(r => `- ${App.dateKey(new Date(r.t))} **${r.verdict}** ${r.note || ''}`).join('\n')}` : ''}`,
        updated: b.updated || b.created });
    }
    // Legal: one check per unit (score, gaps, documents, incidents)
    for (const { u, a } of (await (UC.legalAssessAll?.() || Promise.resolve([]))).filter(x => x.a)) {
      const docs = await App.biz.withBiz(u.id, () => App.bsettings.get('legal.docs', {})), inc = await App.biz.withBiz(u.id, () => App.bsettings.get('legal.incidents', []));
      await keep({ id: `legal:${u.id}`, type: 'legal', title: `${u.name} · legal check`, section: P('Legal', clean(u.name)), tags: ['legal'], links: [`unit:${u.id}`],
        body: `${isNaN(a.score) ? 'Not checked yet.' : `${Math.round(a.score * 100)}% protected.`} ${a.gaps.filter(g => g.sev === 3).length} high-risk gaps, ${a.unanswered} unanswered.\n\n## Gaps\n${a.gaps.map(g => `- (${g.sev === 3 ? 'high' : g.sev === 2 ? 'medium' : 'low'}) ${g.q}`).join('\n') || '- none'}\n\n## Documents saved\n${Object.entries(docs).map(([k, v]) => `- ${App.legal.DOCS.find(d => d.id === k)?.title || k} v${v.version}`).join('\n') || '- none'}\n\n## Incidents\n${inc.map(i => `- ${(i.when || '').slice(0, 10)} ${i.type} (${i.status}): ${(i.description || '').slice(0, 200)}`).join('\n') || '- none'}`,
        updated: Math.max(1, ...Object.values(docs).map(v => v.savedAt || 0), ...inc.map(i => i.updated || 0)) });
    }

    // Daily objectives (Journal): one note per day, kept forever
    for (const o of (UC.S.get('objectivesLog', []))) {
      await keep({ id: `objectives:${o.date}`, type: 'objectives', title: `Today’s three · ${o.date}`, section: P('Journal', o.date.slice(0, 4), o.date.slice(5, 7)), date: o.date, tags: ['objectives'],
        body: o.items.map(i => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n'), updated: o.t || Date.now() });
    }

    // Ventures, knowledge, research notes
    for (const v of UC.engine.ventures()) {
      const S = UC.engine.STAGES;
      await keep({ id: `venture:${v.id}`, type: 'venture', title: v.name, section: 'Ventures', date: v.open || '', tags: ['venture', v.stage, v.type, ...(v.sample ? ['example'] : [])], links: v.unitId ? [`unit:${v.unitId}`] : [],
        body: `${App.biz.TEMPLATES[v.type]?.label || v.type} venture, stage **${S.find(s => s.id === v.stage)?.name}**${v.open ? `, target opening ${fmtDay(v.open)}` : ''}${v.unitId ? `, now the unit [[${unitName(v.unitId)}]]` : ''}.${v.sample ? ' (Example venture.)' : ''}\n\n${v.notes ? `Notes: ${v.notes}\n\n` : ''}${S.map(s => `## ${s.name}\n${(v.check[s.id] || []).map(i => `- [${i.done ? 'x' : ' '}] ${i.t}${i.due ? ` (due ${i.due})` : ''}`).join('\n')}`).join('\n\n')}`, updated: v.updated || 1 });
    }
    const kb = UC.ai?.knowledge?.() || {};
    for (const [id, name] of (UC.ai?.KDOCS || [])) if (kb[id]) await keep({ id: `knowledge:${id}`, type: 'knowledge', title: name, section: 'Knowledge', tags: ['knowledge'], body: kb[id], updated: 1 });
    for (const n of await App.store.all('notes', { raw: true }).catch(() => [])) {
      const b = units.find(x => x.id === App.biz.idOf(n));
      await keep({ id: `research:${n.id}`, type: 'research', title: n.title || 'Untitled note', section: P('Research', b ? kindLabel(b) : '', clean(b?.name || '')), tags: ['research', ...(n.tags || [])], date: n.updated ? App.dateKey(new Date(n.updated)) : '',
        body: `${n.status ? `Status: ${n.status}\n\n` : ''}${n.body || ''}${n.links ? `\n\nSources: ${[].concat(n.links).join(', ')}` : ''}`, updated: n.updated || 1 });
    }

    // Personal (and business side ledgers): spending, giving, 1099 work, work & pay — monthly by unit
    const LEDGERS = { spending: 'Spending', giving: 'Giving', gigs: '1099 work', work: 'Work & pay' };
    for (const [store, label] of Object.entries(LEDGERS)) {
      const recs = (await App.store.all(store, { raw: true }).catch(() => [])).filter(r => !r.sample);
      const by = {};
      for (const r of recs) { const d = r.date || r.day || r.paid || r.start || ''; if (!/^\d{4}-\d{2}/.test(d)) continue; const k = `${App.biz.idOf(r)}|${d.slice(0, 7)}`; (by[k] = by[k] || []).push(r); }
      for (const [k, list] of Object.entries(by)) {
        const [bid, ym] = k.split('|'); const b = units.find(x => x.id === bid); const top = b ? kindLabel(b) : 'Personal';
        const amt = r => +(r.total ?? r.amount ?? r.gross ?? r.net ?? r.pay ?? 0) || 0, lab = r => r.merchant || r.org || r.client || r.employer || r.vendor || r.payer || r.title || r.kind || '';
        const cat = {}; list.forEach(r => { const c = r.category || r.kind || 'Other'; cat[c] = (cat[c] || 0) + amt(r); });
        await keep({ id: `ledger:${store}:${k}`, type: 'personal', title: `${unitName(bid)} ${label.toLowerCase()} · ${monthName(ym)}`, section: P(top, clean(unitName(bid)), label), date: `${ym}-01`, tags: [store, ym.slice(0, 4)],
          body: `${list.length} entries, ${money(list.reduce((a, r) => a + amt(r), 0))} total.\n\n| Category | Total |\n|---|---|\n${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([c, t]) => `| ${c} | ${money(t)} |`).join('\n')}\n\n## Entries\n${list.sort((a, b) => String(a.date || a.day || '').localeCompare(String(b.date || b.day || ''))).map(r => `- ${r.date || r.day || ''} ${lab(r)} ${money(amt(r))}${r.note ? ` (${r.note})` : ''}`).join('\n')}`,
          updated: Date.parse(`${ym}-28T12:00`) || 1 });
      }
    }

    // Link mentions of units, ventures and vendors inside bodies (graph edges + [[links]] in the vault)
    const ents = [...notes.values()].filter(n => ['unit', 'venture', 'vendor', 'person'].includes(n.type) && n.title.length > 3);
    for (const id of want) {
      const n = notes.get(id); if (!n) continue;
      const low = (n.body || '').toLowerCase();
      const add = ents.filter(e => e.id !== n.id && !n.links.includes(e.id) && low.includes(e.title.toLowerCase())).map(e => e.id);
      if (add.length) await put({ ...n, links: [...n.links, ...add], updated: n.updated });
    }
    // Drop derived notes whose source is gone (your own notes are never touched)
    for (const n of [...notes.values()]) if (!['note', 'meeting', 'person'].includes(n.type) && !n.user && !want.has(n.id)) await remove(n.id);
    if (dirty) { dirty = false; App.bus.emit('brain-changed'); }
    indexVectorsSoon();
    return notes.size;
  }

  /* ---------- your own notes ---------- */
  async function saveNote(n) {
    await load();
    const id = n.id || `note:${App.uid()}`;
    const links = [...new Set([...(n.links || []), ...[...String(n.body || '').matchAll(/\[\[([^\]|#]+)/g)].map(m => byTitle.get(m[1].trim().toLowerCase())).filter(Boolean)])];
    const r = await put({ type: 'note', section: 'Notes', tags: [], ...n, id, links, user: true, updated: Date.now() });
    App.bus.emit('brain-changed'); indexVectorsSoon();
    return r;
  }

  /* Your lines under "My notes" on any memory (automatic ones included) */
  async function setMine(id, mine) { await load(); const n = notes.get(id); if (!n) return; await put({ ...n, mine, updated: Date.now() }); App.bus.emit('brain-changed'); }

  /* ---------- recall ---------- */
  function keyword(q, { limit = 30, filter } = {}) {
    const qt = tokens(q); if (!qt.length) return [];
    const N = notes.size || 1, score = new Map();
    for (const t of qt) {
      const exact = inv.get(t), pref = exact ? [[t, exact]] : [...inv].filter(([k]) => k.startsWith(t)).slice(0, 8);
      for (const [, m] of pref) { const idf = Math.log(1 + N / m.size); for (const [id, w] of m) score.set(id, (score.get(id) || 0) + idf * Math.log(1 + w)); }
    }
    const phrase = q.toLowerCase().trim();
    return [...score].map(([id, s]) => { const n = notes.get(id); if (!n || (filter && !filter(n))) return null; if (phrase.length > 4 && (n.title + ' ' + n.body).toLowerCase().includes(phrase)) s *= 1.6; return { n, s }; })
      .filter(Boolean).sort((a, b) => b.s - a.s).slice(0, limit);
  }
  const embedModel = () => UC.S.get('brain.embed', 'nomic-embed-text');
  const vecText = n => `${n.title}\n${n.section}\n${(n.body || '').slice(0, 1800)}`;
  const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / (Math.sqrt(x * y) || 1); };
  let embedOk = null;
  async function canEmbed(force) {
    if (App.hosted || !App.ai?.ollamaAllModels) return false;
    if (embedOk !== null && !force) return embedOk;
    try { const list = await App.ai.ollamaAllModels(); embedOk = list.some(m => m.split(':')[0] === embedModel().split(':')[0]); } catch { embedOk = false; }
    return embedOk;
  }
  async function semantic(q, { limit = 30, filter } = {}) {
    if (!vecs.size || !(await canEmbed())) return [];
    const [qv] = await App.ai.ollamaEmbed([q.slice(0, 2000)], embedModel());
    if (!qv?.length) return [];
    return [...vecs.values()].map(v => { const n = notes.get(v.id); return n && (!filter || filter(n)) ? { n, s: cos(qv, v.v) } : null; }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, limit);
  }
  async function search(q, opts = {}) {
    await load();
    const k = keyword(q, opts);
    let sem = [];
    try { sem = opts.semantic === false ? [] : await semantic(q, opts); } catch { sem = []; }
    const out = new Map();
    const kMax = k[0]?.s || 1;
    k.forEach((r, i) => out.set(r.n.id, { n: r.n, s: 0.55 * (r.s / kMax) + 0.15 / (i + 1), why: 'words' }));
    sem.forEach(r => { const o = out.get(r.n.id); const s = 0.6 * Math.max(0, (r.s - 0.35) / 0.65); if (o) { o.s += s; o.why = 'words + meaning'; } else out.set(r.n.id, { n: r.n, s, why: 'meaning' }); });
    return [...out.values()].sort((a, b) => b.s - a.s).slice(0, opts.limit || 30);
  }
  /* Background: embed notes whose text changed (desktop with the embedding model installed) */
  let vecTimer, vecBusy = false;
  function indexVectorsSoon() { clearTimeout(vecTimer); vecTimer = setTimeout(indexVectors, 4000); }
  async function indexVectors(progress) {
    if (vecBusy || !(await canEmbed())) return 0;
    vecBusy = true; let n = 0;
    try {
      const todo = [...notes.values()].filter(x => vecs.get(x.id)?.h !== x.h);
      for (let i = 0; i < todo.length; i += 16) {
        const batch = todo.slice(i, i + 16), out = await App.ai.ollamaEmbed(batch.map(vecText), embedModel());
        for (const [j, x] of batch.entries()) if (out[j]?.length) { const v = { id: x.id, h: x.h, v: Float32Array.from(out[j]) }; vecs.set(x.id, v); await App.store.raw('brainvec', 'put', v); n++; }
        progress?.(Math.min(todo.length, i + 16), todo.length);
      }
    } finally { vecBusy = false; }
    return n;
  }

  /* Memory for an agent: its own recent results, your decisions on its drafts, and the best matches for the task */
  async function forAgent(a, input = '') {
    await load();
    const mine = [...notes.values()].filter(n => n.type === 'agent' && n.tags.includes(a.key)).sort((x, y) => y.updated - x.updated).slice(0, 2);
    const decided = [...notes.values()].filter(n => n.type === 'decision' && n.tags.includes(a.key)).sort((x, y) => y.updated - x.updated).slice(0, 3);
    const hits = (await search(`${a.name} ${a.does} ${input.slice(0, 300)}`, { limit: 6, filter: n => n.type !== 'log' && !mine.includes(n) })).map(r => r.n);
    const cut = (n, len) => `### ${n.title} (${n.section}${n.date ? ', ' + n.date : ''})\n${String(n.body).replace(/## Days[\s\S]*$/, '').slice(0, len)}`;
    const parts = [];
    if (mine.length) parts.push('Your last results:\n' + mine.map(n => cut(n, 700)).join('\n\n'));
    if (decided.length) parts.push('What the owner decided on your recent drafts (learn from this):\n' + decided.map(n => cut(n, 400)).join('\n\n'));
    if (hits.length) parts.push('Related memories:\n' + hits.map(n => cut(n, 600)).join('\n\n'));
    return parts.length ? `## Memory (from the Brain)\n${parts.join('\n\n')}` : '';
  }

  /* Ask the Brain: retrieve, then answer with citations (Ollama on the computer; search-only elsewhere) */
  async function ask(q) {
    const hits = await search(q, { limit: 8, filter: n => n.type !== 'log' || /log|agent|ran/i.test(q) });
    const facts = await factsAll(), ctx = await UC.engine.context();
    const units = (ctx.real || []).filter(u => q.toLowerCase().includes(u.name.toLowerCase()));
    const yoy = yoyText(facts, units.length ? units.map(u => u.id) : null, UC.data.lastDate(ctx.real || []));
    const ai = await UC.ai.status();
    if (!ai.running) return { answer: '', hits, yoy, offline: ai.error };
    const src = hits.map((h, i) => `[${i + 1}] ${h.n.title} (${h.n.section}${h.n.date ? ', ' + h.n.date : ''})\n${String(h.n.body).slice(0, 1600)}`).join('\n\n');
    const r = await App.ai.ollamaChat({ messages: [
      { role: 'system', content: `You are the owner's second brain in ${UC.BRAND.name}. Answer from the memories and the year-over-year table only. Cite memories like [1] or [2]. If the answer isn't in them, say what's missing and where it would come from. Be brief and concrete; use a small table for comparisons.` },
      { role: 'user', content: `Question: ${q}\n\n${yoy}\n\n# Memories\n${src || '(none found)'}` }] });
    return { answer: r.text, hits, yoy, model: r.model };
  }

  /* ---------- Obsidian vault sync ---------- */
  const vault = (() => {
    const desk = window.desktop?.vault;
    let handle = null;
    const fsa = { // Chrome / Edge folder access (desktop browser)
      async connect() { handle = await window.showDirectoryPicker({ id: 'uc-vault', mode: 'readwrite' }); await App.store.raw('brainvec', 'put', { id: '__vault', handle }); return handle.name; },
      async restore() { if (handle) return true; const r = await App.store.get('brainvec', '__vault').catch(() => null); if (!r?.handle) return false; handle = r.handle; return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'; },
      async ensure() { if (!handle && !(await fsa.restore())) { if (!handle) return false; } if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'; return true; },
      async list() { const out = []; const walk = async (dir, pre, depth) => { if (depth > 12) return; for await (const [name, h] of dir.entries()) { if (name.startsWith('.')) continue; if (h.kind === 'directory') await walk(h, pre + name + '/', depth + 1); else if (/\.md$/i.test(name)) { const f = await h.getFile(); out.push({ path: pre + name, mtime: f.lastModified, size: f.size }); } } }; await walk(handle, '', 0); return out; },
      async fileH(rel, create) { const parts = rel.split('/'); let d = handle; for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create }); return d.getFileHandle(parts[parts.length - 1], { create }); },
      async read(rel) { return (await (await fsa.fileH(rel, false)).getFile()).text(); },
      async write(rel, text) { const h = await fsa.fileH(rel, true); const w = await h.createWritable(); await w.write(text); await w.close(); return (await h.getFile()).lastModified; },
      async info() { return { root: handle ? handle.name : '' }; }
    };
    const kind = desk ? 'desktop' : window.showDirectoryPicker ? 'browser' : '';
    return {
      kind,
      async info() { return desk ? desk.info() : (await fsa.restore(), fsa.info()); },
      async connect() { return desk ? (await desk.pick()).root : fsa.connect(); },
      async ready() { if (desk) return !!(await desk.info()).root; return fsa.ensure(); },
      list: () => desk ? desk.list() : fsa.list(),
      read: p => desk ? desk.read(p) : fsa.read(p),
      write: (p, t) => desk ? desk.write(p, t) : fsa.write(p, t),
      async forget() { if (desk) await desk.forget(); else { handle = null; await App.store.raw('brainvec', 'delete', '__vault'); } App.settings.set('sync.vault', {}); }
    };
  })();
  const vstate = () => App.settings.get('sync.vault', {});          // stays on this device (sync.* is never synced)
  const MINE = '## My notes';
  const fileName = n => `${n.section}/${clean(n.title)}.md`;
  function toFile(n) {
    const titles = n.links.map(id => notes.get(id)?.title).filter(Boolean).map(t => `[[${clean(t)}]]`);
    const fm = ['---', `uc-id: ${n.id}`, `type: ${n.type}`, n.date ? `date: ${n.date}` : '', n.tags.length ? `tags: [${n.tags.map(t => String(t).replace(/[,\[\]]/g, ' ').trim().replace(/\s+/g, '-')).filter(Boolean).join(', ')}]` : '', `updated: ${new Date(n.updated).toISOString()}`, '---'].filter(Boolean).join('\n');
    return `${fm}\n# ${n.title}\n\n${n.body || ''}\n${titles.length ? `\nRelated: ${titles.join(' · ')}\n` : ''}\n${MINE}\n${n.mine || ''}\n`;
  }
  function fromFile(text) {
    const m = text.match(/^---\n([\s\S]*?)\n---\n?/); const fm = {};
    if (m) m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) fm[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    let body = m ? text.slice(m[0].length) : text;
    const title = (body.match(/^#\s+(.+)$/m) || [])[1];
    if (title) body = body.replace(/^#\s+.+\n?/m, '');
    const i = body.indexOf(MINE); const mine = i >= 0 ? body.slice(i + MINE.length).trim() : ''; if (i >= 0) body = body.slice(0, i);
    body = body.replace(/\nRelated: .*\n?$/m, '').trim();
    return { fm, title, body, mine };
  }
  let vaultBusy = false;
  async function syncVault(report) {
    if (vaultBusy || !vault.kind || !(await vault.ready())) return null;
    vaultBusy = true;
    const res = { wrote: 0, read: 0, created: 0, conflicts: 0 };
    try {
      await load();
      const stv = vstate(), files = new Map((await vault.list()).map(f => [f.path, f]));
      const pathOf = new Map(Object.entries(stv).map(([id, s]) => [s.path, id]));
      const used = new Set(Object.values(stv).map(s => s.path));
      const uniquePath = n => { let p = fileName(n); if (used.has(p) && pathOf.get(p) !== n.id) p = p.replace(/\.md$/, ` (${n.id.slice(-5)}).md`); used.add(p); return p; };
      // 1) Notes → files (and edits made in Obsidian → notes)
      for (const n of notes.values()) {
        const s = stv[n.id], path = s?.path || uniquePath(n), f = files.get(path);
        const fileChanged = f && s && f.mtime > s.mtime + 1000, noteChanged = !s || s.h !== n.h;
        if (f && fileChanged) {
          const p = fromFile(await vault.read(path)); res.read++;
          const editable = n.user || ['note', 'meeting', 'person'].includes(n.type);
          if (noteChanged && editable && s) { // both changed: keep both, nothing lost
            const alt = path.replace(/\.md$/, ' (from Obsidian).md'); await vault.write(alt, toFile({ ...n, body: p.body, mine: p.mine })); res.conflicts++;
          } else if (editable) { const u = await put({ ...n, title: p.title || n.title, body: p.body, mine: p.mine, updated: Date.now() }); stv[n.id] = { path, h: u.h, mtime: f.mtime }; continue; }
          else if (p.mine !== (n.mine || '')) { const u = await put({ ...n, mine: p.mine }); n.h = u.h; } // derived notes: keep your "My notes" lines
        }
        if (!f && s && !noteChanged) continue; // you deleted the file in Obsidian: don't bring it back unless the note changes
        if (noteChanged || !f) { const cur = notes.get(n.id); const mt = await vault.write(path, toFile(cur)); stv[n.id] = { path, h: cur.h, mtime: mt }; res.wrote++; }
      }
      // 2) New files written in Obsidian → your notes
      for (const [path, f] of files) {
        if (pathOf.has(path) || Object.values(stv).some(s => s.path === path)) continue;
        const p = fromFile(await vault.read(path)); res.read++;
        if (p.fm['uc-id'] && notes.has(p.fm['uc-id'])) { stv[p.fm['uc-id']] = { path, h: '', mtime: 0 }; continue; } // re-linked after a reset
        const section = path.split('/').slice(0, -1).join('/') || 'Notes';
        const n = await put({ id: `note:${App.uid()}`, type: 'note', user: true, section, title: p.title || path.split('/').pop().replace(/\.md$/i, ''), body: p.body, mine: p.mine, tags: ['obsidian'], updated: f.mtime });
        const mt = await vault.write(path, toFile(n)); stv[n.id] = { path, h: n.h, mtime: mt }; res.created++;
      }
      App.settings.set('sync.vault', stv);
      UC.S.set('brain.vaultLast', Date.now());
      if (res.read || res.created) { App.bus.emit('brain-changed'); indexVectorsSoon(); }
      report?.(res);
      return res;
    } finally { vaultBusy = false; }
  }
  function startVault() {
    if (!vault.kind) return;
    const tick = () => { if (UC.S.get('brain.vaultOn', false)) syncVault().catch(e => console.warn('vault', e)); };
    setTimeout(tick, 8000); setInterval(tick, 5 * 60000);
  }

  /* Hooks: capture after anything changes */
  App.bus.on('data-changed', soon);
  App.bus.on('uc-changed', soon);

  UC.brain = { load, capture, saveNote, setMine, remove, search, keyword, ask, forAgent, notes: () => notes, get: id => notes.get(id), byTitle: t => notes.get(byTitle.get(String(t).toLowerCase())),
    facts: factsAll, compare, monthly, periods, yoyText, indexVectors, canEmbed, embedModel, vault, syncVault, startVault, vecCount: () => vecs.size, fmtDay, monthName };
})(window.UC);
