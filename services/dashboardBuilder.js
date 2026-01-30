// Dashboard Builder - Combines all API data into final response

import { calculateBias, calculateDXYStrength } from './yahooFinance.js';
import { analyzeFredConditions } from './fred.js';
import { getNewsForInstrument } from './finnhubNews.js';

export function buildDashboardResponse(futuresData, economicData, fredData, polygonData, currencyData, internationalData, newsData, sectorData, mag7Data, mag7NewsData, treasuryYieldsData, cryptoData, expectationMeters) {
  const now = new Date();
  const vixLevel = futuresData?.VIX?.price || 15;

  // Build instruments object with bias analysis
  const instruments = buildInstruments(futuresData, vixLevel, fredData);

  // Build instruments grouped by sector
  const instrumentsBySector = buildInstrumentsBySector(futuresData, vixLevel, fredData);

  // Build currency instruments
  const currencies = buildCurrencyInstruments(currencyData || {});

  // Build international indices
  const internationalIndices = buildInternationalIndices(internationalData || {});

  // Build sector data
  const sectors = buildSectorData(sectorData || {});

  // Build Magnificent Seven data
  const magnificentSeven = buildMag7Data(mag7Data || {}, mag7NewsData || {});

  // Determine overall market bias
  const marketBias = calculateMarketBias(instruments, vixLevel, fredData);

  // Calculate DXY strength
  const dxyStrength = currencyData?.DX ? calculateDXYStrength(currencyData.DX.changePercent) : { level: 'Neutral', implication: 'No currency data' };

  // Generate narrative
  const narrative = generateNarrative(instruments, marketBias, economicData, fredData, vixLevel, currencies, internationalIndices);

  // Generate risk notes
  const riskNotes = generateRiskNotes(economicData, marketBias, vixLevel);

  // Get earnings (mock for now since Alpha Vantage earnings needs separate call)
  const earnings = generateEarningsFromContext(now);

  // Build VIX/Volatility data
  const volatility = buildVolatilityData(futuresData?.VIX);

  // Build Quick Stats
  const quickStats = buildQuickStats(treasuryYieldsData || {}, cryptoData || {}, currencies);

  // Build Fed Watch data
  const fedWatch = buildFedWatch();

  // Build Breaking News Ticker content
  const ticker = buildTickerContent(newsData || [], economicData || [], fedWatch);

  // Enhance macro events with dates and scenarios
  const enhancedMacroEvents = enhanceMacroEvents(economicData || []);

  // Enhance news with "Why It Matters" analysis
  const enhancedNews = enhanceNewsWithAnalysis(newsData || []);

  return {
    date: now.toISOString().split('T')[0],
    lastUpdate: now.toISOString(),
    macroEvents: enhancedMacroEvents,
    earnings: earnings,
    marketBias: marketBias,
    instruments: instruments,
    instrumentsBySector: instrumentsBySector,
    currencies: currencies,
    dxyStrength: dxyStrength,
    internationalIndices: internationalIndices,
    sectors: sectors,
    magnificentSeven: magnificentSeven,
    volatility: volatility,
    news: enhancedNews,
    narrative: narrative,
    riskNotes: riskNotes,
    expectationMeters: expectationMeters || {},
    quickStats: quickStats,
    fedWatch: fedWatch,
    ticker: ticker
  };
}

function buildInstruments(futuresData, vixLevel, fredData) {
  const instruments = {};
  const fredConditions = analyzeFredConditions(fredData);

  // Instrument-specific reason generators
  const reasonGenerators = {
    ES: (data, bias) => generateESReasons(data, bias, vixLevel, fredConditions),
    NQ: (data, bias) => generateNQReasons(data, bias, vixLevel, fredConditions),
    YM: (data, bias) => generateYMReasons(data, bias, vixLevel, fredConditions),
    RTY: (data, bias) => generateRTYReasons(data, bias, vixLevel, fredConditions),
    CL: (data, bias) => generateCLReasons(data, bias),
    GC: (data, bias) => generateGCReasons(data, bias, vixLevel, fredConditions),
    ZN: (data, bias) => generateZNReasons(data, bias, fredConditions)
  };

  const symbolOrder = ['ES', 'NQ', 'YM', 'RTY', 'CL', 'GC', 'ZN'];

  symbolOrder.forEach(symbol => {
    const data = futuresData[symbol];
    if (data) {
      const bias = calculateBias(data, vixLevel);
      const reasons = reasonGenerators[symbol]?.(data, bias) || ['Market conditions apply'];

      instruments[symbol] = {
        name: data.name,
        bias: bias,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        reasons: reasons
      };
    }
  });

  return instruments;
}

function calculateMarketBias(instruments, vixLevel, fredData) {
  // Count biases
  let bullishCount = 0;
  let bearishCount = 0;

  Object.values(instruments).forEach(inst => {
    if (inst.bias === 'Bullish') bullishCount++;
    if (inst.bias === 'Bearish') bearishCount++;
  });

  // Determine sentiment
  let sentiment = 'NEUTRAL';
  let confidence = 5;

  if (vixLevel > 25) {
    sentiment = 'RISK-OFF';
    confidence = 8;
  } else if (vixLevel > 20) {
    sentiment = 'RISK-OFF';
    confidence = 7;
  } else if (vixLevel < 14 && bullishCount > bearishCount) {
    sentiment = 'RISK-ON';
    confidence = 7;
  } else if (bearishCount > bullishCount + 2) {
    sentiment = 'RISK-OFF';
    confidence = 6;
  } else if (bullishCount > bearishCount + 2) {
    sentiment = 'RISK-ON';
    confidence = 6;
  }

  // Generate reason
  const reasons = [];
  if (vixLevel > 20) reasons.push(`VIX elevated at ${vixLevel.toFixed(1)}`);
  if (bearishCount > bullishCount) reasons.push(`${bearishCount} of 7 instruments bearish`);
  if (bullishCount > bearishCount) reasons.push(`${bullishCount} of 7 instruments bullish`);

  const fredConditions = analyzeFredConditions(fredData);
  if (fredConditions.yieldCurve === 'inverted') reasons.push('yield curve inverted');
  if (fredConditions.rateEnvironment === 'restrictive') reasons.push('restrictive rate environment');

  return {
    sentiment: sentiment,
    confidence: confidence,
    reason: reasons.join(', ') || 'Mixed market signals'
  };
}

