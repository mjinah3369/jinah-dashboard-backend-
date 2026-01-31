// Weather Service for Agricultural Futures Analysis
// Data sources:
// - US Drought Monitor API: https://usdmdataservices.unl.edu/api/
// - NOAA CPC 6-10 Day Outlook: https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/

// ============================================================================
// DROUGHT MONITOR API
// ============================================================================

const DROUGHT_API_BASE = 'https://usdmdataservices.unl.edu/api';

// Key agricultural states for corn belt monitoring
const AG_STATES = ['IA', 'IL', 'IN', 'OH', 'NE', 'MN', 'SD', 'ND', 'KS', 'MO'];

// Drought severity levels
const DROUGHT_LEVELS = {
  None: { label: 'No Drought', color: '#FFFFFF', impact: 'neutral' },
  D0: { label: 'Abnormally Dry', color: '#FFFF00', impact: 'low' },
  D1: { label: 'Moderate Drought', color: '#FCD37F', impact: 'moderate' },
  D2: { label: 'Severe Drought', color: '#FFAA00', impact: 'high' },
  D3: { label: 'Extreme Drought', color: '#E60000', impact: 'severe' },
  D4: { label: 'Exceptional Drought', color: '#730000', impact: 'critical' }
};

/**
 * Fetch current US drought statistics
 */
export async function fetchDroughtMonitor() {
  try {
    // Get the most recent drought data for the continental US
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 14); // Last 2 weeks

    const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

    const url = `${DROUGHT_API_BASE}/USStatistics/GetDroughtSeverityStatisticsByArea?aoi=us&startdate=${formatDate(startDate)}&enddate=${formatDate(today)}&statisticsType=1`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Drought Monitor API error:', response.status);
      return getDefaultDroughtData();
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return getDefaultDroughtData();
    }

    // Get the most recent week's data (first item is most recent)
    const latest = data[0];

    // Data is in square miles - convert to percentages
    // Total CONUS area is approximately 3,119,884 sq miles
    const totalArea = parseFloat(latest.none) + parseFloat(latest.d0) + parseFloat(latest.d1) +
                      parseFloat(latest.d2) + parseFloat(latest.d3) + parseFloat(latest.d4);

    const toPercent = (val) => totalArea > 0 ? ((parseFloat(val) || 0) / totalArea * 100) : 0;

    const d0Pct = toPercent(latest.d0);
    const d1Pct = toPercent(latest.d1);
    const d2Pct = toPercent(latest.d2);
    const d3Pct = toPercent(latest.d3);
    const d4Pct = toPercent(latest.d4);

    const totalDrought = d0Pct + d1Pct + d2Pct + d3Pct + d4Pct;
    const severeDrought = d2Pct + d3Pct + d4Pct;

    return {
      date: latest.mapDate ? latest.mapDate.split('T')[0] : today.toISOString().split('T')[0],
      statistics: {
        none: toPercent(latest.none),
        d0: d0Pct,
        d1: d1Pct,
        d2: d2Pct,
        d3: d3Pct,
        d4: d4Pct
      },
      totalDrought: totalDrought,
      severeDrought: severeDrought,
      levels: DROUGHT_LEVELS,
      source: 'US Drought Monitor',
      lastUpdate: new Date().toISOString()
    };

  } catch (error) {
    console.error('Drought Monitor fetch error:', error.message);
    return getDefaultDroughtData();
  }
}

/**
 * Fetch drought data for key agricultural states
 */
export async function fetchStateDroughtData() {
  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7);

    const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

    const stateData = {};

    // Fetch data for key corn belt states
    for (const state of AG_STATES.slice(0, 5)) { // Limit to avoid rate limiting
      try {
        const url = `${DROUGHT_API_BASE}/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=${state}&startdate=${formatDate(startDate)}&enddate=${formatDate(today)}&statisticsType=1`;

        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const latest = data[data.length - 1];
            stateData[state] = {
              state: state,
              totalDrought: (parseFloat(latest.D0) || 0) + (parseFloat(latest.D1) || 0) +
                           (parseFloat(latest.D2) || 0) + (parseFloat(latest.D3) || 0) +
                           (parseFloat(latest.D4) || 0),
              severeDrought: (parseFloat(latest.D2) || 0) + (parseFloat(latest.D3) || 0) + (parseFloat(latest.D4) || 0)
            };
          }
        }

        // Small delay to be nice to the API
        await new Promise(r => setTimeout(r, 200));

      } catch (err) {
        console.warn(`State drought data error for ${state}:`, err.message);
      }
    }

    return stateData;

  } catch (error) {
    console.error('State drought fetch error:', error.message);
    return {};
  }
}

