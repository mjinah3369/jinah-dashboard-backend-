/**
 * Calculated Metrics - Derived signals from raw price data
 * From INSTRUMENT_DRIVERS_REFERENCE.md
 *
 * These metrics help the AI agents understand:
 * - Rotation signals (NQ vs RTY, growth vs value)
 * - Risk sentiment (gold/silver ratio, HYG)
 * - Energy dynamics (crack spread)
 * - Yield environment (real yields, carry trade)
 */

// ============================================================================
// ROTATION & BREADTH METRICS
// ============================================================================

/**
 * NQ-RTY Spread - Measures tech vs small cap rotation
 * Positive = Tech leading (narrow rally)
 * Negative = Small caps leading (breadth expanding)
 */
function calculateNqRtySpread(priceData) {
  const nqChange = priceData.NQ?.changePercent || priceData['NQ=F']?.changePercent || 0;
  const rtyChange = priceData.RTY?.changePercent || priceData['RTY=F']?.changePercent || 0;
  const spread = nqChange - rtyChange;

  let interpretation;
  if (spread > 1.0) interpretation = 'NARROW_RALLY — Tech leading, breadth weak, fragile';
  else if (spread < -1.0) interpretation = 'ROTATION — Money moving to small caps, breadth expanding';
  else if (spread > 0.3) interpretation = 'TECH_LEADING — Growth favored';
  else if (spread < -0.3) interpretation = 'VALUE_LEADING — Breadth expanding';
  else interpretation = 'BALANCED — No clear rotation';

  return {
    value: parseFloat(spread.toFixed(2)),
    nqChange: parseFloat(nqChange.toFixed(2)),
    rtyChange: parseFloat(rtyChange.toFixed(2)),
    interpretation,
    signal: spread > 0.5 ? 'TECH' : spread < -0.5 ? 'VALUE' : 'NEUTRAL'
  };
}

/**
 * XLK/XLF Ratio - Growth vs Value sector rotation
 * Tech vs Financials is the classic growth/value barometer
 */
function calculateGrowthValueRatio(priceData) {
  const xlkChange = priceData.XLK?.changePercent || 0;
  const xlfChange = priceData.XLF?.changePercent || 0;
  const ratio = xlkChange - xlfChange;

  let interpretation;
  if (ratio > 1.0) interpretation = 'GROWTH_DOMINANT — Tech outperforming banks';
  else if (ratio < -1.0) interpretation = 'VALUE_DOMINANT — Financials leading, rate play';
  else interpretation = 'BALANCED';

  return {
    value: parseFloat(ratio.toFixed(2)),
    xlkChange: parseFloat(xlkChange.toFixed(2)),
    xlfChange: parseFloat(xlfChange.toFixed(2)),
    interpretation,
    signal: ratio > 0.5 ? 'GROWTH' : ratio < -0.5 ? 'VALUE' : 'NEUTRAL'
  };
}

// ============================================================================
// SAFE HAVEN & RISK METRICS
// ============================================================================

/**
 * Gold/Silver Ratio - Fear gauge in metals
 * >80 = Extreme fear, recession pricing
 * 65-80 = Normal range
 * <65 = Risk-on, industrial demand for silver
 */
function calculateGoldSilverRatio(priceData) {
  const goldPrice = priceData.GC?.price || priceData['GC=F']?.price || 0;
  const silverPrice = priceData.SI?.price || priceData['SI=F']?.price || 0;

  if (!goldPrice || !silverPrice) {
    return { value: null, interpretation: 'DATA_UNAVAILABLE', signal: 'UNKNOWN' };
  }

  const ratio = goldPrice / silverPrice;

  let interpretation, signal;
  if (ratio > 85) {
    interpretation = 'EXTREME_FEAR — Silver very cheap, recession pricing';
    signal = 'RISK_OFF';
  } else if (ratio > 75) {
    interpretation = 'FEAR — Risk-off environment, gold preferred';
    signal = 'CAUTIOUS';
  } else if (ratio > 65) {
    interpretation = 'NEUTRAL — Normal range';
    signal = 'NEUTRAL';
  } else if (ratio > 55) {
    interpretation = 'RISK_ON — Silver gaining on industrial demand';
    signal = 'RISK_ON';
  } else {
    interpretation = 'EXTREME_RISK_ON — Silver outperforming, growth boom';
    signal = 'RISK_ON';
  }

  return {
    value: parseFloat(ratio.toFixed(2)),
    goldPrice: parseFloat(goldPrice.toFixed(2)),
    silverPrice: parseFloat(silverPrice.toFixed(2)),
    interpretation,
    signal
  };
}

