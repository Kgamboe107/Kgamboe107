/* Command Map: how the business runs with AI agents, on one screen.
   Inputs (the systems the business already uses) feed Departments and their Jobs; agents do the work in the Connected
   systems; nothing leaves without a human sign-off (Needs your yes). Also: the Scoreboard, the Agent log and the
   Documented workflows. Tap a department or a job to trace it end to end.
   Saved per unit in settings (so it syncs between the computer and the phone when you're signed in). */
(function (App) {
  const { esc, fmt } = App;
  const KEY = 'cmap';
  const MODES = { agent: 'Agent runs it', assisted: 'Agent drafts, you finish', human: 'You do it' };
  const KINDS = { email: 'Email', calendar: 'Calendar', files: 'Files & docs', money: 'Accounting & banking', crm: 'CRM & leads', chat: 'Team chat', sheet: 'Spreadsheets', phone: 'Phone & texts', web: 'Website & forms', other: 'Other' };
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16'];
  let sel = null;          // { type: 'dept' | 'job' | 'input' | 'conn', id }
  let logFilter = 'morning';
  let root = null;

  /* ---------- data ---------- */
  /* Starter times read like a real morning (6:00–8:00) and are placed just before now, so the sample always looks current */
  const at = (h, m, daysAgo = 0) => Date.now() - ((8 * 60 + 10) - (h * 60 + m)) * 60000 - daysAgo * 864e5;
  function starter() {
    const inputs = [
      ['gmail', 'Gmail', 'email'], ['gcal', 'Google Calendar', 'calendar'], ['drive', 'Google Drive', 'files'], ['qbo', 'QuickBooks', 'money'],
      ['bank', 'Bank & card feeds', 'money'], ['sheets', 'Spreadsheets', 'sheet'], ['site', 'Website contact form', 'web'], ['phone', 'Phone & texts', 'phone']
    ].map(([id, name, kind]) => ({ id, name, kind, note: '' }));
    const conns = [
      ['c-gmail', 'Gmail (drafts only)', 'email', 'on', at(7, 58)], ['c-cal', 'Google Calendar', 'calendar', 'on', at(7, 40)], ['c-qbo', 'QuickBooks', 'money', 'on', at(6, 15)],
      ['c-drive', 'Google Drive', 'files', 'on', at(7, 2)], ['c-slack', 'Slack', 'chat', 'off', null], ['c-crm', 'CRM', 'crm', 'setup', null]
    ].map(([id, name, kind, status, last]) => ({ id, name, kind, status, last }));
    const J = (id, name, mode, hrs, inp, con, wf = '') => ({ id, name, mode, hours: hrs, inputs: inp, conns: con, workflow: wf });
    const depts = [
      { id: 'sales', name: 'Sales', color: COLORS[0], owner: 'You', jobs: [
        J('j-leads', 'Answer new leads within 5 minutes', 'assisted', 3, ['site', 'gmail', 'phone'], ['c-gmail', 'c-crm'], 'wf-lead'),
        J('j-prop', 'Draft proposals', 'assisted', 4, ['drive', 'gmail'], ['c-drive', 'c-gmail'], 'wf-prop'),
        J('j-follow', 'Follow up on quiet deals', 'agent', 2, ['gmail', 'gcal'], ['c-gmail'])] },
      { id: 'fin', name: 'Finance', color: COLORS[1], owner: 'You', jobs: [
        J('j-inv', 'Send invoices and chase late ones', 'assisted', 3, ['qbo', 'gmail'], ['c-qbo', 'c-gmail'], 'wf-inv'),
        J('j-cat', 'Categorize transactions', 'agent', 2.5, ['bank', 'qbo'], ['c-qbo'], 'wf-books'),
        J('j-close', 'Month-end close', 'human', 4, ['qbo', 'sheets'], ['c-qbo'])] },
      { id: 'ops', name: 'Operations', color: COLORS[2], owner: 'You', jobs: [
        J('j-sched', 'Schedule meetings and prep notes', 'agent', 2, ['gcal', 'gmail', 'drive'], ['c-cal', 'c-drive'], 'wf-brief'),
        J('j-inbox', 'Triage the inbox', 'agent', 3, ['gmail'], ['c-gmail'], 'wf-inbox'),
        J('j-vendor', 'Vendor and contract tracking', 'human', 1, ['drive', 'sheets'], ['c-drive'])] },
      { id: 'mkt', name: 'Marketing', color: COLORS[3], owner: 'You', jobs: [
        J('j-post', 'Write the weekly post', 'assisted', 2, ['drive', 'site'], ['c-drive']),
        J('j-review', 'Ask happy clients for reviews', 'agent', 1, ['qbo', 'gmail'], ['c-gmail'])] },
      { id: 'deliv', name: 'Client delivery', color: COLORS[4], owner: 'You', jobs: [
        J('j-status', 'Weekly client status updates', 'assisted', 2.5, ['drive', 'gmail', 'gcal'], ['c-gmail', 'c-drive']),
        J('j-notes', 'Meeting notes and action items', 'agent', 2, ['gcal', 'drive'], ['c-drive', 'c-slack'])] }
    ];
    const workflows = [
      { id: 'wf-lead', name: 'New lead to first reply', dept: 'sales', trigger: 'A form or email from someone new', signoff: true, lastRun: at(7, 31), steps: ['Read the message and look the company up', 'Score the lead (fit, budget, urgency)', 'Draft a reply with two meeting times from the calendar', 'Send to Needs your yes', 'On approval: send it and log the lead in the CRM'] },
      { id: 'wf-prop', name: 'Proposal draft', dept: 'sales', trigger: 'You mark a lead "proposal"', signoff: true, lastRun: at(16, 10, 1), steps: ['Pull the call notes and the closest past proposal', 'Draft scope, timeline and price from the rate card', 'Flag anything unusual (discount, rush, new service)', 'Send to Needs your yes'] },
      { id: 'wf-inv', name: 'Invoice and late-payment chase', dept: 'fin', trigger: 'Every weekday at 6:00', signoff: true, lastRun: at(6, 0), steps: ['List invoices due and overdue in QuickBooks', 'Day 1, 7, 14 reminders drafted in your voice', 'Anything 30+ days late goes to you with a call script', 'Approved reminders are sent from Gmail'] },
      { id: 'wf-books', name: 'Daily bookkeeping', dept: 'fin', trigger: 'Every day at 6:15', signoff: false, lastRun: at(6, 15), steps: ['Pull new bank and card transactions', 'Match receipts from email and Drive', 'Categorize using last month’s rules', 'Anything unsure is left uncategorized and logged'] },
      { id: 'wf-brief', name: 'Morning brief and meeting prep', dept: 'ops', trigger: 'Every weekday at 7:00', signoff: false, lastRun: at(7, 0), steps: ['Read today’s calendar', 'Attach the last email thread and notes for each meeting', 'Write a one-page brief in Drive'] },
      { id: 'wf-inbox', name: 'Inbox triage', dept: 'ops', trigger: 'Every 30 minutes, 7:00–19:00', signoff: true, lastRun: at(7, 58), steps: ['Label: client, lead, money, vendor, newsletter', 'Archive newsletters and receipts (receipts go to bookkeeping)', 'Draft replies to routine questions', 'Drafts wait in Needs your yes; nothing is sent automatically'] }
    ];
    const approvals = [
      { id: 'a1', dept: 'sales', job: 'j-leads', title: 'Reply to Harbor Dental (new lead, scored 8/10)', detail: 'Hi Dana, thanks for reaching out about streamlining front-desk scheduling. I have Thursday 10:00 or Friday 14:00 open for a 30-minute call. Which works better?', created: at(7, 31), status: 'pending' },
      { id: 'a2', dept: 'fin', job: 'j-inv', title: '3 payment reminders ($4,850 total)', detail: 'Northside Bakery, invoice 1042, $1,200, 7 days late\nPeak Fitness, invoice 1039, $2,400, 14 days late\nLark & Co, invoice 1045, $1,250, due today', created: at(6, 4), status: 'pending' },
      { id: 'a3', dept: 'sales', job: 'j-prop', title: 'Proposal: Coastal Realty ops audit, $6,500', detail: 'Scope: 3-week operations audit, agent map, 2 automations built. Flagged: they asked for a 10% discount; the draft holds the price and offers a payment plan instead.', created: at(16, 40, 1), status: 'pending' },
      { id: 'a4', dept: 'ops', job: 'j-inbox', title: '4 routine reply drafts', detail: 'Two scheduling confirmations, one W-9 request, one "where do I send the files?" reply.', created: at(7, 58), status: 'pending' },
      { id: 'a5', dept: 'mkt', job: 'j-review', title: 'Review request to Peak Fitness', detail: 'Held back: Peak Fitness has a late invoice. Suggest waiting until it is paid.', created: at(17, 5, 1), status: 'rejected', decidedAt: at(17, 30, 1) },
      { id: 'a6', dept: 'deliv', job: 'j-status', title: 'Weekly status: Lark & Co', detail: 'Done this week: intake automation live. Next: invoice workflow. Waiting on them: QuickBooks access.', created: at(15, 0, 1), status: 'approved', decidedAt: at(15, 20, 1) }
    ];
    const L = (h, m, dept, job, text, kind = 'done', daysAgo = 0) => ({ id: App.uid(), t: at(h, m, daysAgo), dept, job, text, kind });
    const log = [
      L(6, 0, 'fin', 'j-inv', 'Checked 14 open invoices; 2 overdue, 1 due today. Drafted 3 reminders.', 'waiting'),
      L(6, 15, 'fin', 'j-cat', 'Categorized 27 of 29 transactions. 2 left for you (Amazon $86.40, Venmo $250).', 'flag'),
      L(7, 0, 'ops', 'j-sched', 'Wrote today’s brief: 3 meetings, prep notes attached.'),
      L(7, 31, 'sales', 'j-leads', 'New lead from the website: Harbor Dental. Scored 8/10, reply drafted.', 'waiting'),
      L(7, 40, 'ops', 'j-sched', 'Moved the 11:00 with Lark & Co to 11:30 (their request); invite updated.'),
      L(7, 58, 'ops', 'j-inbox', 'Triaged 41 emails: 18 archived, 6 receipts filed, 4 replies drafted.', 'waiting'),
      L(16, 40, 'sales', 'j-prop', 'Drafted the Coastal Realty proposal; flagged a discount request.', 'waiting', 1),
      L(17, 5, 'mkt', 'j-review', 'Held a review request: client has a late invoice.', 'flag', 1)
    ];
    return { v: 1, sample: true, inputs, conns, depts, workflows, approvals, log };
  }
  const load = () => { let d = App.bsettings.get(KEY, null); if (!d || !d.v) { d = starter(); App.bsettings.set(KEY, d); } return d; };
  const save = d => { App.bsettings.set(KEY, d); pill(d); };
  const jobsOf = d => d.depts.flatMap(dp => dp.jobs.map(j => ({ ...j, dept: dp })));
  const deptOf = (d, id) => d.depts.find(x => x.id === id);
  const jobOf = (d, id) => jobsOf(d).find(j => j.id === id);
  const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const dd = Math.round(h / 24); return dd === 1 ? 'yesterday' : dd + ' days ago'; };
  const clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  /* "Today" is the last 24 hours and "this morning" the last 8, so a late-night check still shows the latest run */
  const isToday = t => t > Date.now() - 24 * 3600e3;
  const isMorning = t => t > Date.now() - 8 * 3600e3;

  function pill(d = App.bsettings.get(KEY, null)) {
    const el = document.getElementById('cmapPill'); if (!el) return;
    const n = App.biz.isMaster() ? 0 : (d?.approvals || []).filter(a => a.status === 'pending').length;
    el.hidden = !n; el.textContent = n; el.title = `${n} waiting for your yes`;
    const tb = document.querySelector('#tabbar [data-tab="command"]');
    if (tb) { tb.dataset.badge = n || ''; }
  }

  /* ---------- scoreboard ---------- */
  function score(d) {
    const jobs = jobsOf(d);
    const agent = jobs.filter(j => j.mode === 'agent'), assisted = jobs.filter(j => j.mode === 'assisted');
    const saved = App.sum(agent.map(j => +j.hours || 0)) + 0.6 * App.sum(assisted.map(j => +j.hours || 0));
    const total = App.sum(jobs.map(j => +j.hours || 0));
    const pending = d.approvals.filter(a => a.status === 'pending');
    const decided = d.approvals.filter(a => a.status !== 'pending' && a.decidedAt > Date.now() - 30 * 864e5);
    const yes = decided.filter(a => a.status === 'approved').length;
    const today = d.log.filter(e => isToday(e.t));
    const flags = today.filter(e => e.kind === 'flag').length;
    const covered = jobs.filter(j => j.workflow && d.workflows.some(w => w.id === j.workflow)).length;
    const live = d.conns.filter(c => c.status === 'on').length;
    const oldest = pending.reduce((m, a) => Math.min(m, a.created), Infinity);
    return { jobs, agent, assisted, saved, total, pending, decided, yes, today, flags, covered, live, oldest };
  }

  /* ---------- tracing ---------- */
  function traced(d) {
    if (!sel) return null;
    const jobs = jobsOf(d);
    let js = [];
    if (sel.type === 'dept') js = jobs.filter(j => j.dept.id === sel.id);
    else if (sel.type === 'job') js = jobs.filter(j => j.id === sel.id);
    else if (sel.type === 'input') js = jobs.filter(j => j.inputs.includes(sel.id));
    else if (sel.type === 'conn') js = jobs.filter(j => j.conns.includes(sel.id));
    return {
      jobs: new Set(js.map(j => j.id)), depts: new Set(js.map(j => j.dept.id)),
      inputs: new Set(sel.type === 'input' ? [sel.id] : js.flatMap(j => j.inputs)),
      conns: new Set(sel.type === 'conn' ? [sel.id] : js.flatMap(j => j.conns)), list: js
    };
  }

  /* ---------- render ---------- */
  function render(view) {
    root = view;
    const d = load();
    if (App.biz.isMaster()) {
      view.innerHTML = App.ui.empty('The Command Map belongs to one business. Pick a business from the switcher at the top of the sidebar to see its map.', '<button class="btn primary" onclick="App.openSwitcher()">Choose a business</button>');
      pill(); return;
    }
    const s = score(d), tr = traced(d);
    const cls = (set, id) => tr ? (set.has(id) ? ' on' : ' dim') : '';
    const kindIco = k => ({ email: '✉', calendar: '◷', files: '▤', money: '$', crm: '◎', chat: '✦', sheet: '▦', phone: '☎', web: '⌘', other: '•' }[k] || '•');

    const head = `<div class="cm-hero card">
      <div><div class="cm-eyebrow">Gamboe Command Map</div>
        <h2 class="cm-title">${s.pending.length ? `${s.pending.length} thing${s.pending.length > 1 ? 's' : ''} need${s.pending.length > 1 ? '' : 's'} your yes` : 'All clear: nothing is waiting on you'}</h2>
        <div class="muted small">${s.today.length} agent action${s.today.length === 1 ? '' : 's'} today · about ${fmt.num(s.saved, 1)} h a week handed off · ${s.live} of ${d.conns.length} systems connected</div></div>
      <div class="row cm-hero-act">${s.pending.length ? '<a class="btn primary" href="#cm-yes" data-jump="cm-yes">Review now</a>' : ''}
        <button class="btn" id="cmMore" aria-haspopup="menu">${App.fx.icon('settings')} Map</button></div>
    </div>
    ${d.sample ? `<div class="card cm-note small"><b>This is a starter map.</b> Edit the departments, jobs, systems and workflows to match how your business really runs. Everything saves on this device and syncs to your phone when you're signed in. <button class="btn small ghost" id="cmKeep">Got it, it's mine now</button></div>` : ''}`;

    const sec = (n, id, title, sub, body, act = '') => `<section class="card cm-sec" id="${id}"><div class="card-head"><div class="cm-sh"><span class="cm-num">${n}</span><div><h2>${title}</h2>${sub ? `<div class="muted tiny">${sub}</div>` : ''}</div></div>${act}</div>${body}</section>`;

    const inputsCol = d.inputs.map(i => `<button class="cm-node cm-in${cls(tr?.inputs || new Set(), i.id)}" data-sel="input:${i.id}" title="${esc(KINDS[i.kind] || '')}"><span class="cm-k">${kindIco(i.kind)}</span><span>${esc(i.name)}</span></button>`).join('');
    const deptCol = d.depts.map(dp => `<div class="cm-dept${cls(tr?.depts || new Set(), dp.id)}" style="--dc:${dp.color}">
        <button class="cm-dname" data-sel="dept:${dp.id}"><span class="cm-dot"></span>${esc(dp.name)}<span class="muted tiny">${dp.jobs.length} job${dp.jobs.length === 1 ? '' : 's'}</span></button>
        ${dp.jobs.map(j => `<button class="cm-node cm-job m-${j.mode}${cls(tr?.jobs || new Set(), j.id)}" data-sel="job:${j.id}" data-job="${j.id}"><span class="cm-mode" title="${MODES[j.mode]}"></span><span>${esc(j.name)}</span>${d.approvals.some(a => a.job === j.id && a.status === 'pending') ? '<span class="cm-wait" title="Waiting for your yes">!</span>' : ''}</button>`).join('')}
        <button class="cm-add tiny" data-edit-dept="${dp.id}">Edit ${esc(dp.name)}</button></div>`).join('');
    const connCol = d.conns.map(c => `<button class="cm-node cm-conn st-${c.status}${cls(tr?.conns || new Set(), c.id)}" data-sel="conn:${c.id}"><span class="cm-k">${kindIco(c.kind)}</span><span>${esc(c.name)}</span><span class="cm-st" title="${c.status === 'on' ? 'Connected' : c.status === 'setup' ? 'Being set up' : 'Off'}"></span></button>`).join('');

    const map = `<div class="cm-legend tiny muted"><span><i class="lg m-agent"></i>Agent runs it</span><span><i class="lg m-assisted"></i>Agent drafts, you finish</span><span><i class="lg m-human"></i>You do it</span>${sel ? '<button class="btn small ghost" id="cmClear">Clear trace</button>' : ''}</div>
      <div class="cm-map" id="cmMap"><svg class="cm-wires" id="cmWires" aria-hidden="true"></svg>
        <div class="cm-col"><div class="cm-colh">Inputs</div>${inputsCol}</div>
        <div class="cm-col cm-mid"><div class="cm-colh">Departments &amp; jobs</div>${deptCol}<button class="btn small" id="cmAddDept">${App.fx.icon('plus')} Add department</button></div>
        <div class="cm-col"><div class="cm-colh">Connected</div>${connCol}</div>
      </div>${trace(d, tr)}`;

    const sb = `<div class="cm-score">
      ${tile('Waiting on you', s.pending.length, s.pending.length ? `oldest ${ago(s.oldest)}` : 'nothing pending', s.pending.length > 3 ? 'warn' : s.pending.length ? '' : 'good', 'cm-yes')}
      ${tile('Time handed off', fmt.num(s.saved, 1) + ' h/wk', s.total ? `${fmt.pct(s.saved / s.total, 0)} of ${fmt.num(s.total, 1)} h mapped` : 'add hours to jobs', 'good')}
      ${tile('Jobs on agents', `${s.agent.length + s.assisted.length}/${s.jobs.length}`, `${s.agent.length} run alone · ${s.assisted.length} drafted for you`)}
      ${tile('Approved (30 days)', s.decided.length ? fmt.pct(s.yes / s.decided.length, 0) : '—', s.decided.length ? `${s.yes} yes · ${s.decided.length - s.yes} no` : 'no decisions yet')}
      ${tile('Actions today', s.today.length, s.flags ? `${s.flags} flagged for you` : 'no flags', s.flags ? 'warn' : '', 'cm-log')}
      ${tile('Workflows written', `${s.covered}/${s.jobs.length}`, 'jobs with a documented workflow', s.covered < s.jobs.length / 2 ? 'warn' : '', 'cm-wf')}
    </div>`;

    const pend = d.approvals.filter(a => a.status === 'pending').sort((a, b) => a.created - b.created);
    const done = d.approvals.filter(a => a.status !== 'pending').sort((a, b) => b.decidedAt - a.decidedAt).slice(0, 5);
    const yes = `${pend.length ? pend.map(a => approvalCard(d, a)).join('') : '<div class="cm-empty">Nothing is waiting. Agents will drop drafts here before anything is sent, paid or published.</div>'}
      ${done.length ? `<details class="cm-done"><summary class="small muted">Recently decided (${done.length})</summary>${done.map(a => `<div class="cm-drow small"><span class="badge ${a.status === 'approved' ? 'good' : 'bad'}">${a.status === 'approved' ? 'Yes' : 'No'}</span><span>${esc(a.title)}</span><span class="muted tiny">${ago(a.decidedAt)}</span></div>`).join('')}</details>` : ''}`;

    const entries = d.log.filter(e => logFilter === 'all' ? true : logFilter === 'today' ? isToday(e.t) : isMorning(e.t))
      .filter(e => !tr || tr.jobs.has(e.job) || (sel.type === 'dept' && e.dept === sel.id)).sort((a, b) => b.t - a.t);
    const logHtml = `<div class="row spread" style="margin-bottom:10px"><div class="seg" role="tablist">${[['morning', 'This morning'], ['today', 'Today'], ['all', 'All']].map(([k, l]) => `<button data-logf="${k}" class="${logFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${tr ? `<span class="badge accent">Traced: ${esc(traceName(d))}</span>` : ''}</div>
      <ol class="cm-log">${entries.map(e => { const dp = deptOf(d, e.dept), j = jobOf(d, e.job); return `<li class="k-${e.kind}" style="--dc:${dp?.color || 'var(--muted)'}"><time>${isToday(e.t) ? clock(e.t) : new Date(e.t).toLocaleDateString([], { weekday: 'short' }) + ' ' + clock(e.t)}</time><div><div>${esc(e.text)}</div><div class="muted tiny">${esc(dp?.name || '')}${j ? ' · ' + esc(j.name) : ''}${e.kind === 'flag' ? ' · <b class="cm-flag">flagged</b>' : e.kind === 'waiting' ? ' · waiting for your yes' : ''}</div></div></li>`; }).join('') || '<li class="cm-empty">Nothing logged here yet.</li>'}</ol>`;

    const wfs = `<div class="cm-wfs">${d.workflows.map(w => { const dp = deptOf(d, w.dept); const users = jobsOf(d).filter(j => j.workflow === w.id); return `<details class="cm-wf" style="--dc:${dp?.color || 'var(--muted)'}" ${sel?.type === 'job' && users.some(u => u.id === sel.id) ? 'open' : ''}>
        <summary><span class="cm-dot"></span><b>${esc(w.name)}</b><span class="muted tiny">${esc(dp?.name || '')} · ran ${ago(w.lastRun)}</span>${w.signoff ? '<span class="badge accent">Sign-off</span>' : ''}</summary>
        <div class="small"><div class="muted tiny">Trigger: ${esc(w.trigger || '—')}</div><ol class="cm-steps">${w.steps.map(st => `<li>${esc(st)}</li>`).join('')}</ol>
        <div class="row"><button class="btn small" data-edit-wf="${w.id}">${App.fx.icon('edit')} Edit</button><button class="btn small ghost" data-run-wf="${w.id}">Log a run</button>${users.length ? `<span class="muted tiny">Used by: ${users.map(u => esc(u.name)).join(', ')}</span>` : ''}</div></div></details>`; }).join('')}</div>`;

    const conn = `<div class="cm-conns">${d.conns.map(c => `<div class="cm-cc st-${c.status}"><div><b>${esc(c.name)}</b><div class="muted tiny">${esc(KINDS[c.kind] || '')} · ${c.status === 'on' ? 'synced ' + ago(c.last) : c.status === 'setup' ? 'being set up' : 'off'}</div></div>
        <select data-cstat="${c.id}" data-native aria-label="Status of ${esc(c.name)}">${[['on', 'On'], ['setup', 'Setting up'], ['off', 'Off']].map(([k, l]) => `<option value="${k}" ${k === c.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}</div>`;

    view.innerHTML = `<div class="cm">${head}
      <div class="cm-grid">
        <div class="cm-main">
          ${sec('01', 'cm-in', 'Inputs', 'everything the business already uses', `<div class="cm-chips">${d.inputs.map(i => `<button class="cm-chip${cls(tr?.inputs || new Set(), i.id)}" data-sel="input:${i.id}"><span class="cm-k">${kindIco(i.kind)}</span>${esc(i.name)}<span class="muted tiny">${jobsOf(d).filter(j => j.inputs.includes(i.id)).length}</span></button>`).join('')}</div>`, `<button class="btn small" data-edit-sys="inputs">${App.fx.icon('edit')} Edit</button>`)}
          ${sec('MAP', 'cm-map-sec', 'Departments', 'tap a department or a job to trace it', map)}
          ${sec('02', 'cm-score', 'Scoreboard', '', sb)}
        </div>
        <div class="cm-side">
          ${sec('03', 'cm-yes', 'Needs your yes', 'nothing leaves without a human sign-off', yes, `<button class="btn small" id="cmAddAsk">${App.fx.icon('plus')} Add</button>`)}
          ${sec('04', 'cm-log', 'Agent log', logFilter === 'morning' ? 'this morning' : logFilter === 'today' ? 'today' : 'everything', logHtml, `<button class="btn small" id="cmAddLog">${App.fx.icon('plus')} Log</button>`)}
        </div>
      </div>
      <div class="grid c2">
        ${sec('05', 'cm-wf', 'Documented workflows', `${d.workflows.length} written · tap one to read the steps`, wfs, `<button class="btn small" data-edit-wf="">${App.fx.icon('plus')} New</button>`)}
        ${sec('06', 'cm-conn', 'Connected', 'where the agents work', conn, `<button class="btn small" data-edit-sys="conns">${App.fx.icon('edit')} Edit</button>`)}
      </div></div>`;
    App.fx.hydrateIcons?.(view);
    wire(view, d);
    requestAnimationFrame(() => wires(d, tr));
    pill(d);
  }
  function tile(label, value, sub, tone = '', jump) {
    return `<div class="cm-tile ${tone}" ${jump ? `data-jump="${jump}" role="button" tabindex="0"` : ''}><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="muted tiny">${sub}</div></div>`;
  }
  function traceName(d) {
    if (!sel) return '';
    if (sel.type === 'dept') return deptOf(d, sel.id)?.name || '';
    if (sel.type === 'job') return jobOf(d, sel.id)?.name || '';
    return (sel.type === 'input' ? d.inputs : d.conns).find(x => x.id === sel.id)?.name || '';
  }
  function trace(d, tr) {
    if (!tr) return '<div class="cm-hint muted small">Tap any department, job, input or system above to light up everything connected to it.</div>';
    const names = (list, set) => list.filter(x => set.has(x.id)).map(x => esc(x.name)).join(', ') || '—';
    const asks = d.approvals.filter(a => a.status === 'pending' && tr.jobs.has(a.job));
    const job = sel.type === 'job' ? jobOf(d, sel.id) : null;
    const wf = job && d.workflows.find(w => w.id === job.workflow);
    return `<div class="cm-trace"><div class="row spread"><b>${esc(traceName(d))}</b>${job ? `<span class="badge">${MODES[job.mode]}${job.hours ? ` · ${fmt.num(+job.hours, 1)} h/wk` : ''}</span>` : `<span class="badge">${tr.list.length} job${tr.list.length === 1 ? '' : 's'}</span>`}</div>
      <div class="cm-flow small"><div><span class="muted tiny">Reads from</span>${names(d.inputs, tr.inputs)}</div><span class="cm-arrow">→</span>
        <div><span class="muted tiny">${job ? 'Job' : 'Jobs'}</span>${tr.list.map(j => esc(j.name)).join(', ') || '—'}</div><span class="cm-arrow">→</span>
        <div><span class="muted tiny">Works in</span>${names(d.conns, tr.conns)}</div></div>
      ${wf ? `<div class="small"><span class="muted tiny">Workflow:</span> ${esc(wf.name)}${wf.signoff ? ' · needs your sign-off' : ''}</div>` : job ? '<div class="small cm-flag">No documented workflow yet. <button class="btn small ghost" data-edit-wf="" data-for-job="' + job.id + '">Write one</button></div>' : ''}
      ${asks.length ? `<div class="small"><b>${asks.length} waiting for your yes:</b> ${asks.map(a => esc(a.title)).join('; ')}</div>` : ''}
      ${job ? `<div class="row"><button class="btn small" data-edit-dept="${job.dept.id}">${App.fx.icon('edit')} Edit job</button></div>` : ''}</div>`;
  }
  function approvalCard(d, a) {
    const dp = deptOf(d, a.dept), j = jobOf(d, a.job);
    return `<article class="cm-ask" style="--dc:${dp?.color || 'var(--accent)'}" data-ask="${a.id}">
      <div class="row spread"><span class="tiny muted"><span class="cm-dot"></span>${esc(dp?.name || 'General')}${j ? ' · ' + esc(j.name) : ''}</span><span class="tiny muted">${ago(a.created)}</span></div>
      <b class="cm-ask-t">${esc(a.title)}</b>
      ${a.detail ? `<div class="cm-ask-d small">${esc(a.detail).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="row cm-ask-act"><button class="btn primary small" data-yes="${a.id}">${App.fx.icon('check')} Yes, send it</button><button class="btn small" data-tweak="${a.id}">Edit first</button><button class="btn small ghost" data-no="${a.id}">No</button></div></article>`;
  }

  /* Wires between the three map columns (wide screens only) */
  function wires(d, tr) {
    const svg = root?.querySelector('#cmWires'), map = root?.querySelector('#cmMap');
    if (!svg || !map) return;
    if (!tr || innerWidth < 900) { svg.innerHTML = ''; return; }
    const box = map.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const pt = (el, side) => { const r = el.getBoundingClientRect(); return [side === 'r' ? r.right - box.left : r.left - box.left, r.top - box.top + r.height / 2]; };
    const curve = ([x1, y1], [x2, y2]) => { const mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; };
    let out = '';
    for (const j of tr.list) {
      const je = map.querySelector(`[data-job="${j.id}"]`); if (!je) continue;
      for (const i of j.inputs) { const ie = map.querySelector(`[data-sel="input:${i}"]`); if (ie && (sel.type !== 'input' || i === sel.id)) out += `<path d="${curve(pt(ie, 'r'), pt(je, 'l'))}" style="stroke:${j.dept.color}"/>`; }
      for (const c of j.conns) { const ce = map.querySelector(`[data-sel="conn:${c}"]`); if (ce && (sel.type !== 'conn' || c === sel.id)) out += `<path d="${curve(pt(je, 'r'), pt(ce, 'l'))}" style="stroke:${j.dept.color}"/>`; }
    }
    svg.innerHTML = out;
  }

  /* ---------- interactions ---------- */
  function wire(view, d) {
    const rerender = () => render(view);
    view.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => {
      const [type, id] = b.dataset.sel.split(':');
      sel = sel && sel.type === type && sel.id === id ? null : { type, id };
      const y = window.scrollY; rerender(); window.scrollTo({ top: y });
      if (sel && innerWidth < 900) view.querySelector('.cm-trace')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    view.querySelector('#cmClear')?.addEventListener('click', () => { sel = null; rerender(); });
    view.querySelectorAll('[data-jump]').forEach(b => { const go = e => { e.preventDefault(); view.querySelector('#' + b.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; b.onclick = go; b.onkeydown = e => { if (e.key === 'Enter') go(e); }; });
    view.querySelectorAll('[data-logf]').forEach(b => b.onclick = () => { logFilter = b.dataset.logf; rerender(); });
    view.querySelector('#cmKeep')?.addEventListener('click', () => { d.sample = false; save(d); rerender(); });
    view.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => decide(d, b.dataset.yes, 'approved', null, rerender));
    view.querySelectorAll('[data-no]').forEach(b => b.onclick = () => decide(d, b.dataset.no, 'rejected', null, rerender));
    view.querySelectorAll('[data-tweak]').forEach(b => b.onclick = () => tweak(d, b.dataset.tweak, rerender));
    view.querySelectorAll('[data-cstat]').forEach(s => s.onchange = () => { const c = d.conns.find(x => x.id === s.dataset.cstat); c.status = s.value; if (s.value === 'on') c.last = Date.now(); save(d); rerender(); });
    view.querySelectorAll('[data-edit-dept]').forEach(b => b.onclick = () => editDept(d, b.dataset.editDept, rerender));
    view.querySelector('#cmAddDept').onclick = () => editDept(d, null, rerender);
    view.querySelectorAll('[data-edit-sys]').forEach(b => b.onclick = () => editSystems(d, b.dataset.editSys, rerender));
    view.querySelectorAll('[data-edit-wf]').forEach(b => b.onclick = () => editWorkflow(d, b.dataset.editWf, rerender, b.dataset.forJob));
    view.querySelectorAll('[data-run-wf]').forEach(b => b.onclick = () => { const w = d.workflows.find(x => x.id === b.dataset.runWf); w.lastRun = Date.now(); const j = jobsOf(d).find(x => x.workflow === w.id); d.log.push({ id: App.uid(), t: Date.now(), dept: w.dept, job: j?.id || '', text: `Ran “${w.name}”.`, kind: 'done' }); save(d); rerender(); App.ui.toast('Run logged'); });
    view.querySelector('#cmAddAsk').onclick = () => newAsk(d, rerender);
    view.querySelector('#cmAddLog').onclick = () => newLog(d, rerender);
    view.querySelector('#cmMore').onclick = () => mapMenu(d, rerender);
  }
  function decide(d, id, status, detail, done) {
    const a = d.approvals.find(x => x.id === id); if (!a) return;
    a.status = status; a.decidedAt = Date.now(); if (detail != null) a.detail = detail;
    d.log.push({ id: App.uid(), t: Date.now(), dept: a.dept, job: a.job, text: `${status === 'approved' ? 'You approved' : 'You declined'}: ${a.title}`, kind: 'done' });
    save(d); App.ui.toast(status === 'approved' ? 'Approved. The agent can go ahead.' : 'Declined. Nothing was sent.'); done();
  }
  const deptOpts = (d, cur) => d.depts.map(x => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const jobOpts = (d, cur) => `<option value="">—</option>` + d.depts.map(dp => `<optgroup label="${esc(dp.name)}">${dp.jobs.map(j => `<option value="${j.id}" ${j.id === cur ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</optgroup>`).join('');
  const deptOfJob = (d, jid) => d.depts.find(dp => dp.jobs.some(j => j.id === jid))?.id;

  function tweak(d, id, done) {
    const a = d.approvals.find(x => x.id === id);
    App.ui.modal(`<div class="row spread"><h2>Edit before it goes</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="muted small">${esc(a.title)}</p><label class="field">What the agent will send<textarea id="cmTw" rows="8">${esc(a.detail || '')}</textarea></label>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="cmTwGo">Approve with my edits</button></div>`, (c, close) => {
      c.querySelector('#cmTwGo').onclick = () => { close(); decide(d, id, 'approved', c.querySelector('#cmTw').value, done); };
    });
  }
  function newAsk(d, done) {
    App.ui.modal(`<div class="row spread"><h2>Add something for sign-off</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="muted small">For drafts an agent made somewhere else (an email, a payment, a post) that you want to approve here.</p>
      <label class="field">What it is<input id="aT" placeholder="e.g. Reply to Harbor Dental"></label>
      <label class="field">Job<select id="aJ" data-native>${jobOpts(d, '')}</select></label>
      <label class="field">Draft / details<textarea id="aD" rows="5"></textarea></label>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="aGo">Add</button></div>`, (c, close) => {
      c.querySelector('#aGo').onclick = () => {
        const title = c.querySelector('#aT').value.trim(); if (!title) return App.ui.toast('Say what it is');
        const job = c.querySelector('#aJ').value;
        d.approvals.push({ id: App.uid(), dept: deptOfJob(d, job) || d.depts[0]?.id, job, title, detail: c.querySelector('#aD').value, created: Date.now(), status: 'pending' });
        save(d); close(); done();
      };
    });
  }
  function newLog(d, done) {
    App.ui.modal(`<div class="row spread"><h2>Add to the agent log</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <label class="field">What happened<input id="lT" placeholder="e.g. Sent 3 invoice reminders"></label>
      <div class="sp-two"><label class="field">Job<select id="lJ" data-native>${jobOpts(d, '')}</select></label>
      <label class="field">Kind<select id="lK" data-native><option value="done">Done</option><option value="waiting">Waiting for you</option><option value="flag">Flag (needs a look)</option></select></label></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="lGo">Add</button></div>`, (c, close) => {
      c.querySelector('#lGo').onclick = () => {
        const text = c.querySelector('#lT').value.trim(); if (!text) return App.ui.toast('Describe what happened');
        const job = c.querySelector('#lJ').value;
        d.log.push({ id: App.uid(), t: Date.now(), dept: deptOfJob(d, job) || '', job, text, kind: c.querySelector('#lK').value });
        save(d); close(); done();
      };
    });
  }

  function editDept(d, id, done) {
    const dp = id ? JSON.parse(JSON.stringify(deptOf(d, id))) : { id: App.uid(), name: '', owner: 'You', color: COLORS[d.depts.length % COLORS.length], jobs: [] };
    const checks = (list, on, name) => list.map(x => `<label class="cm-cb"><input type="checkbox" name="${name}" value="${x.id}" ${on.includes(x.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('');
    const jobRow = j => `<div class="cm-jrow" data-jid="${j.id}">
      <div class="sp-two"><label class="field">Job<input data-f="name" value="${esc(j.name)}" placeholder="e.g. Chase late invoices"></label>
        <label class="field">Who does it<select data-f="mode" data-native>${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${k === j.mode ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="sp-two"><label class="field">Hours a week it takes<input data-f="hours" type="number" step="0.5" min="0" inputmode="decimal" value="${esc(j.hours ?? '')}"></label>
        <label class="field">Workflow<select data-f="workflow" data-native><option value="">None yet</option>${d.workflows.map(w => `<option value="${w.id}" ${w.id === j.workflow ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label></div>
      <div class="muted tiny">Reads from</div><div class="cm-cbs">${checks(d.inputs, j.inputs, 'in-' + j.id)}</div>
      <div class="muted tiny">Works in</div><div class="cm-cbs">${checks(d.conns, j.conns, 'cn-' + j.id)}</div>
      <button class="btn small ghost danger" data-rmjob>Remove job</button></div>`;
    App.ui.modal(`<div class="row spread"><h2>${id ? 'Edit ' + esc(dp.name) : 'New department'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-two"><label class="field">Department<input id="dN" value="${esc(dp.name)}" placeholder="e.g. Finance"></label>
        <label class="field">Owner<input id="dO" value="${esc(dp.owner || '')}"></label></div>
      <div class="row cm-colors">${COLORS.map(c => `<button class="cm-sw ${c === dp.color ? 'on' : ''}" data-col="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
      <h2 style="margin-top:14px">Jobs</h2><div id="dJobs">${dp.jobs.map(jobRow).join('')}</div>
      <button class="btn small" id="dAddJob">${App.fx.icon('plus')} Add job</button>
      <div class="row" style="justify-content:space-between;margin-top:14px">${id ? '<button class="btn danger" id="dDel">Delete department</button>' : '<span></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="dSave">Save</button></div></div>`, (c, close) => {
      c.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { dp.color = b.dataset.col; c.querySelectorAll('[data-col]').forEach(x => x.classList.toggle('on', x === b)); });
      const bindRm = () => c.querySelectorAll('[data-rmjob]').forEach(b => b.onclick = () => b.closest('.cm-jrow').remove());
      bindRm();
      c.querySelector('#dAddJob').onclick = () => { c.querySelector('#dJobs').insertAdjacentHTML('beforeend', jobRow({ id: App.uid(), name: '', mode: 'assisted', hours: '', inputs: [], conns: [], workflow: '' })); bindRm(); c.querySelector('#dJobs').lastElementChild.querySelector('input').focus(); };
      c.querySelector('#dDel')?.addEventListener('click', () => { if (!confirm(`Delete ${dp.name} and its jobs?`)) return; d.depts = d.depts.filter(x => x.id !== id); if (sel) sel = null; save(d); close(); done(); });
      c.querySelector('#dSave').onclick = () => {
        dp.name = c.querySelector('#dN').value.trim(); dp.owner = c.querySelector('#dO').value.trim();
        if (!dp.name) return App.ui.toast('Name the department');
        dp.jobs = [...c.querySelectorAll('.cm-jrow')].map(r => {
          const f = k => r.querySelector(`[data-f="${k}"]`).value, jid = r.dataset.jid;
          return { id: jid, name: f('name').trim(), mode: f('mode'), hours: f('hours') === '' ? '' : +f('hours'), workflow: f('workflow'),
            inputs: [...r.querySelectorAll(`[name="in-${jid}"]:checked`)].map(x => x.value), conns: [...r.querySelectorAll(`[name="cn-${jid}"]:checked`)].map(x => x.value) };
        }).filter(j => j.name);
        const i = d.depts.findIndex(x => x.id === dp.id);
        if (i >= 0) d.depts[i] = dp; else d.depts.push(dp);
        save(d); close(); done();
      };
    });
  }

  function editSystems(d, which, done) {
    const list = JSON.parse(JSON.stringify(d[which]));
    const title = which === 'inputs' ? 'Inputs: what the business already uses' : 'Connected: where the agents work';
    const row = x => `<div class="cm-srow" data-sid="${x.id}"><input data-f="name" value="${esc(x.name)}" placeholder="Name" aria-label="Name"><select data-f="kind" data-native aria-label="Kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === x.kind ? 'selected' : ''}>${v}</option>`).join('')}</select><button class="btn small ghost" data-rm aria-label="Remove">✕</button></div>`;
    App.ui.modal(`<div class="row spread"><h2>${title}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div id="sList">${list.map(row).join('')}</div><button class="btn small" id="sAdd">${App.fx.icon('plus')} Add</button>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="sSave">Save</button></div>`, (c, close) => {
      const bind = () => c.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => b.closest('.cm-srow').remove());
      bind();
      c.querySelector('#sAdd').onclick = () => { c.querySelector('#sList').insertAdjacentHTML('beforeend', row({ id: App.uid(), name: '', kind: 'other' })); bind(); c.querySelector('#sList').lastElementChild.querySelector('input').focus(); };
      c.querySelector('#sSave').onclick = () => {
        const old = Object.fromEntries(d[which].map(x => [x.id, x]));
        d[which] = [...c.querySelectorAll('.cm-srow')].map(r => ({ ...(old[r.dataset.sid] || { status: 'setup', last: null, note: '' }), id: r.dataset.sid, name: r.querySelector('[data-f="name"]').value.trim(), kind: r.querySelector('[data-f="kind"]').value })).filter(x => x.name);
        const keep = new Set(d[which].map(x => x.id)), k = which === 'inputs' ? 'inputs' : 'conns';
        d.depts.forEach(dp => dp.jobs.forEach(j => { j[k] = j[k].filter(id => keep.has(id)); }));
        save(d); close(); done();
      };
    });
  }

  function editWorkflow(d, id, done, forJob) {
    const w = id ? JSON.parse(JSON.stringify(d.workflows.find(x => x.id === id))) : { id: App.uid(), name: forJob ? jobOf(d, forJob)?.name || '' : '', dept: forJob ? deptOfJob(d, forJob) : d.depts[0]?.id, trigger: '', signoff: true, lastRun: null, steps: [] };
    App.ui.modal(`<div class="row spread"><h2>${id ? 'Edit workflow' : 'New workflow'}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <label class="field">Name<input id="wN" value="${esc(w.name)}" placeholder="e.g. Invoice and late-payment chase"></label>
      <div class="sp-two"><label class="field">Department<select id="wD" data-native>${deptOpts(d, w.dept)}</select></label>
        <label class="field">Trigger (when it runs)<input id="wT" value="${esc(w.trigger)}" placeholder="e.g. Every weekday at 6:00"></label></div>
      <label class="field">Steps, one per line<textarea id="wS" rows="7" placeholder="Read the new email&#10;Draft a reply&#10;Send to Needs your yes">${esc(w.steps.join('\n'))}</textarea></label>
      <label class="row small"><input type="checkbox" id="wO" ${w.signoff ? 'checked' : ''}> Needs my sign-off before anything leaves</label>
      <div class="row" style="justify-content:space-between;margin-top:14px">${id ? '<button class="btn danger" id="wDel">Delete</button>' : '<span></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="wGo">Save</button></div></div>`, (c, close) => {
      c.querySelector('#wDel')?.addEventListener('click', () => { if (!confirm('Delete this workflow?')) return; d.workflows = d.workflows.filter(x => x.id !== id); d.depts.forEach(dp => dp.jobs.forEach(j => { if (j.workflow === id) j.workflow = ''; })); save(d); close(); done(); });
      c.querySelector('#wGo').onclick = () => {
        w.name = c.querySelector('#wN').value.trim(); if (!w.name) return App.ui.toast('Name the workflow');
        w.dept = c.querySelector('#wD').value; w.trigger = c.querySelector('#wT').value.trim(); w.signoff = c.querySelector('#wO').checked;
        w.steps = c.querySelector('#wS').value.split('\n').map(s => s.trim()).filter(Boolean);
        const i = d.workflows.findIndex(x => x.id === w.id); if (i >= 0) d.workflows[i] = w; else d.workflows.push(w);
        if (forJob) d.depts.forEach(dp => dp.jobs.forEach(j => { if (j.id === forJob) j.workflow = w.id; }));
        save(d); close(); done();
      };
    });
  }

  function mapMenu(d, done) {
    App.ui.modal(`<div class="row spread"><h2>Command Map</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="muted small">The map is saved for <b>${esc(App.biz.get(App.biz.current())?.name || '')}</b> on this device, and syncs to your other devices when you're signed in (Settings → Account &amp; sync).</p>
      <div class="cm-menu">
        <button class="btn" id="mExp">${App.fx.icon('download')} Export map (JSON)</button>
        <label class="btn">${App.fx.icon('upload')} Import map / agent updates<input type="file" id="mImp" accept=".json,application/json" hidden></label>
        <button class="btn" id="mPrint">${App.fx.icon('printer')} Print / save as PDF</button>
        <button class="btn" id="mClearLog">Clear the agent log</button>
        <button class="btn danger" id="mReset">Start over with the starter map</button>
      </div>
      <p class="muted tiny">Import accepts a whole exported map, or a file with just <code>{"approvals":[…],"log":[…]}</code> so an agent running elsewhere can drop new drafts and log lines in.</p>`, (c, close) => {
      c.querySelector('#mExp').onclick = () => App.download(`command-map-${App.dateKey(new Date())}.json`, JSON.stringify(d, null, 2), 'application/json');
      c.querySelector('#mImp').onchange = async e => {
        try {
          const j = JSON.parse(await e.target.files[0].text());
          if (j.depts && j.inputs) { Object.assign(d, j, { v: 1 }); App.ui.toast('Map imported'); }
          else {
            let n = 0;
            for (const a of j.approvals || []) { d.approvals.push({ id: App.uid(), status: 'pending', created: Date.now(), dept: deptOfJob(d, a.job) || a.dept || d.depts[0]?.id, ...a }); n++; }
            for (const l of j.log || []) { d.log.push({ id: App.uid(), t: Date.now(), kind: 'done', dept: deptOfJob(d, l.job) || l.dept || '', ...l }); n++; }
            App.ui.toast(`Added ${n} item${n === 1 ? '' : 's'}`);
          }
          save(d); close(); done();
        } catch (err) { App.ui.toast('That file isn’t a Command Map: ' + err.message); }
      };
      c.querySelector('#mPrint').onclick = () => { close(); setTimeout(() => window.print(), 100); };
      c.querySelector('#mClearLog').onclick = () => { if (!confirm('Clear every agent log entry?')) return; d.log = []; save(d); close(); done(); };
      c.querySelector('#mReset').onclick = () => { if (!confirm('Replace this map with the starter map? Your changes will be lost (export first if you want a copy).')) return; sel = null; save(starter()); close(); done(); };
    });
  }

  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (App.currentRoute?.() === 'command' && root) { const d = App.bsettings.get(KEY, null); if (d) wires(d, traced(d)); } }, 120); });
  App.bus.on('biz-changed', () => { sel = null; pill(); });
  setTimeout(() => pill(), 0);

  App.commandMap = { pending: () => (App.bsettings.get(KEY, null)?.approvals || []).filter(a => a.status === 'pending').length };
  App.modules.command = { render };
})(window.App);
