# Ops Command Desk

A desktop command center for an operations manager. Upload spreadsheets, reports, research, and personnel files, and the app analyzes them in six modules:

| Module | What it does |
|---|---|
| **Dashboard** | Cross-module KPIs, a "needs attention" list of every flag, data coverage, and recent uploads. Prints to PDF. |
| **Data Library** | Drag and drop any file (CSV, XLSX, XLS, ODS, PDF, DOCX, PPTX, MD, images). Detects the source system and business category automatically. Supports tags, notes, preview, and download. |
| **Financials** | P&L trend, gross, net, and prime-cost margins, period-over-period growth, budget variance, and expense mix. |
| **Operations** | Labor %, sales per labor hour, overtime, schedule variance, food cost %, prime cost, a daily/location breakdown, and actual-vs-theoretical inventory variance. Flags are checked against targets you set. |
| **Trading Risk** | Positions: exposure, concentration (HHI), leverage, sector limits, stress tests. Trades: FIFO realized P&L, win rate, profit factor, drawdown, historical/parametric VaR, expected shortfall, Sharpe. Tools: position-size calculator, risk limits, pre-trade checklist. |
| **Marketing** | ROAS, CPA, CTR, CPC, and CPL by campaign, channel, and week, with budget-shift suggestions. Also a strategy workspace with SWOT and an initiatives board. |
| **Research** | Notes with status, tags, and source links. Anara exports import as editable notes. |
| **Personnel** | Headcount, tenure, turnover, early attrition, pay range, and a searchable directory. Each employee's record can hold their personnel files (reviews, I-9s, certifications). |
| **Data Explorer** | Pivot any table: group by any column, sum/avg/min/max/count, bucket by day or month, chart it, and export it. |

## Click any number for the details

Every number box on the dashboards and analysis pages is clickable (look for ↗ on hover). A panel slides out with the records behind it, and links go deeper:

| Click | You see |
|---|---|
| **Active headcount** | Who worked on the latest day (hours, cost), spend by department/role, and everyone's shifts, hours, overtime, cost and $/hr. Click a name for their profile, every shift, labor cost, I-9/W-4 status, signed documents and files. |
| Labor cost / hours / % · Sales per labor hour | By day (staff, hours, cost, sales, labor %), by position, top employees by cost |
| Turnover · Tenure · Pay rate | Who left and when (early quits flagged), tenure distribution, pay by position |
| Net sales | By location, average by weekday, by day |
| Food cost % · Purchases · Owed to you · Personal | By category and vendor, top items, price increases, receipts (click one to see its lines and photo) |
| Revenue · Net income | By period with margins |
| Exposure · Unrealized P&L | Weights, winners and losers, sector exposure, positions |
| Marketing spend · ROAS | By campaign, colored against your target |
| Overdue filings · 1099s · Licenses · Audit readiness · Lawsuit protection | The exact items behind the count |

Every table in the panel sorts and exports to CSV. **Esc** closes the panel and **←** goes back.

## Businesses, personal units & roll-up dashboards

Everything you track lives in a **unit**. There are two kinds, and you can have as many of each as you like:

- **Businesses**: stores, locations, companies and ventures (restaurant, retail, services, real estate company, trading firm, startup).
- **Personal**: your own money (personal finances, an investing or trading account, a rental property, freelance or side income, household and family).

Each unit has its own files, column mappings, targets and dashboard. Three roll-up dashboards sit on top:

| Dashboard | Rolls up | Headline numbers |
|---|---|---|
| **Business dashboard** | every business | revenue, net income, operating sales, marketing spend, headcount, trading exposure |
| **Personal dashboard** | every personal unit | income, net after expenses (savings rate), spending, investments, realized gains |
| **Everything** | both, shown as two sections | totals across all units |

