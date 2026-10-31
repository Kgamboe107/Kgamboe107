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

Column names are matched automatically. If an export uses different names, open **Column mapping** on any page and pick the right column. The app remembers your choice.

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

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install        # one time
npm start          # opens the desktop app
```

Other options:

```bash
npm run web        # run in your browser at http://localhost:5178 (no install needed)
npm run dist       # build an installer (.dmg / .exe / AppImage) into dist/
```

You can also just double-click `index.html`. Everything works that way except Google Drive and Outlook sign-in, which need `npm start` or `npm run web`.

**First time:** go to **Settings → Load sample data** to see every module filled in. The same sample files are also in `samples/` if you want to try uploading them by hand.

## Privacy

All files and data stay on your computer, in the app's local database (IndexedDB). Nothing is uploaded anywhere. The only outbound calls happen when you choose to connect Google Drive or Outlook. Use **Settings → Export backup** to archive your data or move it to another machine. That backup file includes personnel files, so store it securely.

## Project layout

```
index.html            app shell
css/app.css           styles (light + dark)
js/core.js            helpers: number parsing, formatting, column matching, stats
js/store.js           IndexedDB storage
js/ingest.js          file parsing, source + category detection
js/ui.js              tables, charts, KPI cards, column mapper
js/samples.js         sample data generator
js/modules/*.js       one file per page
main.js / server.js   Electron desktop shell + local server
vendor/               SheetJS, Chart.js, MSAL (bundled for offline use)
```
