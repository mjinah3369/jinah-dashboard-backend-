// Technical Analysis Service
// Calculates EMAs, ADX, and trend signals for all instruments

/**
 * Calculate Exponential Moving Average
 * @param {number[]} prices - Array of closing prices (oldest to newest)
 * @param {number} period - EMA period (9, 21, 50)
 * @returns {number} - Current EMA value
 */
function calculateEMA(prices, period) {
  if (prices.length < period) return null;

  const multiplier = 2 / (period + 1);

  // Start with SMA for first EMA value
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return parseFloat(ema.toFixed(4));
}

/**
 * Calculate ADX (Average Directional Index) with DI+ and DI-
 * @param {Object[]} candles - Array of {high, low, close} objects
 * @param {number} period - ADX period (typically 14)
 * @returns {Object} - { adx, diPlus, diMinus }
 */
function calculateADX(candles, period = 14) {
  if (candles.length < period + 1) return null;

  const trueRanges = [];
  const plusDMs = [];
  const minusDMs = [];

  // Calculate TR, +DM, -DM for each candle
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    // True Range
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    trueRanges.push(tr);

    // +DM and -DM
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Smooth the values using Wilder's smoothing
  const smoothTR = wilderSmooth(trueRanges, period);
  const smoothPlusDM = wilderSmooth(plusDMs, period);
  const smoothMinusDM = wilderSmooth(minusDMs, period);

  // Calculate +DI and -DI
  const diPlus = (smoothPlusDM / smoothTR) * 100;
  const diMinus = (smoothMinusDM / smoothTR) * 100;

  // Calculate DX
  const diDiff = Math.abs(diPlus - diMinus);
  const diSum = diPlus + diMinus;
  const dx = diSum === 0 ? 0 : (diDiff / diSum) * 100;

  // For proper ADX, we'd need to smooth DX over the period
  // Simplified version - using current DX as approximation
  const adx = dx;

  return {
    adx: parseFloat(adx.toFixed(2)),
    diPlus: parseFloat(diPlus.toFixed(2)),
    diMinus: parseFloat(diMinus.toFixed(2))
  };
}

/**
 * Wilder's Smoothing Method
 */
function wilderSmooth(values, period) {
  if (values.length < period) return 0;

  // First value is sum of first 'period' values
  let smooth = values.slice(0, period).reduce((sum, v) => sum + v, 0);

  // Subsequent values use Wilder's smoothing
  for (let i = period; i < values.length; i++) {
    smooth = smooth - (smooth / period) + values[i];
  }

  return smooth / period;
}

/**
 * Fetch historical data from Yahoo Finance
 * @param {string} symbol - Yahoo Finance symbol (e.g., 'ES=F')
 * @param {number} days - Number of days of history
 * @returns {Object} - { closes, candles }
 */