/**
 * HYG Signal - High yield bond ETF as risk appetite gauge
 * HYG rising = Risk-on, credit confidence
 * HYG falling = Risk-off, credit stress
 */
function calculateHygSignal(priceData) {
  const hygChange = priceData.HYG?.changePercent || 0;
  const tltChange = priceData.TLT?.changePercent || 0;

  let interpretation, signal;
  if (hygChange > 0.3) {
    interpretation = 'RISK_ON — High yield bonds bid, credit confidence';
    signal = 'RISK_ON';
  } else if (hygChange < -0.3) {
    interpretation = 'RISK_OFF — High yield selling, credit stress';
    signal = 'RISK_OFF';
  } else {
    interpretation = 'NEUTRAL — No strong credit signal';
    signal = 'NEUTRAL';
  }

  // HYG vs TLT spread shows flight to quality
  const creditSpread = hygChange - tltChange;
  let spreadSignal = 'NEUTRAL';
  if (creditSpread > 0.5) spreadSignal = 'RISK_ON — HYG outperforming treasuries';
  if (creditSpread < -0.5) spreadSignal = 'FLIGHT_TO_QUALITY — Treasuries bid over junk';

  return {
    hygChange: parseFloat(hygChange.toFixed(2)),
    tltChange: parseFloat(tltChange.toFixed(2)),
    creditSpread: parseFloat(creditSpread.toFixed(2)),
    interpretation,
    signal,
    spreadSignal
  };
}

// ============================================================================
// ENERGY METRICS
// ============================================================================

/**
 * Crack Spread - Refinery profit margin (RB - CL)
 * Wide spread = Strong refinery margins, bullish gasoline
 * Tight spread = Weak demand or oversupply
 */
function calculateCrackSpread(priceData) {
  const rbPrice = priceData.RB?.price || priceData['RB=F']?.price || 0;
  const clPrice = priceData.CL?.price || priceData['CL=F']?.price || 0;

  if (!rbPrice || !clPrice) {
    return { value: null, interpretation: 'DATA_UNAVAILABLE', signal: 'UNKNOWN' };
  }

  // RB is priced per gallon, CL per barrel. Convert: 1 barrel = 42 gallons
  const spread = (rbPrice * 42) - clPrice;

  let interpretation, signal;
  if (spread > 35) {
    interpretation = 'WIDE — Strong refinery margins, bullish RB vs CL';
    signal = 'BULLISH_RB';
  } else if (spread > 25) {
    interpretation = 'NORMAL — Healthy refinery economics';
    signal = 'NEUTRAL';
  } else if (spread > 15) {
    interpretation = 'TIGHT — Weak refinery margins, demand concern';
    signal = 'CAUTIOUS';
  } else {
    interpretation = 'COMPRESSED — Significant demand weakness';
    signal = 'BEARISH';
  }

  return {
    value: parseFloat(spread.toFixed(2)),
    rbPrice: parseFloat(rbPrice.toFixed(4)),
    clPrice: parseFloat(clPrice.toFixed(2)),
    interpretation,
    signal
  };
}

// ============================================================================
// YIELD & CARRY METRICS
// ============================================================================

/**
 * Real Yield - 10Y Treasury minus inflation
 * Positive real yield = Headwind for gold and growth stocks
 * Negative real yield = Tailwind for gold, growth favored
 */
