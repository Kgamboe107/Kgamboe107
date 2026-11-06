/* Integrations: live connectors (Google Drive, Outlook via Microsoft Graph) + guided import for
   Harri, CrunchTime, Webull, Dub, and Anara exports. */
(function (App) {
  const ADDONS = [
    { repo: 'anthropics/claude-plugins-community', name: 'Claude plugins marketplace', mono: 'C+', color: 'linear-gradient(135deg,#d97757,#b4532a)',
      what: 'Community-built plugins for Claude Cowork and Claude Code.', use: 'Finding ready-made workflows (bookkeeping, HR, marketing) to pair with your exports from this app.' },
    { repo: 'tt-a1i/archify', name: 'Archify', mono: 'Ar', color: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
      what: 'Has an AI agent draw architecture and workflow diagrams as self-checking HTML pages.', use: 'Mapping your processes, like receipt → purchase journal → food cost → tax report.' },
    { repo: 'MadsLorentzen/ai-job-search', name: 'AI job search', mono: 'Jb', color: 'linear-gradient(135deg,#10b981,#0d9488)',
      what: 'A job-application framework built on Claude Code: tailored resumes, cover letters, tracking.', use: 'Hiring side: borrow its structure for job posts and candidate tracking alongside Personnel.' },
    { repo: 'bilawalsidhu/gods-eye-view', name: "God's Eye View", mono: '3D', color: 'linear-gradient(135deg,#1e293b,#475569)',
      what: 'An interactive 3D globe for exploring places and data on a map.', use: 'Visualizing locations: stores, vendors, delivery zones, ad reach.' },
    { repo: 'freestylefly/awesome-gpt-image-2', name: 'Awesome GPT Image 2', mono: 'Im', color: 'linear-gradient(135deg,#d946ef,#8b5cf6)',
      what: 'A curated library of image-generation prompts, packaged as an agent skill.', use: 'Marketing: menu photos, social posts and flyers to test in your campaigns.' }
  ];

  const { esc } = App;

  /* ---------- Google Drive (Google Identity Services + Picker) ---------- */
  const loadScript = src => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s);
  });
  let gToken = null;

  async function driveToken() {
    const cfg = App.settings.get('int.google', {});
    if (!cfg.clientId) throw new Error('Add your Google OAuth Client ID first.');
    await loadScript('https://accounts.google.com/gsi/client');
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId, scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: r => r.error ? reject(new Error(r.error)) : (gToken = r.access_token, resolve(gToken))
      });
      client.requestAccessToken({ prompt: gToken ? '' : 'consent' });
    });
  }

  async function drivePick() {
    const cfg = App.settings.get('int.google', {});
    const token = await driveToken();
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise(r => gapi.load('picker', r));
    return new Promise(resolve => {
      const view = new google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false);
      const picker = new google.picker.PickerBuilder()
        .addView(view).enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(token).setDeveloperKey(cfg.apiKey || '')
        .setCallback(d => { if (d.action === google.picker.Action.PICKED) resolve(d.docs); if (d.action === google.picker.Action.CANCEL) resolve([]); })
        .build();
      picker.setVisible(true);
    });
  }

  const GOOGLE_EXPORT = {
    'application/vnd.google-apps.spreadsheet': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
    'application/vnd.google-apps.document': ['application/pdf', '.pdf'],
    'application/vnd.google-apps.presentation': ['application/pdf', '.pdf']
  };
  async function driveDownload(doc) {
    const exp = GOOGLE_EXPORT[doc.mimeType];
    const url = exp
      ? `https://www.googleapis.com/drive/v3/files/${doc.id}/export?mimeType=${encodeURIComponent(exp[0])}`
      : `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`;
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + gToken } });
    if (!r.ok) throw new Error(`Drive download failed (${r.status})`);
    const blob = await r.blob();
    const name = exp && !doc.name.endsWith(exp[1]) ? doc.name + exp[1] : doc.name;
    return new File([blob], name, { type: blob.type });
  }

  async function driveImport(opts) {
    const docs = await drivePick();
    const files = [];
    for (const d of docs) { try { files.push(await driveDownload(d)); } catch (e) { App.ui.toast(e.message); } }
    if (files.length) await App.ingest.ingestMany(files, { source: 'gdrive', origin: 'gdrive', ...opts });
    return files.length;
  }

  /* ---------- Outlook (MSAL + Microsoft Graph) ---------- */
  let msal = null, msAccount = null;
  const MS_SCOPES = ['User.Read', 'Mail.Read'];

  async function msInit() {
    const cfg = App.settings.get('int.outlook', {});
    if (!cfg.clientId) throw new Error('Add your Microsoft (Azure) Application Client ID first.');
    if (!window.msal) throw new Error('MSAL library failed to load.');
    if (location.protocol === 'file:') throw new Error('Outlook sign-in needs the app served over http — start it with "npm start" or "npm run web".');
    if (!msal) {
      msal = new window.msal.PublicClientApplication({
        auth: { clientId: cfg.clientId, authority: 'https://login.microsoftonline.com/' + (cfg.tenant || 'common'), redirectUri: location.origin + location.pathname },
        cache: { cacheLocation: 'localStorage' }
      });
      if (msal.initialize) await msal.initialize();
    }
    msAccount = msal.getAllAccounts()[0] || null;
  }
  async function msToken() {
    await msInit();
    if (!msAccount) { const r = await msal.loginPopup({ scopes: MS_SCOPES }); msAccount = r.account; }
    try { return (await msal.acquireTokenSilent({ scopes: MS_SCOPES, account: msAccount })).accessToken; }
    catch { return (await msal.acquireTokenPopup({ scopes: MS_SCOPES, account: msAccount })).accessToken; }
  }
  async function graph(path) {
    const token = await msToken();
    const r = await fetch('https://graph.microsoft.com/v1.0' + path, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error(`Microsoft Graph error ${r.status}`);
    return r.json();
  }
  async function outlookMessages(search) {
    const sel = '$select=id,subject,from,receivedDateTime,hasAttachments&$top=30';
    const path = search
      ? `/me/messages?$search="${encodeURIComponent(search.replace(/"/g, ''))}"&${sel}`
      : `/me/messages?$filter=hasAttachments eq true&$orderby=receivedDateTime desc&${sel}`;
    return (await graph(path)).value.filter(m => m.hasAttachments);
  }
  async function outlookImportAttachments(msgId) {
    const atts = (await graph(`/me/messages/${msgId}/attachments`)).value.filter(a => a['@odata.type'] === '#microsoft.graph.fileAttachment');
    const files = atts.map(a => {
      const bin = atob(a.contentBytes); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new File([bytes], a.name, { type: a.contentType });
    });
    /* Keep the system the attachment came from (e.g. a CrunchTime report emailed nightly) if recognizable */
    for (const f of files) {
      const src = App.ingest.detectSource(f.name);
      await App.ingest.ingestMany([f], { origin: 'outlook', source: src === 'manual' ? 'outlook' : undefined, tags: ['Outlook'] });
    }
    return files.length;
  }

  /* ---------- File-based connectors ---------- */
  const GUIDES = {
    harri: { cat: 'personnel', blurb: 'Labor, timesheets, scheduling, and employee roster.',
      steps: ['In Harri, open <b>Reports</b> (or <b>Team → Employees</b> for the roster).', 'Run <b>Timesheet / Labor Summary</b> for the date range, or the employee list.', 'Click <b>Export → CSV/Excel</b> and drop the file here.', 'Timesheets feed <b>Operations</b> (labor %, SPLH, overtime); rosters feed <b>Personnel</b>.'],
      template: ['Employee', 'Employee ID', 'Location', 'Position', 'Date', 'Scheduled Hours', 'Total Hours', 'Overtime Hours', 'Pay Rate', 'Labor Cost'] },
    crunchtime: { cat: 'operations', blurb: 'Sales, food cost, actual-vs-theoretical, and inventory.',
      steps: ['In CrunchTime (Net Chef / Teamworx), open <b>Reports</b>.', 'Export <b>Actual vs. Theoretical</b>, <b>Inventory Variance</b>, or <b>Daily Sales Summary</b> to Excel.', 'Drop the file here — or set CrunchTime to email it and pull it from Outlook.', 'Sales/cost feed <b>Operations</b> KPIs; AvT feeds the inventory variance view.'],
      template: ['Business Date', 'Location', 'Net Sales', 'Guest Count', 'Food Cost', 'Theoretical Cost'] },
    webull: { cat: 'trading', blurb: 'Positions and order history for risk analysis.',
      steps: ['Webull desktop: <b>Account → Positions</b> or <b>Orders → History</b>.', 'Use <b>Export</b> (or download the monthly statement CSV from the web portal).', 'Drop the CSV here. Positions feed exposure/concentration; orders feed P&L, drawdown, VaR.', 'Webull OpenAPI (live sync) needs a server-side signed key — see README.'],
      template: ['Symbol', 'Name', 'Side', 'Status', 'Filled', 'Total Qty', 'Avg Price', 'Filled Time'] },
    dub: { cat: 'trading', blurb: 'Copy-trading portfolios and the creators you follow.',
      steps: ['Dub has no public export yet — download the template below.', 'Fill one row per holding from <b>Portfolio → Holdings</b> (Portfolio = the creator you copy).', 'Upload it here and analyze it in <b>Trading Risk</b> next to your Webull holdings to spot overlap and concentration.'],
      template: ['Portfolio', 'Symbol', 'Quantity', 'Avg Cost', 'Last Price', 'Market Value', 'Sector'] },
    anara: { cat: 'research', blurb: 'Research notes, highlights, and source documents.',
      steps: ['In Anara, open a document or notebook.', 'Export notes / highlights as <b>Markdown</b> (or download the PDF).', 'Import here — Markdown becomes an editable research note, PDFs are filed under Research.', 'Paste the Anara link into a note’s Source field to jump back.'],
      template: null }
  };

  App.modules.integrations = {
    async render(view) {
      const g = App.settings.get('int.google', {}), o = App.settings.get('int.outlook', {});
      const aiConn = await App.ai.connected();
      const files = await App.store.files();
      const count = s => files.filter(f => f.source === s).length;
      const logo = s => `<div class="logo" style="background:${App.sources[s].color}">${esc(App.sources[s].label.slice(0, 2))}</div>`;
      view.innerHTML = `
        <div class="grid c2">
          <div class="card int-card stack">
            <div class="row">${logo('gdrive')}<div><h2>Google Drive</h2><div class="muted small">Live connection · pick Sheets, Excel, CSV, PDF, Docs · ${count('gdrive')} imported</div></div></div>
            <div class="mapper">
              <label>OAuth Client ID<input id="gId" value="${esc(g.clientId || '')}" placeholder="xxxx.apps.googleusercontent.com"></label>
              <label>API key (for Picker)<input id="gKey" value="${esc(g.apiKey || '')}" placeholder="AIza…"></label>
            </div>
            <div class="row"><button class="btn primary" id="gPick">Import from Drive</button><button class="btn small" id="gSave">Save</button></div>
            <details class="small muted"><summary>Setup (one time)</summary><ol>
              <li>console.cloud.google.com → create a project → enable <b>Google Drive API</b> and <b>Google Picker API</b>.</li>
              <li>Credentials → <b>OAuth client ID</b> (Web application). Authorized JavaScript origin: <code>${esc(location.origin.startsWith('http') ? location.origin : 'http://localhost:5178')}</code></li>
              <li>Credentials → <b>API key</b> (restrict to Picker API). Paste both above.</li></ol></details>
          </div>
          <div class="card int-card stack">
            <div class="row">${logo('outlook')}<div><h2>Outlook / Microsoft 365</h2><div class="muted small">Live connection · import email attachments · ${count('outlook')} imported</div></div></div>
            <div class="mapper">
              <label>Application (client) ID<input id="oId" value="${esc(o.clientId || '')}" placeholder="00000000-0000-…"></label>
              <label>Tenant<input id="oTen" value="${esc(o.tenant || 'common')}"></label>
            </div>
            <div class="row"><input id="oQ" placeholder="Search mail (e.g. CrunchTime, P&L)" style="flex:1"><button class="btn primary" id="oList">Find attachments</button><button class="btn small" id="oSave">Save</button></div>
            <div id="oMsgs" class="stack"></div>
            <details class="small muted"><summary>Setup (one time)</summary><ol>
              <li>portal.azure.com → <b>App registrations</b> → New registration (accounts in any org + personal).</li>
              <li>Authentication → add platform <b>Single-page application</b>, redirect URI <code>${esc(location.protocol.startsWith('http') ? location.origin + location.pathname : 'http://localhost:5178/')}</code></li>
              <li>API permissions → Microsoft Graph → delegated <b>Mail.Read</b>, <b>User.Read</b>. Paste the client ID above.</li></ol></details>
          </div>
        </div>
        <h2 style="margin-top:8px">AI providers</h2>
        <div class="muted small" style="margin-top:-10px">Connect any of these; the AI Assistant lets you switch between them. <b>Recommended: Ollama</b>, free and unlimited, and nothing leaves this computer. Groq is a free online option that doesn't train on your data.</div>
        <div class="grid c2">${Object.entries(App.ai.PROVIDERS).sort(([a], [b]) => (b === 'ollama') - (a === 'ollama')).map(([k, p]) => `
          <div class="card int-card stack">
            <div class="row spread"><div class="row"><div class="logo" style="background:${p.color}">${p.mono}</div><div><h2>${esc(p.label)} ${p.local ? '<span class="badge good">recommended</span>' : ''}${p.free ? '<span class="badge good">free</span>' : ''}</h2><div class="muted small">${esc(p.short)} · <span data-aistat="${k}">${aiConn[k] ? '<span class="badge good">connected</span>' : '<span class="badge">not connected</span>'}</span></div></div></div>
              <a class="btn small" href="${p.keyUrl}" target="_blank" rel="noopener">${p.local ? 'Download Ollama' : p.free ? 'Get a free API key' : 'Get an API key'}</a></div>
            ${p.local ? `<div data-olsetup></div>`
            : `<div class="row"><input type="password" data-aikey="${k}" placeholder="${aiConn[k] ? '•••••••• saved. Paste to replace' : p.keyHint}" style="flex:1">
              <button class="btn primary small" data-aisave="${k}">Save</button><button class="btn small" data-aitest="${k}" ${aiConn[k] ? '' : 'disabled'}>Test</button>
              ${aiConn[k] ? `<button class="btn small danger" data-airm="${k}">Remove key</button>` : ''}</div>`}
            <div class="muted tiny">${esc(p.note)} ${p.local ? '' : window.desktop ? 'Keys are encrypted by your operating system.' : 'Keys stay in this browser and are never included in backups.'}</div>
          </div>`).join('')}</div>
        <h2 style="margin-top:8px">Export-based connectors</h2>
        <div class="grid c2">${Object.entries(GUIDES).map(([s, gd]) => `
          <div class="card int-card stack">
            <div class="row spread"><div class="row">${logo(s)}<div><h2>${esc(App.sources[s].label)}</h2><div class="muted small">${esc(gd.blurb)} · ${count(s)} imported</div></div></div>
              ${s === 'anara' ? '<a class="btn small" href="https://anara.com" target="_blank" rel="noopener">Open Anara</a>' : ''}</div>
            <ol class="small" style="margin:0;padding-left:18px">${gd.steps.map(x => `<li>${x}</li>`).join('')}</ol>
            <div class="row">
              <label class="btn primary">Import ${esc(App.sources[s].label)} file<input type="file" data-src="${s}" multiple hidden></label>
              ${gd.template ? `<button class="btn small" data-tpl="${s}">Download template</button>` : ''}
            </div>
          </div>`).join('')}</div>
        <h2 style="margin-top:8px">Add-ons &amp; resources</h2>
        <div class="muted small" style="margin-top:-10px">Open-source projects that work alongside Ops Command Desk. They open on GitHub; nothing is installed automatically.</div>
        <div class="grid c3">${ADDONS.map(a => `
          <a class="card int-card addon stack" href="https://github.com/${a.repo}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
            <div class="row"><div class="logo" style="background:${a.color}">${a.mono}</div><div style="min-width:0"><h3 style="margin:0">${esc(a.name)}</h3><div class="muted tiny">github.com/${esc(a.repo)}</div></div></div>
            <div class="small">${esc(a.what)}</div>
            <div class="muted tiny"><b>Use it for:</b> ${esc(a.use)}</div>
            <span class="small" style="color:var(--accent);font-weight:600">View on GitHub ↗</span>
          </a>`).join('')}</div>`;

      view.querySelectorAll('[data-aisave]').forEach(b => b.onclick = async () => {
        const k = b.dataset.aisave, v = view.querySelector(`[data-aikey="${k}"]`).value.trim();
        if (!v) return App.ui.toast('Paste a key first');
        await App.ai.setKey(k, v); App.ui.toast(`${App.ai.PROVIDERS[k].label} key saved`); App.go('integrations');
      });
      view.querySelectorAll('[data-airm]').forEach(b => b.onclick = async () => { await App.ai.setKey(b.dataset.airm, ''); App.ui.toast(App.ai.PROVIDERS[b.dataset.airm].local ? 'Ollama turned off' : 'Key removed'); App.go('integrations'); });
      const ol = view.querySelector('[data-olsetup]');
      if (ol) App.ollamaSetup(ol, { onReady: () => { const st = view.querySelector('[data-aistat="ollama"]'); if (st) st.innerHTML = '<span class="badge good">connected</span>'; } });
      view.querySelector('#gSave').onclick = () => { App.settings.set('int.google', { clientId: view.querySelector('#gId').value.trim(), apiKey: view.querySelector('#gKey').value.trim() }); App.ui.toast('Google settings saved'); };
      view.querySelector('#oSave').onclick = () => { App.settings.set('int.outlook', { clientId: view.querySelector('#oId').value.trim(), tenant: view.querySelector('#oTen').value.trim() || 'common' }); msal = null; App.ui.toast('Outlook settings saved'); };
      view.querySelector('#gPick').onclick = async () => {
        view.querySelector('#gSave').click();
        try { const n = await driveImport({}); if (n) App.go('library'); } catch (e) { App.ui.toast(e.message, 5000); }
      };
      view.querySelector('#oList').onclick = async () => {
        view.querySelector('#oSave').click();
        const box = view.querySelector('#oMsgs');
        box.innerHTML = '<div class="muted small">Loading…</div>';
        try {
          const msgs = await outlookMessages(view.querySelector('#oQ').value.trim());
          box.innerHTML = msgs.map(m => `<div class="row spread note-item"><div><b>${esc(m.subject || '(no subject)')}</b><div class="muted tiny">${esc(m.from?.emailAddress?.name || '')} · ${new Date(m.receivedDateTime).toLocaleString()}</div></div><button class="btn small" data-msg="${esc(m.id)}">Import attachments</button></div>`).join('') || '<div class="muted small">No messages with attachments found.</div>';
          box.querySelectorAll('[data-msg]').forEach(b => b.onclick = async () => {
            b.disabled = true; b.textContent = 'Importing…';
            try { const n = await outlookImportAttachments(b.dataset.msg); b.textContent = `Imported ${n}`; } catch (e) { App.ui.toast(e.message, 5000); b.disabled = false; b.textContent = 'Retry'; }
          });
        } catch (e) { box.innerHTML = `<div class="alert bad small">${esc(e.message)}</div>`; }
      };
      view.querySelectorAll('[data-src]').forEach(inp => inp.onchange = async () => {
        const s = inp.dataset.src;
        await App.ingest.ingestMany([...inp.files], { source: s, category: GUIDES[s].cat === 'personnel' ? undefined : GUIDES[s].cat });
        inp.value = ''; App.go('integrations');
      });
      view.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => App.download(`${b.dataset.tpl}-template.csv`, GUIDES[b.dataset.tpl].template.join(',') + '\n'));
    }
  };

  App.integrations = { driveImport, outlookMessages, outlookImportAttachments };
})(window.App);