function generateNarrative(instruments, marketBias, economicData, fredData, vixLevel, currencies, internationalIndices) {
  const parts = [];

  // Market sentiment opening
  if (marketBias.sentiment === 'RISK-OFF') {
    parts.push('Markets are showing risk-off behavior today.');
  } else if (marketBias.sentiment === 'RISK-ON') {
    parts.push('Risk appetite is elevated in today\'s session.');
  } else {
    parts.push('Markets are trading in a cautious, mixed fashion.');
  }

  // VIX commentary
  if (vixLevel > 20) {
    parts.push(`The VIX is elevated at ${vixLevel.toFixed(1)}, indicating heightened fear and hedging activity.`);
  } else if (vixLevel < 14) {
    parts.push(`Volatility remains subdued with VIX at ${vixLevel.toFixed(1)}, suggesting complacency.`);
  }

  // International indices commentary
  if (internationalIndices?.globalSentiment && internationalIndices.globalSentiment !== 'Neutral') {
    const sentiment = internationalIndices.globalSentiment === 'Risk-On' ? 'positive' : 'negative';
    parts.push(`Global markets are showing ${sentiment} momentum.`);
  }

  // Equity index commentary
  const es = instruments['ES'];
  const nq = instruments['NQ'];
  if (es && nq) {
    if (es.changePercent < -0.5 && nq.changePercent < -0.5) {
      parts.push(`Equity futures are under pressure with ES down ${Math.abs(es.changePercent).toFixed(2)}% and NQ down ${Math.abs(nq.changePercent).toFixed(2)}%.`);
    } else if (es.changePercent > 0.5 && nq.changePercent > 0.5) {
      parts.push(`Equity futures are rallying with ES up ${es.changePercent.toFixed(2)}% and NQ up ${nq.changePercent.toFixed(2)}%.`);
    }
  }

  // Dollar commentary
  const dx = currencies?.DX;
  if (dx) {
    if (dx.changePercent > 0.3) {
      parts.push(`The Dollar Index is firming, up ${dx.changePercent.toFixed(2)}%, creating headwinds for commodities.`);
    } else if (dx.changePercent < -0.3) {
      parts.push(`Dollar weakness (DXY down ${Math.abs(dx.changePercent).toFixed(2)}%) is providing a tailwind for risk assets.`);
    }
  }

  // Commodity commentary
  const cl = instruments['CL'];
  const gc = instruments['GC'];
  if (cl?.changePercent > 1) {
    parts.push(`Crude oil is catching a bid, up ${cl.changePercent.toFixed(2)}% on supply concerns.`);
  }
  if (gc?.changePercent > 0.5) {
    parts.push(`Gold is benefiting from safe-haven flows, up ${gc.changePercent.toFixed(2)}%.`);
  }

  // Add macro events context
  if (economicData && economicData.length > 0) {
    const highImportance = economicData.filter(e => e.importance === 'HIGH');
    if (highImportance.length > 0) {
      parts.push(`Key events today include ${highImportance.map(e => e.event).join(' and ')}.`);
    }
  }

  return parts.join(' ');
}

function generateRiskNotes(economicData, marketBias, vixLevel) {
  const notes = [];

  // Add economic events as risk notes
  if (economicData && economicData.length > 0) {
    economicData
      .filter(e => e.importance === 'HIGH')
      .forEach(e => {
        notes.push(`${e.event} at ${e.time} - potential market mover`);
      });
  }

  // VIX-based notes
  if (vixLevel > 20) {
    notes.push('Elevated VIX suggests increased volatility and potential for sharp moves');
  }

  // Time-based notes
  const hour = new Date().getHours();
  if (hour < 10) {
    notes.push('Pre-market session - watch for gap fills at open');
  }
  if (hour >= 15) {
    notes.push('Late session - watch for end-of-day positioning');
  }

  // Day of week notes
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 5) {
    notes.push('Friday session - potential for weekend positioning');
  }
  if (dayOfWeek === 1) {
    notes.push('Monday session - watch for gap risk from weekend news');
  }

  // Always add some general notes
  if (notes.length < 3) {
    notes.push('Monitor sector rotation for confirmation of bias');
    notes.push('Watch key support/resistance levels for breakout signals');
  }

  return notes.slice(0, 5); // Max 5 notes
}

function generateEarningsFromContext(date) {
  // This would ideally come from an earnings calendar API
  // For now, return contextually relevant companies based on the season
  const dayOfWeek = date.getDay();

  // Earnings are typically reported Tuesday-Thursday
  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    return [
      { company: 'Various', time: 'pre-market', affectedInstruments: ['ES', 'NQ'] },
    ];
  }

  return [];
}

// Instrument-specific reason generators
function generateESReasons(data, bias, vixLevel, fredConditions) {
  const reasons = [];

  if (data.changePercent < -0.5) reasons.push('Selling pressure in broad market');
  if (data.changePercent > 0.5) reasons.push('Broad market strength');
  if (vixLevel > 20) reasons.push('Elevated volatility weighing on sentiment');
  if (fredConditions.rateEnvironment === 'restrictive') reasons.push('Restrictive Fed policy');
  if (data.price < data.previousClose) reasons.push('Trading below prior close');

  return reasons.length > 0 ? reasons.slice(0, 3) : ['Tracking broader market conditions'];
}

function generateNQReasons(data, bias, vixLevel, fredConditions) {
  const reasons = [];

  if (data.changePercent < -0.5) reasons.push('Tech sector weakness');
  if (data.changePercent > 0.5) reasons.push('Tech sector leadership');
  if (fredConditions.rateEnvironment === 'restrictive') reasons.push('Growth stocks sensitive to rates');
  if (vixLevel > 18) reasons.push('Risk-off rotation from growth');

  return reasons.length > 0 ? reasons.slice(0, 3) : ['Tech sentiment in focus'];
}

function generateYMReasons(data, bias, vixLevel, fredConditions) {
  const reasons = [];

  if (Math.abs(data.changePercent) < 0.3) reasons.push('Value stocks holding steady');
  if (data.changePercent > 0) reasons.push('Defensive rotation supportive');
  if (data.changePercent < -0.3) reasons.push('Cyclical concerns');

  return reasons.length > 0 ? reasons.slice(0, 3) : ['Blue chip stability'];
}

