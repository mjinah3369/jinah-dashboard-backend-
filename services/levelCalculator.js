/**
 * Level Calculator - Calculates tick distance to key levels
 * Phase 3 of Session Enhancement
 */

// Tick sizes for each instrument
const TICK_SIZES = {
  ES: 0.25,
  NQ: 0.25,
  YM: 1.0,
  RTY: 0.10,
  CL: 0.01,
  NG: 0.001,
  GC: 0.10,
  SI: 0.005,
  HG: 0.0005,
  ZN: 0.015625,  // 1/64
  ZB: 0.03125,   // 1/32
  DX: 0.005,
  '6E': 0.00005,
  '6J': 0.0000005,
  '6B': 0.0001,
  '6A': 0.0001,
  ZC: 0.25,      // Corn
  ZS: 0.25,      // Soybeans
  ZW: 0.25,      // Wheat
  BTC: 0.50      // Bitcoin
};

// Tick values (dollar value per tick)
const TICK_VALUES = {
  ES: 12.50,
  NQ: 5.00,
  YM: 5.00,
  RTY: 5.00,
  CL: 10.00,
  NG: 10.00,
  GC: 10.00,
  SI: 25.00,
  HG: 12.50,
  ZN: 15.625,
  ZB: 31.25,
  DX: 10.00,
  '6E': 6.25,
  '6J': 6.25,
  '6B': 6.25,
  '6A': 10.00,
  ZC: 12.50,
  ZS: 12.50,
  ZW: 12.50,
  BTC: 0.50
};

/**
 * Calculate ticks between two prices
 */
function calculateTicks(symbol, fromPrice, toPrice) {
  const tickSize = TICK_SIZES[symbol] || 0.01;
  const diff = toPrice - fromPrice;
  return Math.round(diff / tickSize);
}

/**
 * Calculate dollar value of tick distance
 */
function calculateTickValue(symbol, ticks) {
  const tickValue = TICK_VALUES[symbol] || 10.00;
  return ticks * tickValue;
}

/**
 * Get all levels with tick distances
 * @param {string} symbol - Instrument symbol
 * @param {number} currentPrice - Current price
 * @param {object} levels - Object containing all key levels
 */
function getLevelsWithDistance(symbol, currentPrice, levels) {
  const result = [];

  // Define level priority (higher = more important)
  const levelPriority = {
    'Weekly High': 5,
    'Weekly Low': 5,
    'Monthly High': 6,
    'Monthly Low': 6,
    'PDH': 4,           // Previous Day High
    'PDL': 4,           // Previous Day Low
    'Asia High': 3,
    'Asia Low': 3,
    'London High': 3,
    'London Low': 3,
    'US IB High': 4,
    'US IB Low': 4,
    'Asia IB High': 3,
    'Asia IB Low': 3,
    'London IB High': 3,
    'London IB Low': 3,
    'Weekly Pivot': 4,
    'Daily Pivot': 3,
    'Monthly Pivot': 5,
    'VAH': 3,           // Value Area High
    'VAL': 3,           // Value Area Low
    'POC': 3,           // Point of Control
    'VWAP': 2
  };

  for (const [name, price] of Object.entries(levels)) {
    if (price === null || price === undefined) continue;

    const ticks = calculateTicks(symbol, currentPrice, price);
    const dollarValue = calculateTickValue(symbol, Math.abs(ticks));
    const direction = ticks > 0 ? 'above' : ticks < 0 ? 'below' : 'at';

    result.push({
      name,
      price,
      ticks: Math.abs(ticks),
      ticksRaw: ticks,
      direction,
      dollarValue,
      priority: levelPriority[name] || 1,
      inDailyRange: true // Will be calculated below
    });
  }

  // Sort by absolute tick distance
  result.sort((a, b) => a.ticks - b.ticks);

  // Mark levels outside daily range
  const pdh = levels['PDH'];
  const pdl = levels['PDL'];
  if (pdh && pdl) {
    const dailyRange = pdh - pdl;
    const extendedHigh = pdh + dailyRange * 0.5;
    const extendedLow = pdl - dailyRange * 0.5;

    result.forEach(level => {
      level.inDailyRange = level.price >= extendedLow && level.price <= extendedHigh;
    });
  }

  return result;
}

