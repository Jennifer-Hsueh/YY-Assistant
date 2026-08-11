// Uses the fawazahmed0/currency-api (community-maintained, free, no API key,
// hosted via CDN — not a scraped consumer webpage, so it isn't blocked by
// bot-protection the way bank/broker websites are). Two mirrors are tried
// in order for resilience. Data updates roughly once a day.
const PRIMARY_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
const FALLBACK_BASE = 'https://latest.currency-api.pages.dev/v1/currencies';

const cache = new Map(); // fromCurrency (lowercase) -> { data, fetchedAt }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — this feed only updates ~daily anyway

async function fetchRatesFor(fromLower) {
  const cached = cache.get(fromLower);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const urls = [`${PRIMARY_BASE}/${fromLower}.json`, `${FALLBACK_BASE}/${fromLower}.json`];
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log(`[exchangeRateController] ${url} -> ${res.status}`);
      if (!res.ok) { lastErr = new Error(`status ${res.status}`); continue; }
      const data = await res.json();
      cache.set(fromLower, { data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      console.warn(`[exchangeRateController] fetch failed for ${url}:`, err.message);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All currency-api mirrors failed');
}

// Returns "1 unit of `from` = ? units of `to`".
async function getExchangeRate(req, res) {
  try {
    const from = String(req.query.from || '').toLowerCase();
    const to = String(req.query.to || '').toLowerCase();
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required' });
    }
    if (from === to) {
      return res.json({ rate: 1, source: 'same-currency' });
    }

    const data = await fetchRatesFor(from);
    const rate = data?.[from]?.[to];
    if (rate === undefined) {
      return res.status(404).json({ error: `No rate found for ${from} -> ${to}` });
    }

    return res.json({ rate: Number(Number(rate).toFixed(6)), source: 'currency-api (community feed, daily updates)' });
  } catch (err) {
    console.error('[exchangeRateController.getExchangeRate]', err);
    return res.status(500).json({ error: 'Failed to fetch exchange rate' });
  }
}

module.exports = { getExchangeRate };