Switch units from the card at the top of the sidebar. It groups Businesses and Personal, each with its roll-up dashboard and a **+ Add** button. **Units** (in the sidebar) is where you add, edit, archive, merge and delete. Adding a unit starts with "Business or personal?", then name and type, then modules. Personal units hide the business-only pages (payroll and sales-tax compliance, business legal documents).

**Sidebar:** collapse it to an icon rail with the button next to the logo (or Ctrl+\\). Click a section name (Analysis, Reports, Tools) to fold it away. The app remembers both settings.

## Targets & weekly KPI review sheet

**Weekly Review** (sidebar → Reports, or the *Weekly review* button on any dashboard).

- **Set targets** for each unit. Every target is either "at most" or "at least":
  - Business units: net sales, labor %, food cost %, prime cost %, sales per labor hour, overtime %, total purchases, net margin, guest satisfaction, store audit score, marketing spend and ROAS, and overdue filings.
  - Personal units: income, spending, savings rate, net worth, cash and emergency fund, invested assets, debts, and realized trading P&L.
  - Labor, food, prime cost, sales per labor hour and overtime targets are shared with Operations. Guest and audit targets are shared with Marketing.
  - Untick a metric to leave it off the sheet.
- **Review a week:** step back and forth with ‹ ›. Each metric shows its target, this week, last week, the change, the 4-week average, a trend, and On target / Close (within 5%) / Off target. The page also lists wins, misses, this week's alerts, and notes for next week (saved per week).
- **Print review sheet:** a plain one-page sheet per unit with a notes section and a sign-off line. On the Business or Personal dashboard (or Everything), it prints one page per unit. Use *Microsoft Print to PDF* to save it as a PDF.
- Balances and scores (net worth, debts, SMG, audits, overdue filings) are marked *(latest)*. They are current values, not weekly totals.

## Reporting periods (daily, weekly, monthly, quarterly, yearly, fiscal year)

The period picker in the top bar (‹ [Weekly · Wk of Oct 26] ›) sets the period for the dashboards, Financials, Purchases, Operations, Trading and Marketing.

- **Views:** All time · Daily (any date range, with presets: Today, Yesterday, Last 7/14/30/90 days, Month to date, Year to date) · Weekly · Monthly · Quarterly · Yearly · Fiscal year.
- **Step through periods** with the ‹ › arrows or the `[` and `]` keys. The menu also lists the 8 most recent periods.
- **Calendar per unit:** set the fiscal-year start month (for example, July gives FY2027 = Jul 2026 – Jun 2027) and whether weeks start Monday or Sunday.
- **Grouping:** a week or month shows days, a quarter shows weeks, and a year or fiscal year shows months. A date range picks a grouping from its length.
- **Comparisons:** KPIs show the change against the previous period, for example "▼5.5% vs previous week" or "▼1.6 pts" for labor %.
- Only rows with a mapped date column are filtered. Rows without a readable date are kept.

## Family wealth, individual views & Taxes / CPA

**Family members** (Units → Personal → Edit family members): add each person (you, spouse/partner, children, parents) with an optional birth year. Every personal unit and every account belongs to a person or is **joint**. The person bar (Family · Koen · Jamie · …) on the Personal dashboard, Net Worth and Taxes & CPA pages switches between the whole family and **one person's individual view** (their accounts and units plus joint ones).

**Net Worth** (sidebar → Analysis):
- **Accounts:** checking, savings, brokerage, 401(k)/403(b), traditional and Roth IRA, HSA, 529, crypto, home, vehicles and business ownership, plus debts (mortgage, auto, student loan, credit card). Each account has an owner, tax treatment, interest rate and balance history.
- **Import brokerage positions:** upload a positions export from Schwab, Fidelity, Vanguard, Robinhood, Webull or E*TRADE. Each account in the file becomes an investment account with its holdings, and the app guesses its type and tax treatment (Roth, IRA, 401(k), HSA, 529, taxable). Importing a newer file updates the balances.
- **Update balances:** type every balance on one screen. Each update adds a point to the month-end net-worth history.
- The page shows net worth, invested assets, cash, debts, change over time (counting only accounts tracked since the start date), per-person cards, tax buckets (taxable / tax-deferred / Roth / HSA / 529), debts sorted by interest rate, and a holdings table. It flags balances that are more than 45 days old.
- In the Personal dashboard (or Everything) roll-up, this becomes the **family wealth** view across every personal unit.