async function fetchHistoricalData(symbol, days = 60) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Historical data fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result || !result.indicators?.quote?.[0]) {
      return null;
    }

    const quote = result.indicators.quote[0];
    const closes = quote.close?.filter(p => p !== null) || [];
    const highs = quote.high?.filter(p => p !== null) || [];
    const lows = quote.low?.filter(p => p !== null) || [];

    // Build candles array
    const candles = [];
    const minLength = Math.min(closes.length, highs.length, lows.length);

    for (let i = 0; i < minLength; i++) {
      if (closes[i] && highs[i] && lows[i]) {
        candles.push({
          close: closes[i],
          high: highs[i],
          low: lows[i]
        });
      }
    }

    return { closes, candles };
  } catch (error) {
    console.error(`Historical data error for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Calculate all technical indicators for a symbol
 * @param {string} symbol - Yahoo Finance symbol
 * @returns {Object} - Technical analysis results
 */
async function analyzeTechnicals(symbol) {
  const historical = await fetchHistoricalData(symbol);

  if (!historical || historical.closes.length < 50) {
    return {
      available: false,
      reason: 'Insufficient historical data'
    };
  }

  const { closes, candles } = historical;
  const currentPrice = closes[closes.length - 1];

  // Calculate EMAs
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);

  // Calculate ADX
  const adxData = calculateADX(candles, 14);

  // Determine EMA trend
  let emaTrend = 'Neutral';
  let emaSignal = 0;

  if (currentPrice > ema9 && currentPrice > ema21 && currentPrice > ema50) {
    emaTrend = 'Strong Bullish';
    emaSignal = 2;
  } else if (currentPrice > ema9 && currentPrice > ema21) {
    emaTrend = 'Bullish';
    emaSignal = 1;
  } else if (currentPrice < ema9 && currentPrice < ema21 && currentPrice < ema50) {
    emaTrend = 'Strong Bearish';
    emaSignal = -2;
  } else if (currentPrice < ema9 && currentPrice < ema21) {
    emaTrend = 'Bearish';
    emaSignal = -1;
  } else if (ema9 > ema21) {
    emaTrend = 'Slight Bullish';
    emaSignal = 0.5;
  } else if (ema9 < ema21) {
    emaTrend = 'Slight Bearish';
    emaSignal = -0.5;
  }

  // Determine ADX trend strength and direction
  let trendStrength = 'Weak';
  let trendDirection = 'Neutral';

  if (adxData) {
    if (adxData.adx >= 40) {
      trendStrength = 'Very Strong';
    } else if (adxData.adx >= 25) {
      trendStrength = 'Strong';
    } else if (adxData.adx >= 20) {
      trendStrength = 'Moderate';
    } else {
      trendStrength = 'Weak';
    }

    if (adxData.diPlus > adxData.diMinus) {
      trendDirection = 'Bullish';
    } else if (adxData.diMinus > adxData.diPlus) {
      trendDirection = 'Bearish';
    }
  }

  // Calculate volume trend (compare recent vs average)
  // Note: Would need volume data for this - simplified here

  return {
    available: true,
    currentPrice,
    ema: {
      ema9,
      ema21,
      ema50,
      trend: emaTrend,
      signal: emaSignal,
      priceVsEma9: currentPrice > ema9 ? 'Above' : 'Below',
      priceVsEma21: currentPrice > ema21 ? 'Above' : 'Below',
      priceVsEma50: currentPrice > ema50 ? 'Above' : 'Below'
    },
    adx: adxData ? {
      value: adxData.adx,
      diPlus: adxData.diPlus,
      diMinus: adxData.diMinus,
      strength: trendStrength,
      direction: trendDirection
    } : null,
    summary: generateTechnicalSummary(emaTrend, trendStrength, trendDirection, adxData)
  };
}

/**
 * Generate human-readable technical summary
 */
function generateTechnicalSummary(emaTrend, trendStrength, trendDirection, adxData) {
  const parts = [];

  // EMA summary
  if (emaTrend.includes('Bullish')) {
    parts.push(`Price in uptrend (${emaTrend.toLowerCase()})`);
  } else if (emaTrend.includes('Bearish')) {
    parts.push(`Price in downtrend (${emaTrend.toLowerCase()})`);
  } else {
    parts.push('Price consolidating near moving averages');
  }

  // ADX summary
  if (adxData) {
    if (adxData.adx >= 25) {
      parts.push(`${trendStrength} trend (ADX: ${adxData.adx})`);
    } else {
      parts.push(`Weak/No clear trend (ADX: ${adxData.adx})`);
    }
  }

  return parts.join('. ') + '.';
}

/**
 * Determine if an instrument is "trending" (hot)
 * @param {Object} instrument - Instrument data with price, change, volume
 * @param {Object} technicals - Technical analysis results
 * @param {boolean} hasFundamentalCatalyst - Whether there's a fundamental event
 * @returns {Object} - Trending status
 */
function detectTrending(instrument, technicals, hasFundamentalCatalyst = false) {
  let score = 0;
  const reasons = [];

  // Price movement (weight: 30%)
  const absChange = Math.abs(instrument.changePercent || 0);
  if (absChange >= 2.0) {
    score += 3;
    reasons.push(`Large move (${absChange.toFixed(2)}%)`);
  } else if (absChange >= 1.0) {
    score += 2;
    reasons.push(`Notable move (${absChange.toFixed(2)}%)`);
  } else if (absChange >= 0.5) {
    score += 1;
  }

  // Technical trend strength (weight: 30%)
  if (technicals?.available && technicals.adx) {
    if (technicals.adx.value >= 30) {
      score += 3;
      reasons.push(`Strong trend (ADX: ${technicals.adx.value})`);
    } else if (technicals.adx.value >= 25) {
      score += 2;
      reasons.push('Trending');
    }
  }

  // EMA alignment (weight: 20%)
  if (technicals?.available) {
    if (Math.abs(technicals.ema?.signal || 0) >= 2) {
      score += 2;
      reasons.push('EMAs aligned');
    }
  }

  // Fundamental catalyst (weight: 20%)
  if (hasFundamentalCatalyst) {
    score += 2;
    reasons.push('Fundamental catalyst');
  }

  // Determine trending level
  let level = 'Normal';
  let isTrending = false;

  if (score >= 7) {
    level = 'Hot';
    isTrending = true;
  } else if (score >= 5) {
    level = 'Active';
    isTrending = true;
  } else if (score >= 3) {
    level = 'Moderate';
  }

  return {
    isTrending,
    level,
    score,
    reasons
  };
}

// Yahoo Finance symbol mapping
const YAHOO_SYMBOLS = {
  // Equity Indices
  'ES': 'ES=F',
  'NQ': 'NQ=F',
  'YM': 'YM=F',
  'RTY': 'RTY=F',
  // Bonds
  'ZT': 'ZT=F',
  'ZF': 'ZF=F',
  'ZN': 'ZN=F',
  'TN': 'TN=F',
  'ZB': 'ZB=F',
  // Metals
  'GC': 'GC=F',
  'SI': 'SI=F',
  'HG': 'HG=F',
  // Energy
  'CL': 'CL=F',
  'NG': 'NG=F',
  'RB': 'RB=F',
  // Agriculture
  'ZS': 'ZS=F',
  'ZC': 'ZC=F',
  'ZW': 'ZW=F',
  'ZM': 'ZM=F',
  'ZL': 'ZL=F',
  'LE': 'LE=F',
  'HE': 'HE=F',
  // Crypto
  'BTC': 'BTC-USD',
  'ETH': 'ETH-USD',
  // Volatility
  'VIX': '^VIX',
  // Currencies
  'DX': 'DX-Y.NYB',
  '6E': '6E=F',
  '6J': '6J=F',
  '6B': '6B=F',
  '6A': '6A=F'
};

/**
 * Get technical analysis for all main futures instruments
 */
async function analyzeAllInstruments() {
  const mainSymbols = ['ES', 'NQ', 'YM', 'RTY', 'CL', 'NG', 'GC', 'SI', 'ZN', 'ZB', 'ZC', 'ZS', 'ZW'];

  const results = {};

  await Promise.all(
    mainSymbols.map(async (symbol) => {
      const yahooSymbol = YAHOO_SYMBOLS[symbol];
      if (yahooSymbol) {
        results[symbol] = await analyzeTechnicals(yahooSymbol);
      }
    })
  );

  return results;
}

export {
  calculateEMA,
  calculateADX,
  fetchHistoricalData,
  analyzeTechnicals,
  analyzeAllInstruments,
  detectTrending,
  YAHOO_SYMBOLS
};
