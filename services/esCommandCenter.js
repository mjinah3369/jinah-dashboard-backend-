/**
 * ES Command Center — Real-time driver detection for ES futures
 * Institutional-grade: Shows what's moving ES RIGHT NOW
 *
 * Features:
 * - Correlation drivers (VIX, 10Y, DXY, HYG, NQ/RTY divergence)
 * - International indices by session
 * - Sector and Mag7 impact
 * - Institutional context (VIX structure, Fed probs, credit, COT, gap, OPEX)
 * - Catalyst calendar
 * - Net bias scoring with full breakdown
 */

import { getCurrentSession, getNextSession } from './sessionEngine.js';
import { analyzeAllSourcesNews } from './newsAnalysis.js';
import { getAllCOTData } from './cftcCot.js';
import { getPutCallRatio } from './cboePutCall.js';
import {
  fetchEnergyReports,
  fetchCentralBankCalendar
} from './fundamentalReports.js';

// ============================================================================
// CACHING - 30 second TTL for fast subsequent requests
// ============================================================================
let esCommandCenterCache = null;
let esCacheTimestamp = 0;
const ES_CACHE_TTL = 30 * 1000; // 30 seconds

function isCacheValid() {
  return esCommandCenterCache && (Date.now() - esCacheTimestamp < ES_CACHE_TTL);
}

// Yahoo Finance fetch helper
async function fetchYahooQuote(symbol) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    );
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const price = meta.regularMarketPrice;
    const change = price - prevClose;
    const changePercent = (change / prevClose) * 100;

    return {
      symbol,
      price,
      previousClose: prevClose,
      change,
      changePercent,
      dayHigh: meta.regularMarketDayHigh || quotes?.high?.[quotes.high.length - 1],
      dayLow: meta.regularMarketDayLow || quotes?.low?.[quotes.low.length - 1],
      volume: meta.regularMarketVolume
    };
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error.message);
    return null;
  }
}

// Thresholds to show a driver
const THRESHOLDS = {
  VIX: 2.0,           // percent change
  YIELD_10Y: 2,       // basis points
  DXY: 0.3,           // percent change
  HYG: 0.2,           // percent change
  INDEX: 0.5,         // percent change (Nikkei, DAX, etc.)
  SECTOR: 0.5,        // percent change
  MAG7: 1.0,          // percent change
  NQ_ES_SPREAD: 0.3,  // percent difference
  RTY_ES_SPREAD: 0.5  // percent difference
};

// ES-relevant news keywords
const ES_KEYWORDS = {
  HIGH_IMPACT: [
    'Fed', 'FOMC', 'Powell', 'rate cut', 'rate hike',
    'CPI', 'inflation', 'PCE',
    'NFP', 'payroll', 'jobs report', 'unemployment',
    'Trump', 'tariff', 'trade war', 'executive order',
    'war', 'attack', 'missile', 'invasion',
    'recession', 'crash', 'crisis'
  ],
  MEDIUM_IMPACT: [
    'GDP', 'growth', 'retail sales', 'consumer',
    'ECB', 'Lagarde', 'BOJ', 'PBOC',
    'earnings', 'guidance', 'revenue',
    'Apple', 'Microsoft', 'Nvidia', 'Google', 'Amazon', 'Meta', 'Tesla',
    'bank', 'credit', 'yield', 'bond',
    'S&P', 'futures', 'ES'
  ],
  SESSION_SPECIFIC: {
    ASIA: ['Japan', 'Nikkei', 'China', 'Hong Kong', 'Asia', 'BOJ', 'PBOC', 'yen', 'yuan'],
    LONDON: ['Europe', 'ECB', 'Germany', 'DAX', 'UK', 'FTSE', 'BOE', 'euro', 'pound'],
    US_PRE: ['pre-market', 'futures', 'opening'],
    US_RTH: ['Fed', 'Wall Street', 'NYSE', 'S&P', 'Dow', 'Nasdaq']
  }
};

/**
 * Main function — Get everything driving ES right now
 * Cached for 30 seconds to ensure fast response
 */
async function getESCommandCenter() {
  // Return cached data if valid
  if (isCacheValid()) {
    console.log('ES Command Center: returning cached data');
    return esCommandCenterCache;
  }

  console.log('ES Command Center: fetching fresh data...');
  const startTime = Date.now();

  const session = getCurrentSession();
  const nextSession = getNextSession();

  // Fetch all data in parallel
  const [
    esData,
    correlations,
    internationalIndices,
    sectors,
    mag7,
    news,
    institutionalContext
  ] = await Promise.all([
    getESPrice(),
    getCorrelations(),
    getInternationalIndices(session.key),
    getSectorPerformance(),
    getMag7Impact(),
    getESNews(session.key),
    getInstitutionalContext()
  ]);

  // Detect active drivers
  const drivers = detectDrivers({
    session: session.key,
    es: esData,
    correlations,
    indices: internationalIndices,
    sectors,
    mag7,
    news,
    institutionalContext
  });

  // Calculate net bias
  const bias = calculateNetBias(drivers);

  // Get catalyst calendar
  const catalysts = getCatalystCalendar();

  const result = {
    timestamp: new Date().toISOString(),
    session: {
      name: session.name,
      key: session.key,
      emoji: getSessionEmoji(session.key),
      isIB: session.isIB,
      ibMinutesRemaining: session.ibMinutesRemaining
    },
    nextSession: {
      name: nextSession.name,
      countdown: nextSession.countdown
    },
    es: esData,
    drivers,
    bias,
    correlations,
    internationalIndices,
    sectors,
    mag7,
    news,
    institutional: institutionalContext,
    catalysts
  };

  // Cache the result
  esCommandCenterCache = result;
  esCacheTimestamp = Date.now();
  console.log(`ES Command Center: fetched in ${Date.now() - startTime}ms`);

  return result;
}

