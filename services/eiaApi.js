/**
 * EIA API - U.S. Energy Information Administration
 * FREE API for oil, natural gas, and refinery data
 *
 * Register for free API key at: https://www.eia.gov/opendata/register.php
 *
 * Key Data Series:
 * - Crude Oil Inventory (Weekly)
 * - Natural Gas Storage (Weekly)
 * - Refinery Utilization (Weekly)
 * - US Crude Production (Weekly)
 */

const EIA_BASE_URL = 'https://api.eia.gov/v2';

// Data series IDs for key reports
const EIA_SERIES = {
  // Crude Oil
  CRUDE_INVENTORY: {
    route: '/petroleum/stoc/wstk/data/',
    params: {
      frequency: 'weekly',
      data: ['value'],
      facets: { product: ['EPC0'] }, // Crude oil
      sort: [{ column: 'period', direction: 'desc' }],
      length: 10
    },
    name: 'US Crude Oil Inventory',
    unit: 'thousand barrels',
    affects: ['CL', 'RB'],
    reportDay: 'Wednesday',
    reportTime: '10:30 AM ET'
  },

  // Natural Gas
  NG_STORAGE: {
    route: '/natural-gas/stor/wkly/data/',
    params: {
      frequency: 'weekly',
      data: ['value'],
      sort: [{ column: 'period', direction: 'desc' }],
      length: 10
    },
    name: 'US Natural Gas Storage',
    unit: 'billion cubic feet',
    affects: ['NG'],
    reportDay: 'Thursday',
    reportTime: '10:30 AM ET'
  },

  // Refinery Utilization
  REFINERY_UTIL: {
    route: '/petroleum/pnp/wiup/data/',
    params: {
      frequency: 'weekly',
      data: ['value'],
      facets: { process: ['YOP'] }, // Operable utilization
      sort: [{ column: 'period', direction: 'desc' }],
      length: 10
    },
    name: 'US Refinery Utilization',
    unit: 'percent',
    affects: ['CL', 'RB'],
    reportDay: 'Wednesday'
  },

  // Gasoline Inventory
  GASOLINE_INVENTORY: {
    route: '/petroleum/stoc/wstk/data/',
    params: {
      frequency: 'weekly',
      data: ['value'],
      facets: { product: ['EPM0F'] }, // Motor gasoline
      sort: [{ column: 'period', direction: 'desc' }],
      length: 10
    },
    name: 'US Gasoline Inventory',
    unit: 'thousand barrels',
    affects: ['RB'],
    reportDay: 'Wednesday'
  },

  // Distillate (Heating Oil/Diesel) Inventory
  DISTILLATE_INVENTORY: {
    route: '/petroleum/stoc/wstk/data/',
    params: {
      frequency: 'weekly',
      data: ['value'],
      facets: { product: ['EPD0'] }, // Distillate fuel oil
      sort: [{ column: 'period', direction: 'desc' }],
      length: 10
    },
    name: 'US Distillate Inventory',
    unit: 'thousand barrels',
    affects: ['CL', 'HO'],
    reportDay: 'Wednesday'
  },

  // US Crude Production
  CRUDE_PRODUCTION: {
    route: '/petroleum/crd/crpdn/data/',
    params: {
      frequency: 'weekly',
      data: ['value'],
      sort: [{ column: 'period', direction: 'desc' }],
      length: 10
    },
    name: 'US Crude Oil Production',
    unit: 'thousand barrels per day',
    affects: ['CL'],
    reportDay: 'Wednesday'
  }
};

/**
 * Fetch data from EIA API
 * @param {string} seriesKey - Key from EIA_SERIES
 * @param {string} apiKey - EIA API key
 */