function calculateRealYield(priceData, latestCPI = null) {
  // TNX is 10Y yield (already in percentage form from Yahoo)
  const yield10y = priceData.TNX?.price || priceData['^TNX']?.price || 0;

  // If we don't have CPI, use a reasonable estimate or skip
  const cpi = latestCPI || 3.0; // Default to ~3% if not provided

  const realYield = yield10y - cpi;

  let interpretation, signal;
  if (realYield > 2.0) {
    interpretation = 'HIGH_REAL_YIELD — Headwind for gold and growth stocks';
    signal = 'BEARISH_GOLD';
  } else if (realYield > 1.0) {
    interpretation = 'POSITIVE — Moderate headwind for gold';
    signal = 'CAUTIOUS_GOLD';
  } else if (realYield > 0) {
    interpretation = 'LOW_POSITIVE — Gold neutral zone';
    signal = 'NEUTRAL';
  } else {
    interpretation = 'NEGATIVE — Gold tailwind, growth stocks favored';
    signal = 'BULLISH_GOLD';
  }

  return {
    value: parseFloat(realYield.toFixed(2)),
    yield10y: parseFloat(yield10y.toFixed(2)),
    cpiUsed: cpi,
    interpretation,
    signal
  };
}

/**
 * US-Japan Carry Trade Indicator
 * Wide spread = Yen weakness likely, carry trade profitable
 * Narrow spread = Carry unwind risk, yen strength risk
 */
function calculateCarryTradeIndicator(priceData, japanYield = 1.0) {
  const usYield = priceData.TNX?.price || priceData['^TNX']?.price || 0;

  // Japan 10Y yield - typically around 0.5-1.5% post-YCC adjustment
  const jpy10y = japanYield;

  const spread = usYield - jpy10y;

  let interpretation, signal;
  if (spread > 3.5) {
    interpretation = 'WIDE — Strong carry incentive, yen likely weak';
    signal = 'YEN_WEAK';
  } else if (spread > 2.5) {
    interpretation = 'MODERATE — Normal carry environment';
    signal = 'NEUTRAL';
  } else if (spread < 2.0) {
    interpretation = 'NARROW — Carry unwind risk, watch for yen strength';
    signal = 'YEN_STRENGTH_RISK';
  } else {
    interpretation = 'NORMAL';
    signal = 'NEUTRAL';
  }

  return {
    value: parseFloat(spread.toFixed(2)),
    usYield: parseFloat(usYield.toFixed(2)),
    japanYield: jpy10y,
    interpretation,
    signal,
    warning: spread < 2.5 ? 'CARRY_UNWIND_WATCH — Could pressure NQ if yen spikes' : null
  };
}

// ============================================================================
// CRYPTO METRICS
// ============================================================================

/**
 * BTC-NQ Correlation Signal
 * When BTC and NQ move together = Risk asset correlation intact
 * Divergence = Potential regime change
 */
function calculateBtcNqCorrelation(priceData) {
  const btcChange = priceData.BTC?.changePercent || priceData['BTC-USD']?.changePercent || 0;
  const nqChange = priceData.NQ?.changePercent || priceData['NQ=F']?.changePercent || 0;

  // Simple same-direction check (for real correlation, need historical data)
  const sameDirection = (btcChange > 0 && nqChange > 0) || (btcChange < 0 && nqChange < 0);
  const divergence = Math.abs(btcChange - nqChange);

  let interpretation, signal;
  if (sameDirection && divergence < 1.0) {
    interpretation = 'CORRELATED — BTC and NQ moving together, risk-on/off intact';
    signal = 'NORMAL';
  } else if (sameDirection && divergence > 2.0) {
    interpretation = 'AMPLIFIED — BTC amplifying NQ move, high beta';
    signal = 'HIGH_BETA';
  } else if (!sameDirection && divergence > 1.5) {
    interpretation = 'DIVERGING — BTC and NQ moving opposite, watch for regime change';
    signal = 'DIVERGENCE';
  } else {
    interpretation = 'MIXED — No clear correlation signal';
    signal = 'NEUTRAL';
  }

  return {
    btcChange: parseFloat(btcChange.toFixed(2)),
    nqChange: parseFloat(nqChange.toFixed(2)),
    divergence: parseFloat(divergence.toFixed(2)),
    sameDirection,
    interpretation,
    signal
  };
}

// ============================================================================
// VIX INTERPRETATION
// ============================================================================