**Taxes & CPA** (sidebar → Reports; personal units only):
- **CPA document checklist** generated from your family and accounts: W-2s, consolidated 1099s per brokerage, 1099-INT, 5498 / 1099-R, HSA 5498-SA / 1099-SA, 1098 mortgage interest, 1098-E, property tax, Schedule C items for side income, Schedule E items for rentals, childcare and more. Tick items off and attach the PDFs.
- **Contributions vs. IRS limits** per person: 401(k), IRA and HSA, with catch-up amounts from birth year (50+, 60–63, and HSA 55+). 2026 limits are built in, and so are the 2027 HSA limits. The 2027 401(k) and IRA limits stay at 2026 levels until the IRS publishes them.
- **Realized gains** from imported trade history, **tax-loss harvesting candidates** (taxable positions below cost, with a wash-sale caution), and **estimated tax payment** dates with amounts and a paid status.
- **CPA packet (Excel):** Summary, Documents, Accounts (year-end and current balances), Contributions, Holdings, Tax-loss candidates, Estimated payments, and Side income & rentals.
- **Ask AI to review** sends the picture to your AI (Ollama keeps it on your computer).
- This is an organizer, not tax advice.

## Reports it reads automatically

Drop files on the window (or click **Upload**) and the app works out what each one is and sends its numbers to the right pages. Every page and dashboard updates immediately, and a summary shows where each file went.

| You upload | It becomes |
|---|---|
| **CrunchTime Labor Variance** (CSV, one week, days across the top) | One rolling **daily sales & labor** table: actual vs. forecast sales, labor $, hours, OT, shifts, SPLH, bread count. Feeds Operations, Personnel and the sales side of food cost. Weeks are combined; uploading a week again replaces it. |
| **CrunchTime Purchase Journal** (PDF) | Every invoice and store transfer in the **Purchases** journal, split into food, produce, beverage, paper, cleaning, kitchen supplies and misc. Feeds food cost % and Tax & Compliance. The total is checked against the report. |
| **CrunchTime inventory count / variance** (PDF) | Operations **inventory variance by item**: book vs. physical, actual vs. theoretical usage, dollars missing. |
| **CrunchTime Actual vs. Theoretical cost** (PDF) | Operations **food cost gap** panel: points and dollars above theoretical by category (meat, bread, cheese…), with the trend between periods. |
| **PowerPoint** (.pptx) / **Word** (.docx) | A searchable Research note, with slide titles, bullets, tables and speaker notes. A **scorecard table** (Measure / Now / goal dates) shows on the dashboard, with a live "this week" number where the app can measure it. |
| Any other **PDF** | Its tables become data tables you can map or explore, and its text is searchable. |
| Spreadsheets (CSV/XLSX) | Data tables, matched to pages by their columns, as before. |

It also flags problems: a file whose name doesn't match the dates inside it, the same week uploaded twice, missing weeks, and totals that don't match the report. If the reports belong to a specific store (e.g. "11053 - Auburn"), the summary offers to give that store its own business.

**Which table a page uses:** real data always beats sample data, then the best column fit, then the newest upload. If you pick a table by hand, that choice sticks until newer data that fits as well arrives. Once you have real receipts, sample receipts stop counting. Food cost % compares purchases and sales over the same days.

## Guest scores & store audits (7 Principles of Success)

**Marketing → Guest scores & audits** tracks how guests and auditors see the store, organized by Jersey Mike's 7 Principles of Success: 1. Clean and well maintained · 2. Well stocked · 3. Fresh · 4. Neat and well-groomed · 5. Proper procedures · 6. Sharing our lives · 7. Inviting people in.