function generateRTYReasons(data, bias, vixLevel, fredConditions) {
  const reasons = [];

  reasons.push('Small caps sensitive to rates');
  if (data.changePercent < -0.5) reasons.push('Risk-off hitting small caps');
  if (fredConditions.rateEnvironment === 'restrictive') reasons.push('Higher rates pressure on small caps');

  return reasons.slice(0, 3);
}

function generateCLReasons(data, bias) {
  const reasons = [];

  if (data.changePercent > 1) reasons.push('Supply concerns supporting prices');
  if (data.changePercent < -1) reasons.push('Demand concerns weighing');
  reasons.push('Geopolitical headlines in focus');
  reasons.push('Inventory data watch');

  return reasons.slice(0, 3);
}

function generateGCReasons(data, bias, vixLevel, fredConditions) {
  const reasons = [];

  if (vixLevel > 18) reasons.push('Safe haven demand');
  if (data.changePercent > 0.5) reasons.push('Flight to quality bid');
  if (fredConditions.rateEnvironment === 'restrictive') reasons.push('Real yield considerations');

  return reasons.length > 0 ? reasons.slice(0, 3) : ['Precious metals tracking risk sentiment'];
}

function generateZNReasons(data, bias, fredConditions) {
  const reasons = [];

  if (fredConditions.yieldCurve === 'inverted') reasons.push('Inverted yield curve');
  reasons.push('Fed policy expectations in focus');
  if (data.changePercent > 0) reasons.push('Flight to quality bid');
  if (data.changePercent < 0) reasons.push('Yields rising on growth optimism');

  return reasons.slice(0, 3);
}

// Currency instruments builder
function buildCurrencyInstruments(currencyData) {
  const currencies = {};
  const currencyOrder = ['DX', '6E', '6J', '6B', '6A'];

  currencyOrder.forEach(symbol => {
    const data = currencyData[symbol];
    if (data) {
      const reasons = generateCurrencyReasons(symbol, data);
      const relevantNews = getNewsForInstrument(symbol);
      const contextBlurb = generateCurrencyBlurb(symbol, data, relevantNews);

      currencies[symbol] = {
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        previousClose: data.previousClose,
        fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: data.fiftyTwoWeekLow,
        reasons: reasons,
        latestNews: relevantNews,
        contextBlurb: contextBlurb
      };
    }
  });

  return currencies;
}

function generateCurrencyReasons(symbol, data) {
  const reasons = [];

  switch (symbol) {
    case 'DX':
      if (data.changePercent > 0.3) reasons.push('Dollar strength on risk-off flows');
      if (data.changePercent < -0.3) reasons.push('Dollar weakness boosting risk assets');
      reasons.push('Fed policy expectations driving movement');
      if (data.changePercent > 0) reasons.push('Headwind for commodities');
      else reasons.push('Tailwind for commodities');
      break;
    case '6E':
      if (data.changePercent > 0.3) reasons.push('Euro strength on ECB outlook');
      if (data.changePercent < -0.3) reasons.push('Euro weakness on growth concerns');
      reasons.push('ECB-Fed policy divergence in focus');
      break;
    case '6J':
      if (data.changePercent > 0.3) reasons.push('Yen strength - risk-off signal');
      if (data.changePercent < -0.3) reasons.push('Yen weakness - carry trade active');
      reasons.push('BOJ policy stance key driver');
      break;
    case '6B':
      if (data.changePercent > 0.3) reasons.push('Sterling strength on BOE outlook');
      if (data.changePercent < -0.3) reasons.push('Sterling weakness on UK concerns');
      reasons.push('UK economic data in focus');
      break;
    case '6A':
      if (data.changePercent > 0.3) reasons.push('Aussie strength - risk-on signal');
      if (data.changePercent < -0.3) reasons.push('Aussie weakness - China concerns');
      reasons.push('Commodity currency tracking risk sentiment');
      break;
    default:
      reasons.push('Currency market conditions');
  }

  return reasons.slice(0, 3);
}

// Generate short context blurb for currencies
function generateCurrencyBlurb(symbol, data, newsItem) {
  const change = data.changePercent;
  const direction = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'flat';

  // If we have news, try to extract context from headline
  if (newsItem && newsItem.headline) {
    const headline = newsItem.headline.toLowerCase();

    // Check for specific themes in news
    if (headline.includes('fed') || headline.includes('fomc') || headline.includes('powell')) {
      return direction === 'up' ? 'Fed hawkish stance supportive' : 'Fed policy weighing on dollar';
    }
    if (headline.includes('ecb') || headline.includes('lagarde')) {
      return direction === 'up' ? 'ECB outlook lifting euro' : 'ECB concerns pressuring euro';
    }
    if (headline.includes('boj') || headline.includes('japan')) {
      return direction === 'up' ? 'BOJ policy supporting yen' : 'Carry trade pressuring yen';
    }
    if (headline.includes('inflation') || headline.includes('cpi')) {
      return 'Inflation data in focus';
    }
    if (headline.includes('rate') || headline.includes('hike') || headline.includes('cut')) {
      return 'Rate expectations driving movement';
    }
  }

  // Fallback to price-action based blurbs
  const blurbs = {
    'DX': {
      up: 'Dollar firm on safe-haven demand',
      down: 'Greenback easing on risk appetite',
      flat: 'Dollar consolidating near key levels'
    },
    '6E': {
      up: 'Euro supported by ECB stance',
      down: 'Euro soft on growth concerns',
      flat: 'EUR/USD range-bound ahead of data'
    },
    '6J': {
      up: 'Yen bid on risk-off flows',
      down: 'Yen weak as carry trades resume',
      flat: 'Yen steady awaiting BOJ signals'
    },
    '6B': {
      up: 'Sterling firm on UK data',
      down: 'Pound pressured by UK outlook',
      flat: 'Cable consolidating near support'
    },
    '6A': {
      up: 'Aussie rallies on risk-on mood',
      down: 'AUD soft on China concerns',
      flat: 'Aussie steady tracking commodities'
    }
  };

  return blurbs[symbol]?.[direction] || 'Tracking broader FX sentiment';
}

