/**
 * Final Analysis Service
 * Generates comprehensive bias analysis for 6 instruments (ES, NQ, YM, RTY, GC, CL)
 * Combines all market data: news, VIX, ZN, DXY, sectors, Mag7, earnings
 */

import Anthropic from '@anthropic-ai/sdk';
import { analyzeAllSourcesNews, getNewsSentimentSummary } from './newsAnalysis.js';
import { fetchEarningsCalendar, fetchEconomicCalendar } from './alphaVantage.js';
import { fetchEnergyReports, fetchCentralBankCalendar, buildReportsCalendar } from './fundamentalReports.js';
import { analyzeTechnicals, YAHOO_SYMBOLS } from './technicalAnalysis.js';

// Initialize Anthropic client
let anthropic = null;

function getAnthropicClient() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropic;
}

// Cache for final analysis
let finalAnalysisCache = null;
let finalAnalysisCacheTime = null;
const FINAL_ANALYSIS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Instrument configurations with weighting factors
const INSTRUMENT_CONFIG = {
  ES: {
    name: 'S&P 500 E-mini',
    category: 'Equity Index',
    factors: {
      VIX: 0.25,
      ZN: 0.20,
      DXY: 0.15,
      News: 0.25,
      Mag7: 0.15
    }
  },
  NQ: {
    name: 'Nasdaq 100 E-mini',
    category: 'Equity Index',
    factors: {
      Tech: 0.25,
      Mag7: 0.30,
      VIX: 0.15,
      TechNews: 0.20,
      ZN: 0.10
    }
  },
  YM: {
    name: 'Dow Jones E-mini',
    category: 'Equity Index',
    factors: {
      ES: 0.30,
      Industrial: 0.25,
      DXY: 0.20,
      News: 0.25
    }
  },
  RTY: {
    name: 'Russell 2000 E-mini',
    category: 'Small Cap Index',
    factors: {
      ZN: 0.30,
      RegionalBank: 0.20,
      VIX: 0.25,
      ES: 0.25
    }
  },
  GC: {
    name: 'Gold Futures',
    category: 'Precious Metal',
    factors: {
      DXY: 0.35,
      ZN: 0.25,
      VIX: 0.20,
      GeoNews: 0.20
    }
  },
  CL: {
    name: 'Crude Oil WTI',
    category: 'Energy',
    factors: {
      DXY: 0.25,
      Energy: 0.25,
      GeoNews: 0.30,
      EnergyNews: 0.20
    }
  }
};

/**
 * Calculate VIX signal
 */
function calculateVIXSignal(vixLevel, vixChange) {
  let signal = 'neutral';
  let score = 0;
  let reason = '';

  if (vixLevel < 12) {
    signal = 'bullish';
    score = 2;
    reason = 'Very low fear, complacent market';
  } else if (vixLevel < 16) {
    signal = 'bullish';
    score = 1;
    reason = 'Low fear environment';
  } else if (vixLevel < 20) {
    signal = 'neutral';
    score = 0;
    reason = 'Normal volatility';
  } else if (vixLevel < 25) {
    signal = 'bearish';
    score = -1;
    reason = 'Elevated fear';
  } else if (vixLevel < 30) {
    signal = 'bearish';
    score = -2;
    reason = 'High fear';
  } else {
    signal = 'bearish';
    score = -3;
    reason = 'Extreme fear/panic';
  }

  // Adjust for change
  if (vixChange > 10) {
    score -= 1;
    reason += ', spiking';
  } else if (vixChange < -10) {
    score += 1;
    reason += ', collapsing';
  }

  return { value: vixLevel, change: vixChange, signal, score, reason };
}

/**
 * Calculate ZN (10-Year Note) signal
 * Rising ZN = falling yields = bullish for equities
 */
function calculateZNSignal(znChange) {
  let signal = 'neutral';
  let score = 0;
  let reason = '';

  if (znChange > 0.3) {
    signal = 'bullish';
    score = 2;
    reason = 'Yields falling sharply';
  } else if (znChange > 0.15) {
    signal = 'bullish';
    score = 1;
    reason = 'Yields easing';
  } else if (znChange < -0.3) {
    signal = 'bearish';
    score = -2;
    reason = 'Yields surging';
  } else if (znChange < -0.15) {
    signal = 'bearish';
    score = -1;
    reason = 'Yields rising';
  } else {
    signal = 'neutral';
    score = 0;
    reason = 'Yields stable';
  }

  return { value: znChange, signal, score, reason };
}

/**
 * Calculate DXY signal
 * Falling DXY = bullish for commodities and emerging markets
 */
function calculateDXYSignal(dxyChange) {
  let signal = 'neutral';
  let score = 0;
  let reason = '';

  if (dxyChange < -0.5) {
    signal = 'bullish';
    score = 2;
    reason = 'Dollar very weak';
  } else if (dxyChange < -0.2) {
    signal = 'bullish';
    score = 1;
    reason = 'Dollar soft';
  } else if (dxyChange > 0.5) {
    signal = 'bearish';
    score = -2;
    reason = 'Dollar very strong';
  } else if (dxyChange > 0.2) {
    signal = 'bearish';
    score = -1;
    reason = 'Dollar firm';
  } else {
    signal = 'neutral';
    score = 0;
    reason = 'Dollar stable';
  }

  return { value: dxyChange, signal, score, reason };
}

/**
 * Calculate Mag7 aggregate signal
 */
function calculateMag7Signal(mag7Data) {
  if (!mag7Data || Object.keys(mag7Data).length === 0) {
    return { value: 0, signal: 'neutral', score: 0, reason: 'No Mag7 data' };
  }

  const stocks = Object.values(mag7Data);
  const greenCount = stocks.filter(s => (s.changePercent || 0) > 0).length;
  const totalChange = stocks.reduce((sum, s) => sum + (s.changePercent || 0), 0) / stocks.length;

  let signal = 'neutral';
  let score = 0;
  let reason = `${greenCount}/7 green`;

  if (greenCount >= 6 && totalChange > 1) {
    signal = 'bullish';
    score = 2;
    reason += ', strong rally';
  } else if (greenCount >= 5) {
    signal = 'bullish';
    score = 1;
    reason += ', mostly positive';
  } else if (greenCount <= 1 && totalChange < -1) {
    signal = 'bearish';
    score = -2;
    reason += ', broad weakness';
  } else if (greenCount <= 2) {
    signal = 'bearish';
    score = -1;
    reason += ', mostly red';
  }

  return { value: totalChange.toFixed(2), greenCount, signal, score, reason };
}

