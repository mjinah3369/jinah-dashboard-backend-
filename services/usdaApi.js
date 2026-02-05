/**
 * USDA API - U.S. Department of Agriculture
 * FREE API for crop reports, livestock, and agricultural data
 *
 * Register for free API key at: https://quickstats.nass.usda.gov/api
 *
 * Key Reports:
 * - WASDE (World Agricultural Supply/Demand Estimates) - Monthly
 * - Crop Progress - Weekly (Apr-Nov)
 * - Cattle on Feed - Monthly (3rd Friday)
 * - Hogs & Pigs - Quarterly
 * - Export Sales - Weekly
 */

const USDA_BASE_URL = 'https://quickstats.nass.usda.gov/api';

// Key agricultural commodities we track
const USDA_COMMODITIES = {
  CORN: {
    commodity: 'CORN',
    symbol: 'ZC',
    name: 'Corn',
    unit: 'bushels'
  },
  SOYBEANS: {
    commodity: 'SOYBEANS',
    symbol: 'ZS',
    name: 'Soybeans',
    unit: 'bushels'
  },
  WHEAT: {
    commodity: 'WHEAT',
    symbol: 'ZW',
    name: 'Wheat',
    unit: 'bushels'
  },
  CATTLE: {
    commodity: 'CATTLE',
    symbol: 'LE',
    name: 'Live Cattle',
    unit: 'head'
  },
  HOGS: {
    commodity: 'HOGS',
    symbol: 'HE',
    name: 'Lean Hogs',
    unit: 'head'
  }
};

/**
 * Fetch crop progress data (weekly during growing season)
 * Shows Good/Excellent ratings
 */
