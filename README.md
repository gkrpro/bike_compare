# Bike Price Compare

A small GitHub-hosted tool that scrapes bike listings from a few online shops,
publishes them as a searchable/sortable comparison table on GitHub Pages, and
keeps a weekly price-history CSV so prices can be tracked over time.

**Live dashboard:** enable GitHub Pages once (see [Setup](#setup)), then it's at
`https://gkrpro.github.io/bike_compare/`.

## Shops tracked

| Shop | URL scraped | Status |
|---|---|---|
| Cyclovia | `cycloviastore.com/shop/?sort=price_low` | Reliable — clean schema.org markup |
| Bikester | `bikester.be/` | Reliable — Shopify product cards |
| Bike24 | `bike24.be/fr/cyclisme/velos` | **Unreliable** — Akamai bot protection returns `403 Access Denied` on essentially every automated request, including from a real Chrome UA. This may or may not clear from GitHub Actions' IPs; the scraper is best-effort and simply reports the shop as unavailable when blocked. |
| Decathlon | `decathlon.be/fr/tous-les-sports/velo` | **Intermittent** — sits behind Cloudflare Turnstile. It gets through with a realistic browser context roughly half the time in testing; the other half it's held on the "Un instant…" challenge page. This is inherent to the site's bot protection, not something headers/retries can fully fix. |

Because of the above, the pipeline is built to degrade gracefully: each shop
is scraped independently, a failure on one never blocks the others, and the
dashboard clearly shows which shops succeeded on the last run.

"Live" here means *refreshed periodically by a scheduled job*, not a
real-time feed — a browser can't scrape these shops directly (CORS), so a
GitHub Actions job does it on a schedule and the static page just displays
the latest snapshot.

## How it works

```
scraper/
  sites/*.js     one scraper per shop, returns { shop, ok, items[], error? }
  scrape.js      runs all shops in parallel -> data/latest.json
  snapshot.js    same, but also appends one row per bike to data/history.csv
site/            the static dashboard (fetches data/latest.json)
data/
  latest.json    most recent scrape, used by the dashboard
  history.csv    one row per bike per weekly snapshot: date,shop,name,price,currency,url
.github/workflows/
  refresh.yml         every 6h + on push to scraper/site + manual: re-scrapes,
                       commits data/latest.json, redeploys the Pages site
  weekly-history.yml  every Monday 06:00 UTC + manual: re-scrapes, appends a
                       row per bike to data/history.csv
```

Both workflows can also be run on demand from the Actions tab
(`workflow_dispatch`) instead of waiting for the schedule.

## Setup

1. Push this repo to GitHub (see below).
2. In **Settings → Pages**, set **Source** to **GitHub Actions** (one-time,
   can't be done from a workflow file). The next `refresh.yml` run will then
   publish the dashboard.
3. That's it — the schedules take over from there. Trigger a first run
   manually from the **Actions** tab if you don't want to wait.

## Running locally

```bash
npm install
npx playwright install --with-deps chromium
npm run scrape     # writes data/latest.json
npm run snapshot   # writes data/latest.json AND appends to data/history.csv
```

Open `site/index.html` through a static file server (not `file://`, since
it `fetch()`s `data/latest.json`) — e.g. `npx serve site` after copying
`data/latest.json` into `site/data/`.

## Adjusting cadence

Edit the `cron` lines in `.github/workflows/refresh.yml` (dashboard refresh)
and `weekly-history.yml` (CSV snapshot). Keep the refresh interval
reasonable — these are ordinary retail sites, not APIs meant for polling.

## Adding another shop

Copy `scraper/sites/cyclovia.js` as a template, adjust the selectors for the
new site's product cards, and add it to the `sites` array in
`scraper/scrape.js`.