/**
 * VIX Level Interpretation
 * <15 = Complacency, potential for spike
 * 15-20 = Normal
 * 20-30 = Elevated fear
 * >30 = Panic
 */
function interpretVix(priceData) {
  const vix = priceData.VIX?.price || priceData['^VIX']?.price || 0;
  const vixChange = priceData.VIX?.changePercent || priceData['^VIX']?.changePercent || 0;

  let level, interpretation, signal;
  if (vix < 12) {
    level = 'EXTREME_LOW';
    interpretation = 'COMPLACENCY — VIX very low, spike risk elevated';
    signal = 'CAUTION';
  } else if (vix < 15) {
    level = 'LOW';
    interpretation = 'CALM — Low volatility, but watch for complacency';
    signal = 'NEUTRAL';
  } else if (vix < 20) {
    level = 'NORMAL';
    interpretation = 'NORMAL — Healthy volatility environment';
    signal = 'NEUTRAL';
  } else if (vix < 25) {
    level = 'ELEVATED';
    interpretation = 'ELEVATED — Increased fear, caution warranted';
    signal = 'CAUTIOUS';
  } else if (vix < 30) {
    level = 'HIGH';
    interpretation = 'HIGH — Significant fear, potential capitulation setup';
    signal = 'FEAR';
  } else {
    level = 'PANIC';
    interpretation = 'PANIC — Extreme fear, watch for reversal opportunities';
    signal = 'EXTREME_FEAR';
  }

  // VIX spike detection
  let spikeAlert = null;
  if (vixChange > 10) spikeAlert = 'VIX_SPIKE — Up >10% today, risk-off in progress';
  if (vixChange < -10) spikeAlert = 'VIX_CRUSH — Down >10% today, risk-on resuming';

  return {
    value: parseFloat(vix.toFixed(2)),
    change: parseFloat(vixChange.toFixed(2)),
    level,
    interpretation,
    signal,
    spikeAlert
  };
}

// ============================================================================
// DOLLAR IMPACT
// ============================================================================

/**
 * DXY Impact Assessment
 * Strong dollar = Headwind for commodities, multinationals
 * Weak dollar = Tailwind for gold, emerging markets
 */
function assessDollarImpact(priceData) {
  const dxyChange = priceData.DX?.changePercent || priceData['DX-Y.NYB']?.changePercent || 0;
  const dxyPrice = priceData.DX?.price || priceData['DX-Y.NYB']?.price || 0;

  let interpretation, signal;
  const affectedSymbols = [];

  if (dxyChange > 0.3) {
    interpretation = 'DOLLAR_STRENGTH — Headwind for commodities and multinationals';
    signal = 'STRONG';
    affectedSymbols.push(
      { symbol: 'GC', impact: 'BEARISH', reason: 'Gold inverse to dollar' },
      { symbol: 'SI', impact: 'BEARISH', reason: 'Silver inverse to dollar' },
      { symbol: 'CL', impact: 'SLIGHT_BEARISH', reason: 'Oil priced in USD' },
      { symbol: 'NQ', impact: 'SLIGHT_BEARISH', reason: 'Multinational revenue translation' },
      { symbol: '6E', impact: 'BEARISH', reason: 'Euro weakens vs dollar' }
    );
  } else if (dxyChange < -0.3) {
    interpretation = 'DOLLAR_WEAKNESS — Tailwind for commodities and gold';
    signal = 'WEAK';
    affectedSymbols.push(
      { symbol: 'GC', impact: 'BULLISH', reason: 'Gold benefits from weak dollar' },
      { symbol: 'SI', impact: 'BULLISH', reason: 'Silver benefits from weak dollar' },
      { symbol: 'CL', impact: 'SLIGHT_BULLISH', reason: 'Oil cheaper for foreign buyers' },
      { symbol: '6E', impact: 'BULLISH', reason: 'Euro strengthens vs dollar' }
    );
  } else {
    interpretation = 'DOLLAR_STABLE — No significant currency impact today';
    signal = 'NEUTRAL';
  }

  return {
    price: parseFloat(dxyPrice.toFixed(2)),
    change: parseFloat(dxyChange.toFixed(2)),
    interpretation,
    signal,
    affectedSymbols
  };
}