// ============================================================================
// NOAA CPC TEMPERATURE & PRECIPITATION OUTLOOKS
// ============================================================================

const CPC_OUTLOOK_BASE = 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks';

/**
 * Fetch 6-10 day temperature outlook
 */
export async function fetch610DayOutlook() {
  try {
    // Temperature outlook layer
    const tempUrl = `${CPC_OUTLOOK_BASE}/cpc_6_10_day_outlk/MapServer/0/query?where=1%3D1&outFields=*&f=json`;

    const tempResponse = await fetch(tempUrl);

    if (!tempResponse.ok) {
      console.warn('CPC Temperature Outlook API error:', tempResponse.status);
      return getDefaultOutlookData();
    }

    const tempData = await tempResponse.json();

    // Precipitation outlook layer
    const precipUrl = `${CPC_OUTLOOK_BASE}/cpc_6_10_day_outlk/MapServer/1/query?where=1%3D1&outFields=*&f=json`;

    const precipResponse = await fetch(precipUrl);
    const precipData = precipResponse.ok ? await precipResponse.json() : { features: [] };

    // Parse the outlook data
    const temperatureOutlook = parseOutlookFeatures(tempData.features || [], 'temperature');
    const precipitationOutlook = parseOutlookFeatures(precipData.features || [], 'precipitation');

    return {
      period: '6-10 Day',
      validFrom: getOutlookValidDate(6),
      validTo: getOutlookValidDate(10),
      temperature: temperatureOutlook,
      precipitation: precipitationOutlook,
      source: 'NOAA Climate Prediction Center',
      lastUpdate: new Date().toISOString()
    };

  } catch (error) {
    console.error('CPC Outlook fetch error:', error.message);
    return getDefaultOutlookData();
  }
}

/**
 * Parse outlook features from NOAA MapServer
 */
function parseOutlookFeatures(features, type) {
  const summary = {
    aboveNormal: [],
    belowNormal: [],
    nearNormal: []
  };

  for (const feature of features) {
    const attrs = feature.attributes || {};
    const cat = (attrs.cat || attrs.Cat || '').toLowerCase();
    const prob = attrs.prob || attrs.Prob || 0;

    if (cat.includes('above') || cat.includes('a')) {
      summary.aboveNormal.push({ probability: prob, category: cat });
    } else if (cat.includes('below') || cat.includes('b')) {
      summary.belowNormal.push({ probability: prob, category: cat });
    } else {
      summary.nearNormal.push({ probability: prob, category: cat });
    }
  }

  // Determine dominant outlook
  let dominant = 'Near Normal';
  if (summary.aboveNormal.length > summary.belowNormal.length) {
    dominant = type === 'temperature' ? 'Above Normal Temps' : 'Above Normal Precip';
  } else if (summary.belowNormal.length > summary.aboveNormal.length) {
    dominant = type === 'temperature' ? 'Below Normal Temps' : 'Below Normal Precip';
  }

  return {
    dominant,
    aboveNormalAreas: summary.aboveNormal.length,
    belowNormalAreas: summary.belowNormal.length,
    nearNormalAreas: summary.nearNormal.length
  };
}

/**
 * Get valid date for outlook period
 */
function getOutlookValidDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

// ============================================================================
// DEGREE DAYS (for Natural Gas)
// ============================================================================

/**
 * Calculate Heating Degree Days (HDD) and Cooling Degree Days (CDD)
 * HDD = max(0, 65 - avgTemp) - used for natural gas heating demand
 * CDD = max(0, avgTemp - 65) - used for cooling/electricity demand
 */
