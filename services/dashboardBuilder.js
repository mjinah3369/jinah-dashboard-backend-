// Dashboard Builder - Combines all API data into final response

import { calculateBias } from './yahooFinance.js';
import { analyzeFredConditions } from './fred.js';

export function buildDashboardResponse(futuresData, economicData, fredData, polygonData) {
  const now = new Date();
  const vixLevel = futuresData?.VIX?.price || 15;

  // Build instruments object with bias analysis
  const instruments = buildInstruments(futuresData, vixLevel, fredData);

  // Determine overall market bias
  const marketBias = calculateMarketBias(instruments, vixLevel, fredData);

  // Generate narrative
  const narrative = generateNarrative(instruments, marketBias, economicData, fredData, vixLevel);

  // Generate risk notes
  const riskNotes = generateRiskNotes(economicData, marketBias, vixLevel);

  // Get earnings (mock for now since Alpha Vantage earnings needs separate call)
  const earnings = generateEarningsFromContext(now);

  return {
    date: now.toISOString().split('T')[0],
    lastUpdate: now.toISOString(),
    macroEvents: economicData || [],
    earnings: earnings,
    marketBias: marketBias,
    instruments: instruments,
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

function generateNarrative(instruments, marketBias, economicData, fredData, vixLevel) {
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
