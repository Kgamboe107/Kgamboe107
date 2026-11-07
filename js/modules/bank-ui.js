/* Integrations → Banking & payments: statement import (Cash App, Venmo, PayPal, banks, cards, OFX/QFX/QBO,
   Square, Stripe, budgeting apps) and live connections (Plaid, Square, Stripe). */
(function (App) {
  const { esc, fmt } = App;
  const B = () => App.banking;

  const HOWTO = [
    ['Cash App', '#00d64f', 'Cash App on the web (cash.app/account) or the app → <b>Activity</b> → <b>Statements</b> → <b>Export CSV</b>. Cash App doesn’t offer a live connection for personal accounts, so export monthly. For Cash App for Business, use the Square connection below.'],
    ['Venmo', '#008cff', 'venmo.com → <b>Statements</b> → pick the month → <b>Download CSV</b>.'],
    ['PayPal', '#003087', 'paypal.com → <b>Activity</b> → <b>Statements</b> → <b>Activity report</b> → CSV → download.'],
    ['Chase', '#117aca', 'chase.com → the account → <b>Download account activity</b> (the download arrow) → CSV, or <b>Quicken (QFX)</b>.'],
    ['Bank of America', '#e31837', 'bankofamerica.com → the account → <b>Download</b> → <b>Microsoft Excel (CSV)</b> or <b>Web Connect (QFX)</b>.'],
    ['Wells Fargo', '#d71e28', 'wellsfargo.com → <b>Download Account Activity</b> → <b>Comma Delimited</b> or <b>Quicken</b>.'],
    ['Capital One', '#004977', 'capitalone.com → the card or account → <b>Download Transactions</b> → CSV.'],
    ['Amex · Discover · Citi', '#2e77bb', 'Statements &amp; Activity → <b>Download</b> → CSV (or Quicken/QFX).'],
    ['Any other bank / credit union', '#0f766e', 'Look for <b>Download</b>, <b>Export</b> or <b>Quicken / QuickBooks (Web Connect)</b> on the activity page. CSV, Excel, OFX, QFX and QBO all work.'],
    ['Square', '#3e4348', 'Square Dashboard → <b>Transactions</b> → <b>Export</b> → <b>Transactions CSV</b>, or connect live below.'],
    ['Stripe', '#635bff', 'Dashboard → <b>Balances</b> → <b>Export</b> (balance history CSV), or connect live below.'],
    ['Monarch · Mint · YNAB · Rocket Money', '#ff692d', 'Settings / Transactions → <b>Export</b> (CSV). Every account in the export comes in at once.']
  ];

  const ago = t => !t ? 'never' : (s => s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago')((Date.now() - t) / 1000);
  const unitOpts = sel => App.biz.active().map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(u.name)} (${App.biz.kindOf(u) === 'individual' ? 'personal' : 'business'})</option>`).join('');

  async function html() {
    const ov = await B().overview();
    const pc = B().plaid.cfg(), items = B().plaid.items(), sq = B().square.cfg(), st = B().stripe.cfg();
    const has = { plaid: !!(await B().secret('plaid.secret')), square: !!(await B().secret('square')), stripe: !!(await B().secret('stripe')) };
    const target = App.biz.target();
    const phoneNote = App.hosted ? '<div class="alert warn small">On the phone version, statement import works here. Live Plaid, Square and Stripe syncing runs in the desktop app; sync there, then move a backup to the phone (Settings → Backup).</div>' : '';
    return `<h2 style="margin-top:0">Banking &amp; payments</h2>${phoneNote}
      <div class="muted small" style="margin-top:-10px">Bring in Cash App, Venmo, PayPal, bank and card activity. Transactions feed <b>Financials</b> (daily cash flow), the <b>Weekly Review</b> and the <b>Calendar</b> (repeating pay and bills). For personal units, balances update <b>Net Worth</b>. Transfers between your own accounts are left out of income and spending.</div>
      <div class="grid c2">
        <div class="card int-card stack bk-import">
          <div class="row"><div class="logo" style="background:linear-gradient(135deg,#0f766e,#16a34a)">$</div><div><h2>Import a statement</h2><div class="muted small">CSV, Excel, OFX, QFX or QBO · re-importing the same month won’t double count</div></div></div>
          <label class="field">Put the transactions in<select id="bkUnit">${unitOpts(target)}</select></label>
          <label class="bk-drop" id="bkDrop"><input type="file" id="bkFile" multiple accept=".csv,.tsv,.txt,.xlsx,.xls,.ofx,.qfx,.qbo" hidden>
            <b>Drop statements here</b><span class="muted small">or click to choose files</span></label>
          <div id="bkResult" class="stack"></div>
          <details class="small"><summary><b>How to export from each app or bank</b></summary><div class="bk-how">${HOWTO.map(([n, c, s]) => `<div class="bk-howrow"><span class="bk-dot" style="background:${c}"></span><div><b>${n}</b><div class="muted">${s}</div></div></div>`).join('')}</div></details>
        </div>
        <div class="card int-card stack">
          <div class="row spread"><div class="row"><div class="logo" style="background:#111">P</div><div><h2>Banks &amp; cards (Plaid) ${items.length ? `<span class="badge good">${items.length} connected</span>` : ''}</h2><div class="muted small">Live sync from 12,000+ banks, credit unions and cards: Chase, Bank of America, Wells Fargo, Capital One, Chime, Navy Federal and more</div></div></div>
            <a class="btn small" href="https://dashboard.plaid.com/signup" target="_blank" rel="noopener">Get Plaid keys</a></div>
          <div class="mapper">
            <label>Client ID<input id="plId" value="${esc(pc.clientId || '')}" placeholder="from Plaid dashboard → Developers → Keys"></label>
            <label>Secret<input id="plSecret" type="password" placeholder="${has.plaid ? '•••••••• saved. Paste to replace' : 'Sandbox or Production secret'}"></label>
            <label>Environment<select id="plEnv" data-native><option value="sandbox" ${pc.env !== 'production' ? 'selected' : ''}>Sandbox (test banks, free)</option><option value="production" ${pc.env === 'production' ? 'selected' : ''}>Production (your real banks)</option></select></label>
          </div>
          <div class="row"><button class="btn small" id="plSave">Save keys</button><label class="field bk-inline">for<select id="plUnit" data-native>${unitOpts(target)}</select></label><button class="btn primary" id="plConnect" ${has.plaid && pc.clientId && !App.hosted ? '' : 'disabled'}>Connect a bank</button></div>
          ${items.length ? `<div class="stack">${items.map(i => `<div class="bk-item"><div><b>${esc(i.institution)}</b> <span class="muted tiny">${esc(App.biz.get(i.unit)?.name || '')} · ${i.accounts || '?'} accounts · synced ${ago(i.lastSync)}${i.env === 'sandbox' ? ' · sandbox' : ''}</span></div><div class="row"><button class="btn small" data-plsync="${i.id}">Sync now</button><button class="btn small danger" data-plrm="${i.id}">Disconnect</button></div></div>`).join('')}</div>` : ''}
          <details class="small muted"><summary>Setup (one time)</summary><ol>
            <li>Sign up at dashboard.plaid.com (free). Copy the <b>client ID</b> and the <b>Sandbox</b> secret, paste them here and connect a test bank (user <code>user_good</code>, password <code>pass_good</code>).</li>
            <li>For your real accounts, request <b>Production</b> access in the Plaid dashboard (Plaid charges per connected account after its free allowance). Then switch the environment above and paste the production secret.</li>
            <li>Some banks (Chase, Capital One, Wells Fargo…) sign in on their own page. If that page doesn’t open, import a statement instead.</li></ol></details>
        </div>
        <div class="card int-card stack">
          <div class="row spread"><div class="row"><div class="logo" style="background:#3e4348">Sq</div><div><h2>Square / Cash App for Business ${has.square ? '<span class="badge good">connected</span>' : ''}</h2><div class="muted small">Card and Cash App Pay sales, refunds and processing fees · synced ${ago(sq.lastSync)}</div></div></div>
            <a class="btn small" href="https://developer.squareup.com/apps" target="_blank" rel="noopener">Get a token</a></div>
          <div class="mapper"><label>Access token<input id="sqKey" type="password" placeholder="${has.square ? '•••••••• saved. Paste to replace' : 'Production access token (EAAA…)'}"></label>
            <label>Put sales in<select id="sqUnit" data-native>${unitOpts(sq.unit || target)}</select></label></div>
          <div class="row"><button class="btn small" id="sqSave">Save</button><button class="btn primary" id="sqSync" ${has.square && !App.hosted ? '' : 'disabled'}>Sync last 90 days</button>${has.square ? '<button class="btn small danger" id="sqRm">Remove token</button>' : ''}</div>
          <div class="muted tiny">developer.squareup.com → your app → <b>Credentials</b> → Production access token. Read-only use: only payments are read.</div>
        </div>
        <div class="card int-card stack">
          <div class="row spread"><div class="row"><div class="logo" style="background:#635bff">St</div><div><h2>Stripe ${has.stripe ? '<span class="badge good">connected</span>' : ''}</h2><div class="muted small">Online payments, refunds, fees and payouts · synced ${ago(st.lastSync)}</div></div></div>
            <a class="btn small" href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener">Create a key</a></div>
          <div class="mapper"><label>Restricted key<input id="stKey" type="password" placeholder="${has.stripe ? '•••••••• saved. Paste to replace' : 'rk_live_… (read-only)'}"></label>
            <label>Put payments in<select id="stUnit" data-native>${unitOpts(st.unit || target)}</select></label></div>
          <div class="row"><button class="btn small" id="stSave">Save</button><button class="btn primary" id="stSync" ${has.stripe && !App.hosted ? '' : 'disabled'}>Sync last 90 days</button>${has.stripe ? '<button class="btn small danger" id="stRm">Remove key</button>' : ''}</div>
          <div class="muted tiny">Dashboard → Developers → API keys → <b>Create restricted key</b> with <b>Balance</b> and <b>Balance transactions: Read</b>. Payouts to your bank are counted as transfers.</div>
        </div>
      </div>
      ${ov.length ? `<div class="card"><div class="card-head"><h2>Accounts brought in</h2><a class="small" data-go="calendar" href="#calendar">Calendar →</a></div>
        <div class="table-wrap"><table><thead><tr><th>Unit</th><th>Account</th><th>Source</th><th class="num">Transactions</th><th>From</th><th>To</th><th></th></tr></thead><tbody>
        ${ov.flatMap(o => Object.entries(o.accounts).map(([a, x]) => `<tr><td>${esc(o.unit.name)}</td><td>${esc(a)}</td><td>${esc(x.source)}</td><td class="num">${fmt.num(x.n)}</td><td>${esc(fmt.date(x.first))}</td><td>${esc(fmt.date(x.last))}</td><td><button class="btn ghost small" data-bkclear="${o.unit.id}|${esc(a)}">Remove</button></td></tr>`)).join('')}
        </tbody></table></div></div>` : ''}`;
  }

  function bind(view) {
    const $ = s => view.querySelector(s);
    const refresh = () => App.go('integrations');
    const busy = async (btn, label, fn) => { const t = btn.textContent; btn.disabled = true; btn.textContent = label; try { await fn(); } catch (e) { App.ui.toast(e.message, 6000); } finally { btn.disabled = false; btn.textContent = t; } };
    const doImport = async files => {
      if (!files.length) return;
      const res = await App.ingest.ingestMany([...files], { businessId: $('#bkUnit').value, quiet: true });
      const list = Array.isArray(res) ? res : [];
      const box = $('#bkResult');
      box.innerHTML = list.map(r => r.report?.kind === 'statement'
        ? `<div class="alert good small"><b>${esc(r.name)}</b><br>${r.report.summary.map(esc).join('<br>')}${r.report.warnings?.length ? '<br><span class="muted">' + r.report.warnings.map(esc).join(' ') + '</span>' : ''}</div>`
        : `<div class="alert warn small"><b>${esc(r.name || 'File')}</b>: this doesn’t look like a statement (no date, description and amount columns). It was saved to the Data Library.</div>`).join('');
      if (list.some(r => r.report?.kind === 'statement')) setTimeout(refresh, 2500);
    };
    $('#bkFile').onchange = e => doImport(e.target.files);
    const drop = $('#bkDrop');
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); doImport(e.dataTransfer.files); };

    $('#plSave').onclick = async () => {
      App.settings.set('bank.plaid', { clientId: $('#plId').value.trim(), env: $('#plEnv').value });
      if ($('#plSecret').value.trim()) await B().setSecret('plaid.secret', $('#plSecret').value.trim());
      App.ui.toast('Plaid keys saved'); refresh();
    };
    $('#plConnect').onclick = e => busy(e.target, 'Connecting…', async () => { const it = await B().plaid.connect($('#plUnit').value); if (it) { App.ui.toast(`${it.institution} connected`); refresh(); } });
    view.querySelectorAll('[data-plsync]').forEach(b => b.onclick = () => busy(b, 'Syncing…', async () => { const r = await B().plaid.sync(b.dataset.plsync); App.ui.toast(`${r.added} new transactions`); refresh(); }));
    view.querySelectorAll('[data-plrm]').forEach(b => b.onclick = () => busy(b, 'Removing…', async () => { await B().plaid.remove(b.dataset.plrm); App.ui.toast('Bank disconnected. Imported transactions were kept.'); refresh(); }));

    const live = (k, keyEl, unitEl, saveEl, syncEl, rmEl) => {
      $(saveEl).onclick = async () => { App.settings.set('bank.' + k, { ...B()[k].cfg(), unit: $(unitEl).value }); if ($(keyEl).value.trim()) await B().setSecret(k, $(keyEl).value.trim()); App.ui.toast('Saved'); refresh(); };
      $(syncEl).onclick = e => busy(e.target, 'Syncing…', async () => { App.settings.set('bank.' + k, { ...B()[k].cfg(), unit: $(unitEl).value }); const r = await B()[k].sync(90); App.ui.toast(`${r.added} new transactions (${r.total} total)`); refresh(); });
      $(rmEl)?.addEventListener('click', async () => { await B().setSecret(k, ''); App.ui.toast('Removed'); refresh(); });
    };
    live('square', '#sqKey', '#sqUnit', '#sqSave', '#sqSync', '#sqRm');
    live('stripe', '#stKey', '#stUnit', '#stSave', '#stSync', '#stRm');
    view.querySelectorAll('[data-bkclear]').forEach(b => b.onclick = async () => {
      const [bid, acct] = b.dataset.bkclear.split('|');
      if (!confirm(`Remove all transactions from ${acct}? Your original files stay in the Data Library.`)) return;
      await B().clearAccount(bid, acct); App.ui.toast('Removed'); refresh();
    });
    view.querySelectorAll('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); if (App.biz.current() !== 'all') App.biz.setCurrent('all'); App.go(a.dataset.go); });
  }

  App.bankUI = { html, bind };
})(window.App);
