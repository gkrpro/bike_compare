const fs = require('fs');
const path = require('path');
const { runScrape } = require('./scrape');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_PATH = path.join(DATA_DIR, 'history.csv');
const HEADER = 'date,shop,name,price,currency,url\n';

function csvEscape(value) {
  const s = String(value ?? '');
  if (/["\n,]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Runs a fresh scrape, appends one row per bike to data/history.csv, and refreshes data/latest.json. */
async function main() {
  const payload = await runScrape();
  const date = payload.generatedAt.slice(0, 10); // YYYY-MM-DD snapshot date

  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, HEADER);
  }

  const rows = [];
  for (const shop of payload.shops) {
    if (!shop.ok) continue;
    for (const item of shop.items) {
      rows.push([date, shop.shop, item.name, item.price, item.currency, item.url].map(csvEscape).join(','));
    }
  }

  if (rows.length) {
    fs.appendFileSync(CSV_PATH, rows.join('\n') + '\n');
  }

  // Keep the dashboard's "latest" view in sync with this snapshot too.
  fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify(payload, null, 2));

  console.log(`Appended ${rows.length} rows to history.csv for ${date}`);
  for (const shop of payload.shops) {
    if (!shop.ok) console.warn(`  skipped ${shop.shop}: ${shop.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
