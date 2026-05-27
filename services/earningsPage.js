/**
 * Earnings tab page composer.
 *
 * Builds the three-section payload for /api/earnings/page:
 *   1. latestImpacts — major reports from the past 7 days with their
 *      day-of price move and a verdict label (Strong beat / Beat / In-line /
 *      Soft / Big miss) bucketed from the move size. Empty-state fallback:
 *      if past 7 days is empty, return the most recent 5 reports regardless
 *      of date with a flag indicating the fallback.
 *   2. upcoming — major reports scheduled in the next 14 days, with
 *      Alpha Vantage EPS estimate and time-of-day when available.
 *   3. whatToLookFor — Sonnet 4 narrative (4-6 sentences) + 2-3 named themes.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  fetchMajorEarningsCalendar,
  MAJOR_EARNINGS_TICKERS,
  MAJOR_EARNINGS_AFFECTED
} from './alphaVantage.js';
import { fetchEarningsCalendarRange } from './finnhubEarnings.js';
import { getChartData } from './technicalAnalysis.js';
import { getCurrentSession } from './sessionEngine.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ---------- date helpers (ET-aware so the day boundaries match the market) ----------

function etDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function etDaysAgoKey(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return etDateKey(d);
}

function epochToEtDateKey(epochSec) {
  return etDateKey(new Date(epochSec * 1000));
}

function epochToUtcDateKey(epochSec) {
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

function daysBetween(fromDateStr, toDateStr) {
  const a = new Date(fromDateStr + 'T00:00:00');
  const b = new Date(toDateStr + 'T00:00:00');
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Locate the daily candle index that corresponds to a given report date.
 * Robust to either UTC-midnight or market-open candle timestamps (Yahoo's
 * convention varies). Tries ET-date match first, then UTC-date match, then
 * a ±1.5-day tolerance window. Returns -1 if no candle is within range.
 */
