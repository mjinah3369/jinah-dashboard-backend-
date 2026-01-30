// Dashboard Builder - Combines all API data into final response

import { calculateBias, calculateDXYStrength } from './yahooFinance.js';
import { analyzeFredConditions } from './fred.js';

export function buildDashboardResponse(futuresData, economicData, fredData, polygonData, currencyData, internationalData, newsData, sectorData) {
  const now = new Date();
  const vixLevel = futuresData?.VIX?.price || 15;

  // Build instruments object with bias analysis
  const instruments = buildInstruments(futuresData, vixLevel, fredData);

  // Build currency instruments
  const currencies = buildCurrencyInstruments(currencyData || {});

  // Build international indices
  const internationalIndices = buildInternationalIndices(internationalData || {});

  // Build sector data
  const sectors = buildSectorData(sectorData || {});

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

  return {
    date: now.toISOString().split('T')[0],
    lastUpdate: now.toISOString(),
    macroEvents: economicData || [],
    earnings: earnings,
    marketBias: marketBias,
    instruments: instruments,
    currencies: currencies,
    dxyStrength: dxyStrength,
    internationalIndices: internationalIndices,
    sectors: sectors,
    volatility: volatility,
    news: newsData || [],
    narrative: narrative,
    riskNotes: riskNotes
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
      currencies[symbol] = {
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        previousClose: data.previousClose,
        fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: data.fiftyTwoWeekLow,
        reasons: reasons
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

// International indices builder
function buildInternationalIndices(internationalData) {
  const indices = {};
  const indexOrder = ['N225', 'DAX', 'STOXX', 'FTSE'];

  indexOrder.forEach(symbol => {
    const data = internationalData[symbol];
    if (data) {
      const esImplication = getESImplication(symbol, data.changePercent);
      indices[symbol] = {
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        previousClose: data.previousClose,
        sessionStatus: data.sessionStatus || 'UNKNOWN',
        timezone: data.timezone,
        esImplication: esImplication
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
