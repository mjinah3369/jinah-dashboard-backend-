/**
 * FRED API - Federal Reserve Economic Data
 * Comprehensive real-time economic indicators
 *
 * FREE API - Unlimited requests with API key
 * Get API key: https://fred.stlouisfed.org/docs/api/api_key.html
 *
 * Data includes: NFP, CPI, PPI, GDP, Retail Sales, Jobless Claims,
 * Consumer Sentiment, Treasury Yields, Fed Funds Rate, etc.
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://api.stlouisfed.org/fred';

// Comprehensive FRED Series with trading impact info
const FRED_SERIES = {
  // Employment (HIGH IMPACT)
  PAYEMS: { name: 'Non-Farm Payrolls', category: 'Employment', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'NQ', 'ZN', 'DXY'], unit: 'thousands' },
  UNRATE: { name: 'Unemployment Rate', category: 'Employment', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'NQ', 'ZN'], unit: 'percent' },
  ICSA: { name: 'Initial Jobless Claims', category: 'Employment', frequency: 'Weekly', impact: 'MEDIUM', affects: ['ES', 'NQ'], unit: 'claims' },
  CCSA: { name: 'Continuing Claims', category: 'Employment', frequency: 'Weekly', impact: 'LOW', affects: ['ES'], unit: 'claims' },
  JTS1000JOL: { name: 'JOLTS Job Openings', category: 'Employment', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'NQ'], unit: 'thousands' },

  // Inflation (HIGH IMPACT)
  CPIAUCSL: { name: 'CPI All Items', category: 'Inflation', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'NQ', 'GC', 'ZN'], unit: 'index' },
  CPILFESL: { name: 'Core CPI (Ex Food & Energy)', category: 'Inflation', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'NQ', 'GC', 'ZN'], unit: 'index' },
  PPIACO: { name: 'PPI All Commodities', category: 'Inflation', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'CL', 'GC'], unit: 'index' },
  PCEPILFE: { name: 'Core PCE (Fed Preferred)', category: 'Inflation', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'NQ', 'GC', 'ZN'], unit: 'percent' },

  // GDP & Growth
  GDP: { name: 'Gross Domestic Product', category: 'Growth', frequency: 'Quarterly', impact: 'HIGH', affects: ['ES', 'NQ', 'DXY'], unit: 'billions' },
  GDPC1: { name: 'Real GDP', category: 'Growth', frequency: 'Quarterly', impact: 'HIGH', affects: ['ES', 'NQ'], unit: 'billions' },

  // Consumer
  RSXFS: { name: 'Retail Sales Ex Food Services', category: 'Consumer', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'NQ', 'RTY'], unit: 'millions' },
  UMCSENT: { name: 'U of Michigan Consumer Sentiment', category: 'Consumer', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'NQ'], unit: 'index' },
  PCE: { name: 'Personal Consumption Expenditures', category: 'Consumer', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'NQ'], unit: 'billions' },

  // Housing
  HOUST: { name: 'Housing Starts', category: 'Housing', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'RTY'], unit: 'thousands' },
  PERMIT: { name: 'Building Permits', category: 'Housing', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'RTY'], unit: 'thousands' },
  HSN1F: { name: 'New Home Sales', category: 'Housing', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'RTY'], unit: 'thousands' },

  // Manufacturing
  IPMAN: { name: 'Industrial Production Manufacturing', category: 'Manufacturing', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'YM'], unit: 'index' },
  DGORDER: { name: 'Durable Goods Orders', category: 'Manufacturing', frequency: 'Monthly', impact: 'MEDIUM', affects: ['ES', 'YM'], unit: 'millions' },

  // Interest Rates & Fed
  DFF: { name: 'Effective Fed Funds Rate', category: 'Fed', frequency: 'Daily', impact: 'HIGH', affects: ['ES', 'NQ', 'GC', 'ZN', 'DXY'], unit: 'percent' },
  FEDFUNDS: { name: 'Federal Funds Target Rate', category: 'Fed', frequency: 'Monthly', impact: 'HIGH', affects: ['ES', 'NQ', 'GC', 'ZN'], unit: 'percent' },

  // Treasury Yields
  DGS2: { name: '2-Year Treasury Yield', category: 'Rates', frequency: 'Daily', impact: 'MEDIUM', affects: ['ZN', 'ES', 'GC'], unit: 'percent' },
  DGS10: { name: '10-Year Treasury Yield', category: 'Rates', frequency: 'Daily', impact: 'HIGH', affects: ['ZN', 'ES', 'GC', 'RTY'], unit: 'percent' },
  DGS30: { name: '30-Year Treasury Yield', category: 'Rates', frequency: 'Daily', impact: 'MEDIUM', affects: ['ZN', 'ES'], unit: 'percent' },
  T10Y2Y: { name: '10Y-2Y Yield Spread (Curve)', category: 'Rates', frequency: 'Daily', impact: 'HIGH', affects: ['ES', 'RTY', 'XLF'], unit: 'percent' },
  T10Y3M: { name: '10Y-3M Yield Spread', category: 'Rates', frequency: 'Daily', impact: 'MEDIUM', affects: ['ES', 'RTY'], unit: 'percent' },

  // Currency
  DTWEXBGS: { name: 'Trade Weighted Dollar Index', category: 'Currency', frequency: 'Daily', impact: 'MEDIUM', affects: ['DXY', 'GC', '6E'], unit: 'index' },
};

// Cache
let fredCache = {};
const FRED_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch single FRED series
 */
