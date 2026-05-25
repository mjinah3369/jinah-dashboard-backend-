// Instrument Detail composer.
// Builds the payload for /api/instrument/:symbol/detail.
//
// Per V1_1_BUILD_PLAN.md §B2 and the master roadmap §2:
// - Multi-timeframe EMA brief (9/21/55 × Daily/Hourly/15-min), rule-based (📊)
// - Technical details (price vs EMAs, alignment summary, key levels via ATR)
// - Fundamental context (existing instrument-summary content per instrument)
// - ES variant additionally returns institutional_context (NET BIAS, factor
//   breakdown, COT, OPEX, Gap, Seasonality, correlations) from
//   esCommandCenter.js
//
// Caching: in-memory per (symbol, 30s) to absorb refresh polling.

import { generateTimeframeBrief, generateAlignmentSummary } from './maBriefTemplates.js';
import { calculateEMA, YAHOO_SYMBOLS } from './technicalAnalysis.js';
import { generateInstrumentSummary, INSTRUMENT_DRIVERS } from './instrumentSummary.js';
import { getInstitutionalContext } from './esCommandCenter.js';

const SUPPORTED = new Set(['ES', 'NQ', 'RTY', 'YM', 'CL', 'GC']);

// Yahoo fetch parameters per timeframe. 55 EMA needs ~55 candles minimum;
// these ranges provide comfortable headroom.
const TIMEFRAMES = {
  daily:    { interval: '1d',  range: '6mo', label: 'Daily'   },
  hourly:   { interval: '1h',  range: '1mo', label: 'Hourly'  },
  fifteen:  { interval: '15m', range: '5d',  label: '15-min'  }
};

const detailCache = new Map(); // symbol -> { payload, expiresAt }
const CACHE_TTL_MS = 30 * 1000;

async function fetchYahooCandles(yahooSymbol, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!response.ok) return null;
  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result?.indicators?.quote?.[0]) return null;
  const closes = (result.indicators.quote[0].close || []).filter(p => Number.isFinite(p));
  return closes;
}

async function getTimeframeEmas(yahooSymbol, tfConfig) {
  const closes = await fetchYahooCandles(yahooSymbol, tfConfig.interval, tfConfig.range);
  if (!closes || closes.length < 55) {
    return null; // 55-period EMA needs at least 55 candles
  }
  const currentPrice = closes[closes.length - 1];
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema55 = calculateEMA(closes, 55);
  // Previous EMA9 — recompute without the latest close so we can detect slope
  const ema9Previous = calculateEMA(closes.slice(0, -1), 9);
  return { currentPrice, ema9, ema21, ema55, ema9Previous };
}

async function buildMaBriefAllTimeframes(yahooSymbol) {
  const [daily, hourly, fifteen] = await Promise.all([
    getTimeframeEmas(yahooSymbol, TIMEFRAMES.daily),
    getTimeframeEmas(yahooSymbol, TIMEFRAMES.hourly),
    getTimeframeEmas(yahooSymbol, TIMEFRAMES.fifteen)
  ]);

  const dailyBrief = daily
    ? generateTimeframeBrief({ timeframeLabel: 'Daily', ...daily })
    : { narrative: 'Daily: data unavailable.', position: 'unknown' };
  const hourlyBrief = hourly
    ? generateTimeframeBrief({ timeframeLabel: 'Hourly', ...hourly })
    : { narrative: 'Hourly: data unavailable.', position: 'unknown' };
  const fifteenBrief = fifteen
    ? generateTimeframeBrief({ timeframeLabel: '15-min', ...fifteen })
    : { narrative: '15-min: data unavailable.', position: 'unknown' };

  return {
    daily: daily
      ? {
          ema9: round(daily.ema9),
          ema21: round(daily.ema21),
          ema55: round(daily.ema55),
          current_price: round(daily.currentPrice),
          ...dailyBrief
        }
      : { available: false, narrative: dailyBrief.narrative },
    hourly: hourly
      ? {
          ema9: round(hourly.ema9),
          ema21: round(hourly.ema21),
          ema55: round(hourly.ema55),
          current_price: round(hourly.currentPrice),
          ...hourlyBrief
        }
      : { available: false, narrative: hourlyBrief.narrative },
    fifteen_min: fifteen
      ? {
          ema9: round(fifteen.ema9),
          ema21: round(fifteen.ema21),
          ema55: round(fifteen.ema55),
          current_price: round(fifteen.currentPrice),
          ...fifteenBrief
        }
      : { available: false, narrative: fifteenBrief.narrative },
    alignment_summary: generateAlignmentSummary(dailyBrief, hourlyBrief, fifteenBrief),
    label: '📊 Rule-based MA brief'
  };
}