/**
 * Calculate sector signal
 */
function calculateSectorSignal(sectorData, targetSector) {
  if (!sectorData || !sectorData[targetSector]) {
    return { value: 0, signal: 'neutral', score: 0, reason: 'No sector data' };
  }

  const sector = sectorData[targetSector];
  const change = sector.changePercent || 0;

  let signal = 'neutral';
  let score = 0;
  let reason = `${sector.name} ${change > 0 ? '+' : ''}${change.toFixed(2)}%`;

  if (change > 1) {
    signal = 'bullish';
    score = 2;
    reason = `${sector.name} rallying`;
  } else if (change > 0.3) {
    signal = 'bullish';
    score = 1;
    reason = `${sector.name} positive`;
  } else if (change < -1) {
    signal = 'bearish';
    score = -2;
    reason = `${sector.name} selling off`;
  } else if (change < -0.3) {
    signal = 'bearish';
    score = -1;
    reason = `${sector.name} weak`;
  }

  return { value: change, signal, score, reason };
}

/**
 * Calculate news sentiment signal for an instrument
 */
function calculateNewsSignal(newsSentiment, instrument, category = null) {
  const instrumentData = newsSentiment?.byInstrument?.[instrument];
  if (!instrumentData) {
    return { value: 0, signal: 'neutral', score: 0, reason: 'No relevant news' };
  }

  const { bullish, bearish, total, score: sentimentScore } = instrumentData;
  let signal = 'neutral';
  let score = 0;
  let reason = `${bullish} bullish, ${bearish} bearish`;

  if (sentimentScore > 0.3) {
    signal = 'bullish';
    score = 2;
    reason = `Strongly positive news (${bullish}/${total})`;
  } else if (sentimentScore > 0.1) {
    signal = 'bullish';
    score = 1;
    reason = `Positive news sentiment`;
  } else if (sentimentScore < -0.3) {
    signal = 'bearish';
    score = -2;
    reason = `Strongly negative news (${bearish}/${total})`;
  } else if (sentimentScore < -0.1) {
    signal = 'bearish';
    score = -1;
    reason = `Negative news sentiment`;
  }

  return { value: sentimentScore.toFixed(2), total, bullish, bearish, signal, score, reason };
}

/**
 * Calculate geopolitical news signal (for GC and CL)
 */
function calculateGeoNewsSignal(newsSentiment) {
  const geoCount = newsSentiment?.byCategory?.Geopolitical || 0;

  let signal = 'neutral';
  let score = 0;
  let reason = `${geoCount} geopolitical stories`;

  if (geoCount >= 5) {
    signal = 'bullish'; // For safe havens
    score = 2;
    reason = 'High geopolitical tension';
  } else if (geoCount >= 2) {
    signal = 'bullish';
    score = 1;
    reason = 'Elevated geopolitical risk';
  }

  return { value: geoCount, signal, score, reason };
}

/**
 * Calculate ES bias
 */
function calculateESBias(marketData, newsSentiment) {
  const factors = {};

  // VIX (25%)
  factors.VIX = calculateVIXSignal(marketData.vix, marketData.vixChange);

  // ZN (20%)
  factors.ZN = calculateZNSignal(marketData.znChange);

  // DXY (15%)
  factors.DXY = calculateDXYSignal(marketData.dxyChange);

  // News (25%)
  factors.News = calculateNewsSignal(newsSentiment, 'ES');

  // Mag7 (15%)
  factors.Mag7 = calculateMag7Signal(marketData.mag7);

  return calculateFinalBias('ES', factors);
}

/**
 * Calculate NQ bias
 */
function calculateNQBias(marketData, newsSentiment, esResult) {
  const factors = {};

  // Tech sector (25%)
  factors.Tech = calculateSectorSignal(marketData.sectors, 'XLK');

  // Mag7 (30%)
  factors.Mag7 = calculateMag7Signal(marketData.mag7);

  // VIX (15%)
  factors.VIX = calculateVIXSignal(marketData.vix, marketData.vixChange);

  // Tech News (20%)
  factors.TechNews = calculateNewsSignal(newsSentiment, 'NQ');

  // ZN (10%)
  factors.ZN = calculateZNSignal(marketData.znChange);

  return calculateFinalBias('NQ', factors);
}

/**
 * Calculate YM bias
 */
function calculateYMBias(marketData, newsSentiment, esResult) {
  const factors = {};

  // ES correlation (30%)
  factors.ES = {
    value: esResult.confidence,
    signal: esResult.bias.toLowerCase(),
    score: esResult.bias === 'BULLISH' ? 2 : esResult.bias === 'BEARISH' ? -2 : 0,
    reason: `ES is ${esResult.bias}`
  };

  // Industrial sector (25%)
  factors.Industrial = calculateSectorSignal(marketData.sectors, 'XLI') ||
    calculateSectorSignal(marketData.sectors, 'XLF'); // Fallback to financials

  // DXY (20%)
  factors.DXY = calculateDXYSignal(marketData.dxyChange);

  // News (25%)
  factors.News = calculateNewsSignal(newsSentiment, 'YM') ||
    calculateNewsSignal(newsSentiment, 'ES'); // Fallback

  return calculateFinalBias('YM', factors);
}

/**
 * Calculate RTY bias
 */
function calculateRTYBias(marketData, newsSentiment, esResult) {
  const factors = {};

  // ZN (30%) - Small caps very rate sensitive
  factors.ZN = calculateZNSignal(marketData.znChange);
  factors.ZN.score *= 1.5; // Amplify ZN impact for small caps

  // Regional bank news (20%)
  factors.RegionalBank = calculateNewsSignal(newsSentiment, 'RTY');

  // VIX (25%)
  factors.VIX = calculateVIXSignal(marketData.vix, marketData.vixChange);

  // ES correlation (25%)
  factors.ES = {
    value: esResult.confidence,
    signal: esResult.bias.toLowerCase(),
    score: esResult.bias === 'BULLISH' ? 1.5 : esResult.bias === 'BEARISH' ? -1.5 : 0,
    reason: `ES correlation (${esResult.bias})`
  };

  return calculateFinalBias('RTY', factors);
}

/**
 * Calculate GC bias
 */
