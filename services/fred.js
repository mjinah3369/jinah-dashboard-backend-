// FRED API - Federal Reserve Economic Data
// Unlimited requests with free API key
// Get API key: https://fred.stlouisfed.org/docs/api/api_key.html

const API_KEY = process.env.FRED_API_KEY || 'demo';
const BASE_URL = 'https://api.stlouisfed.org/fred';

// Key economic indicators
const FRED_SERIES = {
  'DFF': 'Fed Funds Rate',
  'T10Y2Y': '10Y-2Y Spread',
  'UNRATE': 'Unemployment Rate',
  'CPIAUCSL': 'CPI',
  'GDP': 'GDP',
  'UMCSENT': 'Consumer Sentiment'
};

export async function fetchFredData() {
  const results = {};

  try {
    // Fetch multiple series in parallel
    const promises = Object.keys(FRED_SERIES).map(async (seriesId) => {
      try {
        const url = `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${API_KEY}&file_type=json&limit=2&sort_order=desc`;

        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`FRED API error for ${seriesId}: ${response.status}`);
          return null;
        }

        const data = await response.json();
        const observations = data.observations || [];

        if (observations.length > 0) {
          const latest = observations[0];
          const previous = observations[1];

          return {
            seriesId,
            name: FRED_SERIES[seriesId],
            value: parseFloat(latest.value) || 0,
            previousValue: previous ? parseFloat(previous.value) || 0 : null,
            date: latest.date,
            change: previous ? (parseFloat(latest.value) - parseFloat(previous.value)) : 0
          };
        }
        return null;
      } catch (err) {
        console.warn(`FRED fetch error for ${seriesId}:`, err.message);
        return null;
      }
    });

    const responses = await Promise.all(promises);

    responses.forEach(item => {
      if (item) {
        results[item.seriesId] = item;
      }
    });

    return results;

  } catch (error) {
    console.error('FRED API error:', error.message);
    return getDefaultFredData();
  }
}

// Analyze FRED data to determine macro conditions
export function analyzeFredConditions(fredData) {
  const conditions = {
    rateEnvironment: 'neutral',
    yieldCurve: 'normal',
    laborMarket: 'stable',
    inflation: 'moderate'
  };

  // Fed Funds Rate analysis
  const fedFunds = fredData['DFF'];
  if (fedFunds) {
    if (fedFunds.value > 5) conditions.rateEnvironment = 'restrictive';
    else if (fedFunds.value < 2) conditions.rateEnvironment = 'accommodative';
  }

  // Yield curve analysis (10Y-2Y spread)
  const yieldSpread = fredData['T10Y2Y'];
  if (yieldSpread) {
    if (yieldSpread.value < 0) conditions.yieldCurve = 'inverted';
    else if (yieldSpread.value < 0.5) conditions.yieldCurve = 'flat';
  }

  // Unemployment
  const unemployment = fredData['UNRATE'];
  if (unemployment) {
    if (unemployment.value > 5) conditions.laborMarket = 'weak';
    else if (unemployment.value < 4) conditions.laborMarket = 'tight';
  }

  return conditions;
}

// Default data when API unavailable
function getDefaultFredData() {
  return {
    'DFF': { seriesId: 'DFF', name: 'Fed Funds Rate', value: 5.33, previousValue: 5.33, change: 0 },
    'T10Y2Y': { seriesId: 'T10Y2Y', name: '10Y-2Y Spread', value: -0.25, previousValue: -0.28, change: 0.03 },
    'UNRATE': { seriesId: 'UNRATE', name: 'Unemployment Rate', value: 4.1, previousValue: 4.2, change: -0.1 },
  };
}