// Generate short context blurb for international indices
function generateIndexBlurb(symbol, data, newsItem) {
  const change = data.changePercent;
  const direction = change > 0.2 ? 'up' : change < -0.2 ? 'down' : 'flat';

  // If we have news, try to extract context
  if (newsItem && newsItem.headline) {
    const headline = newsItem.headline.toLowerCase();

    if (headline.includes('tech') || headline.includes('chip') || headline.includes('ai')) {
      return direction === 'up' ? 'Tech rally lifting index' : 'Tech weakness dragging index';
    }
    if (headline.includes('bank') || headline.includes('financial')) {
      return direction === 'up' ? 'Financials leading gains' : 'Bank stocks under pressure';
    }
    if (headline.includes('china') || headline.includes('trade')) {
      return 'China/trade headlines in focus';
    }
  }

  const blurbs = {
    'N225': {
      up: 'Nikkei rallies on export optimism',
      down: 'Nikkei soft on yen strength',
      flat: 'Tokyo stocks mixed in quiet trade'
    },
    'DAX': {
      up: 'DAX gains on industrial strength',
      down: 'German stocks ease on growth fears',
      flat: 'DAX consolidating near highs'
    },
    'STOXX': {
      up: 'European stocks rise on risk appetite',
      down: 'Stoxx 50 pressured by macro concerns',
      flat: 'Europe mixed ahead of ECB'
    },
    'FTSE': {
      up: 'FTSE lifted by commodity stocks',
      down: 'UK stocks soft on sterling move',
      flat: 'London stocks range-bound'
    }
  };

  return blurbs[symbol]?.[direction] || 'Tracking global sentiment';
}

// Generate short context blurb for Mag 7 stocks
function generateMag7Blurb(symbol, data, newsItem) {
  const change = data.changePercent;

  // More granular direction detection
  let direction;
  if (change > 1.5) direction = 'strong_up';
  else if (change > 0.3) direction = 'up';
  else if (change < -1.5) direction = 'strong_down';
  else if (change < -0.3) direction = 'down';
  else direction = 'flat';

  // Stock-specific blurbs based on price action (more accurate)
  const blurbs = {
    'AAPL': {
      strong_up: 'Apple rallying on strong demand',
      up: 'iPhone & Services momentum',
      down: 'Taking a breather today',
      strong_down: 'Selling pressure on Apple',
      flat: 'Apple consolidating'
    },
    'NVDA': {
      strong_up: 'AI chip demand surging',
      up: 'Data center growth continues',
      down: 'Pullback after recent gains',
      strong_down: 'Broad tech weakness hits NVDA',
      flat: 'NVDA consolidating gains'
    },
    'MSFT': {
      strong_up: 'Azure & AI driving gains',
      up: 'Cloud strength continues',
      down: 'Modest pullback today',
      strong_down: 'Tech rotation weighing',
      flat: 'MSFT holding steady'
    },
    'GOOGL': {
      strong_up: 'Search & Cloud boosting shares',
      up: 'Ad revenue trends positive',
      down: 'Mild profit-taking',
      strong_down: 'Regulatory headlines in focus',
      flat: 'Alphabet range-bound'
    },
    'AMZN': {
      strong_up: 'AWS & retail firing on all cylinders',
      up: 'E-commerce trends supportive',
      down: 'Slight pullback today',
      strong_down: 'Consumer spending concerns',
      flat: 'Amazon trading sideways'
    },
    'META': {
      strong_up: 'Ad rebound driving rally',
      up: 'Engagement metrics strong',
      down: 'Minor weakness today',
      strong_down: 'Social media sector under pressure',
      flat: 'Meta holding support'
    },
    'TSLA': {
      strong_up: 'EV demand optimism rising',
      up: 'Delivery expectations improving',
      down: 'Margin concerns linger',
      strong_down: 'EV competition pressuring',
      flat: 'Tesla awaiting catalysts'
    }
  };

  return blurbs[symbol]?.[direction] || 'Tracking market sentiment';
}

// International indices builder
function buildInternationalIndices(internationalData) {
  const indices = {};
  const indexOrder = ['N225', 'DAX', 'STOXX', 'FTSE'];

  indexOrder.forEach(symbol => {
    const data = internationalData[symbol];
    if (data) {
      const esImplication = getESImplication(symbol, data.changePercent);
      const relevantNews = getNewsForInstrument(symbol);
      const contextBlurb = generateIndexBlurb(symbol, data, relevantNews);

      indices[symbol] = {
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        previousClose: data.previousClose,
        sessionStatus: data.sessionStatus || 'UNKNOWN',
        timezone: data.timezone,
        esImplication: esImplication,
        latestNews: relevantNews,
        contextBlurb: contextBlurb
      };
    }
  });

  // Calculate global risk summary
  const liveIndices = Object.values(indices).filter(i => i.sessionStatus === 'LIVE');
  let globalSentiment = 'Neutral';
  if (liveIndices.length > 0) {
    const avgChange = liveIndices.reduce((sum, i) => sum + i.changePercent, 0) / liveIndices.length;
    if (avgChange > 0.3) globalSentiment = 'Risk-On';
    else if (avgChange < -0.3) globalSentiment = 'Risk-Off';
  }

  return {
    indices: indices,
    globalSentiment: globalSentiment
  };
}

function getESImplication(symbol, changePercent) {
  const direction = changePercent > 0 ? 'positive' : changePercent < 0 ? 'negative' : 'flat';

  switch (symbol) {
    case 'N225':
      if (Math.abs(changePercent) < 0.3) return 'Nikkei flat - neutral for ES overnight';
      return changePercent > 0
        ? 'Nikkei strength suggests positive Asia session tone'
        : 'Nikkei weakness suggests cautious Asia session';
    case 'DAX':
      if (Math.abs(changePercent) < 0.3) return 'DAX flat - neutral European tone';
      return changePercent > 0
        ? 'DAX strength supports European risk appetite'
        : 'DAX weakness signals European caution';
    case 'STOXX':
      if (Math.abs(changePercent) < 0.3) return 'Euro Stoxx flat - mixed European sentiment';
      return changePercent > 0
        ? 'Broad European strength supports global risk'
        : 'Broad European weakness weighs on sentiment';
    case 'FTSE':
      if (Math.abs(changePercent) < 0.3) return 'FTSE flat - UK sentiment neutral';
      return changePercent > 0
        ? 'FTSE strength adds to global bid'
        : 'FTSE weakness reflects UK/global concerns';
    default:
      return `${direction} tone`;
  }
}

