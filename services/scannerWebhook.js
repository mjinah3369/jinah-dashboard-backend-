// ============================================================================
// SCANNER WEBHOOK SERVICE
// Receives real-time data from TradingView Pine Script webhooks
// ============================================================================

// In-memory store for scanner data (resets on server restart)
// For production, consider using Redis or a database
const scannerData = new Map();

// Store last update timestamp per symbol
const lastUpdates = new Map();

/**
 * Process incoming webhook from TradingView
 * @param {Object} payload - JSON payload from TradingView alert
 * @returns {Object} - Processed scanner data
 */
export function processWebhook(payload) {
  try {
    const symbol = normalizeSymbol(payload.symbol);

    if (!symbol) {
      console.error('Webhook missing symbol:', payload);
      return { error: 'Missing symbol' };
    }

    // Build scanner entry
    const scannerEntry = {
      symbol,
      timestamp: new Date().toISOString(),
      receivedAt: Date.now(),

      // Price data
      price: parseFloat(payload.price) || 0,
      change: parseFloat(payload.change) || 0,
      changePercent: parseFloat(payload.change_pct) || 0,

      // ADX
      adx: {
        value: parseFloat(payload.adx_value) || 0,
        status: payload.adx_status || 'UNKNOWN',
        plusDI: parseFloat(payload.plus_di) || 0,
        minusDI: parseFloat(payload.minus_di) || 0
      },

      // EMA
      ema: {
        ema21: parseFloat(payload.ema21) || 0,
        ema55: parseFloat(payload.ema55) || 0,
        gap: parseFloat(payload.ema_gap) || 0,
        status: payload.ema_status || 'UNKNOWN'
      },

      // VWAP
      vwap: {
        value: parseFloat(payload.vwap) || 0,
        upper2: parseFloat(payload.vwap_upper2) || 0,
        upper1: parseFloat(payload.vwap_upper1) || 0,
        lower1: parseFloat(payload.vwap_lower1) || 0,
        lower2: parseFloat(payload.vwap_lower2) || 0,
        zone: payload.vwap_zone || 'UNKNOWN'
      },

      // Bollinger Bands
      bollinger: {
        width: parseFloat(payload.bb_width) || 0,
        status: payload.bb_status || 'UNKNOWN'
      },

      // Volume
      volume: {
        ratio: parseFloat(payload.vol_ratio) || 1,
        status: payload.vol_status || 'NORMAL'
      },

      // Session Levels
      levels: {
        pdh: parseFloat(payload.pdh) || 0,
        pdl: parseFloat(payload.pdl) || 0,
        onh: parseFloat(payload.onh) || 0,
        onl: parseFloat(payload.onl) || 0
      },

      // Sweep Detection
      sweep: {
        detected: payload.sweep_detected === true || payload.sweep_detected === 'true',
        type: payload.sweep_type || 'NONE'
      },

      // Scoring
      bias: payload.bias || 'NEUTRAL',
      score: {
        trend: parseInt(payload.trend_pts) || 0,
        direction: parseInt(payload.direction_pts) || 0,
        location: parseInt(payload.location_pts) || 0,
        volume: parseInt(payload.volume_pts) || 0,
        catalyst: parseInt(payload.catalyst_pts) || 0,
        total: parseInt(payload.total_score) || 0,
        grade: payload.grade || 'F'
      },

      // Generate reasoning
      reasoning: generateReasoning(payload)
    };

    // Store the data
    scannerData.set(symbol, scannerEntry);
    lastUpdates.set(symbol, Date.now());

    console.log(`Scanner webhook received: ${symbol} | Score: ${scannerEntry.score.total} (${scannerEntry.score.grade}) | Bias: ${scannerEntry.bias}`);

    return scannerEntry;

  } catch (error) {
    console.error('Error processing webhook:', error);
    return { error: error.message };
  }
}

/**
 * Normalize symbol names from TradingView format
 */
