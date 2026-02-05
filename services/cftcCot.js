/**
 * CFTC COT - Commitments of Traders Report
 * FREE data from CFTC public reporting
 *
 * Data source: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
 * Released: Every Friday at 3:30 PM ET (data as of Tuesday)
 *
 * Shows positioning of:
 * - Commercials (hedgers) - Usually right at extremes
 * - Large Speculators (managed money) - Trend followers
 * - Small Speculators (retail) - Often wrong at extremes
 */

// COT data for key futures contracts
// Contract codes from CFTC
const COT_CONTRACTS = {
  ES: { code: '13874A', name: 'E-Mini S&P 500', exchange: 'CME' },
  NQ: { code: '209742', name: 'E-Mini Nasdaq 100', exchange: 'CME' },
  GC: { code: '088691', name: 'Gold', exchange: 'COMEX' },
  SI: { code: '084691', name: 'Silver', exchange: 'COMEX' },
  CL: { code: '067651', name: 'Crude Oil WTI', exchange: 'NYMEX' },
  NG: { code: '023651', name: 'Natural Gas', exchange: 'NYMEX' },
  ZC: { code: '002602', name: 'Corn', exchange: 'CBOT' },
  ZS: { code: '005602', name: 'Soybeans', exchange: 'CBOT' },
  ZW: { code: '001602', name: 'Wheat', exchange: 'CBOT' },
  '6E': { code: '099741', name: 'Euro FX', exchange: 'CME' },
  '6J': { code: '097741', name: 'Japanese Yen', exchange: 'CME' },
  '6B': { code: '096742', name: 'British Pound', exchange: 'CME' },
  LE: { code: '057642', name: 'Live Cattle', exchange: 'CME' },
  HE: { code: '054642', name: 'Lean Hogs', exchange: 'CME' },
  BTC: { code: '133741', name: 'Bitcoin', exchange: 'CME' }
};

/**
 * Since CFTC data requires downloading/parsing large CSV files,
 * we'll use mock data that represents typical COT readings.
 * In production, you would:
 * 1. Download weekly CSV from CFTC
 * 2. Parse and store in database
 * 3. Serve from cache
 */

