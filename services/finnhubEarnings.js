/**
 * Finnhub earnings calendar — past + future reports.
 * Used by the Earnings tab page service to find which major tickers reported
 * in a given historical window (Alpha Vantage only returns future entries).
 *
 * Finnhub free tier covers /calendar/earnings with reasonable rate limits.
 */

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

/**
 * Fetch earnings calendar entries between `from` and `to` (YYYY-MM-DD).
 * Returns the raw array as Finnhub provides it:
 *   [{ date, hour, symbol, year, quarter, epsEstimate, epsActual,
 *      revenueEstimate, revenueActual }]
 * Empty array on failure / missing key.
 */
export async function fetchEarningsCalendarRange(from, to) {
  if (!FINNHUB_API_KEY) {
    console.warn('FINNHUB_API_KEY not set — earnings calendar history unavailable');
    return [];
  }
  try {
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`Finnhub earnings calendar HTTP ${resp.status}`);
      return [];
    }
    const json = await resp.json();
    return Array.isArray(json?.earningsCalendar) ? json.earningsCalendar : [];
  } catch (error) {
    console.error('Finnhub earnings calendar error:', error.message);
    return [];
  }
}
