/**
 * Session Engine - Tracks trading sessions and IB periods
 *
 * Sessions (all times in ET/New York):
 * - ASIA:       Sun 18:00 - Mon 02:00 (and Mon-Thu same pattern)
 * - LONDON:     02:00 - 08:00
 * - US_PRE:     08:00 - 09:30
 * - US_RTH:     09:30 - 16:00
 * - SETTLEMENT: 16:00 - 17:00
 * - CLOSED:     Fri 17:00 - Sun 18:00
 *
 * IB Windows (60 minutes each):
 * - ASIA IB:   18:00 - 19:00 ET
 * - LONDON IB: 02:00 - 03:00 ET
 * - US IB:     09:30 - 10:30 ET
 */

const SESSION_CONFIG = {
  ASIA: {
    name: 'Asia',
    emoji: '🌏',
    start: { hour: 18, minute: 0 },
    end: { hour: 2, minute: 0 },
    crossesMidnight: true,
    ibDuration: 60, // minutes
    focus: ['NQ', 'ES', 'CL', 'GC', '6J', '6A'],
    description: 'Tokyo/Sydney session - Watch Nikkei, Hang Seng, Copper'
  },
  LONDON: {
    name: 'London',
    emoji: '🇬🇧',
    start: { hour: 2, minute: 0 },
    end: { hour: 8, minute: 0 },
    crossesMidnight: false,
    ibDuration: 60,
    focus: ['GC', 'SI', '6E', '6B', 'CL', 'ES'],
    description: 'European session - Forex & Metals most active'
  },
  US_PRE: {
    name: 'US Pre-Market',
    emoji: '🌅',
    start: { hour: 8, minute: 0 },
    end: { hour: 9, minute: 30 },
    crossesMidnight: false,
    ibDuration: 0, // no IB for pre-market
    focus: ['ES', 'NQ', 'All'],
    description: 'News digestion, positioning before RTH'
  },
  US_RTH: {
    name: 'US Regular',
    emoji: '🇺🇸',
    start: { hour: 9, minute: 30 },
    end: { hour: 16, minute: 0 },
    crossesMidnight: false,
    ibDuration: 60,
    focus: ['ES', 'NQ', 'YM', 'RTY', 'CL', 'GC'],
    description: 'Regular Trading Hours - Highest volume'
  },
  SETTLEMENT: {
    name: 'Settlement',
    emoji: '🔒',
    start: { hour: 16, minute: 0 },
    end: { hour: 17, minute: 0 },
    crossesMidnight: false,
    ibDuration: 0,
    focus: [],
    description: 'Daily close - Reduced activity'
  },
  WEEKEND: {
    name: 'Weekend',
    emoji: '⏸️',
    start: null,
    end: null,
    crossesMidnight: false,
    ibDuration: 0,
    focus: [],
    description: 'Markets closed'
  }
};

// Store session levels (updated throughout session)
let sessionLevels = {
  ASIA: { high: null, low: null, open: null, close: null, delta: 0, volume: 0, sweeps: [] },
  LONDON: { high: null, low: null, open: null, close: null, delta: 0, volume: 0, sweeps: [] },
  US_RTH: { high: null, low: null, open: null, close: null, delta: 0, volume: 0, sweeps: [] }
};

// Store IB (Initial Balance) levels
let ibLevels = {
  ASIA: { high: null, low: null, complete: false },
  LONDON: { high: null, low: null, complete: false },
  US_RTH: { high: null, low: null, complete: false }
};

/**
 * Get current session based on time
 */
function getCurrentSession(date = new Date()) {
  // Convert to ET timezone
  const et = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0 = Sunday
  const hour = et.getHours();
  const minute = et.getMinutes();
  const timeValue = hour * 60 + minute; // minutes since midnight

  // Check for weekend
  if (day === 6 || (day === 0 && timeValue < 18 * 60) || (day === 5 && timeValue >= 17 * 60)) {
    return {
      ...SESSION_CONFIG.WEEKEND,
      key: 'WEEKEND',
      isIB: false,
      ibMinutesRemaining: 0
    };
  }

  // Determine session
  let sessionKey;
  if (timeValue >= 18 * 60 || timeValue < 2 * 60) {
    sessionKey = 'ASIA';
  } else if (timeValue >= 2 * 60 && timeValue < 8 * 60) {
    sessionKey = 'LONDON';
  } else if (timeValue >= 8 * 60 && timeValue < 9 * 60 + 30) {
    sessionKey = 'US_PRE';
  } else if (timeValue >= 9 * 60 + 30 && timeValue < 16 * 60) {
    sessionKey = 'US_RTH';
  } else {
    sessionKey = 'SETTLEMENT';
  }

  const session = SESSION_CONFIG[sessionKey];

  // Calculate IB status
  let isIB = false;
  let ibMinutesRemaining = 0;

  if (session.ibDuration > 0) {
    const sessionStartMinutes = session.start.hour * 60 + session.start.minute;
    let minutesIntoSession;

    if (session.crossesMidnight && timeValue < session.end.hour * 60) {
      // After midnight in Asia session
      minutesIntoSession = (24 * 60 - sessionStartMinutes) + timeValue;
    } else {
      minutesIntoSession = timeValue - sessionStartMinutes;
    }

    if (minutesIntoSession >= 0 && minutesIntoSession < session.ibDuration) {
      isIB = true;
      ibMinutesRemaining = session.ibDuration - minutesIntoSession;
    }
  }

  return {
    ...session,
    key: sessionKey,
    isIB,
    ibMinutesRemaining,
    currentTime: et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    levels: sessionLevels[sessionKey] || null,
    ibLevels: ibLevels[sessionKey] || null
  };
}

