const { newContext } = require('../lib/browser');
const { withRetry, shortMessage } = require('../lib/retry');
const { combineWholeAndCents } = require('../lib/price');

const SHOP = 'Bikester';
const URL = 'https://www.bikester.be/';

// Bikester (Shopify) renders each product as a <product-card> custom
// element. The price is split across a text node ("€1.999") and a <sup>
// holding the cents ("00"), so we read them separately and recombine.
async function scrape(browser) {
  const context = await newContext(browser, { locale: 'fr-BE' });
  const page = await context.newPage();
  try {
    const raw = await withRetry(
      async () => {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForSelector('product-card', { timeout: 20000 });
        await page.waitForTimeout(1500);
        return page.$$eval('product-card', (nodes) =>
          nodes.map((node) => {
            const titleEl = node.querySelector('.card__title');
            const vendorEl = node.querySelector('.card__vendor');
            const linkEl = node.querySelector('a.card-link') || node.querySelector('a.js-prod-link');
            const priceValueEl = node.querySelector('.price__current .js-value');

            let wholeRaw = '';
            let centsRaw = '00';
            if (priceValueEl) {
              const supEl = priceValueEl.querySelector('sup');
              centsRaw = supEl ? supEl.textContent.trim() : '00';
              wholeRaw = Array.from(priceValueEl.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => n.textContent)
                .join('')
                .trim();
            }

            return {
              name: titleEl ? titleEl.textContent.trim() : null,
              brand: vendorEl ? vendorEl.textContent.trim() : null,
              url: linkEl ? linkEl.href : null,
              wholeRaw,
              centsRaw,
            };
          })
        );
      },
      { label: SHOP }
    );

    const items = raw
      .map((r) => ({
        name: r.name,
        brand: r.brand,
        url: r.url,
        price: combineWholeAndCents(r.wholeRaw, r.centsRaw),
        currency: 'EUR',
      }))
      .filter((p) => p.name && p.price != null);

    return { shop: SHOP, sourceUrl: URL, ok: true, items, scrapedAt: new Date().toISOString() };
  } catch (err) {
    return { shop: SHOP, sourceUrl: URL, ok: false, items: [], error: shortMessage(err), scrapedAt: new Date().toISOString() };
  } finally {
    await context.close();
  }
}

module.exports = { scrape, SHOP, URL };