function getSessionEmoji(sessionKey) {
  const emojis = {
    ASIA: '🌏',
    LONDON: '🇬🇧',
    US_PRE: '🌅',
    US_RTH: '🇺🇸',
    SETTLEMENT: '🔔'
  };
  return emojis[sessionKey] || '📊';
}

/**
 * Get ES price and basic data
 */
async function getESPrice() {
  const data = await fetchYahooQuote('ES=F');
  if (!data) {
    return { price: 0, change: 0, changePercent: 0, error: 'Unable to fetch ES' };
  }
  return {
    price: data.price,
    change: data.change,
    changePercent: data.changePercent,
    previousClose: data.previousClose,
    high: data.dayHigh,
    low: data.dayLow,
    volume: data.volume
  };
}

/**
 * Get correlation instruments
 */
async function getCorrelations() {
  const symbols = {
    VIX: '^VIX',
    TNX: '^TNX',
    DXY: 'DX-Y.NYB',
    HYG: 'HYG',
    TLT: 'TLT',
    NQ: 'NQ=F',
    RTY: 'RTY=F',
    YM: 'YM=F'
  };

  const results = {};
  const fetchPromises = Object.entries(symbols).map(async ([key, symbol]) => {
    const data = await fetchYahooQuote(symbol);
    if (data) {
      results[key] = {
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        changeBps: key === 'TNX' ? Math.round(data.change * 100) : null
      };
    }
  });

  await Promise.all(fetchPromises);
  return results;
}

/**
 * Get international indices based on session
 */
async function getInternationalIndices(session) {
  const symbolsBySession = {
    ASIA: {
      N225: { name: 'Nikkei 225', yahoo: '^N225' },
      HSI: { name: 'Hang Seng', yahoo: '^HSI' },
      SSEC: { name: 'Shanghai', yahoo: '000001.SS' }
    },
    LONDON: {
      DAX: { name: 'DAX', yahoo: '^GDAXI' },
      FTSE: { name: 'FTSE 100', yahoo: '^FTSE' },
      STOXX: { name: 'Euro Stoxx 50', yahoo: '^STOXX50E' }
    },
    US_PRE: {
      DAX: { name: 'DAX', yahoo: '^GDAXI' },
      FTSE: { name: 'FTSE 100', yahoo: '^FTSE' }
    },
    US_RTH: {}
  };

  const sessionSymbols = symbolsBySession[session] || {};
  const results = {};

  const fetchPromises = Object.entries(sessionSymbols).map(async ([key, config]) => {
    const data = await fetchYahooQuote(config.yahoo);
    if (data) {
      results[key] = {
        name: config.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent
      };
    }
  });

  await Promise.all(fetchPromises);
  return results;
}

/**
 * Get sector performance
 */
async function getSectorPerformance() {
  const sectorConfig = {
    XLK: { name: 'Technology', weight: 32 },
    XLF: { name: 'Financials', weight: 13 },
    XLV: { name: 'Healthcare', weight: 12 },
    XLY: { name: 'Consumer Disc', weight: 10 },
    XLC: { name: 'Communication', weight: 9 },
    XLI: { name: 'Industrials', weight: 8 },
    XLP: { name: 'Staples', weight: 6 },
    XLE: { name: 'Energy', weight: 4 },
    XLU: { name: 'Utilities', weight: 3 },
    XLRE: { name: 'Real Estate', weight: 2 },
    XLB: { name: 'Materials', weight: 2 }
  };

  const results = {};
  const fetchPromises = Object.entries(sectorConfig).map(async ([symbol, config]) => {
    const data = await fetchYahooQuote(symbol);
    if (data) {
      results[symbol] = {
        name: config.name,
        weight: config.weight,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent
      };
    }
  });

  await Promise.all(fetchPromises);
  return results;
}

/**
 * Get Mag7 with ES contribution
 */
