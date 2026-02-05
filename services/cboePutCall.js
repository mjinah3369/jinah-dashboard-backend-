/**
 * CBOE Put/Call Ratio
 * FREE data from CBOE market statistics
 *
 * Data source: https://www.cboe.com/market_statistics/
 *
 * Key Ratios:
 * - Total Put/Call Ratio
 * - Equity Put/Call Ratio (most watched)
 * - Index Put/Call Ratio
 *
 * Interpretation:
 * - High ratio (>1.0) = Bearish sentiment, potential bottom (contrarian bullish)
 * - Low ratio (<0.7) = Bullish sentiment, potential top (contrarian bearish)
 * - Normal range: 0.7-1.0
 */

// Since CBOE data requires scraping, we use mock data
// In production, you would scrape from CBOE or use a data provider

const MOCK_PUT_CALL_DATA = {
  date: new Date().toISOString().split('T')[0],
  total: {
    ratio: 0.92,
    puts: 2450000,
    calls: 2663000
  },
  equity: {
    ratio: 0.78,
    puts: 1850000,
    calls: 2372000
  },
  index: {
    ratio: 1.15,
    puts: 600000,
    calls: 522000
  },
  vix: {
    ratio: 0.85,
    puts: 125000,
    calls: 147000
  }
};

// Historical averages for context
const HISTORICAL_AVERAGES = {
  total: { mean: 0.95, low: 0.65, high: 1.25 },
  equity: { mean: 0.72, low: 0.50, high: 1.10 },
  index: { mean: 1.20, low: 0.80, high: 1.60 }
};

/**
 * Get current put/call ratio data
 */
function getPutCallRatio() {
  const data = MOCK_PUT_CALL_DATA;

  return {
    date: data.date,
    total: analyzePutCallRatio(data.total, 'total'),
    equity: analyzePutCallRatio(data.equity, 'equity'),
    index: analyzePutCallRatio(data.index, 'index'),
    vix: analyzePutCallRatio(data.vix, 'vix'),
    summary: generateSummary(data),
    isMock: true
  };
}

/**
 * Analyze a specific put/call ratio
 */
function analyzePutCallRatio(data, type) {
  const ratio = data.ratio;
  const avg = HISTORICAL_AVERAGES[type] || { mean: 1.0, low: 0.7, high: 1.3 };

  // Determine level relative to historical
  let level;
  if (ratio < avg.low) level = 'EXTREME_LOW';
  else if (ratio < avg.mean - 0.1) level = 'LOW';
  else if (ratio > avg.high) level = 'EXTREME_HIGH';
  else if (ratio > avg.mean + 0.1) level = 'HIGH';
  else level = 'NORMAL';

  // Interpretation
  let interpretation, signal;

  if (type === 'equity') {
    // Equity P/C is most watched for sentiment
    if (ratio > 1.0) {
      interpretation = 'HIGH_FEAR — Extreme put buying, contrarian bullish';
      signal = 'CONTRARIAN_BULLISH';
    } else if (ratio > 0.85) {
      interpretation = 'ELEVATED — Above average put buying, cautiously bullish';
      signal = 'CAUTIOUS_BULLISH';
    } else if (ratio < 0.55) {
      interpretation = 'EXTREME_COMPLACENCY — Heavy call buying, contrarian bearish';
      signal = 'CONTRARIAN_BEARISH';
    } else if (ratio < 0.65) {
      interpretation = 'COMPLACENCY — Low put buying, caution warranted';
      signal = 'CAUTIOUS';
    } else {
      interpretation = 'NEUTRAL — Normal sentiment';
      signal = 'NEUTRAL';
    }
  } else if (type === 'index') {
    // Index P/C typically higher (hedging)
    if (ratio > 1.5) {
      interpretation = 'HEAVY_HEDGING — Institutions buying protection';
      signal = 'RISK_OFF';
    } else if (ratio < 0.9) {
      interpretation = 'LOW_HEDGING — Institutions complacent';
      signal = 'RISK_ON';
    } else {
      interpretation = 'NORMAL_HEDGING';
      signal = 'NEUTRAL';
    }
  } else {
    // Total or VIX
    if (ratio > 1.1) {
      interpretation = 'BEARISH_SENTIMENT — Elevated put activity';
      signal = 'CONTRARIAN_BULLISH';
    } else if (ratio < 0.75) {
      interpretation = 'BULLISH_SENTIMENT — Elevated call activity';
      signal = 'CONTRARIAN_BEARISH';
    } else {
      interpretation = 'NEUTRAL';
      signal = 'NEUTRAL';
    }
  }

  return {
    ratio: parseFloat(ratio.toFixed(2)),
    puts: data.puts,
    calls: data.calls,
    level,
    vsAverage: parseFloat((ratio - avg.mean).toFixed(2)),
    interpretation,
    signal
  };
}