// Mock COT data representing typical readings
const MOCK_COT_DATA = {
  ES: {
    commercials: { long: 245000, short: 380000, net: -135000 },
    largeSpecs: { long: 420000, short: 285000, net: 135000 },
    smallSpecs: { long: 85000, short: 85000, net: 0 },
    openInterest: 2450000,
    weeklyChange: { commercials: 15000, largeSpecs: -12000 }
  },
  NQ: {
    commercials: { long: 45000, short: 82000, net: -37000 },
    largeSpecs: { long: 95000, short: 58000, net: 37000 },
    smallSpecs: { long: 12000, short: 12000, net: 0 },
    openInterest: 285000,
    weeklyChange: { commercials: 5000, largeSpecs: -4500 }
  },
  GC: {
    commercials: { long: 125000, short: 285000, net: -160000 },
    largeSpecs: { long: 245000, short: 85000, net: 160000 },
    smallSpecs: { long: 45000, short: 45000, net: 0 },
    openInterest: 520000,
    weeklyChange: { commercials: -8000, largeSpecs: 10000 }
  },
  SI: {
    commercials: { long: 35000, short: 85000, net: -50000 },
    largeSpecs: { long: 72000, short: 22000, net: 50000 },
    smallSpecs: { long: 18000, short: 18000, net: 0 },
    openInterest: 145000,
    weeklyChange: { commercials: -3000, largeSpecs: 4500 }
  },
  CL: {
    commercials: { long: 385000, short: 520000, net: -135000 },
    largeSpecs: { long: 295000, short: 160000, net: 135000 },
    smallSpecs: { long: 45000, short: 45000, net: 0 },
    openInterest: 1850000,
    weeklyChange: { commercials: 22000, largeSpecs: -18000 }
  },
  NG: {
    commercials: { long: 185000, short: 245000, net: -60000 },
    largeSpecs: { long: 125000, short: 65000, net: 60000 },
    smallSpecs: { long: 25000, short: 25000, net: 0 },
    openInterest: 1250000,
    weeklyChange: { commercials: 12000, largeSpecs: -8000 }
  },
  ZC: {
    commercials: { long: 485000, short: 720000, net: -235000 },
    largeSpecs: { long: 385000, short: 150000, net: 235000 },
    smallSpecs: { long: 85000, short: 85000, net: 0 },
    openInterest: 1650000,
    weeklyChange: { commercials: -15000, largeSpecs: 18000 }
  },
  ZS: {
    commercials: { long: 245000, short: 385000, net: -140000 },
    largeSpecs: { long: 195000, short: 55000, net: 140000 },
    smallSpecs: { long: 42000, short: 42000, net: 0 },
    openInterest: 825000,
    weeklyChange: { commercials: -8000, largeSpecs: 12000 }
  },
  ZW: {
    commercials: { long: 125000, short: 185000, net: -60000 },
    largeSpecs: { long: 85000, short: 25000, net: 60000 },
    smallSpecs: { long: 22000, short: 22000, net: 0 },
    openInterest: 385000,
    weeklyChange: { commercials: 5000, largeSpecs: -3000 }
  },
  '6E': {
    commercials: { long: 145000, short: 185000, net: -40000 },
    largeSpecs: { long: 125000, short: 85000, net: 40000 },
    smallSpecs: { long: 28000, short: 28000, net: 0 },
    openInterest: 650000,
    weeklyChange: { commercials: 8000, largeSpecs: -6000 }
  },
  '6J': {
    commercials: { long: 85000, short: 125000, net: -40000 },
    largeSpecs: { long: 45000, short: 5000, net: 40000 },
    smallSpecs: { long: 12000, short: 12000, net: 0 },
    openInterest: 185000,
    weeklyChange: { commercials: -5000, largeSpecs: 8000 }
  },
  BTC: {
    commercials: { long: 2500, short: 8500, net: -6000 },
    largeSpecs: { long: 18500, short: 12500, net: 6000 },
    smallSpecs: { long: 4500, short: 4500, net: 0 },
    openInterest: 42000,
    weeklyChange: { commercials: -500, largeSpecs: 1200 }
  }
};

/**
 * Get COT data for a symbol
 */
function getCOTData(symbol) {
  const data = MOCK_COT_DATA[symbol];
  const contract = COT_CONTRACTS[symbol];

  if (!data || !contract) {
    return {
      symbol,
      error: 'COT data not available for this symbol'
    };
  }

  // Calculate percentile of net positioning (mock - would need historical data)
  const netLongPercent = (data.largeSpecs.net / data.openInterest * 100);

  // Interpretation based on positioning
  let interpretation;
  let signal;

  // Large specs very long = potential top, very short = potential bottom
  if (netLongPercent > 15) {
    interpretation = 'CROWDED_LONG — Large specs heavily long, contrarian bearish';
    signal = 'CAUTION_LONG';
  } else if (netLongPercent > 8) {
    interpretation = 'NET_LONG — Specs bullish but not extreme';
    signal = 'BULLISH';
  } else if (netLongPercent < -8) {
    interpretation = 'NET_SHORT — Specs bearish, contrarian bullish';
    signal = 'CONTRARIAN_BULLISH';
  } else if (netLongPercent < -15) {
    interpretation = 'CROWDED_SHORT — Large specs heavily short, contrarian bullish';
    signal = 'CAUTION_SHORT';
  } else {
    interpretation = 'NEUTRAL — No extreme positioning';
    signal = 'NEUTRAL';
  }

  // Weekly change interpretation
  let weeklyTrend;
  if (data.weeklyChange.largeSpecs > 0) {
    weeklyTrend = 'SPECS_ADDING_LONGS — Trend following bulls';
  } else if (data.weeklyChange.largeSpecs < 0) {
    weeklyTrend = 'SPECS_REDUCING_LONGS — Profit taking or sentiment shift';
  } else {
    weeklyTrend = 'UNCHANGED';
  }

  return {
    symbol,
    contract: contract.name,
    exchange: contract.exchange,
    asOf: getLastTuesday(),
    released: getLastFriday(),
    positioning: {
      commercials: {
        ...data.commercials,
        netFormatted: formatNet(data.commercials.net)
      },
      largeSpecs: {
        ...data.largeSpecs,
        netFormatted: formatNet(data.largeSpecs.net),
        netPercent: parseFloat(netLongPercent.toFixed(2))
      },
      smallSpecs: {
        ...data.smallSpecs,
        netFormatted: formatNet(data.smallSpecs.net)
      }
    },
    openInterest: {
      value: data.openInterest,
      formatted: formatNumber(data.openInterest)
    },
    weeklyChange: {
      commercials: data.weeklyChange.commercials,
      largeSpecs: data.weeklyChange.largeSpecs,
      commercialsFormatted: formatChange(data.weeklyChange.commercials),
      largeSpecsFormatted: formatChange(data.weeklyChange.largeSpecs)
    },
    interpretation,
    signal,
    weeklyTrend,
    isMock: true
  };
}

