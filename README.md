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

## Multiple businesses & the Master dashboard

Use the **Viewing** switcher at the top of the sidebar to move between businesses, or pick **+ New business…** to add one. You can also manage them on the **Businesses** page.

- **Each business is its own workspace.** It has its own files, notes, column mappings, targets (labor %, ROAS, risk limits…), strategy board, and dashboard.
- **Templates** (Restaurant, Trading, E-commerce, Services, Real estate, Startup, Custom) choose which modules a business uses. Pages you don't need are hidden, and you can change the selection at any time.
- **★ All businesses** opens the **Master dashboard**. It shows consolidated totals (revenue, net income, sales, marketing spend, headcount, trading exposure), compares revenue and net income by business, gives each venture a card with its key numbers, and lists every flag across all of them. Click any card or flag to jump straight into that business. Module pages in this view analyze data from all businesses together.
- **Uploads go to the business you're viewing.** The Data Library has a Business picker for uploads and a Business column for moving files later.
- **Archive** a venture to hide it from the Master totals, or **delete** it and either move its data to another business or remove it permanently.

Column names are matched automatically. If an export uses different names, open **Column mapping** on any page and pick the right column. The app remembers your choice.

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

## AI Assistant (Perplexity + Grok)

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
js/samples.js         sample data generator
js/modules/*.js       one file per page
js/fx.js              icons, animations, toasts, command palette, onboarding
js/ai.js              Perplexity + Grok clients, business context, answer formatting, receipt photo reading
js/purchasing.js      receipt parsing, auto-categories, item memory, price watch, food cost
main.js / preload.js  Electron desktop shell
server.js             local server (Google/Microsoft sign-in + allowlisted AI relay)
build/icon.png        app icon
.github/workflows/    installer builds
vendor/               SheetJS, Chart.js, MSAL (bundled for offline use)
```
