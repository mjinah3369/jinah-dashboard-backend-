// Alpha Vantage - Economic Calendar & News
// Free tier: 25 requests/day
// Get API key: https://www.alphavantage.co/support/#api-key

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';

// Mag7 — index-moving mega-caps. Get top priority in the earnings card.
const MAG7 = new Set(['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA']);

// Major banks — surfaced for the YM/ES affected-instrument mapping.
const MAJOR_BANKS = new Set(['JPM', 'BAC', 'WFC', 'GS', 'C', 'MS', 'PNC', 'USB', 'TFC', 'COF']);

// Curated S&P 500 universe — the names that actually move ES on earnings.
// Includes Mag7 + the top ~70 by market cap + sector leaders. Refresh annually
// or when index constituents shift materially. Better to err small (cuts more
// micro-caps) than large (lets noise back into the card).
const SP500_TICKERS = new Set([
  // Mag7 (also in MAG7 above)
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA',
  // Other mega caps
  'BRK.B', 'BRK.A', 'LLY', 'AVGO', 'V', 'MA', 'UNH', 'XOM', 'JNJ', 'PG',
  'HD', 'CVX', 'ABBV', 'MRK', 'PEP', 'KO', 'COST', 'WMT', 'ADBE', 'CSCO',
  'NFLX', 'ORCL', 'CRM', 'AMD', 'ACN', 'TMO', 'MCD', 'ABT', 'LIN', 'PFE',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'BLK', 'SPGI', 'PNC',
  'USB', 'TFC', 'COF', 'SCHW', 'BX', 'CME', 'ICE',
  // Tech & semis
  'INTC', 'IBM', 'QCOM', 'TXN', 'MU', 'AMAT', 'LRCX', 'KLAC', 'ASML',
  'PANW', 'CRWD', 'NOW', 'INTU', 'UBER', 'SHOP', 'SNOW', 'PLTR',
  // Industrials & energy
  'BA', 'CAT', 'GE', 'RTX', 'LMT', 'DE', 'MMM', 'HON', 'UPS', 'FDX',
  'COP', 'EOG', 'SLB', 'OXY', 'PSX', 'MPC', 'VLO',
  // Healthcare & pharma
  'NVO', 'AZN', 'BMY', 'GILD', 'AMGN', 'CVS', 'MDT', 'ELV', 'CI', 'HUM',
  'ISRG', 'DHR', 'SYK', 'BSX', 'REGN', 'VRTX',
  // Consumer & staples
  'NKE', 'DIS', 'SBUX', 'BKNG', 'CMG', 'TGT', 'LOW', 'PM', 'MO', 'CL',
  'EL', 'KHC', 'GIS', 'KR',
  // Telecom & media
  'VZ', 'T', 'CMCSA', 'TMUS', 'CHTR', 'WBD',
  // Real estate & utilities
  'PLD', 'AMT', 'EQIX', 'SPG', 'NEE', 'SO', 'DUK', 'D',
  // Other notable
  'BABA', 'TSM', 'NVS'
]);

// Determine which futures instruments are affected by a company's earnings.
// Mag7 -> NQ + ES; major banks -> ES + YM; others -> ES only.
function getAffectedInstruments(symbol) {
  if (MAG7.has(symbol)) return ['NQ', 'ES'];
  if (MAJOR_BANKS.has(symbol)) return ['ES', 'YM'];
  return ['ES'];
}

// Sort key: Mag7 first (0), then other S&P 500 alphabetically (1).
function earningsSortKey(symbol) {
  return MAG7.has(symbol) ? 0 : 1;
}

// Fetch economic calendar - uses our built-in calendar with real dates
// Alpha Vantage doesn't provide a proper economic calendar API
export async function fetchEconomicCalendar() {
  // Always return our curated economic calendar with proper dates
  // This includes NFP, CPI, FOMC, and other scheduled high-impact events
  return getDefaultEconomicEvents();
}