/**
 * Get COT data for all tracked symbols
 */
function getAllCOTData() {
  const results = {};

  Object.keys(COT_CONTRACTS).forEach(symbol => {
    results[symbol] = getCOTData(symbol);
  });

  // Summary of extreme readings
  const extremes = {
    crowdedLong: [],
    crowdedShort: [],
    neutral: []
  };

  Object.entries(results).forEach(([symbol, data]) => {
    if (data.signal === 'CAUTION_LONG' || data.signal === 'CROWDED_LONG') {
      extremes.crowdedLong.push(symbol);
    } else if (data.signal === 'CAUTION_SHORT' || data.signal === 'CONTRARIAN_BULLISH') {
      extremes.crowdedShort.push(symbol);
    } else {
      extremes.neutral.push(symbol);
    }
  });

  results._summary = {
    extremes,
    reportDate: getLastFriday(),
    dataDate: getLastTuesday()
  };

  return results;
}

/**
 * Get COT summary for AI agents
 */
function getCOTSummaryForAgent(cotData) {
  if (!cotData) return 'COT data not available';

  const lines = [];

  // Report extremes first (most actionable)
  if (cotData._summary?.extremes) {
    if (cotData._summary.extremes.crowdedLong.length > 0) {
      lines.push(`CROWDED LONG (contrarian bearish): ${cotData._summary.extremes.crowdedLong.join(', ')}`);
    }
    if (cotData._summary.extremes.crowdedShort.length > 0) {
      lines.push(`CROWDED SHORT (contrarian bullish): ${cotData._summary.extremes.crowdedShort.join(', ')}`);
    }
  }

  // Key individual readings
  ['ES', 'GC', 'CL', '6E'].forEach(symbol => {
    if (cotData[symbol]) {
      const d = cotData[symbol];
      lines.push(`${symbol}: Specs ${d.positioning?.largeSpecs?.netFormatted} (${d.signal}), Weekly: ${d.weeklyChange?.largeSpecsFormatted}`);
    }
  });

  return lines.join('\n');
}

// Helper functions
function getLastTuesday() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day >= 2) ? (day - 2) : (day + 5);
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() - diff);
  return tuesday.toISOString().split('T')[0];
}

function getLastFriday() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day >= 5) ? (day - 5) : (day + 2);
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  return friday.toISOString().split('T')[0];
}

function formatNet(value) {
  const sign = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1000000) {
    return `${sign}${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${sign}${(value / 1000).toFixed(1)}K`;
  }
  return `${sign}${value}`;
}

function formatNumber(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

function formatChange(value) {
  const sign = value >= 0 ? '+' : '';
  if (Math.abs(value) >= 1000) {
    return `${sign}${(value / 1000).toFixed(1)}K`;
  }
  return `${sign}${value}`;
}

export {
  getCOTData,
  getAllCOTData,
  getCOTSummaryForAgent,
  COT_CONTRACTS
};
