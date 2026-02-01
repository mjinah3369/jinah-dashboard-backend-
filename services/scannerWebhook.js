// ============================================================================
// SCANNER WEBHOOK SERVICE v2.0
// Receives real-time data from TradingView Pine Script webhooks
// Supports: ICT Model Scanner + Order Flow Scanner
// ============================================================================

// In-memory store for scanner data (resets on server restart)
// For production, consider using Redis or a database
const ictScannerData = new Map();    // ICT Model Scanner data
const orderFlowData = new Map();      // Order Flow Scanner data
const lastUpdates = new Map();

/**
 * Process incoming webhook from TradingView
 * Detects scanner type and routes appropriately
 * @param {Object} payload - JSON payload from TradingView alert
 * @returns {Object} - Processed scanner data
 */
export function processWebhook(payload) {
  try {
    // Detect scanner type
    const scannerType = detectScannerType(payload);

    console.log(`[Webhook] Received ${scannerType} scanner data`);

    if (scannerType === 'ict') {
      return processICTWebhook(payload);
    } else if (scannerType === 'orderflow') {
      return processOrderFlowWebhook(payload);
    } else if (scannerType === 'batch') {
      return processBatchWebhook(payload);
    } else {
      // Legacy single-symbol format
      return processLegacyWebhook(payload);
    }

  } catch (error) {
    console.error('Error processing webhook:', error);
    return { error: error.message };
  }
}

/**
 * Detect which scanner type sent the webhook
 */
function detectScannerType(payload) {
  // Check for explicit scanner type
  if (payload.scanner_type === 'ict' || payload.scannerType === 'ict') {
    return 'ict';
  }
  if (payload.scanner_type === 'orderflow' || payload.scannerType === 'orderflow') {
    return 'orderflow';
  }

  // Check for batch data array
  if (payload.data && Array.isArray(payload.data)) {
    return 'batch';
  }
  if (payload.d && Array.isArray(payload.d)) {
    return 'batch';
  }

  // Detect by field presence
  if (payload.dayPos || payload.weekPos || payload.sweepStatus || payload.obZone || payload.structure) {
    return 'ict';
  }
  if (payload.vaZone || payload.vwapZone || payload.pocPos || payload.delta || payload.absorp || payload.pressure) {
    return 'orderflow';
  }

  return 'legacy';
}

// ============================================================================
// ICT MODEL SCANNER
// ============================================================================
function processICTWebhook(payload) {
  const timestamp = new Date().toISOString();
  const receivedAt = Date.now();

  // Handle batch format from Pine Script
  if (payload.data || payload.d) {
    const items = payload.data || payload.d;
    const results = [];

    for (const item of items) {
      const symbol = normalizeSymbol(item.s || item.symbol);
      if (!symbol) continue;

      const entry = {
        symbol,
        timestamp,
        receivedAt,
        scannerType: 'ict',

        // Price
        price: parseFloat(item.p || item.price) || 0,
        changePercent: parseFloat(item.c || item.change) || 0,

        // ICT Levels
        dayPosition: item.day || item.dayPos || 'IN RANGE',
        weekPosition: item.week || item.weekPos || 'IN RANGE',

        // Sweep
        sweepStatus: item.sweep || item.sweepStatus || 'NONE',

        // Order Block
        obZone: item.ob || item.obZone || 'NONE',

        // Structure
        structure: item.struct || item.structure || 'RANGING',

        // Bias
        bias: item.bias || item.b || 'NEUT'
      };

      ictScannerData.set(symbol, entry);
      lastUpdates.set(`ict_${symbol}`, receivedAt);
      results.push(entry);

      console.log(`[ICT] ${symbol}: ${entry.bias} | Day: ${entry.dayPosition} | Sweep: ${entry.sweepStatus}`);
    }

    return { type: 'ict', count: results.length, data: results };
  }

  // Single symbol format
  const symbol = normalizeSymbol(payload.symbol || payload.s);
  if (!symbol) {
    return { error: 'Missing symbol' };
  }

  const entry = {
    symbol,
    timestamp,
    receivedAt,
    scannerType: 'ict',
    price: parseFloat(payload.price || payload.p) || 0,
    changePercent: parseFloat(payload.change || payload.c) || 0,
    dayPosition: payload.dayPos || payload.day || 'IN RANGE',
    weekPosition: payload.weekPos || payload.week || 'IN RANGE',
    sweepStatus: payload.sweepStatus || payload.sweep || 'NONE',
    obZone: payload.obZone || payload.ob || 'NONE',
    structure: payload.structure || payload.struct || 'RANGING',
    bias: payload.bias || payload.b || 'NEUT'
  };

  ictScannerData.set(symbol, entry);
  lastUpdates.set(`ict_${symbol}`, receivedAt);

  console.log(`[ICT] ${symbol}: ${entry.bias} | Day: ${entry.dayPosition} | Sweep: ${entry.sweepStatus}`);

  return { type: 'ict', data: entry };
}

