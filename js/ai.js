/* AI providers (Perplexity Agent API, xAI Grok), business context, and safe markdown rendering */
(function (App) {
  const { esc, fmt } = App;

  const PROVIDERS = {
    perplexity: {
      label: 'Perplexity', short: 'Web research with sources', color: '#20808d', mono: 'Px',
      keyUrl: 'https://www.perplexity.ai/account/api/keys', keyHint: 'pplx-…'
    },
    xai: {
      label: 'Grok', short: 'Reasoning & analysis (xAI)', color: '#111111', mono: 'Gk',
      keyUrl: 'https://console.x.ai', keyHint: 'xai-…'
    }
  };
  const DEPTHS = [{ value: 'low', label: 'Quick' }, { value: 'medium', label: 'Thorough' }];

  /* ---------- Keys: encrypted by the OS in the desktop app, localStorage in the browser ---------- */
  const keyCache = {};
  async function getKey(p) {
    if (keyCache[p] !== undefined) return keyCache[p];
    let v = '';
    if (window.desktop?.getSecret) v = await window.desktop.getSecret('ai.' + p);
    else { try { v = localStorage.getItem('ocd.secret.ai.' + p) || ''; } catch { v = ''; } }
    return (keyCache[p] = v || '');
  }
  async function setKey(p, v) {
    v = (v || '').trim();
    keyCache[p] = v;
    if (window.desktop?.setSecret) await window.desktop.setSecret('ai.' + p, v);
    else { try { v ? localStorage.setItem('ocd.secret.ai.' + p, v) : localStorage.removeItem('ocd.secret.ai.' + p); } catch { /* ignore */ } }
    App.bus.emit('ai-keys');
  }
  async function connected() {
    const out = {};
    for (const p of Object.keys(PROVIDERS)) out[p] = !!(await getKey(p));
    return out;
  }

  /* ---------- Transport (through the local relay in server.js) ---------- */
  async function relay(provider, method, path, body) {
    if (!/^https?:$/.test(location.protocol)) throw new Error('AI needs the app running as the desktop app (or "npm run web"), not opened as a file.');
    const key = await getKey(provider);
    if (!key) throw new Error(`Add your ${PROVIDERS[provider].label} API key in Integrations first.`);
    let r;
    try {
      r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OCD-Client': '1' }, body: JSON.stringify({ provider, method, path, body, key }) });
    } catch (e) { throw new Error('Could not reach the app\'s local AI relay: ' + e.message); }
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!r.ok) {
      const m = data?.error?.message || data?.error || data?.detail || data?.message || data?.raw || r.statusText;
      const hint = r.status === 401 ? ' Check that the API key is correct.' : r.status === 402 || r.status === 429 ? ' Your account may be out of credits or rate-limited.' : '';
      throw new Error(`${PROVIDERS[provider].label} error ${r.status}: ${typeof m === 'string' ? m : JSON.stringify(m)}${hint}`);
    }
    return data;
  }

  async function grokModels() {
    const d = await relay('xai', 'GET', '/v1/models');
    const ids = (d.data || d.models || []).map(m => m.id).filter(Boolean);
    // Prefer chat-capable grok models, newest-looking first
    const ver = id => parseFloat((id.match(/grok-(\d+(?:\.\d+)?)/i) || [])[1] || 0);
    const lite = id => /mini|fast|nano|lite/i.test(id) ? 1 : 0;
    return ids.filter(id => /grok/i.test(id) && !/image|imagine|vision-only|embed|video|tts|voice/i.test(id))
      .sort((a, b) => ver(b) - ver(a) || lite(a) - lite(b) || a.localeCompare(b));
  }

  /**
   * ask({ provider, messages:[{role,content}], context, depth, model })
   * Returns { text, sources:[{title,url}], model, cost }
   */
  async function ask({ provider, messages, context = '', depth = 'low', model }) {
    const sys = systemPrompt(context);
    if (provider === 'perplexity') {
      // Effort presets carry Perplexity's own tuned instructions + web search, so the business
      // context goes into the conversation instead of overriding `instructions`.
      const input = [{ role: 'user', content: sys }, { role: 'assistant', content: 'Understood. I have the business context.' }, ...messages];
      let d;
      try { d = await relay('perplexity', 'POST', '/v1/agent', { effort: depth, input }); }
      catch (e) {
        if (!/error 4(00|22)/.test(e.message)) throw e;
        // Fallback: send the conversation as a single text input
        const flat = input.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
        d = await relay('perplexity', 'POST', '/v1/agent', { effort: depth, input: flat });
      }
      const sources = [];
      let text = '';
      for (const item of d.output || []) {
        if (item.type === 'search_results' || Array.isArray(item.results)) (item.results || []).forEach(r => sources.push({ id: r.id, title: r.title || r.url, url: r.url, date: r.date }));
        if (item.type === 'message') for (const c of item.content || []) {
          if (c.type === 'output_text' && c.text) text += c.text;
          (c.annotations || []).forEach(a => { if (a.url && !sources.some(s => s.url === a.url)) sources.push({ title: a.title || a.url, url: a.url }); });
        }
      }
      if (!text && d.output_text) text = d.output_text;
      const seen = new Set();
      return { text: text || '(No answer returned.)', sources: sources.filter(s => s.url && !seen.has(s.url) && seen.add(s.url)), model: d.model, cost: d.usage?.cost?.total_cost };
    }
    if (provider === 'xai') {
      let m = model || App.settings.get('ai.grokModel', '');
      if (!m) { const list = await grokModels(); m = list[0]; if (!m) throw new Error('No Grok models are available on this xAI account.'); App.settings.set('ai.grokModel', m); }
      const d = await relay('xai', 'POST', '/v1/chat/completions', { model: m, messages: [{ role: 'system', content: sys }, ...messages], temperature: 0.4 });
      const c = d.choices?.[0]?.message;
      const sources = (d.citations || []).map(u => typeof u === 'string' ? { title: u, url: u } : u);
      return { text: c?.content || '(No answer returned.)', sources, model: d.model || m };
    }
    throw new Error('Unknown AI provider');
  }

  function systemPrompt(context) {
    return `You are the built-in analyst for "Ops Command Desk", a desktop app an operations manager uses to run their businesses (financials, operations, trading risk, marketing, research, personnel). Today is ${new Date().toDateString()}.
Answer like a sharp chief-of-staff: lead with the answer, then specifics. Use short headings and bullet points, quote the actual numbers from the data, flag risks, and end with concrete next steps when useful. Say plainly when the data doesn't support a conclusion. Never invent figures that aren't in the data or your sources.
${context ? '\n--- BUSINESS CONTEXT (from the user\'s own files) ---\n' + context + '\n--- END CONTEXT ---' : ''}`;
  }

  /* ---------- Business context ---------- */
  function kpiLines(k) {
    const L = [];
    const f = k.finance, o = k.operations, t = k.trading, tp = k['trading-perf'], m = k.marketing, p = k.personnel;
    if (f) L.push(`Financials: revenue ${fmt.money(f.revenue)}, net income ${fmt.money(f.net)}, net margin ${fmt.pct(f.margin)}, ${f.periods} periods`);
    if (o) L.push(`Operations: sales ${fmt.money(o.sales)}, labor ${fmt.pct(o.laborPct)}, food cost ${fmt.pct(o.foodPct)}, prime cost ${fmt.pct(o.primePct)}, sales/labor hr ${fmt.money(o.splh, 2)}`);
    if (t) L.push(`Trading positions: gross exposure ${fmt.money(t.gross)}, net ${fmt.money(t.net)}, unrealized P&L ${fmt.money(t.upl)}, ${t.positions} positions, largest ${fmt.pct(t.topWeight)}`);
    if (tp) L.push(`Trading performance: realized P&L ${fmt.money(tp.total)}, win rate ${fmt.pct(tp.winRate)}, profit factor ${isFinite(tp.pf) ? (+tp.pf).toFixed(2) : 'n/a'}, max drawdown ${fmt.money(tp.maxDD)}, 1-day VaR95 ${fmt.money(tp.hVaR)}`);
    if (m) L.push(`Marketing: spend ${fmt.money(m.spend)}, revenue ${fmt.money(m.rev)}, ROAS ${m.roas ? (+m.roas).toFixed(2) + 'x' : 'n/a'}, CPA ${fmt.money(m.cpa, 2)}`);
    const cm = k.compliance;
    if (cm) L.push(`Tax & compliance: audit readiness ${isNaN(cm.score) ? 'n/a' : Math.round(cm.score * 100) + '%'}, ${cm.overdue} overdue filings, ${cm.dueSoon} due within 30 days`);
    const pu = k.purchases;
    if (pu) L.push(`Purchases (${pu.period}): business purchases ${fmt.money(pu.total)}, food purchases ${fmt.money(pu.food)}, food cost ${fmt.pct(pu.foodPct)} on sales ${fmt.money(pu.sales)}, ${pu.receipts} receipts`);
    if (p) L.push(`Personnel: active headcount ${p.headcount}, turnover ${fmt.pct(p.turnover)}, avg tenure ${isNaN(p.avgTenure) ? 'n/a' : (+p.avgTenure).toFixed(1) + ' yrs'}`);
    const flags = Object.entries(k).flatMap(([mod, v]) => (v.flags || []).map(x => `[${mod}] ${x}`));
    if (flags.length) L.push('Flagged issues:\n' + flags.slice(0, 30).map(x => '- ' + x).join('\n'));
    return L.join('\n');
  }

  async function kpisFor(bizId) {
    return App.biz.withBiz(bizId, async () => {
      let k = App.bsettings.get('kpis', {});
      if (!Object.keys(k).length) k = await App.modules.dashboard.refreshKpis();
      return k;
    });
  }

  async function buildContext({ summary = true, datasetId = '', notes = false } = {}) {
    const parts = [];
    if (summary) {
      const ids = App.biz.isMaster() ? App.biz.active().map(b => b.id) : [App.biz.current()];
      for (const id of ids) {
        const b = App.biz.get(id);
        const k = await kpisFor(id);
        parts.push(`## Business: ${b.name} (${App.biz.TEMPLATES[b.type]?.label || 'Custom'})${b.description ? ' - ' + b.description : ''}\n${kpiLines(k) || 'No analyzed data yet.'}`);
      }
    }
    if (datasetId) {
      const d = await App.store.get('datasets', datasetId);
      if (d) {
        const numeric = d.headers.filter(h => App.isNumericCol(d.rows, h));
        const totals = numeric.slice(0, 12).map(h => `${h}: sum ${fmt.num(App.sum(d.rows.map(r => App.num(r[h]))), 2)}`).join('; ');
        let csv = App.toCSV(d.headers, d.rows.slice(0, 400));
        const truncated = csv.length > 24000;
        if (truncated) csv = csv.slice(0, 24000);
        parts.push(`## Data table: ${d.name} (${d.rows.length} rows, source ${App.sources[d.source]?.label || d.source})\nColumn totals: ${totals || 'n/a'}\n${truncated || d.rows.length > 400 ? '(First rows only.)\n' : ''}\`\`\`csv\n${csv}\n\`\`\``);
      }
    }
    if (notes) {
      const ns = (await App.store.all('notes')).filter(n => n.module === 'research').slice(0, 8);
      if (ns.length) parts.push('## Research notes\n' + ns.map(n => `### ${n.title} [${n.status || 'Open'}]\n${n.body.slice(0, 1200)}`).join('\n\n'));
    }
    return parts.join('\n\n');
  }

  /* ---------- Safe markdown → HTML (escape first, then format) ---------- */
  function md(src, sources = []) {
    const blocks = [];
    let s = String(src || '').replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => { blocks.push(`<pre class="md-code"><code>${esc(code.replace(/\n$/, ''))}</code></pre>`); return `\u0000${blocks.length - 1}\u0000`; });
    s = esc(s);
    const inline = t => t
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[(\d{1,2})\](?!\()/g, (m, n) => { const src = sources[+n - 1]; return src ? `<a class="cite" href="${esc(src.url)}" target="_blank" rel="noopener" title="${esc(src.title)}">${n}</a>` : m; });
    const lines = s.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^\u0000\d+\u0000$/.test(l.trim())) { out.push(blocks[+l.trim().slice(1, -1)]); i++; continue; }
      const h = l.match(/^(#{1,4})\s+(.*)/);
      if (h) { const lvl = Math.min(4, h[1].length + 1); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
        const row = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
        const head = row(l); i += 2;
        const body = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
        out.push(`<div class="table-wrap md-table"><table><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
        const ordered = /^\s*\d/.test(l);
        const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(inline(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, '')));
        out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li>${x}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
        continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (!l.trim()) { i++; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*•]|\d+[.)])\s|\s*\|)/.test(lines[i]) && !/^\u0000/.test(lines[i].trim())) para.push(inline(lines[i++]));
      if (para.length) out.push(`<p>${para.join('<br>')}</p>`); else i++;
    }
    return out.join('');
  }

  /* ---------- Receipt photo → line items (Grok vision) ---------- */
  function shrinkImage(blob, max = 1600) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Could not open that image.'));
      img.src = URL.createObjectURL(blob);
    });
  }
  async function scanReceipt(blob) {
    if (!(await getKey('xai'))) throw new Error('Reading receipt photos uses Grok. Add your xAI key in Integrations → AI providers (or paste the receipt text instead).');
    const dataUrl = await shrinkImage(blob);
    const models = await grokModels();
    const model = models.find(m => /vision/i.test(m)) || App.settings.get('ai.grokModel', '') || models[0];
    const prompt = `Read this purchase receipt. Return ONLY JSON, no prose:
{"vendor": string, "date": "YYYY-MM-DD" or "", "items": [{"name": string, "qty": number, "amount": number}], "tax": number, "total": number}
Rules: one entry per purchased line, with the name as printed. "amount" is the line's final price after any instant savings or coupon on that item (apply discount lines to the item above them). Use qty from "2 @ 4.99" style lines, otherwise 1. Exclude subtotal, tax, total, payment, change and membership lines from items. Numbers only, no currency symbols.`;
    const d = await relay('xai', 'POST', '/v1/chat/completions', {
      model, temperature: 0,
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }, { type: 'text', text: prompt }] }]
    });
    const text = d.choices?.[0]?.message?.content || '';
    const json = (text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text])[1];
    let r;
    try { r = JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1)); }
    catch { throw new Error('The AI could not read this receipt clearly. Try a sharper, flatter photo, or paste the text.'); }
    return {
      vendor: r.vendor || '', date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : '',
      lines: (r.items || []).filter(i => i && i.name).map(i => ({ item: String(i.name).trim(), qty: +i.qty || 1, amount: +i.amount || 0 })),
      tax: +r.tax || 0, total: +r.total || 0
    };
  }

  App.ai = { scanReceipt, PROVIDERS, DEPTHS, getKey, setKey, connected, ask, grokModels, buildContext, md };
})(window.App);