async function fetchCropProgress(commodity, apiKey) {
  if (!apiKey) {
    console.log('USDA API key not configured - using mock data');
    return getMockCropProgress(commodity);
  }

  try {
    const year = new Date().getFullYear();
    const url = new URL(`${USDA_BASE_URL}/api_GET/`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('commodity_desc', commodity);
    url.searchParams.append('statisticcat_desc', 'CONDITION');
    url.searchParams.append('unit_desc', 'PCT GOOD');
    url.searchParams.append('year', year);
    url.searchParams.append('format', 'JSON');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();
    return parseCropProgressResponse(data, commodity);
  } catch (error) {
    console.error(`USDA crop progress error:`, error.message);
    return getMockCropProgress(commodity);
  }
}

function parseCropProgressResponse(data, commodity) {
  const records = data?.data || [];
  const config = USDA_COMMODITIES[commodity] || { symbol: commodity, name: commodity };

  if (records.length === 0) {
    return {
      commodity: config.name,
      symbol: config.symbol,
      error: 'No data available',
      condition: null
    };
  }

  // Get latest condition
  const latest = records[0];
  const goodPct = parseFloat(latest?.Value) || 0;

  // Interpretation based on condition
  let interpretation;
  if (goodPct >= 70) interpretation = 'EXCELLENT — Above average crop';
  else if (goodPct >= 60) interpretation = 'GOOD — Normal conditions';
  else if (goodPct >= 50) interpretation = 'FAIR — Below average';
  else if (goodPct >= 40) interpretation = 'POOR — Crop stress';
  else interpretation = 'VERY_POOR — Major crop concern';

  return {
    commodity: config.name,
    symbol: config.symbol,
    condition: {
      good: goodPct,
      week: latest?.week_ending || 'Unknown',
      state: latest?.state_name || 'US Total'
    },
    interpretation,
    priceImpact: goodPct < 50 ? 'BULLISH — Supply concern' :
                 goodPct > 70 ? 'BEARISH — Strong supply' : 'NEUTRAL'
  };
}

/**
 * Fetch cattle on feed data (monthly)
 */
async function fetchCattleOnFeed(apiKey) {
  if (!apiKey) {
    console.log('USDA API key not configured - using mock data');
    return getMockCattleOnFeed();
  }

  try {
    const year = new Date().getFullYear();
    const url = new URL(`${USDA_BASE_URL}/api_GET/`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('commodity_desc', 'CATTLE');
    url.searchParams.append('statisticcat_desc', 'ON FEED');
    url.searchParams.append('year', year);
    url.searchParams.append('format', 'JSON');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();
    return parseCattleOnFeedResponse(data);
  } catch (error) {
    console.error(`USDA cattle on feed error:`, error.message);
    return getMockCattleOnFeed();
  }
}

function parseCattleOnFeedResponse(data) {
  const records = data?.data || [];

  if (records.length === 0) {
    return {
      commodity: 'Cattle',
      symbol: 'LE',
      error: 'No data available'
    };
  }

  const latest = records[0];
  const onFeed = parseFloat(latest?.Value) || 0;

  // Cattle cycle interpretation
  // Currently in multi-year contraction (smallest herd since 1960s)
  let interpretation;
  if (onFeed < 11000) interpretation = 'TIGHT_SUPPLY — Bullish cattle prices';
  else if (onFeed < 12000) interpretation = 'BELOW_AVERAGE — Supportive prices';
  else if (onFeed > 12500) interpretation = 'ABOVE_AVERAGE — Price pressure';
  else interpretation = 'NORMAL';

  return {
    commodity: 'Cattle',
    symbol: 'LE',
    onFeed: {
      value: onFeed,
      formatted: `${(onFeed / 1000).toFixed(2)}M head`,
      period: latest?.reference_period_desc || 'Unknown'
    },
    interpretation,
    priceImpact: onFeed < 11500 ? 'BULLISH' : onFeed > 12500 ? 'BEARISH' : 'NEUTRAL'
  };
}

/**
 * Fetch hogs and pigs data (quarterly)
 */
async function fetchHogsAndPigs(apiKey) {
  if (!apiKey) {
    console.log('USDA API key not configured - using mock data');
    return getMockHogsAndPigs();
  }

  try {
    const year = new Date().getFullYear();
    const url = new URL(`${USDA_BASE_URL}/api_GET/`);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('commodity_desc', 'HOGS');
    url.searchParams.append('statisticcat_desc', 'INVENTORY');
    url.searchParams.append('year', year);
    url.searchParams.append('format', 'JSON');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();
    return parseHogsAndPigsResponse(data);
  } catch (error) {
    console.error(`USDA hogs and pigs error:`, error.message);
    return getMockHogsAndPigs();
  }
}

function parseHogsAndPigsResponse(data) {
  const records = data?.data || [];

  if (records.length === 0) {
    return {
      commodity: 'Hogs',
      symbol: 'HE',
      error: 'No data available'
    };
  }

  const latest = records[0];
  const inventory = parseFloat(latest?.Value) || 0;

  let interpretation;
  if (inventory < 72000) interpretation = 'TIGHT_SUPPLY — Bullish hog prices';
  else if (inventory < 74000) interpretation = 'BELOW_AVERAGE';
  else if (inventory > 76000) interpretation = 'ABOVE_AVERAGE — Price pressure';
  else interpretation = 'NORMAL';

  return {
    commodity: 'Hogs',
    symbol: 'HE',
    inventory: {
      value: inventory,
      formatted: `${(inventory / 1000).toFixed(1)}M head`,
      period: latest?.reference_period_desc || 'Unknown'
    },
    interpretation,
    priceImpact: inventory < 73000 ? 'BULLISH' : inventory > 76000 ? 'BEARISH' : 'NEUTRAL'
  };
}

// Mock data functions
function getMockCropProgress(commodity) {
  const mockData = {
    CORN: { good: 62, week: '2026-W05', interpretation: 'GOOD — Normal conditions' },
    SOYBEANS: { good: 58, week: '2026-W05', interpretation: 'FAIR — Below average' },
    WHEAT: { good: 45, week: '2026-W05', interpretation: 'POOR — Crop stress' }
  };

  const config = USDA_COMMODITIES[commodity] || { symbol: commodity, name: commodity };
  const mock = mockData[commodity] || mockData.CORN;

  return {
    commodity: config.name,
    symbol: config.symbol,
    condition: {
      good: mock.good,
      week: mock.week,
      state: 'US Total'
    },
    interpretation: mock.interpretation,
    priceImpact: mock.good < 50 ? 'BULLISH — Supply concern' :
                 mock.good > 70 ? 'BEARISH — Strong supply' : 'NEUTRAL',
    isMock: true
  };
}

function getMockCattleOnFeed() {
  return {
    commodity: 'Cattle',
    symbol: 'LE',
    onFeed: {
      value: 11250,
      formatted: '11.25M head',
      period: 'January 2026'
    },
    interpretation: 'TIGHT_SUPPLY — Bullish cattle prices',
    priceImpact: 'BULLISH',
    isMock: true
  };
}

function getMockHogsAndPigs() {
  return {
    commodity: 'Hogs',
    symbol: 'HE',
    inventory: {
      value: 74500,
      formatted: '74.5M head',
      period: 'December 2025'
    },
    interpretation: 'NORMAL',
    priceImpact: 'NEUTRAL',
    isMock: true
  };
}

/**
 * Fetch all agriculture data for dashboard
 */
async function fetchAllAgricultureData(apiKey) {
  const [corn, soybeans, wheat, cattle, hogs] = await Promise.all([
    fetchCropProgress('CORN', apiKey),
    fetchCropProgress('SOYBEANS', apiKey),
    fetchCropProgress('WHEAT', apiKey),
    fetchCattleOnFeed(apiKey),
    fetchHogsAndPigs(apiKey)
  ]);

  // Calculate overall ag sentiment
  let bullish = 0;
  let bearish = 0;

  [corn, soybeans, wheat, cattle, hogs].forEach(data => {
    if (data.priceImpact?.includes('BULLISH')) bullish++;
    if (data.priceImpact?.includes('BEARISH')) bearish++;
  });

  return {
    crops: { corn, soybeans, wheat },
    livestock: { cattle, hogs },
    sentiment: {
      bullish,
      bearish,
      overall: bullish > bearish ? 'BULLISH' :
               bearish > bullish ? 'BEARISH' : 'NEUTRAL'
    }
  };
}

/**
 * Get USDA summary for AI agents
 */
function getUSDASSummaryForAgent(usdaData) {
  if (!usdaData) return 'USDA data not available';

  const lines = [];

  // Crops
  if (usdaData.crops) {
    if (usdaData.crops.corn?.condition) {
      lines.push(`Corn Condition: ${usdaData.crops.corn.condition.good}% Good (${usdaData.crops.corn.interpretation})`);
    }
    if (usdaData.crops.soybeans?.condition) {
      lines.push(`Soybeans Condition: ${usdaData.crops.soybeans.condition.good}% Good (${usdaData.crops.soybeans.interpretation})`);
    }
    if (usdaData.crops.wheat?.condition) {
      lines.push(`Wheat Condition: ${usdaData.crops.wheat.condition.good}% Good (${usdaData.crops.wheat.interpretation})`);
    }
  }

  // Livestock
  if (usdaData.livestock) {
    if (usdaData.livestock.cattle?.onFeed) {
      lines.push(`Cattle on Feed: ${usdaData.livestock.cattle.onFeed.formatted} (${usdaData.livestock.cattle.interpretation})`);
    }
    if (usdaData.livestock.hogs?.inventory) {
      lines.push(`Hog Inventory: ${usdaData.livestock.hogs.inventory.formatted} (${usdaData.livestock.hogs.interpretation})`);
    }
  }

  if (usdaData.sentiment) {
    lines.push(`Overall Ag Sentiment: ${usdaData.sentiment.overall}`);
  }

  return lines.join('\n');
}

export {
  fetchCropProgress,
  fetchCattleOnFeed,
  fetchHogsAndPigs,
  fetchAllAgricultureData,
  getUSDASSummaryForAgent,
  USDA_COMMODITIES
};