function calculateGCBias(marketData, newsSentiment) {
  const factors = {};

  // DXY inverse (35%)
  const dxySignal = calculateDXYSignal(marketData.dxyChange);
  factors.DXY = {
    ...dxySignal,
    score: -dxySignal.score, // Inverse relationship
    signal: dxySignal.score > 0 ? 'bearish' : dxySignal.score < 0 ? 'bullish' : 'neutral',
    reason: dxySignal.score > 0 ? 'Strong dollar (bearish gold)' : dxySignal.score < 0 ? 'Weak dollar (bullish gold)' : 'Dollar stable'
  };

  // ZN (25%)
  factors.ZN = calculateZNSignal(marketData.znChange);

  // VIX safe haven (20%)
  const vixSignal = calculateVIXSignal(marketData.vix, marketData.vixChange);
  factors.VIX = {
    ...vixSignal,
    score: vixSignal.value > 20 ? 2 : vixSignal.value > 16 ? 1 : 0, // High VIX = gold bid
    signal: vixSignal.value > 20 ? 'bullish' : vixSignal.value > 16 ? 'bullish' : 'neutral',
    reason: vixSignal.value > 20 ? 'Safe haven bid' : vixSignal.value > 16 ? 'Elevated fear' : 'Low fear'
  };

  // Geopolitical news (20%)
  factors.GeoNews = calculateGeoNewsSignal(newsSentiment);

  return calculateFinalBias('GC', factors);
}

/**
 * Calculate CL bias
 */
function calculateCLBias(marketData, newsSentiment) {
  const factors = {};

  // DXY inverse (25%)
  const dxySignal = calculateDXYSignal(marketData.dxyChange);
  factors.DXY = {
    ...dxySignal,
    score: -dxySignal.score * 0.8, // Inverse but less impactful than gold
    signal: dxySignal.score > 0 ? 'bearish' : dxySignal.score < 0 ? 'bullish' : 'neutral',
    reason: dxySignal.score > 0 ? 'Strong dollar (bearish oil)' : dxySignal.score < 0 ? 'Weak dollar (bullish oil)' : 'Dollar neutral'
  };

  // Energy sector (25%)
  factors.Energy = calculateSectorSignal(marketData.sectors, 'XLE');

  // Geopolitical news (30%)
  factors.GeoNews = calculateGeoNewsSignal(newsSentiment);

  // Energy-specific news (20%)
  factors.EnergyNews = calculateNewsSignal(newsSentiment, 'CL');

  return calculateFinalBias('CL', factors);
}

/**
 * Calculate final bias from factors
 */
function calculateFinalBias(instrument, factors) {
  const config = INSTRUMENT_CONFIG[instrument];
  let totalScore = 0;
  let totalWeight = 0;

  // Calculate weighted score
  for (const [key, factor] of Object.entries(factors)) {
    const weight = config.factors[key] || 0.2;
    totalScore += factor.score * weight;
    totalWeight += weight;
  }

  // Normalize score
  const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  // Determine bias
  let bias = 'NEUTRAL';
  if (normalizedScore >= 1.5) bias = 'BULLISH';
  else if (normalizedScore >= 0.5) bias = 'SLIGHT BULLISH';
  else if (normalizedScore <= -1.5) bias = 'BEARISH';
  else if (normalizedScore <= -0.5) bias = 'SLIGHT BEARISH';

  // Calculate confidence (0-100)
  const factorScores = Object.values(factors).map(f => f.score);
  const allSameDirection = factorScores.every(s => s >= 0) || factorScores.every(s => s <= 0);
  const avgMagnitude = factorScores.reduce((sum, s) => sum + Math.abs(s), 0) / factorScores.length;

  let confidence = Math.min(100, Math.max(30, Math.round(
    50 + (Math.abs(normalizedScore) * 15) + (allSameDirection ? 15 : 0) + (avgMagnitude * 5)
  )));

  return {
    instrument,
    name: config.name,
    category: config.category,
    bias,
    score: parseFloat(normalizedScore.toFixed(2)),
    confidence,
    factors
  };
}

/**
 * Generate market context summary
 */
function generateMarketContext(marketData, newsSentiment, earnings) {
  const parts = [];

  // VIX context
  if (marketData.vix < 15) {
    parts.push('Low volatility environment');
  } else if (marketData.vix > 25) {
    parts.push('Elevated volatility, risk-off');
  }

  // Rate context
  if (marketData.znChange > 0.2) {
    parts.push('yields falling');
  } else if (marketData.znChange < -0.2) {
    parts.push('yields rising');
  }

  // Dollar context
  if (Math.abs(marketData.dxyChange) > 0.3) {
    parts.push(marketData.dxyChange > 0 ? 'dollar strength' : 'dollar weakness');
  }

  // Sector context
  if (marketData.sectors?.XLK?.isLeader) {
    parts.push('tech leading');
  }
  if (marketData.sectors?.XLE?.isLeader) {
    parts.push('energy leading');
  }

  // News context
  const highImpact = newsSentiment?.byImpact?.HIGH || 0;
  if (highImpact > 3) {
    parts.push(`${highImpact} high-impact stories`);
  }

  return parts.length > 0 ? parts.join(', ') + '.' : 'Normal market conditions.';
}

/**
 * Generate key risks
 */
function generateKeyRisks(marketData, newsSentiment, earnings, economicReleases = []) {
  const risks = [];

  // VIX risk
  if (marketData.vix > 20) {
    risks.push('Elevated VIX - expect volatility');
  }

  // Earnings risk
  if (earnings && earnings.length > 0) {
    const mag7Earnings = earnings.filter(e =>
      ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'].includes(e.company || e.symbol)
    );
    if (mag7Earnings.length > 0) {
      risks.push(`Mag7 earnings: ${mag7Earnings.map(e => e.company || e.symbol).join(', ')}`);
    }
  }

  // Economic release risk
  if (economicReleases && economicReleases.length > 0) {
    const highImpact = economicReleases.filter(r => {
      const name = (r.event || r.name || '').toLowerCase();
      return ['cpi', 'ppi', 'employment', 'jobs', 'gdp', 'fomc', 'fed'].some(kw => name.includes(kw));
    });
    if (highImpact.length > 0) {
      risks.push(`Data: ${highImpact.slice(0, 2).map(r => r.event || r.name).join(', ')}`);
    }
  }

  // Geopolitical risk
  const geoCount = newsSentiment?.byCategory?.Geopolitical || 0;
  if (geoCount >= 3) {
    risks.push('Heightened geopolitical risk');
  }

  // Fed risk
  const fedCount = newsSentiment?.byCategory?.Fed || 0;
  if (fedCount >= 2) {
    risks.push('Fed-related uncertainty');
  }

  // Default risks if none detected
  if (risks.length === 0) {
    risks.push('Monitor intraday data releases');
  }

  return risks.slice(0, 5);
}

