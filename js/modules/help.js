/* Help & tutorial: quick start, step-by-step guides, what every page, button and system does,
   keyboard shortcuts, a searchable index and a guided tour. Opened from the ? button in the top bar
   (it jumps to the page you're on), the sidebar, the command palette, or App.help.open(topic). */
(function (App) {
  const { esc } = App;
  const mod = () => (/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl');

  /* ---------- Quick start ---------- */
  const QUICK = [
    ['Sign in (or use this device only)', 'The opening page asks you to sign in. <b>Create an account</b> to keep your data on every device; new accounts are approved by the administrator with a 6-digit code. Choose <b>Use on this device only</b> to stay offline.'],
    ['Set up your units', 'Open <b>Units</b> (Tools). Add a <b>Business</b> unit for each store or company and a <b>Personal</b> unit for your household. Switch between them with the unit card at the top of the sidebar.'],
    ['Upload your reports', 'Click <b>Upload</b> (top right, or drag files anywhere). CrunchTime, Harri, SMG, receipts, bank statements, P&amp;Ls and more are recognized and sent to the right pages automatically.'],
    ['Check the dashboard', '<b>Dashboard</b> shows the numbers that matter for the unit you’re in, with flags for anything off. Click any tile to drill into the details.'],
    ['Pick a reporting period', 'Use the period picker in the top bar (‹ Weekly · Wk of … ›) to look at a day range, week, month, quarter, year or fiscal year. Every analysis page follows it.'],
    ['Set targets and review the week', 'Open <b>Weekly Review</b>, click <b>Set targets</b>, then review the week against them and <b>Print review sheet</b>.'],
    ['Plan pay dates and bills', 'Switch to <b>Everything</b> (unit card → Everything) and open <b>Calendar</b>. Add pay dates and expenses; repeating ones found in your bank statements are suggested for you.'],
    ['Link your phone', 'Settings → <b>Account &amp; sync</b> → scan the QR code with your iPhone, add it to the Home Screen and sign in with the same account. Everything stays in sync.']
  ];

  /* ---------- Step-by-step guides ---------- */
  const GUIDES = [
    { id: 'upload', icon: 'upload', title: 'Upload reports and files', steps: [
      'Pick the unit the files belong to (unit card at the top of the sidebar).',
      'Click <b>Upload</b> in the top bar, press ' + `<kbd>${mod()}</kbd><kbd>U</kbd>`, 'or drag files onto the window. You can select many files at once.',
      'The import summary shows what each file was recognized as and where the numbers went (Operations, Purchases, Marketing…).',
      'Re-uploading the same week replaces those days instead of double counting. A file in the wrong unit can be moved from the import summary or the Data Library.'],
      tip: 'Works with CSV, Excel, PDF, PowerPoint, Word, OFX/QFX/QBO and Markdown. Nothing leaves your device unless you sign in to sync (then it’s encrypted first).' },
    { id: 'receipts', icon: 'receipt', title: 'Log a receipt (purchases & food cost)', steps: [
      'Open <b>Purchases</b>, or press ' + `<kbd>${mod()}</kbd><kbd>E</kbd>.`,
      'Click <b>New receipt</b>: enter vendor, date and lines, or <b>Paste receipt text</b>, or <b>Scan photo with AI</b> (desktop app with an AI connected).',
      'Lines are categorized automatically (food, paper, cleaning, beverage…) and remembered for next time.',
      'Food cost % updates on the dashboard; price jumps (“Cleaning supplies went up 756%”) show under Needs attention.'],
      tip: 'CrunchTime Purchase Journal PDFs are read in bulk: upload them and every receipt is added for you.' },
    { id: 'ops', icon: 'operations', title: 'Track labor, sales and food cost', steps: [
      'Upload your CrunchTime daily sales / Labor Variance and Harri timesheets.',
      'Open <b>Operations</b>. Check the tables it chose under <b>Labor</b> and <b>Sales &amp; cost</b> (open “Column mapping” if a column was guessed wrong).',
      'Set your <b>Targets</b> (labor %, food %, prime cost %, sales per labor hour, overtime %).',
      'Read the KPIs (with change vs the previous period), the chart and the day/week/month detail table. Flags list anything over target.'],
      tip: 'Use the period picker to compare this week with last week instantly.' },
    { id: 'review', icon: 'target', title: 'Set targets and print the weekly review', steps: [
      'Open <b>Weekly Review</b> (Reports) or click <b>Weekly review</b> on the dashboard.',
      'Click <b>Set targets</b>. Enter “at most” / “at least” values and untick metrics you don’t want on the sheet. Save.',
      'Use ‹ › to pick the week. Each metric shows target, this week, last week, change, 4-week average, trend and status.',
      'Type notes and actions for next week, then click <b>Print review sheet</b>. On a roll-up view you get one page per unit.'],
      tip: 'Choose “Microsoft Print to PDF” (Windows) or the share sheet (iPhone) to save it as a PDF.' },
    { id: 'calendar', icon: 'calendar', title: 'Add pay dates and bills to the calendar', steps: [
      'Switch to <b>Everything</b> (unit card → Everything). The Calendar lives there because it covers business and personal together.',
      'Open <b>Calendar</b>. Every upload, receipt, note, score and balance update is already on its date, color-coded by section.',
      'Click <b>+ Pay date</b> or <b>+ Expense</b>. Choose how often it repeats (weekly, every 2 weeks, 1st &amp; 15th, monthly, quarterly, yearly) and the unit.',
      'Check <b>Found in your data</b> for repeating bills and paychecks spotted in your bank statements and add them with one click.'],
      tip: 'Click a legend color to hide a section. The side panel shows money in, money out and the next 30 days.' },
    { id: 'bank', icon: 'wallet', title: 'Bring in bank, card, Cash App and Venmo activity', steps: [
      'Download a statement: Cash App (Activity → Statements → Export CSV), Venmo, PayPal, or your bank / card (CSV or Quicken QFX).',
      'Open <b>Integrations → Banking &amp; payments</b>, choose the unit and drop the files in. Re-importing a month won’t double count.',
      'Transactions feed Financials (daily cash flow), Weekly Review (income, spending, savings rate) and the Calendar. Personal units update Net Worth balances.',
      'Optional live sync (desktop app): connect banks with <b>Plaid</b>, sales with <b>Square</b> (Cash App for Business) and <b>Stripe</b> using your own keys.'],
      tip: 'Transfers between your own accounts (card payments, moving to savings, cash outs) are left out of income and spending.' },
    { id: 'guest', icon: 'marketing', title: 'Record SMG scores and store audits', steps: [
      'Upload SMG Full Scale or Trend exports: they’re routed to the store with the matching store number.',
      'Or open <b>Marketing → Guest scores &amp; audits</b> and enter scores or a store audit by hand (scored against the 7 Principles of Success).',
      'The dashboard shows overall satisfaction vs target and your weakest principle.'],
      tip: 'Set your SMG and audit goals on the same page; they also appear in the Weekly Review.' },
    { id: 'wealth', icon: 'wallet', title: 'Track family net worth', steps: [
      'Switch to a <b>Personal</b> unit. Add family members (Units → Personal → Edit family members).',
      'Open <b>Net Worth</b>. Add accounts and debts, or import a positions export from Schwab, Fidelity, Vanguard, Robinhood, Webull or E*TRADE.',
      'Use <b>Update balances</b> to type every balance on one screen; each update adds a point to the history.',
      'Use the person bar (Family · each person) for individual views; the Personal dashboard shows the whole family.'],
      tip: 'Bank statements and Plaid keep checking, savings and card balances current automatically.' },
    { id: 'tax', icon: 'calc', title: 'Get ready for your CPA', steps: [
      'In a Personal unit, open <b>Taxes &amp; CPA</b> and pick the tax year.',
      'Work through the document checklist (generated from your accounts and units) and attach PDFs as they arrive.',
      'Check contributions against IRS limits, tax-loss candidates and estimated payment dates.',
      'Click <b>CPA packet</b> to download one Excel workbook for your accountant.'],
      tip: 'Business filings (941, sales tax, 1099s, licenses) live in Tax &amp; Compliance for business units.' },
    { id: 'ai', icon: 'sparkles', title: 'Ask the AI about your numbers', steps: [
      'Open <b>Integrations → AI providers</b>. Ollama is free, unlimited and private (runs on your computer); Groq is a free online option.',
      'Open <b>AI Assistant</b> (or press ' + `<kbd>${mod()}</kbd><kbd>/</kbd>`, 'tick the data tables to include and ask, e.g. “Why was labor high last week?”.',
      'Use <b>AI briefing</b> on the dashboard for a quick summary of what needs attention.'],
      tip: 'AI runs in the desktop app. On the phone version, use it on your computer.' },
    { id: 'accounts', icon: 'user', title: 'Approve new people (admin)', steps: [
      'When someone signs up, you get a message when you sign in.',
      'Open <b>Settings → Account &amp; sync</b>. Click <b>Approve</b> next to their name to get a 6-digit verification code.',
      'Copy or share the code with them (text or tell them). They type it on their “Waiting for approval” screen.',
      'Use <b>Decline</b> or <b>Remove access</b> any time.'],
      tip: 'Codes work for 7 days and 5 tries. Each person’s data is encrypted with their own password; you can’t read it.' },
    { id: 'phone', icon: 'download', title: 'Link your iPhone', steps: [
      'On the laptop: Settings → <b>Account &amp; sync</b>. A QR code appears.',
      'Point the iPhone camera at it and tap the link: Safari opens the app with your email filled in.',
      'Tap <b>Share → Add to Home Screen</b>, open the new icon, sign in with the same password.',
      'Your data appears in seconds. Both devices show under <b>Your linked devices</b>.'],
      tip: 'Changes sync within about 30 seconds. Close and reopen the phone app to get new versions.' },
    { id: 'backup', icon: 'lock', title: 'Back up, lock and protect your data', steps: [
      'Settings → <b>Export backup</b> saves everything (files, tables, notes, receipts) to one file. Keep it somewhere safe.',
      'Settings → <b>Security: app lock</b> sets a passcode and auto-lock for personnel files and financials.',
      'Signed in? Your data is also encrypted in the cloud and on every linked device.'],
      tip: 'A forgotten password or passcode can’t be recovered: keep a backup.' }
  ];

  /* ---------- What each page is for ---------- */
  const PAGES = {
    dashboard: { title: 'Dashboard', what: 'Your home screen for the unit you’re in: the headline numbers, flags, data coverage and recent uploads.',
      can: ['KPI tiles (lawsuit protection, audit readiness, food cost, revenue, labor, guest scores, net worth…) colored against your targets; click a tile to drill in', 'Needs attention: everything flagged across pages', 'AI briefing, Weekly review, Edit unit and roll-up dashboard buttons', 'Period badge when a reporting period is picked'] },
    master: { title: 'Business / Personal dashboard & Everything', what: 'Roll-ups across units: all businesses, all personal units (family wealth), or everything together.',
      can: ['Totals and a card per unit', 'Person filter for family views', 'Calendar and Weekly review buttons (Everything shows the Calendar)'] },
    library: { title: 'Data Library', what: 'Every file you’ve uploaded, what it was recognized as and where its data went.',
      can: ['Search, filter by category and source', 'Open the original, view the tables it produced', 'Move a file to another unit or delete it (its numbers are removed too)'] },
    ai: { title: 'AI Assistant', what: 'Chat with an AI about your own data (desktop app).',
      can: ['Pick the AI (Ollama, Groq, Grok, Perplexity) and the depth', 'Include specific data tables', 'Saved conversation threads'] },
    calendar: { title: 'Calendar (Everything view)', what: 'A month view of everything added, color-coded by section, plus pay dates and when expenses come out.',
      can: ['+ Pay date / + Expense, one-off or repeating', 'Suggestions for repeating bills and paychecks found in bank data', 'Month money in / out, next 30 days, legend filters, Business / Personal filter, click a day for details'] },
    wealth: { title: 'Net Worth (personal units)', what: 'Accounts, debts and holdings for your family, with history and tax buckets.',
      can: ['Add accounts, import brokerage positions, update all balances at once', 'Per-person cards and individual views', 'Tax buckets, debts by interest rate, stale-balance warnings'] },
    finance: { title: 'Financials', what: 'P&amp;L trends, margins, budget vs actual and expense mix.',
      can: ['Map your P&amp;L or cash-flow table', 'Revenue, gross profit, expenses, net income with trend charts', 'Expense breakdown from a ledger or bank transactions'] },
    purchases: { title: 'Purchases', what: 'Your purchase journal: every receipt, food cost and vendor price changes.',
      can: ['New receipt, paste receipt text, scan a photo with AI', 'Food cost % vs target for the period', 'Price change alerts, spend by category and vendor'] },
    operations: { title: 'Operations', what: 'Labor and sales: labor %, sales per labor hour, overtime, food and prime cost, schedule variance.',
      can: ['Targets used across the app', 'Comparison with the previous period', 'Daily / weekly / monthly detail by location'] },
    trading: { title: 'Trading Risk', what: 'Positions and trade history: exposure, concentration, P&amp;L, drawdown, win rate and VaR.',
      can: ['Positions tab (Webull, Dub, brokerage exports)', 'Trades tab for realized performance'] },
    marketing: { title: 'Marketing', what: 'Campaign performance plus SMG guest scores and store audits.',
      can: ['Spend, ROAS, CPA by campaign and channel', 'SMG scores, trend, weakest areas', 'Audits scored on the 7 Principles of Success'] },
    research: { title: 'Research', what: 'Notes, questions and findings, including Anara exports and decks.',
      can: ['Create and tag notes, track status', 'Imported decks and documents become notes'] },
    personnel: { title: 'Personnel', what: 'Roster, headcount, turnover, tenure and pay from Harri or your HR export.',
      can: ['Headcount and turnover KPIs', 'Employee table and flags'] },
    review: { title: 'Weekly Review', what: 'Targets for every KPI and a printable one-page weekly sheet per unit.',
      can: ['Set targets (shared with Operations and Marketing)', 'This week vs last week, change, 4-week average, trend, status', 'Wins, misses, alerts, notes and Print review sheet'] },
    tax: { title: 'Taxes & CPA (personal units)', what: 'Organizer for your tax year: documents, contributions, gains and estimated payments.',
      can: ['CPA document checklist', 'Contributions vs IRS limits', 'CPA packet workbook'] },
    compliance: { title: 'Tax & Compliance (business units)', what: 'Business filing deadlines and readiness: payroll forms, sales tax, 1099s, licenses.',
      can: ['Deadline list with status (red count in the sidebar = overdue)', 'Mark filings done, add custom deadlines and licenses', 'Accountant workbook export'] },
    legal: { title: 'Legal & Risk (business units)', what: 'A lawsuit-protection score from a checklist of policies and documents, plus incidents.',
      can: ['Answer the checklist, see high-risk gaps first', 'Generate common documents from your business details', 'Log incidents'] },
    businesses: { title: 'Units', what: 'Your businesses and personal units.',
      can: ['Add, edit, archive units; choose which pages each one uses', 'Family members for personal units'] },
    explorer: { title: 'Data Explorer', what: 'Look inside any table: filter, sort, chart and export.',
      can: ['Pick any table, build a quick chart', 'Edit a table or export it to CSV'] },
    integrations: { title: 'Integrations', what: 'Where data comes in from other systems.',
      can: ['Banking &amp; payments (statements, Plaid, Square, Stripe)', 'Google Drive and Outlook import', 'AI providers', 'Export guides for Harri, CrunchTime, Webull, Dub and Anara'] },
    settings: { title: 'Settings', what: 'Account and sync, backups, security and appearance.',
      can: ['Account &amp; sync: devices, QR code to link your phone, approving accounts (admin)', 'Sample data, backup &amp; restore, app lock', 'Appearance (glass or solid, light or dark), reset'] }
  };

  /* ---------- Buttons & systems ---------- */
  const BUTTONS = [
    ['Unit card (top of sidebar)', 'Switch between units and the Business, Personal and Everything dashboards. The whole app follows the unit you pick.'],
    ['Sidebar sections', 'Analysis, Reports and Tools. Click a section title to fold it; the « button (or ' + mod() + ' \\) shrinks the sidebar to icons.'],
    ['Period picker', '‹ View · period ›. Pick All time, Daily range, Weekly, Monthly, Quarterly, Yearly or Fiscal year, step with ‹ › or [ and ]. Set fiscal year start and week start in its menu.'],
    ['Search or jump to… (' + mod() + ' K)', 'The command palette: go to any page, find files and notes, and run actions like new receipt, toggle theme or open Help.'],
    ['Upload', 'Add files to the unit you’re in. You can also drag files anywhere on the window.'],
    ['? Help', 'Opens this Help Center at the page you’re on.'],
    ['Light / Dark', 'Switch themes at the bottom of the sidebar (' + mod() + ' J).'],
    ['Sync indicator', 'Bottom of the sidebar: “Synced to cloud”, “Syncing…” or “Sync paused”. Without an account it reads “Data stays on this device”.'],
    ['Phone tab bar', 'Home · Plan (Calendar or Weekly Review) · Upload · AI · More (opens the full menu).'],
    ['KPI tiles', 'Green = on target, red = off, amber = close. Click for the details behind the number.'],
    ['Column mapping', 'On analysis pages, shows which column was used for each field; change it if a guess was wrong. Your choice sticks.'],
    ['Needs attention', 'Flags from every page in one list; click to go there.']
  ];
  const SYSTEMS = [
    ['Units', 'Each business or household keeps its own data, targets and settings. Roll-ups combine them.'],
    ['Report reader', 'Recognizes CrunchTime, Harri, SMG, purchase journals, bank statements, decks and PDFs and sends the numbers to the right pages.'],
    ['Reporting periods', 'One period for every analysis page, with sub-period grouping and comparison with the previous period.'],
    ['Targets', 'Set once (Weekly Review or Operations); used for tile colors, flags and the review sheet.'],
    ['Accounts &amp; sync', 'Sign in on any device; data is encrypted on the device and synced automatically. The admin approves new accounts.'],
    ['Phone app', 'Add to the iPhone Home Screen from Safari; works offline and updates itself.'],
    ['Privacy', 'Everything is stored on your device. Synced data is end-to-end encrypted. Backups and the app lock protect it further.']
  ];
  const SHORTCUTS = [[`${mod()} K`, 'Search & commands'], [`${mod()} U`, 'Upload files'], [`${mod()} E`, 'New receipt'], [`${mod()} B`, 'New unit'], [`${mod()} /`, 'AI Assistant'], [`${mod()} J`, 'Light / dark'], [`${mod()} \\`, 'Shrink sidebar'], [`${mod()} Shift L`, 'Lock the app'], ['[ and ]', 'Previous / next period'], ['G then D', 'Go to dashboard'], ['G then L', 'Go to Data Library'], ['?', 'Keyboard shortcuts'], ['Esc', 'Close a window']];

  /* ---------- Guided tour ---------- */
  const TOUR = () => {
    const phone = matchMedia('(max-width: 860px)').matches;
    return [
      { sel: phone ? '#tabbar [data-tab="more"]' : '#wsBtn', title: phone ? 'Menu & units' : 'Your units', body: phone ? 'Tap More for every page and to switch between units and roll-up dashboards.' : 'Switch between businesses, personal units and the Business / Personal / Everything dashboards. Everything you see follows this choice.' },
      { sel: phone ? '#tabbar [data-tab="dashboard"]' : '#nav', title: phone ? 'Home' : 'Pages', body: phone ? 'Your dashboard: headline numbers and flags.' : 'Analysis pages (Financials, Purchases, Operations…), Reports (Weekly Review, taxes, compliance) and Tools. Fold a section by clicking its title.' },
      { sel: '#periodPick:not([hidden])', title: 'Reporting period', body: 'Look at a week, month, quarter, year or a date range. ‹ › steps back and forward; every analysis page follows it.' },
      { sel: phone ? '#tabbar [data-tab="upload"]' : '.topbar label.btn.primary', title: 'Upload', body: 'Drop in reports, receipts, statements and PDFs. They’re read and filed into the right pages automatically.' },
      { sel: phone ? '#tabbar [data-tab="plan"]' : '#cmdkBtn', title: phone ? 'Plan' : 'Search & commands', body: phone ? 'Calendar (in Everything) or your Weekly Review.' : `Jump anywhere or run an action. Shortcut: ${mod()} K.` },
      { sel: '#helpBtn', title: 'Help', body: 'Tap ? any time for help on the page you’re on, step-by-step guides and this tour.' },
      { sel: '#syncDot', title: 'Sync status', body: 'Shows whether your data is synced to your account or stays on this device.' }
    ];
  };
  function tour(i = 0) {
    const steps = TOUR();
    document.querySelector('.tour')?.remove();
    // skip steps whose element isn't on screen
    while (i < steps.length) { const t = document.querySelector(steps[i].sel); const r = t?.getBoundingClientRect(); if (r && r.width && r.height) break; i++; }
    if (i >= steps.length) { App.settings.set('help.toured', true); return; }
    const s = steps[i], t = document.querySelector(s.sel);
    if (/^#nav|#wsBtn|#syncDot/.test(s.sel) && matchMedia('(max-width: 860px)').matches) document.getElementById('sidebar')?.classList.add('open');
    t.scrollIntoView?.({ block: 'nearest' });
    const r = t.getBoundingClientRect(), pad = 6;
    const el = document.createElement('div');
    el.className = 'tour';
    el.innerHTML = `<div class="tour-hole" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${Math.min(r.height, innerHeight - 40) + pad * 2}px"></div>
      <div class="tour-card glass-pop" role="dialog" aria-label="${esc(s.title)}"><div class="muted tiny">Step ${i + 1} of ${steps.length}</div><h3>${esc(s.title)}</h3><p class="small">${s.body}</p>
        <div class="row spread"><button class="btn ghost small" data-tq>Skip tour</button><div class="row">${i ? '<button class="btn small" data-tb>Back</button>' : ''}<button class="btn primary small" data-tn>${i === steps.length - 1 ? 'Done' : 'Next'}</button></div></div></div>`;
    document.body.appendChild(el);
    const card = el.querySelector('.tour-card'), cw = Math.min(320, innerWidth - 24);
    const below = r.bottom + 14 + 170 < innerHeight;
    card.style.width = cw + 'px';
    card.style.left = Math.max(12, Math.min(r.left + r.width / 2 - cw / 2, innerWidth - cw - 12)) + 'px';
    card.style.top = (below ? r.bottom + 14 : Math.max(12, r.top - 14 - card.offsetHeight)) + 'px';
    const end = () => { el.remove(); document.getElementById('sidebar')?.classList.remove('open'); App.settings.set('help.toured', true); };
    el.querySelector('[data-tq]').onclick = end;
    el.querySelector('[data-tn]').onclick = () => { el.remove(); i === steps.length - 1 ? end() : tour(i + 1); };
    el.querySelector('[data-tb]')?.addEventListener('click', () => { el.remove(); tour(i - 1); });
    el.onkeydown = e => { if (e.key === 'Escape') end(); };
    el.querySelector('[data-tn]').focus();
  }

  /* ---------- Page ---------- */
  const card = (id, title, body, extra = '') => `<section class="card help-sec" id="help-${id}" data-text="${esc((title + ' ' + body.replace(/<[^>]+>/g, ' ')).toLowerCase())}">${extra}<h2>${title}</h2>${body}</section>`;
  App.modules.help = {
    async render(view, params = {}) {
      const topic = params.topic && params.topic !== 'help' ? params.topic : '';
      const pageCard = (k, p) => card('page-' + k, p.title, `<p class="small">${p.what}</p><ul class="help-list">${p.can.map(c => `<li>${c}</li>`).join('')}</ul>`,
        k !== 'master' ? `<button class="btn small help-go" data-go="${k}">Open</button>` : '');
      view.innerHTML = `<div class="help-wrap">
        <aside class="help-nav card"><input type="search" id="hSearch" placeholder="Search help…" aria-label="Search help">
          <nav class="stack small">
            <a data-to="quick">Quick start</a><a data-to="tour">Guided tour</a>
            <div class="help-navh">Step-by-step guides</div>${GUIDES.map(g => `<a data-to="g-${g.id}">${esc(g.title)}</a>`).join('')}
            <div class="help-navh">Pages</div>${Object.entries(PAGES).map(([k, p]) => `<a data-to="page-${k}">${esc(p.title.replace(/ \(.*\)$/, ''))}</a>`).join('')}
            <div class="help-navh">Reference</div><a data-to="buttons">Buttons &amp; controls</a><a data-to="systems">How it works</a><a data-to="keys">Keyboard shortcuts</a>
          </nav></aside>
        <div class="help-main stack">
          <div class="card help-hero"><div><h1>Help &amp; tutorial</h1><p class="muted small">Step-by-step guides, what every page and button does, and shortcuts. Press <b>?</b> in the top bar on any page to jump straight to its help.</p></div>
            <div class="row"><button class="btn primary" id="hTour">${App.fx.icon('sparkles')} Take the 1-minute tour</button>${topic && PAGES[topic] ? `<button class="btn" data-to="page-${topic}">Help for ${esc(PAGES[topic].title.replace(/ \(.*\)$/, ''))}</button>` : ''}</div></div>
          ${card('quick', 'Quick start: your first 10 minutes', `<ol class="help-steps">${QUICK.map(([t, b]) => `<li><b>${t}</b><div class="muted small">${b}</div></li>`).join('')}</ol>`)}
          ${card('tour', 'Guided tour', '<p class="small">A short walk-through of the sidebar, period picker, upload, search, help and sync. You can stop it any time.</p><button class="btn small" id="hTour2">Start the tour</button>')}
          <h2 class="help-h">Step-by-step guides</h2>
          <div class="grid c2">${GUIDES.map(g => card('g-' + g.id, `${App.fx.icon(g.icon)} ${esc(g.title)}`, `<ol class="help-steps">${g.steps.map(s => `<li>${s}</li>`).join('')}</ol>${g.tip ? `<div class="help-tip small"><b>Tip:</b> ${g.tip}</div>` : ''}`)).join('')}</div>
          <h2 class="help-h">What each page is for</h2>
          <div class="grid c2">${Object.entries(PAGES).map(([k, p]) => pageCard(k, p)).join('')}</div>
          <h2 class="help-h">Reference</h2>
          ${card('buttons', 'Buttons &amp; controls', `<dl class="help-dl">${BUTTONS.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`)}
          ${card('systems', 'How it works', `<dl class="help-dl">${SYSTEMS.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`)}
          ${card('keys', 'Keyboard shortcuts', `<div class="help-keys">${SHORTCUTS.map(([k, l]) => `<div><span>${l}</span><span>${k.split(' ').map(x => x === 'then' || x === 'and' ? `<span class="muted tiny">${x}</span>` : `<kbd>${esc(x)}</kbd>`).join(' ')}</span></div>`).join('')}</div>`)}
          <div class="card muted small">Still stuck? Settings → Troubleshooting opens the diagnostic log (desktop app), and Settings → Export backup keeps a copy of everything before you try something new.</div>
          <div class="help-empty card muted" hidden>No help topics match your search.</div>
        </div></div>`;
      const jump = id => { const t = view.querySelector('#help-' + id); if (!t) return; t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1600); };
      view.querySelectorAll('[data-to]').forEach(a => a.onclick = e => { e.preventDefault(); const q = view.querySelector('#hSearch'); if (q.value) { q.value = ''; q.dispatchEvent(new Event('input')); } jump(a.dataset.to); });
      view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => App.go(b.dataset.go));
      view.querySelector('#hTour').onclick = view.querySelector('#hTour2').onclick = () => { App.go('dashboard').then(() => setTimeout(() => tour(0), 400)); };
      view.querySelector('#hSearch').oninput = e => {
        const q = e.target.value.trim().toLowerCase();
        let any = false;
        view.querySelectorAll('.help-sec').forEach(s => { const ok = !q || q.split(/\s+/).every(w => s.dataset.text.includes(w)); s.hidden = !ok; any = any || ok; });
        view.querySelectorAll('.help-h').forEach(h => h.hidden = !!q);
        view.querySelector('.help-empty').hidden = any;
      };
      if (topic) setTimeout(() => jump(PAGES[topic] ? 'page-' + topic : topic), 120);
    }
  };

  App.help = { open: topic => App.go('help', { topic: topic || App.currentRoute?.() }), tour, GUIDES, PAGES };
})(window.App);
