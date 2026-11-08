/* Purchase journal logic: categories, auto-categorizing, receipt text parsing, item memory, price watch */
(function (App) {
  /* group drives reporting: food → food cost %, beverage/alcohol → beverage cost, excluded → not a business expense */
  const CATS = [
    { k: 'protein', label: 'Meat & seafood', group: 'food' },
    { k: 'produce', label: 'Produce', group: 'food' },
    { k: 'dairy', label: 'Dairy & eggs', group: 'food' },
    { k: 'dry', label: 'Dry goods & pantry', group: 'food' },
    { k: 'frozen', label: 'Frozen', group: 'food' },
    { k: 'bakery', label: 'Bread & bakery', group: 'food' },
    { k: 'food', label: 'Food (general)', group: 'food' },
    { k: 'bev', label: 'Beverages (non-alcoholic)', group: 'beverage' },
    { k: 'alcohol', label: 'Beer, wine & liquor', group: 'alcohol' },
    { k: 'paper', label: 'Paper & disposables', group: 'supplies' },
    { k: 'cleaning', label: 'Cleaning & chemicals', group: 'supplies' },
    { k: 'smallwares', label: 'Smallwares & equipment', group: 'supplies' },
    { k: 'other', label: 'Other business', group: 'other' },
    { k: 'personal', label: 'Personal (not business)', group: 'excluded' }
  ];
  const GROUPS = { food: 'Food', beverage: 'Beverage', alcohol: 'Alcohol', supplies: 'Supplies', other: 'Other', excluded: 'Personal' };
  const CAT = Object.fromEntries(CATS.map(c => [c.k, c]));
  const VENDORS = ['Costco', 'Costco Business Center', 'Restaurant Depot', "Sam's Club", 'Sysco', 'US Foods', 'Gordon Food Service', 'Walmart', 'Amazon', 'Local market'];
  const PAYMENTS = ['Business card', 'Business checking', 'Cash', 'Personal card (owner paid)'];

  /* Keyword rules, checked in order (first match wins). Abbreviations as printed on Costco/club receipts. */
  const RULES = [
    ['personal', /\b(tv|television|laptop|iphone|ipad|toy|lego|apparel|jeans|shirt|sock|shoe|vitamin|supplement|shampoo|diaper|pet food|dog food|cat food|gift card|tire)\b/i],
    ['alcohol', /\b(beer|ipa|lager|ale|wine|cab|merlot|chard|pinot|prosecco|champ|vodka|tequila|whisk|bourbon|rum|gin|liquor|seltzer hard|white claw|modelo|corona|stella)\b/i],
    ['cleaning', /\b(bleach|clorox|sanitiz|disinfect|detergent|dish ?soap|dawn|degreas|cleaner|lysol|windex|ammonia|scrub|sponge|mop|trash ?bag|garbage ?bag|hefty|glad)\b/i],
    ['paper', /\b(napkin|towel|paper|tissue|cup|lid|straw|plate|bowl|cutlery|fork|spoon|knife set|foil|film|wrap|clamshell|container|to ?go|deli ?cont|glove|nitrile|vinyl|bag|parchment|portion cup|souffle)\b/i],
    ['smallwares', /\b(pan|pot|sheet pan|hotel pan|tong|ladle|whisk|cutting board|thermometer|scale|knife|cambro|bin|rack|scoop)\b/i],
    ['bev', /\b(water|soda|coke|pepsi|sprite|juice|lemonade|coffee|espresso|tea|gatorade|kirkland water|la croix|red ?bull|monster|syrup|creamer)\b/i],
    ['protein', /\b(chicken|chkn|chk|brst|thigh|wing|beef|grnd|ground|steak|ribeye|strip|brisket|chuck|pork|bacon|ham|sausage|turkey|salmon|shrimp|tuna|cod|tilapia|crab|lobster|scallop|fish|lamb|hot ?dog|pepperoni|salami|prosciutto|meatball)\b/i],
    ['dairy', /\b(milk|cream|half ?& ?half|butter|cheese|chs|mozz|cheddar|parm|swiss|provolone|feta|yogurt|egg|eggs|sour cream|cream cheese)\b/i],
    ['frozen', /\b(frozen|frz|fz|ice cream|fries|tots|nugget)\b/i],
    ['bakery', /\b(bread|bun|roll|bagel|tortilla|croissant|muffin|pita|naan|brioche|loaf|baguette|dough)\b/i],
    ['dry', /\b(black pepper|peppercorn|seasoning|spice|tomato paste|tomato sauce|crushed tom|diced tom|canned)\b/i],
    ['produce', /\b(avocado|avo|lettuce|romaine|spinach|kale|arugula|tomato|tom|onion|garlic|potato|pepper|jalapeno|cilantro|parsley|basil|lime|lemon|orange|apple|banana|berry|berries|strawb\w*|blueb\w*|raspb\w*|blackb\w*|grape|mushroom|cucumber|carrot|celery|broccoli|cabbage|corn|zucchini|squash|herb|mango|pineapple|ginger|scallion|salad|org )\b/i],
    ['dry', /\b(flour|sugar|rice|pasta|spaghetti|penne|noodle|oil|olive|canola|vinegar|salt|pepper corn|spice|seasoning|sauce|ketchup|mayo|mustard|ranch|salsa|beans|canned|can |tomato paste|broth|stock|honey|maple|nuts|almond|peanut|cereal|oats|chip|cracker|choc|baking|yeast|cornstarch|breadcrumb|panko)\b/i]
  ];

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  /* ---------- Item memory (per business): last category/price, so repeat items fill themselves ---------- */
  const memory = () => App.bsettings.get('pur.items', {});
  function remember(lines, date) {
    const m = memory();
    for (const l of lines) {
      const k = norm(l.item); if (!k) continue;
      const unitPrice = l.qty ? l.amount / l.qty : l.amount;
      m[k] = { item: l.item, cat: l.cat, unit: l.unit || '', price: +unitPrice.toFixed(4), date };
    }
    App.bsettings.set('pur.items', m);
  }
  function categorize(name) {
    const k = norm(name);
    const mem = memory()[k];
    if (mem) return mem.cat;
    const padded = ' ' + k + ' ';
    const singular = ' ' + k.split(' ').map(w => w.length > 3 ? w.replace(/(ies)$/, 'y').replace(/(oes|ses|xes|ches|shes)$/, m => m.slice(0, -2)).replace(/([^s])s$/, '$1') : w).join(' ') + ' ';
    for (const [cat, re] of RULES) if (re.test(padded) || re.test(singular)) return cat;
    return '';
  }
  const recall = name => memory()[norm(name)] || null;

  /* ---------- Receipt text parser (Costco, Sam's, Restaurant Depot style) ---------- */
  function parseReceipt(text) {
    const out = { vendor: '', date: '', lines: [], tax: 0, total: 0 };
    const rows = String(text || '').split(/\r?\n/).map(s => s.replace(/\s+$/, '')).filter(s => s.trim());
    if (/costco/i.test(text)) out.vendor = /business/i.test(text) ? 'Costco Business Center' : 'Costco';
    else if (/sam'?s club/i.test(text)) out.vendor = "Sam's Club";
    else if (/restaurant depot/i.test(text)) out.vendor = 'Restaurant Depot';
    const dm = String(text).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (dm) { const y = dm[3].length === 2 ? '20' + dm[3] : dm[3]; out.date = `${y}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}`; }
    let pendingQty = null, ended = false;
    for (const raw of rows) {
      const r = raw.trim();
      if (ended) continue; // after TOTAL: payment, member and savings summary lines
      if (/^(sub ?total|subtotal)\b/i.test(r)) continue;
      const tax = r.match(/^\**\s*tax\b.*?(-?\d+\.\d{2})\s*$/i);
      if (tax) { out.tax += +tax[1]; continue; }
      const tot = r.match(/^\**\s*(total|amount due|balance due)\b.*?(\d[\d,]*\.\d{2})\s*$/i);
      if (tot) { out.total = +tot[2].replace(/,/g, ''); ended = true; continue; }
      if (/\b(visa|mastercard|amex|discover|debit|cash|change|approved|auth|member|items sold|instant savings total|total number|thank you|whse|trn|op#|chip read|aid:|seq#)\b/i.test(r)) continue;
      const q = r.match(/^(\d+)\s*@\s*(\d+\.\d{2})/);
      if (q) { pendingQty = +q[1]; continue; }
      // Discount / instant savings: "/1234567  3.00-" or "TPD/1234567 -3.00"
      const disc = r.match(/^(?:[A-Z]{0,3})?\s*\/\s*(\d{3,9})?.*?(\d+\.\d{2})-?\s*[A-Z]?$/) || r.match(/^.*\b(?:coupon|savings|discount|tpd)\b.*?-?(\d+\.\d{2})-?\s*[A-Z]?$/i);
      if (disc && (/-\s*[A-Z]?$/.test(r) || /^\s*[A-Z]{0,3}\s*\//.test(r) || /coupon|savings|discount|tpd/i.test(r))) {
        const amt = +(disc[2] || disc[1]);
        const num = disc[2] ? disc[1] : null;
        const target = (num && [...out.lines].reverse().find(l => l.code === num)) || out.lines[out.lines.length - 1];
        if (target) { target.amount = +(target.amount - amt).toFixed(2); target.discount = +((target.discount || 0) + amt).toFixed(2); }
        else out.lines.push({ item: 'Instant savings', cat: 'other', qty: 1, amount: -amt });
        continue;
      }
      // Item: [E] [item#] DESCRIPTION  12.99 [E|A|N|Y]
      const m = r.match(/^(?:[A-Z]\s+)?(?:(\d{3,9})\s+)?(.+?)\s+(\d[\d,]*\.\d{2})\s*([A-Z]{1,2})?$/);
      if (m && /[a-z]{2}/i.test(m[2])) {
        const name = m[2].replace(/\s{2,}/g, ' ').trim();
        const amount = +m[3].replace(/,/g, '');
        const qty = pendingQty || 1; pendingQty = null;
        out.lines.push({ code: m[1] || '', item: name, cat: categorize(name), qty, unit: '', amount });
      }
    }
    return out;
  }

  /* ---------- Totals & reporting helpers ---------- */
  function totals(p) {
    const by = {}; const groups = {};
    let sub = 0;
    for (const l of p.lines || []) {
      const a = +l.amount || 0; sub += a;
      by[l.cat || 'other'] = (by[l.cat || 'other'] || 0) + a;
      const g = CAT[l.cat]?.group || 'other';
      groups[g] = (groups[g] || 0) + a;
    }
    const tax = +p.tax || 0;
    const computed = +(sub + tax).toFixed(2);
    const business = sub - (groups.excluded || 0);
    return { sub, tax, computed, by, groups, business, food: groups.food || 0, bev: (groups.beverage || 0) + (groups.alcohol || 0), diff: p.total ? +(p.total - computed).toFixed(2) : 0 };
  }

  /* Price watch: compare each item's latest unit price with its previous purchase */
  function priceChanges(purchases) {
    const hist = {};
    for (const p of [...purchases].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const l of p.lines || []) {
        const k = norm(l.item); if (!k || !(+l.qty) || !(+l.amount) || +l.amount < 0) continue;
        (hist[k] = hist[k] || []).push({ item: l.item, date: p.date, vendor: p.vendor, unit: +l.amount / +l.qty });
      }
    }
    const out = [];
    for (const arr of Object.values(hist)) {
      if (arr.length < 2) continue;
      const last = arr[arr.length - 1], prev = arr[arr.length - 2];
      const ch = last.unit / prev.unit - 1;
      if (Math.abs(ch) >= 0.03) out.push({ item: last.item, from: prev.unit, to: last.unit, change: ch, date: last.date, vendor: last.vendor, prevVendor: prev.vendor });
    }
    return out.sort((a, b) => b.change - a.change);
  }

  /* Period helpers */
  function periodRange(key, custom = {}) {
    if (key === 'global') { const r = App.period.range(); return r.g === 'all' ? ['0000-01-01', '9999-12-31', 'All time'] : [r.from, r.to, r.label]; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dow = (today.getDay() + 6) % 7; // Monday start
    const monday = new Date(today); monday.setDate(today.getDate() - dow);
    if (key === 'thisweek') { const e = new Date(monday); e.setDate(monday.getDate() + 6); return [iso(monday), iso(e), 'This week']; }
    if (key === 'lastweek') { const s = new Date(monday); s.setDate(monday.getDate() - 7); const e = new Date(monday); e.setDate(monday.getDate() - 1); return [iso(s), iso(e), 'Last week']; }
    if (key === 'thismonth') return [iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)), 'This month'];
    if (key === 'lastmonth') return [iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), iso(new Date(today.getFullYear(), today.getMonth(), 0)), 'Last month'];
    if (key === 'ytd') return [iso(new Date(today.getFullYear(), 0, 1)), iso(today), 'Year to date'];
    if (key === 'custom') return [custom.from || '2000-01-01', custom.to || iso(today), 'Custom'];
    return ['0000-01-01', '9999-12-31', 'All time'];
  }

  /* Keep a live table of every purchase line so Data Explorer, Financials' expense mix and AI can use it */
  async function syncDataset() {
    const bizIds = App.biz.isMaster() ? App.biz.list().map(b => b.id) : [App.biz.current()];
    for (const bid of bizIds) {
      const ps = (await App.store.all('purchases', { raw: true })).filter(p => App.biz.idOf(p) === bid);
      const id = 'purchases-' + bid;
      if (!ps.length) { await App.store.del('datasets', id); continue; }
      const rows = [];
      for (const p of ps.sort((a, b) => a.date.localeCompare(b.date))) for (const l of p.lines || []) {
        rows.push({ Date: p.date, Vendor: p.vendor, Item: l.item, Category: CAT[l.cat]?.label || 'Other business', Group: GROUPS[CAT[l.cat]?.group || 'other'], Qty: +l.qty || 0, 'Unit Price': l.qty ? +(l.amount / l.qty).toFixed(2) : +l.amount, Amount: +l.amount || 0, Payment: p.payment || '', Receipt: p.ref || '' });
      }
      await App.store.put('datasets', { id, fileId: null, sample: ps.every(p => p.sample) || undefined, name: 'Purchase journal (live)', headers: ['Date', 'Vendor', 'Item', 'Category', 'Group', 'Qty', 'Unit Price', 'Amount', 'Payment', 'Receipt'], rows, category: 'financial', source: 'manual', businessId: bid, createdAt: Date.now(), live: true });
    }
  }

  App.purchasing = { CATS, CAT, GROUPS, VENDORS, PAYMENTS, categorize, recall, remember, parseReceipt, totals, priceChanges, periodRange, syncDataset, norm };
})(window.App);
