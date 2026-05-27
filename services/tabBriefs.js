/**
 * Tab Briefs — 4 plain-English summaries for the dashboard's nav-rail tab pages
 * (Mega-Cap Tech, Earnings, Sectors, International).
 *
 * A single LLM call produces all four briefs in one shot, so the per-refresh
 * cost stays bounded. Inputs come from the existing dashboard payload — no new
 * data fetching. Cached in-memory; the server-level handler is responsible
 * for the cache key (ET-date + session label) and TTL.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getCurrentSession } from './sessionEngine.js';
import { fetchMajorEarningsCalendar } from './alphaVantage.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * Build the per-page summary inputs from the existing /api/dashboard payload.
 * Pass the same `dashboardData` object that the route handler already has.
 *
 * Returns a compact object keyed by page. Each value is a short formatted
 * string ready to be plugged into the LLM prompt. Keeping it terse keeps the
 * prompt token count low.
 */
/**
 * Build a structured earnings context: today's major reports (specific
 * names, not "Various"), and if today is empty, the next major name +
 * how many days away. Backed by a 14-day window of MAJOR earnings only
 * (Mag7 + ~25 bellwethers).
 */
async function buildEarningsContext() {
  const upcoming = await fetchMajorEarningsCalendar({ days: 14 });
  const today = upcoming.filter(e => e.daysAway === 0);
  const future = upcoming.filter(e => e.daysAway > 0);
  const nextMajor = future[0] || null;

  return {
    todayMajor: today,        // array, may be empty
    nextMajor,                // single object or null
    upcoming14d: upcoming,    // full window for context
    todayCount: today.length,
    upcomingCount: upcoming.length
  };
}

function formatEarningsInput(ctx) {
  if (ctx.todayCount > 0) {
    const list = ctx.todayMajor
      .map(e => `${e.symbol} (affects ${(e.affectedInstruments || []).join('+')})`)
      .join(', ');
    return [
      `Today's major reports: ${list}`,
      ctx.upcomingCount > ctx.todayCount
        ? `Coming up in next 14 days: ${ctx.upcomingCount - ctx.todayCount} more major names.`
        : 'No further major reports in the next 14 days.'
    ].join('\n');
  }
  // No major earnings today — surface the next one explicitly.
  if (ctx.nextMajor) {
    return [
      `No major earnings reports today.`,
      `Next major: ${ctx.nextMajor.symbol} in ${ctx.nextMajor.daysAway} day(s) on ${ctx.nextMajor.reportDate} (affects ${(ctx.nextMajor.affectedInstruments || []).join('+')}).`,
      ctx.upcomingCount > 1
        ? `Total ${ctx.upcomingCount} major reports across the next 14 days.`
        : ''
    ].filter(Boolean).join('\n');
  }
  return 'No major earnings reports today, and none scheduled in the next 14 days.';
}