async function getMag7Impact() {
  const mag7Config = {
    AAPL: { name: 'Apple', weight: 0.07 },
    MSFT: { name: 'Microsoft', weight: 0.06 },
    NVDA: { name: 'Nvidia', weight: 0.05 },
    GOOGL: { name: 'Google', weight: 0.04 },
    AMZN: { name: 'Amazon', weight: 0.03 },
    META: { name: 'Meta', weight: 0.02 },
    TSLA: { name: 'Tesla', weight: 0.02 }
  };

  const esPrice = 6000; // Approximate ES price
  const results = { stocks: {}, netContribution: 0 };

  const fetchPromises = Object.entries(mag7Config).map(async ([symbol, config]) => {
    const data = await fetchYahooQuote(symbol);
    if (data) {
      const contribution = (data.changePercent / 100) * config.weight * esPrice;
      results.stocks[symbol] = {
        name: config.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        weight: config.weight,
        esContribution: contribution
      };
      results.netContribution += contribution;
    }
  });

  await Promise.all(fetchPromises);
  return results;
}

/**
 * Get ES-relevant news filtered by session keywords
 */
async function getESNews(session) {
  try {
    const allNews = await analyzeAllSourcesNews({ lastHours: 4 });

    const sessionKeywords = ES_KEYWORDS.SESSION_SPECIFIC[session] || [];
    const allKeywords = [
      ...ES_KEYWORDS.HIGH_IMPACT,
      ...ES_KEYWORDS.MEDIUM_IMPACT,
      ...sessionKeywords
    ];

    const esNews = allNews.filter(item => {
      const headline = (item.headline || item.title || '').toLowerCase();
      return allKeywords.some(keyword => headline.includes(keyword.toLowerCase()));
    });

    // Add impact level and recency
    const now = Date.now();
    const newsWithMeta = esNews.map(item => {
      const headline = (item.headline || item.title || '').toLowerCase();
      const isHighImpact = ES_KEYWORDS.HIGH_IMPACT.some(k => headline.includes(k.toLowerCase()));
      const timestamp = new Date(item.timestamp || item.datetime).getTime();
      const recencyMinutes = Math.round((now - timestamp) / 60000);

      return {
        ...item,
        headline: item.headline || item.title,
        impact: isHighImpact ? 'HIGH' : 'MEDIUM',
        recency: recencyMinutes,
        bias: item.bias || 'neutral'
      };
    });

    // Sort by impact and recency
    newsWithMeta.sort((a, b) => {
      if (a.impact === 'HIGH' && b.impact !== 'HIGH') return -1;
      if (b.impact === 'HIGH' && a.impact !== 'HIGH') return 1;
      return a.recency - b.recency;
    });

    return newsWithMeta.slice(0, 10);
  } catch (error) {
    console.error('ES news fetch error:', error.message);
    return [];
  }
}

/**
 * INSTITUTIONAL CONTEXT — All desk-level indicators
 */
async function getInstitutionalContext() {
  const [
    vixTermStructure,
    creditSpread,
    gapAnalysis,
    opexCalendar,
    seasonality,
    fomcBlackout
  ] = await Promise.all([
    getVixTermStructure(),
    getCreditSpread(),
    getGapAnalysis(),
    Promise.resolve(getOpexCalendar()),
    Promise.resolve(getSeasonality()),
    Promise.resolve(getFomcBlackout())
  ]);

  // Get cached COT and Put/Call data
  let cotPositioning = { percentile52w: 50, interpretation: 'Data loading...' };
  let putCallRatio = { totalPC: 0.85, interpretation: 'Neutral' };

  try {
    const cotData = getAllCOTData();
    if (cotData?.ES) {
      cotPositioning = {
        netSpeculative: cotData.ES.netSpeculative || 0,
        percentile52w: cotData.ES.percentile || 50,
        interpretation: getPositioningInterpretation(cotData.ES.percentile || 50),
        isExtreme: (cotData.ES.percentile || 50) > 80 || (cotData.ES.percentile || 50) < 20
      };
    }
  } catch (e) { /* ignore */ }

  try {
    const pcData = getPutCallRatio();
    if (pcData) {
      putCallRatio = {
        equityPC: pcData.equityRatio || 0.85,
        totalPC: pcData.totalRatio || 0.85,
        interpretation: getPCInterpretation(pcData.totalRatio || 0.85),
        isExtreme: (pcData.totalRatio || 0.85) < 0.7 || (pcData.totalRatio || 0.85) > 1.2
      };
    }
  } catch (e) { /* ignore */ }

  return {
    vixTermStructure,
    creditSpread,
    cotPositioning,
    gapAnalysis,
    opexCalendar,
    putCallRatio,
    seasonality,
    fomcBlackout,
    fedProbabilities: getFedProbabilities()
  };
}

/**
 * VIX Term Structure — Contango vs Backwardation
 */