/**
 * Get time until next session
 */
function getNextSession(date = new Date()) {
  const current = getCurrentSession(date);
  const et = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const timeValue = et.getHours() * 60 + et.getMinutes();

  const sessionOrder = ['ASIA', 'LONDON', 'US_PRE', 'US_RTH', 'SETTLEMENT'];
  const currentIndex = sessionOrder.indexOf(current.key);

  let nextKey;
  if (current.key === 'WEEKEND') {
    nextKey = 'ASIA';
  } else if (current.key === 'SETTLEMENT' || currentIndex === -1) {
    nextKey = 'ASIA';
  } else {
    nextKey = sessionOrder[(currentIndex + 1) % sessionOrder.length];
  }

  const nextSession = SESSION_CONFIG[nextKey];

  // Calculate minutes until next session
  let nextStartMinutes = nextSession.start.hour * 60 + nextSession.start.minute;
  let minutesUntil;

  if (nextStartMinutes <= timeValue) {
    // Next session is tomorrow
    minutesUntil = (24 * 60 - timeValue) + nextStartMinutes;
  } else {
    minutesUntil = nextStartMinutes - timeValue;
  }

  const hoursUntil = Math.floor(minutesUntil / 60);
  const minsUntil = minutesUntil % 60;

  return {
    ...nextSession,
    key: nextKey,
    minutesUntil,
    countdown: `${hoursUntil}h ${minsUntil}m`
  };
}

/**
 * Update session levels (called from webhook or price update)
 */
function updateSessionLevels(sessionKey, priceData) {
  if (!sessionLevels[sessionKey]) return;

  const levels = sessionLevels[sessionKey];

  // Update high/low
  if (priceData.high && (!levels.high || priceData.high > levels.high)) {
    levels.high = priceData.high;
  }
  if (priceData.low && (!levels.low || priceData.low < levels.low)) {
    levels.low = priceData.low;
  }

  // Set open on first update
  if (!levels.open && priceData.open) {
    levels.open = priceData.open;
  }

  // Update delta and volume
  if (priceData.delta !== undefined) {
    levels.delta = priceData.delta;
  }
  if (priceData.volume !== undefined) {
    levels.volume = priceData.volume;
  }

  // Track sweeps
  if (priceData.sweep) {
    levels.sweeps.push({
      level: priceData.sweep.level,
      price: priceData.sweep.price,
      time: new Date().toISOString(),
      reclaimed: priceData.sweep.reclaimed || false
    });
  }
}

/**
 * Update IB levels (called during IB window)
 */
function updateIBLevels(sessionKey, high, low) {
  if (!ibLevels[sessionKey]) return;

  if (high && (!ibLevels[sessionKey].high || high > ibLevels[sessionKey].high)) {
    ibLevels[sessionKey].high = high;
  }
  if (low && (!ibLevels[sessionKey].low || low < ibLevels[sessionKey].low)) {
    ibLevels[sessionKey].low = low;
  }
}

/**
 * Mark IB as complete
 */
function completeIB(sessionKey) {
  if (ibLevels[sessionKey]) {
    ibLevels[sessionKey].complete = true;
  }
}

/**
 * Reset session data (called at session start)
 */
function resetSession(sessionKey) {
  sessionLevels[sessionKey] = {
    high: null, low: null, open: null, close: null,
    delta: 0, volume: 0, sweeps: []
  };
  ibLevels[sessionKey] = { high: null, low: null, complete: false };
}

/**
 * Get all session data for handoff
 */
function getSessionHandoff() {
  return {
    sessions: sessionLevels,
    initialBalances: ibLevels,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get session summary (for AI analysis)
 */
function getSessionSummary(sessionKey) {
  const levels = sessionLevels[sessionKey];
  const ib = ibLevels[sessionKey];

  if (!levels) return null;

  const range = levels.high && levels.low ? levels.high - levels.low : 0;
  const deltaPercent = levels.volume > 0 ? (levels.delta / levels.volume * 100).toFixed(1) : 0;
  const control = levels.delta > 0 ? 'BUYERS' : levels.delta < 0 ? 'SELLERS' : 'NEUTRAL';

  return {
    session: sessionKey,
    high: levels.high,
    low: levels.low,
    range,
    delta: levels.delta,
    deltaPercent: `${deltaPercent}%`,
    volume: levels.volume,
    control,
    sweeps: levels.sweeps,
    ibHigh: ib?.high,
    ibLow: ib?.low,
    ibComplete: ib?.complete,
    ibRange: ib?.high && ib?.low ? ib.high - ib.low : 0
  };
}

export {
  getCurrentSession,
  getNextSession,
  updateSessionLevels,
  updateIBLevels,
  completeIB,
  resetSession,
  getSessionHandoff,
  getSessionSummary,
  SESSION_CONFIG
};