// ============================================================================
// ORDER FLOW SCANNER
// ============================================================================
function processOrderFlowWebhook(payload) {
  const timestamp = new Date().toISOString();
  const receivedAt = Date.now();

  // Handle batch format from Pine Script
  if (payload.data || payload.d) {
    const items = payload.data || payload.d;
    const results = [];

    for (const item of items) {
      const symbol = normalizeSymbol(item.s || item.symbol);
      if (!symbol) continue;

      const entry = {
        symbol,
        timestamp,
        receivedAt,
        scannerType: 'orderflow',

        // Price
        price: parseFloat(item.p || item.price) || 0,
        changePercent: parseFloat(item.c || item.change) || 0,

        // Value Area
        vaZone: item.va || item.vaZone || 'IN VA',

        // VWAP
        vwapZone: item.vwap || item.vwapZone || 'ABOVE',

        // POC
        pocPosition: item.poc || item.pocPos || 'ABOVE POC',

        // Delta
        delta: item.delta || item.d || 'NEUT',

        // Volume
        volumeStatus: item.vol || item.volStatus || 'NORM',

        // Absorption
        absorption: item.abs || item.absorp || 'NONE',

        // Pressure
        pressure: item.press || item.pressure || 'NEUT'
      };

      orderFlowData.set(symbol, entry);
      lastUpdates.set(`of_${symbol}`, receivedAt);
      results.push(entry);

      console.log(`[OF] ${symbol}: ${entry.pressure} | VA: ${entry.vaZone} | Delta: ${entry.delta}`);
    }

    return { type: 'orderflow', count: results.length, data: results };
  }

  // Single symbol format
  const symbol = normalizeSymbol(payload.symbol || payload.s);
  if (!symbol) {
    return { error: 'Missing symbol' };
  }

  const entry = {
    symbol,
    timestamp,
    receivedAt,
    scannerType: 'orderflow',
    price: parseFloat(payload.price || payload.p) || 0,
    changePercent: parseFloat(payload.change || payload.c) || 0,
    vaZone: payload.vaZone || payload.va || 'IN VA',
    vwapZone: payload.vwapZone || payload.vwap || 'ABOVE',
    pocPosition: payload.pocPos || payload.poc || 'ABOVE POC',
    delta: payload.delta || payload.d || 'NEUT',
    volumeStatus: payload.volStatus || payload.vol || 'NORM',
    absorption: payload.absorp || payload.abs || 'NONE',
    pressure: payload.pressure || payload.press || 'NEUT'
  };

  orderFlowData.set(symbol, entry);
  lastUpdates.set(`of_${symbol}`, receivedAt);

  console.log(`[OF] ${symbol}: ${entry.pressure} | VA: ${entry.vaZone} | Delta: ${entry.delta}`);

  return { type: 'orderflow', data: entry };
}

// ============================================================================
// BATCH WEBHOOK (Multi-Symbol Scanner Part 1/2)
// ============================================================================
function processBatchWebhook(payload) {
  const timestamp = new Date().toISOString();
  const receivedAt = Date.now();
  const items = payload.data || payload.d;
  const scannerNum = payload.scanner || payload.t || 1;

  const results = [];

  for (const item of items) {
    const symbol = normalizeSymbol(item.s || item.symbol);
    if (!symbol) continue;

    const entry = {
      symbol,
      timestamp,
      receivedAt,
      scannerType: 'multi',
      scannerPart: scannerNum,

      // Price
      price: parseFloat(item.p || item.price) || 0,
      changePercent: parseFloat(item.c || item.change) || 0,

      // Bias
      bias: item.b || item.bias || 'NEUT',

      // Additional fields if present
      maPosition: item.ma || 'MIXED',
      vwapPosition: item.vw || 'ABOVE',
      adxStatus: item.adx || 'RANGE',
      volumeStatus: item.vol || 'NORM',
      trend: item.tr || 'FLAT'
    };

    // Store in ICT data (main scanner)
    ictScannerData.set(symbol, entry);
    lastUpdates.set(`ict_${symbol}`, receivedAt);
    results.push(entry);

    console.log(`[MULTI-${scannerNum}] ${symbol}: ${entry.bias} | Trend: ${entry.trend}`);
  }

  return { type: 'multi', scanner: scannerNum, count: results.length, data: results };
}