// Sector data builder
function buildSectorData(sectorData) {
  const sectors = {};
  const sectorOrder = ['XLK', 'XLF', 'XLE', 'XLY', 'XLP', 'XLV', 'XLU'];

  sectorOrder.forEach(symbol => {
    const data = sectorData[symbol];
    if (data) {
      sectors[symbol] = {
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        isLeader: data.isLeader || false,
        isLaggard: data.isLaggard || false
      };
    }
  });

  return sectors;
}

// Volatility data builder
function buildVolatilityData(vixData) {
  if (!vixData) {
    return {
      level: 15,
      change: 0,
      changePercent: 0,
      interpretation: 'Normal',
      riskLevel: 'MODERATE',
      description: 'VIX data unavailable'
    };
  }

  const level = vixData.price;
  let interpretation, riskLevel, description;

  if (level < 12) {
    interpretation = 'Low';
    riskLevel = 'LOW';
    description = 'Complacency zone - markets calm, potential for surprise volatility';
  } else if (level < 16) {
    interpretation = 'Normal';
    riskLevel = 'MODERATE';
    description = 'Normal volatility - typical market conditions';
  } else if (level < 20) {
    interpretation = 'Elevated';
    riskLevel = 'ELEVATED';
    description = 'Elevated fear - increased hedging activity';
  } else if (level < 30) {
    interpretation = 'High';
    riskLevel = 'HIGH';
    description = 'High fear - significant market stress';
  } else {
    interpretation = 'Extreme';
    riskLevel = 'EXTREME';
    description = 'Extreme fear - crisis-level volatility';
  }

  return {
    level: level,
    change: vixData.change,
    changePercent: vixData.changePercent,
    interpretation: interpretation,
    riskLevel: riskLevel,
    description: description
  };
}

// Magnificent Seven data builder
function buildMag7Data(mag7Data, mag7NewsData) {
  const stocks = {};
  const stockOrder = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'];

  stockOrder.forEach(symbol => {
    const data = mag7Data[symbol];
    if (data) {
      // Get recent news for this stock
      const newsItems = mag7NewsData[symbol] || [];
      const latestNews = newsItems.length > 0 ? newsItems[0] : null;
      const contextBlurb = generateMag7Blurb(symbol, data, latestNews);

      stocks[symbol] = {
        name: data.name,
        description: data.description,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        previousClose: data.previousClose,
        marketCap: data.marketCapFormatted || 'N/A',
        fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: data.fiftyTwoWeekLow,
        trend: data.trend || 'Flat',
        contextBlurb: contextBlurb,
        // Latest headline for quick reference
        latestNews: latestNews ? {
          headline: truncateHeadline(latestNews.headline, 80),
          source: latestNews.source,
          url: latestNews.url,
          relativeTime: latestNews.relativeTime
        } : null
      };
    }
  });

  // Calculate overall Mag 7 sentiment
  const stockValues = Object.values(stocks);
  const avgChange = stockValues.length > 0
    ? stockValues.reduce((sum, s) => sum + s.changePercent, 0) / stockValues.length
    : 0;

  let overallTrend = 'Mixed';
  if (avgChange > 0.5) overallTrend = 'Bullish';
  else if (avgChange > 0.2) overallTrend = 'Slightly Bullish';
  else if (avgChange < -0.5) overallTrend = 'Bearish';
  else if (avgChange < -0.2) overallTrend = 'Slightly Bearish';

  // Identify leader and laggard
  const sorted = stockValues.sort((a, b) => b.changePercent - a.changePercent);
  const leader = sorted.length > 0 ? sorted[0].name : null;
  const laggard = sorted.length > 0 ? sorted[sorted.length - 1].name : null;

  return {
    stocks: stocks,
    summary: {
      overallTrend: overallTrend,
      avgChangePercent: parseFloat(avgChange.toFixed(2)),
      leader: leader,
      laggard: laggard
    }
  };
}

function truncateHeadline(headline, maxLength) {
  if (!headline) return '';
  if (headline.length <= maxLength) return headline;
  return headline.slice(0, maxLength - 3) + '...';
}

// Build instruments grouped by sector
function buildInstrumentsBySector(futuresData, vixLevel, fredData) {
  const sectorConfig = {
    indices: {
      name: 'Equity Indices',
      symbols: ['ES', 'NQ', 'YM', 'RTY'],
      keyDrivers: 'VIX, earnings, Fed policy, economic data'
    },
    bonds: {
      name: 'Interest Rates / Bonds',
      symbols: ['ZT', 'ZF', 'ZN', 'TN', 'ZB'],
      keyDrivers: 'Fed policy, inflation, Treasury auctions, flight to safety'
    },
    metals: {
      name: 'Precious Metals',
      symbols: ['GC', 'SI', 'HG'],
      keyDrivers: 'US Dollar (DX), real yields, inflation, safe haven demand'
    },
    energy: {
      name: 'Energy',
      symbols: ['CL', 'NG', 'RB'],
      keyDrivers: 'OPEC, geopolitics, inventory data, USD, weather'
    }
  };

  const sectors = {};

  Object.entries(sectorConfig).forEach(([sectorKey, config]) => {
    const sectorInstruments = {};
    let bullishCount = 0;
    let bearishCount = 0;
    let totalCount = 0;

    config.symbols.forEach(symbol => {
      const data = futuresData[symbol];
      if (data) {
        const bias = calculateBias(data, vixLevel);
        const reasons = generateInstrumentReasons(symbol, data, bias, vixLevel, fredData);

        sectorInstruments[symbol] = {
          name: data.name,
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          bias: bias,
          reasons: reasons,
          sector: sectorKey
        };

        totalCount++;
        if (bias === 'Bullish') bullishCount++;
        if (bias === 'Bearish') bearishCount++;
      }
    });

    // Calculate sector bias
    let sectorBias = 'Mixed';
    if (bullishCount > totalCount / 2) sectorBias = 'Bullish';
    else if (bearishCount > totalCount / 2) sectorBias = 'Bearish';

    // Generate sector key insight
    const sectorInsight = generateSectorInsight(sectorKey, sectorInstruments, futuresData);

    sectors[sectorKey] = {
      name: config.name,
      instruments: sectorInstruments,
      bias: sectorBias,
      biasDetail: `${bearishCount > bullishCount ? bearishCount : bullishCount} of ${totalCount} instruments ${bearishCount > bullishCount ? 'bearish' : bullishCount > bearishCount ? 'bullish' : 'mixed'}`,
      keyDrivers: config.keyDrivers,
      insight: sectorInsight
    };
  });

  return sectors;
}

