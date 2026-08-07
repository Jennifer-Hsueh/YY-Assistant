// Fetches Bank of Taiwan's published spot exchange rates (public CSV, no
// API key needed) and computes a "mid rate" (average of spot buy/sell) for
// the requested currency pair. This is only a suggested default — the
// frontend lets the user override it, since this isn't a live trading feed.
const BOT_CSV_URL = 'https://rate.bot.com.tw/xrt/flcsv/0/day';

let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — BOT updates a few times a day

async function fetchBotRates() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  const res = await fetch(BOT_CSV_URL);
  if (!res.ok) throw new Error(`Bank of Taiwan feed returned ${res.status}`);
  const text = await res.text();

  // CSV columns: 幣別,匯率別,現金買入,現金賣出,即期買入,即期賣出,...
  const rates = {};
  text.split('\n').forEach((line) => {
    const cols = line.split(',');
    if (cols.length < 6) return;
    const code = cols[0]?.trim();
    const spotBuy = parseFloat(cols[4]);
    const spotSell = parseFloat(cols[5]);
    if (code && !Number.isNaN(spotBuy) && !Number.isNaN(spotSell) && spotBuy > 0 && spotSell > 0) {
      rates[code] = { spotBuy, spotSell, mid: (spotBuy + spotSell) / 2 };
    }
  });

  cache = { data: rates, fetchedAt: now };
  return rates;
}

// Returns "1 unit of `from` = ? units of `to`", using TWD as the bridge
// currency since Bank of Taiwan only quotes each currency against TWD.
async function getExchangeRate(req, res) {
  try {
    const from = String(req.query.from || '').toUpperCase();
    const to = String(req.query.to || '').toUpperCase();
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required' });
    }
    if (from === to) {
      return res.json({ rate: 1, source: 'same-currency' });
    }

    const rates = await fetchBotRates();

    let rate;
    if (from === 'TWD') {
      const toRate = rates[to];
      if (!toRate) return res.status(404).json({ error: `No rate found for ${to}` });
      rate = 1 / toRate.mid;
    } else if (to === 'TWD') {
      const fromRate = rates[from];
      if (!fromRate) return res.status(404).json({ error: `No rate found for ${from}` });
      rate = fromRate.mid;
    } else {
      const fromRate = rates[from];
      const toRate = rates[to];
      if (!fromRate || !toRate) return res.status(404).json({ error: 'Rate not found for one or both currencies' });
      rate = fromRate.mid / toRate.mid;
    }

    return res.json({ rate: Number(rate.toFixed(6)), source: 'Bank of Taiwan (spot mid rate)' });
  } catch (err) {
    console.error('[exchangeRateController.getExchangeRate]', err);
    return res.status(500).json({ error: 'Failed to fetch exchange rate' });
  }
}

module.exports = { getExchangeRate };