// Fetch earnings calendar — filtered to S&P 500 + Mag7 only.
// Pre-fix this took the alphabetical top 10 of Alpha Vantage's CSV which
// surfaced micro-caps (APUS, EH, FINV, IMTE, IVA) instead of index movers.
export async function fetchEarningsCalendar() {
  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=1day&apikey=${API_KEY}`;

    const response = await fetch(url);
    const text = await response.text();

    // Parse CSV response
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length <= 1) return [];

    // Parse every data row into a candidate (cheap; ~hundreds of rows max).
    const candidates = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < 3) continue;
      const symbol = values[0]?.replace(/"/g, '').trim();
      const reportDate = values[2]?.replace(/"/g, '').trim();
      if (!symbol) continue;
      candidates.push({ symbol, reportDate });
    }

    // Filter to S&P 500 + Mag7 universe so micro-caps don't surface.
    const relevant = candidates.filter(c => SP500_TICKERS.has(c.symbol));

    // Sort: Mag7 first, then alphabetical within each tier.
    relevant.sort((a, b) => {
      const keyDiff = earningsSortKey(a.symbol) - earningsSortKey(b.symbol);
      if (keyDiff !== 0) return keyDiff;
      return a.symbol.localeCompare(b.symbol);
    });

    // Take up to 10 — same cap as pre-fix, just filtered properly now.
    return relevant.slice(0, 10).map(c => ({
      company: c.symbol,
      time: 'TBD',
      affectedInstruments: getAffectedInstruments(c.symbol)
    }));
  } catch (error) {
    console.error('Earnings calendar fetch error:', error.message);
    return [];
  }
}

// Default events when API fails or rate limited
function getDefaultEconomicEvents() {
  const now = new Date();

  // Get upcoming economic events with actual dates
  const upcomingEvents = getUpcomingEconomicCalendar(now);

  // Filter to events within next 14 days
  const twoWeeksFromNow = new Date(now);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  return upcomingEvents.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= now && eventDate <= twoWeeksFromNow;
  });
}

// Generate upcoming economic calendar with real dates
function getUpcomingEconomicCalendar(fromDate) {
  const events = [];
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth();

  // Helper: Find nth weekday of month (0=Sun, 1=Mon, ..., 5=Fri)
  function getNthWeekdayOfMonth(year, month, weekday, n) {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    let dayOffset = weekday - firstWeekday;
    if (dayOffset < 0) dayOffset += 7;
    const date = 1 + dayOffset + (n - 1) * 7;
    return new Date(year, month, date);
  }

  // Helper: Get last weekday of month
  function getLastWeekdayOfMonth(year, month, weekday) {
    const lastDay = new Date(year, month + 1, 0);
    const lastDayWeekday = lastDay.getDay();
    let dayOffset = lastDayWeekday - weekday;
    if (dayOffset < 0) dayOffset += 7;
    return new Date(year, month + 1, -dayOffset);
  }

  // Generate events for current and next month
  for (let m = 0; m <= 1; m++) {
    const targetMonth = month + m;
    const targetYear = targetMonth > 11 ? year + 1 : year;
    const adjustedMonth = targetMonth % 12;

    // Non-Farm Payrolls - First Friday of month
    const nfpDate = getNthWeekdayOfMonth(targetYear, adjustedMonth, 5, 1);
    events.push({
      date: nfpDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Non-Farm Payrolls',
      importance: 'HIGH',
      previous: '256K',
      forecast: '170K',
      actual: null
    });

    // Unemployment Rate - Same day as NFP
    events.push({
      date: nfpDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Unemployment Rate',
      importance: 'HIGH',
      previous: '4.1%',
      forecast: '4.1%',
      actual: null
    });

    // CPI - Usually around 12th-14th of month
    const cpiDate = new Date(targetYear, adjustedMonth, 12);
    // Adjust to nearest Wednesday
    while (cpiDate.getDay() !== 3) {
      cpiDate.setDate(cpiDate.getDate() + 1);
    }
    events.push({
      date: cpiDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'CPI (Consumer Price Index)',
      importance: 'HIGH',
      previous: '2.9%',
      forecast: '2.8%',
      actual: null
    });

    // Core CPI - Same day as CPI
    events.push({
      date: cpiDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Core CPI (ex Food & Energy)',
      importance: 'HIGH',
      previous: '3.2%',
      forecast: '3.1%',
      actual: null
    });

    // Retail Sales - Around 15th of month
    const retailDate = new Date(targetYear, adjustedMonth, 15);
    // Adjust to nearest Thursday
    while (retailDate.getDay() !== 4) {
      retailDate.setDate(retailDate.getDate() + 1);
    }
    events.push({
      date: retailDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Retail Sales',
      importance: 'HIGH',
      previous: '0.4%',
      forecast: '0.3%',
      actual: null
    });

    // ISM Manufacturing PMI - First business day of month
    const ismDate = new Date(targetYear, adjustedMonth, 1);
    while (ismDate.getDay() === 0 || ismDate.getDay() === 6) {
      ismDate.setDate(ismDate.getDate() + 1);
    }
    events.push({
      date: ismDate.toISOString().split('T')[0],
      time: '10:00 AM ET',
      event: 'ISM Manufacturing PMI',
      importance: 'HIGH',
      previous: '49.3',
      forecast: '49.5',
      actual: null
    });

    // Initial Jobless Claims - Every Thursday
    let thursday = new Date(targetYear, adjustedMonth, 1);
    while (thursday.getDay() !== 4) {
      thursday.setDate(thursday.getDate() + 1);
    }
    // Add all Thursdays of the month
    while (thursday.getMonth() === adjustedMonth) {
      events.push({
        date: thursday.toISOString().split('T')[0],
        time: '8:30 AM ET',
        event: 'Initial Jobless Claims',
        importance: 'MEDIUM',
        previous: '214K',
        forecast: '212K',
        actual: null
      });
      thursday.setDate(thursday.getDate() + 7);
    }
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Filter out past events
  return events.filter(e => new Date(e.date) >= new Date(fromDate.toISOString().split('T')[0]));
}
