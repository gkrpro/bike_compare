const { newContext } = require('../lib/browser');
const { withRetry, shortMessage } = require('../lib/retry');

const SHOP = 'Cyclovia';
const URL = 'https://www.cycloviastore.com/shop/?sort=price_low';

// Cyclovia (WordPress) marks up every product with schema.org Product/Offer
// microdata, so the itemprop attributes give us clean, structured data
// straight out of the DOM - no text scraping/parsing needed.
async function scrape(browser) {
  const context = await newContext(browser, { locale: 'fr-FR' });
  const page = await context.newPage();
  try {
    const items = await withRetry(
      async () => {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForSelector('[itemtype="https://schema.org/Product"]', { timeout: 20000 });
        await page.waitForTimeout(1000);
        return page.$$eval('[itemtype="https://schema.org/Product"]', (nodes) =>
          nodes
            .map((node) => {
              const name = node.querySelector('meta[itemprop="name"]')?.content?.trim() || null;
              const priceMeta = node.querySelector('[itemprop="offers"] meta[itemprop="price"]');
              const price = priceMeta ? parseFloat(priceMeta.content) : null;
              const currency =
                node.querySelector('[itemprop="offers"] meta[itemprop="priceCurrency"]')?.content || 'EUR';
              const url = node.querySelector('[itemprop="offers"] link[itemprop="url"]')?.href || null;
              return { name, price, currency, url };
            })
            .filter((p) => p.name && p.price != null)
        );
      },
      { label: SHOP }
    );

    return { shop: SHOP, sourceUrl: URL, ok: true, items, scrapedAt: new Date().toISOString() };
  } catch (err) {
    return { shop: SHOP, sourceUrl: URL, ok: false, items: [], error: shortMessage(err), scrapedAt: new Date().toISOString() };
  } finally {
    await context.close();
  }
}

module.exports = { scrape, SHOP, URL };
