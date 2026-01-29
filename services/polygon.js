// Polygon.io - Market Data
// Free tier: 5 API calls/minute
// Get API key: https://polygon.io/dashboard/signup

const API_KEY = process.env.POLYGON_API_KEY || '';
const BASE_URL = 'https://api.polygon.io';

// Fetch market status and additional data
export async function fetchPolygonData() {
  if (!API_KEY) {
    console.warn('Polygon API key not configured');
    return getDefaultPolygonData();
  }

  try {
    // Get market status
    const statusUrl = `${BASE_URL}/v1/marketstatus/now?apiKey=${API_KEY}`;
    const statusResponse = await fetch(statusUrl);

    if (!statusResponse.ok) {
      throw new Error(`Polygon API error: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();

    // Get previous day aggregates for major indices
    const tickersToFetch = ['SPY', 'QQQ', 'DIA', 'IWM'];
    const aggregates = {};

    for (const ticker of tickersToFetch) {
      try {
        const aggUrl = `${BASE_URL}/v2/aggs/ticker/${ticker}/prev?apiKey=${API_KEY}`;
        const aggResponse = await fetch(aggUrl);

        if (aggResponse.ok) {
          const aggData = await aggResponse.json();
          if (aggData.results && aggData.results.length > 0) {
            aggregates[ticker] = aggData.results[0];
          }
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch (err) {
        console.warn(`Polygon aggregate error for ${ticker}:`, err.message);
      }
    }

    return {
      marketStatus: statusData,
      aggregates: aggregates,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Polygon API error:', error.message);
    return getDefaultPolygonData();
  }
}

// Fetch ticker news from Polygon
export async function fetchPolygonNews(ticker = 'SPY') {
  if (!API_KEY) return [];

  try {
    const url = `${BASE_URL}/v2/reference/news?ticker=${ticker}&limit=5&apiKey=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Polygon news error: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];

  } catch (error) {
    console.error('Polygon news error:', error.message);
    return [];
  }
}

// Default data when API unavailable
function getDefaultPolygonData() {
  return {
    marketStatus: {
      market: 'open',
      earlyHours: false,
      afterHours: false
    },
    aggregates: {},
    timestamp: new Date().toISOString()
  };
}