function findCandleForDate(candles, reportDateStr) {
  if (!Array.isArray(candles) || candles.length === 0 || !reportDateStr) return -1;
  // Exact match on ET date
  let idx = candles.findIndex(c => epochToEtDateKey(c.time) === reportDateStr);
  if (idx >= 0) return idx;
  // Exact match on UTC date
  idx = candles.findIndex(c => epochToUtcDateKey(c.time) === reportDateStr);
  if (idx >= 0) return idx;
  // Tolerance window: pick the candle nearest the report date within ±1.5 days
  const target = new Date(reportDateStr + 'T12:00:00Z').getTime();
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const diff = Math.abs(candles[i].time * 1000 - target);
    if (diff < bestDiff && diff <= 1.5 * 24 * 60 * 60 * 1000) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---------- verdict bucketing ----------

function verdictFromMove(pct) {
  if (!Number.isFinite(pct)) return 'Unknown';
  if (pct > 5)    return 'Strong beat';
  if (pct > 2)    return 'Beat';
  if (pct > -2)   return 'In-line';
  if (pct > -5)   return 'Soft';
  return 'Big miss';
}

// ---------- Section 1 — Latest Impacts ----------

/**
 * Pull major-ticker reports from the past N days (Finnhub), then compute the
 * day-of price move for each via Yahoo daily candles.
 */
async function getRecentImpacts({ primaryDays = 7, fallbackCount = 5 } = {}) {
  const today = etDateKey();
  // Buffer the lookback by a couple of days to absorb weekend gaps where the
  // report might have been "today" but landed on Friday's candles.
  const lookbackFrom = etDaysAgoKey(primaryDays + 3);
  const fallbackLookbackFrom = etDaysAgoKey(45); // ~6 weeks for fallback

  // Primary 7-day fetch
  let raw = await fetchEarningsCalendarRange(lookbackFrom, today);
  let major = raw.filter(r => r && MAJOR_EARNINGS_TICKERS.has(r.symbol));

  let usedFallback = false;
  // Sort by report date desc
  major.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Filter to strictly within the primary window
  let withinWindow = major.filter(r => {
    if (!r.date) return false;
    const ageDays = daysBetween(r.date, today);
    return ageDays >= 0 && ageDays <= primaryDays;
  });

  if (withinWindow.length === 0) {
    // Empty-state fallback: pull ~6 weeks back and take the last N regardless
    const fallbackRaw = await fetchEarningsCalendarRange(fallbackLookbackFrom, today);
    const fallbackMajor = fallbackRaw
      .filter(r => r && MAJOR_EARNINGS_TICKERS.has(r.symbol))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    withinWindow = fallbackMajor.slice(0, fallbackCount);
    usedFallback = withinWindow.length > 0;
  }

  // De-duplicate by symbol (a single ticker may appear once per quarter)
  const seen = new Set();
  const unique = [];
  for (const r of withinWindow) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    unique.push(r);
    if (unique.length >= 8) break; // hard cap on cards
  }

  // For each, fetch daily candles and compute the day-of move.
  const impacts = await Promise.allSettled(unique.map(async r => {
    try {
      const chart = await getChartData(r.symbol, '1d');
      const candles = chart?.candles || [];
      if (candles.length < 2) {
        return {
          symbol: r.symbol,
          reportDate: r.date,
          daysAgo: daysBetween(r.date, today),
          priceMovePct: null,
          verdict: 'Unknown',
          affectedInstruments: MAJOR_EARNINGS_AFFECTED(r.symbol),
          epsEstimate: Number.isFinite(r.epsEstimate) ? r.epsEstimate : null,
          epsActual: Number.isFinite(r.epsActual) ? r.epsActual : null,
          hour: r.hour || null
        };
      }
      // Find the candle for the report date. Uses ET/UTC/tolerance matching
      // because Yahoo's daily-candle timestamp convention varies (some come
      // back as UTC midnight, others as market-open). The price move is then
      // computed against the prior candle (which represents the prior
      // trading day's close — automatically handles weekends).
      const reportIdx = findCandleForDate(candles, r.date);
      let movePct = null;
      if (reportIdx > 0) {
        const reportClose = candles[reportIdx]?.close;
        const priorClose = candles[reportIdx - 1]?.close;
        if (Number.isFinite(reportClose) && Number.isFinite(priorClose) && priorClose !== 0) {
          movePct = ((reportClose - priorClose) / priorClose) * 100;
        }
      }
      return {
        symbol: r.symbol,
        reportDate: r.date,
        daysAgo: daysBetween(r.date, today),
        priceMovePct: Number.isFinite(movePct) ? parseFloat(movePct.toFixed(2)) : null,
        verdict: verdictFromMove(movePct),
        affectedInstruments: MAJOR_EARNINGS_AFFECTED(r.symbol),
        epsEstimate: Number.isFinite(r.epsEstimate) ? r.epsEstimate : null,
        epsActual: Number.isFinite(r.epsActual) ? r.epsActual : null,
        hour: r.hour || null
      };
    } catch (e) {
      return null;
    }
  }));

  const out = impacts
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  return { items: out, usedFallback, lookbackDays: primaryDays };
}

// ---------- Section 2 — Upcoming ----------

async function getUpcomingMajor({ days = 14 } = {}) {
  // fetchMajorEarningsCalendar already filters to MAJOR and clips the window.
  const upcoming = await fetchMajorEarningsCalendar({ days });
  // Drop today from this section if it's in there — today belongs more in
  // "what to look for" than "upcoming". Keep tomorrow onward.
  return upcoming.filter(e => e.daysAway >= 1);
}

// ---------- Section 3 — What to Look For (LLM) ----------

function getTenseGuidance(sessionLabel) {
  const s = (sessionLabel || '').toLowerCase();
  if (/pre.?market|pre.?open/.test(s)) {
    return 'CURRENT SESSION: US Pre-Market — before today\'s open. Use forward-looking language.';
  }
  if (/us regular|regular hours|us rth|us session/.test(s)) {
    return 'CURRENT SESSION: US Regular Hours — live trading. Use present tense.';
  }
  if (/after.hours|post.market/.test(s)) {
    return 'CURRENT SESSION: US After Hours. Use past tense for the day session.';
  }
  if (/settlement|post.close|closed/.test(s)) {
    return 'CURRENT SESSION: US Settlement — closed for the day. Use past tense for today; can preview tomorrow.';
  }
  if (/asia/.test(s) || /london|europe/.test(s)) {
    return `CURRENT SESSION: ${sessionLabel} — US market is closed. Use past tense for any US-related framing.`;
  }
  return `CURRENT SESSION: ${sessionLabel || 'unknown'}. Match tense to session reality.`;
}