async function fetchFredSeries(seriesId, apiKey) {
  if (!apiKey || apiKey === 'demo') {
    return null;
  }

  const cacheKey = seriesId;
  const now = Date.now();

  // Check cache
  if (fredCache[cacheKey] && (now - fredCache[cacheKey].timestamp) < FRED_CACHE_DURATION) {
    return fredCache[cacheKey].data;
  }

  try {
    const url = `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=10`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`FRED API error for ${seriesId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const observations = data.observations || [];

    if (observations.length === 0) return null;

    // Find latest non-missing value
    const validObs = observations.filter(o => o.value !== '.');
    if (validObs.length === 0) return null;

    const latest = validObs[0];
    const previous = validObs[1] || null;
    const seriesInfo = FRED_SERIES[seriesId] || { name: seriesId };

    const result = {
      seriesId,
      ...seriesInfo,
      value: parseFloat(latest.value),
      date: latest.date,
      previousValue: previous ? parseFloat(previous.value) : null,
      previousDate: previous ? previous.date : null,
      change: previous ? parseFloat(latest.value) - parseFloat(previous.value) : null,
      changePercent: previous ? ((parseFloat(latest.value) - parseFloat(previous.value)) / Math.abs(parseFloat(previous.value)) * 100) : null,
      fetchedAt: new Date().toISOString()
    };

    // Cache
    fredCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error(`Error fetching FRED ${seriesId}:`, error.message);
    return null;
  }
}

/**
 * Fetch all key economic indicators
 */
export async function fetchFredData(apiKey) {
  const key = apiKey || process.env.FRED_API_KEY || 'demo';

  if (key === 'demo') {
    console.warn('FRED: Using demo mode (no API key)');
    return getDefaultFredData();
  }

  const results = {};
  const keyIndicators = ['DFF', 'T10Y2Y', 'UNRATE', 'CPIAUCSL', 'UMCSENT', 'DGS10', 'DGS2'];

  try {
    const promises = keyIndicators.map(id => fetchFredSeries(id, key));
    const responses = await Promise.all(promises);

    keyIndicators.forEach((id, idx) => {
      if (responses[idx]) {
        results[id] = responses[idx];
      }
    });

    return Object.keys(results).length > 0 ? results : getDefaultFredData();
  } catch (error) {
    console.error('FRED API error:', error.message);
    return getDefaultFredData();
  }
}

/**
 * Fetch comprehensive economic data (all indicators)
 */
export async function fetchComprehensiveEconomicData(apiKey) {
  const key = apiKey || process.env.FRED_API_KEY;

  if (!key || key === 'demo') {
    return { error: 'FRED API key required for comprehensive data' };
  }

  const results = {};
  const allSeries = Object.keys(FRED_SERIES);

  // Fetch in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < allSeries.length; i += batchSize) {
    const batch = allSeries.slice(i, i + batchSize);
    const promises = batch.map(id => fetchFredSeries(id, key));
    const responses = await Promise.all(promises);

    batch.forEach((id, idx) => {
      if (responses[idx]) {
        results[id] = responses[idx];
      }
    });

    // Small delay between batches
    if (i + batchSize < allSeries.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    indicators: results,
    organized: organizeByCategory(results),
    signals: analyzeEconomicSignals(results),
    summary: generateEconomicSummary(results),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Organize indicators by category
 */
function organizeByCategory(data) {
  const organized = {
    employment: {},
    inflation: {},
    growth: {},
    consumer: {},
    housing: {},
    manufacturing: {},
    fed: {},
    rates: {},
    currency: {}
  };

  Object.entries(data).forEach(([id, info]) => {
    const category = (info.category || 'other').toLowerCase();
    if (organized[category]) {
      organized[category][id] = info;
    }
  });

  return organized;
}

/**
 * Analyze economic data for trading signals
 */
export function analyzeEconomicSignals(data) {
  const signals = [];

  // Yield Curve Inversion (recession warning)
  if (data.T10Y2Y && data.T10Y2Y.value < 0) {
    signals.push({
      indicator: 'Yield Curve',
      signal: 'BEARISH',
      severity: 'HIGH',
      message: `Yield curve INVERTED at ${data.T10Y2Y.value.toFixed(2)}% - recession warning`,
      affects: ['ES', 'NQ', 'RTY']
    });
  } else if (data.T10Y2Y && data.T10Y2Y.value < 0.25) {
    signals.push({
      indicator: 'Yield Curve',
      signal: 'CAUTION',
      severity: 'MEDIUM',
      message: `Yield curve FLAT at ${data.T10Y2Y.value.toFixed(2)}%`,
      affects: ['ES', 'RTY']
    });
  }

  // Unemployment spike
  if (data.UNRATE && data.UNRATE.change > 0.3) {
    signals.push({
      indicator: 'Unemployment',
      signal: 'BEARISH',
      severity: 'HIGH',
      message: `Unemployment spiked +${data.UNRATE.change.toFixed(1)}% to ${data.UNRATE.value.toFixed(1)}%`,
      affects: ['ES', 'NQ', 'RTY']
    });
  } else if (data.UNRATE && data.UNRATE.value < 4.0) {
    signals.push({
      indicator: 'Unemployment',
      signal: 'BULLISH',
      severity: 'LOW',
      message: `Tight labor market at ${data.UNRATE.value.toFixed(1)}%`,
      affects: ['ES', 'NQ']
    });
  }

  // Strong/Weak payrolls
  if (data.PAYEMS) {
    const changeK = (data.PAYEMS.change || 0);
    if (changeK > 200) {
      signals.push({
        indicator: 'NFP',
        signal: 'BULLISH',
        severity: 'MEDIUM',
        message: `Strong payrolls +${changeK.toFixed(0)}K`,
        affects: ['ES', 'NQ']
      });
    } else if (changeK < 0) {
      signals.push({
        indicator: 'NFP',
        signal: 'BEARISH',
        severity: 'HIGH',
        message: `Negative payrolls ${changeK.toFixed(0)}K`,
        affects: ['ES', 'NQ', 'RTY']
      });
    }
  }

  // High inflation
  if (data.CPIAUCSL && data.CPIAUCSL.changePercent) {
    const yoy = data.CPIAUCSL.changePercent;
    if (yoy > 4) {
      signals.push({
        indicator: 'CPI',
        signal: 'MIXED',
        severity: 'HIGH',
        message: `Elevated inflation at ${yoy.toFixed(1)}% YoY - bearish equities, bullish gold`,
        affects: ['ES', 'NQ', 'GC', 'ZN']
      });
    } else if (yoy < 2) {
      signals.push({
        indicator: 'CPI',
        signal: 'BULLISH',
        severity: 'LOW',
        message: `Low inflation at ${yoy.toFixed(1)}% YoY - Fed may ease`,
        affects: ['ES', 'NQ', 'ZN']
      });
    }
  }

  // Initial claims spike
  if (data.ICSA && data.ICSA.change > 20000) {
    signals.push({
      indicator: 'Initial Claims',
      signal: 'BEARISH',
      severity: 'MEDIUM',
      message: `Claims spiked +${(data.ICSA.change / 1000).toFixed(0)}K to ${(data.ICSA.value / 1000).toFixed(0)}K`,
      affects: ['ES', 'NQ']
    });
  }

  // Consumer sentiment
  if (data.UMCSENT && data.UMCSENT.change) {
    if (data.UMCSENT.change < -5) {
      signals.push({
        indicator: 'Consumer Sentiment',
        signal: 'BEARISH',
        severity: 'MEDIUM',
        message: `Sentiment dropped ${data.UMCSENT.change.toFixed(1)} to ${data.UMCSENT.value.toFixed(1)}`,
        affects: ['ES', 'RTY']
      });
    } else if (data.UMCSENT.change > 5) {
      signals.push({
        indicator: 'Consumer Sentiment',
        signal: 'BULLISH',
        severity: 'MEDIUM',
        message: `Sentiment jumped +${data.UMCSENT.change.toFixed(1)} to ${data.UMCSENT.value.toFixed(1)}`,
        affects: ['ES', 'NQ']
      });
    }
  }

  // High 10Y yield
  if (data.DGS10 && data.DGS10.value > 4.5) {
    signals.push({
      indicator: '10Y Yield',
      signal: 'BEARISH',
      severity: 'MEDIUM',
      message: `10Y yield elevated at ${data.DGS10.value.toFixed(2)}% - pressure on equities`,
      affects: ['ES', 'NQ', 'RTY']
    });
  }

  return signals;
}

/**
 * Generate economic summary for AI agents
 */
export function generateEconomicSummary(data) {
  const lines = [];

  // Employment
  if (data.PAYEMS) {
    const change = data.PAYEMS.change || 0;
    lines.push(`NFP: ${(data.PAYEMS.value / 1000).toFixed(0)}K total (${change > 0 ? '+' : ''}${change.toFixed(0)}K change)`);
  }
  if (data.UNRATE) {
    lines.push(`Unemployment: ${data.UNRATE.value.toFixed(1)}%`);
  }
  if (data.ICSA) {
    lines.push(`Initial Claims: ${(data.ICSA.value / 1000).toFixed(0)}K`);
  }

  // Inflation
  if (data.CPIAUCSL) {
    lines.push(`CPI: ${data.CPIAUCSL.value?.toFixed(1) || 'N/A'} (${data.CPIAUCSL.changePercent?.toFixed(1) || 'N/A'}% YoY)`);
  }
  if (data.PCEPILFE) {
    lines.push(`Core PCE: ${data.PCEPILFE.value?.toFixed(2) || 'N/A'}%`);
  }

  // Growth
  if (data.GDP) {
    lines.push(`GDP: $${(data.GDP.value / 1000).toFixed(1)}T`);
  }
  if (data.RSXFS) {
    lines.push(`Retail Sales: ${data.RSXFS.changePercent?.toFixed(1) || 'N/A'}% MoM`);
  }

  // Rates
  if (data.DFF) {
    lines.push(`Fed Funds: ${data.DFF.value?.toFixed(2) || 'N/A'}%`);
  }
  if (data.DGS10) {
    lines.push(`10Y Yield: ${data.DGS10.value?.toFixed(2) || 'N/A'}%`);
  }
  if (data.T10Y2Y) {
    const spread = data.T10Y2Y.value;
    const status = spread < 0 ? '⚠️ INVERTED' : spread < 0.25 ? '⚠️ FLAT' : 'Normal';
    lines.push(`Yield Curve (10Y-2Y): ${spread?.toFixed(2) || 'N/A'}% ${status}`);
  }

  // Consumer
  if (data.UMCSENT) {
    lines.push(`Consumer Sentiment: ${data.UMCSENT.value?.toFixed(1) || 'N/A'}`);
  }

  return lines.join('\n');
}

/**
 * Get economic summary for AI prompt
 */
export async function getEconomicSummaryForAgent(apiKey) {
  try {
    const key = apiKey || process.env.FRED_API_KEY;
    const data = await fetchComprehensiveEconomicData(key);

    if (data.error) {
      return 'Economic data: Using cached/default values (API key needed for live data)';
    }

    let summary = '=== ECONOMIC INDICATORS (FRED) ===\n';
    summary += data.summary + '\n';

    if (data.signals && data.signals.length > 0) {
      summary += '\nECONOMIC SIGNALS:\n';
      data.signals.forEach(s => {
        summary += `- ${s.indicator}: ${s.signal} [${s.severity}] - ${s.message}\n`;
      });
    }

    return summary;
  } catch (error) {
    console.error('Error getting economic summary:', error.message);
    return 'Economic data temporarily unavailable';
  }
}

/**
 * Analyze conditions for macro analysis
 */
export function analyzeFredConditions(fredData) {
  const conditions = {
    rateEnvironment: 'neutral',
    yieldCurve: 'normal',
    laborMarket: 'stable',
    inflation: 'moderate',
    consumerHealth: 'stable'
  };

  // Fed Funds Rate
  const fedFunds = fredData['DFF'];
  if (fedFunds) {
    if (fedFunds.value > 5) conditions.rateEnvironment = 'restrictive';
    else if (fedFunds.value < 2) conditions.rateEnvironment = 'accommodative';
  }

  // Yield curve
  const yieldSpread = fredData['T10Y2Y'];
  if (yieldSpread) {
    if (yieldSpread.value < 0) conditions.yieldCurve = 'inverted';
    else if (yieldSpread.value < 0.25) conditions.yieldCurve = 'flat';
    else if (yieldSpread.value > 1) conditions.yieldCurve = 'steep';
  }

  // Unemployment
  const unemployment = fredData['UNRATE'];
  if (unemployment) {
    if (unemployment.value > 5) conditions.laborMarket = 'weak';
    else if (unemployment.value < 4) conditions.laborMarket = 'tight';
  }

  // Consumer sentiment
  const sentiment = fredData['UMCSENT'];
  if (sentiment) {
    if (sentiment.value < 60) conditions.consumerHealth = 'pessimistic';
    else if (sentiment.value > 80) conditions.consumerHealth = 'optimistic';
  }

  return conditions;
}

/**
 * Get available series list
 */
export function getAvailableSeries() {
  return Object.entries(FRED_SERIES).map(([id, info]) => ({
    seriesId: id,
    ...info
  }));
}

/**
 * Clear cache
 */
export function clearFredCache() {
  fredCache = {};
  console.log('FRED cache cleared');
}

/**
 * Default data when API unavailable
 */
function getDefaultFredData() {
  return {
    'DFF': { seriesId: 'DFF', name: 'Effective Fed Funds Rate', value: 5.33, previousValue: 5.33, change: 0, category: 'Fed' },
    'T10Y2Y': { seriesId: 'T10Y2Y', name: '10Y-2Y Yield Spread', value: -0.15, previousValue: -0.18, change: 0.03, category: 'Rates' },
    'UNRATE': { seriesId: 'UNRATE', name: 'Unemployment Rate', value: 4.1, previousValue: 4.2, change: -0.1, category: 'Employment' },
    'DGS10': { seriesId: 'DGS10', name: '10-Year Treasury Yield', value: 4.25, previousValue: 4.20, change: 0.05, category: 'Rates' },
    'UMCSENT': { seriesId: 'UMCSENT', name: 'Consumer Sentiment', value: 72.5, previousValue: 71.0, change: 1.5, category: 'Consumer' }
  };
}

export { FRED_SERIES };