// ============================================================================
// MASTER FUNCTION - Calculate All Metrics
// ============================================================================

/**
 * Calculate all derived metrics from price data
 * @param {Object} priceData - Raw price data from Yahoo Finance
 * @param {Object} options - Optional parameters (latestCPI, japanYield)
 * @returns {Object} - All calculated metrics
 */
function calculateAllMetrics(priceData, options = {}) {
  const { latestCPI = 3.0, japanYield = 1.0 } = options;

  return {
    timestamp: new Date().toISOString(),

    // Rotation & Breadth
    rotation: {
      nqRtySpread: calculateNqRtySpread(priceData),
      growthValue: calculateGrowthValueRatio(priceData)
    },

    // Safe Haven & Risk
    riskSentiment: {
      goldSilverRatio: calculateGoldSilverRatio(priceData),
      hygSignal: calculateHygSignal(priceData),
      vix: interpretVix(priceData)
    },

    // Energy
    energy: {
      crackSpread: calculateCrackSpread(priceData)
    },

    // Yields & Rates
    yields: {
      realYield: calculateRealYield(priceData, latestCPI),
      carryTrade: calculateCarryTradeIndicator(priceData, japanYield)
    },

    // Currency
    currency: {
      dollarImpact: assessDollarImpact(priceData)
    },

    // Crypto
    crypto: {
      btcNqCorrelation: calculateBtcNqCorrelation(priceData)
    },

    // Summary signal
    overallRiskTone: deriveOverallRiskTone(priceData)
  };
}

/**
 * Derive overall risk tone from multiple signals
 */
function deriveOverallRiskTone(priceData) {
  let riskOnSignals = 0;
  let riskOffSignals = 0;

  // Check VIX
  const vix = priceData.VIX?.price || priceData['^VIX']?.price || 20;
  if (vix < 18) riskOnSignals++;
  if (vix > 25) riskOffSignals++;

  // Check HYG
  const hygChange = priceData.HYG?.changePercent || 0;
  if (hygChange > 0.2) riskOnSignals++;
  if (hygChange < -0.2) riskOffSignals++;

  // Check DXY (inverse)
  const dxyChange = priceData.DX?.changePercent || priceData['DX-Y.NYB']?.changePercent || 0;
  if (dxyChange < -0.2) riskOnSignals++; // Weak dollar = risk-on
  if (dxyChange > 0.3) riskOffSignals++; // Strong dollar = risk-off

  // Check NQ vs RTY (breadth)
  const nqChange = priceData.NQ?.changePercent || priceData['NQ=F']?.changePercent || 0;
  const rtyChange = priceData.RTY?.changePercent || priceData['RTY=F']?.changePercent || 0;
  if (rtyChange > nqChange && rtyChange > 0.3) riskOnSignals++; // Breadth = healthy risk-on

  let tone, confidence;
  if (riskOnSignals >= 3 && riskOffSignals === 0) {
    tone = 'RISK_ON';
    confidence = 'HIGH';
  } else if (riskOffSignals >= 3 && riskOnSignals === 0) {
    tone = 'RISK_OFF';
    confidence = 'HIGH';
  } else if (riskOnSignals > riskOffSignals) {
    tone = 'LEAN_RISK_ON';
    confidence = 'MODERATE';
  } else if (riskOffSignals > riskOnSignals) {
    tone = 'LEAN_RISK_OFF';
    confidence = 'MODERATE';
  } else {
    tone = 'MIXED';
    confidence = 'LOW';
  }

  return {
    tone,
    confidence,
    riskOnSignals,
    riskOffSignals
  };
}

export {
  calculateAllMetrics,
  calculateNqRtySpread,
  calculateGrowthValueRatio,
  calculateGoldSilverRatio,
  calculateHygSignal,
  calculateCrackSpread,
  calculateRealYield,
  calculateCarryTradeIndicator,
  calculateBtcNqCorrelation,
  interpretVix,
  assessDollarImpact,
  deriveOverallRiskTone
};