- **Import SMG report:** upload a **Full Scale** or **Trend** report exported from SMG (Report and Analytics → Report Builder → Export → CSV or Excel). The scores fill in automatically, one period for a Full Scale report and one per week for a Trend report. Jersey Mike's system average and your franchise group come along as benchmarks, plus the "why not satisfied" follow-up answers. Reports with a store number (e.g. 11053) go to the business whose name contains that number. Re-importing replaces the same period.
- **Type in SMG scores:** enter each survey period's percentages (overall satisfaction, taste, speed, cleanliness, friendliness, order and digital accuracy, likely to return, value), with optional region numbers, guest comments and the SMG report attached.
- **Start an audit:** a step-by-step walk-through, one step per principle, with each check marked Yes / Needs work / N/A, plus notes per principle. Use it for self-evaluations, operational audits, district visits or health inspections. If the auditor gave an official score, enter it and it's used as the audit score. You can attach the report.
- **The 7 Principles scoreboard** shows each principle's latest audit score next to the SMG measures guests use to judge it (cleanliness → Principle 1, taste → 3, speed and accuracy → 5, friendliness → 6, overall satisfaction and likely to return → 7). It includes the change from last period, the region comparison and the exact items to fix.
- Trends, goals (defaults are the April 1 targets: audit 90% with an 88% gate, overall 85%, speed 80%, cleanliness 85%, digital accuracy 90%), dashboard tiles, a click-through panel, and live numbers in the dashboard's goals scorecard.

## Entering data by hand

### Purchases: receipts → purchase journal → food cost

**Purchases** in the sidebar (or **Ctrl/⌘ + E** from anywhere) opens a new receipt. Three ways to fill it:

| Way | Best for |
|---|---|
| **Type it** | Any receipt. Items you've bought before fill in their category and last price automatically. Enter adds the next line. |
| **Paste receipt text** | Costco app → Account → Orders & Purchases → open a warehouse receipt → copy. Also works with emailed Sam's Club and Restaurant Depot receipts. Instant savings are applied to the right item, and "2 @ 13.99" sets the quantity. Works offline. |
| **Scan photo with AI** | Snap the paper receipt. Grok reads the lines, totals and date (needs an xAI key). The photo stays attached to the receipt. |

Built for how small businesses actually shop:
- **Personal items on a business receipt** (the TV in the Costco cart) are recorded but kept out of business totals.
- **Paid on your personal card?** The app tracks what the business owes you back.
- **Total check:** enter the receipt total and it tells you if the lines + tax don't add up.
- **Price watch** flags items that went up since your last purchase (e.g. avocados +14% at US Foods).
- **Food cost %** = (beginning inventory + food purchases − ending inventory) ÷ food sales, for this week, last week, this month, last month, year to date, or a custom range. Sales fill in automatically from your sales table (uploaded or typed in), or you can type them. Inventory counts are optional.
- Categories group into **Food**, **Beverage**, **Alcohol**, **Supplies** (paper, cleaning, smallwares), **Other** and **Personal**.
- Export the journal or every line item as CSV for your bookkeeper. The live **Purchase journal** table also appears in Data Explorer, Financials' expense mix, and the AI Assistant's context.

### Typed-in tables

**Data Library → Type it in (new table)** (also in the Ctrl/⌘ K palette) gives a spreadsheet-style editor with templates:

| Template | Columns | Feeds |
|---|---|---|
| Daily sales | Date, Location, Net Sales, Guest Count | Operations + food cost % |
| Labor hours | Date, Employee, Position, Hours, Overtime, Pay Rate | Operations (labor %, SPLH) |
| Inventory count | Item, Unit, On Hand, Unit Cost, Value (auto-calculated) | beginning/ending inventory |
| Monthly P&L | Month, Revenue, COGS, Labor, Operating/Other Expenses | Financials |
| Expenses | Date, Vendor, Category, Amount, Paid With | Financials expense mix |
| Marketing spend | Date, Campaign, Channel, Spend, Clicks, Conversions, Revenue | Marketing |
| Blank | rename columns to anything | Data Explorer |