export function calculateDegreeDays() {
  // This would normally come from weather data
  // For now, provide seasonal estimates based on time of year
  const now = new Date();
  const month = now.getMonth() + 1;

  let hddEstimate, cddEstimate, season;

  if (month >= 11 || month <= 2) {
    // Winter - high heating demand
    season = 'Winter';
    hddEstimate = { weekly: 180, vsNormal: '+5%', impact: 'Bullish NG' };
    cddEstimate = { weekly: 0, vsNormal: 'N/A', impact: 'Neutral' };
  } else if (month >= 6 && month <= 8) {
    // Summer - high cooling demand
    season = 'Summer';
    hddEstimate = { weekly: 0, vsNormal: 'N/A', impact: 'Neutral' };
    cddEstimate = { weekly: 85, vsNormal: '+10%', impact: 'Bullish NG (power gen)' };
  } else if (month >= 3 && month <= 5) {
    // Spring - injection season for NG
    season = 'Spring (Injection)';
    hddEstimate = { weekly: 45, vsNormal: '-2%', impact: 'Neutral to Bearish NG' };
    cddEstimate = { weekly: 10, vsNormal: 'Normal', impact: 'Neutral' };
  } else {
    // Fall - early heating season
    season = 'Fall';
    hddEstimate = { weekly: 80, vsNormal: '+3%', impact: 'Bullish NG' };
    cddEstimate = { weekly: 5, vsNormal: 'Normal', impact: 'Neutral' };
  }

  return {
    season,
    heatingDegreeDays: hddEstimate,
    coolingDegreeDays: cddEstimate,
    ngStorageSeason: month >= 4 && month <= 10 ? 'Injection' : 'Withdrawal',
    source: 'Seasonal Estimate',
    lastUpdate: new Date().toISOString()
  };
}

// ============================================================================
// AGRICULTURAL IMPACT ANALYSIS
// ============================================================================

/**
 * Analyze weather impact on agricultural futures
 */
export function analyzeAgImpact(droughtData, outlookData) {
  const impacts = {
    corn: { symbol: 'ZC', bias: 'neutral', factors: [] },
    soybeans: { symbol: 'ZS', bias: 'neutral', factors: [] },
    wheat: { symbol: 'ZW', bias: 'neutral', factors: [] },
    cattle: { symbol: 'LE', bias: 'neutral', factors: [] },
    hogs: { symbol: 'HE', bias: 'neutral', factors: [] }
  };

  // Drought impact analysis
  if (droughtData && droughtData.severeDrought > 20) {
    impacts.corn.bias = 'bullish';
    impacts.corn.factors.push(`${droughtData.severeDrought.toFixed(1)}% of US in severe drought - supply concerns`);

    impacts.soybeans.bias = 'bullish';
    impacts.soybeans.factors.push('Drought stress during critical growing period');

    impacts.wheat.bias = 'bullish';
    impacts.wheat.factors.push('Winter wheat crop stress from dry conditions');

    // Drought is bearish for cattle - poor pasture conditions, higher feed costs
    impacts.cattle.bias = 'bearish';
    impacts.cattle.factors.push('Drought stressing pastures - higher feed costs');
    impacts.cattle.factors.push('Potential herd liquidation if drought persists');

    impacts.hogs.factors.push('Higher feed costs due to grain prices');
  } else if (droughtData && droughtData.severeDrought > 10) {
    impacts.corn.factors.push(`Moderate drought coverage (${droughtData.severeDrought.toFixed(1)}%) - monitoring`);
    impacts.soybeans.factors.push('Some drought stress in growing regions');
    impacts.cattle.factors.push('Pasture conditions slightly stressed');
  } else if (droughtData) {
    impacts.corn.factors.push('Favorable moisture conditions');
    impacts.soybeans.factors.push('Adequate precipitation for crop development');
    impacts.cattle.factors.push('Good pasture conditions - normal grazing');
    impacts.hogs.factors.push('Stable feed costs expected');
  }

  // Temperature outlook impact
  if (outlookData && outlookData.temperature) {
    const temp = outlookData.temperature;
    if (temp.dominant.includes('Above')) {
      impacts.corn.factors.push('Above normal temps forecast - accelerated development');
      impacts.soybeans.factors.push('Heat stress possible during pod fill');

      // Heat stress is bearish for cattle
      impacts.cattle.bias = impacts.cattle.bias === 'neutral' ? 'slightly bearish' : impacts.cattle.bias;
      impacts.cattle.factors.push('Heat stress reduces cattle weight gain');

      impacts.hogs.factors.push('Heat stress may slow hog weight gain');
    } else if (temp.dominant.includes('Below')) {
      impacts.corn.factors.push('Below normal temps - slower maturity');
      impacts.wheat.factors.push('Cool temps favorable for winter wheat');

      // Cold increases feed requirements
      impacts.cattle.factors.push('Cold temps increase feed requirements');
      impacts.hogs.factors.push('Higher energy needs in cold weather');
    }
  }

  // Precipitation outlook impact
  if (outlookData && outlookData.precipitation) {
    const precip = outlookData.precipitation;
    if (precip.dominant.includes('Below')) {
      impacts.corn.bias = impacts.corn.bias === 'neutral' ? 'slightly bullish' : impacts.corn.bias;
      impacts.corn.factors.push('Below normal precip forecast - drought expansion risk');
      impacts.cattle.factors.push('Dry conditions may stress pastures further');
    } else if (precip.dominant.includes('Above')) {
      impacts.corn.factors.push('Above normal precip - relief for dry areas');
      impacts.wheat.factors.push('Wet conditions may delay harvest');
      impacts.cattle.factors.push('Good moisture supports pasture recovery');
      impacts.hogs.factors.push('Wet feedlot conditions may slow operations');
    }
  }

  return impacts;
}

