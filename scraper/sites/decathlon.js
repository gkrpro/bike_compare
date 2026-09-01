const { newContext } = require('../lib/browser');
const { withRetry, shortMessage } = require('../lib/retry');
const { parseEuroPrice } = require('../lib/price');

const SHOP = 'Decathlon';
const URL = 'https://www.decathlon.be/fr/tous-les-sports/velo';

// decathlon.be sits behind Cloudflare Turnstile. It usually lets a request
// with a realistic UA/viewport through, but occasionally shows an
// interstitial "checking your browser" page instead - that's what the retry
// and the sanity check below are for. The page itself is a stack of
// carousels rather than one flat grid, so we collect every
// article.product-card found after scrolling, de-duplicated by URL.
async function scrape(browser) {
  const context = await newContext(browser, { locale: 'fr-BE' });
  const page = await context.newPage();
  try {
    const raw = await withRetry(
      async () => {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);

        try {
          const consentBtn = page.locator('#didomi-notice-agree-button');
          await consentBtn.waitFor({ timeout: 5000 });
          await consentBtn.click();
        } catch {
          // Consent banner didn't show (already accepted / different locale) - fine.
        }
        await page.waitForTimeout(1000);

        // Scroll to trigger the lazy-loaded carousels further down the page.
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, 2000);
          await page.waitForTimeout(700);
        }

        await page.waitForSelector('article.product-card', { timeout: 20000 });

        return page.$$eval('article.product-card', (nodes) =>
          nodes.map((node) => {
            const titleLink = node.querySelector('.product-card-details__item__title a');
            const amountEl = node.querySelector('.product-card-details__item__price [data-part="amount"]');
            const priceText = amountEl
              ? Array.from(amountEl.childNodes)
                  .filter((n) => n.nodeType === Node.TEXT_NODE)
                  .map((n) => n.textContent)
                  .join('')
                  .trim()
              : null;
            return {
              name: titleLink ? titleLink.textContent.trim() : null,
              url: titleLink ? titleLink.href : null,
              priceText,
            };
          })
        );
      },
      { label: SHOP, attempts: 2 }
    );

    const seen = new Set();
    const items = raw
      .map((r) => ({ name: r.name, url: r.url, price: parseEuroPrice(r.priceText), currency: 'EUR' }))
      .filter((p) => p.name && p.price != null && p.url && !seen.has(p.url) && seen.add(p.url));

    return { shop: SHOP, sourceUrl: URL, ok: true, items, scrapedAt: new Date().toISOString() };
  } catch (err) {
    return { shop: SHOP, sourceUrl: URL, ok: false, items: [], error: shortMessage(err), scrapedAt: new Date().toISOString() };
  } finally {
    await context.close();
  }
}

module.exports = { scrape, SHOP, URL };