function generateInstrumentReasons(symbol, data, bias, vixLevel, fredData) {
  // Use existing reason generators from buildInstruments or provide generic ones
  const reasons = [];

  if (data.changePercent > 0.5) {
    reasons.push('Trading higher today');
  } else if (data.changePercent < -0.5) {
    reasons.push('Trading lower today');
  }

  if (data.price < data.previousClose) {
    reasons.push('Below prior close');
  } else if (data.price > data.previousClose) {
    reasons.push('Above prior close');
  }

  return reasons.length > 0 ? reasons : ['Tracking market conditions'];
}

function generateSectorInsight(sectorKey, instruments, futuresData) {
  const vix = futuresData?.VIX?.price || 16;

  switch (sectorKey) {
    case 'indices':
      if (vix > 20) return 'Elevated VIX creating selling pressure';
      if (vix < 14) return 'Low volatility supporting equities';
      return 'Normal market conditions';

    case 'bonds':
      // Check for yield curve status
      const zn = instruments['ZN'];
      const zt = instruments['ZT'];
      if (zn && zt) {
        return zn.changePercent < zt.changePercent
          ? 'Long end underperforming, curve flattening'
          : 'Curve steepening, long end outperforming';
      }
      return 'Bond market tracking Fed expectations';

    case 'metals':
      const gc = instruments['GC'];
      const si = instruments['SI'];
      if (gc && si) {
        const goldSilverRatio = gc.price / (si?.price || 30);
        if (goldSilverRatio > 85) return `Gold/Silver ratio elevated (${goldSilverRatio.toFixed(1)}) - risk-off`;
        return `Gold/Silver ratio at ${goldSilverRatio.toFixed(1)}`;
      }
      return 'Precious metals tracking dollar and yields';

    case 'energy':
      const cl = instruments['CL'];
      const ng = instruments['NG'];
      if (cl?.changePercent > 1) return 'Crude supported by supply concerns';
      if (cl?.changePercent < -1) return 'Crude under pressure on demand concerns';
      if (ng?.changePercent < -2) return 'Natural gas weak on mild weather';
      return 'Energy sector mixed';

    default:
      return 'Market conditions apply';
  }
}

// Build Quick Stats
function buildQuickStats(treasuryYields, crypto, currencies) {
  return {
    treasuryYields: {
      '2Y': treasuryYields['5Y'] || { yield: 4.21, change: 0.03 }, // Using 5Y as proxy
      '5Y': treasuryYields['5Y'] || { yield: 4.38, change: 0.02 },
      '10Y': treasuryYields['10Y'] || { yield: 4.52, change: 0.04 },
      '30Y': treasuryYields['30Y'] || { yield: 4.71, change: 0.02 }
    },
    yieldCurve: treasuryYields.yieldCurve || {
      spread2s10s: 0.14,
      isInverted: false,
      status: 'Flat'
    },
    currencies: {
      EURUSD: currencies['6E'] ? {
        price: currencies['6E'].price,
        change: currencies['6E'].changePercent
      } : { price: 1.0425, change: -0.15 },
      USDJPY: currencies['6J'] ? {
        price: 1 / currencies['6J'].price,
        change: -currencies['6J'].changePercent
      } : { price: 154.82, change: 0.32 },
      GBPUSD: currencies['6B'] ? {
        price: currencies['6B'].price,
        change: currencies['6B'].changePercent
      } : { price: 1.2180, change: -0.08 }
    },
    crypto: {
      BTC: crypto.BTC || { price: 102450, change: -1250, changePercent: -1.21 },
      ETH: crypto.ETH || { price: 3180, change: -28, changePercent: -0.87 }
    }
  };
}

// Build Fed Watch data
function buildFedWatch() {
  const now = new Date();

  // Next FOMC meeting dates (update these periodically)
  const fomcDates = [
    new Date('2025-03-18T14:00:00-05:00'),
    new Date('2025-05-06T14:00:00-05:00'),
    new Date('2025-06-17T14:00:00-05:00'),
    new Date('2025-07-29T14:00:00-05:00'),
    new Date('2025-09-16T14:00:00-05:00'),
    new Date('2025-11-04T14:00:00-05:00'),
    new Date('2025-12-16T14:00:00-05:00')
  ];

  // Find next meeting
  const nextMeeting = fomcDates.find(d => d > now) || fomcDates[0];
  const daysUntil = Math.ceil((nextMeeting - now) / (1000 * 60 * 60 * 24));

  // Fed speakers (sample data - should be updated with real calendar)
  const fedSpeakers = [
    { name: 'Powell', title: 'Chair', date: '2025-02-11', stance: 'hawkish' },
    { name: 'Waller', title: 'Governor', date: '2025-02-13', stance: 'hawkish' },
    { name: 'Bostic', title: 'Atlanta Fed', date: '2025-02-14', stance: 'dovish' },
    { name: 'Barkin', title: 'Richmond Fed', date: '2025-02-18', stance: 'hawkish' }
  ];

  // Rate expectations (mock - in real app, fetch from CME FedWatch)
  const rateExpectations = {
    cut25bp: 15,
    hold: 84,
    hike25bp: 1
  };

  return {
    nextMeeting: {
      date: nextMeeting.toISOString().split('T')[0],
      dateFormatted: nextMeeting.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      daysUntil: daysUntil,
      countdown: `${daysUntil} days`
    },
    currentRate: '4.25% - 4.50%',
    rateExpectations: rateExpectations,
    marketExpectation: rateExpectations.hold > 50 ? 'HOLD' : rateExpectations.cut25bp > 50 ? 'CUT' : 'MIXED',
    upcomingSpeakers: fedSpeakers.filter(s => new Date(s.date) > now).slice(0, 4),
    marketImpact: {
      moreCuts: 'ES▲ ZN▲ DX▼',
      fewerCuts: 'ES▼ ZN▼ DX▲'
    }
  };
}