// ============================================================================
// COMBINED WEATHER DATA
// ============================================================================

/**
 * Fetch all weather data and build comprehensive report
 */
export async function buildWeatherReport() {
  try {
    // Fetch all data in parallel
    const [droughtData, outlookData, degreeDays] = await Promise.all([
      fetchDroughtMonitor(),
      fetch610DayOutlook(),
      Promise.resolve(calculateDegreeDays())
    ]);

    // Analyze agricultural impact
    const agImpact = analyzeAgImpact(droughtData, outlookData);

    return {
      drought: droughtData,
      outlook: outlookData,
      degreeDays,
      agImpact,
      summary: buildWeatherSummary(droughtData, outlookData, degreeDays),
      lastUpdate: new Date().toISOString()
    };

  } catch (error) {
    console.error('Weather report build error:', error.message);
    return {
      drought: getDefaultDroughtData(),
      outlook: getDefaultOutlookData(),
      degreeDays: calculateDegreeDays(),
      agImpact: {},
      summary: 'Weather data temporarily unavailable',
      lastUpdate: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Build human-readable weather summary
 */
function buildWeatherSummary(drought, outlook, degreeDays) {
  const parts = [];

  if (drought && drought.severeDrought > 0) {
    parts.push(`${drought.severeDrought.toFixed(1)}% of US in severe drought (D2+)`);
  }

  if (outlook && outlook.temperature) {
    parts.push(`6-10 day temp outlook: ${outlook.temperature.dominant}`);
  }

  if (degreeDays) {
    parts.push(`Season: ${degreeDays.season} (${degreeDays.ngStorageSeason} for NG)`);
  }

  return parts.join('. ') || 'Weather conditions normal';
}

// ============================================================================
// DEFAULT DATA
// ============================================================================

function getDefaultDroughtData() {
  return {
    date: new Date().toISOString().split('T')[0],
    statistics: { none: 60, d0: 20, d1: 10, d2: 5, d3: 3, d4: 2 },
    totalDrought: 40,
    severeDrought: 10,
    levels: DROUGHT_LEVELS,
    source: 'Default (API unavailable)',
    lastUpdate: new Date().toISOString()
  };
}

function getDefaultOutlookData() {
  return {
    period: '6-10 Day',
    validFrom: getOutlookValidDate(6),
    validTo: getOutlookValidDate(10),
    temperature: { dominant: 'Near Normal', aboveNormalAreas: 0, belowNormalAreas: 0, nearNormalAreas: 1 },
    precipitation: { dominant: 'Near Normal', aboveNormalAreas: 0, belowNormalAreas: 0, nearNormalAreas: 1 },
    source: 'Default (API unavailable)',
    lastUpdate: new Date().toISOString()
  };
}

// Default export
export default {
  fetchDroughtMonitor,
  fetchStateDroughtData,
  fetch610DayOutlook,
  calculateDegreeDays,
  analyzeAgImpact,
  buildWeatherReport
};
