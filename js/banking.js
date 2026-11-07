/* Banking & payments: turns statements from Cash App, Venmo, PayPal, banks and card issuers (CSV, Excel,
   OFX / QFX / QBO), Square, Stripe and budgeting apps into one transactions table per unit, a daily cash-flow
   table (Financials, Weekly Review, Calendar) and, for personal units, Net Worth balances.
   Live connections (Plaid for banks, Square for Cash App for Business / Square POS, Stripe) go through the
   local relay with your own keys; keys are encrypted by the operating system in the desktop app. */
(function (App) {
  const HEAD = ['Date', 'Description', 'Amount', 'Money in', 'Money out', 'Category', 'Type', 'Account', 'Source', 'Balance', 'Txn ID'];

  /* ---------- Parsing helpers ---------- */
  const lc = s => String(s ?? '').trim().toLowerCase();
  function money(v) {
    if (typeof v === 'number') return v;
    let s = String(v ?? '').trim();
    if (!s) return NaN;
    const neg = /^\(.*\)$/.test(s) || /^\s*[-−]/.test(s) || /[-−]\s*\$|\$\s*[-−]/.test(s);
    s = s.replace(/[^0-9.]/g, '');
    if (!s) return NaN;
    const n = parseFloat(s);
    return neg ? -n : n;
  }
  const pad = n => String(n).padStart(2, '0');
  const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function date(v) {
    if (v instanceof Date && !isNaN(v)) return isoLocal(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) return isoLocal(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4));
    const s = String(v ?? '').trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[1])}-${pad(m[2])}`;
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`; // OFX 20261031120000
    const d = App.toDate ? App.toDate(s) : new Date(s);
    return d && !isNaN(d) ? isoLocal(d) : '';
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  /* ---------- Categories & transfers ---------- */
  const TRANSFER = /\b(transfer|xfer|to savings|from savings|to checking|from checking|online banking transfer|payment thank you|autopay payment|thank you for your payment|payment\s*-\s*thank you|autopay (?:payment|pymt)|internet payment|mobile payment|online payment|card payment|credit card payment|crd pmt|epay|cash out|add cash|instant transfer|standard transfer|transfer to bank|bank transfer|deposit from bank|move money|internal)\b/i;
  const CATS = [
    [/payroll|direct dep|salary|paycheck|wages|adp|gusto|paychex|employer/i, 'Income: pay'],
    [/interest paid|interest earned|dividend/i, 'Income: interest & dividends'],
    [/refund|reversal|cashback|cash back|boost/i, 'Refunds & rewards'],
    [/rent|mortgage|landlord|property mgmt|apartments?\b|hoa\b/i, 'Housing'],
    [/electric|power|energy|gas co|water|sewer|utility|utilities|duke|aes |citizens|xfinity|comcast|spectrum|verizon|at&t|t-mobile|internet|wireless/i, 'Utilities & phone'],
    [/insurance|geico|state farm|progressive|allstate|usaa ins|aflac/i, 'Insurance'],
    [/loan|navient|nelnet|mohela|sallie|auto pay|car payment|toyota fin|honda fin|ally auto/i, 'Loan payments'],
    [/netflix|hulu|spotify|disney|apple\.com|google \*|youtube|amazon prime|max\.com|paramount|peacock|subscription|patreon|adobe|microsoft/i, 'Subscriptions'],
    [/kroger|walmart|aldi|meijer|costco|sam'?s club|target|whole foods|trader joe|publix|grocery|safeway|heb\b|food lion|wegmans/i, 'Groceries & household'],
    [/mcdonald|starbucks|chipotle|jersey mike|subway|wendy|taco bell|doordash|uber eats|grubhub|restaurant|cafe|coffee|pizza|chick-fil|panera|dunkin|bar & grill/i, 'Dining'],
    [/shell|bp\b|exxon|chevron|speedway|marathon|circle k|sunoco|fuel|gas station|thorntons|casey/i, 'Gas & auto'],
    [/uber|lyft|parking|toll|airline|delta|united|southwest|american air|hotel|airbnb|marriott|hilton/i, 'Travel & transport'],
    [/amazon|amzn|ebay|etsy|best buy|home depot|lowe|ikea|shop|store/i, 'Shopping'],
    [/sysco|us foods|gordon food|pfg|restaurant depot|vendor|supply/i, 'Business supplies'],
    [/irs|treasury|tax|state of .* dept/i, 'Taxes'],
    [/atm|cash withdrawal|withdrawal/i, 'Cash & ATM'],
    [/fee|service charge|overdraft|nsf|maintenance/i, 'Bank fees'],
    [/cash app|venmo|zelle|paypal|apple cash|\bp2p\b/i, 'Payments to people']
  ];
  // Money coming in only gets an income-type category (pay, interest, refunds), never a spending one
  const guessCat = (desc, amt) => { for (const [re, c] of amt > 0 ? CATS.slice(0, 3) : CATS.slice(3)) if (re.test(desc)) return c; return amt > 0 ? 'Income: other' : 'Other spending'; };

  /* ---------- Statement layouts ---------- */
  // pick(cols) returns the first header that matches; `flip` = the file shows money out as positive numbers
  const PROFILES = [
    { id: 'cashapp', label: 'Cash App', when: h => h.includes('transaction id') && (h.includes('net amount') || h.includes('name of sender/receiver')),
      date: ['date'], desc: ['name of sender/receiver', 'notes'], amount: ['net amount', 'amount'], type: ['transaction type'], status: ['status'], tid: ['transaction id'] },
    { id: 'venmo', label: 'Venmo', when: h => h.some(x => x.startsWith('amount (total)')),
      date: ['datetime', 'date'], desc: ['note'], amount: ['amount (total)'], type: ['type'], status: ['status'], tid: ['id'], from: ['from'], to: ['to'] },
    { id: 'paypal', label: 'PayPal', when: h => h.includes('gross') && h.includes('net') && (h.includes('balance impact') || h.includes('transaction id') || h.includes('type')),
      date: ['date'], desc: ['name', 'item title', 'subject', 'type'], amount: ['net'], type: ['type'], status: ['status'], tid: ['transaction id'], impact: ['balance impact'] },
    { id: 'square', label: 'Square', when: h => h.includes('net total') && (h.includes('gross sales') || h.includes('total collected')),
      date: ['date'], desc: ['description', 'source', 'device name'], amount: ['net total'], tid: ['payment id', 'transaction id'], income: true },
    { id: 'stripe', label: 'Stripe', when: h => h.some(x => x.startsWith('created')) && h.includes('net') && h.includes('fee'),
      date: ['created (utc)', 'created'], desc: ['description', 'type'], amount: ['net'], type: ['type'], tid: ['id', 'balance transaction id'] },
    { id: 'rocket', label: 'Rocket Money', when: h => h.includes('custom name') && h.includes('institution name'),
      date: ['date'], desc: ['custom name', 'name', 'description'], amount: ['amount'], cat: ['category'], acct: ['account name'], flip: true },
    { id: 'mint', label: 'Mint', when: h => h.includes('transaction type') && h.includes('original description'),
      date: ['date'], desc: ['description'], amount: ['amount'], dc: ['transaction type'], cat: ['category'], acct: ['account name'] },
    { id: 'monarch', label: 'Monarch', when: h => h.includes('merchant') && h.includes('original statement'),
      date: ['date'], desc: ['merchant'], amount: ['amount'], cat: ['category'], acct: ['account'] },
    { id: 'ynab', label: 'YNAB', when: h => h.includes('outflow') && h.includes('inflow') && h.includes('payee'),
      date: ['date'], desc: ['payee', 'memo'], out: ['outflow'], in: ['inflow'], cat: ['category'], acct: ['account'] },
    { id: 'amex', label: 'American Express', when: (h, n) => /amex|american ?express/i.test(n) || h.includes('card member') || h.includes('extended details'),
      date: ['date'], desc: ['description'], amount: ['amount'], cat: ['category'], flip: true, card: true },
    { id: 'discover', label: 'Discover', when: h => h.includes('trans. date'),
      date: ['trans. date', 'post date'], desc: ['description'], amount: ['amount'], cat: ['category'], flip: true, card: true },
    { id: 'capone', label: 'Capital One', when: h => h.includes('card no.') && h.includes('debit') && h.includes('credit'),
      date: ['transaction date', 'posted date'], desc: ['description'], out: ['debit'], in: ['credit'], cat: ['category'], card: true },
    { id: 'chasecard', label: 'Chase card', when: h => h.includes('transaction date') && h.includes('post date') && h.includes('memo'),
      date: ['transaction date'], desc: ['description'], amount: ['amount'], cat: ['category'], card: true },
    { id: 'bank', label: 'Bank', when: () => true,
      date: ['transaction date', 'trans date', 'posting date', 'posted date', 'date posted', 'date', 'effective date'],
      desc: ['description', 'merchant', 'payee', 'name', 'transaction description', 'details', 'memo', 'narrative'],
      amount: ['amount', 'transaction amount', 'net amount'], out: ['withdrawals', 'withdrawal', 'debit', 'debits', 'withdrawal amount', 'debit amount', 'money out'],
      in: ['deposits', 'deposit', 'credit', 'credits', 'deposit amount', 'credit amount', 'money in'], cat: ['category'], bal: ['balance', 'running bal.', 'running balance', 'available balance'], acct: ['account', 'account name'] }
  ];
  const BANK_NAMES = [[/chase/i, 'Chase'], [/bank ?of ?america|bofa|\bboa\b/i, 'Bank of America'], [/wells/i, 'Wells Fargo'], [/capital ?one|capone/i, 'Capital One'], [/citi/i, 'Citi'],
    [/\bally\b/i, 'Ally'], [/us ?bank|usbank/i, 'U.S. Bank'], [/pnc/i, 'PNC'], [/navy ?fed|nfcu/i, 'Navy Federal'], [/fifth ?third|53/i, 'Fifth Third'], [/huntington/i, 'Huntington'],
    [/truist/i, 'Truist'], [/td ?bank/i, 'TD Bank'], [/regions/i, 'Regions'], [/usaa/i, 'USAA'], [/chime/i, 'Chime'], [/sofi/i, 'SoFi'], [/schwab/i, 'Schwab'], [/fidelity/i, 'Fidelity'],
    [/marcus/i, 'Marcus'], [/discover/i, 'Discover'], [/amex|american ?express/i, 'American Express'], [/cash ?app/i, 'Cash App'], [/venmo/i, 'Venmo'], [/paypal/i, 'PayPal']];
  const bankOf = name => (BANK_NAMES.find(([re]) => re.test(name)) || [])[1] || '';
  const last4 = name => { for (const m of String(name).matchAll(/(?:x|\*|…|-|_|ending ?(?:in )?|acct|chase|card|checking|savings)(\d{4})(?!\d)/gi)) if (!/^(19|20)\d\d$/.test(m[1])) return m[1]; return ''; };

  function rowsFromSheet(aoa, fileName) {
    // Wells Fargo downloads have no header row: date, amount, *, check #, description
    const f0 = aoa[0] || [];
    if (f0.length >= 5 && date(f0[0]) && Number.isFinite(money(f0[1])) && String(f0[2]).trim() === '*') aoa = [['Date', 'Amount', 'Flag', 'Check', 'Description'], ...aoa], fileName = /wells/i.test(fileName) ? fileName : 'Wells Fargo ' + fileName;
    // Find the header row (statements often have a summary block on top)
    for (let hi = 0; hi < Math.min(aoa.length, 15); hi++) {
      const head = (aoa[hi] || []).map(lc);
      const idx = names => { for (const n of names || []) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
      const P = PROFILES.find(p => p.when(head, fileName));
      const c = { date: idx(P.date), desc: idx(P.desc), amount: idx(P.amount), out: idx(P.out), in: idx(P.in), cat: idx(P.cat), type: idx(P.type), status: idx(P.status), id: idx(P.tid), acct: idx(P.acct), bal: idx(P.bal), dc: idx(P.dc), from: idx(P.from), to: idx(P.to), impact: idx(P.impact) };
      if (c.date < 0 || (c.amount < 0 && c.out < 0 && c.in < 0)) continue;
      if (P.id === 'bank' && c.desc < 0) continue;
      // Not a statement if it looks like trades, labor or a P&L
      if (['symbol', 'qty', 'quantity', 'clock in', 'employee', 'net sales', 'revenue', 'cogs', 'labor cost'].some(x => head.includes(x)) && P.id === 'bank') return null;
      const src = P.id === 'bank' || P.id === 'chasecard' ? (bankOf(fileName) || (P.id === 'chasecard' ? 'Chase' : 'Bank')) : P.label;
      const acctName = `${src}${last4(fileName) ? ' ••' + last4(fileName) : ''}${P.card || P.id === 'chasecard' ? ' card' : ''}`;
      const out = [];
      const seen = new Map();
      for (const r of aoa.slice(hi + 1)) {
        const d = date(r[c.date]);
        if (!d) continue;
        if (c.status >= 0 && /fail|declin|cancel|pending|denied/i.test(r[c.status] || '')) continue;
        let amt = c.amount >= 0 ? money(r[c.amount]) : (money(r[c.in]) || 0) - (money(r[c.out]) || 0);
        if (c.amount < 0 && !Number.isFinite(money(r[c.in])) && !Number.isFinite(money(r[c.out]))) continue;
        if (!Number.isFinite(amt) || amt === 0) continue;
        if (P.flip) amt = -amt;
        if (c.dc >= 0) amt = /debit/i.test(r[c.dc]) ? -Math.abs(amt) : Math.abs(amt);
        if (c.impact >= 0 && /memo/i.test(r[c.impact])) continue;
        if (P.income) amt = Math.abs(amt);
        let desc = '';
        for (const n of P.desc || []) { const i = head.indexOf(n); if (i >= 0 && String(r[i] ?? '').trim()) { desc = String(r[i]).trim(); break; } }
        if (P.id === 'square') desc = `Square sale${desc ? ' (' + desc + ')' : ''}`;
        if (P.id === 'venmo') desc = `${amt > 0 ? r[c.from] : r[c.to]}${desc ? ': ' + desc : ''}`;
        if (P.id === 'cashapp' && !desc) desc = String(r[c.type] || 'Cash App');
        if (!desc) desc = c.type >= 0 ? String(r[c.type]) : src;
        const tyHint = c.type >= 0 ? String(r[c.type] || '') : '';
        const srcCat = c.cat >= 0 ? String(r[c.cat] || '') : '';
        // Paying a card off is a transfer, not income or spending
        const transfer = TRANSFER.test(desc) || TRANSFER.test(tyHint) || /^(payout|transfer)$/i.test(tyHint) || /^payments?\b|payment\/credit|payments and credits/i.test(srcCat) || (P.card || P.id === 'chasecard') && amt > 0 && /payment|pymt/i.test(desc);
        const cat = transfer ? 'Transfer' : srcCat.trim() ? srcCat.trim() : guessCat(desc + ' ' + tyHint, amt);
        const base = c.id >= 0 && r[c.id] ? `${P.id}:${r[c.id]}` : `${P.id}:${acctName}:${d}:${desc}:${amt.toFixed(2)}`;
        const n = (seen.get(base) || 0) + 1; seen.set(base, n);
        out.push({ Date: d, Description: desc, Amount: Math.round(amt * 100) / 100, 'Money in': amt > 0 ? Math.round(amt * 100) / 100 : 0, 'Money out': amt < 0 ? Math.round(-amt * 100) / 100 : 0,
          Category: cat, Type: transfer || /transfer/i.test(cat) ? 'Transfer' : amt > 0 ? 'Income' : 'Expense',
          Account: c.acct >= 0 && r[c.acct] ? String(r[c.acct]) : acctName, Source: src, Balance: c.bal >= 0 && Number.isFinite(money(r[c.bal])) ? money(r[c.bal]) : '', 'Txn ID': hash(base + '#' + n) });
      }
      if (out.length >= 1) return { rows: out, source: src, profile: P, account: acctName, card: !!P.card || P.id === 'chasecard' };
    }
    return null;
  }

  /* OFX / QFX / QBO (Quicken & QuickBooks Web Connect downloads) */
  function parseOfx(text, fileName) {
    if (!/<OFX>|OFXHEADER/i.test(text)) return null;
    const tag = (blk, t) => (blk.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i')) || [])[1]?.trim() || '';
    const org = tag(text, 'ORG') || bankOf(fileName) || 'Bank';
    const card = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(text);
    const acctId = tag(text, 'ACCTID');
    const account = `${org}${acctId ? ' ••' + acctId.slice(-4) : ''}${card ? ' card' : ''}`;
    const rows = [];
    for (const blk of text.split(/<STMTTRN>/i).slice(1)) {
      const d = date(tag(blk, 'DTPOSTED')), amt = money(tag(blk, 'TRNAMT'));
      if (!d || !Number.isFinite(amt) || !amt) continue;
      const desc = [tag(blk, 'NAME'), tag(blk, 'MEMO')].filter(Boolean).join(' · ') || tag(blk, 'TRNTYPE');
      const transfer = TRANSFER.test(desc) || /XFER/i.test(tag(blk, 'TRNTYPE'));
      rows.push({ Date: d, Description: desc, Amount: amt, 'Money in': amt > 0 ? amt : 0, 'Money out': amt < 0 ? -amt : 0, Category: transfer ? 'Transfer' : guessCat(desc, amt),
        Type: transfer ? 'Transfer' : amt > 0 ? 'Income' : 'Expense', Account: account, Source: org, Balance: '', 'Txn ID': hash(`ofx:${acctId}:${tag(blk, 'FITID') || d + desc + amt}`) });
    }
    const bal = money(tag((text.match(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/i) || [''])[0], 'BALAMT'));
    const balDate = date(tag((text.match(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/i) || [''])[0], 'DTASOF'));
    return rows.length ? { rows, source: org, account, card, balance: Number.isFinite(bal) ? bal : null, balanceDate: balDate } : null;
  }

  /* Report translator (registered with App.reports) */
  function statement(ctx) {
    let r = null;
    if (ctx.ofx) r = parseOfx(ctx.ofx, ctx.name);
    else for (const { aoa } of ctx.sheets || []) { r = rowsFromSheet(aoa, ctx.name); if (r) break; }
    if (!r) return null;
    const ins = r.rows.filter(x => x.Type === 'Income'), outs = r.rows.filter(x => x.Type === 'Expense');
    const sum = l => l.reduce((s, x) => s + Math.abs(x.Amount), 0);
    const dates = r.rows.map(x => x.Date).sort();
    const f = v => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      kind: 'statement', label: `${r.source} statement`, category: 'financial', source: 'bank',
      datasets: [],
      merge: [{ id: 'transactions', key: 'Txn ID', name: 'Bank & payment transactions', headers: HEAD, rows: r.rows, category: 'financial', source: 'bank' }],
      statement: { account: r.account, source: r.source, card: r.card, balance: r.balance ?? null, balanceDate: r.balanceDate || '' },
      summary: [`${r.rows.length} transactions from ${r.account} (${dates[0]} to ${dates[dates.length - 1]})`, `Money in ${f(sum(ins))} · money out ${f(sum(outs))}${r.rows.length - ins.length - outs.length ? ` · ${r.rows.length - ins.length - outs.length} transfers left out of totals` : ''}`],
      lands: [['finance', 'Financials: daily cash flow'], ['calendar', 'Calendar: repeating pay and bills'], ['explorer', 'Data Explorer: all transactions']], warnings: []
    };
  }

  /* ---------- After an import: daily cash flow and (personal) Net Worth balances ---------- */
  async function rebuild(bid, stmt) {
    const tx = await App.store.get('datasets', `transactions-${bid}`);
    if (!tx) return;
    const byDay = new Map();
    for (const r of tx.rows) {
      if (r.Type === 'Transfer') continue;
      const d = byDay.get(r.Date) || { Date: r.Date, Income: 0, Expenses: 0, Net: 0, Transactions: 0 };
      if (r.Amount > 0) d.Income += r.Amount; else d.Expenses += -r.Amount;
      d.Net = Math.round((d.Income - d.Expenses) * 100) / 100; d.Transactions++;
      byDay.set(r.Date, d);
    }
    const rows = [...byDay.values()].sort((a, b) => a.Date.localeCompare(b.Date)).map(d => ({ ...d, Income: Math.round(d.Income * 100) / 100, Expenses: Math.round(d.Expenses * 100) / 100 }));
    await App.store.put('datasets', { id: `cashflow-${bid}`, fileId: null, name: 'Daily cash flow (from bank & payment accounts)', headers: ['Date', 'Income', 'Expenses', 'Net', 'Transactions'], rows, category: 'financial', source: 'bank', businessId: bid, createdAt: Date.now(), rolling: true });
    // Personal units: keep a Net Worth account per bank account with its latest balance
    const unit = App.biz.get(bid);
    if (!unit || App.biz.kindOf(unit) !== 'individual' || !App.wealth) return;
    await App.biz.withBiz(bid, async () => {
      const accts = new Map();
      for (const r of tx.rows) { const a = accts.get(r.Account) || { last: null }; if (r.Balance !== '' && Number.isFinite(+r.Balance) && (!a.last || r.Date >= a.last.Date)) a.last = r; accts.set(r.Account, a); }
      if (stmt?.balance != null) accts.set(stmt.account, { last: { Date: stmt.balanceDate || App.period.today(), Balance: stmt.balance } });
      for (const [name, a] of accts) {
        if (!a.last) continue;
        const card = /card|amex|american express|discover/i.test(name);
        const existing = App.wealth.accounts().find(x => x.name === name) || { id: App.uid(), name, type: card ? 'card' : /saving/i.test(name) ? 'savings' : 'checking', owner: 'joint', institution: name.split(' ••')[0], history: [] };
        App.wealth.saveAccount(App.wealth.setBalance(existing, Math.abs(+a.last.Balance), a.last.Date));
      }
    });
  }

  /* Rows from a live connection go in exactly like a statement */
  async function importRows(bid, rows, meta = {}) {
    const id = `transactions-${bid}`;
    const prev = await App.store.get('datasets', id);
    const byKey = new Map((prev?.rows || []).map(r => [r['Txn ID'], r]));
    let added = 0;
    for (const r of rows) { if (!byKey.has(r['Txn ID'])) added++; byKey.set(r['Txn ID'], r); }
    for (const k of meta.removed || []) byKey.delete(k);
    const all = [...byKey.values()].sort((a, b) => a.Date.localeCompare(b.Date));
    await App.store.put('datasets', { id, fileId: null, name: 'Bank & payment transactions', headers: HEAD, rows: all, category: 'financial', source: 'bank', businessId: bid, createdAt: Date.now(), rolling: true });
    await rebuild(bid, meta.statement);
    App.bus.emit('data-changed', 'datasets');
    return { added, total: all.length };
  }

  /* ---------- Live connections (through the local relay) ---------- */
  const secret = name => App.ai.getKey('bank.' + name);
  const setSecret = (name, v) => App.ai.setKey('bank.' + name, v);
  async function call(provider, method, path, body, key) {
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OCD-Client': '1' }, body: JSON.stringify({ provider, method, path, body, key }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_message || j.error?.message || j.errors?.[0]?.detail || j.error?.message || (typeof j.error === 'string' ? j.error : '') || `${provider} request failed (${r.status})`);
    return j;
  }
  const row = (o) => { const amt = Math.round(o.amt * 100) / 100; const transfer = o.transfer || TRANSFER.test(o.desc); return { Date: o.date, Description: o.desc, Amount: amt, 'Money in': amt > 0 ? amt : 0, 'Money out': amt < 0 ? -amt : 0, Category: o.cat || (transfer ? 'Transfer' : guessCat(o.desc, amt)), Type: transfer ? 'Transfer' : amt > 0 ? 'Income' : 'Expense', Account: o.account, Source: o.source, Balance: o.bal ?? '', 'Txn ID': hash(o.id) }; };

  /* Plaid: banks, credit unions and cards (Chase, BofA, Wells, Capital One, Chime, Navy Federal, …) */
  const plaid = {
    cfg: () => ({ env: 'sandbox', ...App.settings.get('bank.plaid', {}) }),
    items: () => App.settings.get('bank.items', []),
    saveItems: l => App.settings.set('bank.items', l),
    prov: () => (plaid.cfg().env === 'production' ? 'plaid' : 'plaid-sandbox'),
    async creds() { return { client_id: plaid.cfg().clientId, secret: await secret('plaid.secret') }; },
    async connect(bid) {
      const c = await plaid.creds();
      if (!c.client_id || !c.secret) throw new Error('Add your Plaid client ID and secret first.');
      const lt = await call(plaid.prov(), 'POST', '/link/token/create', { ...c, user: { client_user_id: 'ops-command-desk' }, client_name: 'Ops Command Desk', products: ['transactions'], country_codes: ['US'], language: 'en' });
      await new Promise((res, rej) => { if (window.Plaid) return res(); const s = document.createElement('script'); s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load Plaid Link. Check your internet connection.')); document.head.appendChild(s); });
      const pub = await new Promise((res, rej) => window.Plaid.create({ token: lt.link_token, onSuccess: (t, meta) => res({ t, meta }), onExit: err => err ? rej(new Error(err.display_message || err.error_message || 'Bank connection was cancelled')) : res(null) }).open());
      if (!pub) return null;
      const ex = await call(plaid.prov(), 'POST', '/item/public_token/exchange', { ...c, public_token: pub.t });
      await setSecret('plaid.item.' + ex.item_id, ex.access_token);
      const item = { id: ex.item_id, institution: pub.meta?.institution?.name || 'Bank', unit: bid, cursor: '', lastSync: 0, env: plaid.cfg().env };
      plaid.saveItems(plaid.items().filter(i => i.id !== item.id).concat(item));
      await plaid.sync(item.id);
      return item;
    },
    async sync(itemId) {
      const item = plaid.items().find(i => i.id === itemId); if (!item) return null;
      const c = await plaid.creds(), access_token = await secret('plaid.item.' + itemId);
      const ac = await call(plaid.prov(), 'POST', '/accounts/get', { ...c, access_token });
      const names = Object.fromEntries(ac.accounts.map(a => [a.account_id, `${item.institution} ${a.name}${a.mask ? ' ••' + a.mask : ''}`]));
      const rows = [], removed = [];
      let cursor = item.cursor || undefined, more = true, guard = 0;
      while (more && guard++ < 30) {
        const s = await call(plaid.prov(), 'POST', '/transactions/sync', { ...c, access_token, cursor, count: 500 });
        for (const t of [...s.added, ...s.modified]) if (!t.pending) rows.push(row({ date: t.authorized_date || t.date, desc: t.merchant_name || t.name, amt: -t.amount, account: names[t.account_id] || item.institution, source: item.institution, id: 'plaid:' + t.transaction_id, cat: t.personal_finance_category ? t.personal_finance_category.primary.replace(/_/g, ' ').toLowerCase().replace(/^\w/, x => x.toUpperCase()) : '', transfer: /TRANSFER|LOAN_PAYMENTS_CREDIT_CARD/.test(t.personal_finance_category?.primary || '') }));
        removed.push(...s.removed.map(r => hash('plaid:' + r.transaction_id)));
        cursor = s.next_cursor; more = s.has_more;
      }
      const res = await importRows(item.unit, rows, { removed });
      // Balances → Net Worth (personal units)
      if (App.biz.kindOf(App.biz.get(item.unit)) === 'individual') await App.biz.withBiz(item.unit, async () => {
        for (const a of ac.accounts) {
          const name = names[a.account_id];
          const type = a.type === 'credit' ? 'card' : a.type === 'loan' ? (/mortgage/.test(a.subtype) ? 'mortgage' : /student/.test(a.subtype) ? 'student' : /auto/.test(a.subtype) ? 'auto' : 'otherDebt') : a.type === 'investment' ? (/401|403|457/.test(a.subtype) ? 'k401' : /roth/.test(a.subtype) ? 'roth' : /ira/.test(a.subtype) ? 'ira' : /hsa/.test(a.subtype) ? 'hsa' : /529/.test(a.subtype) ? 'edu' : 'brokerage') : /saving|money market|cd/.test(a.subtype) ? 'savings' : 'checking';
          const ex = App.wealth.accounts().find(x => x.plaid === a.account_id || x.name === name) || { id: App.uid(), name, type, owner: 'joint', institution: item.institution, plaid: a.account_id, history: [] };
          if (a.balances?.current != null) App.wealth.saveAccount(App.wealth.setBalance({ ...ex, plaid: a.account_id }, Math.abs(a.balances.current)));
        }
      });
      plaid.saveItems(plaid.items().map(i => i.id === itemId ? { ...i, cursor, lastSync: Date.now(), accounts: ac.accounts.length } : i));
      return res;
    },
    async remove(itemId) {
      try { const c = await plaid.creds(); await call(plaid.prov(), 'POST', '/item/remove', { ...c, access_token: await secret('plaid.item.' + itemId) }); } catch (e) { console.warn('Plaid remove', e); }
      await setSecret('plaid.item.' + itemId, '');
      plaid.saveItems(plaid.items().filter(i => i.id !== itemId));
    }
  };

  /* Square: Cash App for Business, Square POS and Square Online sales */
  const square = {
    cfg: () => App.settings.get('bank.square', {}),
    async sync(days = 90) {
      const key = await secret('square'), cfg = square.cfg();
      if (!key) throw new Error('Add your Square access token first.');
      const begin = new Date(Date.now() - days * 864e5).toISOString();
      const rows = []; let cursor = '', guard = 0;
      do {
        const j = await call('square', 'GET', `/v2/payments?begin_time=${encodeURIComponent(begin)}&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, null, key);
        for (const p of j.payments || []) {
          if (p.status !== 'COMPLETED') continue;
          const amt = (p.total_money?.amount || 0) / 100, fee = (p.processing_fee || []).reduce((s, f) => s + (f.amount_money?.amount || 0), 0) / 100, refunded = (p.refunded_money?.amount || 0) / 100;
          const d = date(p.created_at), how = p.card_details?.card?.card_brand ? `${p.card_details.card.card_brand.replace(/_/g, ' ').toLowerCase()} ••${p.card_details.card.last_4}` : (p.source_type || '').toLowerCase().replace('_', ' ');
          rows.push(row({ date: d, desc: `Square sale${how ? ' (' + how + ')' : ''}${p.note ? ': ' + p.note : ''}`, amt: amt - refunded, account: 'Square', source: 'Square', id: 'sq:' + p.id, cat: 'Sales' }));
          if (fee) rows.push(row({ date: d, desc: 'Square processing fee', amt: -fee, account: 'Square', source: 'Square', id: 'sqfee:' + p.id, cat: 'Card processing fees' }));
        }
        cursor = j.cursor || ''; guard++;
      } while (cursor && guard < 50);
      const res = await importRows(cfg.unit || App.biz.target(), rows);
      App.settings.set('bank.square', { ...cfg, lastSync: Date.now() });
      return res;
    }
  };

  /* Stripe: online payments, payouts and fees */
  const stripe = {
    cfg: () => App.settings.get('bank.stripe', {}),
    async sync(days = 90) {
      const key = await secret('stripe'), cfg = stripe.cfg();
      if (!key) throw new Error('Add your Stripe restricted key first.');
      const since = Math.floor((Date.now() - days * 864e5) / 1000);
      const rows = []; let after = '', more = true, guard = 0;
      while (more && guard++ < 50) {
        const j = await call('stripe', 'GET', `/v1/balance_transactions?limit=100&created[gte]=${since}${after ? '&starting_after=' + after : ''}`, null, key);
        for (const t of j.data || []) {
          const d = date(new Date(t.created * 1000));
          rows.push(row({ date: d, desc: t.description || t.type.replace(/_/g, ' '), amt: t.net / 100, account: 'Stripe', source: 'Stripe', id: 'st:' + t.id, cat: t.type === 'charge' || t.type === 'payment' ? 'Sales' : t.type === 'stripe_fee' ? 'Card processing fees' : t.type === 'refund' ? 'Refunds' : '', transfer: t.type === 'payout' || t.type === 'transfer' }));
        }
        more = j.has_more; after = j.data?.[j.data.length - 1]?.id || '';
      }
      const res = await importRows(cfg.unit || App.biz.target(), rows);
      App.settings.set('bank.stripe', { ...cfg, lastSync: Date.now() });
      return res;
    }
  };

  /* Totals per unit, for the Integrations page */
  async function overview() {
    const out = [];
    for (const b of App.biz.active()) {
      const tx = await App.store.get('datasets', `transactions-${b.id}`);
      if (!tx?.rows?.length) continue;
      const accts = {};
      for (const r of tx.rows) { const a = accts[r.Account] || (accts[r.Account] = { n: 0, first: r.Date, last: r.Date, source: r.Source }); a.n++; if (r.Date < a.first) a.first = r.Date; if (r.Date > a.last) a.last = r.Date; }
      out.push({ unit: b, total: tx.rows.length, accounts: accts });
    }
    return out;
  }
  async function clearAccount(bid, account) {
    const tx = await App.store.get('datasets', `transactions-${bid}`);
    if (!tx) return;
    tx.rows = tx.rows.filter(r => r.Account !== account);
    await App.store.put('datasets', tx);
    await rebuild(bid);
  }

  App.reports?.register?.(statement);
  App.banking = { HEAD, PROFILES, statement, parseOfx, rowsFromSheet, rebuild, importRows, overview, clearAccount, plaid, square, stripe, secret, setSecret, guessCat, money, date };
})(window.App);