/**
 * Main function: Generate final analysis
 */
export async function generateFinalAnalysis(marketData, options = {}) {
  const { forceRefresh = false } = options;
  const now = Date.now();

  // Check cache
  if (!forceRefresh && finalAnalysisCache && finalAnalysisCacheTime &&
      (now - finalAnalysisCacheTime) < FINAL_ANALYSIS_CACHE_DURATION) {
    console.log('Returning cached final analysis');
    return finalAnalysisCache;
  }

  console.log('Generating final analysis...');

  // Fetch news sentiment (last 1 hour)
  const newsSentiment = await getNewsSentimentSummary({ lastHours: 1 });

  // Fetch all news items (last 2 hours for popup detail)
  let allNews = [];
  try {
    allNews = await analyzeAllSourcesNews({ lastHours: 2 });
  } catch (err) {
    console.warn('Could not fetch all news:', err.message);
  }

  // Fetch earnings calendar
  let earnings = [];
  try {
    earnings = await fetchEarningsCalendar();
  } catch (err) {
    console.warn('Could not fetch earnings:', err.message);
  }

  // Fetch economic calendar
  let economicReleases = [];
  try {
    economicReleases = await fetchEconomicCalendar();
  } catch (err) {
    console.warn('Could not fetch economic calendar:', err.message);
  }

  // Fetch energy reports (for CL)
  let energyReports = [];
  try {
    energyReports = fetchEnergyReports();
  } catch (err) {
    console.warn('Could not fetch energy reports:', err.message);
  }

  // Fetch central bank calendar
  let centralBankEvents = [];
  try {
    centralBankEvents = fetchCentralBankCalendar();
  } catch (err) {
    console.warn('Could not fetch central bank calendar:', err.message);
  }

  // Get today's and upcoming reports
  const todayReports = energyReports.filter(r => r.isToday);
  const upcomingReports = energyReports.filter(r => r.isTomorrow).slice(0, 3);
  const nextFOMC = centralBankEvents.find(e => e.shortName === 'FOMC');

  // Fetch technical analysis for all instruments
  let technicals = {};
  try {
    const symbols = ['ES', 'NQ', 'YM', 'RTY', 'GC', 'CL'];
    const techPromises = symbols.map(async (symbol) => {
      const yahooSymbol = YAHOO_SYMBOLS[symbol];
      if (yahooSymbol) {
        const tech = await analyzeTechnicals(yahooSymbol);
        return { symbol, tech };
      }
      return { symbol, tech: null };
    });
    const techResults = await Promise.all(techPromises);
    techResults.forEach(({ symbol, tech }) => {
      technicals[symbol] = tech;
    });
    console.log('Technical analysis fetched for all instruments');
  } catch (err) {
    console.warn('Could not fetch technical analysis:', err.message);
  }

  // Calculate bias for each instrument
  const esResult = calculateESBias(marketData, newsSentiment);
  const nqResult = calculateNQBias(marketData, newsSentiment, esResult);
  const ymResult = calculateYMBias(marketData, newsSentiment, esResult);
  const rtyResult = calculateRTYBias(marketData, newsSentiment, esResult);
  const gcResult = calculateGCBias(marketData, newsSentiment);
  const clResult = calculateCLBias(marketData, newsSentiment);

  // Build detailed popup data for each instrument
  const instrumentDetails = buildInstrumentDetails(
    { ES: esResult, NQ: nqResult, YM: ymResult, RTY: rtyResult, GC: gcResult, CL: clResult },
    marketData,
    allNews,
    earnings,
    economicReleases,
    { energyReports: todayReports, upcomingReports, nextFOMC },
    technicals
  );

  // Find trending instruments beyond the main 6
  const trendingInstruments = findTrendingInstruments(
    allNews,
    { energyReports: todayReports, upcomingReports, nextFOMC },
    marketData
  );

  // Build final response
  const result = {
    timestamp: new Date().toISOString(),
    newsAnalyzed: newsSentiment.total,
    timeframe: 'Last 1 hour',
    instruments: {
      ES: { ...esResult, details: instrumentDetails.ES },
      NQ: { ...nqResult, details: instrumentDetails.NQ },
      YM: { ...ymResult, details: instrumentDetails.YM },
      RTY: { ...rtyResult, details: instrumentDetails.RTY },
      GC: { ...gcResult, details: instrumentDetails.GC },
      CL: { ...clResult, details: instrumentDetails.CL }
    },
    trendingInstruments, // NEW: Other instruments with news/report catalysts
    marketContext: generateMarketContext(marketData, newsSentiment, earnings),
    keyRisks: generateKeyRisks(marketData, newsSentiment, earnings, economicReleases),
    newsSummary: {
      total: newsSentiment.total,
      highImpact: newsSentiment.byImpact.HIGH,
      bullish: newsSentiment.byBias.bullish,
      bearish: newsSentiment.byBias.bearish,
      topNews: newsSentiment.topNews
    },
    earningsToday: earnings.slice(0, 5),
    economicReleases: economicReleases.slice(0, 5),
    energyReportsToday: todayReports,
    upcomingReports: upcomingReports,
    nextFOMC: nextFOMC ? {
      date: nextFOMC.date,
      dateLabel: nextFOMC.dateLabel,
      pressConference: nextFOMC.pressConference
    } : null,
    marketData: {
      vix: marketData.vix,
      vixChange: marketData.vixChange,
      znChange: marketData.znChange,
      dxyChange: marketData.dxyChange,
      mag7Green: Object.values(marketData.mag7 || {}).filter(s => (s.changePercent || 0) > 0).length,
      mag7Details: buildMag7Details(marketData.mag7),
      sectorLeaders: buildSectorLeaders(marketData.sectors)
    }
  };

  // Cache result
  finalAnalysisCache = result;
  finalAnalysisCacheTime = now;

  console.log('Final analysis generated');
  return result;
}

/**
 * Build detailed popup data for each instrument
 */