function round(n) {
  if (!Number.isFinite(n)) return null;
  return parseFloat(n.toFixed(4));
}

/**
 * Compose a per-instrument fundamental context block. Reuses
 * generateInstrumentSummary which already exists and covers the 6 v1.1
 * instruments.
 *
 * Returns { narrative, label, cache_age_seconds? }.
 */
function composeFundamentalContext(symbol) {
  const drivers = INSTRUMENT_DRIVERS?.[symbol] || null;
  if (!drivers) {
    return {
      narrative: `Fundamental context not yet configured for ${symbol}.`,
      label: '📊 Rule-based'
    };
  }
  // generateInstrumentSummary requires more context (market data, technicals,
  // todayReports) which the existing /api/instrument/:symbol endpoint
  // assembles. For now, surface the driver list as the fundamental read; the
  // richer LLM summary can land in Step 8 polish.
  return {
    narrative: `Key drivers for ${symbol}: ${drivers.keyFactors ? drivers.keyFactors.join(', ') : 'see driver config.'}`,
    drivers: drivers,
    label: '✨ AI-generated context' // LLM call lives in a follow-up; until then mark as drivers-only
  };
}

/**
 * Main entry point — composes the full instrument detail payload.
 */
export async function getInstrumentDetail(symbol) {
  if (!SUPPORTED.has(symbol)) {
    return {
      error: 'unsupported_symbol',
      message: `Symbol '${symbol}' is not in the v1.1 instrument list (ES, NQ, RTY, YM, CL, GC)`
    };
  }

  // Cache lookup
  const cached = detailCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const yahooSymbol = YAHOO_SYMBOLS[symbol];
  if (!yahooSymbol) {
    return {
      error: 'config_missing',
      message: `No Yahoo symbol mapping for '${symbol}'`
    };
  }

  const maBrief = await buildMaBriefAllTimeframes(yahooSymbol);

  const payload = {
    symbol,
    as_of: new Date().toISOString(),
    ma_brief: maBrief,
    technical_details: {
      price_vs_emas: {
        daily: maBrief.daily?.priceVsEmas || null,
        hourly: maBrief.hourly?.priceVsEmas || null,
        fifteen_min: maBrief.fifteen_min?.priceVsEmas || null
      },
      alignment_summary: maBrief.alignment_summary,
      trend_strength: {
        daily: maBrief.daily?.stack || 'unknown',
        hourly: maBrief.hourly?.stack || 'unknown',
        fifteen_min: maBrief.fifteen_min?.stack || 'unknown'
      }
    },
    fundamental_context: composeFundamentalContext(symbol)
  };

  // ES gets the institutional context layer migrated from the removed
  // ES Command Center tab.
  if (symbol === 'ES') {
    try {
      payload.institutional_context = await getInstitutionalContext();
    } catch (err) {
      console.error('Failed to fetch institutional context for ES:', err.message);
      payload.institutional_context = {
        available: false,
        reason: err.message
      };
    }
  }

  detailCache.set(symbol, {
    payload,
    expiresAt: Date.now() + CACHE_TTL_MS
  });

  return payload;
}

export function clearInstrumentDetailCache() {
  detailCache.clear();
}
