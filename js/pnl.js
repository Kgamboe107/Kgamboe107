/* Business ↔ personal P&L link. A business can be owned (fully or in part) by a personal unit; the owner's share of
   its profit flows into that personal unit's P&L, and the Everything view shows one combined P&L.
   Business numbers are computed for the same reporting period as the page you're on. */
(function (App) {
  const { fmt, esc } = App;
  const num = v => typeof v === 'number' && Number.isFinite(v);

  /* Revenue / expenses / net for one unit, for the current period */
  async function unitPnl(id) {
    return App.biz.withBiz(id, async () => {
      if (!App.biz.enabled('finance')) return null;
      try { await App.modules.finance.render(document.createElement('div')); } catch (e) { console.warn('P&L', id, e); }
      const f = App.bsettings.get('kpis', {}).finance;
      if (!f || !num(f.revenue)) return null;
      return { revenue: f.revenue, net: num(f.net) ? f.net : NaN, expenses: num(f.net) ? f.revenue - f.net : NaN, noExpenses: f.margin === 1 };
    });
  }
  /* Receipts logged in a personal unit, for the current period (or all time) */
  async function receipts(id) {
    const r = App.period.range();
    const list = (await App.store.all('spending', { raw: true }).catch(() => [])).filter(x => App.biz.idOf(x) === id && (r.g === 'all' || (x.date >= r.from && x.date <= r.to)));
    return { total: App.sum(list.map(x => +x.total || 0)), count: list.length };
  }

  /* Everything that flows into one personal unit */
  async function personal(pid, own = null) {
    const links = App.biz.ownedBy(pid);
    const biz = [];
    for (const b of links) {
      const p = await unitPnl(b.id);
      const share = (b.share ?? 100) / 100;
      biz.push({ b, p, share, yours: p && num(p.net) ? p.net * share : NaN, counted: b.profitToPersonal !== false });
    }
    // own: this unit's own P&L ({ revenue, net, margin }); computed here when not given (always one unit at a time)
    if (own === null) { const p = await unitPnl(pid); own = p ? { revenue: p.revenue, net: p.net, margin: p.noExpenses ? 1 : 0 } : null; }
    else own = await own;
    const rc = await receipts(pid);
    // 1099 work profit and donations in the same period
    const per = App.period.range(), inP = d => per.g === 'all' || (d >= per.from && d <= per.to);
    const gigs = (await App.store.all('gigs', { raw: true }).catch(() => [])).filter(x => App.biz.idOf(x) === pid && inP(x.date));
    const gigS = gigs.length ? App.gigs.summarize(gigs, +(per.to || App.period.today()).slice(0, 4)) : null;
    const gifts = (await App.store.all('giving', { raw: true }).catch(() => [])).filter(x => App.biz.idOf(x) === pid && inP(x.date));
    // Money that actually left your accounts (goods, stock and volunteer miles are deductible but aren't spending)
    // Paychecks from Work & Pay (take-home when known, since bank deposits are take-home)
    const pays = (await App.store.all('work', { raw: true }).catch(() => [])).filter(x => x.kind === 'pay' && App.biz.idOf(x) === pid && inP(x.date));
    const payIn = App.sum(pays.map(x => +(x.net !== '' && x.net != null ? x.net : x.gross) || 0));
    const giving = App.sum(gifts.filter(g => g.kind === 'cash' || g.kind === 'daf').map(App.giving.valueOf));
    const bizIncome = App.sum(biz.filter(x => x.counted && num(x.yours)).map(x => x.yours));
    const hasOwn = own && num(own.revenue);
    // Bank deposits already include 1099 payments; only add 1099 profit when there are no statements
    const income = (hasOwn ? own.revenue : 0) + (!hasOwn && gigS ? gigS.gross : 0) + (!hasOwn ? payIn : 0);
    const hasOwnExp = own && num(own.net) && own.margin !== 1;
    // Bank/P&L expenses already include what the receipts record; receipts count only when there's nothing else
    const expenses = hasOwnExp ? own.revenue - own.net : rc.total + giving + (gigS ? gigS.expTotal : 0);
    const net = bizIncome + income - expenses;
    return { gigS, payIn, paychecks: pays.length, giving, gifts: gifts.filter(g => g.kind === 'cash' || g.kind === 'daf').length, hasOwn, biz, bizIncome, income, expenses, expFrom: hasOwnExp ? 'statements / P&L' : rc.count ? 'receipts' : '', receipts: rc, net, totalIn: bizIncome + income, rate: bizIncome + income ? net / (bizIncome + income) : NaN };
  }

  const line = (label, v, cls = '', sub = '') => `<div class="pl-row ${cls}"><span>${label}${sub ? `<span class="muted tiny"> · ${sub}</span>` : ''}</span><b>${num(v) ? fmt.money(v) : '—'}</b></div>`;
  function personalCard(x, unitName) {
    const per = App.period.range();
    return `<div class="card pl-card"><div class="card-head"><h2>Personal P&amp;L${per.g !== 'all' ? ` · ${esc(per.label)}` : ''}</h2><a class="small" href="#businesses" data-go="businesses">Link businesses →</a></div>
      <div class="pl-grid"><div>
        ${line('Your share of business profit', x.bizIncome, 'in', x.biz.length ? `${x.biz.filter(b => b.counted).length} linked business${x.biz.length === 1 ? '' : 'es'}` : 'none linked yet')}
        ${line('Personal income', x.income, 'in', !x.hasOwn && (x.gigS || x.paychecks) ? [x.paychecks ? `${x.paychecks} paycheck${x.paychecks === 1 ? '' : 's'}` : '', x.gigS ? '1099 work' : ''].filter(Boolean).join(' + ') : 'pay, interest, side income')}
        ${x.gigS ? line('of which 1099 work profit', x.gigS.net, 'sub', `set aside ${fmt.money(x.gigS.setAside)} for taxes`) : ''}
        ${line('Total coming in', x.totalIn, 'sum')}
        ${line('Personal expenses', -x.expenses, 'out', x.expFrom || 'add statements or receipts')}
        ${x.giving ? line('of which charitable giving', -x.giving, 'sub', `${x.gifts} gift${x.gifts === 1 ? '' : 's'}`) : ''}
        ${line('Net (saved)', x.net, 'total ' + (x.net >= 0 ? 'good' : 'bad'), num(x.rate) ? `savings rate ${fmt.pct(x.rate)}` : '')}
      </div>
      <div>${x.biz.length ? `<div class="rv-h">Businesses you own</div>${x.biz.map(r => `<div class="pl-biz"><div><b>${esc(r.b.name)}</b><div class="muted tiny">${Math.round(r.share * 100)}% yours · ${r.p ? `revenue ${fmt.compact(r.p.revenue)} · net ${num(r.p.net) ? fmt.compact(r.p.net) : '—'}${r.p.noExpenses ? ' (no expenses loaded)' : ''}` : 'no P&L data yet'}${r.counted ? '' : ' · not counted as personal income (paid as salary / draws)'}</div></div><b class="${num(r.yours) && r.yours < 0 ? 'down' : ''}">${num(r.yours) ? fmt.money(r.yours) : '—'}</b></div>`).join('')}`
        : `<div class="muted small">Link a business to see its profit here: <b>Units</b> → edit the business → <b>Profit goes to</b> “${esc(unitName)}” and your ownership %. If you pay yourself a salary or draws instead, untick “Count my share as personal income” so it isn’t counted twice.</div>`}
        ${x.receipts.count ? `<div class="muted tiny" style="margin-top:8px">${x.receipts.count} receipts logged (${fmt.money(x.receipts.total)})${x.expFrom === 'statements / P&L' ? ', already part of the expenses above' : ''}.</div>` : ''}</div></div></div>`;
  }

  /* Everything view: business and personal side by side */
  async function combined() {
    const bs = App.biz.units('business'), ps = App.biz.units('individual');
    const b = [];
    for (const u of bs) b.push({ u, p: await unitPnl(u.id) });
    const pp = [];
    for (const u of ps) pp.push({ u, x: await personal(u.id) });
    const S = (l, f) => App.sum(l.map(f).filter(num));
    const bRev = S(b, r => r.p?.revenue), bNet = S(b, r => r.p?.net), bExp = S(b, r => r.p?.expenses);
    const toOwners = S(pp, r => r.x.bizIncome);
    const pIn = S(pp, r => r.x.income), pExp = S(pp, r => r.x.expenses);
    const kept = bNet - toOwners; // profit not counted in any personal P&L (other owners' shares, retained, or paid as salary)
    return { bRev, bExp, bNet, toOwners, pIn, pExp, pNet: S(pp, r => r.x.net), combinedNet: kept + S(pp, r => r.x.net), units: b, persons: pp };
  }
  function combinedCard(c) {
    const per = App.period.range();
    return `<div class="card pl-card"><div class="card-head"><h2>Combined P&amp;L: business + personal${per.g !== 'all' ? ` · ${esc(per.label)}` : ''}</h2><a class="small" href="#businesses" data-go="businesses">Ownership links →</a></div>
      <div class="pl-grid"><div><div class="rv-h">Businesses</div>
        ${line('Revenue', c.bRev, 'in')}${line('Expenses', -c.bExp, 'out')}${line('Business net profit', c.bNet, 'sum')}
        ${line('Paid to owners’ personal P&amp;L', -c.toOwners, 'out', 'your ownership share')}</div>
      <div><div class="rv-h">Personal</div>
        ${line('Share of business profit', c.toOwners, 'in')}${line('Personal income', c.pIn, 'in')}${line('Personal expenses', -c.pExp, 'out')}${line('Personal net', c.pNet, 'sum')}</div></div>
      ${line('Combined net (counted once)', c.combinedNet, 'total ' + (c.combinedNet >= 0 ? 'good' : 'bad'), 'business profit kept + personal net')}</div>`;
  }
  const bindGo = el => el.querySelectorAll('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); App.go(a.dataset.go); });

  App.pnl = { unitPnl, personal, personalCard, combined, combinedCard, bindGo };
})(window.App);