async function getVixTermStructure() {
  try {
    const [vixSpot, vx1] = await Promise.all([
      fetchYahooQuote('^VIX'),
      fetchYahooQuote('VX=F')
    ]);

    if (!vixSpot || !vx1) {
      return { error: 'Unable to fetch VIX structure' };
    }

    const spotPrice = vixSpot.price;
    const frontPrice = vx1.price;
    const spread = spotPrice - frontPrice;

    let structure, signal;
    if (spread > 0.5) {
      structure = 'BACKWARDATION';
      signal = 'Near-term fear elevated — unusual, risk-off warning';
    } else if (spread < -1) {
      structure = 'CONTANGO';
      signal = 'Normal term structure — market calm';
    } else {
      structure = 'FLAT';
      signal = 'Transitioning — watch for direction';
    }

    return {
      vixSpot: spotPrice,
      vixFront: frontPrice,
      spread,
      structure,
      signal,
      isWarning: structure === 'BACKWARDATION'
    };
  } catch (error) {
    console.error('VIX term structure error:', error.message);
    return { error: 'Unable to fetch VIX structure' };
  }
}

/**
 * Credit Spread — HYG vs TLT
 */
async function getCreditSpread() {
  try {
    const [hyg, tlt] = await Promise.all([
      fetchYahooQuote('HYG'),
      fetchYahooQuote('TLT')
    ]);

    if (!hyg || !tlt) {
      return { error: 'Unable to fetch credit spread' };
    }

    const hygChange = hyg.changePercent;
    const tltChange = tlt.changePercent;
    const spreadDirection = hygChange - tltChange;

    let signal, interpretation;
    if (hygChange < -0.2 && tltChange > 0.2) {
      signal = 'WIDENING';
      interpretation = 'Credit selling, treasuries bid — Flight to quality, RISK-OFF';
    } else if (hygChange > 0.2 && tltChange < -0.2) {
      signal = 'NARROWING';
      interpretation = 'Credit bid, treasuries selling — Risk appetite healthy, RISK-ON';
    } else if (hygChange < -0.3) {
      signal = 'CREDIT_STRESS';
      interpretation = 'High yield selling hard — Credit leading ES lower, WARNING';
    } else {
      signal = 'NEUTRAL';
      interpretation = 'No significant credit signal';
    }

    return {
      hyg: { price: hyg.price, change: hygChange },
      tlt: { price: tlt.price, change: tltChange },
      spreadDirection,
      signal,
      interpretation,
      isWarning: signal === 'WIDENING' || signal === 'CREDIT_STRESS'
    };
  } catch (error) {
    console.error('Credit spread error:', error.message);
    return { error: 'Unable to fetch credit spread' };
  }
}

/**
 * Gap Analysis — Overnight gap from previous close
 */
async function getGapAnalysis() {
  try {
    const es = await fetchYahooQuote('ES=F');
    if (!es) return { error: 'Unable to calculate gap' };

    const currentPrice = es.price;
    const previousClose = es.previousClose;
    const gapPoints = currentPrice - previousClose;
    const gapPercent = (gapPoints / previousClose) * 100;

    const overnightRange = (es.dayHigh || currentPrice) - (es.dayLow || currentPrice);
    const atr14 = 45; // Approximate ES ATR
    const rangeVsAtr = (overnightRange / atr14) * 100;

    let gapType, fillProbability, context;
    const absGapPct = Math.abs(gapPercent);

    if (gapPercent > 0.05) {
      gapType = 'GAP_UP';
    } else if (gapPercent < -0.05) {
      gapType = 'GAP_DOWN';
    } else {
      gapType = 'FLAT';
    }

    if (absGapPct > 0.5) {
      fillProbability = 52;
      context = 'Large gap — may not fill today';
    } else if (absGapPct > 0.3) {
      fillProbability = 68;
      context = 'Moderate gap — likely to test fill level';
    } else {
      fillProbability = 78;
      context = 'Small gap — high fill probability';
    }

    return {
      previousClose,
      currentPrice,
      gapPoints,
      gapPercent,
      gapType,
      globexHigh: es.dayHigh,
      globexLow: es.dayLow,
      overnightRange,
      atr14,
      rangeVsAtr,
      fillProbability,
      fillLevel: previousClose,
      context
    };
  } catch (error) {
    console.error('Gap analysis error:', error.message);
    return { error: 'Unable to calculate gap' };
  }
}

/**
 * OPEX Calendar
 */
function getOpexCalendar() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  function getThirdFriday(year, month) {
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay();
    const firstFriday = dayOfWeek <= 5 ? (5 - dayOfWeek + 1) : (12 - dayOfWeek + 1);
    return new Date(year, month, firstFriday + 14);
  }

  const monthlyOpex = getThirdFriday(currentYear, currentMonth);
  const quarterlyMonths = [2, 5, 8, 11];
  const isQuarterlyOpex = quarterlyMonths.includes(currentMonth);

  const daysToOpex = Math.ceil((monthlyOpex - now) / (1000 * 60 * 60 * 24));

  let opexStatus, context;
  if (daysToOpex === 0) {
    opexStatus = 'OPEX_TODAY';
    context = isQuarterlyOpex ? 'QUARTERLY OPEX — Triple Witching' : 'Monthly OPEX — expect pinning';
  } else if (daysToOpex === 1) {
    opexStatus = 'OPEX_TOMORROW';
    context = 'Day before OPEX — volatility expected';
  } else if (daysToOpex <= 3) {
    opexStatus = 'OPEX_WEEK';
    context = 'OPEX week — elevated gamma';
  } else {
    opexStatus = 'NORMAL';
    context = 'No immediate OPEX impact';
  }

  return {
    monthlyOpex: monthlyOpex.toISOString().split('T')[0],
    daysToOpex,
    isQuarterly: isQuarterlyOpex,
    opexStatus,
    context,
    zeroDteActive: true,
    pinRisk: daysToOpex <= 1 ? 'HIGH' : daysToOpex <= 3 ? 'MODERATE' : 'LOW'
  };
}

