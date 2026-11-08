/* Work & Pay (personal units): your paycheck is your "sales", the hours you spend earning it are your "labor hours".
   Headline: pay per labor hour and a target-rate labor % (hours × the rate you want ÷ pay). Supporting: cost to earn %
   (what working costs you ÷ pay) and life share (work hours ÷ waking hours). Burnout flags follow published research:
   WHO/ILO 2021 (≥55 h/week: +35% stroke, +17% heart-disease death vs 35–40 h), EU Working Time Directive (48 h average
   weekly limit, 11 h daily rest, 24 h weekly rest), Whitehall II (>11 h days ≈ 2× major depression), Rogers et al. 2004
   (≥12.5 h shifts ≈ 3× error risk). Plus a 168-hour week of everything else you do. Awareness only, not medical advice. */
(function (App) {
  const { fmt, esc } = App;
  const P = () => App.period;
  const CATS = {
    paid: { label: 'Paid work (W-2)', color: '#4f46e5' }, contract: { label: 'Contract / quick jobs', color: '#65a30d' }, commute: { label: 'Commute', color: '#64748b' },
    volunteer: { label: 'Volunteering', color: '#e11d48' }, caregiving: { label: 'Caregiving & family duties', color: '#d97706' }, household: { label: 'Household & errands', color: '#0891b2' },
    education: { label: 'Learning & school', color: '#7c3aed' }, health: { label: 'Exercise & health', color: '#16a34a' }, sleep: { label: 'Sleep', color: '#1e3a8a' },
    leisure: { label: 'Rest, family & fun', color: '#db2777' }, pto: { label: 'Vacation / PTO', color: '#0d9488' }, other: { label: 'Other', color: '#94a3b8' }
  };
  const COSTS = ['Commute: gas & parking', 'Work meals & coffee', 'Uniforms & gear', 'Childcare', 'Tools & phone', 'Licenses & training', 'Other'];
  const FREQ = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
  const prof = () => ({ payType: 'salary', salary: '', rate: '', freq: 'biweekly', hoursWeek: 40, bonus: '', target: 30, includeCommute: false, payDay: '', employer: '', harriName: '', ...App.bsettings.get('work.profile', {}) });
  const all = async () => (await App.store.all('work').catch(() => [])).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.start || '').localeCompare(a.start || ''));
  const iso = d => P().iso(d), parse = s => P().parse(s);
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const weekOf = s => P().bounds('week', s)[0];
  const hoursOf = r => r.hours !== '' && r.hours != null ? +r.hours : r.start && r.end ? Math.max(0, ((x => (x < 0 ? x + 24 : x))((+r.end.slice(0, 2) + r.end.slice(3) / 60) - (+r.start.slice(0, 2) + r.start.slice(3) / 60)))) - (+r.breakMin || 0) / 60 : 0;
  let view = 'week', anchor = null;

  /* ---------- Numbers for a range ---------- */
  function compute(recs, from, to, pr) {
    const today = P().today();
    if (!from) from = recs.map(r => r.date).filter(Boolean).sort()[0] || today; // "All time"
    if (!to) to = today;
    const inR = r => r.date >= from && r.date <= to;
    const last = to > today && from <= today ? today : to; // a week or month in progress counts only the days so far
    const days = Math.max(1, Math.round((parse(last) - parse(from)) / 864e5) + 1), weeks = days / 7;
    const shifts = recs.filter(r => r.kind === 'shift' && inR(r));
    const times = recs.filter(r => r.kind === 'time' && inR(r));
    const commute = App.sum(times.filter(t => t.cat === 'commute').map(t => +t.hours || 0));
    const workHrs = App.sum(shifts.map(hoursOf));
    const laborHrs = workHrs + (pr.includeCommute ? commute : 0);
    // Each regular paycheck covers the pay period ending on its date, so a biweekly check is spread over its 2 weeks;
    // bonuses count on the day paid. Days no paycheck covers are estimated from the salary or hourly rate.
    const span = Math.round(364 / (FREQ[pr.freq] || 26));
    const allPays = recs.filter(r => r.kind === 'pay');
    const pays = allPays.filter(r => r.date >= addDays(from, 0) && r.date <= addDays(to, span - 1));
    const covered = new Set();
    let pay = 0;
    for (const p of pays) {
      if (p.bonus) { if (inR(p)) pay += +p.gross || 0; continue; }
      const ps = addDays(p.date, -(span - 1));
      const a = ps > from ? ps : from, z = p.date < last ? p.date : last;
      if (a > z) continue;
      const n = Math.round((parse(z) - parse(a)) / 864e5) + 1;
      pay += (+p.gross || 0) * n / span;
      for (let d = a; d <= z; d = addDays(d, 1)) covered.add(d);
    }
    let est = 0;
    if (covered.size < days) {
      const open = d => d >= from && d <= last && !covered.has(d);
      if (pr.payType === 'salary' && +pr.salary) est = +pr.salary / 365 * (days - covered.size);
      else if (pr.payType === 'hourly' && +pr.rate) {
        // weekly overtime at 1.5× over 40 hours
        const byW = {}; shifts.filter(s => open(s.date)).forEach(s => byW[weekOf(s.date)] = (byW[weekOf(s.date)] || 0) + hoursOf(s));
        est = App.sum(Object.values(byW).map(h => Math.min(h, 40) * pr.rate + Math.max(0, h - 40) * pr.rate * 1.5));
      }
    }
    pay += est;
    const payFrom = covered.size && est ? 'paychecks + estimate' : covered.size || pays.some(p => p.bonus && inR(p)) ? 'paychecks' : est ? `estimated from ${pr.payType === 'salary' ? 'salary' : 'hourly rate'}` : '';
    const costs = App.sum(recs.filter(r => r.kind === 'cost' && inR(r)).map(r => +r.amount || 0));
    const sleep = App.sum(times.filter(t => t.cat === 'sleep').map(t => +t.hours || 0));
    const waking = (sleep ? 168 * weeks - sleep : 112 * weeks);
    return { from, to, days, weeks, shifts, pays, pay, payFrom, workHrs, laborHrs, commute, costs, times,
      perHour: laborHrs ? pay / laborHrs : NaN, laborPct: pay && laborHrs ? laborHrs * (+pr.target || 0) / pay : NaN, costPct: pay && (laborHrs || costs) ? costs / pay : NaN, lifeShare: waking ? (workHrs + App.sum(times.filter(t => t.cat === 'contract').map(t => +t.hours || 0))) / waking : NaN };
  }

  /* ---------- Burnout flags ---------- */
  function flags(recs, to) {
    const out = [];
    const shifts = recs.filter(r => r.kind === 'shift' && r.date <= to).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
    const wk = s => App.sum(shifts.filter(r => r.date >= s && r.date <= addDays(s, 6)).map(hoursOf));
    const w0 = weekOf(to), weeks = [0, 1, 2, 3].map(i => addDays(w0, -7 * i)).map(s => ({ s, h: wk(s) }));
    const logged = weeks.filter(w => w.h > 0);
    const avg = logged.length ? App.sum(logged.map(w => w.h)) / logged.length : 0;
    const add = (sev, title, why) => out.push({ sev, title, why });
    if (avg >= 55) add('bad', `Averaging ${avg.toFixed(1)} hours a week`, 'WHO/ILO (2021): 55+ hours a week is linked to a 35% higher risk of stroke and 17% higher risk of dying from heart disease compared with 35–40 hours.');
    else if (avg >= 48) add('warn', `Averaging ${avg.toFixed(1)} hours a week`, 'Over the 48-hour average weekly limit set by the EU Working Time Directive. 55+ hours is where WHO/ILO found serious heart and stroke risk.');
    const wkAmber = weeks.filter(w => w.h >= 48).length;
    if (wkAmber >= 3 && avg < 55) out[out.length - 1] = { sev: 'bad', title: `${wkAmber} of the last 4 weeks over 48 hours`, why: 'Sustained long weeks matter more than a single heavy week; recovery time is being squeezed week after week.' };
    // Long days (this week)
    const thisW = shifts.filter(r => r.date >= w0 && r.date <= addDays(w0, 6));
    const byDay = {}; thisW.forEach(r => byDay[r.date] = (byDay[r.date] || 0) + hoursOf(r));
    const longD = Object.values(byDay).filter(h => h > 11).length, vLong = Object.entries(byDay).filter(([, h]) => h >= 12.5);
    if (vLong.length) add('bad', `${vLong.length} shift${vLong.length > 1 ? 's' : ''} of 12.5+ hours this week`, 'Rogers et al. (2004): shifts of 12.5 hours or more carried about 3× the risk of errors.');
    else if (longD >= 2) add('warn', `${longD} days over 11 hours this week`, 'Whitehall II (Virtanen et al.): regularly working more than 11 hours a day was linked to roughly twice the odds of a major depressive episode.');
    // Rest between shifts (last 14 days)
    let shortRest = 0, veryShort = 0;
    const timed = shifts.filter(r => r.start && r.end && r.date >= addDays(to, -13));
    for (let i = 1; i < timed.length; i++) {
      const a = timed[i - 1], b = timed[i];
      const endA = parse(a.date).getTime() + (+a.end.slice(0, 2) * 60 + +a.end.slice(3)) * 6e4 + (a.end < a.start ? 864e5 : 0);
      const startB = parse(b.date).getTime() + (+b.start.slice(0, 2) * 60 + +b.start.slice(3)) * 6e4;
      const gap = (startB - endA) / 36e5;
      if (gap >= 0 && gap < 8) veryShort++; else if (gap >= 0 && gap < 11) shortRest++;
    }
    if (veryShort) add('bad', `${veryShort} turnaround${veryShort > 1 ? 's' : ''} under 8 hours between shifts`, 'The EU minimum is 11 consecutive hours of rest in every 24; under 8 leaves little room for 7+ hours of sleep.');
    else if (shortRest) add('warn', `${shortRest} turnaround${shortRest > 1 ? 's' : ''} under 11 hours between shifts`, 'The EU Working Time Directive sets 11 consecutive hours of daily rest as the minimum.');
    // Days in a row worked
    const daysWorked = new Set(shifts.map(r => r.date));
    let run = 0; for (let d = to; daysWorked.has(d); d = addDays(d, -1)) run++;
    let best = 0, cur = 0; [...daysWorked].sort().forEach((d, i, a) => { cur = i && addDays(a[i - 1], 1) === d ? cur + 1 : 1; if (d >= addDays(to, -27)) best = Math.max(best, cur); });
    const streak = Math.max(run, best);
    if (streak >= 12) add('bad', `${streak} days in a row without a day off`, 'Weekly rest of at least 24 hours (one full day off) is the minimum in the EU Working Time Directive.');
    else if (streak >= 7) add('warn', `${streak} days in a row without a day off`, 'At least one full day off (24 hours) every week is the recommended minimum.');
    // Vacation
    const first = shifts[0]?.date;
    const pto = recs.filter(r => r.kind === 'time' && r.cat === 'pto' && r.date >= addDays(to, -182));
    if (first && first <= addDays(to, -182) && !pto.length) add('warn', 'No vacation logged in 6 months', 'Recovery research consistently links regular time off with lower exhaustion. Log PTO under Other time.');
    // Monthly check-in
    const ci = App.bsettings.get('work.checkin', {})[to.slice(0, 7)];
    if (ci && (ci.exhausted >= 4 || ci.detached >= 4)) add('warn', 'Your check-in shows signs of burnout', 'Feeling exhausted or detached from work “often” or “always” are two core burnout signs in the WHO (ICD-11) definition.');
    const level = out.some(f => f.sev === 'bad') ? 'red' : out.length ? 'amber' : logged.length ? 'green' : 'none';
    return { level, list: out, avg, weeks };
  }

  /* ---------- Entry forms ---------- */
  function form(kind, rec, file, onSaved) {
    const r = { id: App.uid(), kind, date: P().today(), ...rec };
    const pr = prof();
    const title = { shift: 'Log hours worked', pay: 'Paycheck', cost: 'Cost of working', time: 'Other time this week' }[kind];
    const body = kind === 'shift' ? `
        <div class="sp-two"><label class="field">Date<input id="kDate" type="date" value="${esc(r.date)}"></label><label class="field">Hours (or use start / end)<input id="kHrs" type="number" step="0.25" inputmode="decimal" value="${esc(r.hours ?? '')}"></label></div>
        <div class="sp-two"><label class="field">Start<input id="kStart" type="time" value="${esc(r.start || '')}"></label><label class="field">End<input id="kEnd" type="time" value="${esc(r.end || '')}"></label></div>
        <div class="sp-two"><label class="field">Unpaid break (minutes)<input id="kBreak" type="number" step="5" value="${esc(r.breakMin ?? '')}"></label><label class="field">Type<select id="kType"><option value="scheduled" ${r.type !== 'unpaid' ? 'selected' : ''}>Paid shift</option><option value="unpaid" ${r.type === 'unpaid' ? 'selected' : ''}>Unpaid work (after-hours email, prep, training)</option></select></label></div>
        <div class="muted tiny">Start and end times power the long-day and rest-between-shifts checks.</div>`
      : kind === 'pay' ? `
        <div class="sp-two"><label class="field">Pay date<input id="kDate" type="date" value="${esc(r.date)}"></label><label class="field">Gross pay ($)<input id="kGross" type="number" step="0.01" inputmode="decimal" value="${esc(r.gross ?? '')}"></label></div>
        <div class="sp-two"><label class="field">Take-home / net ($)<input id="kNet" type="number" step="0.01" inputmode="decimal" value="${esc(r.net ?? '')}"></label><label class="field">Hours on the stub<input id="kHrs" type="number" step="0.25" value="${esc(r.hours ?? '')}"></label></div>
        <label class="row small gv-check"><input type="checkbox" id="kBonus" ${r.bonus ? 'checked' : ''}> This is a bonus</label>`
      : kind === 'cost' ? `
        <div class="sp-two"><label class="field">Date<input id="kDate" type="date" value="${esc(r.date)}"></label><label class="field">Amount ($)<input id="kAmt" type="number" step="0.01" inputmode="decimal" value="${esc(r.amount ?? '')}"></label></div>
        <label class="field">What for<select id="kCat">${COSTS.map(c => `<option ${c === r.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>`
      : `
        <div class="sp-two"><label class="field">Week of / date<input id="kDate" type="date" value="${esc(r.date)}"></label><label class="field">Hours<input id="kHrs" type="number" step="0.25" inputmode="decimal" value="${esc(r.hours ?? '')}"></label></div>
        <label class="field">How you spent it<select id="kCat">${Object.entries(CATS).filter(([k]) => k !== 'paid').map(([k, v]) => `<option value="${k}" ${k === r.cat ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <div class="muted tiny">For time that doesn’t come with a paycheck: quick contract jobs, volunteering, caregiving, school, chores, commute, sleep, rest. One entry can cover a whole week (e.g. 6 hours of volunteering).</div>`;
    App.ui.modal(`<div class="row spread"><h2>${rec?.id ? 'Edit' : ''} ${title}</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="sp-edit">${kind === 'pay' ? `<div class="sp-img">${file && /^image\//.test(file.type) ? `<img src="${URL.createObjectURL(file)}" alt="Paystub">` : `<div class="sp-noimg">${file || r.attachment ? '📄 paystub attached' : 'Paystub (optional)'}</div>`}<div class="sp-read muted tiny" id="kRead"></div><label class="btn small">Attach paystub<input type="file" id="kAtt" accept="image/*,application/pdf,.pdf" hidden></label></div>` : ''}
      <div class="sp-form">${body}<label class="field">Note<input id="kNote" value="${esc(r.note || '')}"></label></div></div>
      <div class="row" style="justify-content:space-between;margin-top:14px">${rec?.id ? '<button class="btn danger" id="kDel">Delete</button>' : '<span></span>'}<div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="kSave">Save</button></div></div>`, (c, close) => {
      const $ = s => c.querySelector(s);
      if (kind !== 'pay') c.querySelector('.sp-edit').style.gridTemplateColumns = '1fr';
      const readStub = f => App.spending.readFile(f).then(({ text }) => {
        const num = re => { const m = text.match(re); return m ? +m[1].replace(/,/g, '') : NaN; };
        const gross = num(/gross(?: pay| earnings)?[^\d$]*\$?\s?([\d,]+\.\d{2})/i), net = num(/net(?: pay| amount)?[^\d$]*\$?\s?([\d,]+\.\d{2})/i), hrs = num(/(?:total )?hours[^\d]*([\d.]+)\b/i);
        if (Number.isFinite(gross) && !$('#kGross').value) $('#kGross').value = gross.toFixed(2);
        if (Number.isFinite(net) && !$('#kNet').value) $('#kNet').value = net.toFixed(2);
        if (Number.isFinite(hrs) && hrs < 200 && !$('#kHrs').value) $('#kHrs').value = hrs;
        const d = App.spending.parseText(text).date; if (d) $('#kDate').value = d;
        $('#kRead').textContent = 'Filled in what could be read from the paystub. Check it, then save.';
      }).catch(() => { $('#kRead').textContent = 'Couldn’t read it; type the amounts.'; });
      if (kind === 'pay' && file) readStub(file);
      $('#kAtt')?.addEventListener('change', async e => { file = await App.spending.shrink(e.target.files[0]); if (file) { if (/^image\//.test(file.type)) c.querySelector('.sp-img').firstElementChild.outerHTML = `<img src="${URL.createObjectURL(file)}" alt="Paystub">`; readStub(file); } });
      $('#kSave').onclick = async () => {
        const v = id => $(id)?.value ?? '';
        const out = { ...r, businessId: rec?.businessId || App.biz.target(), date: v('#kDate') || P().today(), note: v('#kNote').trim(), updated: Date.now(), createdAt: r.createdAt || Date.now() };
        if (kind === 'shift') { Object.assign(out, { hours: v('#kHrs') === '' ? '' : +v('#kHrs'), start: v('#kStart'), end: v('#kEnd'), breakMin: v('#kBreak') === '' ? '' : +v('#kBreak'), type: v('#kType') }); if (!hoursOf(out)) { App.ui.toast('Enter hours, or a start and end time'); return; } }
        if (kind === 'pay') { if (!Number.isFinite(parseFloat(v('#kGross')))) { App.ui.toast('Enter the gross pay'); return; } Object.assign(out, { gross: +v('#kGross'), net: v('#kNet') === '' ? '' : +v('#kNet'), hours: v('#kHrs') === '' ? '' : +v('#kHrs'), bonus: $('#kBonus').checked }); if (file) out.attachment = { name: file.name || 'paystub', type: file.type, blob: file }; }
        if (kind === 'cost') { if (!Number.isFinite(parseFloat(v('#kAmt')))) { App.ui.toast('Enter the amount'); return; } Object.assign(out, { amount: +v('#kAmt'), category: v('#kCat') }); }
        if (kind === 'time') { if (!Number.isFinite(parseFloat(v('#kHrs')))) { App.ui.toast('Enter the hours'); return; } Object.assign(out, { hours: +v('#kHrs'), cat: v('#kCat') }); }
        await App.store.put('work', out); close(); App.ui.toast('Saved'); onSaved?.();
      };
      $('#kDel')?.addEventListener('click', async () => { await App.store.del('work', r.id); close(); onSaved?.(); });
    });
  }

  function setup(onSaved) {
    const p = prof();
    App.ui.modal(`<div class="row spread"><h2>Your job &amp; targets</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <div class="cal-form">
        <label class="field">Employer<input id="pEmp" value="${esc(p.employer)}" placeholder="e.g. Jersey Mike's"></label>
        <label class="field">Pay type<select id="pType"><option value="salary" ${p.payType === 'salary' ? 'selected' : ''}>Salary</option><option value="hourly" ${p.payType === 'hourly' ? 'selected' : ''}>Hourly (overtime over 40 h)</option></select></label>
        <label class="field" id="pSalL">Yearly salary ($)<input id="pSal" type="number" step="100" value="${esc(p.salary)}"></label>
        <label class="field" id="pRateL">Hourly rate ($)<input id="pRate" type="number" step="0.01" value="${esc(p.rate)}"></label>
        <label class="field">Paid<select id="pFreq">${Object.keys(FREQ).map(f => `<option value="${f}" ${f === p.freq ? 'selected' : ''}>${{ weekly: 'Every week', biweekly: 'Every 2 weeks', semimonthly: 'Twice a month', monthly: 'Monthly' }[f]}</option>`).join('')}</select></label>
        <label class="field">A recent pay date (for the Calendar)<input id="pDay" type="date" value="${esc(p.payDay)}"></label>
        <label class="field">Usual hours a week<input id="pHw" type="number" step="0.5" value="${esc(p.hoursWeek)}"></label>
        <label class="field">Possible yearly bonus ($)<input id="pBonus" type="number" step="100" value="${esc(p.bonus)}"></label>
        <label class="field">Target hourly rate for “labor %” ($)<input id="pTarget" type="number" step="0.5" value="${esc(p.target)}"></label>
        <label class="field">Your name in Harri timesheets (optional)<input id="pHarri" value="${esc(p.harriName)}" placeholder="as it appears in the Employee column"></label>
        <label class="row small gv-check cal-wide"><input type="checkbox" id="pCom" ${p.includeCommute ? 'checked' : ''}> Count commute time as labor hours</label>
      </div>
      <div class="muted tiny" style="margin-top:8px">Labor % = your labor hours × target rate ÷ pay. Under 100% means you’re paid more than your target for your time; over 100% means less.</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="pSave">Save</button></div>`, (c, close) => {
      const $ = s => c.querySelector(s);
      const show = () => { $('#pSalL').hidden = $('#pType').value !== 'salary'; $('#pRateL').hidden = $('#pType').value !== 'hourly'; };
      $('#pType').onchange = show; show();
      $('#pSave').onclick = () => {
        const n = id => $(id).value === '' ? '' : +$(id).value;
        const np = { employer: $('#pEmp').value.trim(), payType: $('#pType').value, salary: n('#pSal'), rate: n('#pRate'), freq: $('#pFreq').value, payDay: $('#pDay').value, hoursWeek: n('#pHw') || 40, bonus: n('#pBonus'), target: n('#pTarget') || 30, harriName: $('#pHarri').value.trim(), includeCommute: $('#pCom').checked };
        App.bsettings.set('work.profile', np);
        // Pay dates on the Calendar
        if (np.payDay) {
          const per = np.payType === 'salary' && np.salary ? np.salary / FREQ[np.freq] : np.rate ? np.rate * np.hoursWeek * 52 / FREQ[np.freq] : null;
          const id = 'work-pay-' + App.biz.current();
          const item = { id, type: 'pay', title: `Paycheck${np.employer ? ' · ' + np.employer : ''}`, amount: per ? Math.round(per * 100) / 100 : null, start: np.payDay, freq: { weekly: 'weekly', biweekly: 'biweekly', semimonthly: 'semimonthly', monthly: 'monthly' }[np.freq], until: '', unit: App.biz.current(), note: 'from Work & Pay (gross)' };
          App.settings.set('calendar.items', (App.settings.get('calendar.items', []) || []).filter(i => i.id !== id).concat(item));
        }
        close(); App.ui.toast('Saved'); onSaved?.();
      };
    });
  }

  /* Pull your own shifts from Harri timesheet tables already in the app */
  async function importHarri(onSaved) {
    const p = prof();
    const ds = (await App.store.all('datasets', { raw: true })).filter(d => d.source === 'harri' || /harri|timesheet/i.test(d.name || ''));
    const nameCol = d => d.headers.find(h => /^(employee|employee name|name|team member)$/i.test(h)) || d.headers.find(h => /employee|name/i.test(h) && !/id/i.test(h));
    const names = [...new Set(ds.flatMap(d => { const c = nameCol(d); return c ? d.rows.map(r => String(r[c] || '').trim()).filter(Boolean) : []; }))].sort();
    if (!names.length) { App.ui.toast('No Harri timesheets found. Upload one first (Data Library or Upload).', 5000); return; }
    App.ui.modal(`<div class="row spread"><h2>Import your hours from Harri</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
      <p class="muted small">Pick your name. Your shifts from every Harri timesheet in the app are added (re-importing doesn’t duplicate).</p>
      <label class="field">You are<select id="hName">${names.map(n => `<option ${n === p.harriName ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="hGo">Import</button></div>`, (c, close) => {
      c.querySelector('#hGo').onclick = async () => {
        const who = c.querySelector('#hName').value; let n = 0;
        for (const d of ds) {
          const nc = nameCol(d), dc = d.headers.find(h => /^(date|business date|shift date|work date)$/i.test(h)) || d.headers.find(h => /date/i.test(h));
          const hc = d.headers.find(h => /^(total hours|actual hours|hours worked|hours|paid hours)$/i.test(h)) || d.headers.find(h => /hours/i.test(h) && !/sched|overtime|ot\b/i.test(h));
          const ci = d.headers.find(h => /clock in|time in|start/i.test(h)), co = d.headers.find(h => /clock out|time out|end/i.test(h));
          if (!nc || !dc) continue;
          for (const r of d.rows.filter(r => String(r[nc] || '').trim() === who)) {
            const date = App.dateKey(r[dc]); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
            const t = v => { const m = String(v || '').match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i); if (!m) return ''; let h = +m[1]; if (m[3]) { if (/pm/i.test(m[3]) && h < 12) h += 12; if (/am/i.test(m[3]) && h === 12) h = 0; } return `${String(h).padStart(2, '0')}:${m[2]}`; };
            const id = `harri-${date}-${t(r[ci]) || App.num(r[hc])}`;
            await App.store.put('work', { id, kind: 'shift', businessId: App.biz.current(), date, hours: hc ? (App.num(r[hc]) || '') : '', start: ci ? t(r[ci]) : '', end: co ? t(r[co]) : '', type: 'scheduled', source: 'harri', note: 'from Harri', createdAt: Date.now() });
            n++;
          }
        }
        App.bsettings.set('work.profile', { ...prof(), harriName: who });
        close(); App.ui.toast(`Imported ${n} shifts from Harri`); onSaved?.();
      };
    });
  }

  /* ---------- Page ---------- */
  App.modules.work = {
    compute, flags, CATS,
    async render(el) {
      const pr = prof(), recs = await all(), t = P().today();
      const per = P().active() ? P().range() : null;
      anchor = anchor || t;
      const [from, to] = per ? [per.from, per.to] : view === 'week' ? P().bounds('week', anchor) : view === 'month' ? P().bounds('month', anchor) : P().bounds('year', anchor);
      const label = per ? per.label : P().labelOf(view, from, to);
      const x = compute(recs, from, to, pr), fl = flags(recs, to < t ? to : t);
      const allPaysCount = recs.filter(r => r.kind === 'pay').length;
      App.ui.publish('work', { pay: x.pay, hours: x.laborHrs, perHour: x.perHour, laborPct: x.laborPct, costPct: x.costPct, lifeShare: x.lifeShare, burnout: fl.level, avgWeek: fl.avg, label });
      // 168-hour week (average week in the range)
      const per168 = {}; const wks = Math.max(1, x.weeks);
      per168.paid = x.workHrs / wks;
      for (const tm of x.times) per168[tm.cat] = (per168[tm.cat] || 0) + (+tm.hours || 0) / wks;
      const sleepAssumed = !per168.sleep; if (sleepAssumed) per168.sleep = 0;
      const accounted = App.sum(Object.values(per168)), left = Math.max(0, 168 - accounted);
      const bars = Object.entries(per168).filter(([, h]) => h > 0).sort((a, b) => b[1] - a[1]);
      const lvl = { red: ['bad', 'Burnout risk: high'], amber: ['warn', 'Burnout risk: watch'], green: ['good', 'Burnout risk: low'], none: ['', 'Log your hours to see burnout checks'] }[fl.level];
      const hist = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const s = addDays(weekOf(to < t ? to : t), -7 * i); const y = compute(recs, s, addDays(s, 6), pr); return { s, ...y }; }).reverse();
      el.innerHTML = `<div class="card sp-hero"><div><h2>Work &amp; Pay</h2><div class="muted small">Your paycheck is your sales and your hours are your labor. See what you earn per hour you put in, what working costs you, and how your 168 hours a week are spent.${pr.employer ? ` · ${esc(pr.employer)}` : ''}</div></div>
          <div class="sp-actions wk-actions"><button class="btn primary" id="kShift">${App.fx.icon('plus')} Log hours</button><label class="btn">Snap paystub<input type="file" id="kStub" accept="image/*,application/pdf,.pdf" hidden></label><button class="btn" id="kPay">${App.fx.icon('plus')} Paycheck</button><button class="btn" id="kCost">${App.fx.icon('plus')} Work cost</button><button class="btn" id="kTime">${App.fx.icon('plus')} Other time</button>
            <button class="btn ghost" id="kHarri">Import from Harri</button><button class="btn ghost" id="kSetup">${App.fx.icon('settings')} Job &amp; targets</button></div></div>
        <div class="card sp-bar"><div class="row">${per ? `<b>${esc(label)}</b><span class="muted small">(reporting period)</span>` : `<div class="seg">${['week', 'month', 'year'].map(v => `<button data-wv="${v}" class="${v === view ? 'on' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div><button class="btn small" id="kPrev" aria-label="Previous">‹</button><b class="sp-month" style="min-width:200px">${esc(label)}</b><button class="btn small" id="kNext" aria-label="Next" ${to >= t ? 'disabled' : ''}>›</button>`}</div>
          ${!pr.salary && !pr.rate && !allPaysCount ? '<button class="btn small primary" id="kSetup2">Set up your job first</button>' : `<span class="muted tiny">Pay ${esc(x.payFrom || 'none yet')}</span>`}</div>
        <div class="card wk-burn ${lvl[0]}"><div class="row spread"><b>${lvl[1]}</b>${fl.avg ? `<span class="muted small">4-week average ${fl.avg.toFixed(1)} h/week</span>` : ''}</div>
          ${fl.list.length ? `<div class="stack" style="margin-top:8px">${fl.list.map(f => `<details class="wk-flag ${f.sev}"><summary>${esc(f.title)}</summary><div class="muted small">${esc(f.why)}</div></details>`).join('')}</div>` : fl.level === 'green' ? '<div class="muted small">Hours, long days, rest between shifts and days off are all inside the recommended limits.</div>' : ''}
          <div class="muted tiny" style="margin-top:6px">Thresholds from WHO/ILO, the EU Working Time Directive and peer-reviewed studies. For awareness only, not medical advice.</div></div>
        <div class="grid wk-kpis">
          ${App.ui.kpi('Pay (your sales)', fmt.money(x.pay), x.payFrom || 'add a paycheck or salary')}
          ${App.ui.kpi('Labor hours', fmt.num(x.laborHrs, 1), `${x.weeks >= 1 ? fmt.num(x.laborHrs / x.weeks, 1) + ' h/week avg' : ''}${pr.includeCommute && x.commute ? ` · incl. ${fmt.num(x.commute, 1)} h commute` : ''}`, fl.avg >= 55 ? 'bad' : fl.avg >= 48 ? 'warn' : '')}
          ${App.ui.kpi('Pay per labor hour', Number.isFinite(x.perHour) ? fmt.money(x.perHour, 2) : '—', `target ${fmt.money(+pr.target || 0, 2)}`, Number.isFinite(x.perHour) ? (x.perHour >= pr.target ? 'good' : 'bad') : '')}
          ${App.ui.kpi('Labor %', fmt.pct(x.laborPct, 0), 'hours × target ÷ pay · under 100% is good', Number.isFinite(x.laborPct) ? (x.laborPct <= 1 ? 'good' : x.laborPct <= 1.15 ? 'warn' : 'bad') : '')}
          ${App.ui.kpi('Cost to earn', fmt.pct(x.costPct, 1), `${fmt.money(x.costs)} commute, meals, childcare…`, Number.isFinite(x.costPct) ? (x.costPct <= 0.05 ? 'good' : x.costPct <= 0.1 ? 'warn' : 'bad') : '')}
          ${App.ui.kpi('Life share', fmt.pct(x.lifeShare, 0), 'work hours ÷ waking hours', Number.isFinite(x.lifeShare) ? (x.lifeShare <= 0.36 ? 'good' : x.lifeShare <= 0.45 ? 'warn' : 'bad') : '')}
        </div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Your 168-hour week</h2><span class="muted tiny">${x.weeks > 1.01 ? 'average week · ' : ''}${esc(label)}</span></div>
            <div class="wk-bar">${bars.map(([k, h]) => `<span style="width:${h / 168 * 100}%;background:${CATS[k]?.color}" title="${esc(CATS[k]?.label)} ${h.toFixed(1)} h"></span>`).join('')}<span style="width:${left / 168 * 100}%" class="wk-left" title="Not logged ${left.toFixed(1)} h"></span></div>
            <div class="wk-legend">${bars.map(([k, h]) => `<div><i style="background:${CATS[k]?.color}"></i><span>${esc(CATS[k]?.label)}</span><b>${h.toFixed(1)} h</b><span class="muted tiny">${Math.round(h / 168 * 100)}%</span></div>`).join('')}
              <div><i class="wk-left"></i><span>Not logged${sleepAssumed ? ' (log sleep to make this exact)' : ''}</span><b>${left.toFixed(1)} h</b><span class="muted tiny">${Math.round(left / 168 * 100)}%</span></div></div>
            <button class="btn small" id="kTime2" style="margin-top:10px">${App.fx.icon('plus')} Add other time (contract, volunteer, family…)</button></div>
          <div class="card"><div class="card-head"><h2>Last 8 weeks</h2></div>
            <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Week of</th><th class="num">Hours</th><th class="num">Pay</th><th class="num">$/hour</th><th class="num">Labor %</th></tr></thead><tbody>
            ${hist.map(h => `<tr><td>${esc(fmt.date(h.s))}</td><td class="num ${h.workHrs >= 55 ? 'down' : h.workHrs >= 48 ? 'warn-t' : ''}">${h.workHrs ? fmt.num(h.laborHrs, 1) : '—'}</td><td class="num">${h.pay && h.workHrs ? fmt.money(h.pay) : '—'}</td><td class="num">${Number.isFinite(h.perHour) ? fmt.money(h.perHour, 2) : '—'}</td><td class="num">${Number.isFinite(h.laborPct) ? fmt.pct(h.laborPct, 0) : '—'}</td></tr>`).join('')}</tbody></table></div>
            <div class="wk-check"><b class="small">Monthly check-in</b> <span class="muted tiny">How often this month did you feel…</span>
              ${[['exhausted', 'exhausted or drained by work'], ['detached', 'detached or cynical about work']].map(([k, l]) => `<label class="row small" style="justify-content:space-between;gap:8px"><span>${l}</span><select data-ci="${k}" data-native>${['—', 'Never', 'Rarely', 'Sometimes', 'Often', 'Always'].map((o, i) => `<option value="${i}" ${(App.bsettings.get('work.checkin', {})[t.slice(0, 7)]?.[k] || 0) === i ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`).join('')}</div></div>
        </div>
        <div class="card"><div class="card-head"><h2>Entries</h2><span class="muted small">${esc(label)}</span></div>
          ${(() => { const list = recs.filter(r => r.date >= from && r.date <= to); return list.length ? `<div class="sp-list">${list.map(r => `<button class="sp-row" data-kid="${esc(r.id)}"><span class="sp-thumb">${{ shift: App.fx.icon('clock'), pay: '$', cost: '−', time: App.fx.icon('calendar') }[r.kind]}</span>
            <span class="sp-main"><b>${r.kind === 'shift' ? `${fmt.num(hoursOf(r), 2)} h${r.start ? ` · ${r.start}–${r.end}` : ''}${r.type === 'unpaid' ? ' · unpaid' : ''}` : r.kind === 'pay' ? `Paycheck${r.bonus ? ' (bonus)' : ''}` : r.kind === 'cost' ? esc(r.category) : `${esc(CATS[r.cat]?.label || 'Other')} · ${fmt.num(+r.hours, 2)} h`}</b><span class="muted tiny">${esc(fmt.date(r.date))}${r.note ? ' · ' + esc(r.note) : ''}${r.source === 'harri' ? ' · Harri' : ''}</span></span>
            <span></span><b class="sp-amt">${r.kind === 'pay' ? fmt.money(r.gross, 2) : r.kind === 'cost' ? '−' + fmt.money(r.amount, 2) : ''}</b></button>`).join('')}</div>` : App.ui.empty('Nothing logged in this range yet. Start with <b>Log hours</b> and <b>Job &amp; targets</b>.'); })()}</div>`;
      App.fx.hydrateIcons?.(el);
      const rr = () => App.go('work');
      el.querySelector('#kShift').onclick = () => form('shift', null, null, rr);
      el.querySelector('#kStub').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; form('pay', null, f ? await App.spending.shrink(f) : null, rr); };
      el.querySelector('#kPay').onclick = () => form('pay', null, null, rr);
      el.querySelector('#kCost').onclick = () => form('cost', null, null, rr);
      el.querySelector('#kTime').onclick = el.querySelector('#kTime2').onclick = () => form('time', null, null, rr);
      el.querySelector('#kHarri').onclick = () => importHarri(rr);
      el.querySelector('#kSetup').onclick = () => setup(rr);
      el.querySelector('#kSetup2')?.addEventListener('click', () => setup(rr));
      el.querySelectorAll('[data-wv]').forEach(b => b.onclick = () => { view = b.dataset.wv; rr(); });
      el.querySelector('#kPrev')?.addEventListener('click', () => { anchor = addDays(from, -1); rr(); });
      el.querySelector('#kNext')?.addEventListener('click', () => { anchor = addDays(to, 1); rr(); });
      el.querySelectorAll('[data-ci]').forEach(s => s.onchange = () => { const all = App.bsettings.get('work.checkin', {}); all[t.slice(0, 7)] = { ...(all[t.slice(0, 7)] || {}), [s.dataset.ci]: +s.value }; App.bsettings.set('work.checkin', all); rr(); });
      el.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => { const r = recs.find(x => x.id === b.dataset.kid); if (r) form(r.kind, r, null, rr); });
    }
  };
  App.work = { all, compute, flags, prof, hoursOf, CATS };
})(window.App);