/**
 * Get nearest levels (filtered for dashboard display)
 * @param {string} symbol
 * @param {number} currentPrice
 * @param {object} levels
 * @param {number} count - Number of levels to return (default 5 above, 5 below)
 */
function getNearestLevels(symbol, currentPrice, levels, count = 5) {
  const allLevels = getLevelsWithDistance(symbol, currentPrice, levels);

  const above = allLevels
    .filter(l => l.direction === 'above' && l.inDailyRange)
    .slice(0, count);

  const below = allLevels
    .filter(l => l.direction === 'below' && l.inDailyRange)
    .slice(0, count);

  return {
    above,
    below,
    nearest: allLevels[0] || null,
    currentPrice,
    symbol,
    tickSize: TICK_SIZES[symbol] || 0.01,
    tickValue: TICK_VALUES[symbol] || 10.00
  };
}

/**
 * Calculate pivot levels (Standard Pivot Points)
 */
function calculatePivots(high, low, close) {
  const pivot = (high + low + close) / 3;

  return {
    pivot: parseFloat(pivot.toFixed(2)),
    r1: parseFloat(((2 * pivot) - low).toFixed(2)),
    r2: parseFloat((pivot + (high - low)).toFixed(2)),
    r3: parseFloat((high + 2 * (pivot - low)).toFixed(2)),
    s1: parseFloat(((2 * pivot) - high).toFixed(2)),
    s2: parseFloat((pivot - (high - low)).toFixed(2)),
    s3: parseFloat((low - 2 * (high - pivot)).toFixed(2))
  };
}

/**
 * Calculate Fibonacci levels
 */
function calculateFibonacciLevels(high, low) {
  const range = high - low;

  return {
    level_0: low,                                    // 0%
    level_236: parseFloat((low + range * 0.236).toFixed(2)),   // 23.6%
    level_382: parseFloat((low + range * 0.382).toFixed(2)),   // 38.2%
    level_500: parseFloat((low + range * 0.5).toFixed(2)),     // 50%
    level_618: parseFloat((low + range * 0.618).toFixed(2)),   // 61.8%
    level_786: parseFloat((low + range * 0.786).toFixed(2)),   // 78.6%
    level_100: high                                  // 100%
  };
}

/**
 * Get ATR-based targets
 */
function getATRTargets(currentPrice, atr, direction = 'both') {
  const targets = {
    atr,
    atr_0_5: parseFloat((atr * 0.5).toFixed(2)),
    atr_1_0: parseFloat(atr.toFixed(2)),
    atr_1_5: parseFloat((atr * 1.5).toFixed(2)),
    atr_2_0: parseFloat((atr * 2.0).toFixed(2))
  };

  if (direction === 'both' || direction === 'up') {
    targets.upside = {
      target_0_5: parseFloat((currentPrice + atr * 0.5).toFixed(2)),
      target_1_0: parseFloat((currentPrice + atr).toFixed(2)),
      target_1_5: parseFloat((currentPrice + atr * 1.5).toFixed(2)),
      target_2_0: parseFloat((currentPrice + atr * 2.0).toFixed(2))
    };
  }

  if (direction === 'both' || direction === 'down') {
    targets.downside = {
      target_0_5: parseFloat((currentPrice - atr * 0.5).toFixed(2)),
      target_1_0: parseFloat((currentPrice - atr).toFixed(2)),
      target_1_5: parseFloat((currentPrice - atr * 1.5).toFixed(2)),
      target_2_0: parseFloat((currentPrice - atr * 2.0).toFixed(2))
    };
  }

  return targets;
}

export {
  calculateTicks,
  calculateTickValue,
  getLevelsWithDistance,
  getNearestLevels,
  calculatePivots,
  calculateFibonacciLevels,
  getATRTargets,
  TICK_SIZES,
  TICK_VALUES
};
