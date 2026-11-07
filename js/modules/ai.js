/* AI Assistant: chat with Perplexity (web research) and Grok (analysis) over your business data */
(function (App) {
  const { esc } = App;
  let activeId = null;
  let busy = false;

  const threads = () => App.bsettings.get('ai.threads', []);
  const saveThreads = t => App.bsettings.set('ai.threads', t.slice(0, 40));
  const prefs = () => ({ provider: 'ollama', depth: 'low', summary: true, dataset: '', notes: false, ...App.bsettings.get('ai.prefs', {}) });
  const savePrefs = p => App.bsettings.set('ai.prefs', p);

  function suggestions() {
    const S = [['xai', 'Give me a briefing: what needs my attention first across my data, and why?']];
    const en = m => App.biz.enabled(m);
    if (en('finance')) S.push(['xai', 'Explain my margin trend and the 3 biggest levers to improve net income.']);
    if (en('operations')) S.push(['xai', 'How do I bring labor % and food cost back to target? Be specific to my numbers.']);
    if (en('trading')) { S.push(['xai', 'Assess my trading risk: concentration, drawdown, and what to trim or hedge.']); S.push(['perplexity', 'What recent news and analyst views affect my largest positions?']); }
    if (en('marketing')) { S.push(['xai', 'Which campaigns should I cut or scale, and how should I reallocate budget?']); S.push(['perplexity', 'What are current benchmark ROAS and CPA for my marketing channels in my industry?']); }
    if (en('personnel')) S.push(['xai', 'What is driving turnover on my team and which retention steps fit best?']);
    if (en('research')) S.push(['perplexity', 'Research my competitors\' pricing and positioning, with sources.']);
    return S.slice(0, 6);
  }

  App.modules.ai = {
    async render(view, params = {}) {
      if (App.hosted) {
        view.innerHTML = App.ui.empty(`<h2 style="margin-top:0">AI Assistant runs on your computer</h2>
          <p class="muted small" style="max-width:460px;margin:8px auto">AI chat goes through the desktop app (Ollama runs on the computer, and online AIs need the app's secure relay for your keys). Everything else works here on the phone: dashboards, Weekly Review, Calendar, receipts and statement imports.</p>`,
          `<button class="btn" onclick="App.go('dashboard')">Back to dashboard</button>`);
        return;
      }
      const P = prefs();
      if (params.provider) P.provider = params.provider;
      if (params.newThread) activeId = null;
      const conn = await App.ai.connected();
      // Default to an AI that's actually connected
      if (!conn[P.provider]) { const first = ['ollama', 'groq', 'xai', 'perplexity'].find(k => conn[k]); if (first) { P.provider = first; App.bsettings.set('ai.prefs', { ...App.bsettings.get('ai.prefs', {}), provider: first }); } }
      const datasets = await App.store.datasets();
      view.innerHTML = `
        <div class="ai-layout">
          <section class="card ai-chat">
            <header class="ai-head">
              <div class="seg" role="tablist">${Object.entries(App.ai.PROVIDERS).map(([k, p]) => `
                <button data-prov="${k}" class="${P.provider === k ? 'on' : ''}" title="${esc(p.short)}">
                  <span class="prov-dot" style="background:${p.color}">${p.mono}</span>${esc(p.label)}${p.free ? ' <span class="badge good">free</span>' : ''}${conn[k] ? '' : ' <span class="badge warn">not connected</span>'}</button>`).join('')}
              </div>
              <div class="row" id="aiOpts"></div>
            </header>
            <div class="ai-msgs" id="aiMsgs"></div>
            <div id="aiConnect"></div>
            <form class="ai-composer" id="aiForm">
              <textarea id="aiInput" rows="1" placeholder="Ask about your business…"></textarea>
              <button class="btn primary" id="aiSend" type="submit" title="Send (Enter)">${App.fx.icon('arrow')}</button>
            </form>
            <div class="ai-ctx muted tiny" id="aiCtx"></div>
          </section>
          <aside class="ai-side">
            <div class="card stack">
              <h3>What the AI can see</h3>
              <label class="row small"><input type="checkbox" id="cSum" ${P.summary ? 'checked' : ''}> ${App.biz.isMaster() ? App.esc(App.biz.masterLabel()) + ' (all units)' : 'This business'}: KPIs &amp; flags</label>
              <label class="field">Include a data table
                <select id="cDs"><option value="">None</option>${datasets.map(d => `<option value="${d.id}" ${d.id === P.dataset ? 'selected' : ''}>${esc(d.name)}${d.category === 'personnel' ? ' (personnel)' : ''}</option>`).join('')}</select>
              </label>
              <label class="row small"><input type="checkbox" id="cNotes" ${P.notes ? 'checked' : ''}> Research notes</label>
              <div class="muted tiny" id="cWarn"></div>
              <div class="muted tiny">Only what's checked here is sent to the AI provider with your question.</div>
            </div>
            <div class="card stack">
              <div class="row spread"><h3>Conversations</h3><button class="btn small" id="aiNew">${App.fx.icon('plus')} New</button></div>
              <div class="stack" id="aiThreads"></div>
            </div>
          </aside>
        </div>`;

      const $ = s => view.querySelector(s);
      const input = $('#aiInput');

      function renderOpts() {
        const p = prefs();
        $('#aiOpts').innerHTML = p.provider === 'perplexity'
          ? `<label class="row small muted">Depth <select id="oDepth">${App.ui.options(App.ai.DEPTHS, p.depth)}</select></label>`
          : `<label class="row small muted">Model <select id="oModel" data-native><option>${esc(App.settings.get(App.ai.modelKey(p.provider), '') || 'auto')}</option></select></label>`;
        $('#oDepth')?.addEventListener('change', e => { savePrefs({ ...prefs(), depth: e.target.value }); });
        const om = $('#oModel');
        const mk = App.ai.modelKey(p.provider);
        if (om && conn[p.provider]) App.ai.models(p.provider).then(list => {
          const saved = App.settings.get(mk, '');
          const cur = list.includes(saved) ? saved : list[0] || '';
          om.innerHTML = list.map(m => `<option ${m === cur ? 'selected' : ''}>${esc(m)}</option>`).join('') || '<option>auto</option>';
          if (cur) App.settings.set(mk, cur);
        }).catch(() => {});
        om?.addEventListener('change', e => App.settings.set(mk, e.target.value));
        renderConnect();
        updateCtx();
      }

      function renderConnect() {
        const p = prefs().provider;
        const box = $('#aiConnect');
        if (conn[p]) { box.innerHTML = ''; return; }
        const P2 = App.ai.PROVIDERS[p];
        if (P2.local) {
          box.innerHTML = `<div class="ai-connect" style="align-items:flex-start"><span class="prov-dot" style="background:${P2.color}">${P2.mono}</span><div style="flex:1;min-width:0"><b>Set up Ollama</b> <span class="muted tiny">free · unlimited · private</span><div data-olsetup style="margin-top:8px"></div></div></div>`;
          App.ollamaSetup(box.querySelector('[data-olsetup]'), { compact: true, onReady: () => { conn.ollama = true; App.ui.toast('Ollama connected'); App.go('ai'); } });
          return;
        }
        box.innerHTML = `<div class="ai-connect"><span class="prov-dot" style="background:${P2.color}">${P2.mono}</span>
          <div style="flex:1;min-width:0"><b>Connect ${esc(P2.label)}</b><div class="muted tiny">Paste an API key from <a href="${P2.keyUrl}" target="_blank" rel="noopener">${esc(P2.keyUrl.replace('https://', ''))}</a>. ${window.desktop ? 'Stored encrypted on this computer.' : 'Stored only in this browser.'}</div></div>
          <input id="kIn" type="password" placeholder="${P2.keyHint}" style="width:220px"><button class="btn primary small" id="kSave">Connect</button></div>`;
        $('#kSave').onclick = async () => {
          const v = $('#kIn').value.trim(); if (!v) return;
          await App.ai.setKey(p, v); conn[p] = true;
          App.ui.toast(`${P2.label} connected`);
          App.go('ai');
        };
      }

      function updateCtx() {
        const p = prefs();
        const parts = [];
        if (p.summary) parts.push(App.biz.isMaster() ? 'all units\' KPIs & flags' : 'KPIs & flags');
        if (p.dataset) parts.push('table: ' + (datasets.find(d => d.id === p.dataset)?.name || ''));
        if (p.notes) parts.push('research notes');
        $('#aiCtx').innerHTML = `${App.fx.icon('lock')} Sends ${parts.length ? parts.map(esc).join(' · ') : 'only your question'} to ${esc(App.ai.PROVIDERS[p.provider].label)} · <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line`;
        const ds = datasets.find(d => d.id === p.dataset);
        const PV = App.ai.PROVIDERS[p.provider];
        $('#cWarn').innerHTML = [ds?.category === 'personnel' ? `<span style="color:var(--warn)">This table contains personnel data. It will be sent to ${esc(PV.label)}.</span>` : '',
          PV.privacy && (p.summary || ds || p.notes) ? `<span style="color:var(--warn)">${esc(PV.privacy)} Use Ollama for payroll and employee data.</span>` : '',
          PV.local ? '<span style="color:var(--good)">Ollama runs on this computer: nothing is sent online.</span>' : ''].filter(Boolean).join('<br>');
      }

      function renderThreads() {
        const ts = threads();
        $('#aiThreads').innerHTML = ts.map(t => `<div class="note-item ai-thread ${t.id === activeId ? 'active' : ''}" data-t="${t.id}">
          <div class="row spread" style="flex-wrap:nowrap"><b class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</b><button class="btn ghost small" data-del="${t.id}" title="Delete">×</button></div>
          <div class="muted tiny">${new Date(t.updated).toLocaleString()} · ${t.messages.length} messages</div></div>`).join('') || '<div class="muted small">No conversations yet.</div>';
        view.querySelectorAll('[data-t]').forEach(n => n.onclick = e => { if (e.target.closest('[data-del]')) return; activeId = n.dataset.t; renderThreads(); renderMsgs(); });
        view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { saveThreads(threads().filter(t => t.id !== b.dataset.del)); if (activeId === b.dataset.del) activeId = null; renderThreads(); renderMsgs(); });
      }

      // Another connected AI to compare answers with (Perplexity pairs with a reasoning model and vice versa)
      function otherOf(cur) {
        const order = cur === 'perplexity' ? ['ollama', 'xai', 'groq'] : ['perplexity', 'xai', 'groq', 'ollama'];
        return order.find(k => k !== cur && conn[k]) || null;
      }

      function msgHTML(m, i) {
        if (m.role === 'user') return `<div class="msg user"><div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
        const P2 = App.ai.PROVIDERS[m.provider] || {};
        const other = otherOf(m.provider);
        return `<div class="msg bot"><span class="prov-dot lg" style="background:${P2.color}">${P2.mono}</span>
          <div class="bot-body">
            <div class="bot-meta"><b>${esc(P2.label)}</b><span class="muted tiny">${esc(m.model || '')}${m.cost ? ' · $' + (+m.cost).toFixed(4) : ''}</span></div>
            <div class="md ${m.error ? 'err' : ''}">${m.error ? esc(m.content) : App.ai.md(m.content, m.sources)}</div>
            ${m.sources?.length ? `<div class="sources">${m.sources.slice(0, 12).map((s, j) => { let host = ''; try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch { host = s.url; } return `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}"><span class="n">${j + 1}</span><span class="t">${esc(s.title || host)}</span><span class="h">${esc(host)}</span></a>`; }).join('')}</div>` : ''}
            ${m.error ? '' : `<div class="bot-actions">
              <button class="btn ghost small" data-copy="${i}">Copy</button>
              <button class="btn ghost small" data-save="${i}">${App.fx.icon('research')} Save to Research</button>
              ${other ? `<button class="btn ghost small" data-other="${i}">Ask ${esc(App.ai.PROVIDERS[other].label)} too</button>` : ''}
            </div>`}
          </div></div>`;
      }

      function renderMsgs(pendingProvider) {
        const t = threads().find(x => x.id === activeId);
        const box = $('#aiMsgs');
        if (!t && !pendingProvider) {
          box.innerHTML = `<div class="ai-welcome">
            <div class="onb-logo" style="margin:0 auto 14px">${App.fx.icon('sparkles')}</div>
            <h2>Ask your business anything</h2>
            <p class="muted">Grok analyzes your numbers. Perplexity researches the web with sources. Both can see the context you choose on the right.</p>
            <div class="ai-sugg">${suggestions().map(([p, q]) => `<button data-sugg="${esc(q)}" data-p="${p}"><span class="prov-dot" style="background:${App.ai.PROVIDERS[p].color}">${App.ai.PROVIDERS[p].mono}</span>${esc(q)}</button>`).join('')}</div>
          </div>`;
          box.querySelectorAll('[data-sugg]').forEach(b => b.onclick = () => { savePrefs({ ...prefs(), provider: b.dataset.p }); syncProv(); send(b.dataset.sugg); });
          return;
        }
        const msgs = t ? t.messages : [];
        box.innerHTML = msgs.map(msgHTML).join('') + (pendingProvider ? `<div class="msg bot pending"><span class="prov-dot lg" style="background:${App.ai.PROVIDERS[pendingProvider].color}">${App.ai.PROVIDERS[pendingProvider].mono}</span>
          <div class="bot-body"><div class="typing"><i></i><i></i><i></i></div><div class="muted small">${pendingProvider === 'perplexity' ? 'Searching the web and reading sources…' : 'Analyzing your data…'}</div></div></div>` : '');
        box.scrollTop = box.scrollHeight;
        box.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard?.writeText(msgs[+b.dataset.copy].content); App.ui.toast('Copied'); });
        box.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
          const m = msgs[+b.dataset.save];
          const q = [...msgs.slice(0, +b.dataset.save)].reverse().find(x => x.role === 'user')?.content || 'AI answer';
          await App.store.put('notes', {
            id: App.uid(), businessId: App.biz.target(), module: 'research', title: q.slice(0, 80), status: 'Findings ready',
            tags: ['AI', App.ai.PROVIDERS[m.provider].label], link: m.sources?.[0]?.url || '',
            body: `${m.content}\n\n${m.sources?.length ? 'Sources:\n' + m.sources.map((s, j) => `[${j + 1}] ${s.title} - ${s.url}`).join('\n') : ''}`, updated: Date.now()
          });
          App.ui.toast('Saved to Research');
        });
        box.querySelectorAll('[data-other]').forEach(b => b.onclick = () => {
          const i = +b.dataset.other;
          const q = [...msgs.slice(0, i)].reverse().find(x => x.role === 'user')?.content;
          const other = otherOf(msgs[i].provider);
          if (!other) return;
          savePrefs({ ...prefs(), provider: other }); syncProv();
          if (q) send(q, { second: true });
        });
      }

      function syncProv() {
        const p = prefs().provider;
        view.querySelectorAll('[data-prov]').forEach(b => b.classList.toggle('on', b.dataset.prov === p));
        renderOpts();
      }

      async function send(text, { second = false } = {}) {
        text = (text || '').trim();
        if (!text || busy) return;
        const p = prefs();
        if (!conn[p.provider]) { renderConnect(); $('#kIn')?.focus(); App.ui.toast(`Connect ${App.ai.PROVIDERS[p.provider].label} first`); return; }
        busy = true; $('#aiSend').disabled = true;
        let all = threads();
        let t = all.find(x => x.id === activeId);
        if (!t) { t = { id: App.uid(), title: text.slice(0, 70), messages: [], updated: Date.now() }; all.unshift(t); activeId = t.id; }
        if (!second) t.messages.push({ role: 'user', content: text, at: Date.now() });
        t.updated = Date.now();
        saveThreads(all); renderThreads(); renderMsgs(p.provider);
        input.value = ''; autosize();
        try {
          const context = await App.ai.buildContext({ summary: p.summary, datasetId: p.dataset, notes: p.notes });
          let hist = t.messages.filter(m => !m.error);
          // When getting a second opinion, end on the user's question (drop the first AI's reply)
          while (hist.length && hist[hist.length - 1].role === 'assistant') hist = hist.slice(0, -1);
          const history = hist.slice(-12).map(m => ({ role: m.role, content: m.content }));
          const r = await App.ai.ask({ provider: p.provider, messages: history, context, depth: p.depth });
          t.messages.push({ role: 'assistant', provider: p.provider, content: r.text, sources: r.sources, model: r.model, cost: r.cost, at: Date.now() });
        } catch (e) {
          t.messages.push({ role: 'assistant', provider: p.provider, content: e.message, error: true, at: Date.now() });
        }
        all = threads(); const idx = all.findIndex(x => x.id === t.id);
        if (idx >= 0) all[idx] = t; else all.unshift(t);
        saveThreads(all);
        busy = false; $('#aiSend').disabled = false;
        if (view.isConnected) { renderThreads(); renderMsgs(); input.focus(); }
      }

      function autosize() { input.style.height = 'auto'; input.style.height = Math.min(200, input.scrollHeight) + 'px'; }
      input.addEventListener('input', autosize);
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
      $('#aiForm').onsubmit = e => { e.preventDefault(); send(input.value); };
      view.querySelectorAll('[data-prov]').forEach(b => b.onclick = () => { savePrefs({ ...prefs(), provider: b.dataset.prov }); syncProv(); });
      $('#cSum').onchange = e => { savePrefs({ ...prefs(), summary: e.target.checked }); updateCtx(); };
      $('#cDs').onchange = e => { savePrefs({ ...prefs(), dataset: e.target.value }); updateCtx(); };
      $('#cNotes').onchange = e => { savePrefs({ ...prefs(), notes: e.target.checked }); updateCtx(); };
      $('#aiNew').onclick = () => { activeId = null; renderThreads(); renderMsgs(); input.focus(); };

      savePrefs(P);
      renderOpts(); renderThreads(); renderMsgs();
      if (params.prompt) { if (params.send) send(params.prompt); else { input.value = params.prompt; autosize(); } }
      setTimeout(() => input.focus(), 50);
    }
  };
})(window.App);
