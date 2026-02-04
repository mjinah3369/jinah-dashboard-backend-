/**
 * Sweep Tracker - Detects liquidity sweeps at key levels
 * Phase 4 of Session Enhancement
 *
 * A "sweep" occurs when price wicks through a key level then closes back
 * This often indicates institutional liquidity grabs
 */

// Store recent sweeps
let sweepHistory = [];
const MAX_SWEEP_HISTORY = 100;

/**
 * Sweep detection from price data
 * @param {object} data - Price data with OHLC and level info
 */
function detectSweep(data) {
  const { symbol, high, low, close, open, levels } = data;
  const sweeps = [];

  if (!levels || typeof levels !== 'object') {
    return sweeps;
  }

  for (const [levelName, levelPrice] of Object.entries(levels)) {
    if (!levelPrice) continue;

    // Bullish sweep: Wick below level, close back above
    // This means sellers tried to break support but buyers defended
    if (low < levelPrice && close > levelPrice && open > levelPrice) {
      sweeps.push({
        symbol,
        levelName,
        levelPrice,
        type: 'BULLISH_SWEEP',
        sweepPrice: low,
        closePrice: close,
        reclaimed: true,
        timestamp: new Date().toISOString(),
        interpretation: `${levelName} swept and reclaimed - Bullish liquidity grab`,
        action: 'Watch for long entry'
      });
    }

    // Bearish sweep: Wick above level, close back below
    // This means buyers tried to break resistance but sellers defended
    if (high > levelPrice && close < levelPrice && open < levelPrice) {
      sweeps.push({
        symbol,
        levelName,
        levelPrice,
        type: 'BEARISH_SWEEP',
        sweepPrice: high,
        closePrice: close,
        reclaimed: true,
        timestamp: new Date().toISOString(),
        interpretation: `${levelName} swept and reclaimed - Bearish liquidity grab`,
        action: 'Watch for short entry'
      });
    }

    // Failed support (broke and stayed below)
    if (low < levelPrice && close < levelPrice && open > levelPrice) {
      sweeps.push({
        symbol,
        levelName,
        levelPrice,
        type: 'FAILED_SUPPORT',
        sweepPrice: low,
        closePrice: close,
        reclaimed: false,
        timestamp: new Date().toISOString(),
        interpretation: `${levelName} broken - Support failed`,
        action: 'Look for continuation lower'
      });
    }

    // Failed resistance (broke and stayed above)
    if (high > levelPrice && close > levelPrice && open < levelPrice) {
      sweeps.push({
        symbol,
        levelName,
        levelPrice,
        type: 'BREAKOUT',
        sweepPrice: high,
        closePrice: close,
        reclaimed: false,
        timestamp: new Date().toISOString(),
        interpretation: `${levelName} broken - Resistance failed`,
        action: 'Look for continuation higher'
      });
    }
  }

  // Add to history
  sweeps.forEach(sweep => {
    sweepHistory.unshift(sweep);
  });

  // Trim history
  if (sweepHistory.length > MAX_SWEEP_HISTORY) {
    sweepHistory = sweepHistory.slice(0, MAX_SWEEP_HISTORY);
  }

  return sweeps;
}

/**
 * Get recent sweeps
 */
function getRecentSweeps(symbol = null, limit = 20) {
  let filtered = sweepHistory;

  if (symbol) {
    filtered = filtered.filter(s => s.symbol === symbol.toUpperCase());
  }

  return filtered.slice(0, limit);
}

/**
 * Get sweep summary for AI analysis
 */
function getSweepSummary(symbol = null) {
  const sweeps = getRecentSweeps(symbol, 50);

  const bullishSweeps = sweeps.filter(s => s.type === 'BULLISH_SWEEP').length;
  const bearishSweeps = sweeps.filter(s => s.type === 'BEARISH_SWEEP').length;
  const failedSupports = sweeps.filter(s => s.type === 'FAILED_SUPPORT').length;
  const breakouts = sweeps.filter(s => s.type === 'BREAKOUT').length;

  // Determine bias based on sweep activity
  let bias = 'NEUTRAL';
  if (bullishSweeps > bearishSweeps + 1) {
    bias = 'BULLISH';
  } else if (bearishSweeps > bullishSweeps + 1) {
    bias = 'BEARISH';
  }

  // Add context based on failed levels
  let context = '';
  if (failedSupports > breakouts) {
    context = 'Support levels failing - bearish pressure';
    bias = bias === 'NEUTRAL' ? 'BEARISH' : bias;
  } else if (breakouts > failedSupports) {
    context = 'Resistance levels failing - bullish pressure';
    bias = bias === 'NEUTRAL' ? 'BULLISH' : bias;
  }

  return {
    symbol: symbol || 'ALL',
    totalSweeps: sweeps.length,
    bullishSweeps,
    bearishSweeps,
    failedSupports,
    breakouts,
    bias,
    context,
    recentSweeps: sweeps.slice(0, 5),
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if a specific level was recently swept
 */
function wasLevelSwept(symbol, levelName, withinMinutes = 60) {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);

  return sweepHistory.find(s =>
    s.symbol === symbol.toUpperCase() &&
    s.levelName === levelName &&
    new Date(s.timestamp) > cutoff
  );
}

/**
 * Get levels that were swept and reclaimed (high probability reversal zones)
 */
function getReclaimedLevels(symbol = null) {
  const sweeps = getRecentSweeps(symbol, 50);

  return sweeps
    .filter(s => s.reclaimed === true)
    .map(s => ({
      symbol: s.symbol,
      level: s.levelName,
      price: s.levelPrice,
      type: s.type,
      time: s.timestamp
    }));
}

/**
 * Clear sweep history (for new day)
 */
function clearSweepHistory() {
  sweepHistory = [];
}

/**
 * Add a manual sweep entry (from webhook or external source)
 */
function addSweep(sweepData) {
  const sweep = {
    symbol: sweepData.symbol?.toUpperCase(),
    levelName: sweepData.levelName,
    levelPrice: sweepData.levelPrice,
    type: sweepData.type || 'MANUAL',
    sweepPrice: sweepData.sweepPrice,
    closePrice: sweepData.closePrice,
    reclaimed: sweepData.reclaimed ?? true,
    timestamp: sweepData.timestamp || new Date().toISOString(),
    interpretation: sweepData.interpretation || `${sweepData.levelName} sweep detected`,
    action: sweepData.action || 'Monitor for follow-through'
  };

  sweepHistory.unshift(sweep);

  if (sweepHistory.length > MAX_SWEEP_HISTORY) {
    sweepHistory = sweepHistory.slice(0, MAX_SWEEP_HISTORY);
  }

  return sweep;
}

export {
  detectSweep,
  getRecentSweeps,
  getSweepSummary,
  wasLevelSwept,
  getReclaimedLevels,
  clearSweepHistory,
  addSweep
};
