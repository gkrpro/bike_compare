const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const sites = [
  require('./sites/cyclovia'),
  require('./sites/bikester'),
  require('./sites/bike24'),
  require('./sites/decathlon'),
];

const DATA_DIR = path.join(__dirname, '..', 'data');

/** Scrapes every configured shop and returns the combined result payload. */
async function runScrape() {
  const browser = await chromium.launch();
  try {
    const results = await Promise.all(sites.map((site) => site.scrape(browser)));
    const generatedAt = new Date().toISOString();
    const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
    return { generatedAt, totalItems, shops: results };
  } finally {
    await browser.close();
  }
}

async function main() {
  const payload = await runScrape();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify(payload, null, 2));

  for (const shop of payload.shops) {
    const status = shop.ok ? `${shop.items.length} bikes` : `FAILED (${shop.error})`;
    console.log(`${shop.shop}: ${status}`);
  }
  console.log(`Total: ${payload.totalItems} bikes across ${payload.shops.length} shops`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runScrape };