Typed tables autosave and work everywhere an uploaded spreadsheet does. Any imported table can be corrected too: open it in Data Library → **Edit data**.

## Reports: Tax & Compliance

**Tax & Compliance** (under *Reports* in the sidebar) keeps track of what has to be filed, paid, renewed and documented, per business. A red badge in the sidebar counts overdue filings.

| Tab | What it does |
|---|---|
| **Overview** | Audit-readiness score, overdue / upcoming filings, a "fix to stay audit-ready" list, a year-end summary, and a one-click **accountant workbook** (Excel: summary, sales tax, payroll, 1099, purchases, receipts, filings, licenses, activity log). |
| **Filing calendar** | Deadlines generated from your tax profile: sales tax returns, Form 941 (quarterly), 940, W-2/W-3, 1099-NEC/MISC, Form 8027 (tipped employees), estimated taxes, and your income tax return (Schedule C / 1065 / 1120-S / 1120). Also covers license renewals and custom state/local items. Weekend deadlines move to the next business day. **Mark filed** records the date, amount, confirmation # and who filed, with the return or payment receipt attached. |
| **Sales tax** | Estimated tax per filing period from your sales data, your rate and taxable share; paid vs. estimated; sales tax you paid on purchases, with a resale-certificate hint when you paid tax on food for resale. |
| **Payroll tax** | Employer Social Security (6.2% up to the $184,500 2026 wage base), Medicare 1.45%, FUTA and state unemployment by quarter, from your labor data. Employee withholding comes from your payroll provider. |
| **1099 contractors** | Totals per vendor from Purchases plus contractor payments you record. Card/PayPal payments are excluded (the processor reports them on 1099-K). Flags who needs a 1099 at the 2026 **$2,000** threshold ($600 for 2025 and earlier), tracks W-9s and TIN last 4, suggests likely service providers, and exports CSV. |
| **Licenses & permits** | Business license, health permit, seller's permit, liquor license, ServSafe/food handler certifications, fire inspection, insurance policies, lease, music licensing. Includes number, issuer, expiry, renewal cost and an attached copy, with expiring/expired warnings. |
| **Records & audit log** | IRS record-retention guidance, receipts missing documentation, and an automatic activity log of receipt changes, deleted files, filings, license and 1099 decisions. |
| **Setup** | Entity type, state, sales tax rate/frequency/due day, employees, FUTA/SUTA rates, Form 8027, estimated taxes. |

Audit readiness also checks that active employees have an **I-9 and W-4** in their personnel file (attach them on the Personnel page).

> These are estimates for tracking and preparation, not tax or legal advice. Confirm with your CPA, payroll provider and state/local agencies.

## Legal & Risk

**Legal & Risk** (under *Reports*) helps you avoid the lawsuits that most often hit small businesses, and have the paperwork ready if one comes.