async function fetchEIASeries(seriesKey, apiKey) {
  if (!apiKey) {
    console.log('EIA API key not configured - using mock data');
    return getMockData(seriesKey);
  }

  const series = EIA_SERIES[seriesKey];
  if (!series) {
    throw new Error(`Unknown EIA series: ${seriesKey}`);
  }

  try {
    const url = new URL(`${EIA_BASE_URL}${series.route}`);
    url.searchParams.append('api_key', apiKey);

    // Add query parameters
    Object.entries(series.params).forEach(([key, value]) => {
      if (typeof value === 'object') {
        url.searchParams.append(key, JSON.stringify(value));
      } else {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`EIA API error: ${response.status}`);
    }

    const data = await response.json();
    return parseEIAResponse(data, series);
  } catch (error) {
    console.error(`EIA fetch error for ${seriesKey}:`, error.message);
    return getMockData(seriesKey);
  }
}

/**
 * Parse EIA API response into usable format
 */
function parseEIAResponse(data, series) {
  const records = data?.response?.data || [];

  if (records.length === 0) {
    return {
      name: series.name,
      unit: series.unit,
      affects: series.affects,
      error: 'No data available',
      data: []
    };
  }

  // Get latest and previous values
  const latest = records[0];
  const previous = records[1];

  const latestValue = parseFloat(latest?.value) || 0;
  const previousValue = parseFloat(previous?.value) || 0;
  const change = latestValue - previousValue;
  const changePercent = previousValue ? (change / previousValue * 100) : 0;

  // For inventory, negative change = draw (bullish), positive = build (bearish)
  let interpretation;
  if (series.name.includes('Inventory') || series.name.includes('Storage')) {
    if (change < -2000) interpretation = 'LARGE_DRAW — Bullish';
    else if (change < 0) interpretation = 'DRAW — Slightly Bullish';
    else if (change > 2000) interpretation = 'LARGE_BUILD — Bearish';
    else if (change > 0) interpretation = 'BUILD — Slightly Bearish';
    else interpretation = 'FLAT';
  } else if (series.name.includes('Utilization')) {
    if (latestValue > 93) interpretation = 'HIGH — Strong demand';
    else if (latestValue > 88) interpretation = 'NORMAL';
    else if (latestValue > 80) interpretation = 'LOW — Turnaround season?';
    else interpretation = 'VERY_LOW — Demand concern';
  } else if (series.name.includes('Production')) {
    if (change > 100) interpretation = 'RISING — Supply increasing';
    else if (change < -100) interpretation = 'FALLING — Supply decreasing';
    else interpretation = 'STABLE';
  }

  return {
    name: series.name,
    unit: series.unit,
    affects: series.affects,
    reportDay: series.reportDay,
    reportTime: series.reportTime,
    latest: {
      period: latest?.period,
      value: latestValue,
      formatted: formatValue(latestValue, series.unit)
    },
    previous: {
      period: previous?.period,
      value: previousValue,
      formatted: formatValue(previousValue, series.unit)
    },
    change: {
      value: parseFloat(change.toFixed(2)),
      percent: parseFloat(changePercent.toFixed(2)),
      formatted: formatChange(change, series.unit)
    },
    interpretation,
    history: records.slice(0, 5).map(r => ({
      period: r.period,
      value: parseFloat(r.value) || 0
    }))
  };
}

function formatValue(value, unit) {
  if (unit === 'thousand barrels') {
    return `${(value / 1000).toFixed(1)}M bbl`;
  }
  if (unit === 'billion cubic feet') {
    return `${value.toFixed(0)} Bcf`;
  }
  if (unit === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  if (unit === 'thousand barrels per day') {
    return `${(value / 1000).toFixed(2)}M bpd`;
  }
  return value.toFixed(2);
}

function formatChange(change, unit) {
  const sign = change >= 0 ? '+' : '';
  if (unit === 'thousand barrels') {
    return `${sign}${(change / 1000).toFixed(2)}M bbl`;
  }
  if (unit === 'billion cubic feet') {
    return `${sign}${change.toFixed(0)} Bcf`;
  }
  if (unit === 'percent') {
    return `${sign}${change.toFixed(1)}%`;
  }
  if (unit === 'thousand barrels per day') {
    return `${sign}${change.toFixed(0)}K bpd`;
  }
  return `${sign}${change.toFixed(2)}`;
}

/**
 * Get mock data when API key not available
 */
function getMockData(seriesKey) {
  const mockData = {
    CRUDE_INVENTORY: {
      latest: { period: '2026-02-01', value: 423500, formatted: '423.5M bbl' },
      previous: { period: '2026-01-25', value: 426800, formatted: '426.8M bbl' },
      change: { value: -3300, percent: -0.77, formatted: '-3.30M bbl' },
      interpretation: 'DRAW — Slightly Bullish'
    },
    NG_STORAGE: {
      latest: { period: '2026-01-31', value: 2450, formatted: '2450 Bcf' },
      previous: { period: '2026-01-24', value: 2520, formatted: '2520 Bcf' },
      change: { value: -70, percent: -2.78, formatted: '-70 Bcf' },
      interpretation: 'DRAW — Slightly Bullish'
    },
    REFINERY_UTIL: {
      latest: { period: '2026-02-01', value: 87.5, formatted: '87.5%' },
      previous: { period: '2026-01-25', value: 88.2, formatted: '88.2%' },
      change: { value: -0.7, percent: -0.79, formatted: '-0.7%' },
      interpretation: 'LOW — Turnaround season?'
    },
    GASOLINE_INVENTORY: {
      latest: { period: '2026-02-01', value: 248000, formatted: '248.0M bbl' },
      previous: { period: '2026-01-25', value: 245500, formatted: '245.5M bbl' },
      change: { value: 2500, percent: 1.02, formatted: '+2.50M bbl' },
      interpretation: 'BUILD — Slightly Bearish'
    },
    DISTILLATE_INVENTORY: {
      latest: { period: '2026-02-01', value: 118500, formatted: '118.5M bbl' },
      previous: { period: '2026-01-25', value: 120200, formatted: '120.2M bbl' },
      change: { value: -1700, percent: -1.41, formatted: '-1.70M bbl' },
      interpretation: 'DRAW — Slightly Bullish'
    },
    CRUDE_PRODUCTION: {
      latest: { period: '2026-02-01', value: 13200, formatted: '13.20M bpd' },
      previous: { period: '2026-01-25', value: 13150, formatted: '13.15M bpd' },
      change: { value: 50, percent: 0.38, formatted: '+50K bpd' },
      interpretation: 'STABLE'
    }
  };

  const series = EIA_SERIES[seriesKey];
  const mock = mockData[seriesKey] || mockData.CRUDE_INVENTORY;

  return {
    name: series?.name || 'Unknown',
    unit: series?.unit || '',
    affects: series?.affects || [],
    reportDay: series?.reportDay,
    reportTime: series?.reportTime,
    ...mock,
    history: [],
    isMock: true
  };
}

/**
 * Fetch all energy data for dashboard
 */
async function fetchAllEnergyData(apiKey) {
  const results = {};

  const fetchPromises = Object.keys(EIA_SERIES).map(async (key) => {
    const data = await fetchEIASeries(key, apiKey);
    return { key, data };
  });

  const responses = await Promise.allSettled(fetchPromises);

  responses.forEach((res) => {
    if (res.status === 'fulfilled') {
      results[res.value.key] = res.value.data;
    }
  });

  // Calculate overall energy sentiment
  let bullishSignals = 0;
  let bearishSignals = 0;

  Object.values(results).forEach(data => {
    if (data.interpretation?.includes('Bullish')) bullishSignals++;
    if (data.interpretation?.includes('Bearish')) bearishSignals++;
  });

  results.sentiment = {
    bullish: bullishSignals,
    bearish: bearishSignals,
    overall: bullishSignals > bearishSignals ? 'BULLISH' :
             bearishSignals > bullishSignals ? 'BEARISH' : 'NEUTRAL'
  };

  return results;
}

/**
 * Get EIA report summary for AI agents
 */
function getEIASummaryForAgent(eiaData) {
  if (!eiaData) return 'EIA data not available';

  const lines = [];

  if (eiaData.CRUDE_INVENTORY) {
    lines.push(`Crude Inventory: ${eiaData.CRUDE_INVENTORY.change?.formatted} (${eiaData.CRUDE_INVENTORY.interpretation})`);
  }

  if (eiaData.NG_STORAGE) {
    lines.push(`NG Storage: ${eiaData.NG_STORAGE.change?.formatted} (${eiaData.NG_STORAGE.interpretation})`);
  }

  if (eiaData.REFINERY_UTIL) {
    lines.push(`Refinery Util: ${eiaData.REFINERY_UTIL.latest?.formatted} (${eiaData.REFINERY_UTIL.interpretation})`);
  }

  if (eiaData.GASOLINE_INVENTORY) {
    lines.push(`Gasoline: ${eiaData.GASOLINE_INVENTORY.change?.formatted} (${eiaData.GASOLINE_INVENTORY.interpretation})`);
  }

  if (eiaData.sentiment) {
    lines.push(`Overall Energy Sentiment: ${eiaData.sentiment.overall}`);
  }

  return lines.join('\n');
}

export {
  fetchEIASeries,
  fetchAllEnergyData,
  getEIASummaryForAgent,
  EIA_SERIES
};
