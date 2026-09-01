const { newContext } = require('../lib/browser');
const { withRetry, shortMessage } = require('../lib/retry');
const { parseEuroPrice } = require('../lib/price');

const SHOP = 'Bike24';
const URL = 'https://www.bike24.be/fr/cyclisme/velos';

// NOTE: bike24.be sits behind Akamai bot protection and returned a 403
// "Access Denied" page in every test made while building this scraper -
// including from a real Chrome UA/viewport. That looks like an IP-reputation
// block rather than something fixable with headers, so it may well fail the
// same way from GitHub Actions runners. This scraper is best-effort: it
// tries structured JSON-LD data first, then a couple of generic product-tile
// selector patterns, and always returns ok:false with the error instead of
// throwing - so a persistent block here never breaks the rest of the run.
async function scrape(browser) {
  const context = await newContext(browser, { locale: 'fr-BE' });
  const page = await context.newPage();
  try {
    const raw = await withRetry(
      async () => {
        const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        const status = resp ? resp.status() : 0;
        const title = await page.title();
        if (status >= 400 || /access denied/i.test(title)) {
          throw new Error(`blocked (status ${status}, title "${title}")`);
        }
        await page.waitForTimeout(2000);

        const ldItems = await page.$$eval('script[type="application/ld+json"]', (nodes) => {
          const out = [];
          for (const n of nodes) {
            try {
              const data = JSON.parse(n.textContent);
              const list = Array.isArray(data) ? data : [data];
              for (const entry of list) {
                const products = entry.itemListElement || (entry['@type'] === 'Product' ? [entry] : []);
                for (const p of products) {
                  const item = p.item || p;
                  if (item && item.name && item.offers) {
                    const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                    out.push({
                      name: item.name,
                      url: item.url || null,
                      priceText: offers.price,
                      currency: offers.priceCurrency,
                    });
                  }
                }
              }
            } catch {
              // Skip malformed/unrelated JSON-LD blocks.
            }
          }
          return out;
        });
        if (ldItems.length) return ldItems;

        const selectors = ['[data-testid*="product"]', '.product-tile', 'article[class*="product"]'];
        for (const sel of selectors) {
          const found = await page
            .$$eval(sel, (nodes) =>
              nodes.map((node) => {
                const nameEl = node.querySelector('[class*="name"], [class*="title"], h2, h3');
                const priceEl = node.querySelector('[class*="price"]');
                const linkEl = node.querySelector('a[href]');
                return {
                  name: nameEl ? nameEl.textContent.trim() : null,
                  priceText: priceEl ? priceEl.textContent.trim() : null,
                  url: linkEl ? linkEl.href : null,
                };
              })
            )
            .catch(() => []);
          if (found.length) return found;
        }
        return [];
      },
      { label: SHOP, attempts: 2 }
    );

    const items = raw
      .map((r) => ({
        name: r.name,
        url: r.url,
        price: parseEuroPrice(r.priceText),
        currency: r.currency || 'EUR',
      }))
      .filter((p) => p.name && p.price != null);

    if (!items.length) {
      throw new Error('no products found (page structure may have changed, or the request was blocked)');
    }

    return { shop: SHOP, sourceUrl: URL, ok: true, items, scrapedAt: new Date().toISOString() };
  } catch (err) {
    return { shop: SHOP, sourceUrl: URL, ok: false, items: [], error: shortMessage(err), scrapedAt: new Date().toISOString() };
  } finally {
    await context.close();
  }
}

module.exports = { scrape, SHOP, URL };