// ============================================================================
// LEGACY SINGLE SYMBOL (Original format)
// ============================================================================
function processLegacyWebhook(payload) {
  const symbol = normalizeSymbol(payload.symbol);

  if (!symbol) {
    console.error('Webhook missing symbol:', payload);
    return { error: 'Missing symbol' };
  }

  const entry = {
    symbol,
    timestamp: new Date().toISOString(),
    receivedAt: Date.now(),
    scannerType: 'legacy',

    price: parseFloat(payload.price) || 0,
    change: parseFloat(payload.change) || 0,
    changePercent: parseFloat(payload.change_pct) || 0,

    adx: {
      value: parseFloat(payload.adx_value) || 0,
      status: payload.adx_status || 'UNKNOWN'
    },

    ema: {
      ema21: parseFloat(payload.ema21) || 0,
      ema55: parseFloat(payload.ema55) || 0,
      status: payload.ema_status || 'UNKNOWN'
    },

    vwap: {
      value: parseFloat(payload.vwap) || 0,
      zone: payload.vwap_zone || 'UNKNOWN'
    },

    volume: {
      ratio: parseFloat(payload.vol_ratio) || 1,
      status: payload.vol_status || 'NORMAL'
    },

    levels: {
      pdh: parseFloat(payload.pdh) || 0,
      pdl: parseFloat(payload.pdl) || 0,
      onh: parseFloat(payload.onh) || 0,
      onl: parseFloat(payload.onl) || 0
    },

    sweep: {
      detected: payload.sweep_detected === true || payload.sweep_detected === 'true',
      type: payload.sweep_type || 'NONE'
    },

    bias: payload.bias || 'NEUTRAL',
    score: {
      total: parseInt(payload.total_score) || 0,
      grade: payload.grade || 'F'
    }
  };

  ictScannerData.set(symbol, entry);
  lastUpdates.set(`ict_${symbol}`, Date.now());

  console.log(`[Legacy] ${symbol}: Score ${entry.score.total} (${entry.score.grade}) | Bias: ${entry.bias}`);

  return { type: 'legacy', data: entry };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize symbol names from TradingView format
 */
function normalizeSymbol(symbol) {
  if (!symbol) return null;

  let normalized = symbol.toUpperCase();

  // Remove exchange prefix patterns
  const patterns = [
    /^CME_MINI:(\w+)1!$/,
    /^CBOT_MINI:(\w+)1!$/,
    /^COMEX:(\w+)1!$/,
    /^NYMEX:(\w+)1!$/,
    /^CBOT:(\w+)1!$/,
    /^ICEUS:(\w+)1!$/,
    /^CME:(\w+)1!$/,
    /^CBOE:(\w+)$/,
    /^COINBASE:(\w+)USD$/,
    /^CAPITALCOM:(\w+)$/,
    /^(\w+)1!$/,
    /^(\w+)USD$/,
    /^(\w+)$/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return normalized.slice(0, 4).replace(/[0-9!]/g, '');
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

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Get all scanner data (both ICT and Order Flow)
 */
export function getAllScannerData() {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes

  const ict = {};
  const orderflow = {};

  // Process ICT data
  for (const [symbol, entry] of ictScannerData) {
    const lastUpdate = lastUpdates.get(`ict_${symbol}`) || 0;
    ict[symbol] = {
      ...entry,
      isStale: (now - lastUpdate) > staleThreshold,
      lastUpdateAgo: formatTimeAgo(lastUpdate)
    };
  }

  // Process Order Flow data
  for (const [symbol, entry] of orderFlowData) {
    const lastUpdate = lastUpdates.get(`of_${symbol}`) || 0;
    orderflow[symbol] = {
      ...entry,
      isStale: (now - lastUpdate) > staleThreshold,
      lastUpdateAgo: formatTimeAgo(lastUpdate)
    };
  }

  return {
    ict,
    orderflow,
    lastUpdate: new Date().toISOString(),
    counts: {
      ict: ictScannerData.size,
      orderflow: orderFlowData.size
    }
  };
}

/**
 * Get ICT scanner data only
 */
export function getICTScannerData() {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;
  const data = {};

  for (const [symbol, entry] of ictScannerData) {
    const lastUpdate = lastUpdates.get(`ict_${symbol}`) || 0;
    data[symbol] = {
      ...entry,
      isStale: (now - lastUpdate) > staleThreshold,
      lastUpdateAgo: formatTimeAgo(lastUpdate)
    };
  }

  return data;
}

/**
 * Get Order Flow scanner data only
 */
export function getOrderFlowScannerData() {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;
  const data = {};

  for (const [symbol, entry] of orderFlowData) {
    const lastUpdate = lastUpdates.get(`of_${symbol}`) || 0;
    data[symbol] = {
      ...entry,
      isStale: (now - lastUpdate) > staleThreshold,
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

  const ictEntry = ictScannerData.get(normalized);
  const ofEntry = orderFlowData.get(normalized);

  if (!ictEntry && !ofEntry) {
    return null;
  }

  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;

  const result = { symbol: normalized };

  if (ictEntry) {
    const lastUpdate = lastUpdates.get(`ict_${normalized}`) || 0;
    result.ict = {
      ...ictEntry,
      isStale: (now - lastUpdate) > staleThreshold,
      lastUpdateAgo: formatTimeAgo(lastUpdate)
    };
  }

  if (ofEntry) {
    const lastUpdate = lastUpdates.get(`of_${normalized}`) || 0;
    result.orderflow = {
      ...ofEntry,
      isStale: (now - lastUpdate) > staleThreshold,
      lastUpdateAgo: formatTimeAgo(lastUpdate)
    };
  }

  return result;
}

/**
 * Get summary of all instruments
 */
export function getScannerSummary() {
  const ictData = Array.from(ictScannerData.values());
  const ofData = Array.from(orderFlowData.values());

  // ICT Summary
  const ictByBias = {
    LONG: ictData.filter(i => i.bias === 'LONG'),
    SHORT: ictData.filter(i => i.bias === 'SHORT'),
    NEUT: ictData.filter(i => i.bias === 'NEUT')
  };

  const ictWithSweeps = ictData.filter(i => i.sweepStatus && i.sweepStatus !== 'NONE');
  const ictInOB = ictData.filter(i => i.obZone && i.obZone !== 'NONE');

  // Order Flow Summary
  const ofByPressure = {
    BULL: ofData.filter(i => i.pressure === 'BULL'),
    BEAR: ofData.filter(i => i.pressure === 'BEAR'),
    NEUT: ofData.filter(i => i.pressure === 'NEUT')
  };

  const ofInDiscount = ofData.filter(i => i.vaZone === 'DISCOUNT');
  const ofInPremium = ofData.filter(i => i.vaZone === 'PREMIUM');
  const ofWithAbsorption = ofData.filter(i => i.absorption === 'ABSORP');

  return {
    lastUpdate: new Date().toISOString(),

    ict: {
      total: ictData.length,
      byBias: ictByBias,
      withSweeps: ictWithSweeps.map(i => i.symbol),
      inOrderBlock: ictInOB.map(i => ({ symbol: i.symbol, zone: i.obZone })),
      instruments: ictData
    },

    orderflow: {
      total: ofData.length,
      byPressure: ofByPressure,
      inDiscount: ofInDiscount.map(i => i.symbol),
      inPremium: ofInPremium.map(i => i.symbol),
      withAbsorption: ofWithAbsorption.map(i => i.symbol),
      instruments: ofData
    },

    // Top opportunities
    topLongs: ictData.filter(i => i.bias === 'LONG').slice(0, 5),
    topShorts: ictData.filter(i => i.bias === 'SHORT').slice(0, 5),
    bullishPressure: ofData.filter(i => i.pressure === 'BULL').slice(0, 5),
    bearishPressure: ofData.filter(i => i.pressure === 'BEAR').slice(0, 5)
  };
}

/**
 * Clear all scanner data
 */
export function clearScannerData() {
  ictScannerData.clear();
  orderFlowData.clear();
  lastUpdates.clear();
  console.log('All scanner data cleared');
}

export default {
  processWebhook,
  getAllScannerData,
  getICTScannerData,
  getOrderFlowScannerData,
  getScannerData,
  getScannerSummary,
  clearScannerData
};
