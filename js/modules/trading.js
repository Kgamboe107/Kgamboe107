/* Trading risk management: positions/exposure (Webull, Dub), trade performance, VaR, sizing, limits */
(function (App) {
  const { fmt, n0, esc } = App;

  const POS = [
    { key: 'sym', label: 'Symbol', syn: ['symbol', 'ticker', 'instrument', 'security', 'name'] },
    { key: 'qty', label: 'Quantity', syn: ['quantity', 'qty', 'shares', 'position', 'units', 'total qty'] },
    { key: 'avg', label: 'Avg cost', syn: ['avg cost', 'average cost', 'avg price', 'cost basis per share', 'cost/share', 'entry price'], optional: true },
    { key: 'last', label: 'Last price', syn: ['last price', 'last', 'price', 'current price', 'mark', 'market price'], optional: true },
    { key: 'mv', label: 'Market value', syn: ['market value', 'mkt value', 'value', 'current value', 'allocation value'], optional: true },
    { key: 'upl', label: 'Unrealized P&L', syn: ['unrealized p&l', 'unrealized pl', 'unrealized', 'open p&l', 'gain/loss', 'total return'], optional: true },
    { key: 'acct', label: 'Account / Portfolio', syn: ['account', 'portfolio', 'creator', 'strategy', 'broker'], optional: true },
    { key: 'sector', label: 'Sector / Asset class', syn: ['sector', 'industry', 'asset class', 'type', 'asset type'], optional: true }
  ];
  const TRADES = [
    { key: 'date', label: 'Date / Time', syn: ['filled time', 'date', 'trade date', 'time', 'execution time', 'placed time'] },
    { key: 'sym', label: 'Symbol', syn: ['symbol', 'ticker', 'instrument'] },
    { key: 'side', label: 'Side', syn: ['side', 'action', 'buy/sell', 'type', 'transaction'], optional: true },
    { key: 'qty', label: 'Quantity', syn: ['filled', 'filled qty', 'quantity', 'qty', 'shares', 'total qty'], optional: true },
    { key: 'price', label: 'Fill price', syn: ['avg price', 'fill price', 'price', 'execution price'], optional: true },
    { key: 'pnl', label: 'Realized P&L (if provided)', syn: ['realized p&l', 'realized pl', 'p&l', 'pnl', 'profit', 'gain/loss', 'net p&l'], optional: true },
    { key: 'fees', label: 'Fees / commission', syn: ['fees', 'commission', 'fee'], optional: true },
    { key: 'status', label: 'Order status', syn: ['status', 'order status'], optional: true }
  ];

  const defaults = { account: 25000, riskPct: 1, maxPos: 20, maxSector: 40, dailyLoss: 2, maxDD: 10 };
  const limits = () => ({ ...defaults, ...App.bsettings.get('trade.limits', {}) });
  let tab = 'positions';

  App.modules.trading = {
    async render(view, params = {}) {
      view.innerHTML = `
        <div class="tabs no-print"><button data-t="positions">Positions & exposure</button><button data-t="trades">Trade performance</button><button data-t="tools">Sizing & limits</button></div>
        <div id="trBody" class="stack" style="gap:16px"></div>`;
      const tabs = view.querySelectorAll('.tabs button');
      const show = async (t, remember = true) => {
        if (remember) tab = t;
        tabs.forEach(b => b.classList.toggle('active', b.dataset.t === t));
        const body = view.querySelector('#trBody');
        body.innerHTML = '';
        if (t === 'positions') await positions(body);
        if (t === 'trades') await trades(body);
        if (t === 'tools') tools(body);
      };
      tabs.forEach(b => b.onclick = () => show(b.dataset.t));
      await show(params.tab || tab, !params.tab);
    }
  };

  async function positions(body) {
    body.innerHTML = `<div id="pMap"></div><div id="pOut" class="stack" style="gap:16px"></div>`;
    await App.ui.mapper(body.querySelector('#pMap'), { title: 'Positions (Webull / Dub export)', categories: ['trading'], fields: POS, key: 'trade-pos',
      onChange: (ds, m) => renderPositions(body.querySelector('#pOut'), ds, m) });
  }

  function renderPositions(el, ds, m) {
    if (!ds || !m.sym || !(m.qty || m.mv)) { el.innerHTML = ds ? App.ui.empty('Map Symbol and Quantity (or Market value).') : ''; return; }
    const lim = limits();
    const rows = ds.rows.filter(r => r[m.sym] !== '').map(r => {
      const qty = n0(r[m.qty]), last = n0(r[m.last]), avg = n0(r[m.avg]);
      const mv = m.mv ? n0(r[m.mv]) : qty * last;
      const cost = m.avg ? qty * avg : NaN;
      const upl = m.upl ? n0(r[m.upl]) : (m.avg && (m.last || m.mv) ? mv - cost : NaN);
      return { sym: String(r[m.sym]), acct: m.acct ? r[m.acct] : '', sector: m.sector ? (r[m.sector] || 'Unclassified') : '', qty, avg, last: m.last ? last : (qty ? mv / qty : NaN), mv, cost, upl, uplPct: cost ? upl / Math.abs(cost) : NaN };
    });
    const gross = App.sum(rows.map(r => Math.abs(r.mv)));
    const net = App.sum(rows.map(r => r.mv));
    const long = App.sum(rows.filter(r => r.mv > 0).map(r => r.mv));
    const short = App.sum(rows.filter(r => r.mv < 0).map(r => r.mv));
    rows.forEach(r => r.w = gross ? Math.abs(r.mv) / gross : 0);
    const sorted = [...rows].sort((a, b) => b.w - a.w);
    const upl = App.sum(rows.map(r => r.upl));
    const hhi = App.sum(rows.map(r => r.w ** 2));
    const top5 = App.sum(sorted.slice(0, 5).map(r => r.w));
    const effN = hhi ? 1 / hhi : NaN;

    const alerts = [];
    sorted.filter(r => r.w * 100 > lim.maxPos).forEach(r => alerts.push(['bad', `${r.sym} is ${fmt.pct(r.w)} of gross exposure (limit ${lim.maxPos}%)`]));
    let sectors = [];
    if (m.sector) {
      const g = new Map();
      rows.forEach(r => g.set(r.sector, (g.get(r.sector) || 0) + Math.abs(r.mv)));
      sectors = [...g.entries()].map(([k, v]) => ({ k, v, w: v / gross })).sort((a, b) => b.v - a.v);
      sectors.filter(s => s.w * 100 > lim.maxSector).forEach(s => alerts.push(['warn', `${s.k} sector is ${fmt.pct(s.w)} of exposure (limit ${lim.maxSector}%)`]));
    }
    rows.filter(r => r.uplPct < -0.15).forEach(r => alerts.push(['warn', `${r.sym} is down ${fmt.pct(-r.uplPct)} from cost — review stop`]));
    if (lim.account && gross > lim.account * 1.0) alerts.push(['warn', `Gross exposure ${fmt.money(gross)} exceeds account equity ${fmt.money(lim.account)} — leverage ${(gross / lim.account).toFixed(2)}x`]);

    const shocks = [-0.05, -0.10, -0.20, -0.30];
    App.ui.publish('trading', { gross, net, upl, positions: rows.length, topWeight: sorted[0]?.w, alerts: alerts.length });

    el.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Gross exposure', fmt.compact(gross), `${rows.length} positions`)}
        ${App.ui.kpi('Net exposure', fmt.compact(net), `Long ${fmt.compact(long)} · Short ${fmt.compact(short)}`)}
        ${App.ui.kpi('Unrealized P&L', fmt.money(upl), '', upl >= 0 ? 'good' : 'bad')}
        ${App.ui.kpi('Largest position', fmt.pct(sorted[0]?.w), esc(sorted[0]?.sym || ''), sorted[0]?.w * 100 > lim.maxPos ? 'bad' : '')}
        ${App.ui.kpi('Top 5 concentration', fmt.pct(top5), `HHI ${hhi.toFixed(3)} · effective N ${fmt.num(effN, 1)}`, top5 > 0.6 ? 'warn' : '')}
        ${lim.account ? App.ui.kpi('Leverage', (gross / lim.account).toFixed(2) + 'x', `vs ${fmt.compact(lim.account)} equity (Sizing tab)`, gross > lim.account ? 'warn' : '') : ''}
      </div>
      ${alerts.length ? `<div class="card"><div class="card-head"><h2>Risk flags</h2><span class="badge bad">${alerts.length}</span></div><div class="stack">${alerts.map(([c, s]) => `<div class="alert ${c}">${esc(s)}</div>`).join('')}</div></div>` : `<div class="alert good">All positions within concentration limits.</div>`}
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>Allocation</h2></div><div class="chart-box"><canvas id="posPie"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Stress test</h2><span class="muted small">Uniform market shock (beta 1)</span></div>
          <div class="stack">${shocks.map(s => { const loss = net * s; return `<div class="row spread"><span>Market ${fmt.pct(s, 0)}</span><b style="color:var(--bad)">${fmt.money(loss)}</b><span class="muted small">${lim.account ? fmt.pct(loss / lim.account) + ' of equity' : ''}</span></div>`; }).join('')}</div>
          ${sectors.length ? `<h3 style="margin:16px 0 8px">Sector exposure</h3><div class="stack">${sectors.map(s => `<div class="row spread"><span>${esc(s.k)}</span><span>${fmt.money(s.v)} <span class="badge ${s.w * 100 > lim.maxSector ? 'warn' : ''}">${fmt.pct(s.w)}</span></span></div>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="card"><div class="card-head"><h2>Positions</h2><button class="btn small" id="posCsv">Export CSV</button></div><div id="posT"></div></div>`;

    const top = sorted.slice(0, 9);
    if (sorted.length > 9) top.push({ sym: 'Other', mv: App.sum(sorted.slice(9).map(r => Math.abs(r.mv))) });
    App.ui.chart('posPie', 'doughnut', { labels: top.map(r => r.sym), datasets: [{ data: top.map(r => Math.abs(r.mv)) }] });
    const cols = [
      { key: 'sym', label: 'Symbol' },
      ...(m.acct ? [{ key: 'acct', label: 'Account' }] : []),
      ...(m.sector ? [{ key: 'sector', label: 'Sector' }] : []),
      { key: 'qty', label: 'Qty', num: true, fmt: v => fmt.num(v, 2) },
      { key: 'avg', label: 'Avg cost', num: true, fmt: v => m.avg ? fmt.money(v, 2) : '—' },
      { key: 'last', label: 'Last', num: true, fmt: v => fmt.money(v, 2) },
      { key: 'mv', label: 'Mkt value', num: true, fmt: v => fmt.money(v) },
      { key: 'w', label: 'Weight', num: true, fmt: v => `<span class="${v * 100 > lim.maxPos ? 'badge bad' : ''}">${fmt.pct(v)}</span>` },
      { key: 'upl', label: 'Unrl. P&L', num: true, fmt: v => `<span style="color:var(${v < 0 ? '--bad' : '--good'})">${fmt.money(v)}</span>` },
      { key: 'uplPct', label: 'Return', num: true, fmt: v => fmt.pct(v) }
    ];
    App.ui.table(el.querySelector('#posT'), cols, rows, { sortKey: 'w' });
    el.querySelector('#posCsv').onclick = () => App.download('positions-risk.csv', App.toCSV(cols.map(c => c.key), rows));
  }

  async function trades(body) {
    body.innerHTML = `<div id="tMap"></div><div id="tOut" class="stack" style="gap:16px"></div>`;
    await App.ui.mapper(body.querySelector('#tMap'), { title: 'Trade history (Webull orders / Dub activity)', categories: ['trading'], fields: TRADES, key: 'trade-hist',
      onChange: (ds, m) => renderTrades(body.querySelector('#tOut'), ds, m) });
  }

  /* FIFO realized P&L from fills when the export has no P&L column */
  function fifo(fills) {
    const lots = new Map();
    const out = [];
    for (const f of fills) {
      const q0 = lots.get(f.sym) || [];
      let q = f.qty * (f.buy ? 1 : -1), pnl = 0, closed = 0;
      while (q !== 0 && q0.length && Math.sign(q0[0].qty) !== Math.sign(q)) {
        const lot = q0[0];
        const match = Math.min(Math.abs(q), Math.abs(lot.qty));
        pnl += (lot.qty > 0 ? f.price - lot.price : lot.price - f.price) * match;
        closed += match;
        lot.qty += lot.qty > 0 ? -match : match;
        q += q > 0 ? -match : match;
        if (Math.abs(lot.qty) < 1e-9) q0.shift();
      }
      if (Math.abs(q) > 1e-9) q0.push({ qty: q, price: f.price });
      lots.set(f.sym, q0);
      if (closed) out.push({ date: f.date, sym: f.sym, pnl: pnl - f.fees });
      else if (f.fees) out.push({ date: f.date, sym: f.sym, pnl: -f.fees, feeOnly: true });
    }
    return out;
  }

  function renderTrades(el, ds, m) {
    if (!ds || !m.sym || !(m.pnl || (m.side && m.qty && m.price))) { el.innerHTML = ds ? App.ui.empty('Map Symbol plus either Realized P&L, or Side + Quantity + Price.') : ''; return; }
    const lim = limits();
    let src = ds.rows.filter(r => r[m.sym] !== '');
    if (m.status) src = src.filter(r => !/cancel|reject|fail|expired|pending|working/i.test(String(r[m.status])));
    let closed;
    if (m.pnl) {
      closed = src.filter(r => String(r[m.pnl]).trim() !== '').map(r => ({ date: App.toDate(r[m.date]), sym: String(r[m.sym]), pnl: n0(r[m.pnl]) - (m.fees ? Math.abs(n0(r[m.fees])) : 0) }));
    } else {
      const fills = src.map(r => ({ date: App.toDate(r[m.date]), sym: String(r[m.sym]), buy: /buy|bot|long|cover/i.test(String(r[m.side])), qty: Math.abs(n0(r[m.qty])), price: n0(r[m.price]), fees: m.fees ? Math.abs(n0(r[m.fees])) : 0 }))
        .filter(f => f.qty && f.price).sort((a, b) => (a.date || 0) - (b.date || 0));
      closed = fifo(fills);
    }
    closed = closed.sort((a, b) => (a.date || 0) - (b.date || 0));
    const real = closed.filter(t => !t.feeOnly);
    const wins = real.filter(t => t.pnl > 0), losses = real.filter(t => t.pnl < 0);
    const total = App.sum(closed.map(t => t.pnl));
    const gw = App.sum(wins.map(t => t.pnl)), gl = Math.abs(App.sum(losses.map(t => t.pnl)));
    const winRate = real.length ? wins.length / real.length : NaN;
    const avgW = wins.length ? gw / wins.length : 0, avgL = losses.length ? gl / losses.length : 0;
    const pf = gl ? gw / gl : (gw ? Infinity : NaN);
    const expectancy = real.length ? total / real.length : NaN;

    /* Daily P&L + equity curve */
    const daily = new Map();
    closed.forEach(t => { const k = t.date ? t.date.toISOString().slice(0, 10) : 'n/a'; daily.set(k, (daily.get(k) || 0) + t.pnl); });
    const days = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let eq = lim.account || 0, peak = eq, maxDD = 0, maxDDpct = 0;
    const curve = days.map(([d, p]) => { eq += p; peak = Math.max(peak, eq); const dd = peak - eq; if (dd > maxDD) { maxDD = dd; maxDDpct = peak ? dd / peak : 0; } return { d, eq, p }; });
    const dp = days.map(d => d[1]);
    const sd = App.stdev(dp), mu = App.mean(dp);
    const hVaR = dp.length >= 10 ? -App.quantile(dp, 0.05) : NaN;
    const pVaR = !isNaN(sd) ? 1.645 * sd - mu : NaN;
    const tail = dp.filter(x => x <= -hVaR);
    const cvar = tail.length ? -App.mean(tail) : NaN;
    const sharpe = sd ? (mu / sd) * Math.sqrt(252) : NaN;
    const worst = dp.length ? Math.min(...dp) : NaN;

    const bySym = new Map();
    closed.forEach(t => { const a = bySym.get(t.sym) || { sym: t.sym, pnl: 0, n: 0, w: 0 }; a.pnl += t.pnl; if (!t.feeOnly) { a.n++; if (t.pnl > 0) a.w++; } bySym.set(t.sym, a); });
    const symRows = [...bySym.values()].map(s => ({ ...s, wr: s.n ? s.w / s.n : NaN })).sort((a, b) => b.pnl - a.pnl);

    const alerts = [];
    const lastDay = days[days.length - 1];
    if (lastDay && lim.account && lastDay[1] < -(lim.dailyLoss / 100) * lim.account) alerts.push(['bad', `Last session (${lastDay[0]}) lost ${fmt.money(lastDay[1])} — exceeds ${lim.dailyLoss}% daily loss limit`]);
    const breaches = days.filter(([, p]) => lim.account && p < -(lim.dailyLoss / 100) * lim.account).length;
    if (breaches) alerts.push(['warn', `${breaches} day${breaches > 1 ? 's' : ''} breached the ${lim.dailyLoss}% daily loss limit`]);
    if (maxDDpct * 100 > lim.maxDD) alerts.push(['bad', `Max drawdown ${fmt.pct(maxDDpct)} exceeds ${lim.maxDD}% limit`]);
    if (pf < 1) alerts.push(['warn', `Profit factor ${pf.toFixed(2)} — losing more on losers than gaining on winners`]);
    if (avgL > avgW * 1.5 && winRate < 0.6) alerts.push(['warn', `Average loss (${fmt.money(avgL)}) is ${(avgL / avgW).toFixed(1)}× average win — check stop discipline`]);

    App.ui.publish('trading-perf', { total, winRate, pf, maxDD, hVaR, alerts: alerts.length });

    el.innerHTML = `
      <div class="grid k4">
        ${App.ui.kpi('Realized P&L', fmt.money(total), `${real.length} closed trades`, total >= 0 ? 'good' : 'bad')}
        ${App.ui.kpi('Win rate', fmt.pct(winRate), `${wins.length}W / ${losses.length}L`)}
        ${App.ui.kpi('Profit factor', isFinite(pf) ? pf.toFixed(2) : '∞', `avg win ${fmt.money(avgW)} · avg loss ${fmt.money(avgL)}`, pf >= 1.5 ? 'good' : pf < 1 ? 'bad' : '')}
        ${App.ui.kpi('Expectancy / trade', fmt.money(expectancy, 2), '', expectancy >= 0 ? 'good' : 'bad')}
        ${App.ui.kpi('Max drawdown', fmt.money(-maxDD), lim.account ? fmt.pct(maxDDpct) + ' from peak' : '', maxDDpct * 100 > lim.maxDD ? 'bad' : '')}
        ${App.ui.kpi('1-day VaR 95%', fmt.money(isNaN(hVaR) ? pVaR : hVaR), isNaN(hVaR) ? 'parametric' : `historical · parametric ${fmt.money(pVaR)}`, 'warn')}
        ${App.ui.kpi('Expected shortfall', fmt.money(cvar), 'avg loss beyond VaR')}
        ${App.ui.kpi('Sharpe (ann.)', isNaN(sharpe) ? '—' : sharpe.toFixed(2), `worst day ${fmt.money(worst)}`)}
      </div>
      ${alerts.length ? `<div class="card"><div class="card-head"><h2>Risk flags</h2><span class="badge bad">${alerts.length}</span></div><div class="stack">${alerts.map(([c, s]) => `<div class="alert ${c}">${esc(s)}</div>`).join('')}</div></div>` : ''}
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>Equity curve</h2><span class="muted small">${lim.account ? 'starting at ' + fmt.money(lim.account) : 'cumulative P&L'}</span></div><div class="chart-box"><canvas id="eqC"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Daily P&L</h2></div><div class="chart-box"><canvas id="dpC"></canvas></div></div>
      </div>
      <div class="card"><div class="card-head"><h2>P&L by symbol</h2><button class="btn small" id="symCsv">Export CSV</button></div><div id="symT"></div></div>`;
    App.ui.chart('eqC', 'line', { labels: curve.map(c => c.d), datasets: [{ label: 'Equity', data: curve.map(c => +c.eq.toFixed(2)), fill: true }] });
    App.ui.chart('dpC', 'bar', { labels: days.map(d => d[0]), datasets: [{ label: 'P&L', data: dp, backgroundColor: dp.map(v => v >= 0 ? '#059669' : '#dc2626') }] });
    const cols = [
      { key: 'sym', label: 'Symbol' }, { key: 'n', label: 'Trades', num: true },
      { key: 'wr', label: 'Win rate', num: true, fmt: v => fmt.pct(v) },
      { key: 'pnl', label: 'P&L', num: true, fmt: v => `<span style="color:var(${v < 0 ? '--bad' : '--good'})">${fmt.money(v, 2)}</span>` }
    ];
    App.ui.table(el.querySelector('#symT'), cols, symRows, { sortKey: 'pnl' });
    el.querySelector('#symCsv').onclick = () => App.download('pnl-by-symbol.csv', App.toCSV(cols.map(c => c.key), symRows));
  }

  function tools(body) {
    const lim = limits();
    const calc = App.bsettings.get('trade.calc', { entry: 50, stop: 47.5, target: 57.5 });
    body.innerHTML = `
      <div class="grid c2">
        <div class="card"><div class="card-head"><h2>Risk limits</h2><span class="muted small">Drive all flags on this page</span></div>
          <div class="mapper">
            <label>Account equity ($)<input type="number" id="lAcct" value="${lim.account}"></label>
            <label>Risk per trade (%)<input type="number" step="0.1" id="lRisk" value="${lim.riskPct}"></label>
            <label>Max single position (%)<input type="number" id="lPos" value="${lim.maxPos}"></label>
            <label>Max sector (%)<input type="number" id="lSec" value="${lim.maxSector}"></label>
            <label>Daily loss limit (%)<input type="number" step="0.1" id="lDay" value="${lim.dailyLoss}"></label>
            <label>Max drawdown (%)<input type="number" id="lDD" value="${lim.maxDD}"></label>
          </div>
          <div class="muted small" style="margin-top:10px">Daily loss limit = ${fmt.money(lim.account * lim.dailyLoss / 100)} · Max position = ${fmt.money(lim.account * lim.maxPos / 100)}</div>
        </div>
        <div class="card"><div class="card-head"><h2>Position size calculator</h2></div>
          <div class="mapper">
            <label>Entry price<input type="number" step="0.01" id="cEntry" value="${calc.entry}"></label>
            <label>Stop price<input type="number" step="0.01" id="cStop" value="${calc.stop}"></label>
            <label>Target price<input type="number" step="0.01" id="cTarget" value="${calc.target}"></label>
          </div>
          <div id="cOut" class="grid k4" style="margin-top:12px"></div>
        </div>
      </div>
      <div class="card"><div class="card-head"><h2>Pre-trade checklist</h2></div>
        <div class="stack small">
          ${['Position size within risk-per-trade limit', 'Stop loss defined and entered with the order', 'Reward:risk at least 2:1', 'Adds no more than the max single-position weight', 'No earnings / major macro event inside holding period (or sized for it)', 'Daily loss limit not yet reached today', 'Copy-trading (Dub) allocations reviewed for overlap with direct holdings']
            .map((s, i) => `<label class="row"><input type="checkbox" data-ck="${i}"> ${esc(s)}</label>`).join('')}
        </div></div>`;
    const save = () => {
      App.bsettings.set('trade.limits', { account: +body.querySelector('#lAcct').value, riskPct: +body.querySelector('#lRisk').value, maxPos: +body.querySelector('#lPos').value,
        maxSector: +body.querySelector('#lSec').value, dailyLoss: +body.querySelector('#lDay').value, maxDD: +body.querySelector('#lDD').value });
      App.bsettings.set('trade.calc', { entry: +body.querySelector('#cEntry').value, stop: +body.querySelector('#cStop').value, target: +body.querySelector('#cTarget').value });
      size();
    };
    function size() {
      const L = limits(), c = App.bsettings.get('trade.calc', calc);
      const riskPer = Math.abs(c.entry - c.stop);
      const riskBudget = L.account * L.riskPct / 100;
      let shares = riskPer ? Math.floor(riskBudget / riskPer) : 0;
      const capShares = c.entry ? Math.floor(L.account * L.maxPos / 100 / c.entry) : 0;
      const capped = shares > capShares;
      shares = Math.min(shares, capShares);
      const rr = riskPer ? Math.abs(c.target - c.entry) / riskPer : NaN;
      body.querySelector('#cOut').innerHTML =
        App.ui.kpi('Shares', fmt.num(shares), capped ? 'capped by max position %' : `risking ${fmt.money(riskBudget)}`, capped ? 'warn' : '') +
        App.ui.kpi('Position value', fmt.money(shares * c.entry), fmt.pct(shares * c.entry / L.account) + ' of equity') +
        App.ui.kpi('$ at risk', fmt.money(shares * riskPer), fmt.money(riskPer, 2) + '/share') +
        App.ui.kpi('Reward : risk', isNaN(rr) ? '—' : rr.toFixed(2) + ' : 1', fmt.money(shares * Math.abs(c.target - c.entry)) + ' potential', rr >= 2 ? 'good' : 'warn');
    }
    body.querySelectorAll('input[type=number]').forEach(i => i.oninput = save);
    size();
  }
})(window.App);
