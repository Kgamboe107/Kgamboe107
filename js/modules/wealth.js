/* Net Worth: accounts, debts and holdings for a personal unit, or the whole family's wealth in a roll-up.
   Person filter (Family · each member) gives an individual view of everything. */
(function (App) {
  const { fmt, esc } = App;
  const W = () => App.wealth;
  const money = v => fmt.money(v);
  const today = () => new Date().toISOString().slice(0, 10);

  /* Person chips: Family + each member; shared by Net Worth, Taxes & CPA and the Personal dashboard */
  function personBar(onChange) {
    const p = W().person();
    return `<div class="person-bar" role="tablist" aria-label="Whose view">
      <button role="tab" data-person="all" class="${p === 'all' ? 'on' : ''}"><span class="pdot fam">${App.fx.icon('user')}</span>Family</button>
      ${W().members().map(m => `<button role="tab" data-person="${m.id}" class="${p === m.id ? 'on' : ''}"><span class="pdot" style="background:${m.color || '#6366f1'}">${esc((m.name || '?')[0].toUpperCase())}</span>${esc(m.name)}</button>`).join('')}
      <button class="add" data-members title="Add or edit family members">+ Member</button></div>`;
  }
  function wirePersonBar(root, rerender) {
    root.querySelectorAll('[data-person]').forEach(b => b.onclick = () => { W().setPerson(b.dataset.person); rerender(); });
    root.querySelector('[data-members]')?.addEventListener('click', () => membersDialog(rerender));
  }

  function membersDialog(after) {
    const list = W().members().map(m => ({ ...m }));
    const COLORS = ['#6366f1', '#db2777', '#059669', '#d97706', '#0891b2', '#7c3aed', '#dc2626', '#65a30d'];
    const draw = card => {
      card.querySelector('#fmList').innerHTML = list.map((m, i) => `<div class="fm-row">
        <input type="color" data-i="${i}" data-k="color" value="${m.color || COLORS[i % COLORS.length]}" aria-label="Color">
        <input data-i="${i}" data-k="name" value="${esc(m.name)}" placeholder="Name" aria-label="Name">
        <select data-i="${i}" data-k="role" data-native aria-label="Role">${App.ui.options([{ value: 'self', label: 'Me' }, { value: 'spouse', label: 'Spouse / partner' }, { value: 'child', label: 'Child' }, { value: 'parent', label: 'Parent' }, { value: 'other', label: 'Other' }], m.role)}</select>
        <input type="number" data-i="${i}" data-k="birthYear" value="${esc(m.birthYear || '')}" placeholder="Birth year" aria-label="Birth year (for catch-up limits)" style="width:110px">
        ${list.length > 1 ? `<button class="btn small ghost danger" data-rm="${i}">Remove</button>` : ''}</div>`).join('');
      card.querySelectorAll('[data-k]').forEach(inp => inp.oninput = () => { list[+inp.dataset.i][inp.dataset.k] = inp.value; });
      card.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { list.splice(+b.dataset.rm, 1); draw(card); });
    };
    App.ui.modal(`<div class="card-head"><div><h2>Family members</h2><div class="muted small">Each person gets their own view of every account, unit and tax item. Birth year is used for catch-up contribution limits (50+, 55+ for HSA, 60–63).</div></div><button class="btn small ghost" data-close>Cancel</button></div>
      <div class="stack" id="fmList"></div>
      <div class="row"><button class="btn small" id="fmAdd">+ Add person</button></div>
      <div class="confirm-actions"><button class="btn primary" id="fmSave">Save family members</button></div>`, (card, close) => {
      card.classList.add('wide');
      draw(card);
      card.querySelector('#fmAdd').onclick = () => { list.push({ id: App.uid(), name: '', role: list.some(m => m.role === 'spouse') ? 'child' : 'spouse', color: COLORS[list.length % COLORS.length] }); draw(card); card.querySelector('#fmList .fm-row:last-child input[data-k=name]').focus(); };
      card.querySelector('#fmSave').onclick = () => {
        const clean = list.filter(m => (m.name || '').trim()).map(m => ({ ...m, name: m.name.trim(), birthYear: m.birthYear ? +m.birthYear : '' }));
        if (!clean.length) return App.ui.toast('Keep at least one person');
        W().saveMembers(clean);
        if (!clean.some(m => m.id === W().person())) W().setPerson('all');
        close(); App.ui.toast('Family members saved'); after?.();
      };
    });
  }

  /* ---------- Account dialog ---------- */
  function accountDialog(a, after) {
    const isNew = !a;
    const units = App.biz.inView().filter(b => App.biz.kindOf(b) === 'individual');
    const unitId = a?.unit?.id || (App.biz.isMaster() ? units[0]?.id : App.biz.current());
    if (!unitId) return App.ui.toast('Add a personal unit first (Units → Personal).');
    const acc = a ? { ...a } : { id: App.uid(), name: '', institution: '', type: 'checking', owner: W().person() === 'all' ? (App.biz.get(unitId)?.owner || 'joint') : W().person(), balance: '', asOf: today(), history: [] };
    const T = W().TYPES;
    const owners = [...W().members().map(m => ({ value: m.id, label: m.name })), { value: 'joint', label: 'Joint / family' }];
    App.ui.modal(`<div class="card-head"><h2>${isNew ? 'Add account' : `Edit ${esc(acc.name)}`}</h2><button class="btn small ghost" data-close>Cancel</button></div>
      <div class="stack form-group" style="gap:20px">
        <div class="mapper">
          <label>Account name<input id="aN" value="${esc(acc.name)}" placeholder="e.g. Joint checking, Koen 401(k), Home"></label>
          <label>Institution<input id="aI" value="${esc(acc.institution || '')}" placeholder="e.g. Chase, Fidelity, Schwab"></label>
          <label>Type<select id="aT" data-native>${Object.entries(T).map(([k, v]) => `<option value="${k}" ${k === acc.type ? 'selected' : ''}>${v.side === 'debt' ? 'Debt · ' : ''}${esc(v.label)}</option>`).join('')}</select></label>
          <label>Belongs to<select id="aO" data-native>${App.ui.options(owners, acc.owner || 'joint')}</select></label>
          <label>Tax treatment<select id="aX" data-native>${App.ui.options(Object.entries(W().TAX).map(([value, label]) => ({ value, label })), acc.tax || T[acc.type].tax)}</select></label>
          ${units.length > 1 || App.biz.isMaster() ? `<label>Personal unit<select id="aU" data-native>${App.ui.options(units.map(u => ({ value: u.id, label: u.name })), unitId)}</select></label>` : ''}
        </div>
        <div class="mapper">
          <label><span id="aBl">${T[acc.type].side === 'debt' ? 'Amount owed' : 'Current balance / value'}</span><input id="aB" type="number" step="0.01" value="${esc(acc.balance)}" placeholder="0.00"></label>
          <label>As of<input id="aD" type="date" value="${esc(acc.asOf || today())}"></label>
          <label>Interest rate % <span class="tiny">(optional)</span><input id="aR" type="number" step="0.01" value="${esc(acc.rate ?? '')}"></label>
        </div>
        <label class="field">Notes<textarea id="aNo" rows="2" placeholder="Beneficiaries, login hint (never passwords), employer match…">${esc(acc.notes || '')}</textarea></label>
        <div class="confirm-actions form-submit" style="margin-top:4px">${isNew ? '' : '<button class="btn danger" id="aDel">Delete account…</button>'}<button class="btn primary" id="aSave">${isNew ? 'Add account' : 'Save changes'}</button></div>
      </div>`, (card, close) => {
      card.classList.add('wide');
      const $ = q => card.querySelector(q);
      $('#aT').onchange = () => { $('#aX').value = T[$('#aT').value].tax; $('#aBl').textContent = T[$('#aT').value].side === 'debt' ? 'Amount owed' : 'Current balance / value'; };
      $('#aSave').onclick = async () => {
        const name = $('#aN').value.trim();
        if (!name) return App.ui.toast('Give the account a name');
        const u = $('#aU')?.value || unitId;
        const prevUnit = a?.unit?.id;
        const { unit, signed, side, group, ...base } = acc;
        const next = { ...base, name, institution: $('#aI').value.trim(), type: $('#aT').value, owner: $('#aO').value, tax: $('#aX').value, rate: $('#aR').value === '' ? '' : +$('#aR').value, notes: $('#aNo').value.trim() };
        const bal = $('#aB').value;
        if (bal !== '' && (+bal !== +acc.balance || $('#aD').value !== acc.asOf)) W().setBalance(next, bal, $('#aD').value || today());
        if (prevUnit && prevUnit !== u) await App.biz.withBiz(prevUnit, () => W().removeAccount(next.id));
        await App.biz.withBiz(u, () => W().saveAccount(next));
        close(); App.ui.toast(isNew ? `Added ${name}` : `Saved ${name}`); after?.();
      };
      $('#aDel')?.addEventListener('click', async () => {
        if (!await App.confirm({ title: `Delete ${acc.name}?`, body: 'Its balance history leaves your net worth. Statements you uploaded stay in the Data Library.', ok: 'Delete account', cancel: 'Keep account', danger: true })) return;
        await App.biz.withBiz(unitId, () => W().removeAccount(acc.id)); close(); after?.();
      });
    });
  }

  /* Update every balance in one go (adds a history point to each) */
  function balancesDialog(list, after) {
    if (!list.length) return App.ui.toast('Add an account first');
    App.ui.modal(`<div class="card-head"><div><h2>Update balances</h2><div class="muted small">Type today's balances from your bank and brokerage apps. Each update adds a point to the net-worth history.</div></div><button class="btn small ghost" data-close>Cancel</button></div>
      <div class="stack">${list.map((a, i) => `<label class="bal-row"><span><b>${esc(a.name)}</b> <span class="muted tiny">${esc(a.institution || '')} · ${esc(W().memberName(a.owner))} · last ${a.asOf ? fmt.date(a.asOf) : 'never'}</span></span>
        <input type="number" step="0.01" data-i="${i}" value="${esc(a.balance ?? '')}" aria-label="${esc(a.name)} balance"></label>`).join('')}</div>
      <div class="confirm-actions"><button class="btn primary" id="bSave">Save balances</button></div>`, (card, close) => {
      card.querySelector('#bSave').onclick = async () => {
        let n = 0;
        for (const inp of card.querySelectorAll('[data-i]')) {
          const a = list[+inp.dataset.i];
          if (inp.value === '' || +inp.value === +a.balance && a.asOf === today()) continue;
          const { unit, signed, side, group, ...base } = a;
          await App.biz.withBiz(a.unit.id, () => W().saveAccount(W().setBalance(base, inp.value)));
          n++;
        }
        close(); App.ui.toast(`Updated ${n} balance${n === 1 ? '' : 's'}`); after?.();
      };
    });
  }

  /* Import holdings from a positions table (Schwab, Fidelity, Vanguard, Robinhood, Webull, E*TRADE, Dub exports) */
  async function importDialog(after) {
    const units = App.biz.inView().filter(b => App.biz.kindOf(b) === 'individual');
    if (!units.length) return App.ui.toast('Add a personal unit first (Units → Personal).');
    const all = (await App.store.all('datasets', { raw: true })).filter(d => units.some(u => u.id === App.biz.idOf(d)) || !App.biz.isMaster());
    const F = {
      sym: ['symbol', 'ticker', 'instrument', 'security'], name: ['description', 'investment name', 'security name', 'name'],
      qty: ['quantity', 'qty', 'shares', 'units', 'total qty'], mv: ['market value', 'current value', 'total value', 'mkt value', 'value', 'balance'],
      cost: ['cost basis total', 'cost basis', 'total cost', 'cost'], upl: ['gain/loss $', 'total gain/loss dollar', 'unrealized p&l', 'gain/loss', 'unrealized', 'total return'],
      acct: ['account name', 'account', 'account number', 'account type', 'portfolio']
    };
    const map = d => Object.fromEntries(Object.entries(F).map(([k, syn]) => [k, App.findCol(d.headers, syn)]));
    const cands = all.map(d => ({ d, m: map(d) })).filter(x => x.m.sym && x.m.mv).sort((a, b) => (b.d.createdAt || 0) - (a.d.createdAt || 0));
    if (!cands.length) {
      return App.ui.modal(`<div class="card-head"><h2>Import brokerage positions</h2><button class="btn small ghost" data-close>Close</button></div>
        <div class="stack small"><p>Upload a positions export from your brokerage first (CSV or Excel), then come back here.</p>
        <ul><li><b>Schwab:</b> Accounts → Positions → Export</li><li><b>Fidelity:</b> Positions → Download (Portfolio_Positions.csv)</li><li><b>Vanguard:</b> Balances &amp; holdings → Download</li><li><b>Robinhood / Webull / E*TRADE:</b> Portfolio or Positions → Export to CSV</li></ul>
        <label class="btn primary" style="align-self:flex-start">${App.fx.icon('upload')} Upload positions file<input type="file" id="ipUp" accept=".csv,.xlsx,.xls" hidden></label></div>`, (card, close) => {
        card.querySelector('#ipUp').onchange = async e => { const f = [...e.target.files]; if (!f.length) return; close(); await App.ingest.ingestMany(f, { quiet: true, category: 'trading' }); importDialog(after); };
      });
    }
    const owners = [...W().members().map(m => ({ value: m.id, label: m.name })), { value: 'joint', label: 'Joint / family' }];
    App.ui.modal(`<div class="card-head"><div><h2>Import brokerage positions</h2><div class="muted small">Each brokerage account in the file becomes an investment account with its holdings. Importing a newer file updates the balances.</div></div><button class="btn small ghost" data-close>Cancel</button></div>
      <div class="stack form-group" style="gap:16px">
        <div class="mapper"><label>Positions table<select id="ipD" data-native>${cands.map(x => `<option value="${x.d.id}">${esc(x.d.name)} (${x.d.rows.length} rows)</option>`).join('')}</select></label>
          <label>Institution<input id="ipI" placeholder="e.g. Fidelity"></label>
          <label>Belongs to<select id="ipO" data-native>${App.ui.options(owners, W().person() === 'all' ? 'joint' : W().person())}</select></label>
          ${units.length > 1 ? `<label>Personal unit<select id="ipU" data-native>${App.ui.options(units.map(u => ({ value: u.id, label: u.name })), units.find(u => /invest|trad/i.test(u.type))?.id || units[0].id)}</select></label>` : ''}</div>
        <div id="ipPrev"></div>
        <div class="confirm-actions"><button class="btn primary" id="ipGo">Import accounts</button></div>
      </div>`, (card, close) => {
      card.classList.add('wide');
      const $ = q => card.querySelector(q);
      let groups = [];
      const preview = () => {
        const { d, m } = cands.find(x => x.d.id === $('#ipD').value);
        const by = new Map();
        for (const r of d.rows) {
          const sym = String(r[m.sym] || '').trim();
          if (!sym || /^(total|account total|pending|cash & cash investments)$/i.test(sym)) continue;
          const acct = m.acct ? String(r[m.acct] || '').trim() || 'Brokerage' : d.name.replace(/\.[^.]+$/, '');
          const g = by.get(acct) || { name: acct, holdings: [] };
          const mv = App.n0(r[m.mv]), cost = m.cost ? App.n0(r[m.cost]) : NaN;
          g.holdings.push({ symbol: sym, name: m.name ? String(r[m.name] || '') : '', qty: m.qty ? App.n0(r[m.qty]) : NaN, value: mv, cost, upl: m.upl ? App.n0(r[m.upl]) : (isNaN(cost) ? NaN : mv - cost) });
          by.set(acct, g);
        }
        groups = [...by.values()].map(g => ({ ...g, total: g.holdings.reduce((s, h) => s + h.value, 0), type: W().guessType(g.name) }));
        $('#ipPrev').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Account</th><th>Type (guessed)</th><th class="num">Holdings</th><th class="num">Value</th></tr></thead><tbody>${groups.map((g, i) => `<tr><td>${esc(g.name)}</td>
          <td><select data-g="${i}" data-native>${Object.entries(W().TYPES).filter(([, t]) => t.group === 'invest' || t.group === 'retire' || t.group === 'cash').map(([k, t]) => `<option value="${k}" ${k === g.type ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></td>
          <td class="num">${g.holdings.length}</td><td class="num">${money(g.total)}</td></tr>`).join('')}</tbody></table></div>`;
        card.querySelectorAll('[data-g]').forEach(s => s.onchange = () => { groups[+s.dataset.g].type = s.value; });
      };
      $('#ipD').onchange = preview;
      preview();
      $('#ipGo').onclick = async () => {
        const u = $('#ipU')?.value || units[0].id, inst = $('#ipI').value.trim(), owner = $('#ipO').value, dsId = $('#ipD').value;
        await App.biz.withBiz(u, () => {
          for (const g of groups) {
            const key = `pos:${inst.toLowerCase()}:${g.name.toLowerCase()}`;
            const existing = W().accounts().find(a => a.src === key);
            const acc = existing || { id: App.uid(), src: key, name: inst && !g.name.toLowerCase().includes(inst.toLowerCase()) ? `${inst} ${g.name}` : g.name, institution: inst, type: g.type, owner, history: [] };
            Object.assign(acc, { type: g.type, tax: W().TYPES[g.type].tax, holdings: g.holdings, positionsDs: dsId });
            W().saveAccount(W().setBalance(acc, g.total.toFixed(2)));
          }
        });
        close(); App.ui.toast(`Imported ${groups.length} account${groups.length === 1 ? '' : 's'}`); after?.();
      };
    });
  }

  /* ---------- Page ---------- */
  App.modules.wealth = {
    personBar, wirePersonBar, membersDialog,
    async render(view) {
      const rerender = () => App.go('wealth');
      const list = await W().collect();
      const s = W().summarize(list);
      const roll = App.biz.isMaster();
      const p = W().person();
      const who = p === 'all' ? (roll ? 'the family' : 'this unit') : W().memberName(p);
      App.ui.publish('wealth', { net: s.net, assets: s.assets, debts: s.debts, invested: s.invested, liquid: s.liquid, accounts: s.count, alerts: list.filter(a => a.asOf && (Date.now() - new Date(a.asOf)) / 864e5 > 45).length });
      const stale = list.filter(a => !a.asOf || (Date.now() - new Date(a.asOf)) / 864e5 > 45);
      const owners = [...new Set(list.map(a => a.owner))];
      const harvest = W().harvestable(s.holdings);
      view.innerHTML = `
        <div class="card stack" style="gap:14px">
          <div class="row spread"><div><h2>${roll ? 'Family wealth' : 'Net worth'}</h2><div class="muted small">${roll ? `${App.biz.units('individual').length} personal units` : esc(App.biz.get(App.biz.current())?.name || '')} · showing ${esc(who)}${p !== 'all' ? ' (their accounts + joint accounts)' : ''}</div></div>
            <div class="row"><button class="btn primary" id="wAdd">${App.fx.icon('plus')} Add account</button><button class="btn" id="wImp">${App.fx.icon('upload')} Import brokerage positions</button><button class="btn" id="wBal">Update balances</button></div></div>
          ${personBar()}
        </div>
        ${!list.length ? App.ui.empty(`No accounts yet${p !== 'all' ? ' for ' + esc(who) : ''}. Add checking, savings, retirement and brokerage accounts, your home and any debts. Or import a positions file from Schwab, Fidelity, Vanguard, Robinhood or Webull.`, '<div class="row" style="justify-content:center"><button class="btn primary" data-wadd>Add account</button><button class="btn" data-wimp>Import brokerage positions</button></div>') : `
        <div class="grid k4">
          ${App.ui.kpi('Net worth', money(s.net), `${money(s.assets)} assets − ${money(s.debts)} debts`, s.net >= 0 ? 'good' : 'bad', false)}
          ${App.ui.kpi('Invested', money(s.invested), `${s.assets ? Math.round(s.invested / s.assets * 100) : 0}% of assets · retirement, brokerage, HSA, 529`, '', false)}
          ${App.ui.kpi('Cash', money(s.liquid), 'checking, savings, money market', '', false)}
          ${App.ui.kpi('Debts', money(s.debts), s.debts ? `${Math.round(s.debts / (s.assets || 1) * 100)}% of assets` : 'debt-free', s.debts > s.assets * 0.5 ? 'warn' : '', false)}
          ${!isNaN(s.change) ? App.ui.kpi('Change', (s.change >= 0 ? '+' : '') + money(s.change), `since ${fmt.date(s.changeFrom)} on accounts tracked since then`, s.change >= 0 ? 'good' : 'bad', false) : ''}
        </div>
        ${stale.length ? `<div class="alert warn small"><span>${stale.length} balance${stale.length === 1 ? ' is' : 's are'} more than 45 days old: ${esc(stale.slice(0, 4).map(a => a.name).join(', '))}${stale.length > 4 ? '…' : ''}</span><button class="btn small" data-wbal>Update balances</button></div>` : ''}
        ${p === 'all' && (owners.length > 1 || W().members().length > 1) ? `<div class="grid k4">${[...W().members().map(m => m.id), 'joint'].filter(id => s.byOwner.has(id)).map(id => {
          const m = W().member(id), v = s.byOwner.get(id);
          return `<button class="card member-card" data-person="${id}" style="--mc:${m?.color || '#64748b'}"><span class="pdot lg" style="background:${m?.color || '#64748b'}">${esc((m?.name || 'J')[0])}</span><span><span class="muted tiny">${esc(id === 'joint' ? 'Joint / family' : m.role === 'self' ? 'You' : m.role)}</span><b>${esc(W().memberName(id))}</b><span class="mc-v">${money(v)}</span><span class="muted tiny">${s.net ? Math.round(v / s.net * 100) : 0}% of net worth · view →</span></span></button>`;
        }).join('')}</div>` : ''}
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Net worth over time</h2><span class="muted small">month-end, from balance history</span></div>${s.history.length > 1 ? '<div class="chart-box"><canvas id="wHist"></canvas></div>' : '<div class="muted small">Update balances over a few months (or import statements) to see the trend.</div>'}</div>
          <div class="card"><div class="card-head"><h2>Where it is</h2></div><div class="chart-box"><canvas id="wMix"></canvas></div></div>
        </div>
        <div class="grid c2">
          <div class="card"><div class="card-head"><h2>Tax buckets</h2><span class="muted small">how withdrawals will be taxed</span></div>
            <div class="stack">${[...s.byTax].sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="tb-row"><span>${esc(W().TAX[k] || k)}</span><span class="tb-bar"><i style="width:${Math.round(v / Math.max(...s.byTax.values()) * 100)}%"></i></span><b>${money(v)}</b></div>`).join('') || '<div class="muted small">No investment accounts yet.</div>'}</div>
            <div class="muted tiny" style="margin-top:8px">Taxable: gains taxed when sold · Tax-deferred: taxed as income when withdrawn · Roth and HSA (for medical costs): tax-free · 529: tax-free for education.</div></div>
          <div class="card"><div class="card-head"><h2>Debts</h2></div>${list.filter(a => a.side === 'debt').length ? `<div class="stack">${list.filter(a => a.side === 'debt').sort((a, b) => (+b.rate || 0) - (+a.rate || 0)).map(a => `<div class="row spread small"><span><b>${esc(a.name)}</b> <span class="muted tiny">${esc(W().TYPES[a.type].label)}${a.rate !== '' && a.rate != null ? ` · ${a.rate}%` : ''}</span></span><b>${money(a.balance)}</b></div>`).join('')}</div><div class="muted tiny" style="margin-top:8px">Sorted by interest rate: paying the highest rate first saves the most.</div>` : '<div class="alert good small">No debts recorded.</div>'}</div>
        </div>
        <div class="card"><div class="card-head"><h2>Accounts</h2><span class="badge">${list.length}</span></div><div id="wAcc"></div></div>
        ${s.holdings.length ? `<div class="card"><div class="card-head"><h2>Holdings</h2><span class="muted small">${s.holdings.length} positions from imported statements${harvest.length ? ` · <a data-go="tax">${harvest.length} tax-loss candidates →</a>` : ''}</span></div><div id="wHold"></div></div>` : ''}`}`;

      const $ = q => view.querySelector(q);
      wirePersonBar(view, rerender);
      $('#wAdd').onclick = () => accountDialog(null, rerender);
      $('#wImp').onclick = () => importDialog(rerender);
      $('#wBal').onclick = () => balancesDialog(list, rerender);
      view.querySelector('[data-wadd]')?.addEventListener('click', () => accountDialog(null, rerender));
      view.querySelector('[data-wimp]')?.addEventListener('click', () => importDialog(rerender));
      view.querySelector('[data-wbal]')?.addEventListener('click', () => balancesDialog(list, rerender));
      if (!list.length) return;

      if (s.history.length > 1) App.ui.chart('wHist', 'line', { labels: s.history.map(h => fmt.date(h.date)), datasets: [{ label: 'Net worth', data: s.history.map(h => +h.net.toFixed(2)), fill: true, pointRadius: 3 }] });
      const mix = [...s.byGroup].filter(([g]) => g !== 'debt');
      App.ui.chart('wMix', 'doughnut', { labels: mix.map(([g]) => W().GROUPS[g]), datasets: [{ data: mix.map(([, v]) => +v.toFixed(2)) }] });
      App.ui.table($('#wAcc'), [
        { key: 'name', label: 'Account', fmt: (v, r) => `<b>${esc(v)}</b>${r.institution ? `<div class="muted tiny">${esc(r.institution)}</div>` : ''}` },
        { key: 'typeL', label: 'Type' }, { key: 'ownerL', label: 'Belongs to' }, ...(roll ? [{ key: 'unitL', label: 'Unit' }] : []), { key: 'taxL', label: 'Tax' },
        { key: 'signed', label: 'Balance', num: true, fmt: v => `<span style="color:var(${v < 0 ? '--bad' : '--text'})">${money(v)}</span>` },
        { key: 'asOf', label: 'As of', fmt: v => v ? fmt.date(v) : '—' },
        { key: 'id', label: '', fmt: v => `<button class="btn small" data-ea="${v}">Edit</button>` }
      ], list.map(a => ({ ...a, typeL: W().TYPES[a.type]?.label || a.type, ownerL: W().memberName(a.owner), unitL: a.unit.name, taxL: W().TAX[a.tax] || '' })), { sortKey: 'signed' });
      view.querySelectorAll('[data-ea]').forEach(b => b.onclick = () => accountDialog(list.find(a => a.id === b.dataset.ea), rerender));
      if ($('#wHold')) App.ui.table($('#wHold'), [
        { key: 'symbol', label: 'Symbol', fmt: (v, r) => `<b>${esc(v)}</b>${r.name ? `<div class="muted tiny">${esc(r.name.slice(0, 40))}</div>` : ''}` }, { key: 'account', label: 'Account' },
        { key: 'qty', label: 'Shares', num: true, fmt: v => isNaN(v) ? '—' : fmt.num(v, 3) }, { key: 'value', label: 'Value', num: true, fmt: v => money(v) },
        { key: 'upl', label: 'Gain / loss', num: true, fmt: v => isNaN(v) ? '—' : `<span style="color:var(${v < 0 ? '--bad' : '--good'})">${money(v)}</span>` },
        { key: 'pct', label: 'Of portfolio', num: true, fmt: v => fmt.pct(v) }
      ], s.holdings.map(h => ({ ...h, pct: s.invested ? h.value / s.invested : NaN })), { sortKey: 'value' });
    }
  };
  App.wealthUI = { personBar, wirePersonBar, membersDialog, accountDialog, importDialog };
})(window.App);
