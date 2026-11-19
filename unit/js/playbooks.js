/* Playbooks for the AI agents: how each department works, the shape of the bigger deliverables, what an agent
   needs from you when a system isn't connected, and how often it runs on its own (autopilot). */
(function (UC) {
  /* Data an agent can read today. Everything else is pasted in when you run the agent. */
  UC.AVAILABLE = ['pos', 'labor', 'units', 'ventures', 'docs', 'ap', 'inv'];
  UC.NOT_CONNECTED = { email: 'your email', cal: 'your calendar', web: 'the web (local AI can’t browse)', books: 'your accounting system', bank: 'your bank feeds', hr: 'your HR files / roster', reviews: 'your reviews' };

  const DEPT = {
    venture: 'You help an owner-operator start new businesses. Be concrete about costs, timelines and risks. Use the venture’s type, stage, checklist and notes. Where a number is an assumption, label it as an assumption and give a range.',
    multi: 'You help an operator open and run more units. Compare new or weak units with the best existing ones using the real unit numbers provided. Quantify gaps in dollars per week.',
    sales: 'You manage revenue. Use the unit sales data provided. Explain what changed, why it likely changed, and the one or two actions that would move sales this week.',
    ops: 'You run production and operations. Be practical and specific to the type of business. Turn findings into checklists or short action lists a shift lead can follow.',
    people: 'You manage labor and people. Protect labor % targets without hurting service. Be fair, specific and compliant; never suggest anything that breaks labor law. Drafts to staff are short and respectful.',
    supply: 'You manage purchasing and inventory. Focus on price, waste and availability. Quantify savings in dollars.',
    finance: 'You run the back office. Be exact with numbers that are provided and never invent figures. Show calculations briefly. Flag anything that needs the owner’s decision.',
    customer: 'You run marketing and customer care in the owner’s brand voice. Drafts must sound human, warm and specific; no hype, no false promises, no discounts beyond the price book.',
    risk: 'You keep the business compliant and safe. Be cautious: say clearly when something should be confirmed with the local authority, an attorney, an insurer or a CPA. Never present legal or tax advice as final.',
    intel: 'You research and brief. You cannot browse the web, so work only from the information provided and say exactly what should be verified and where.',
    knowledge: 'You maintain the knowledge every other agent reads. Keep it short, clear and consistent.'
  };
  UC.deptGuide = id => DEPT[id] || '';

  /* Output skeletons for the larger deliverables (markdown headings the agent should fill) */
  const FORMATS = {
    'idea-screen': 'Score table (Demand, Margin, Competition, Capital needed, Fit with current businesses; 1–5 each, with a reason) · Total score · Go / Not yet / No with the reason · 3 questions to answer next',
    'market-size': 'Trade area and customer · Customers in the area (assumption, range) · Spend per customer · Total market (TAM/SAM/obtainable, ranges) · What to verify',
    'competitor-scan': 'Table: competitor, offer, price points, strengths, gaps (from what was provided) · Where we can win · What to verify in person',
    concept: 'One-liner · Who it serves · What it sells (top 5 items/services with price points) · The promise · Why now · What makes it different',
    'biz-plan': 'Executive summary · Concept · Market · Competition · Operations · Team · Marketing · Financial summary (from the pro forma) · Funding ask · Risks and mitigations · Milestones',
    'pro-forma': 'Assumptions table · Year 1 monthly and Years 2–3 annual: revenue, COGS, labor, occupancy, other operating, EBITDA · Break-even sales per week · Cash needed to break even',
    'startup-budget': 'Table: build-out, equipment, furniture & fixtures, deposits, licenses & permits, opening inventory, pre-opening labor & training, marketing, working capital (3 months), contingency (10–15%) · Total · What to get quotes for',
    entity: 'Checklist with owner and due date: entity type decision, state filing, EIN, operating agreement, bank account, insurance, registered agent, local business license',
    licenses: 'Table: license/permit, issuing agency, typical lead time, cost range, depends on · Order to apply in · What to confirm locally',
    funding: 'The ask (amount, use of funds) · Sources and uses table · Repayment / return plan · Collateral and guarantees · Documents checklist for the lender',
    'investor-update': 'Headline · Numbers this month vs. plan · Wins · Problems and what we’re doing · Asks',
    'brand-kit': 'Name options (5, with why) · Personality in 3 words · Voice do/don’t · Color and type direction · Logo brief',
    preopen: 'Week-by-week countdown table from today to opening: task, owner, due, depends on',
    'go-live': 'Readiness score out of 100 · Table: area (staff, systems, permits, inventory, marketing, facility), status, gaps · Go / delay recommendation',
    'unit-proforma': 'Comparable unit used and why · Projected weekly sales ramp (weeks 1–13) · Labor % and prime cost targets · Year-1 P&L · Payback period',
    lease: 'Side-by-side table: base rent, escalators, CAM/NNN, TI allowance, free rent, term & options, exclusives, assignment, personal guarantee, exit · Red flags · Questions for the landlord',
    'site-select': 'Score card: traffic, visibility, access & parking, demographics fit, co-tenants, competition, rent vs. projected sales (occupancy %), score each 1–5 · Recommendation',
    forecasting: 'Next week by unit and day: forecast sales and the reason (trend, day of week, events) · Total vs. last week',
    'product-mix': 'Matrix: stars, plow horses, puzzles, dogs (from data provided) · Actions per group',
    scheduler: 'Labor hours by unit and day that hit the labor % target at the forecast · Shifts to add or cut · Notes for managers',
    'order-guide': 'Table: item, par, on hand, suggested order, vendor · Notes',
    ap: 'Pay run table: vendor, amount, due date, pay now / hold · Cash needed this week',
    close: 'Close checklist with status · Missing items and who owns them',
    'sales-tax': 'Worksheet: jurisdiction, taxable sales, rate, tax due, filing date · Items to confirm with the CPA',
    pnl: 'P&L table by line: actual, budget, variance $ and % · The 3 biggest variances and why',
    'cash': '13-week table: opening cash, receipts, payments, closing cash · Low point and when',
    reviews: 'A reply for each review (2–4 sentences, brand voice, thank, address specifics, invite back; take serious issues offline)',
    complaints: 'Make-good reply to the guest · Internal note to the unit: what happened, fix, follow-up',
    social: '5 posts: hook, caption, call to action, suggested day and time',
    hooks: '10 hooks (under 10 words each) · 5 captions',
    'email-mkt': 'Subject line options (3) · Preview text · Email body · Call to action · Who to send it to',
    'local-mkt': 'Monthly plan table: week, activity, partner/place, cost, goal',
    'job-post': 'Job title · Pay range (if provided) · What you’ll do · What we’re looking for · Schedule · Why work here · How to apply',
    hiring: 'Shortlist table: candidate, fit for the role, concerns, next step · Interview questions (5)',
    onboard: 'Welcome message · First-week schedule · Paperwork checklist · Training plan by day',
    inspections: 'Mock inspection checklist by area with pass / fix · Top 5 fixes before the inspector comes',
    incidents: 'Incident report: what, when, where, who, injury/illness, immediate actions, witnesses, follow-up, who to notify',
    'person-research': 'Who they are · Their business · What they likely care about · Questions to ask · Things to avoid · What to verify',
    'pricing-research': 'Table: item, our price, competitor prices provided, gap · Price moves to consider',
    sops: 'SOP: purpose, when, who, steps (numbered), standards, common mistakes',
    'brand-voice': 'Voice in 3 words · Do / Don’t table · 3 example sentences',
    'price-book': 'Table: item/service, price, unit, allowed discounts',
    contracts: 'Standard terms · What agents may promise · What only the owner may approve'
  };
  UC.formatFor = key => FORMATS[key] || '';

  /* What to paste in when an agent's systems aren't connected */
  const NEEDS = {
    leads: 'Paste the new lead’s message (form, email or call notes).', proposal: 'Paste the lead’s request and any call notes.', 'fit-score': 'Paste the lead’s message and what you know about them.',
    catering: 'Paste the quote you sent and the customer’s reply.', b2b: 'List the accounts and their last order dates.', pipeline: 'List open deals: name, value, stage, expected close.',
    reviews: 'Paste the new reviews (one per line, with the star rating).', complaints: 'Paste the complaint and which unit it’s about.', 'guest-scores': 'Paste the latest guest survey scores by unit.',
    tickets: 'Paste the customer questions.', health: 'List accounts with recent activity, spend and any issues.', qbr: 'Paste the client’s numbers and what you did for them this quarter.',
    lease: 'Paste the lease or LOI terms (or the key clauses) for each option.', 'site-select': 'Describe each candidate site: address, traffic, rent, size, co-tenants.', acquisition: 'Paste the business-for-sale listing details.',
    'person-research': 'Who are you meeting? Paste their name, company and anything you know.', 'pricing-research': 'Paste competitor prices you’ve collected.', 'market-news': 'Paste headlines or notes you want briefed.',
    commodity: 'Paste recent prices for your key costs.', benchmarks: 'Paste the industry benchmarks you want to compare against.',
    hiring: 'Paste the applicants (name, experience, availability) and the role.', onboard: 'Who was hired, for which role and unit, and their start date?', 'job-post': 'Which role, unit, pay range and schedule?',
    training: 'List staff and their certifications with expiry dates.', turnover: 'List who left this month, role, unit, tenure and reason.', 'payroll-prep': 'Paste the payroll hours and adjustments for the period.',
    breaks: 'Paste the shift/punch report.', 'reviews-perf': 'Who is up for review, their role and notes from their manager.', recognition: 'Paste shout-outs, reviews or wins from this week.',
    maintenance: 'Describe the equipment problem and the unit.', incidents: 'Describe what happened.', insurance: 'Paste your policy summaries and renewal dates.', 'legal-docs': 'List contracts with renewal / expiry dates.',
    permits: 'List each unit’s permits and licenses with expiry dates.', contractors: 'List contractors you pay and whether you have their W-9.', 'labor-law': 'Which cities/states do you operate in?',
    invoicing: 'List the work done to bill: client, items, amounts.', collections: 'List unpaid invoices: client, amount, days late.', categorize: 'Paste the transactions to categorize.',
    reconcile: 'Paste the bank statement lines and book balance.', expenses: 'Paste the receipts or expense lines.', 'email-triage': 'Paste the emails to sort.', cpa: 'What period, and what has the CPA asked for?',
    loans: 'List loans: lender, balance, payment, covenants.', royalty: 'Paste the fee agreement terms.', budget: 'Paste budget vs. actual by line.', pnl: 'Paste the P&L export (or key lines) for the period.',
    cash: 'Paste the cash balance and known receipts/payments for the next weeks.', 'sales-tax': 'Which jurisdictions and filing period?', close: 'What period are you closing?',
    'investor-update': 'Anything to add beyond the numbers (wins, problems, asks)?', status: 'Paste this week’s notes for each client or project.', kickoff: 'Who is the client and what did they buy?',
    'scheduling-jobs': 'List the jobs to schedule and crew availability.', 'data-migration': 'What is moving, from which system to which?', ads: 'Paste spend and results by channel.',
    loyalty: 'Paste your regulars list or loyalty export.', promo: 'Describe the promotion and its dates.', 'equipment-buy': 'What equipment, and the quotes you have?', bids: 'Paste the items and vendor quotes.',
    'contracts-supply': 'Paste the contract pricing / rebate terms.', recalls: 'List the items or brands to check.', 'sub-vendors': 'List your critical items and current vendors.', receiving: 'Which unit and what deliveries?',
    transfers: 'Paste on-hand by unit for the items to balance.', counts: 'Paste the latest count.', 'invoice-match': 'Paste the invoice and the order.', 'price-watch': 'Paste the latest invoice lines.', 'order-guide': 'Paste on-hand counts and pars.',
    recipes: 'Paste the recipe or spec to update.', waste: 'Paste the waste log.', par: 'Paste usage and current pars.', 'prod-plan': 'Anything special this week (events, catering)?',
    quality: 'Paste the latest line checks or temp logs.', opening: 'Which unit and shift?', pm: 'List equipment and last service dates.', throughput: 'Paste ticket / speed-of-service times.', 'sop-audit': 'Paste audit notes or photo findings.',
    'incidents-ops': 'Paste the shift notes.', capacity: 'Seats, ovens, bays or crew hours available per unit.', 'ops-calendar': 'Paste upcoming holidays, events and promotions.',
    gift: 'Paste gift card / loyalty balances.', tender: 'Paste the deposit report.', discounts: 'Paste the discounts / voids report.', daypart: 'Paste sales by hour.', 'product-mix': 'Paste the item sales report (item, qty, sales, cost).', pricing: 'Paste item prices and costs.',
    seo: 'Paste your current listing details (hours, menu, links).', social: 'Anything to promote this week?', hooks: 'What is the video about?', 'email-mkt': 'What is the campaign for?', 'local-mkt': 'Your area: schools, events, partners nearby.',
    'data-privacy': 'List your systems and who has access.', territory: 'Describe where your units are and where customers come from.', capex: 'List equipment/remodels needed by unit with rough costs.', franchise: 'What is documented today?',
    'new-unit-ramp': 'Which unit is new and when did it open?', buildout: 'Paste contractor updates and budget vs. actual.', 'opening-playbook': 'Which unit, and its opening date?', portfolio: 'Anything to add about each unit or venture?',
    sops: 'Paste or describe the SOP to write or update.', 'brand-voice': 'Paste examples of how you write and talk to customers.', 'price-book': 'Paste your prices and allowed discounts.', contracts: 'Paste your standard terms and what staff may promise.'
  };
  UC.needsFor = a => NEEDS[a.key] || (a.reads.some(r => !UC.AVAILABLE.includes(r)) ? `Paste what it should work on (it can’t read ${a.reads.filter(r => !UC.AVAILABLE.includes(r)).map(r => UC.NOT_CONNECTED[r] || r).join(' or ')} yet).` : 'Anything to add? (optional)');

  /* How often an agent runs on autopilot: daily, weekly (with a day), monthly, quarterly, stage (per venture), or manual */
  UC.cadence = a => {
    const t = a.trigger.toLowerCase();
    if (/(idea|plan|funding|build-out) stage/.test(t)) return { kind: 'stage', stage: t.includes('idea') ? 'idea' : t.includes('plan') ? 'plan' : t.includes('funding') ? 'funding' : 'build' };
    if (/two weeks before opening/.test(t)) return { kind: 'stage', stage: 'open' };
    if (/when a unit enters build-out/.test(t)) return { kind: 'stage', stage: 'build' };
    if (/every morning|every day|daily|every evening|every weekday|every shift|open and close|every 30 minutes/.test(t)) return { kind: 'daily' };
    const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].findIndex(d => t.includes('every ' + d));
    if (day >= 0) return { kind: 'weekly', day };
    if (/weekly/.test(t)) return { kind: 'weekly', day: 1 };
    if (/monthly|month end|period close/.test(t)) return { kind: 'monthly' };
    if (/quarterly/.test(t)) return { kind: 'quarterly' };
    return { kind: 'manual' };
  };
  /* Can this agent run on its own? Only when everything it reads is available here */
  UC.canAuto = a => a.reads.every(r => UC.AVAILABLE.includes(r)) && UC.cadence(a).kind !== 'manual';
})(window.UC);
