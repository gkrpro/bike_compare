/**
 * Retries an async function a few times with a growing delay between
 * attempts. Shop sites occasionally hiccup (slow load, transient bot
 * check, flaky network) and a retry is usually enough to recover.
 */
async function withRetry(fn, { attempts = 3, baseDelayMs = 2000, label = 'task' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      console.warn(`[retry] ${label} attempt ${attempt}/${attempts} failed: ${err.message}`);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
      }
    }
  }
  throw lastErr;
}

/** Reduces a (possibly multi-line, Playwright-verbose) error to a short, single-line message. */
function shortMessage(err) {
  return String(err?.message ?? err).split('\n')[0].trim();
}

module.exports = { withRetry, shortMessage };