function buildBriefInputs(dashboardData) {
  // --- Mega-Cap Tech ---
  const mag7 = dashboardData?.magnificentSeven || {};
  const mag7Stocks = mag7.stocks || {};
  const mag7Summary = mag7.summary || {};
  const mag7Lines = Object.entries(mag7Stocks).map(([sym, s]) => {
    const pct = Number.isFinite(s?.changePercent) ? s.changePercent.toFixed(2) : '?';
    const arrow = (s?.changePercent ?? 0) > 0 ? '+' : '';
    return `${sym} ${arrow}${pct}%`;
  });
  const megaCapInput = [
    `Stocks: ${mag7Lines.join(', ') || 'data unavailable'}`,
    `Overall trend: ${mag7Summary.overallTrend ?? 'N/A'}`,
    `Avg change: ${Number.isFinite(mag7Summary.avgChangePercent) ? mag7Summary.avgChangePercent.toFixed(2) + '%' : 'N/A'}`,
    `Leader: ${mag7Summary.leader ?? 'N/A'} | Laggard: ${mag7Summary.laggard ?? 'N/A'}`
  ].join('\n');

  // --- Earnings ---
  // NOTE: `dashboardData.earnings` carries a fallback placeholder
  // (`[{ company: 'Various' }]`) from dashboardBuilder.js. We deliberately
  // bypass it and inject the real major-earnings context via earningsInput
  // (built async by buildEarningsContext + formatEarningsInput).
  const earningsInput = dashboardData?._earningsBriefInput
    || 'No major earnings context available.';

  // --- Sectors ---
  const sectors = dashboardData?.sectors || {};
  const sectorList = Array.isArray(sectors) ? sectors : Object.values(sectors);
  const sectorLines = sectorList
    .filter(s => s && (s.name || s.symbol))
    .slice(0, 12)
    .map(s => {
      const name = s.name || s.symbol;
      const pct = Number.isFinite(s.changePercent) ? s.changePercent.toFixed(2) : '?';
      const arrow = (s.changePercent ?? 0) > 0 ? '+' : '';
      return `${name} ${arrow}${pct}%`;
    });
  const sectorsInput = sectorLines.length
    ? sectorLines.join(', ')
    : 'sector data unavailable';

  // --- International ---
  const intl = dashboardData?.internationalIndices?.indices || {};
  const intlLines = Object.entries(intl).map(([sym, x]) => {
    const pct = Number.isFinite(x?.changePercent) ? x.changePercent.toFixed(2) : '?';
    const arrow = (x?.changePercent ?? 0) > 0 ? '+' : '';
    const session = x?.sessionStatus ? `[${x.sessionStatus}]` : '';
    return `${x?.name || sym} ${arrow}${pct}% ${session}`.trim();
  });
  const internationalInput = intlLines.length
    ? intlLines.join('\n')
    : 'international index data unavailable';

  return {
    megaCap: megaCapInput,
    earnings: earningsInput,
    sectors: sectorsInput,
    international: internationalInput
  };
}

/**
 * Resolve session-aware tense guidance — same pattern as finalAnalysis.js so
 * the briefs read present-tense during RTH and past-tense at settlement.
 */
function getTenseGuidance(sessionLabel) {
  const s = (sessionLabel || '').toLowerCase();
  if (/pre.?market|pre.?open/.test(s)) {
    return 'CURRENT SESSION is US Pre-Market (before the open). Use forward-looking language ("are pointing higher pre-market", "ahead of today\'s open"). Do not narrate moves as final.';
  }
  if (/us regular|regular hours|us rth|us session/.test(s)) {
    return 'CURRENT SESSION is US Regular Hours (live trading). Use present tense ("are rising", "is leading"). Talk about what is happening right now.';
  }
  if (/after.hours|post.market/.test(s)) {
    return 'CURRENT SESSION is US After Hours. Use past tense for the day session ("today closed with...") plus brief watchful note on extended-hours moves if relevant.';
  }
  if (/settlement|post.close|closed/.test(s)) {
    return 'CURRENT SESSION is US Settlement / fully closed for the day. Use past tense ("today closed with X up Y%"). Add 1 forward-looking phrase about tomorrow\'s focus where useful. Do not use present-progressive tense.';
  }
  if (/asia/.test(s)) {
    return 'CURRENT SESSION is Asia (US market closed). Use past tense referring to yesterday\'s US close. Acknowledge Asia is currently active.';
  }
  if (/london|europe/.test(s)) {
    return 'CURRENT SESSION is London/Europe (US market closed). Use past tense for US data. Acknowledge London/Europe is currently active.';
  }
  return `CURRENT SESSION: ${sessionLabel || 'unknown'}. Match tense to session reality.`;
}

/**
 * Generate all four briefs in a single LLM call. Returns:
 *   { megaCap, earnings, sectors, international, generated, generatedAt, fallbackReason }
 * where each of the four page entries is { summary, focus } — both short
 * plain-English sentences — or null on failure.
 */