// Build Breaking News Ticker content
function buildTickerContent(news, macroEvents, fedWatch) {
  const items = [];
  const now = new Date();

  // Add breaking/high impact news
  const breakingNews = news.filter(n => n.impact === 'HIGH').slice(0, 3);
  breakingNews.forEach(n => {
    // Determine affected instruments direction
    const impacts = (n.affectedInstruments || []).map(sym => {
      // Simple heuristic based on category
      if (n.category === 'Fed') {
        if (n.headline.toLowerCase().includes('hawkish') || n.headline.toLowerCase().includes('rate')) {
          return `${sym}▼`;
        }
        return `${sym}▲`;
      }
      return sym;
    }).join(' ');

    items.push({
      type: 'breaking',
      icon: '🔴',
      label: 'BREAKING',
      content: n.headline,
      impacts: impacts,
      timestamp: n.relativeTime
    });
  });

  // Add upcoming macro events (within 7 days)
  const upcomingEvents = macroEvents
    .filter(e => e.importance === 'HIGH' && e.countdown)
    .slice(0, 2);

  upcomingEvents.forEach(e => {
    items.push({
      type: 'upcoming',
      icon: '⏰',
      label: 'UPCOMING',
      content: `${e.event} ${e.countdown}`,
      subtext: e.forecast ? `Forecast: ${e.forecast} vs Prior: ${e.previous}` : '',
      timestamp: e.dateFormatted || e.time
    });
  });

  // Add Fed speaker info
  if (fedWatch.upcomingSpeakers && fedWatch.upcomingSpeakers.length > 0) {
    const nextSpeaker = fedWatch.upcomingSpeakers[0];
    items.push({
      type: 'fed',
      icon: '🏛️',
      label: 'FED',
      content: `${nextSpeaker.name} (${nextSpeaker.title}) speaks ${nextSpeaker.date}`,
      stance: nextSpeaker.stance === 'hawkish' ? '🦅' : '🕊️'
    });
  }

  // Add next FOMC countdown
  items.push({
    type: 'fomc',
    icon: '📅',
    label: 'FOMC',
    content: `Next meeting: ${fedWatch.nextMeeting.dateFormatted} (${fedWatch.nextMeeting.countdown})`
  });

  return items;
}

// Enhance macro events with dates, countdowns, and scenarios
function enhanceMacroEvents(events) {
  const now = new Date();

  // Add scenario analysis for high-impact events
  const scenarioTemplates = {
    'Non-Farm Payrolls': {
      scenarios: [
        {
          condition: 'ABOVE 200K (Hot)',
          impacts: { ES: 'Bearish', ZN: 'Bearish', DX: 'Bullish', GC: 'Bearish' },
          reason: 'Hawkish Fed pressure, rates stay higher longer'
        },
        {
          condition: '150K - 180K (Goldilocks)',
          impacts: { ES: 'Bullish', ZN: 'Bullish', DX: 'Flat', GC: 'Flat' },
          reason: 'Soft landing narrative, Fed can ease gradually'
        },
        {
          condition: 'BELOW 140K (Cold)',
          impacts: { ES: 'Bearish', ZN: 'Bullish', DX: 'Bearish', GC: 'Bullish' },
          reason: 'Recession fears, flight to safety'
        }
      ]
    },
    'CPI': {
      scenarios: [
        {
          condition: 'Above Forecast (Hot)',
          impacts: { ES: 'Bearish', ZN: 'Bearish', DX: 'Bullish', GC: 'Mixed' },
          reason: 'Inflation fears, Fed stays hawkish'
        },
        {
          condition: 'At Forecast',
          impacts: { ES: 'Flat', ZN: 'Flat', DX: 'Flat', GC: 'Flat' },
          reason: 'In-line, minimal reaction'
        },
        {
          condition: 'Below Forecast (Cool)',
          impacts: { ES: 'Bullish', ZN: 'Bullish', DX: 'Bearish', GC: 'Bullish' },
          reason: 'Disinflation, Fed can ease'
        }
      ]
    },
    'FOMC': {
      scenarios: [
        {
          condition: 'Hawkish (Higher for longer)',
          impacts: { ES: 'Bearish', ZN: 'Bearish', DX: 'Bullish', GC: 'Bearish' },
          reason: 'Tighter financial conditions'
        },
        {
          condition: 'Neutral (As expected)',
          impacts: { ES: 'Flat', ZN: 'Flat', DX: 'Flat', GC: 'Flat' },
          reason: 'No surprises'
        },
        {
          condition: 'Dovish (Signals cuts)',
          impacts: { ES: 'Bullish', ZN: 'Bullish', DX: 'Bearish', GC: 'Bullish' },
          reason: 'Easier policy ahead'
        }
      ]
    },
    'Unemployment Rate': {
      scenarios: [
        {
          condition: 'Below 4.0% (Strong)',
          impacts: { ES: 'Mixed', DX: 'Bullish', ZN: 'Bearish' },
          reason: 'Strong economy but Fed stays hawkish'
        },
        {
          condition: 'At Forecast',
          impacts: { ES: 'Flat', ZN: 'Flat', DX: 'Flat' },
          reason: 'Minimal market reaction - in line'
        },
        {
          condition: 'Above 4.2% (Weakening)',
          impacts: { ES: 'Bearish then Bullish', ZN: 'Bullish', GC: 'Bullish' },
          reason: 'Initial fear, then dovish Fed hopes'
        }
      ]
    }
  };

  return events.map(event => {
    // Parse event date/time and calculate countdown
    let eventDate = null;
    let countdown = null;
    let dateFormatted = null;

    // Try to parse the time string to create a date
    const timeMatch = event.time?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      eventDate = new Date();
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const isPM = timeMatch[3].toUpperCase() === 'PM';

      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;

      eventDate.setHours(hours, minutes, 0, 0);

      // If time has passed today, assume tomorrow
      if (eventDate < now) {
        eventDate.setDate(eventDate.getDate() + 1);
      }

      // Calculate countdown
      const diff = eventDate - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        countdown = `IN ${days}D ${hoursLeft}H ${minutesLeft}M`;
      } else if (hoursLeft > 0) {
        countdown = `IN ${hoursLeft}H ${minutesLeft}M`;
      } else if (minutesLeft > 0) {
        countdown = `IN ${minutesLeft}M`;
      } else {
        countdown = 'NOW';
      }

      dateFormatted = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // Find matching scenario template
    let scenarios = null;
    for (const [eventName, template] of Object.entries(scenarioTemplates)) {
      if (event.event?.toLowerCase().includes(eventName.toLowerCase())) {
        scenarios = template.scenarios;
        break;
      }
    }

    return {
      ...event,
      dateFormatted: dateFormatted,
      countdown: countdown,
      scenarios: event.importance === 'HIGH' ? scenarios : null,
      isToday: eventDate ? eventDate.toDateString() === now.toDateString() : false,
      isUrgent: countdown && (countdown.includes('M') && !countdown.includes('D') && !countdown.includes('H'))
    };
  });
}