**Risk check:** about 30 yes/no checks weighted by how often each leads to lawsuits and how costly they are. Many answer themselves from your data:
- **Insurance** (general liability, liquor liability, workers' comp, EPLI, cyber, delivery auto) is matched against your license/insurance register, including expiry.
- **Entity & money:** LLC/corporation status from your tax profile, and **commingling** (personal items paid with business funds, owner-paid purchases to reimburse) from your receipts.
- **Employment:** **overtime**, meaning employee-weeks over 40 hours with no overtime recorded in your timesheets (grouped by employee ID); I-9/W-4 on file; handbook acknowledgments; contractor agreements and W-9s; tip pool, breaks, harassment training, posters, minors, biometric time clocks.
- **Premises & guests:** floor checks, allergen procedures, incident write-ups, alcohol service training, physical accessibility.
- **Online & data:** privacy policy, **website accessibility** (ADA website suits are rising fast), **text-message consent** (TCPA: $500–$1,500 per text), email rules, card security, disk encryption + app lock, breach plan.

The **Fix first** list ranks gaps by risk, with a button that takes you to the fix.

**Documents:** 16 templates filled in from your business details. The ones that apply are chosen from what you do (website, online ordering, texts, alcohol, events, employees…):

| For | Documents |
|---|---|
| Your website | Privacy policy, Terms of use, Accessibility statement, Cookie banner & notice |
| Customers | SMS marketing terms & opt-in, Email sign-up & CAN-SPAM footer, Event/class liability waiver, Photo & video release, Signs & notices (allergen, consumer advisory, cameras, alcohol, posters) |
| Employees | Handbook & policies acknowledgment, Confidentiality agreement, Employee privacy notice, Biometric time-clock consent |
| Contractors | Independent contractor agreement |
| Internal | Data breach response plan, Record retention & destruction policy |

Preview, edit, then **Save version**: a dated copy goes to the Data Library so you can prove which version was in effect. Export to **Word** or **Print/PDF**, or copy the text into your website builder. Blanks you still need to fill are highlighted.

**Signatures:** a matrix of employees and 1099 contractors against the documents they need to sign. Record each signature with its date and method, attach the signed copy (it's filed in the employee's personnel folder), and see who's still missing.

**Incident log:** same-day reports of slip-and-falls, injuries, allergic reactions, illness complaints, intoxicated guests, security incidents, harassment complaints and breaches, with witnesses, actions taken, police and insurer claim numbers, photos and status. There's also a one-click **floor/safety check** log, the best defense to slip-and-fall claims.

**App lock** (Settings → Security): a passcode required to open the app, auto-lock after inactivity, and **Ctrl/⌘ Shift L** to lock instantly. The passcode is stored only as a PBKDF2-SHA256 hash, and repeated wrong attempts slow down. Pair it with BitLocker/FileVault disk encryption.

Everything is recorded in the activity log, and the protection score appears on the dashboards and in the AI Assistant's context.

> Templates and checklists to reduce risk, not legal advice. Have a licensed attorney in your state review documents before relying on them.

## AI Assistant (Ollama, Groq, Grok, Perplexity)

| Provider | Cost | Best for | Privacy |
|---|---|---|---|
| **Ollama** (default) | Free, unlimited | Everyday analysis of your own numbers | Runs on your PC; nothing leaves your computer |
| **Groq** | Free plan (~1,000 requests/day) | Faster answers online | Doesn't train on your data |
| **Grok** (xAI) | Paid per token | Strong reasoning, receipt photo scanning | |
| **Perplexity** | Paid per request | Web research with sources | |

**Setting up Ollama (no terminal needed):** open Integrations (or the AI Assistant) → Ollama → **Download Ollama**, install it, and the app finds it within a few seconds. Pick a model (Llama 3.2 is recommended, a 2 GB download) and click **Download model**. A progress bar shows the download. When it finishes, Ollama becomes your default AI, and it switches on automatically every time the app starts. Requests go through the app's local relay to Ollama's own API with a 12K-token context, so your KPIs and tables fit.

Connect any of them on the Integrations page and switch between them in the AI Assistant.

Open **AI Assistant** in the sidebar (or press **Ctrl/⌘ + /**).

| | Use it for | Get a key |
|---|---|---|
| **Perplexity** | Live web research with clickable sources: competitors, pricing, benchmarks, news on your positions. Choose **Quick** or **Thorough** depth. | [perplexity.ai → API keys](https://www.perplexity.ai/account/api/keys) |
| **Grok (xAI)** | Reasoning over your own numbers: briefings, "why is labor high at Airport?", what to cut or scale. Models load from your account. | [console.x.ai](https://console.x.ai) |

- **Connecting:** paste a key on the AI page or under **Integrations → AI providers**, then click **Test**. In the desktop app, keys are encrypted by Windows/macOS. In a browser they stay in that browser. Keys are never included in backups.
- **What the AI sees:** you choose on the right side of the AI page: your KPIs and flagged issues (one business, or all of them in Master view), optionally one data table, and optionally your research notes. Nothing else is sent. Personnel tables show a warning before they're shared.
- **Shortcuts:**
  - **AI briefing** buttons on every dashboard.
  - Type anything in **Ctrl/⌘ K** to get *Ask Grok* or *Research with Perplexity*.
  - **Ask Grok too / Ask Perplexity too** gets a second opinion on any answer.
  - **Save to Research** files an answer with its sources as a research note.
- Usage is billed by each provider to your own account. Perplexity answers show their cost.
- Perplexity is accessed via its **Agent API** (`/v1/agent`). The older Sonar Chat Completions API was retired on Sep 27, 2026.

## Integrations

| App | How it connects |
|---|---|
| **Google Drive** | Live. Sign in with Google and pick files. Sheets are imported as XLSX and Docs/Slides as PDF. Needs a free Google Cloud OAuth Client ID and API key (step-by-step instructions are on the Integrations page). |
| **Outlook / Microsoft 365** | Live. Sign in with Microsoft, search your mail, and import attachments. A CrunchTime report emailed every night can be pulled straight in. Needs a free Azure app registration (instructions in the app). |
| **Harri** | Export the timesheet/labor report or the employee roster as CSV/Excel and import it. Timesheets feed Operations; rosters feed Personnel. |
| **CrunchTime** | Export Daily Sales, Actual vs. Theoretical, or Inventory Variance and import it. These feed Operations. |
| **Webull** | Export positions or order history (CSV) and import it. These feed Trading Risk. |
| **Dub** | No public export exists, so fill in the downloadable template from your holdings and import it. |
| **Anara** | Export notes as Markdown or PDF and import them. They feed Research. |

Harri, CrunchTime, Webull, and Dub don't offer an open API that an individual can sign in to from a desktop app. Harri's and CrunchTime's APIs are partner/enterprise-only. Webull's OpenAPI requires signing requests on a server with an app secret. So these connect through their exports, which the app recognizes automatically by file name and column headers.

**Add-ons & resources.** The bottom of the Integrations page links to open-source projects that pair well with the app: the Claude plugins marketplace, Archify (workflow diagrams), AI job search (hiring), God's Eye View (3D map) and Awesome GPT Image 2 (marketing image prompts). They open on GitHub; nothing is installed automatically.

## Look & feel

- **Liquid glass.** Frosted, layered cards float over a slowly drifting color backdrop: warm sand and teal in light mode, deep teal and indigo in dark mode. Cards catch light along their top edge, and KPI cards show a glossy sweep on hover. On an older PC, switch to **Settings → Appearance → Solid** for a faster flat look.
- **Greeting.** The dashboard says good morning/afternoon/evening, with today's date. Add your first name in Settings → Appearance.
- **Icon chips** on every KPI card show at a glance what each number is about.
- **Searchable dropdowns.** Any list with 8+ choices lets you type to filter, scroll, or use ↑ ↓ and Enter.
- **Clear confirmations.** Deleting asks with specific buttons, like "Delete receipt" (red) or "Keep receipt". The safe choice is focused, and Esc cancels.
- **Input masks.** Phone, ZIP and state fields format themselves as you type: (555) 123-4567, 98101-1234, WA.
- **Step-by-step forms.** New business and Legal → Business details are split into short steps with a progress bar.
- **Descriptive progress.** Importing several files shows "Importing 2 of 5 · payroll.xlsx" with a progress bar.

## Install

**Download the installer** from the [Releases page](https://github.com/Kgamboe107/Kgamboe107/releases/latest):

| Your computer | Download |
|---|---|
| Windows 10/11 | `Ops-Command-Desk-Setup-x.y.z.exe` |
| Mac with Apple Silicon (M1–M4) | `…-mac-arm64.dmg` |
| Mac with Intel | `…-mac-x64.dmg` |
| Linux | `.AppImage` (any distro) or `.deb` (Ubuntu/Debian) |

The app isn't code-signed yet, so the first launch shows a warning:
- **Windows:** "Windows protected your PC" → **More info → Run anyway**.
- **Mac:** drag the app to Applications, then **right-click → Open → Open**. If macOS says it "is damaged", run `xattr -cr "/Applications/Ops Command Desk.app"` in Terminal and open it again.

**Troubleshooting:** if the window ever opens blank, close it and open it again. The app detects this and restarts in safe graphics mode. A diagnostic log is saved at `%APPDATA%\Ops Command Desk\logs\main.log` on Windows (`~/Library/Application Support/Ops Command Desk/logs` on Mac), or open it from **Settings → Open diagnostic logs**. You can also start in safe mode manually with the `--safe-mode` flag.

On first launch, a short setup wizard names your first business and offers to load sample data.

### Building a new installer

Installers are built by GitHub Actions (`.github/workflows/release.yml`):
- **Manually:** GitHub → **Actions → Build installers → Run workflow**.
- **On release:** bump `version` in `package.json`, commit, and push a matching tag (`git tag v1.2.0 && git push --tags`).

Either way, a Release appears with Windows, Mac, and Linux installers attached.

### Run from source

```bash
npm install
npm start          # desktop app
npm run web        # browser at http://localhost:5178
npm run dist       # build an installer for this computer into dist/
```

## Using it

- **⌘K / Ctrl+K:** the command palette. Jump to any page, switch businesses, upload, create a business, toggle the theme, or search everything.
- **⌘U / Ctrl+U** upload · **⌘B / Ctrl+B** new business · **⌘J / Ctrl+J** light/dark · **G D** dashboard · **G M** master dashboard · **?** all shortcuts.
- Drag files anywhere onto the window to upload them into the business you're viewing.

## Privacy

All files and data stay on your computer, in the app's local database (IndexedDB). Nothing is uploaded anywhere. The only outbound calls happen when you choose to connect Google Drive or Outlook. Use **Settings → Export backup** to archive your data or move it to another machine. That backup file includes personnel files, so store it securely.

## Project layout

```
index.html            app shell
css/app.css           styles (light + dark)
js/core.js            helpers: number parsing, formatting, column matching, stats
js/biz.js             businesses: workspaces, scoping, per-business settings
js/store.js           IndexedDB storage
js/ingest.js          file parsing, source + category detection
js/ui.js              tables, charts, KPI cards, column mapper
js/ux.js              confirm dialogs, searchable dropdowns, input masks, stepped forms, progress pill, import summary
js/pdfx.js            PDF table reader (column edges from data alignment, wrapped-cell rejoining)
js/pptx.js            PowerPoint / Word reader (slides, tables, speaker notes)
js/guest.js           SMG scores & audits by the 7 Principles of Success
js/reports.js         report translators (CrunchTime labor variance, purchase journal, inventory, AvT, decks)
js/samples.js         sample data generator
js/modules/*.js       one file per page
js/fx.js              icons, animations, toasts, command palette, onboarding
js/ai.js              Perplexity + Grok clients, business context, answer formatting, receipt photo reading
js/purchasing.js      receipt parsing, auto-categories, item memory, price watch, food cost
js/compliance.js      deadlines, sales/payroll tax estimates, 1099 tally, licenses, audit log, readiness
js/legal.js           legal document templates, lawsuit-risk checklist + data signals
js/lock.js            app passcode lock
js/drill.js           click-through detail panels for every KPI
main.js / preload.js  Electron desktop shell
server.js             local server (Google/Microsoft sign-in + allowlisted AI relay)
build/icon.png        app icon
.github/workflows/    installer builds
vendor/               SheetJS, Chart.js, MSAL (bundled for offline use)
```