/**
 * Generate overall summary
 */
function generateSummary(data) {
  const equityRatio = data.equity.ratio;
  const indexRatio = data.index.ratio;

  let overallSentiment;
  let tradingImplication;

  // Equity ratio is most important for sentiment
  if (equityRatio > 0.95 && indexRatio > 1.3) {
    overallSentiment = 'EXTREME_FEAR';
    tradingImplication = 'CONTRARIAN_BUY — High fear often marks bottoms';
  } else if (equityRatio > 0.85) {
    overallSentiment = 'ELEVATED_FEAR';
    tradingImplication = 'CAUTIOUSLY_BULLISH — Sentiment favors bulls';
  } else if (equityRatio < 0.55) {
    overallSentiment = 'EXTREME_GREED';
    tradingImplication = 'CONTRARIAN_SELL — Complacency often marks tops';
  } else if (equityRatio < 0.65) {
    overallSentiment = 'ELEVATED_GREED';
    tradingImplication = 'CAUTIOUS — Sentiment stretched bullish';
  } else {
    overallSentiment = 'NEUTRAL';
    tradingImplication = 'NO_EDGE — Sentiment not at extremes';
  }

  return {
    overallSentiment,
    tradingImplication,
    equityRatio: parseFloat(equityRatio.toFixed(2)),
    indexRatio: parseFloat(indexRatio.toFixed(2))
  };
}

/**
 * Get historical context (mock - would need historical data)
 */
function getHistoricalContext() {
  return {
    '5dayAvg': {
      equity: 0.75,
      index: 1.18,
      total: 0.94
    },
    '20dayAvg': {
      equity: 0.73,
      index: 1.22,
      total: 0.96
    },
    '52weekHigh': {
      equity: 1.25,
      index: 1.85,
      total: 1.35
    },
    '52weekLow': {
      equity: 0.48,
      index: 0.75,
      total: 0.58
    }
  };
}

/**
 * Get put/call summary for AI agents
 */
function getPutCallSummaryForAgent(pcData) {
  if (!pcData) return 'Put/Call ratio data not available';

  const lines = [];

  if (pcData.equity) {
    lines.push(`Equity P/C: ${pcData.equity.ratio} (${pcData.equity.interpretation})`);
  }

  if (pcData.index) {
    lines.push(`Index P/C: ${pcData.index.ratio} (${pcData.index.interpretation})`);
  }

  if (pcData.summary) {
    lines.push(`Overall Sentiment: ${pcData.summary.overallSentiment}`);
    lines.push(`Trading Implication: ${pcData.summary.tradingImplication}`);
  }

  return lines.join('\n');
}

/**
 * Check if put/call is at extreme (for alerts)
 */
function isAtExtreme(pcData) {
  if (!pcData) return { isExtreme: false };

  const equity = pcData.equity?.ratio || 0;

  if (equity > 1.0) {
    return {
      isExtreme: true,
      type: 'HIGH',
      message: 'Put/Call ratio extremely high - potential bottom signal'
    };
  }

  if (equity < 0.55) {
    return {
      isExtreme: true,
      type: 'LOW',
      message: 'Put/Call ratio extremely low - potential top signal'
    };
  }

  return { isExtreme: false };
}

export {
  getPutCallRatio,
  getHistoricalContext,
  getPutCallSummaryForAgent,
  isAtExtreme
};