async function generateWhatToLookFor({ impacts, upcoming, sessionLabel }) {
  if (!anthropic) {
    return {
      summary: null,
      themes: [],
      generated: false,
      fallbackReason: 'no_api_key'
    };
  }

  // Build compact inputs for the prompt.
  const impactsLine = impacts.length
    ? impacts.map(i => {
        const move = Number.isFinite(i.priceMovePct) ? ` ${i.priceMovePct > 0 ? '+' : ''}${i.priceMovePct}%` : '';
        return `${i.symbol} (${i.reportDate})${move} - ${i.verdict}`;
      }).join('\n')
    : 'No major reports landed in the past 7 days.';

  const upcomingLine = upcoming.length
    ? upcoming.slice(0, 10).map(u => {
        const eps = Number.isFinite(u.epsEstimate) ? ` est EPS ${u.epsEstimate}` : '';
        const hour = u.timeOfTheDay ? ` (${u.timeOfTheDay})` : '';
        return `${u.symbol} on ${u.reportDate}${hour}${eps} - moves ${(u.affectedInstruments || []).join('+')}`;
      }).join('\n')
    : 'No major reports scheduled in the next 14 days.';

  const tenseGuidance = getTenseGuidance(sessionLabel);

  const prompt = `You are writing a "what to look for" narrative for the Earnings tab of a futures trading dashboard. Plain English, retail trader audience, no finance-desk jargon.

${tenseGuidance}

RECENT REPORTS (past ~7 days, with day-of price move and a verdict bucket):
${impactsLine}

UPCOMING REPORTS (next 14 days, MAJOR only):
${upcomingLine}

WRITING RULES — strict:
- 4 to 6 sentences total. Tight, scannable, plain English.
- Connect what just happened to what's coming. If NVDA beat strongly and AAPL reports next week, mention that.
- Name SPECIFIC tickers and dates. Never say "various companies".
- Mention which futures the upcoming reports tend to move (NQ for Mag7, ES+YM for banks).
- If both sections are empty, say so honestly and explain the broader earnings cycle (e.g., "We're between Q1 and Q2 reporting seasons. Next major wave starts mid-July.")
- Avoid these words: risk-on, risk-off, positioning, bid, prints, leg, squeeze, tape, flow, hawkish, dovish, Mag7 (use "Mega-Cap Tech").

Respond in JSON ONLY:
{
  "summary": "4-6 sentences connecting recent reports to upcoming ones and what to watch",
  "themes": ["2-4 short theme labels (e.g., 'AI capex follow-through', 'Retail consumer health', 'Bank earnings season opener')"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { summary: null, themes: [], generated: false, fallbackReason: 'json_extract_failed' };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || null,
      themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 4) : [],
      generated: true,
      fallbackReason: null
    };
  } catch (error) {
    console.error('What-to-look-for LLM error:', error.message);
    return {
      summary: null,
      themes: [],
      generated: false,
      fallbackReason: `llm_call_error: ${error.message}`
    };
  }
}

// ---------- Main composer ----------

export async function generateEarningsPage() {
  let sessionLabel = null;
  try { sessionLabel = getCurrentSession()?.name || null; } catch (e) { /* defensive */ }

  // Run the two data fetches in parallel.
  const [recentResult, upcomingResult] = await Promise.allSettled([
    getRecentImpacts({ primaryDays: 7, fallbackCount: 5 }),
    getUpcomingMajor({ days: 14 })
  ]);

  const latest = recentResult.status === 'fulfilled' ? recentResult.value : { items: [], usedFallback: false, lookbackDays: 7 };
  const upcoming = upcomingResult.status === 'fulfilled' ? upcomingResult.value : [];

  // Then the LLM synthesis once we have the structured data.
  const whatToLookFor = await generateWhatToLookFor({
    impacts: latest.items,
    upcoming,
    sessionLabel
  });

  return {
    latestImpacts: latest.items,
    latestImpactsFallback: latest.usedFallback,
    latestImpactsWindow: latest.lookbackDays,
    upcoming,
    whatToLookFor,
    generatedAt: new Date().toISOString(),
    sessionLabel
  };
}
