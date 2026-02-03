/**
 * Final Analysis Service
 * Generates comprehensive bias analysis for 6 instruments (ES, NQ, YM, RTY, GC, CL)
 * Combines all market data: news, VIX, ZN, DXY, sectors, Mag7, earnings
 */

import Anthropic from '@anthropic-ai/sdk';
import { analyzeAllSourcesNews, getNewsSentimentSummary } from './newsAnalysis.js';
import { fetchEarningsCalendar } from './alphaVantage.js';

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
function generateKeyRisks(marketData, newsSentiment, earnings, economicCalendar) {
  const risks = [];

  // VIX risk
  if (marketData.vix > 20) {
    risks.push('Elevated VIX - expect volatility');
  }

  // Earnings risk
  if (earnings && earnings.length > 0) {
    const mag7Earnings = earnings.filter(e =>
      ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'].includes(e.company)
    );
    if (mag7Earnings.length > 0) {
      risks.push(`Mag7 earnings: ${mag7Earnings.map(e => e.company).join(', ')}`);
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

  return risks.slice(0, 4);
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

  // Fetch earnings calendar
  let earnings = [];
  try {
    earnings = await fetchEarningsCalendar();
  } catch (err) {
    console.warn('Could not fetch earnings:', err.message);
  }

  // Calculate bias for each instrument
  const esResult = calculateESBias(marketData, newsSentiment);
  const nqResult = calculateNQBias(marketData, newsSentiment, esResult);
  const ymResult = calculateYMBias(marketData, newsSentiment, esResult);
  const rtyResult = calculateRTYBias(marketData, newsSentiment, esResult);
  const gcResult = calculateGCBias(marketData, newsSentiment);
  const clResult = calculateCLBias(marketData, newsSentiment);

  // Build final response
  const result = {
    timestamp: new Date().toISOString(),
    newsAnalyzed: newsSentiment.total,
    timeframe: 'Last 1 hour',
    instruments: {
      ES: esResult,
      NQ: nqResult,
      YM: ymResult,
      RTY: rtyResult,
      GC: gcResult,
      CL: clResult
    },
    marketContext: generateMarketContext(marketData, newsSentiment, earnings),
    keyRisks: generateKeyRisks(marketData, newsSentiment, earnings),
    newsSummary: {
      total: newsSentiment.total,
      highImpact: newsSentiment.byImpact.HIGH,
      bullish: newsSentiment.byBias.bullish,
      bearish: newsSentiment.byBias.bearish,
      topNews: newsSentiment.topNews
    },
    earningsToday: earnings.slice(0, 5),
    marketData: {
      vix: marketData.vix,
      vixChange: marketData.vixChange,
      znChange: marketData.znChange,
      dxyChange: marketData.dxyChange,
      mag7Green: Object.values(marketData.mag7 || {}).filter(s => (s.changePercent || 0) > 0).length
    }
  };

  // Cache result
  finalAnalysisCache = result;
  finalAnalysisCacheTime = now;

  console.log('Final analysis generated');
  return result;
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
