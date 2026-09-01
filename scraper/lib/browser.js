// A realistic desktop Chrome UA/viewport combo. A couple of the target shops
// run bot-detection (Cloudflare Turnstile, Akamai) that is more likely to
// let a request through when it looks like an ordinary browser tab.
const REALISTIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function newContext(browser, { locale = 'fr-BE', contextOptions = {} } = {}) {
  return browser.newContext({
    userAgent: REALISTIC_UA,
    viewport: { width: 1366, height: 900 },
    locale,
    extraHTTPHeaders: { 'accept-language': `${locale},fr;q=0.9,en;q=0.8` },
    ...contextOptions,
  });
}

module.exports = { newContext, REALISTIC_UA };