/**
 * Seasonality
 */
function getSeasonality() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  const month = now.getMonth();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  const dayAvg = { 0: 0, 1: 0.05, 2: 0.08, 3: 0.02, 4: 0.03, 5: -0.02, 6: 0 };
  const monthAvg = {
    0: 0.10, 1: -0.02, 2: 0.05, 3: 0.12, 4: 0.01, 5: 0.02,
    6: 0.08, 7: -0.03, 8: -0.08, 9: 0.15, 10: 0.18, 11: 0.12
  };

  const weekOfMonth = Math.ceil(dayOfMonth / 7);

  const specialContext = [];
  if (dayOfMonth >= 1 && dayOfMonth <= 5) specialContext.push('Start of month — typically bullish inflows');
  if (dayOfMonth >= 28) specialContext.push('End of month — rebalancing flows');
  if (month === 8) specialContext.push('September — historically weakest month');
  if (month >= 9 && month <= 11) specialContext.push('Q4 — historically strongest quarter');

  return {
    dayOfWeek: dayNames[dayOfWeek],
    dayAvgReturn: dayAvg[dayOfWeek],
    month: monthNames[month],
    monthAvgReturn: monthAvg[month],
    weekOfMonth,
    specialContext: specialContext.length > 0 ? specialContext : ['No special seasonal context'],
    overallBias: monthAvg[month] > 0.05 ? 'BULLISH' : monthAvg[month] < -0.03 ? 'BEARISH' : 'NEUTRAL'
  };
}

/**
 * FOMC Blackout
 */
function getFomcBlackout() {
  const fomcDates = [
    { meeting: '2026-03-18', blackoutStart: '2026-03-07', blackoutEnd: '2026-03-18' },
    { meeting: '2026-05-06', blackoutStart: '2026-04-25', blackoutEnd: '2026-05-06' },
    { meeting: '2026-06-17', blackoutStart: '2026-06-06', blackoutEnd: '2026-06-17' },
    { meeting: '2026-07-29', blackoutStart: '2026-07-18', blackoutEnd: '2026-07-29' }
  ];

  const now = new Date();
  const currentBlackout = fomcDates.find(f => {
    const start = new Date(f.blackoutStart);
    const end = new Date(f.blackoutEnd);
    return now >= start && now <= end;
  });

  const nextMeeting = fomcDates.find(f => new Date(f.meeting) > now);

  return {
    inBlackout: !!currentBlackout,
    currentBlackout: currentBlackout || null,
    nextMeeting: nextMeeting ? nextMeeting.meeting : 'TBD',
    nextBlackoutStart: nextMeeting ? nextMeeting.blackoutStart : 'TBD'
  };
}

/**
 * Fed Rate Probabilities (placeholder - should integrate with CME FedWatch)
 */
function getFedProbabilities() {
  return {
    currentRate: '4.25-4.50%',
    nextMeeting: { date: '2026-03-18', label: 'March' },
    probabilities: {
      nextMeeting: { hold: 85, cut25: 15, hike: 0 },
      june: { hold: 40, cut25: 55, cut50: 5 }
    },
    signal: 'Rate cuts priced for H1 2026'
  };
}

function getPositioningInterpretation(percentile) {
  if (percentile > 85) return 'Extreme long — contrarian bearish';
  if (percentile > 70) return 'Crowded long — pullback risk';
  if (percentile < 15) return 'Extreme short — contrarian bullish';
  if (percentile < 30) return 'Light positioning — room to add';
  return 'Neutral positioning';
}

function getPCInterpretation(ratio) {
  if (ratio < 0.7) return 'Extreme complacency — contrarian bearish';
  if (ratio < 0.85) return 'Low fear — bullish sentiment';
  if (ratio > 1.2) return 'Elevated fear — contrarian bullish';
  if (ratio > 1.0) return 'Cautious — mild bearish sentiment';
  return 'Neutral range';
}

/**
 * Catalyst Calendar
 */
function getCatalystCalendar() {
  const now = new Date();
  const catalysts = [];

  // Get energy reports
  try {
    const energyReports = fetchEnergyReports();
    energyReports.forEach(r => {
      if (r.isToday || r.isTomorrow) {
        catalysts.push({
          event: r.shortName,
          time: r.time,
          importance: r.importance,
          isToday: r.isToday,
          affectedSymbols: r.affectedInstruments
        });
      }
    });
  } catch (e) { /* ignore */ }

  // Get central bank events
  try {
    const cbEvents = fetchCentralBankCalendar();
    cbEvents.forEach(e => {
      if (e.isToday || e.isTomorrow) {
        catalysts.push({
          event: e.shortName,
          time: e.time,
          importance: e.importance,
          isToday: e.isToday,
          affectedSymbols: ['ES', 'NQ', 'ZN']
        });
      }
    });
  } catch (e) { /* ignore */ }

  return {
    next48Hours: catalysts.slice(0, 5),
    fedSpeakers: [],
    treasuryAuctions: []
  };
}