function buildInstrumentDetails(results, marketData, allNews, earnings, economicReleases, reports, technicals = {}) {
  const details = {};

  // News keywords for each instrument
  const NEWS_KEYWORDS = {
    ES: ['S&P', 'SPX', 'SPY', 'ES', 'stock market', 'equities', 'Fed', 'economy', 'inflation', 'employment', 'GDP', 'retail'],
    NQ: ['Nasdaq', 'tech', 'technology', 'AAPL', 'NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AI', 'semiconductor', 'software', 'QQQ'],
    YM: ['Dow', 'DJIA', 'industrial', 'manufacturing', 'blue chip', 'JPM', 'GS', 'BA', 'CAT', 'HD'],
    RTY: ['Russell', 'small cap', 'regional bank', 'IWM', 'small business', 'domestic'],
    GC: ['gold', 'precious metal', 'safe haven', 'inflation hedge', 'central bank buying', 'jewelry', 'GLD'],
    CL: ['oil', 'crude', 'WTI', 'Brent', 'OPEC', 'energy', 'gasoline', 'refinery', 'drilling', 'EIA', 'petroleum', 'inventory']
  };

  // Relevant sectors for each instrument
  const INSTRUMENT_SECTORS = {
    ES: ['XLF', 'XLK', 'XLV', 'XLE', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC'],
    NQ: ['XLK', 'XLC'],
    YM: ['XLF', 'XLI', 'XLV'],
    RTY: ['XLF', 'XLI', 'XLRE'],
    GC: [],
    CL: ['XLE']
  };

  // Build details for each instrument
  for (const [symbol, result] of Object.entries(results)) {
    const keywords = NEWS_KEYWORDS[symbol] || [];

    // Filter relevant news for this instrument
    const relevantNews = allNews.filter(news => {
      const text = (news.headline || news.title || '').toLowerCase();
      const symbolMatch = news.symbols?.includes(symbol);
      const keywordMatch = keywords.some(kw => text.includes(kw.toLowerCase()));
      return symbolMatch || keywordMatch;
    }).slice(0, 10);

    // Filter relevant earnings (for equity indices)
    const relevantEarnings = ['ES', 'NQ', 'YM', 'RTY'].includes(symbol) ? earnings.slice(0, 5) : [];

    // Filter relevant economic releases
    const relevantReleases = economicReleases.filter(release => {
      const name = (release.event || release.name || '').toLowerCase();
      if (symbol === 'ES' || symbol === 'NQ' || symbol === 'YM') {
        return ['gdp', 'employment', 'jobs', 'cpi', 'ppi', 'retail', 'fed', 'fomc', 'pce'].some(kw => name.includes(kw));
      }
      if (symbol === 'RTY') {
        return ['employment', 'small business', 'regional', 'fed'].some(kw => name.includes(kw));
      }
      if (symbol === 'GC') {
        return ['cpi', 'inflation', 'fed', 'fomc', 'gold', 'central bank'].some(kw => name.includes(kw));
      }
      if (symbol === 'CL') {
        return ['oil', 'energy', 'eia', 'opec', 'inventory', 'petroleum'].some(kw => name.includes(kw));
      }
      return false;
    }).slice(0, 5);

    // Build factor explanations with more detail
    const factorExplanations = buildFactorExplanations(result.factors, symbol, marketData);

    // Get OPEC reports for CL
    const opecReports = symbol === 'CL' ? reports.energyReports : [];

    // Get relevant sectors for this instrument
    const relevantSectorSymbols = INSTRUMENT_SECTORS[symbol] || [];
    const relevantSectors = relevantSectorSymbols
      .map(sectorSymbol => {
        const sector = marketData.sectors?.[sectorSymbol];
        if (sector) {
          return {
            symbol: sectorSymbol,
            name: sector.name || sectorSymbol,
            changePercent: sector.changePercent || 0,
            isLeader: sector.isLeader || false,
            isLaggard: sector.isLaggard || false
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.changePercent - a.changePercent);

    // Get technical analysis for this instrument
    const techData = technicals[symbol];
    const technicalAnalysis = techData?.available ? {
      currentPrice: techData.currentPrice,
      ema9: techData.ema?.ema9,
      ema21: techData.ema?.ema21,
      ema50: techData.ema?.ema50,
      emaTrend: techData.ema?.trend,
      emaSignal: techData.ema?.signal,
      priceVsEma9: techData.ema?.priceVsEma9,
      priceVsEma21: techData.ema?.priceVsEma21,
      priceVsEma50: techData.ema?.priceVsEma50,
      adx: techData.adx?.value,
      adxStrength: techData.adx?.strength,
      adxDirection: techData.adx?.direction,
      diPlus: techData.adx?.diPlus,
      diMinus: techData.adx?.diMinus,
      summary: techData.summary
    } : null;

    // Build sentiment summary (3-4 lines)
    const sentimentSummary = buildSentimentSummary(symbol, result, marketData, relevantNews, relevantSectors, techData);

    details[symbol] = {
      sentimentSummary,
      factorExplanations,
      relevantSectors,
      technicalAnalysis,
      relevantNews: relevantNews.map(n => ({
        headline: n.headline || n.title,
        source: n.source,
        bias: n.bias,
        impact: n.impact,
        timestamp: n.timestamp,
        summary: n.summary
      })),
      relevantEarnings: relevantEarnings.map(e => ({
        company: e.company || e.symbol,
        estimate: e.estimate,
        time: e.time || 'TBD'
      })),
      relevantReleases: relevantReleases.map(r => ({
        event: r.event || r.name,
        time: r.time,
        previous: r.previous,
        forecast: r.forecast
      })),
      opecReports: opecReports.map(r => ({
        name: r.name,
        shortName: r.shortName,
        time: r.time,
        description: r.description,
        scenarios: r.scenarios
      })),
      upcomingCatalysts: buildUpcomingCatalysts(symbol, reports, economicReleases)
    };
  }

  return details;
}

/**
 * Build a 3-4 line sentiment summary for the instrument
 */
function buildSentimentSummary(symbol, result, marketData, relevantNews, relevantSectors, techData) {
  const lines = [];
  const { bias, confidence, factors } = result;

  // Line 1: Overall bias statement
  const biasDescription = {
    'BULLISH': 'showing strong bullish momentum',
    'SLIGHT BULLISH': 'leaning bullish with moderate conviction',
    'NEUTRAL': 'in a neutral stance with mixed signals',
    'SLIGHT BEARISH': 'leaning bearish with some caution',
    'BEARISH': 'showing strong bearish pressure'
  };
  lines.push(`${INSTRUMENT_CONFIG[symbol]?.name || symbol} is ${biasDescription[bias] || 'neutral'} with ${confidence}% confidence.`);

  // Line 2: Key drivers
  const keyDrivers = [];
  if (factors.VIX?.score > 0) keyDrivers.push('low VIX supporting risk appetite');
  if (factors.VIX?.score < 0) keyDrivers.push('elevated VIX signaling caution');
  if (factors.ZN?.score > 0) keyDrivers.push('falling yields');
  if (factors.ZN?.score < 0) keyDrivers.push('rising yields');
  if (factors.DXY?.score > 0) keyDrivers.push('dollar weakness');
  if (factors.DXY?.score < 0) keyDrivers.push('dollar strength');
  if (factors.Mag7?.score > 0) keyDrivers.push('tech leadership');
  if (factors.Mag7?.score < 0) keyDrivers.push('tech weakness');
  if (factors.News?.score > 0) keyDrivers.push('positive news flow');
  if (factors.News?.score < 0) keyDrivers.push('negative headlines');

  if (keyDrivers.length > 0) {
    lines.push(`Key drivers: ${keyDrivers.slice(0, 3).join(', ')}.`);
  }

  // Line 3: Sector performance (if applicable)
  if (relevantSectors && relevantSectors.length > 0) {
    const leaders = relevantSectors.filter(s => s.changePercent > 0.3);
    const laggards = relevantSectors.filter(s => s.changePercent < -0.3);

    if (leaders.length > 0) {
      lines.push(`Sector strength: ${leaders.slice(0, 2).map(s => `${s.name} (+${s.changePercent.toFixed(1)}%)`).join(', ')}.`);
    } else if (laggards.length > 0) {
      lines.push(`Sector weakness: ${laggards.slice(0, 2).map(s => `${s.name} (${s.changePercent.toFixed(1)}%)`).join(', ')}.`);
    }
  }

  // Line 4: Technical confirmation or divergence
  if (techData?.available) {
    const techBias = techData.ema?.signal > 0 ? 'bullish' : techData.ema?.signal < 0 ? 'bearish' : 'neutral';
    const fundamentalBias = bias.toLowerCase().includes('bullish') ? 'bullish' : bias.toLowerCase().includes('bearish') ? 'bearish' : 'neutral';

    if (techBias === fundamentalBias) {
      lines.push(`Technicals confirm: price ${techData.ema?.trend?.toLowerCase() || 'neutral'}, ADX at ${techData.adx?.value || 'N/A'} (${techData.adx?.strength || 'weak'} trend).`);
    } else {
      lines.push(`Technical divergence: price ${techData.ema?.trend?.toLowerCase() || 'neutral'} vs ${fundamentalBias} fundamentals. Watch for resolution.`);
    }
  }

  // Line 5: News summary if significant
  if (relevantNews && relevantNews.length > 0) {
    const bullishNews = relevantNews.filter(n => n.bias === 'bullish').length;
    const bearishNews = relevantNews.filter(n => n.bias === 'bearish').length;
    const highImpact = relevantNews.filter(n => n.impact === 'HIGH').length;

    if (highImpact > 0 || relevantNews.length >= 3) {
      lines.push(`News flow: ${relevantNews.length} stories (${bullishNews} bullish, ${bearishNews} bearish${highImpact > 0 ? `, ${highImpact} high-impact` : ''}).`);
    }
  }

  return lines.slice(0, 4).join(' ');
}

/**
 * Build detailed factor explanations
 */
function buildFactorExplanations(factors, symbol, marketData) {
  const explanations = {};

  for (const [key, factor] of Object.entries(factors)) {
    let explanation = '';
    let interpretation = '';

    switch (key) {
      case 'VIX':
        explanation = `VIX at ${marketData.vix?.toFixed(2) || 'N/A'} (${marketData.vixChange > 0 ? '+' : ''}${marketData.vixChange?.toFixed(2) || 0}%)`;
        if (marketData.vix < 15) {
          interpretation = 'Low volatility indicates market complacency. Favorable for risk assets.';
        } else if (marketData.vix < 20) {
          interpretation = 'Normal volatility. Market conditions are stable.';
        } else if (marketData.vix < 25) {
          interpretation = 'Elevated volatility suggests caution. Expect larger price swings.';
        } else {
          interpretation = 'High fear levels. Risk-off environment favors safe havens.';
        }
        break;

      case 'ZN':
        explanation = `10-Year Note change: ${marketData.znChange > 0 ? '+' : ''}${marketData.znChange?.toFixed(3) || 0}%`;
        if (marketData.znChange > 0.15) {
          interpretation = 'Bond prices rising (yields falling). Supportive for equities and growth stocks.';
        } else if (marketData.znChange < -0.15) {
          interpretation = 'Bond prices falling (yields rising). Pressure on rate-sensitive sectors.';
        } else {
          interpretation = 'Yields relatively stable. Neutral impact on equities.';
        }
        break;

      case 'DXY':
        explanation = `Dollar Index change: ${marketData.dxyChange > 0 ? '+' : ''}${marketData.dxyChange?.toFixed(2) || 0}%`;
        if (symbol === 'GC' || symbol === 'CL') {
          if (marketData.dxyChange > 0.2) {
            interpretation = 'Strong dollar is bearish for commodities priced in USD.';
          } else if (marketData.dxyChange < -0.2) {
            interpretation = 'Weak dollar supports commodity prices.';
          } else {
            interpretation = 'Dollar stable, neutral impact on commodities.';
          }
        } else {
          if (marketData.dxyChange > 0.3) {
            interpretation = 'Strong dollar may pressure multinational earnings.';
          } else if (marketData.dxyChange < -0.3) {
            interpretation = 'Weak dollar supportive for exporters and multinationals.';
          } else {
            interpretation = 'Dollar stability is neutral for equities.';
          }
        }
        break;

      case 'Mag7':
        const mag7Green = Object.values(marketData.mag7 || {}).filter(s => (s.changePercent || 0) > 0).length;
        explanation = `Magnificent 7: ${mag7Green}/7 stocks positive`;
        if (mag7Green >= 5) {
          interpretation = 'Tech leadership strong. Bullish for growth and NQ.';
        } else if (mag7Green <= 2) {
          interpretation = 'Tech weakness may drag on broader indices.';
        } else {
          interpretation = 'Mixed Mag7 performance indicates rotation or indecision.';
        }
        break;

      case 'News':
      case 'TechNews':
      case 'EnergyNews':
      case 'GeoNews':
        explanation = `${factor.total || 0} relevant articles analyzed`;
        if (factor.score > 0) {
          interpretation = `News sentiment positive with ${factor.bullish || 0} bullish headlines.`;
        } else if (factor.score < 0) {
          interpretation = `News sentiment negative with ${factor.bearish || 0} bearish headlines.`;
        } else {
          interpretation = 'News sentiment is balanced/neutral.';
        }
        break;

      case 'Tech':
        explanation = `Technology sector (XLK): ${factor.value > 0 ? '+' : ''}${factor.value?.toFixed(2) || 0}%`;
        if (factor.value > 0.5) {
          interpretation = 'Tech sector rallying. Bullish for NQ.';
        } else if (factor.value < -0.5) {
          interpretation = 'Tech sector selling off. Bearish for NQ.';
        } else {
          interpretation = 'Tech sector range-bound.';
        }
        break;

      case 'Energy':
        explanation = `Energy sector (XLE): ${factor.value > 0 ? '+' : ''}${factor.value?.toFixed(2) || 0}%`;
        if (factor.value > 0.5) {
          interpretation = 'Energy stocks strong. Supportive for oil prices.';
        } else if (factor.value < -0.5) {
          interpretation = 'Energy stocks weak. May indicate demand concerns.';
        } else {
          interpretation = 'Energy sector stable.';
        }
        break;

      case 'ES':
        explanation = `Correlated with ES bias: ${factor.reason}`;
        interpretation = `Dow typically follows S&P direction with some divergence on industrial/financial news.`;
        break;

      case 'Industrial':
        explanation = factor.reason || 'Industrial sector performance';
        interpretation = 'Industrial activity signals economic health.';
        break;

      case 'RegionalBank':
        explanation = factor.reason || 'Regional bank and small cap sentiment';
        interpretation = 'Small caps are sensitive to regional economic conditions and rate changes.';
        break;

      default:
        explanation = factor.reason || `${key} analysis`;
        interpretation = '';
    }

    explanations[key] = {
      ...factor,
      explanation,
      interpretation,
      weight: INSTRUMENT_CONFIG[symbol]?.factors?.[key] || 0.2
    };
  }

  return explanations;
}

/**
 * Build upcoming catalysts for an instrument
 */
function buildUpcomingCatalysts(symbol, reports, economicReleases) {
  const catalysts = [];

  // Add FOMC if upcoming
  if (reports.nextFOMC) {
    catalysts.push({
      type: 'central_bank',
      name: 'FOMC Meeting',
      date: reports.nextFOMC.dateLabel,
      impact: 'HIGH',
      description: 'Federal Reserve interest rate decision'
    });
  }

  // Add OPEC for CL
  if (symbol === 'CL' && reports.upcomingReports?.length > 0) {
    for (const report of reports.upcomingReports) {
      if (report.shortName?.includes('OPEC') || report.shortName?.includes('EIA')) {
        catalysts.push({
          type: 'report',
          name: report.shortName,
          date: report.dateLabel,
          impact: report.importance,
          description: report.description
        });
      }
    }
  }

  // Add relevant economic releases
  const relevantReleases = economicReleases.filter(r => {
    const name = (r.event || r.name || '').toLowerCase();
    if (['ES', 'NQ', 'YM', 'RTY'].includes(symbol)) {
      return ['cpi', 'ppi', 'employment', 'gdp', 'retail'].some(kw => name.includes(kw));
    }
    if (symbol === 'GC') {
      return ['cpi', 'inflation'].some(kw => name.includes(kw));
    }
    if (symbol === 'CL') {
      return ['eia', 'oil', 'inventory'].some(kw => name.includes(kw));
    }
    return false;
  }).slice(0, 3);

  for (const release of relevantReleases) {
    catalysts.push({
      type: 'economic',
      name: release.event || release.name,
      date: release.date || 'Upcoming',
      impact: 'MEDIUM',
      description: `Previous: ${release.previous || 'N/A'}, Forecast: ${release.forecast || 'N/A'}`
    });
  }

  return catalysts.slice(0, 5);
}

/**
 * Find trending instruments based on news, reports, and market activity
 */
export function findTrendingInstruments(allNews, reports, marketData) {
  const trending = [];

  // Extended instrument list beyond the main 6
  const EXTENDED_INSTRUMENTS = {
    'NG': { name: 'Natural Gas', category: 'Energy', keywords: ['natural gas', 'lng', 'gas storage', 'heating'] },
    'SI': { name: 'Silver', category: 'Precious Metal', keywords: ['silver', 'precious metal'] },
    'HG': { name: 'Copper', category: 'Base Metal', keywords: ['copper', 'industrial metal', 'china demand'] },
    'ZC': { name: 'Corn', category: 'Agriculture', keywords: ['corn', 'grain', 'ethanol', 'usda'] },
    'ZS': { name: 'Soybeans', category: 'Agriculture', keywords: ['soybean', 'soy', 'china', 'usda'] },
    'ZW': { name: 'Wheat', category: 'Agriculture', keywords: ['wheat', 'grain', 'russia', 'ukraine', 'export'] },
    'KC': { name: 'Coffee', category: 'Soft Commodity', keywords: ['coffee', 'brazil', 'arabica'] },
    'CT': { name: 'Cotton', category: 'Soft Commodity', keywords: ['cotton', 'textile'] },
    'LE': { name: 'Live Cattle', category: 'Livestock', keywords: ['cattle', 'beef', 'livestock'] },
    'HE': { name: 'Lean Hogs', category: 'Livestock', keywords: ['hog', 'pork', 'livestock'] },
    'BTC': { name: 'Bitcoin', category: 'Crypto', keywords: ['bitcoin', 'btc', 'crypto', 'digital asset', 'sec'] },
    'ETH': { name: 'Ethereum', category: 'Crypto', keywords: ['ethereum', 'eth', 'crypto', 'defi'] },
    '6E': { name: 'Euro FX', category: 'Currency', keywords: ['euro', 'ecb', 'eurozone', 'eur/usd'] },
    '6J': { name: 'Japanese Yen', category: 'Currency', keywords: ['yen', 'boj', 'japan', 'usd/jpy'] },
    '6B': { name: 'British Pound', category: 'Currency', keywords: ['pound', 'sterling', 'boe', 'uk', 'gbp'] }
  };

  // Check news for mentions of extended instruments
  for (const [symbol, config] of Object.entries(EXTENDED_INSTRUMENTS)) {
    const relevantNews = allNews.filter(news => {
      const text = (news.headline || news.title || '').toLowerCase();
      return config.keywords.some(kw => text.includes(kw.toLowerCase()));
    });

    if (relevantNews.length >= 2) {
      // Calculate sentiment
      const bullishCount = relevantNews.filter(n => n.bias === 'bullish').length;
      const bearishCount = relevantNews.filter(n => n.bias === 'bearish').length;
      const highImpact = relevantNews.filter(n => n.impact === 'HIGH').length;

      let sentiment = 'neutral';
      if (bullishCount > bearishCount) sentiment = 'bullish';
      if (bearishCount > bullishCount) sentiment = 'bearish';

      trending.push({
        symbol,
        name: config.name,
        category: config.category,
        newsCount: relevantNews.length,
        highImpactCount: highImpact,
        sentiment,
        bullishNews: bullishCount,
        bearishNews: bearishCount,
        topHeadlines: relevantNews.slice(0, 3).map(n => ({
          headline: n.headline || n.title,
          source: n.source,
          bias: n.bias,
          impact: n.impact
        })),
        reason: `${relevantNews.length} news mentions${highImpact > 0 ? `, ${highImpact} high-impact` : ''}`
      });
    }
  }

  // Check reports for additional trending items
  const todayReports = reports.energyReports?.filter(r => r.isToday) || [];
  const upcomingReports = reports.upcomingReports || [];

  // Natural Gas - EIA report
  const ngReports = [...todayReports, ...upcomingReports].filter(r =>
    r.shortName?.toLowerCase().includes('nat gas') || r.affectedInstruments?.includes('NG')
  );
  if (ngReports.length > 0 && !trending.find(t => t.symbol === 'NG')) {
    trending.push({
      symbol: 'NG',
      name: 'Natural Gas',
      category: 'Energy',
      newsCount: 0,
      highImpactCount: ngReports.length,
      sentiment: 'neutral',
      reason: `${ngReports[0].shortName} ${ngReports[0].isToday ? 'today' : 'upcoming'}`,
      reportDriven: true,
      report: ngReports[0]
    });
  }

  // Agriculture - USDA reports
  const agReports = [...todayReports, ...upcomingReports].filter(r =>
    r.category === 'agriculture' || r.shortName?.toLowerCase().includes('usda')
  );
  if (agReports.length > 0) {
    const affectedAg = ['ZC', 'ZS', 'ZW'].filter(s => !trending.find(t => t.symbol === s));
    for (const symbol of affectedAg.slice(0, 2)) {
      const config = EXTENDED_INSTRUMENTS[symbol];
      if (config) {
        trending.push({
          symbol,
          name: config.name,
          category: config.category,
          newsCount: 0,
          highImpactCount: 1,
          sentiment: 'neutral',
          reason: `${agReports[0].shortName} ${agReports[0].isToday ? 'today' : 'upcoming'}`,
          reportDriven: true,
          report: agReports[0]
        });
      }
    }
  }

  // Sort by news count + high impact
  trending.sort((a, b) => (b.newsCount + b.highImpactCount * 2) - (a.newsCount + a.highImpactCount * 2));

  return trending.slice(0, 5); // Return top 5 trending
}

/**
 * Build Mag7 stock details
 */
function buildMag7Details(mag7Data) {
  if (!mag7Data || Object.keys(mag7Data).length === 0) {
    return [];
  }

  return Object.entries(mag7Data).map(([symbol, data]) => ({
    symbol,
    price: data.price,
    change: data.change,
    changePercent: data.changePercent,
    isPositive: (data.changePercent || 0) > 0
  })).sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
}

/**
 * Build sector leaders/laggards
 */
function buildSectorLeaders(sectorData) {
  if (!sectorData || Object.keys(sectorData).length === 0) {
    return { leaders: [], laggards: [] };
  }

  const sectors = Object.entries(sectorData)
    .map(([symbol, data]) => ({
      symbol,
      name: data.name,
      changePercent: data.changePercent || 0
    }))
    .sort((a, b) => b.changePercent - a.changePercent);

  return {
    leaders: sectors.slice(0, 3),
    laggards: sectors.slice(-3).reverse()
  };
}

/**
 * Generate Claude AI synthesis (optional enhanced analysis)
 */
export async function generateAISynthesis(finalAnalysis) {
  const client = getAnthropicClient();
  if (!client) {
    return null;
  }

  try {
    const prompt = `You are an expert futures trader. Based on this market analysis, provide a 2-3 sentence trading insight.

Market Data:
- VIX: ${finalAnalysis.marketData.vix} (${finalAnalysis.marketData.vixChange > 0 ? '+' : ''}${finalAnalysis.marketData.vixChange}%)
- 10Y Note change: ${finalAnalysis.marketData.znChange}%
- DXY change: ${finalAnalysis.marketData.dxyChange}%
- Mag7: ${finalAnalysis.marketData.mag7Green}/7 green

Biases:
- ES: ${finalAnalysis.instruments.ES.bias} (${finalAnalysis.instruments.ES.confidence}%)
- NQ: ${finalAnalysis.instruments.NQ.bias} (${finalAnalysis.instruments.NQ.confidence}%)
- GC: ${finalAnalysis.instruments.GC.bias} (${finalAnalysis.instruments.GC.confidence}%)
- CL: ${finalAnalysis.instruments.CL.bias} (${finalAnalysis.instruments.CL.confidence}%)

News: ${finalAnalysis.newsAnalyzed} articles, ${finalAnalysis.newsSummary.highImpact} high-impact

Provide a concise, actionable insight focusing on the strongest signal. No disclaimers.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0]?.text || null;
  } catch (error) {
    console.error('AI synthesis error:', error.message);
    return null;
  }
}

/**
 * Clear final analysis cache
 */
export function clearFinalAnalysisCache() {
  finalAnalysisCache = null;
  finalAnalysisCacheTime = null;
  console.log('Final analysis cache cleared');
}

/**
 * Get cache status
 */
export function getFinalAnalysisCacheStatus() {
  return {
    isCached: !!finalAnalysisCache,
    cacheAge: finalAnalysisCacheTime ? Date.now() - finalAnalysisCacheTime : null,
    maxAge: FINAL_ANALYSIS_CACHE_DURATION
  };
}

export default {
  generateFinalAnalysis,
  generateAISynthesis,
  clearFinalAnalysisCache,
  getFinalAnalysisCacheStatus
};