// Enhance news with "Why It Matters" analysis
function enhanceNewsWithAnalysis(news) {
  const analysisTemplates = {
    'Fed': {
      why: (headline) => {
        if (headline.toLowerCase().includes('hawkish')) {
          return 'Hawkish Fed signals mean higher rates for longer, pressuring risk assets and supporting the dollar.';
        }
        if (headline.toLowerCase().includes('dovish') || headline.toLowerCase().includes('cut')) {
          return 'Dovish Fed signals support risk assets as easier monetary policy boosts liquidity.';
        }
        if (headline.toLowerCase().includes('warsh') || headline.toLowerCase().includes('nomination')) {
          return 'Fed personnel changes can shift policy direction and market expectations for rate path.';
        }
        return 'Federal Reserve policy is the primary driver of interest rates and risk appetite in markets.';
      },
      defaultImpacts: { ES: 'Mixed', ZN: 'Bearish', DX: 'Bullish', GC: 'Bearish' }
    },
    'Geopolitical': {
      why: (headline) => {
        if (headline.toLowerCase().includes('tariff')) {
          return 'Tariff threats create trade uncertainty, typically risk-off for equities but supportive for safe havens.';
        }
        if (headline.toLowerCase().includes('war') || headline.toLowerCase().includes('conflict')) {
          return 'Military conflicts disrupt supply chains and drive safe-haven flows to gold and bonds.';
        }
        if (headline.toLowerCase().includes('sanction')) {
          return 'Sanctions can disrupt global trade flows and commodity supplies, creating market volatility.';
        }
        return 'Geopolitical tensions typically trigger risk-off sentiment and safe-haven demand.';
      },
      defaultImpacts: { ES: 'Bearish', CL: 'Bullish', ZN: 'Bullish', GC: 'Bullish' }
    },
    'Economic': {
      why: (headline) => {
        if (headline.toLowerCase().includes('gdp')) {
          return 'GDP data reflects economic health - strong data supports stocks but may keep rates higher.';
        }
        if (headline.toLowerCase().includes('inflation') || headline.toLowerCase().includes('cpi')) {
          return 'Inflation data directly impacts Fed policy expectations and real interest rates.';
        }
        if (headline.toLowerCase().includes('jobs') || headline.toLowerCase().includes('employment')) {
          return 'Employment data is a key Fed mandate - affects rate cut expectations significantly.';
        }
        return 'Economic data shapes expectations for growth, inflation, and monetary policy.';
      },
      defaultImpacts: { ES: 'Mixed', ZN: 'Mixed', DX: 'Mixed' }
    },
    'Energy': {
      why: (headline) => {
        if (headline.toLowerCase().includes('opec')) {
          return 'OPEC production decisions directly impact global oil supply and prices.';
        }
        if (headline.toLowerCase().includes('inventory') || headline.toLowerCase().includes('storage')) {
          return 'Oil inventory data reflects supply-demand balance and near-term price direction.';
        }
        return 'Energy prices affect inflation, consumer spending, and transportation costs globally.';
      },
      defaultImpacts: { CL: 'Mixed', ES: 'Mixed' }
    },
    'Earnings': {
      why: (headline) => {
        return 'Corporate earnings drive stock valuations and provide insight into economic health.';
      },
      defaultImpacts: { ES: 'Mixed', NQ: 'Mixed' }
    },
    'Tech': {
      why: (headline) => {
        if (headline.toLowerCase().includes('ai') || headline.toLowerCase().includes('chip')) {
          return 'AI and semiconductor developments drive tech sector leadership and market sentiment.';
        }
        return 'Technology sector performance often leads broader market direction.';
      },
      defaultImpacts: { NQ: 'Mixed', ES: 'Mixed' }
    }
  };

  return news.map(item => {
    const template = analysisTemplates[item.category] || {
      why: () => 'This news may impact market sentiment and trading activity.',
      defaultImpacts: {}
    };

    const whyItMatters = template.why(item.headline || '');

    // Build market impact string
    const impacts = item.affectedInstruments?.map(sym => {
      const direction = determineImpactDirection(item, sym);
      return `${sym} ${direction}`;
    }).join(' | ') || '';

    return {
      ...item,
      whyItMatters: whyItMatters,
      marketImpact: impacts
    };
  });
}

function determineImpactDirection(news, symbol) {
  const headline = (news.headline || '').toLowerCase();
  const category = news.category;

  // Simple heuristic based on category and keywords
  const bullishKeywords = ['rally', 'surge', 'gain', 'rise', 'jump', 'bullish', 'support'];
  const bearishKeywords = ['fall', 'drop', 'plunge', 'decline', 'bearish', 'concern', 'fear'];

  const hasBullish = bullishKeywords.some(kw => headline.includes(kw));
  const hasBearish = bearishKeywords.some(kw => headline.includes(kw));

  if (hasBullish && !hasBearish) return '▲ Bullish';
  if (hasBearish && !hasBullish) return '▼ Bearish';
  return '━ Mixed';
}