/**
 * Detect what's actually moving ES right now
 */
function detectDrivers(data) {
  const drivers = [];
  const { session, es, correlations, indices, sectors, mag7, news, institutionalContext } = data;

  if (!correlations || !es) return drivers;

  // === VIX ===
  if (correlations.VIX && Math.abs(correlations.VIX.changePercent) >= THRESHOLDS.VIX) {
    const isUp = correlations.VIX.changePercent > 0;
    drivers.push({
      type: 'CORRELATION',
      name: `VIX ${isUp ? 'Spike' : 'Drop'} ${Math.abs(correlations.VIX.changePercent).toFixed(1)}%`,
      value: correlations.VIX.price?.toFixed(1),
      change: `${isUp ? '+' : ''}${correlations.VIX.changePercent.toFixed(1)}%`,
      direction: isUp ? 'BEARISH' : 'BULLISH',
      reason: isUp ? 'Fear rising — risk-off pressure' : 'Fear subsiding — risk-on support',
      impact: Math.abs(correlations.VIX.changePercent) * 2
    });
  }

  // === 10Y Yield ===
  if (correlations.TNX && Math.abs(correlations.TNX.changeBps || 0) >= THRESHOLDS.YIELD_10Y) {
    const isUp = (correlations.TNX.changeBps || 0) > 0;
    drivers.push({
      type: 'CORRELATION',
      name: `10Y Yield ${isUp ? '+' : ''}${correlations.TNX.changeBps}bp`,
      value: `${correlations.TNX.price?.toFixed(2)}%`,
      change: `${isUp ? '+' : ''}${correlations.TNX.changeBps}bp`,
      direction: isUp ? 'BEARISH' : 'BULLISH',
      reason: isUp ? 'Higher yields pressure valuations' : 'Lower yields support equities',
      impact: Math.abs(correlations.TNX.changeBps || 0) * 1.5
    });
  }

  // === DXY ===
  if (correlations.DXY && Math.abs(correlations.DXY.changePercent) >= THRESHOLDS.DXY) {
    const isUp = correlations.DXY.changePercent > 0;
    drivers.push({
      type: 'CORRELATION',
      name: `Dollar ${isUp ? 'Strength' : 'Weakness'}`,
      value: correlations.DXY.price?.toFixed(2),
      change: `${isUp ? '+' : ''}${correlations.DXY.changePercent.toFixed(2)}%`,
      direction: isUp ? 'BEARISH' : 'BULLISH',
      reason: isUp ? 'Strong dollar headwind' : 'Weak dollar tailwind',
      impact: Math.abs(correlations.DXY.changePercent) * 1.2
    });
  }

  // === HYG Credit ===
  if (correlations.HYG && Math.abs(correlations.HYG.changePercent) >= THRESHOLDS.HYG) {
    const isUp = correlations.HYG.changePercent > 0;
    drivers.push({
      type: 'CORRELATION',
      name: `Credit ${isUp ? 'Risk-On' : 'Risk-Off'}`,
      value: `HYG ${isUp ? '+' : ''}${correlations.HYG.changePercent.toFixed(2)}%`,
      change: `${isUp ? '+' : ''}${correlations.HYG.changePercent.toFixed(2)}%`,
      direction: isUp ? 'BULLISH' : 'BEARISH',
      reason: isUp ? 'High-yield bid — risk appetite healthy' : 'Credit selling — risk-off',
      impact: Math.abs(correlations.HYG.changePercent) * 1.3
    });
  }

  // === NQ-ES Divergence ===
  if (correlations.NQ && es.changePercent !== undefined) {
    const nqEsSpread = correlations.NQ.changePercent - es.changePercent;
    if (Math.abs(nqEsSpread) >= THRESHOLDS.NQ_ES_SPREAD) {
      const techLeading = nqEsSpread > 0;
      drivers.push({
        type: 'DIVERGENCE',
        name: techLeading ? 'Tech Leading' : 'Tech Lagging',
        value: `NQ ${nqEsSpread > 0 ? '+' : ''}${nqEsSpread.toFixed(2)}% vs ES`,
        change: `${nqEsSpread.toFixed(2)}%`,
        direction: 'NEUTRAL',
        reason: techLeading ? 'Growth outperforming — narrow rally' : 'Growth underperforming — rotation',
        impact: Math.abs(nqEsSpread)
      });
    }
  }

  // === RTY-ES Divergence ===
  if (correlations.RTY && es.changePercent !== undefined) {
    const rtyEsSpread = correlations.RTY.changePercent - es.changePercent;
    if (Math.abs(rtyEsSpread) >= THRESHOLDS.RTY_ES_SPREAD) {
      const breadthExpanding = rtyEsSpread > 0;
      drivers.push({
        type: 'DIVERGENCE',
        name: breadthExpanding ? 'Breadth Expanding' : 'Breadth Narrowing',
        value: `RTY ${rtyEsSpread > 0 ? '+' : ''}${rtyEsSpread.toFixed(2)}% vs ES`,
        change: `${rtyEsSpread.toFixed(2)}%`,
        direction: breadthExpanding ? 'BULLISH' : 'BEARISH',
        reason: breadthExpanding ? 'Small caps outperforming — healthy' : 'Small caps lagging — fragile',
        impact: Math.abs(rtyEsSpread)
      });
    }
  }

  // === International Indices ===
  if (indices) {
    for (const [key, indexData] of Object.entries(indices)) {
      if (Math.abs(indexData.changePercent) >= THRESHOLDS.INDEX) {
        const isUp = indexData.changePercent > 0;
        drivers.push({
          type: 'INTERNATIONAL',
          name: `${indexData.name} ${isUp ? '+' : ''}${indexData.changePercent.toFixed(1)}%`,
          value: indexData.price?.toFixed(0),
          change: `${isUp ? '+' : ''}${indexData.changePercent.toFixed(1)}%`,
          direction: isUp ? 'BULLISH' : 'BEARISH',
          reason: `${indexData.name} ${isUp ? 'rally' : 'selloff'}`,
          impact: Math.abs(indexData.changePercent) * 0.8
        });
      }
    }
  }

  // === Sectors ===
  if (sectors) {
    for (const [symbol, sectorData] of Object.entries(sectors)) {
      if (Math.abs(sectorData.changePercent) >= THRESHOLDS.SECTOR) {
        const isUp = sectorData.changePercent > 0;
        drivers.push({
          type: 'SECTOR',
          name: `${sectorData.name} ${isUp ? '+' : ''}${sectorData.changePercent.toFixed(1)}%`,
          value: `${sectorData.weight}% of ES`,
          change: `${isUp ? '+' : ''}${sectorData.changePercent.toFixed(1)}%`,
          direction: isUp ? 'BULLISH' : 'BEARISH',
          reason: `${sectorData.name} (${sectorData.weight}% weight) ${isUp ? 'leading' : 'lagging'}`,
          impact: Math.abs(sectorData.changePercent) * (sectorData.weight / 10)
        });
      }
    }
  }

  // === Mag7 ===
  if (mag7?.stocks) {
    for (const [symbol, stockData] of Object.entries(mag7.stocks)) {
      if (Math.abs(stockData.changePercent) >= THRESHOLDS.MAG7) {
        const isUp = stockData.changePercent > 0;
        drivers.push({
          type: 'MAG7',
          name: `${stockData.name} ${isUp ? '+' : ''}${stockData.changePercent.toFixed(1)}%`,
          value: `${Math.abs(stockData.esContribution).toFixed(1)} pts ${isUp ? 'lift' : 'drag'}`,
          change: `${isUp ? '+' : ''}${stockData.changePercent.toFixed(1)}%`,
          direction: isUp ? 'BULLISH' : 'BEARISH',
          reason: `${stockData.name} — ${Math.abs(stockData.esContribution).toFixed(1)} pts ES impact`,
          impact: Math.abs(stockData.esContribution)
        });
      }
    }
  }

  // === News Drivers ===
  if (news) {
    for (const newsItem of news) {
      if (newsItem.impact === 'HIGH' || (newsItem.impact === 'MEDIUM' && newsItem.recency < 60)) {
        drivers.push({
          type: 'NEWS',
          name: newsItem.headline.substring(0, 50) + (newsItem.headline.length > 50 ? '...' : ''),
          value: newsItem.source || 'News',
          change: `${newsItem.recency} min ago`,
          direction: (newsItem.bias || 'neutral').toUpperCase(),
          reason: newsItem.headline,
          impact: newsItem.impact === 'HIGH' ? 5 : 3
        });
      }
    }
  }

  // Sort by impact and return top drivers
  drivers.sort((a, b) => b.impact - a.impact);
  return drivers.slice(0, 6);
}