function normalizeSymbol(symbol) {
  if (!symbol) return null;

  // Remove exchange prefix (CME_MINI:ES1!, etc.)
  let normalized = symbol.toUpperCase();

  // Common TradingView futures symbol patterns
  const patterns = [
    /^CME_MINI:(\w+)1!$/,  // CME_MINI:ES1! → ES
    /^COMEX:(\w+)1!$/,      // COMEX:GC1! → GC
    /^NYMEX:(\w+)1!$/,      // NYMEX:CL1! → CL
    /^CBOT:(\w+)1!$/,       // CBOT:ZN1! → ZN
    /^(\w+)1!$/,            // ES1! → ES
    /^(\w+)$/               // ES → ES
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Return first 2-3 characters if no pattern matches
  return normalized.slice(0, 3).replace(/[0-9!]/g, '');
}

/**
 * Generate human-readable reasoning for the score
 */
function generateReasoning(payload) {
  const reasons = [];

  // ADX reasoning
  const adx = parseFloat(payload.adx_value) || 0;
  if (adx > 25) {
    reasons.push(`Strong trend (ADX ${adx.toFixed(1)})`);
  } else if (adx > 20) {
    reasons.push(`Weak trend developing (ADX ${adx.toFixed(1)})`);
  } else {
    reasons.push(`Ranging/choppy conditions (ADX ${adx.toFixed(1)})`);
  }

  // EMA reasoning
  const emaStatus = payload.ema_status || '';
  if (emaStatus.includes('BULLISH_SEPARATED')) {
    reasons.push('EMAs bullish and well separated - strong uptrend');
  } else if (emaStatus.includes('BEARISH_SEPARATED')) {
    reasons.push('EMAs bearish and well separated - strong downtrend');
  } else if (emaStatus.includes('BULLISH_CLOSE')) {
    reasons.push('EMAs bullish but close together - weak uptrend');
  } else if (emaStatus.includes('BEARISH_CLOSE')) {
    reasons.push('EMAs bearish but close together - weak downtrend');
  } else {
    reasons.push('EMAs neutral - no clear direction');
  }

  // VWAP reasoning
  const vwapZone = payload.vwap_zone || '';
  const bias = payload.bias || 'NEUTRAL';
  if (bias === 'LONG') {
    if (vwapZone.includes('OVERSOLD')) {
      reasons.push('Price in value zone for longs - good entry area');
    } else if (vwapZone.includes('OVERBOUGHT')) {
      reasons.push('Price extended above VWAP - wait for pullback');
    } else if (vwapZone === 'ABOVE_VWAP') {
      reasons.push('Price above VWAP - holding long bias');
    }
  } else if (bias === 'SHORT') {
    if (vwapZone.includes('OVERBOUGHT')) {
      reasons.push('Price in value zone for shorts - good entry area');
    } else if (vwapZone.includes('OVERSOLD')) {
      reasons.push('Price extended below VWAP - wait for pullback');
    } else if (vwapZone === 'BELOW_VWAP') {
      reasons.push('Price below VWAP - holding short bias');
    }
  }

  // Volume reasoning
  const volRatio = parseFloat(payload.vol_ratio) || 1;
  if (volRatio > 1.5) {
    reasons.push(`Volume spike (${volRatio.toFixed(2)}x avg) - confirming move`);
  } else if (volRatio < 0.8) {
    reasons.push('Low volume - move lacks conviction');
  }

  // Bollinger reasoning
  if (payload.bb_status === 'SQUEEZE') {
    reasons.push('Bollinger squeeze detected - breakout imminent');
  }

  // Sweep reasoning
  if (payload.sweep_detected === true || payload.sweep_detected === 'true') {
    if (payload.sweep_type === 'LOW_SWEEP' && bias === 'LONG') {
      reasons.push('Low sweep aligned with long bias - bullish reversal signal');
    } else if (payload.sweep_type === 'HIGH_SWEEP' && bias === 'SHORT') {
      reasons.push('High sweep aligned with short bias - bearish reversal signal');
    } else if (payload.sweep_type === 'LOW_SWEEP') {
      reasons.push('Low sweep detected - watch for reversal');
    } else if (payload.sweep_type === 'HIGH_SWEEP') {
      reasons.push('High sweep detected - watch for reversal');
    }
  }

  return reasons;
}

/**
 * Get all scanner data
 */
export function getAllScannerData() {
  const data = {};
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes

  for (const [symbol, entry] of scannerData) {
    const lastUpdate = lastUpdates.get(symbol) || 0;
    const isStale = (now - lastUpdate) > staleThreshold;

    data[symbol] = {
      ...entry,
      isStale,
      lastUpdateAgo: formatTimeAgo(lastUpdate)
    };
  }

  return data;
}

/**
 * Get scanner data for a specific symbol
 */
export function getScannerData(symbol) {
  const normalized = normalizeSymbol(symbol);
  const entry = scannerData.get(normalized);

  if (!entry) {
    return null;
  }

  const lastUpdate = lastUpdates.get(normalized) || 0;
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;

  return {
    ...entry,
    isStale: (now - lastUpdate) > staleThreshold,
    lastUpdateAgo: formatTimeAgo(lastUpdate)
  };
}

/**
 * Get summary of all instruments sorted by score
 */
export function getScannerSummary() {
  const data = getAllScannerData();
  const instruments = Object.values(data);

  // Sort by score (highest first)
  instruments.sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));

  // Group by grade
  const byGrade = {
    'A+': instruments.filter(i => i.score?.grade === 'A+'),
    'A': instruments.filter(i => i.score?.grade === 'A'),
    'B': instruments.filter(i => i.score?.grade === 'B'),
    'C': instruments.filter(i => i.score?.grade === 'C'),
    'F': instruments.filter(i => i.score?.grade === 'F')
  };

  // Group by bias
  const byBias = {
    'LONG': instruments.filter(i => i.bias === 'LONG'),
    'SHORT': instruments.filter(i => i.bias === 'SHORT'),
    'NEUTRAL': instruments.filter(i => i.bias === 'NEUTRAL')
  };

  // Find top opportunities
  const topLongs = instruments
    .filter(i => i.bias === 'LONG' && i.score?.total >= 70)
    .slice(0, 3);

  const topShorts = instruments
    .filter(i => i.bias === 'SHORT' && i.score?.total >= 70)
    .slice(0, 3);

  return {
    total: instruments.length,
    lastUpdate: new Date().toISOString(),
    byGrade,
    byBias,
    topLongs,
    topShorts,
    allInstruments: instruments
  };
}

/**
 * Format time ago string
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never';

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Clear all scanner data (useful for testing)
 */
export function clearScannerData() {
  scannerData.clear();
  lastUpdates.clear();
  console.log('Scanner data cleared');
}

export default {
  processWebhook,
  getAllScannerData,
  getScannerData,
  getScannerSummary,
  clearScannerData
};
