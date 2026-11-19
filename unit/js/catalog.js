/* The agent catalog: 136 agents in 11 departments, covering a business from idea to many units.
   Each agent: what it does, when it runs, what it reads, what it produces, and whether it needs your yes.
   Agents with a `rule` do real work today on your imported data (see engine.js). The rest show sample output
   until an AI is connected in a later phase. */
(function (UC) {
  const INPUTS = {
    pos: 'POS & sales exports', labor: 'Labor & timesheets', inv: 'Inventory counts', ap: 'Invoices & purchases', books: 'Accounting',
    email: 'Email', cal: 'Calendar', reviews: 'Reviews & guest surveys', web: 'Web research', docs: 'Knowledge (SOPs, price book)',
    ventures: 'Venture pipeline', units: 'Unit list & targets', hr: 'Roster & HR files', bank: 'Bank & card feeds'
  };
  // [key, name, what it does, trigger, reads, output, needs sign-off, rule, in lite]
  const DEPTS = [
    { id: 'venture', name: 'Venture Studio', short: 'Venture', color: '#f97316', about: 'Turns an idea into an open business.', agents: [
      ['idea-screen', 'Idea Screening', 'Scores a new business idea on demand, margin, competition and fit with what you already run.', 'When you add an idea', 'ventures,web', 'Idea score card', 0, '', 0],
      ['market-size', 'Market Sizing', 'Estimates the customers, spend and share available in the trade area.', 'Idea stage', 'ventures,web', 'Market size memo', 0, '', 0],
      ['competitor-scan', 'Competitor Scan', 'Lists nearby competitors with prices, hours, ratings and gaps.', 'Idea stage', 'web,reviews', 'Competitor table', 0, '', 0],
      ['concept', 'Concept Builder', 'Writes the concept: who it serves, what it sells, price points and the promise.', 'Idea stage', 'ventures,docs', 'Concept one-pager', 1, '', 0],
      ['biz-plan', 'Business Plan Draft', 'Drafts the business plan from the concept, market and pro forma.', 'Plan stage', 'ventures,docs', 'Business plan draft', 1, '', 0],
      ['pro-forma', 'Pro Forma Model', 'Builds a 3-year P&L, break-even and cash need from the template’s cost structure.', 'Plan stage', 'ventures,units', 'Pro forma', 1, '', 0],
      ['startup-budget', 'Startup Budget', 'Totals build-out, equipment, deposits, opening inventory and working capital.', 'Plan stage', 'ventures,ap', 'Startup budget', 0, '', 0],
      ['entity', 'Entity & Registration', 'Checklist for entity formation, EIN, state registration and bank account.', 'Plan stage', 'ventures', 'Formation checklist', 0, '', 0],
      ['licenses', 'Licenses & Permits Map', 'Lists the licenses and permits this business type needs where you’re opening.', 'Plan stage', 'ventures,web', 'Permit list with owners', 0, '', 0],
      ['funding', 'Funding Package', 'Assembles the SBA / lender / investor package and the ask.', 'Funding stage', 'ventures,books', 'Lender package', 1, '', 0],
      ['investor-update', 'Investor Updates', 'Drafts monthly updates for partners and investors.', 'Monthly', 'ventures,books', 'Update email', 1, '', 0],
      ['brand-kit', 'Brand Kit', 'Name ideas, logo brief, colors and voice for the new business.', 'Plan stage', 'ventures,docs', 'Brand brief', 1, '', 0],
      ['vendor-source', 'Vendor Sourcing', 'Shortlists suppliers and service vendors with quotes to request.', 'Build-out stage', 'ventures,ap', 'Vendor shortlist', 0, '', 0],
      ['preopen', 'Pre-Opening Timeline', 'Builds the countdown plan from today to opening day.', 'Build-out stage', 'ventures,cal', 'Opening timeline', 0, '', 0],
      ['venture-watch', 'Venture Checklist Watch', 'Flags overdue checklist items on every venture and what’s blocking the next stage.', 'Every morning', 'ventures', 'Overdue items', 0, 'ventureWatch', 0],
      ['go-live', 'Go-Live Readiness', 'Final check before opening: staff, systems, permits, inventory, marketing.', 'Two weeks before opening', 'ventures,units', 'Readiness score', 1, '', 0]] },
    { id: 'multi', name: 'Multi-Unit Development', short: 'Multi-Unit', color: '#eab308', about: 'Finds, builds and benchmarks the next unit.', agents: [
      ['territory', 'Territory Mapping', 'Maps where existing units draw customers and where the gaps are.', 'Quarterly', 'units,web', 'Territory map notes', 0, '', 0],
      ['site-select', 'Site Selection', 'Scores candidate sites on traffic, demographics, co-tenants and rent.', 'When a site is added', 'web,ventures', 'Site score card', 0, '', 0],
      ['unit-proforma', 'New-Unit Pro Forma', 'Projects a new unit from your best-matching existing unit’s real numbers.', 'When a site is added', 'units,pos,labor', 'Unit pro forma', 1, '', 0],
      ['lease', 'Lease Comparison', 'Compares lease terms: rent, escalators, TI, CAM, term and exit.', 'When a lease draft arrives', 'docs,email', 'Lease comparison', 1, '', 0],
      ['buildout', 'Build-Out Tracker', 'Tracks contractors, inspections, change orders and budget vs. actual.', 'Weekly during build-out', 'ventures,ap', 'Build-out status', 0, '', 0],
      ['opening-playbook', 'Opening Playbook', 'Copies your opening playbook to the new unit with dates filled in.', 'When a unit enters build-out', 'docs,ventures', 'Dated playbook', 0, '', 0],
      ['benchmark', 'Unit Benchmarking', 'Ranks every unit on sales growth, labor %, SPLH and overtime; flags the bottom.', 'Every morning', 'units,pos,labor', 'Unit league table', 0, 'benchmark', 0],
      ['new-unit-ramp', 'New-Unit Ramp Watch', 'Compares a new unit’s first 90 days with how your other units ramped.', 'Daily for 90 days', 'units,pos', 'Ramp chart', 0, '', 0],
      ['franchise', 'Franchise Readiness', 'Checks what’s documented and repeatable enough to franchise or license.', 'Quarterly', 'docs,units', 'Readiness gaps', 0, '', 0],
      ['capex', 'Capital Planning', 'Plans remodels and equipment replacement across units.', 'Quarterly', 'units,ap,books', 'Capex plan', 1, '', 0],
      ['portfolio', 'Portfolio Review', 'One page on every unit and venture: what to grow, fix or close.', 'Monthly', 'units,ventures,books', 'Portfolio page', 0, '', 0],
      ['acquisition', 'Acquisition Screening', 'Screens businesses for sale against your criteria.', 'When a listing is added', 'web,docs', 'Deal screen', 1, '', 0]] },
    { id: 'sales', name: 'Sales & Revenue', short: 'Sales', color: '#6366f1', about: 'Knows what sold, what should have, and why.', agents: [
      ['flash', 'Daily Flash', 'Yesterday’s sales for every unit against forecast, with the week to date.', 'Every morning', 'pos', 'Flash report', 0, 'flash', 1],
      ['forecast-miss', 'Forecast Miss Watch', 'Flags units that missed their sales forecast by more than your threshold.', 'Every morning', 'pos', 'Units under forecast', 0, 'forecastMiss', 1],
      ['sales-trend', 'Sales Trend', 'Week-over-week and 4-week trend for each unit; spots slides early.', 'Every Monday', 'pos', 'Trend notes', 0, 'trend', 1],
      ['forecasting', 'Sales Forecasting', 'Builds next week’s forecast by unit and day from history and the calendar.', 'Every Thursday', 'pos,cal', 'Next week forecast', 1, '', 1],
      ['daypart', 'Daypart Mix', 'Shows how sales split by hour and daypart and where staffing should follow.', 'Weekly', 'pos', 'Daypart chart', 0, '', 1],
      ['product-mix', 'Product / Menu Mix', 'Ranks items by sales and margin: stars, plow horses, puzzles, dogs.', 'Weekly', 'pos,ap', 'Mix matrix', 0, '', 1],
      ['pricing', 'Price Testing', 'Suggests price moves where demand is strong and margins are thin.', 'Monthly', 'pos,ap,web', 'Price suggestions', 1, '', 0],
      ['discounts', 'Discounts & Comps Watch', 'Flags unusual discounts, comps, voids and refunds by unit and employee.', 'Every morning', 'pos', 'Exceptions list', 0, '', 1],
      ['tender', 'Tender & Deposit Match', 'Matches card and cash tenders to bank deposits.', 'Daily', 'pos,bank', 'Deposit match', 0, '', 1],
      ['catering', 'Large Orders & Catering', 'Tracks big orders and follows up on quotes.', 'When a quote is sent', 'email,pos', 'Follow-up draft', 1, '', 0],
      ['leads', 'Lead Capture', 'Catches leads from the site, email and phone and answers within minutes.', 'When a lead arrives', 'email,web', 'Reply draft', 1, '', 1],
      ['fit-score', 'Lead Fit Scoring', 'Scores each lead on fit, budget and urgency.', 'When a lead arrives', 'email,web', 'Lead score', 0, '', 0],
      ['proposal', 'Proposal Drafting', 'Drafts quotes and proposals from your price book.', 'When you mark a lead “proposal”', 'docs,email', 'Proposal draft', 1, '', 0],
      ['pipeline', 'Pipeline Forecast', 'Forecasts the month from open deals and recurring revenue.', 'Weekly', 'books,email', 'Pipeline view', 0, '', 0],
      ['b2b', 'B2B Accounts', 'Keeps wholesale and corporate accounts ordering; flags lapsed ones.', 'Weekly', 'pos,books', 'Lapsed accounts', 1, '', 0],
      ['gift', 'Gift Cards & Loyalty Liability', 'Tracks gift card and loyalty balances outstanding.', 'Monthly', 'pos,books', 'Liability report', 0, '', 0]] },
    { id: 'ops', name: 'Production & Operations', short: 'Operations', color: '#10b981', about: 'Makes the product right, on time, every time.', agents: [
      ['prod-plan', 'Production Planning', 'Turns the forecast into a production / prep plan by day.', 'Every evening', 'pos,inv', 'Prep plan', 0, '', 1],
      ['par', 'Par Levels', 'Recalculates pars from recent usage.', 'Weekly', 'inv,pos', 'New pars', 1, '', 1],
      ['avt', 'Actual vs. Theoretical', 'Finds where cost ran above theoretical and by how much.', 'When a count is imported', 'inv,ap,pos', 'Variance by category', 0, 'avt', 1],
      ['waste', 'Waste Tracking', 'Logs waste and spots items thrown out most.', 'Daily', 'inv', 'Waste summary', 0, '', 1],
      ['quality', 'Quality Checks', 'Schedules line checks, temp logs and audits; chases missed ones.', 'Every shift', 'docs', 'Missed checks', 0, '', 1],
      ['opening', 'Opening & Closing Checklists', 'Sends checklists to the shift lead and logs completion.', 'Open and close', 'docs', 'Completion log', 0, '', 1],
      ['maintenance', 'Maintenance Requests', 'Logs equipment issues, routes them to vendors, tracks to fixed.', 'When reported', 'email,ap', 'Work orders', 1, '', 1],
      ['pm', 'Preventive Maintenance', 'Schedules PM by equipment and reminds before it’s due.', 'Weekly', 'docs,cal', 'PM calendar', 0, '', 0],
      ['throughput', 'Speed & Throughput', 'Watches ticket times and peak throughput.', 'Daily', 'pos', 'Speed report', 0, '', 1],
      ['recipes', 'Recipe & Spec Keeper', 'Keeps recipes, build specs and costs current.', 'When a spec changes', 'docs,ap', 'Spec sheet', 0, '', 0],
      ['kickoff', 'Client Kickoff Pack', 'For service businesses: kickoff pack, intake form and timeline.', 'When a deal closes', 'email,docs', 'Kickoff pack', 1, '', 0],
      ['status', 'Status Updates', 'Writes weekly status for each client or project.', 'Every Friday', 'email,cal,docs', 'Status draft', 1, '', 0],
      ['scheduling-jobs', 'Job Scheduling', 'Books jobs and crews for field-service businesses.', 'When a job is booked', 'cal,email', 'Job schedule', 0, '', 0],
      ['data-migration', 'Data Migration', 'Moves a new unit’s or client’s data into your systems.', 'At onboarding', 'docs', 'Migration log', 0, '', 0],
      ['sop-audit', 'SOP Compliance', 'Checks whether each unit follows the SOPs, from audits and photos.', 'Weekly', 'docs', 'SOP gaps', 0, '', 0],
      ['incidents-ops', 'Shift Notes Digest', 'Summarizes shift notes across units into one page.', 'Every morning', 'email,docs', 'Digest', 0, '', 1],
      ['capacity', 'Capacity Planning', 'Compares demand with seats, ovens, crews or hours available.', 'Monthly', 'pos,labor', 'Capacity notes', 0, '', 0],
      ['ops-calendar', 'Operations Calendar', 'Holidays, events and promotions that will change volume.', 'Weekly', 'cal,web', 'Volume calendar', 0, '', 1]] },
    { id: 'people', name: 'People', short: 'People', color: '#ec4899', about: 'Right people, right hours, right pay.', agents: [
      ['labor-pct', 'Labor % Watch', 'Flags units whose labor % ran over target.', 'Every morning', 'labor,pos', 'Units over target', 0, 'laborPct', 1],
      ['ot-watch', 'Overtime Watch', 'Spots overtime before it happens and drafts a heads-up to the manager.', 'Every morning', 'labor', 'OT alert draft', 1, 'otWatch', 1],
      ['splh', 'Sales per Labor Hour', 'Flags units with low productivity.', 'Every morning', 'labor,pos', 'SPLH flags', 0, 'splh', 1],
      ['sched-var', 'Schedule vs. Actual', 'Compares scheduled and worked hours by unit.', 'Every morning', 'labor', 'Variance list', 0, 'schedVar', 1],
      ['scheduler', 'Schedule Builder', 'Builds next week’s schedule from the forecast and availability.', 'Every Thursday', 'labor,pos', 'Draft schedule', 1, '', 1],
      ['hiring', 'Hiring Screener', 'Screens applicants against the role and books interviews.', 'When someone applies', 'email,hr', 'Shortlist', 1, '', 1],
      ['job-post', 'Job Posts', 'Writes and refreshes job posts by role and unit.', 'When a role opens', 'hr,docs', 'Job post', 1, '', 0],
      ['onboard', 'Onboarding', 'Sends paperwork, training plan and first-week schedule to new hires.', 'When someone is hired', 'hr,docs', 'Onboarding pack', 1, '', 1],
      ['training', 'Training & Certifications', 'Tracks food handler, alcohol, safety and role certifications to expiry.', 'Weekly', 'hr', 'Expiring list', 0, '', 1],
      ['turnover', 'Turnover Watch', 'Tracks quits and early attrition by unit and manager.', 'Monthly', 'hr,labor', 'Turnover report', 0, '', 1],
      ['payroll-prep', 'Payroll Prep', 'Checks hours, tips and adjustments before payroll is sent.', 'Payroll week', 'labor,hr', 'Payroll check', 1, '', 1],
      ['breaks', 'Breaks & Minor Rules', 'Checks breaks, rest periods and minor work rules.', 'Daily', 'labor,hr', 'Rule exceptions', 0, '', 0],
      ['recognition', 'Recognition', 'Suggests who to thank this week, from reviews and numbers.', 'Every Friday', 'reviews,labor', 'Shout-out drafts', 1, '', 0],
      ['reviews-perf', 'Performance Reviews', 'Prepares review packets for managers.', 'Review cycle', 'hr,labor', 'Review packets', 1, '', 0]] },
    { id: 'supply', name: 'Supply & Purchasing', short: 'Supply', color: '#06b6d4', about: 'Buys the right things at the right price.', agents: [
      ['order-guide', 'Order Guides', 'Builds suggested orders from pars, on hand and the forecast.', 'Order days', 'inv,pos', 'Suggested order', 1, '', 1],
      ['price-watch', 'Vendor Price Watch', 'Flags items whose price went up since the last invoice.', 'When invoices arrive', 'ap', 'Price increases', 0, '', 1],
      ['invoice-match', 'Invoice Matching', 'Matches invoices to orders and receiving; flags shorts and subs.', 'When invoices arrive', 'ap,email', 'Exceptions', 0, '', 1],
      ['counts', 'Inventory Counts', 'Reminds count days and checks counts look sane.', 'Count days', 'inv', 'Count check', 0, '', 1],
      ['transfers', 'Unit Transfers', 'Suggests moving stock between units instead of ordering.', 'Daily', 'inv', 'Transfer list', 1, '', 0],
      ['bids', 'Vendor Bids', 'Runs bids on top items across vendors.', 'Quarterly', 'ap,web', 'Bid comparison', 1, '', 0],
      ['contracts-supply', 'Supply Contracts', 'Tracks contract prices and rebates you’re owed.', 'Monthly', 'docs,ap', 'Rebates due', 0, '', 0],
      ['spend', 'Spend by Category', 'Breaks purchasing into food, paper, cleaning, supplies and more.', 'Weekly', 'ap', 'Spend table', 0, '', 1],
      ['recalls', 'Recall Watch', 'Watches for recalls on items you buy.', 'Daily', 'web,ap', 'Recall alerts', 0, '', 0],
      ['equipment-buy', 'Equipment Buying', 'Compares quotes and lease vs. buy for equipment.', 'When requested', 'web,ap', 'Comparison', 1, '', 0],
      ['receiving', 'Receiving Checks', 'Checklists for receiving: temps, counts, quality.', 'On delivery', 'docs', 'Receiving log', 0, '', 0],
      ['sub-vendors', 'Backup Vendors', 'Keeps a backup vendor for every critical item.', 'Quarterly', 'ap,web', 'Backup list', 0, '', 0]] },
    { id: 'finance', name: 'Finance & Back Office', short: 'Finance', color: '#22c55e', about: 'Every dollar counted, every bill on time.', agents: [
      ['prime-cost', 'Prime Cost', 'Labor plus cost of goods as a share of sales, by unit.', 'Weekly', 'pos,labor,ap', 'Prime cost table', 0, 'primeCost', 1],
      ['pnl', 'Period P&L', 'Builds each unit’s P&L for the period and compares with budget.', 'Period close', 'books', 'P&L', 0, '', 1],
      ['budget', 'Budget Tracking', 'Flags lines running over budget.', 'Weekly', 'books', 'Over-budget lines', 0, '', 1],
      ['invoicing', 'Invoice Generation', 'Creates and sends customer invoices.', 'When work is done', 'books,email', 'Invoice drafts', 1, '', 0],
      ['collections', 'Collections', 'Chases late invoices in your voice; 30+ days goes to you.', 'Every weekday', 'books,email', 'Reminder drafts', 1, '', 0],
      ['ap', 'Bills to Pay', 'Lists bills due this week and proposes a pay run.', 'Every Monday', 'ap,books', 'Pay run', 1, '', 1],
      ['categorize', 'Transaction Categorizing', 'Categorizes bank and card transactions; leaves the unsure ones for you.', 'Daily', 'bank,books', 'Categorized list', 0, '', 1],
      ['reconcile', 'Bank Reconciliation', 'Reconciles accounts and flags differences.', 'Weekly', 'bank,books', 'Reconciliation', 0, '', 1],
      ['cash', 'Cash Forecast', '13-week cash forecast across all units.', 'Weekly', 'bank,books', 'Cash forecast', 0, '', 0],
      ['close', 'Month-End Close', 'Runs the close checklist and lists what’s missing.', 'Month end', 'books', 'Close checklist', 0, '', 1],
      ['sales-tax', 'Sales Tax', 'Prepares sales tax by jurisdiction and filing date.', 'Filing dates', 'pos,books', 'Tax worksheet', 1, '', 1],
      ['expenses', 'Expense Receipts', 'Matches receipts from email and photos to transactions.', 'Daily', 'email,bank', 'Matched receipts', 0, '', 0],
      ['email-triage', 'Finance Inbox Triage', 'Sorts bills, statements and vendor mail out of the inbox.', 'Every 30 minutes', 'email', 'Filed mail', 0, '', 0],
      ['cpa', 'CPA Packet', 'Assembles what the accountant needs for each unit.', 'Quarterly', 'books,docs', 'CPA packet', 1, '', 0],
      ['loans', 'Loans & Covenants', 'Tracks loan payments and covenant ratios.', 'Monthly', 'books', 'Covenant check', 0, '', 0],
      ['royalty', 'Royalties & Fees', 'Calculates royalties, ad fund and management fees between units.', 'Monthly', 'pos,books', 'Fee statement', 1, '', 0]] },
    { id: 'customer', name: 'Marketing & Customer', short: 'Customer', color: '#a855f7', about: 'Brings people in and brings them back.', agents: [
      ['reviews', 'Review Replies', 'Drafts replies to new reviews in your brand voice.', 'When a review posts', 'reviews,docs', 'Reply drafts', 1, '', 1],
      ['guest-scores', 'Guest Score Watch', 'Tracks guest survey scores (SMG and others) by unit.', 'Daily', 'reviews', 'Score trend', 0, '', 1],
      ['complaints', 'Complaint Triage', 'Routes complaints to the right unit and drafts the make-good.', 'When a complaint arrives', 'email,reviews', 'Make-good draft', 1, '', 1],
      ['local-mkt', 'Local Marketing', 'Plans local store marketing: schools, events, partners.', 'Monthly', 'cal,web', 'LSM plan', 1, '', 1],
      ['social', 'Social Posts', 'Writes and schedules posts for each unit.', 'Weekly', 'docs,cal', 'Post drafts', 1, '', 1],
      ['hooks', 'Hook & Caption Writing', 'Writes hooks and captions for short videos.', 'Weekly', 'docs', 'Caption drafts', 1, '', 0],
      ['email-mkt', 'Email Campaigns', 'Builds email campaigns to your customer list.', 'Monthly', 'docs,pos', 'Campaign draft', 1, '', 0],
      ['loyalty', 'Loyalty & Win-Back', 'Finds lapsed regulars and drafts a win-back offer.', 'Weekly', 'pos', 'Win-back list', 1, '', 0],
      ['promo', 'Promotion Results', 'Measures whether a promotion paid off.', 'After each promo', 'pos', 'Promo report', 0, '', 1],
      ['seo', 'SEO & Listings', 'Keeps Google, Yelp and map listings, hours and menus correct.', 'Weekly', 'web,docs', 'Listing fixes', 0, '', 1],
      ['ads', 'Ad Spend Watch', 'Tracks cost per customer by channel.', 'Weekly', 'books,web', 'Channel ROAS', 0, '', 0],
      ['health', 'Account Health', 'Scores client or B2B account health and flags churn risk.', 'Weekly', 'email,books', 'Health scores', 0, '', 0],
      ['qbr', 'Client Reviews (QBR)', 'Prepares quarterly business reviews for key clients.', 'Quarterly', 'books,docs', 'QBR deck', 1, '', 0],
      ['tickets', 'Support Tickets', 'Sorts and answers routine customer questions.', 'Every 30 minutes', 'email', 'Reply drafts', 1, '', 0]] },
    { id: 'risk', name: 'Compliance & Risk', short: 'Risk', color: '#ef4444', about: 'Keeps every unit legal, safe and insured.', agents: [
      ['permits', 'Permit & License Expiry', 'Watches every unit’s permits and licenses and warns 60 days out.', 'Weekly', 'docs,units', 'Expiring list', 0, '', 1],
      ['inspections', 'Inspection Prep', 'Mock inspection checklists before health, fire and safety visits.', 'Monthly', 'docs', 'Mock inspection', 0, '', 1],
      ['insurance', 'Insurance Review', 'Checks coverage, renewals and certificates from vendors.', 'Quarterly', 'docs', 'Coverage gaps', 1, '', 0],
      ['incidents', 'Incident Reports', 'Logs injuries, allergic reactions and complaints with follow-up.', 'When reported', 'docs,email', 'Incident file', 1, '', 1],
      ['labor-law', 'Labor Law Watch', 'Watches minimum wage, scheduling and posting changes where you operate.', 'Monthly', 'web', 'Rule changes', 0, '', 0],
      ['contractors', '1099 & Contractor Check', 'Collects W-9s and checks contractor classification.', 'Quarterly', 'ap,docs', 'Missing W-9s', 0, '', 0],
      ['data-privacy', 'Data & Card Security', 'PCI, password and access checks across systems.', 'Quarterly', 'docs', 'Security checklist', 0, '', 0],
      ['legal-docs', 'Contract Renewals', 'Warns before leases and contracts renew or expire.', 'Monthly', 'docs', 'Renewal list', 1, '', 0]] },
    { id: 'intel', name: 'Intelligence', short: 'Intel', color: '#3b82f6', about: 'Looks outward so you’re never surprised.', agents: [
      ['person-research', 'Person Research', 'Researches a person before you meet them.', 'Before a meeting', 'web,cal', 'One-page brief', 0, '', 0],
      ['pricing-research', 'Pricing Research', 'Checks competitor prices on your top items.', 'Monthly', 'web', 'Price table', 0, '', 0],
      ['market-news', 'Market News', 'Industry, local and commodity news that affects you.', 'Every morning', 'web', 'News digest', 0, '', 0],
      ['commodity', 'Commodity & Cost Trends', 'Tracks the costs that move your margins.', 'Weekly', 'web,ap', 'Cost trends', 0, '', 0],
      ['benchmarks', 'Industry Benchmarks', 'Compares your numbers with industry benchmarks.', 'Quarterly', 'web,books', 'Benchmark sheet', 0, '', 0],
      ['morning-page', 'Morning Page', 'One page at 7:00 a.m.: yesterday, today’s risks and what needs your yes.', 'Every morning at 7:00', 'units,pos,labor', 'Morning page', 0, 'morning', 1]] },
    { id: 'knowledge', name: 'Knowledge', short: 'Knowledge', color: '#94a3b8', about: 'What every agent reads first.', readByAll: true, agents: [
      ['sops', 'SOPs', 'Keeps the standard operating procedures every agent follows.', 'When an SOP changes', 'docs', 'SOP library', 0, '', 1],
      ['brand-voice', 'Brand Voice', 'How you sound, so every draft sounds like you.', 'When updated', 'docs', 'Voice guide', 0, '', 1],
      ['price-book', 'Price Book', 'Prices, packages and discounts agents may quote.', 'When prices change', 'docs', 'Price book', 0, '', 1],
      ['contracts', 'Contracts & Terms', 'Standard terms, policies and what agents may promise.', 'When updated', 'docs', 'Terms library', 0, '', 1]] }
  ];

  const AGENTS = [];
  for (const d of DEPTS) for (const a of d.agents) {
    const [key, name, does, trigger, reads, output, signoff, rule, lite] = a;
    AGENTS.push({ id: `${d.id}/${key}`, key, dept: d.id, name, does, trigger, reads: reads.split(','), output, signoff: !!signoff, rule, lite: !!lite });
  }
  DEPTS.forEach(d => { d.count = d.agents.length; });

  /* The workflow file for an agent (one per agent, like sales/flash.md) */
  function workflow(a) {
    const d = DEPTS.find(x => x.id === a.dept);
    return `# ${a.name}\n\n` +
      `**Department:** ${d.name}  \n**Runs:** ${a.trigger}  \n**Reads:** ${a.reads.map(r => INPUTS[r] || r).join(', ')}  \n**Produces:** ${a.output}  \n**Sign-off:** ${a.signoff ? 'Yes. Nothing leaves until you approve it.' : 'No. It only reports and flags.'}\n\n` +
      `## What it does\n${a.does}\n\n## Steps\n1. Read the Knowledge agents first (SOPs, brand voice, price book, terms).\n2. Pull ${a.reads.map(r => (INPUTS[r] || r).toLowerCase()).join(' and ')}.\n3. ${a.does}\n4. Write the result: ${a.output.toLowerCase()}.\n` +
      (a.signoff ? `5. Put it in **Needs your yes**. Send nothing until it’s approved.\n6. Log what happened.\n` : `5. Flag anything over your targets and log the run.\n`) +
      `\n**Status:** ${a.rule ? 'Live. Runs on your imported data today.' : 'Designed. Shows sample output until an AI is connected.'}\n`;
  }

  UC.INPUTS = INPUTS; UC.DEPTS = DEPTS; UC.AGENTS = AGENTS; UC.workflow = workflow;
  UC.agent = id => AGENTS.find(a => a.id === id);
  UC.dept = id => DEPTS.find(d => d.id === id);
})(window.UC);
