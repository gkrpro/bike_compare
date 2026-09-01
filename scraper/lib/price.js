/**
 * Parses a price string such as "4 899,00 €", "2 499,99 €", "€1.999" or a
 * plain number into a float. Handles both European (comma decimal, space or
 * dot thousands separator) and plain-number formats.
 */
function parseEuroPrice(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  let s = String(raw).replace(/ /g, ' ').trim();
  s = s.replace(/[€$£]/g, '').trim();
  s = s.replace(/[^\d.,\s]/g, '');
  s = s.replace(/\s/g, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Comma is the decimal separator, dot(s) are thousands separators.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot could be a decimal separator or a thousands separator.
    const parts = s.split('.');
    const fraction = parts[parts.length - 1];
    const looksLikeThousands = parts.length > 2 || fraction.length === 3;
    if (looksLikeThousands) {
      s = s.replace(/\./g, '');
    }
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(/[.,]/g, '');
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * Combines a "whole" price fragment (e.g. "€1.999") with a separately
 * rendered "cents" fragment (e.g. "00" from a <sup>) into a float. Used for
 * sites that split the price into two DOM nodes.
 */
function combineWholeAndCents(whole, cents) {
  const cleanWhole = String(whole ?? '').replace(/[^\d]/g, '');
  const cleanCents = String(cents ?? '00')
    .replace(/[^\d]/g, '')
    .padEnd(2, '0')
    .slice(0, 2);
  if (!cleanWhole) return null;
  const n = parseFloat(`${cleanWhole}.${cleanCents}`);
  return Number.isFinite(n) ? n : null;
}

module.exports = { parseEuroPrice, combineWholeAndCents };