/**
 * Calculate net bias from drivers
 */
function calculateNetBias(drivers) {
  let bullish = 0;
  let bearish = 0;

  for (const driver of drivers) {
    if (driver.direction === 'BULLISH') {
      bullish += driver.impact;
    } else if (driver.direction === 'BEARISH') {
      bearish += driver.impact;
    }
  }

  const total = bullish + bearish;
  if (total === 0) {
    return { direction: 'NEUTRAL', confidence: 50, summary: 'No strong drivers active' };
  }

  const bullishPct = (bullish / total) * 100;
  const bearishPct = (bearish / total) * 100;

  if (bullishPct > 65) {
    return {
      direction: 'BULLISH',
      confidence: Math.round(bullishPct),
      bullishScore: bullish,
      bearishScore: bearish,
      summary: `${drivers.filter(d => d.direction === 'BULLISH').length} bullish drivers active`
    };
  } else if (bearishPct > 65) {
    return {
      direction: 'BEARISH',
      confidence: Math.round(bearishPct),
      bullishScore: bullish,
      bearishScore: bearish,
      summary: `${drivers.filter(d => d.direction === 'BEARISH').length} bearish drivers active`
    };
  } else {
    return {
      direction: 'MIXED',
      confidence: Math.round(Math.max(bullishPct, bearishPct)),
      bullishScore: bullish,
      bearishScore: bearish,
      summary: 'Conflicting drivers — choppy conditions'
    };
  }
}