export async function generateTabBriefs(dashboardData) {
  if (!anthropic) {
    return {
      megaCap: null, earnings: null, sectors: null, international: null,
      generated: false,
      fallbackReason: 'no_api_key',
      generatedAt: new Date().toISOString()
    };
  }

  let sessionLabel = null;
  try { sessionLabel = getCurrentSession()?.name || null; } catch (e) { /* defensive */ }

  // Build real earnings context (async — hits Alpha Vantage). Inject it into
  // the dashboardData proxy before formatting the prompt inputs so the
  // synchronous buildBriefInputs() can read it without re-shaping.
  const earningsCtx = await buildEarningsContext();
  const earningsInputText = formatEarningsInput(earningsCtx);
  const dataForPrompt = { ...dashboardData, _earningsBriefInput: earningsInputText };

  const inputs = buildBriefInputs(dataForPrompt);
  const tenseGuidance = getTenseGuidance(sessionLabel);

  const prompt = `You are writing four short situational briefs for the tab pages of a futures trading dashboard. Each brief is for a retail trader, plain English, no finance-desk jargon.

${tenseGuidance}

MEGA-CAP TECH INPUTS:
${inputs.megaCap}

EARNINGS INPUTS (the actual major reports landscape — Mag7 + ~25 bellwethers only, 14-day window):
${inputs.earnings}

EARNINGS-WRITING RULES — strict:
- If today has major reports, NAME them by ticker AND describe what to watch (e.g., "Apple after the bell, watch iPhone-services mix and Q4 guidance for NQ"). Never say "various companies".
- If today has NO major reports, say so explicitly: "No major earnings today." Then name the NEXT major report coming with its date and what it means for futures (e.g., "Next major: NVDA in 3 days on 2026-05-30 — guidance will move NQ").
- Do not invent reports that aren't in the input. Do not say "results are flowing in" if the input shows zero today.
- Mention which futures the report tends to move (NQ for Mag7, ES+YM for banks).

SECTORS INPUTS (sector ETF moves):
${inputs.sectors}

INTERNATIONAL INPUTS (major overseas indices):
${inputs.international}

WRITING RULES — strict:
- Plain English. Short sentences. Concrete observations.
- Each brief: 2 sentences max for "summary", 1 sentence for "focus".
- Match tense to the CURRENT SESSION above. Never internally contradict yourself (don't say "stocks are rising" if the session is closed).
- Avoid these words: risk-on, risk-off, positioning, bid, offer, prints, leg, squeeze, tape, flow, hawkish/dovish (without inline definition), Mag7 (write "Mega-Cap Tech" or list names).
- Name specific drivers / specific instruments when you can.
- If data shows ~0% across the board (e.g., pre-market with no movement yet), say so honestly; do not invent moves.

Respond in JSON ONLY:
{
  "megaCap": {
    "summary": "2 sentences about Mega-Cap Tech state right now — leaders, laggards, overall direction",
    "focus": "1 sentence: the single most important name or story to watch for this group"
  },
  "earnings": {
    "summary": "2 sentences. Use ONLY the EARNINGS INPUTS data above. If there ARE major reports today, name them by ticker and what to watch. If there are NONE today, lead with 'No major earnings today' and then name the next major report coming with its ticker, date, and what it means for futures. Never write 'various companies'. Never invent reports.",
    "focus": "1 sentence: the single highest-impact name to watch (today if any, otherwise the next upcoming) and why traders care"
  },
  "sectors": {
    "summary": "2 sentences about which sectors are leading vs lagging right now and what's driving it",
    "focus": "1 sentence: the most important sector divergence or rotation to notice"
  },
  "international": {
    "summary": "2 sentences about how overseas markets traded and the read-across to US futures",
    "focus": "1 sentence: which overseas market matters most for today's US session and why"
  }
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        megaCap: null, earnings: null, sectors: null, international: null,
        generated: false,
        fallbackReason: 'json_extract_failed',
        generatedAt: new Date().toISOString()
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return {
        megaCap: null, earnings: null, sectors: null, international: null,
        generated: false,
        fallbackReason: `json_parse_error: ${e.message}`,
        generatedAt: new Date().toISOString()
      };
    }

    return {
      megaCap: parsed.megaCap || null,
      earnings: parsed.earnings || null,
      sectors: parsed.sectors || null,
      international: parsed.international || null,
      generated: true,
      fallbackReason: null,
      sessionLabel,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Tab briefs LLM error:', error.message);
    return {
      megaCap: null, earnings: null, sectors: null, international: null,
      generated: false,
      fallbackReason: `llm_call_error: ${error.message}`,
      generatedAt: new Date().toISOString()
    };
  }
}
