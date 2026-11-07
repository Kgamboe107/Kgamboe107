/* Roll-up dashboards: Business (all businesses), Personal (all personal units), Everything */
(function (App) {
  const { fmt, esc } = App;
  const nz = v => (v === undefined || v === null || isNaN(v)) ? 0 : v;

  App.modules.master = {
    async render(view) {
      let bizs = App.biz.inView();
      const famView = App.biz.masterKind() === 'individual';
      const who = famView ? App.wealth.person() : 'all';
      if (who !== 'all') bizs = bizs.filter(b => (b.owner || 'joint') === who || (b.owner || 'joint') === 'joint');
      view.innerHTML = App.ui.skeleton(8);
      const allFiles = await App.store.all('files', { raw: true });

      /* Compute each business's KPIs in its own scope */
      const rows = [];
      for (const b of bizs) {
        const k = await App.biz.withBiz(b.id, () => App.modules.dashboard.refreshKpis());
        const files = allFiles.filter(f => App.biz.idOf(f) === b.id);
        const flags = Object.values(k).reduce((a, m) => a + nz(m.alerts), 0);
        rows.push({ b, k, files: files.length, last: Math.max(0, ...files.map(f => f.uploadedAt)), flags });
      }

      const S = fn => App.sum(rows.map(r => nz(fn(r.k))));
      const rev = S(k => k.finance?.revenue), net = S(k => k.finance?.net);
      const sales = S(k => k.operations?.sales);
      const spend = S(k => k.marketing?.spend), mrev = S(k => k.marketing?.rev);
      const head = S(k => k.personnel?.headcount);
      const gross = S(k => k.trading?.gross), upl = S(k => k.trading?.upl), real = S(k => k['trading-perf']?.total);
      const flags = App.sum(rows.map(r => r.flags));
      const has = key => rows.some(r => r.k[key] && Object.keys(r.k[key]).filter(x => x !== 'at').length);
      const mk = App.biz.masterKind(), personal = mk === 'individual';
      const nB = rows.filter(r => App.biz.kindOf(r.b) === 'business').length, nP = rows.length - nB;
      const spendP = S(k => k.purchases?.total);
      const unitWord = mk ? (personal ? `personal unit${nP === 1 ? '' : 's'}` : `business${nB === 1 ? '' : 'es'}`) : '';
      const scopeLine = mk ? `${rows.length} ${unitWord}` : `${nB} business${nB === 1 ? '' : 'es'} · ${nP} personal`;
      const addKind = personal ? 'individual' : 'business';
      const addLabel = personal ? '+ Add personal unit' : '+ Add business';
      // Family wealth (personal units only)
      const wl = (mk === 'individual' || !mk) ? await App.wealth.collect({ who }) : [];
      const ws = App.wealth.summarize(wl);
      const groups = mk ? [[mk, rows]] : [['business', rows.filter(r => App.biz.kindOf(r.b) === 'business')], ['individual', rows.filter(r => App.biz.kindOf(r.b) === 'individual')]];

      view.innerHTML = `
        <div class="card greet row spread">
          <div><div class="greet-hi">${App.esc(App.ux.greeting())}</div><div class="muted small">${App.esc(App.ux.today())} · ${esc(App.biz.masterLabel())} · ${scopeLine} · updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>
          <div class="row no-print"><div class="seg" role="tablist" aria-label="Roll-up view">${[['all:business', 'Business'], ['all:individual', 'Personal'], ['all', 'Everything']].map(([v, l]) => `<button data-view="${v}" class="${App.biz.current() === v ? 'on' : ''}">${l}</button>`).join('')}</div>
            <button class="btn" onclick="App.fx.aiBriefing()">${App.fx.icon('sparkles')} AI briefing</button><button class="btn primary" id="mNew">${addLabel}</button></div>
        </div>
        ${famView ? `<div class="card">${App.modules.wealth.personBar()}</div>` : ''}
        <div class="grid k4">
          ${(personal || !mk) && wl.length ? App.ui.kpi(personal ? (who === 'all' ? 'Family net worth' : `${App.wealth.memberName(who)}: net worth`) : 'Personal net worth', fmt.compact(ws.net), `${fmt.compact(ws.assets)} assets · ${fmt.compact(ws.debts)} debts`, ws.net >= 0 ? 'good' : 'bad', ['__go', 'wealth']) : ''}
          ${personal && wl.length ? App.ui.kpi('Invested', fmt.compact(ws.invested), 'retirement, brokerage, HSA, 529', '', false) : ''}
          ${personal ? `
          ${has('finance') ? App.ui.kpi('Total income', fmt.compact(rev), 'all personal units') : ''}
          ${has('finance') ? App.ui.kpi('Net after expenses', fmt.compact(net), 'savings rate ' + fmt.pct(rev ? net / rev : NaN), net >= 0 ? 'good' : 'bad') : ''}
          ${has('purchases') ? App.ui.kpi('Spending', fmt.compact(spendP), 'receipts & purchases') : ''}
          ${has('trading') && !wl.length ? App.ui.kpi('Investments', fmt.compact(gross), `unrealized ${fmt.money(upl)}`, upl >= 0 ? 'good' : 'bad') : ''}
          ${has('trading-perf') ? App.ui.kpi('Realized gains', fmt.money(real), '', real >= 0 ? 'good' : 'bad') : ''}
          ${has('operations') ? App.ui.kpi('Rental / side income', fmt.compact(sales), 'from operations data') : ''}` : `
          ${has('finance') ? App.ui.kpi('Total revenue', fmt.compact(rev), mk ? 'all businesses' : 'businesses + personal') : ''}
          ${has('finance') ? App.ui.kpi('Total net income', fmt.compact(net), 'margin ' + fmt.pct(rev ? net / rev : NaN), net >= 0 ? 'good' : 'bad') : ''}
          ${has('operations') ? App.ui.kpi('Operating sales', fmt.compact(sales), 'from ops data') : ''}
          ${has('marketing') ? App.ui.kpi('Marketing spend', fmt.compact(spend), mrev ? `blended ROAS ${(mrev / spend).toFixed(2)}×` : '') : ''}
          ${has('personnel') ? App.ui.kpi('Total headcount', fmt.num(head), 'active employees') : ''}
          ${has('trading') ? App.ui.kpi('Trading exposure', fmt.compact(gross), `unrealized ${fmt.money(upl)}`, upl >= 0 ? 'good' : 'bad') : ''}
          ${has('trading-perf') ? App.ui.kpi('Realized trading P&L', fmt.money(real), '', real >= 0 ? 'good' : 'bad') : ''}`}
          ${App.ui.kpi('Open flags', fmt.num(flags), `across ${scopeLine}`, flags ? 'warn' : 'good')}
        </div>
        ${famView && who === 'all' && App.wealth.members().length > 1 ? `<div class="grid k4">${[...App.wealth.members().map(m => m.id), 'joint'].map(id => {
          const m = App.wealth.member(id), v = ws.byOwner.get(id) || 0, nUnits = App.biz.units('individual').filter(b => (b.owner || 'joint') === id).length;
          if (!v && !nUnits) return '';
          return `<button class="card member-card" data-person="${id}"><span class="pdot lg" style="background:${m?.color || '#64748b'}">${esc((m?.name || 'J')[0])}</span><span><span class="muted tiny">${id === 'joint' ? 'Joint / family' : esc(m.role === 'self' ? 'You' : m.role)}</span><b>${esc(App.wealth.memberName(id))}</b><span class="mc-v">${fmt.compact(v)}</span><span class="muted tiny">${nUnits} unit${nUnits === 1 ? '' : 's'} · individual view →</span></span></button>`;
        }).join('')}</div>` : ''}
        ${rows.length > 1 && has('finance') ? `<div class="grid c2">
          <div class="card"><div class="card-head"><h2>${personal ? 'Income & net by unit' : 'Revenue & net income by unit'}</h2></div><div class="chart-box"><canvas id="mRev"></canvas></div></div>
          <div class="card"><div class="card-head"><h2>${personal ? 'Share of income' : 'Share of revenue'}</h2></div><div class="chart-box"><canvas id="mShare"></canvas></div></div></div>` : ''}
        ${groups.map(([kind, rs]) => `<div class="row spread" style="margin-top:4px"><h2>${App.biz.KINDS[kind].plural}</h2>${mk ? '' : `<button class="btn small ghost" data-view="all:${kind}">${esc(App.biz.KINDS[kind].master)} →</button>`}</div>
        <div class="grid c3">${rs.map(r => card(r)).join('')}
          <button class="card empty add-unit" data-add="${kind}"><div class="add-plus">+</div>${kind === 'individual' ? 'Add a personal unit<div class="muted tiny">household, investment account, rental, side income</div>' : 'Add a business<div class="muted tiny">store, location, company or venture</div>'}</button>
        </div>`).join('')}
        <div class="card"><div class="card-head"><h2>Needs attention</h2><span class="badge ${flags ? 'warn' : 'good'}">${flags} flags</span></div>
          <div class="stack">${rows.flatMap(r => Object.entries(r.k).filter(([, m]) => m.alerts).map(([mod, m]) =>
            `<a class="alert warn" style="text-decoration:none;color:inherit" data-jump="${r.b.id}" data-route="${mod.startsWith('trading') ? 'trading' : mod}">
              <span class="biz-dot" style="background:${r.b.color};margin-top:5px"></span><b>${esc(r.b.name)}</b><span>${esc(label(mod))}: ${m.alerts} item${m.alerts > 1 ? 's' : ''} flagged →</span></a>`)).join('') || '<div class="alert good">No flags across any unit.</div>'}</div></div>
        <div class="row no-print"><button class="btn" onclick="window.print()">Print / save as PDF</button></div>`;

      const newUnit = kind => App.businessForm(null, id => { App.biz.setCurrent(id); App.go('dashboard'); }, { kind });
      view.querySelector('#mNew').onclick = () => newUnit(addKind);
      view.querySelectorAll('[data-add]').forEach(b => b.onclick = () => newUnit(b.dataset.add));
      view.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { App.biz.setCurrent(b.dataset.view); App.go('dashboard'); });
      if (famView) App.modules.wealth.wirePersonBar(view, () => App.go('dashboard'));
      view.querySelectorAll('.member-card[data-person]').forEach(b => b.onclick = () => { App.wealth.setPerson(b.dataset.person); App.go('dashboard'); });
      view.querySelectorAll('[data-jump]').forEach(a => a.onclick = e => { e.preventDefault(); App.biz.setCurrent(a.dataset.jump); App.go(a.dataset.route || 'dashboard'); });

      if (rows.length > 1 && has('finance')) {
        const fr = rows.filter(r => r.k.finance);
        App.ui.chart('mRev', 'bar', { labels: fr.map(r => r.b.name), datasets: [
          { label: 'Revenue', data: fr.map(r => r.k.finance.revenue), backgroundColor: fr.map(r => r.b.color) },
          { label: 'Net income', data: fr.map(r => r.k.finance.net), color: '#94a3b8' }] });
        App.ui.chart('mShare', 'doughnut', { labels: fr.map(r => r.b.name), datasets: [{ data: fr.map(r => r.k.finance.revenue), backgroundColor: fr.map(r => r.b.color) }] });
      }
    }
  };

  function label(mod) {
    return { legal: 'Legal & risk', compliance: 'Tax & compliance', purchases: 'Purchases', finance: 'Financials', operations: 'Operations', trading: 'Positions', 'trading-perf': 'Trade performance', marketing: 'Marketing', personnel: 'Personnel' }[mod] || mod;
  }

  function card({ b, k, files, last, flags }) {
    const m = [];
    const P = App.biz.kindOf(b) === 'individual';
    if (k.finance) { m.push([P ? 'Income' : 'Revenue', fmt.compact(k.finance.revenue)]); m.push([P ? 'Savings rate' : 'Net margin', fmt.pct(k.finance.margin)]); }
    if (P && k.purchases?.total) m.push(['Spending', fmt.compact(k.purchases.total)]);
    if (k.operations && !isNaN(k.operations.laborPct)) m.push(['Labor %', fmt.pct(k.operations.laborPct)]);
    if (k.operations && !k.finance) m.push(['Sales', fmt.compact(k.operations.sales)]);
    if (k.trading) m.push(['Exposure', fmt.compact(k.trading.gross)]);
    if (k['trading-perf']) m.push(['Realized P&L', fmt.money(k['trading-perf'].total)]);
    if (k.legal && !isNaN(k.legal.score)) m.push(['Protection', Math.round(k.legal.score * 100) + '%' + (k.legal.high ? ` · ${k.legal.high} high` : '')]);
    if (k.compliance && !isNaN(k.compliance.score)) m.push(['Audit ready', Math.round(k.compliance.score * 100) + '%' + (k.compliance.overdue ? ` · ${k.compliance.overdue} overdue` : '')]);
    if (!P && k.purchases?.receipts) m.push(['Food cost', fmt.pct(k.purchases.foodPct)]);
    if (k.marketing) m.push(['Mkt spend', fmt.compact(k.marketing.spend)]);
    if (k.personnel) m.push(['Headcount', fmt.num(k.personnel.headcount)]);
    return `<div class="card biz-card" style="--bc:${b.color}">
      <div class="row spread"><div><h2>${esc(b.name)}</h2><div class="muted small">${esc(App.biz.TEMPLATES[b.type]?.label || 'Custom')}</div></div>
        <span class="badge ${flags ? 'warn' : 'good'}">${flags ? flags + ' flags' : 'All clear'}</span></div>
      ${m.length ? `<div class="mini-kpis">${m.slice(0, 6).map(([l, v]) => `<div><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>`
        : `<div class="muted small">No data yet — open it and upload files to see KPIs here.</div>`}
      <div class="row spread"><span class="muted tiny">${files} files${last ? ' · last upload ' + new Date(last).toLocaleDateString() : ''}</span>
        <button class="btn small primary" data-jump="${b.id}" data-route="dashboard">Open →</button></div>
    </div>`;
  }
})(window.App);