/**
 * Get full bias breakdown for modal display
 */
async function getBiasBreakdown() {
  const data = await getESCommandCenter();

  const breakdown = {
    timestamp: data.timestamp,
    es: data.es,
    finalBias: data.bias,
    categories: {
      correlations: [],
      eventRisk: [],
      positioning: [],
      international: [],
      sectors: [],
      mag7: [],
      context: []
    }
  };

  // Populate from drivers
  for (const driver of data.drivers) {
    const score = driver.direction === 'BULLISH' ? driver.impact :
                  driver.direction === 'BEARISH' ? -driver.impact : 0;

    const entry = {
      factor: driver.name,
      value: driver.value,
      score: Math.round(score),
      reason: driver.reason
    };

    switch (driver.type) {
      case 'CORRELATION':
      case 'DIVERGENCE':
        breakdown.categories.correlations.push(entry);
        break;
      case 'INTERNATIONAL':
        breakdown.categories.international.push(entry);
        break;
      case 'SECTOR':
        breakdown.categories.sectors.push(entry);
        break;
      case 'MAG7':
        breakdown.categories.mag7.push(entry);
        break;
      case 'NEWS':
        breakdown.categories.eventRisk.push(entry);
        break;
    }
  }

  // Add institutional context
  const inst = data.institutional;

  if (inst.vixTermStructure && !inst.vixTermStructure.error) {
    breakdown.categories.correlations.push({
      factor: 'VIX Structure',
      value: inst.vixTermStructure.structure,
      score: inst.vixTermStructure.structure === 'BACKWARDATION' ? -8 : 2,
      reason: inst.vixTermStructure.signal
    });
  }

  if (inst.cotPositioning) {
    breakdown.categories.positioning.push({
      factor: 'COT Percentile',
      value: `${inst.cotPositioning.percentile52w}th`,
      score: inst.cotPositioning.percentile52w > 80 ? -8 : inst.cotPositioning.percentile52w < 20 ? 8 : 0,
      reason: inst.cotPositioning.interpretation
    });
  }

  if (inst.putCallRatio) {
    breakdown.categories.positioning.push({
      factor: 'Put/Call',
      value: inst.putCallRatio.totalPC?.toFixed(2),
      score: inst.putCallRatio.totalPC > 1.2 ? 5 : inst.putCallRatio.totalPC < 0.7 ? -5 : 0,
      reason: inst.putCallRatio.interpretation
    });
  }

  if (inst.gapAnalysis && !inst.gapAnalysis.error) {
    breakdown.categories.context.push({
      factor: 'Gap',
      value: `${inst.gapAnalysis.gapPercent?.toFixed(2)}%`,
      score: inst.gapAnalysis.gapPercent < -0.3 ? -3 : inst.gapAnalysis.gapPercent > 0.3 ? 3 : 0,
      reason: inst.gapAnalysis.context
    });
  }

  if (inst.seasonality) {
    breakdown.categories.context.push({
      factor: 'Seasonality',
      value: inst.seasonality.month,
      score: inst.seasonality.overallBias === 'BULLISH' ? 3 : inst.seasonality.overallBias === 'BEARISH' ? -3 : 0,
      reason: `${inst.seasonality.month} historically ${inst.seasonality.overallBias.toLowerCase()}`
    });
  }

  if (inst.opexCalendar) {
    breakdown.categories.context.push({
      factor: 'OPEX',
      value: inst.opexCalendar.opexStatus,
      score: inst.opexCalendar.opexStatus === 'OPEX_TODAY' ? -3 : inst.opexCalendar.opexStatus === 'OPEX_TOMORROW' ? -2 : 0,
      reason: inst.opexCalendar.context
    });
  }

  // Calculate totals
  let totalBullish = 0;
  let totalBearish = 0;

  for (const category of Object.values(breakdown.categories)) {
    for (const item of category) {
      if (item.score > 0) totalBullish += item.score;
      if (item.score < 0) totalBearish += Math.abs(item.score);
    }
  }

  breakdown.totals = {
    bullish: totalBullish,
    bearish: totalBearish,
    net: totalBullish - totalBearish,
    normalized: Math.round(((totalBullish - totalBearish) / Math.max(totalBullish + totalBearish, 1)) * 100)
  };

  return breakdown;
}

export {
  getESCommandCenter,
  getBiasBreakdown,
  detectDrivers,
  calculateNetBias,
  getESNews
};
