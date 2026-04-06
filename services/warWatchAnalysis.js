/**
 * WarWatch AI Analysis Service
 * Combines geopolitical conflict intelligence with technical/fundamental data
 * to produce actionable trading analysis for war-affected instruments.
 *
 * Cross-references:
 * - warWatch.js: conflict news, zones, sentiment, alerts
 * - technicalAnalysis.js: EMA, ADX, trend for each instrument
 * - yahooFinance.js: live prices, changes
 * - finalAnalysis.js patterns: bias scoring
 * - calculatedMetrics.js: gold/silver ratio, crack spread, etc.
 * - cftcCot.js: COT positioning
 * - cboePutCall.js: Put/Call sentiment
 *
 * Uses Claude AI to synthesize a war-focused trading brief.
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchWarWatchData, getRiskSummary } from './warWatch.js';
import { analyzeTechnicals, getChartData, YAHOO_SYMBOLS } from './technicalAnalysis.js';
import { fetchYahooFinanceFutures, fetchCurrencyFutures, fetchCryptoPrices, getGoldSilverRatio } from './yahooFinance.js';
import { calculateAllMetrics } from './calculatedMetrics.js';
import { getAllCOTData } from './cftcCot.js';
import { getPutCallRatio } from './cboePutCall.js';

// ============================================================================
// CONFIG
// ============================================================================

let anthropic = null;

function getAnthropicClient() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// Cache
let warAnalysisCache = null;
let warAnalysisCacheTime = null;
const WAR_ANALYSIS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// OFFICIALS & STATEMENT TRACKING
// ============================================================================

const KEY_OFFICIALS = {
  us: [
    'trump', 'president trump', 'biden', 'white house', 'pentagon', 'us defense',
    'us secretary', 'blinken', 'sullivan', 'austin', 'milley', 'us state department',
    'congress', 'senate', 'rubio', 'us military', 'joint chiefs', 'cia director',
    'us treasury secretary', 'treasury department'
  ],
  iran: [
    'khamenei', 'supreme leader', 'pezeshkian', 'iranian president', 'zarif',
    'irgc commander', 'revolutionary guard', 'iranian foreign minister',
    'araghchi', 'iranian military', 'tehran', 'iran nuclear'
  ],
  israel: [
    'netanyahu', 'gallant', 'idf spokesperson', 'israeli defense',
    'israeli prime minister', 'knesset', 'mossad', 'shin bet',
    'israeli military', 'war cabinet'
  ],
  russia: [
    'putin', 'lavrov', 'shoigu', 'kremlin', 'russian defense',
    'russian military', 'moscow', 'medvedev', 'russian foreign'
  ],
  china: [
    'xi jinping', 'wang yi', 'chinese defense', 'pla', 'beijing',
    'chinese foreign ministry', 'chinese military'
  ],
  gulf: [
    'saudi', 'mbs', 'mohammed bin salman', 'uae', 'qatar', 'opec',
    'gulf cooperation', 'gcc', 'kuwait', 'bahrain', 'oman',
    'saudi aramco', 'arab league'
  ],
  europe: [
    'nato', 'nato secretary', 'stoltenberg', 'rutte', 'eu foreign',
    'borrell', 'macron', 'scholz', 'starmer', 'european council',
    'european commission'
  ],
  un: [
    'united nations', 'un secretary', 'guterres', 'security council',
    'un resolution', 'iaea', 'un envoy', 'un peacekeeping'
  ]
};

// Instrument → war impact weighting
// Higher weight = more sensitive to geopolitical events
const WAR_INSTRUMENT_SENSITIVITY = {
  CL: { weight: 0.95, name: 'Crude Oil WTI',      warBias: 'BULLISH',  reason: 'Supply disruption fears spike oil' },
  NG: { weight: 0.80, name: 'Natural Gas',         warBias: 'BULLISH',  reason: 'Energy complex follows oil in conflict' },
  GC: { weight: 0.90, name: 'Gold',                warBias: 'BULLISH',  reason: 'Ultimate safe haven in geopolitical crisis' },
  SI: { weight: 0.60, name: 'Silver',              warBias: 'BULLISH',  reason: 'Follows gold but with industrial drag' },
  DX: { weight: 0.75, name: 'US Dollar Index',     warBias: 'BULLISH',  reason: 'Flight to safety strengthens dollar' },
  '6J': { weight: 0.70, name: 'Japanese Yen',      warBias: 'BULLISH',  reason: 'Traditional safe-haven currency' },
  '6E': { weight: 0.65, name: 'Euro FX',           warBias: 'BEARISH',  reason: 'European proximity to conflicts weakens euro' },
  ES: { weight: 0.70, name: 'S&P 500 E-mini',      warBias: 'BEARISH',  reason: 'Risk-off pressure on equities' },
  NQ: { weight: 0.75, name: 'Nasdaq 100 E-mini',   warBias: 'BEARISH',  reason: 'Growth/tech hit hardest in risk-off' },
  YM: { weight: 0.60, name: 'Dow Jones E-mini',    warBias: 'BEARISH',  reason: 'Defensive names buffer but still pressured' },
  RTY: { weight: 0.65, name: 'Russell 2000 E-mini', warBias: 'BEARISH', reason: 'Small caps most vulnerable to uncertainty' },
  ZW: { weight: 0.70, name: 'Wheat',               warBias: 'BULLISH',  reason: 'Black Sea export disruption risk' },
  ZC: { weight: 0.55, name: 'Corn',                warBias: 'BULLISH',  reason: 'Grain complex correlation with wheat' },
  ZN: { weight: 0.60, name: 'Ten-Year Note',       warBias: 'BULLISH',  reason: 'Flight to quality drives bond prices up' },
  '6A': { weight: 0.50, name: 'Australian Dollar',  warBias: 'BEARISH', reason: 'Risk-sensitive commodity currency' },
};

// Timeframe recommendations based on event type
const TIMEFRAME_GUIDANCE = {
  missile_strike: {
    primary: '5m',
    secondary: '15m',
    reasoning: 'Immediate price shock — watch 5m for initial reaction, 15m for first retracement'
  },
  official_statement: {
    primary: '15m',
    secondary: '1h',
    reasoning: 'Statements take 15-30 min to be fully priced — watch 15m for direction, 1h for follow-through'
  },
  sanctions: {
    primary: '1h',
    secondary: '4h',
    reasoning: 'Sanctions impact unfolds over hours — use 1h for entry, 4h for trend confirmation'
  },
  ceasefire: {
    primary: '15m',
    secondary: '1h',
    reasoning: 'Ceasefire news reverses risk-off quickly — 15m for entry on the relief rally'
  },
  escalation: {
    primary: '5m',
    secondary: '15m',
    reasoning: 'Escalation creates fast moves — 5m for momentum entries, 15m for pullback trades'
  },
  troop_movement: {
    primary: '1h',
    secondary: '4h',
    reasoning: 'Troop movements signal prolonged tension — use higher timeframes for positioning'
  }
};

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Detect what type of war event the latest news represents
 */
function detectEventType(newsItems) {
  if (!newsItems || newsItems.length === 0) return 'escalation';

  const latestHeadlines = newsItems.slice(0, 5).map(n => n.headline.toLowerCase()).join(' ');

  if (/missile|strike|bomb|airstrike|drone strike|shelling/.test(latestHeadlines)) return 'missile_strike';
  if (/trump|president|official|statement|warned|said|announced|declared/.test(latestHeadlines)) return 'official_statement';
  if (/sanction|embargo|ban|freeze|restrict/.test(latestHeadlines)) return 'sanctions';
  if (/ceasefire|peace|truce|negotiat|deal|agreement/.test(latestHeadlines)) return 'ceasefire';
  if (/troops|deploy|mobiliz|military buildup|reinforce/.test(latestHeadlines)) return 'troop_movement';
  return 'escalation';
}

/**
 * Tag news items with official mentions
 */
function tagOfficialMentions(newsItems) {
  return newsItems.map(item => {
    const text = `${item.headline} ${item.summary || ''}`.toLowerCase();
    const officialMentions = [];

    for (const [group, keywords] of Object.entries(KEY_OFFICIALS)) {
      const matched = keywords.filter(kw => text.includes(kw));
      if (matched.length > 0) {
        officialMentions.push({
          group: group.toUpperCase(),
          matched,
          isKeyOfficial: true
        });
      }
    }

    return {
      ...item,
      officialMentions,
      hasOfficialStatement: officialMentions.length > 0,
      officialGroups: officialMentions.map(o => o.group)
    };
  });
}

/**
 * Calculate war-specific bias for an instrument using conflict data + technicals
 */
function calculateWarBias(instrument, warData, technicals, priceData) {
  const config = WAR_INSTRUMENT_SENSITIVITY[instrument];
  if (!config) return null;

  const { riskSummary, conflictZones } = warData;

  // 1. War Sentiment Score (from conflict news)
  let warScore = 0;
  const riskLevel = { EXTREME: 3, HIGH: 2, ELEVATED: 1, MODERATE: 0.5, LOW: 0 };
  warScore += (riskLevel[riskSummary.overallRisk] || 0) * config.weight;

  // Adjust direction based on instrument type
  if (config.warBias === 'BEARISH') warScore = -warScore;

  // 2. Escalation momentum
  const escalationRatio = riskSummary.sentimentBreakdown.escalation /
    Math.max(1, riskSummary.sentimentBreakdown.escalation + riskSummary.sentimentBreakdown.deescalation);
  const escalationBoost = (escalationRatio - 0.5) * 2 * config.weight;
  if (config.warBias === 'BULLISH') warScore += escalationBoost;
  else warScore -= escalationBoost;

  // 3. Is this instrument directly in an active zone?
  const directlyAffected = Object.values(conflictZones).filter(z =>
    z.affectedInstruments?.includes(instrument) && z.recentNewsCount > 0
  );
  if (directlyAffected.length > 0) {
    const zoneBoost = directlyAffected.reduce((sum, z) => {
      const severity = { CRITICAL: 1.5, HIGH: 1, ELEVATED: 0.5, MODERATE: 0.25, LOW: 0 };
      return sum + (severity[z.severity] || 0);
    }, 0);
    if (config.warBias === 'BULLISH') warScore += zoneBoost * 0.5;
    else warScore -= zoneBoost * 0.5;
  }

  // 4. Technical alignment
  let techAlignment = 'UNKNOWN';
  let techDetails = null;
  if (technicals) {
    techDetails = {
      ema9: technicals.ema9,
      ema21: technicals.ema21,
      adx: technicals.adx?.adx,
      trend: technicals.trend,
      trendStrength: technicals.trendStrength
    };

    // Does technical trend align with war bias?
    const techBullish = technicals.trend === 'BULLISH' || technicals.trend === 'UP';
    const techBearish = technicals.trend === 'BEARISH' || technicals.trend === 'DOWN';

    if ((config.warBias === 'BULLISH' && techBullish) || (config.warBias === 'BEARISH' && techBearish)) {
      techAlignment = 'ALIGNED';
      warScore *= 1.3; // Amplify when war bias + technicals agree
    } else if ((config.warBias === 'BULLISH' && techBearish) || (config.warBias === 'BEARISH' && techBullish)) {
      techAlignment = 'DIVERGENT';
      warScore *= 0.7; // Dampen when they disagree
    } else {
      techAlignment = 'NEUTRAL';
    }
  }

  // 5. Price data
  let priceInfo = null;
  if (priceData) {
    priceInfo = {
      price: priceData.price || priceData.regularMarketPrice,
      change: priceData.change || priceData.regularMarketChange,
      changePercent: priceData.changePercent || priceData.regularMarketChangePercent
    };
  }

  // Final bias
  let bias;
  const absScore = Math.abs(warScore);
  if (absScore >= 3) bias = warScore > 0 ? 'S.BULLISH' : 'S.BEARISH';
  else if (absScore >= 1.5) bias = warScore > 0 ? 'BULLISH' : 'BEARISH';
  else if (absScore >= 0.5) bias = warScore > 0 ? 'SLIGHT BULLISH' : 'SLIGHT BEARISH';
  else bias = 'NEUTRAL';

  // Confidence
  const confidence = Math.min(100, Math.max(20, Math.round(
    40 + (absScore * 12) + (techAlignment === 'ALIGNED' ? 15 : 0) + (directlyAffected.length * 5)
  )));

  return {
    instrument,
    name: config.name,
    warBias: config.warBias,
    warReason: config.reason,
    bias,
    score: parseFloat(warScore.toFixed(2)),
    confidence,
    techAlignment,
    techDetails,
    priceInfo,
    directlyAffectedZones: directlyAffected.map(z => z.name),
    sensitivity: config.weight
  };
}

/**
 * Build recommended technicals for an instrument based on event type
 */
function buildTechnicalGuidance(instrument, eventType, technicals) {
  const tf = TIMEFRAME_GUIDANCE[eventType] || TIMEFRAME_GUIDANCE.escalation;
  const config = WAR_INSTRUMENT_SENSITIVITY[instrument];

  const guidance = {
    recommendedTimeframes: {
      primary: tf.primary,
      secondary: tf.secondary,
      reasoning: tf.reasoning
    },
    indicatorsToWatch: [
      'EMA 9/21 crossover — entry/exit signal',
      'ADX > 25 — confirms trending move, not noise',
      'Volume spike — confirms institutional participation'
    ],
    eventType,
    eventTypeLabel: eventType.replace(/_/g, ' ').toUpperCase()
  };

  // Add instrument-specific guidance
  if (['CL', 'NG'].includes(instrument)) {
    guidance.indicatorsToWatch.push('Crack Spread — watch refinery margins for supply signal');
    guidance.indicatorsToWatch.push('EIA inventory levels — fundamental floor/ceiling');
    guidance.keyLevels = 'Watch previous session high/low — war spikes often test and reject';
  } else if (instrument === 'GC') {
    guidance.indicatorsToWatch.push('Gold/Silver Ratio — above 80 = extreme fear, confirms GC bid');
    guidance.indicatorsToWatch.push('DXY inverse — if dollar also strong, GC rally may be limited');
    guidance.keyLevels = 'Watch round numbers ($50 intervals) — psychological resistance during panic';
  } else if (['ES', 'NQ', 'YM', 'RTY'].includes(instrument)) {
    guidance.indicatorsToWatch.push('VIX — if spiking above 25, expect gap-and-go or gap-and-fade');
    guidance.indicatorsToWatch.push('PUT/CALL ratio — extreme readings signal capitulation');
    guidance.keyLevels = 'Watch overnight session low — war selling often stops at Asia session support';
  } else if (['6J', '6E', 'DX'].includes(instrument)) {
    guidance.indicatorsToWatch.push('Yield spreads — flight-to-safety flows show in bonds first');
    guidance.keyLevels = 'Watch 200-period EMA on 1h — currencies mean-revert after geopolitical shock';
  } else if (['ZW', 'ZC'].includes(instrument)) {
    guidance.indicatorsToWatch.push('Black Sea shipping indices — real supply disruption signal');
    guidance.keyLevels = 'Watch limit levels — grains can lock limit-up on supply shocks';
  }

  // Add technical data if available
  if (technicals) {
    guidance.currentTechnicals = {
      ema9: technicals.ema9,
      ema21: technicals.ema21,
      emaCross: technicals.ema9 && technicals.ema21
        ? (technicals.ema9 > technicals.ema21 ? 'BULLISH (9 above 21)' : 'BEARISH (9 below 21)')
        : 'N/A',
      adx: technicals.adx?.adx,
      adxSignal: technicals.adx?.adx > 25
        ? 'TRENDING — trust the move'
        : 'CHOPPY — wait for confirmation',
      trend: technicals.trend,
      trendStrength: technicals.trendStrength
    };
  }

  return guidance;
}

/**
 * Get expected move description
 */
function getExpectedMove(instrument, bias, eventType, riskLevel) {
  const config = WAR_INSTRUMENT_SENSITIVITY[instrument];
  if (!config) return 'Monitor for developments';

  const moves = {
    CL: {
      ESCALATION: 'Expect $2-5 spike on initial headline, possible $8-12 if Strait of Hormuz threatened',
      'DE-ESCALATION': 'Expect $1-3 pullback as risk premium unwinds',
      SANCTIONS: 'Gradual $3-6 grind higher as supply tightens over days'
    },
    GC: {
      ESCALATION: 'Expect $20-40 spike to safe-haven bid, $50+ if nuclear rhetoric',
      'DE-ESCALATION': 'Expect $10-25 pullback as fear premium fades',
      SANCTIONS: 'Mild support, $5-15 higher on uncertainty'
    },
    ES: {
      ESCALATION: 'Expect 30-80 point drop, deeper if US directly involved',
      'DE-ESCALATION': 'Expect 20-50 point relief rally',
      SANCTIONS: 'Mixed, -10 to -30 initial then sector rotation'
    },
    NQ: {
      ESCALATION: 'Expect 100-250 point drop — tech leads risk-off selling',
      'DE-ESCALATION': 'Expect 80-150 point bounce — tech recovers fastest',
      SANCTIONS: 'Watch chip names if China/Taiwan involved'
    },
    NG: {
      ESCALATION: 'Expect 3-8% spike if Europe/Russia pipeline affected',
      'DE-ESCALATION': 'Expect 2-5% pullback',
      SANCTIONS: 'Depends on sanctioned country — Russia = huge, others = mild'
    },
    ZW: {
      ESCALATION: 'Expect 3-5% spike if Black Sea exports threatened',
      'DE-ESCALATION': 'Expect 2-3% pullback',
      SANCTIONS: 'Watch for export bans from producing nations'
    }
  };

  const sentiment = bias.includes('BULLISH') ? 'ESCALATION' : bias.includes('BEARISH') ? 'ESCALATION' : 'NEUTRAL';
  return moves[instrument]?.[sentiment] || `${config.name} sensitive to geopolitical shifts — ${config.reason}`;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Generate full WarWatch analysis with AI synthesis
 */
export async function generateWarWatchAnalysis(options = {}) {
  const { forceRefresh = false } = options;
  const now = Date.now();

  // Check cache
  if (!forceRefresh && warAnalysisCache && warAnalysisCacheTime &&
      (now - warAnalysisCacheTime) < WAR_ANALYSIS_CACHE_DURATION) {
    console.log('Returning cached WarWatch analysis');
    return warAnalysisCache;
  }

  console.log('Generating WarWatch AI analysis...');

  // 1. Fetch war data
  const warData = await fetchWarWatchData();

  // 2. Tag official mentions in news
  const taggedNews = tagOfficialMentions(warData.news);
  const officialStatements = taggedNews.filter(n => n.hasOfficialStatement);

  // 3. Detect current event type
  const eventType = detectEventType(taggedNews);

  // 4. Fetch technical data for war-sensitive instruments
  const topInstruments = ['CL', 'GC', 'ES', 'NQ', 'NG', 'DX', '6J', '6E', 'ZW', 'ZN', 'YM', 'RTY'];
  const techPromises = topInstruments.map(async (symbol) => {
    const yahooSymbol = YAHOO_SYMBOLS[symbol];
    if (!yahooSymbol) return { symbol, tech: null };
    try {
      const tech = await analyzeTechnicals(yahooSymbol);
      return { symbol, tech };
    } catch (e) {
      return { symbol, tech: null };
    }
  });

  // 5. Fetch live prices
  let futuresData = {};
  let currencyData = {};
  try {
    [futuresData, currencyData] = await Promise.all([
      fetchYahooFinanceFutures(),
      fetchCurrencyFutures()
    ]);
  } catch (e) {
    console.warn('Could not fetch price data:', e.message);
  }
  const allPrices = { ...futuresData, ...currencyData };

  // 6. Fetch COT + Put/Call
  let cotData = null;
  let putCallData = null;
  try { cotData = getAllCOTData(); } catch (e) { /* optional */ }
  try { putCallData = getPutCallRatio(); } catch (e) { /* optional */ }

  // 7. Wait for technicals
  const techResults = await Promise.all(techPromises);
  const technicals = {};
  techResults.forEach(({ symbol, tech }) => { technicals[symbol] = tech; });

  // 8. Calculate war bias for each instrument
  const instrumentAnalysis = {};
  for (const symbol of topInstruments) {
    instrumentAnalysis[symbol] = calculateWarBias(
      symbol, warData, technicals[symbol], allPrices[symbol]
    );
  }

  // 9. Rank by impact — top 5 most affected
  const ranked = Object.values(instrumentAnalysis)
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const top5 = ranked.slice(0, 5);

  // 10. Build technical guidance for top 5
  const technicalGuidance = {};
  top5.forEach(inst => {
    technicalGuidance[inst.instrument] = buildTechnicalGuidance(
      inst.instrument, eventType, technicals[inst.instrument]
    );
  });

  // 11. Build expected moves
  const expectedMoves = {};
  top5.forEach(inst => {
    expectedMoves[inst.instrument] = getExpectedMove(
      inst.instrument, inst.bias, eventType, warData.riskSummary.overallRisk
    );
  });

  // 12. Generate AI brief
  const aiBrief = await generateWarAIBrief(
    warData, taggedNews, officialStatements, top5,
    technicalGuidance, expectedMoves, eventType, cotData, putCallData
  );

  // 13. Build response
  const result = {
    lastUpdate: new Date().toISOString(),
    eventType,
    eventTypeLabel: eventType.replace(/_/g, ' ').toUpperCase(),

    riskSummary: warData.riskSummary,

    top5MostAffected: top5.map(inst => ({
      ...inst,
      technicalGuidance: technicalGuidance[inst.instrument],
      expectedMove: expectedMoves[inst.instrument]
    })),

    allInstruments: instrumentAnalysis,

    officialStatements: officialStatements.slice(0, 15).map(n => ({
      headline: n.headline,
      source: n.source,
      timestamp: n.timestamp,
      relativeTime: n.relativeTime,
      officialGroups: n.officialGroups,
      sentiment: n.sentiment,
      primaryZone: n.primaryZone,
      impact: n.impact,
      url: n.url
    })),

    breakingAlerts: warData.breakingAlerts.slice(0, 5),

    conflictZones: warData.conflictZones,

    aiBrief,

    positioning: {
      cot: cotData?._summary?.extremes || null,
      putCall: putCallData?.summary || null
    },

    sourceStats: warData.sourceStats,
    totalNewsItems: warData.totalItems
  };

  // Cache
  warAnalysisCache = result;
  warAnalysisCacheTime = now;

  return result;
}

// ============================================================================
// AI BRIEF GENERATION
// ============================================================================

/**
 * Generate Claude AI war-focused trading brief
 */
async function generateWarAIBrief(warData, taggedNews, officialStatements, top5, techGuidance, expectedMoves, eventType, cotData, putCallData) {
  const client = getAnthropicClient();
  if (!client) {
    return buildFallbackWarBrief(warData, top5, eventType);
  }

  // Build official statements context
  const officialCtx = officialStatements.slice(0, 8).map(n =>
    `[${n.officialGroups.join(',')}] "${n.headline}" (${n.source}, ${n.relativeTime})`
  ).join('\n');

  // Build top 5 instruments context
  const instrumentCtx = top5.map(inst => {
    const tg = techGuidance[inst.instrument];
    const em = expectedMoves[inst.instrument];
    return `${inst.instrument} (${inst.name}):
  War Bias: ${inst.bias} (${inst.confidence}% confidence)
  Reason: ${inst.warReason}
  Tech Alignment: ${inst.techAlignment}
  EMA9/21: ${tg?.currentTechnicals?.emaCross || 'N/A'}
  ADX: ${tg?.currentTechnicals?.adx || 'N/A'} — ${tg?.currentTechnicals?.adxSignal || 'N/A'}
  Trend: ${tg?.currentTechnicals?.trend || 'N/A'}
  Price: ${inst.priceInfo?.price || 'N/A'} (${inst.priceInfo?.changePercent?.toFixed(2) || '0'}%)
  Expected Move: ${em}
  Zones: ${inst.directlyAffectedZones?.join(', ') || 'General'}`;
  }).join('\n\n');

  // Breaking alerts context
  const alertCtx = warData.breakingAlerts.slice(0, 5).map(a =>
    `! ${a.headline} [${a.primaryZone}] (${a.source})`
  ).join('\n');

  // Escalating zones
  const escalatingCtx = warData.riskSummary.escalatingZones?.join(', ') || 'None';

  // COT context
  const cotCtx = cotData?._summary?.extremes
    ? `Crowded Long: ${cotData._summary.extremes.crowdedLong?.join(', ') || 'none'} | Crowded Short: ${cotData._summary.extremes.crowdedShort?.join(', ') || 'none'}`
    : 'COT data unavailable';

  // Put/Call
  const pcCtx = putCallData?.summary
    ? `Put/Call: ${putCallData.summary.equityRatio?.toFixed(2)} (${putCallData.summary.overallSentiment})`
    : 'Put/Call unavailable';

  const prompt = `You are a senior geopolitical risk analyst on a futures trading desk. Write a focused, actionable WAR WATCH brief based on current conflict intelligence. This is NOT a general market brief — focus ONLY on geopolitical/war-related market impact.

CURRENT GEOPOLITICAL RISK: ${warData.riskSummary.overallRisk}
MARKET BIAS: ${warData.riskSummary.marketBias}
EVENT TYPE: ${eventType.replace(/_/g, ' ').toUpperCase()}
ESCALATING ZONES: ${escalatingCtx}

BREAKING ALERTS:
${alertCtx || 'No breaking alerts'}

KEY OFFICIAL STATEMENTS:
${officialCtx || 'No official statements detected'}

TOP 5 MOST AFFECTED INSTRUMENTS:
${instrumentCtx}

POSITIONING:
${cotCtx}
${pcCtx}

TRADING IMPLICATION: ${warData.riskSummary.tradingImplication}

You MUST respond with valid JSON only. No markdown, no text outside the JSON. Return this exact structure:

{
  "headline": "One-line summary of the #1 most critical development RIGHT NOW (max 15 words)",
  "situation": "2-3 bullet points on what is happening — who did/said what, which zones are escalating",
  "keyStatements": ["Direct quotes or paraphrased statements from Trump, Iran, Gulf officials — one per item, include [COUNTRY] tag"],
  "topPicks": [
    {
      "symbol": "CL",
      "direction": "LONG or SHORT",
      "reason": "One line why — tie to the war event",
      "entry": "How to enter (e.g. 'Buy dips near session low' or 'Sell rallies into resistance')",
      "target": "Expected move in $ or points",
      "stopLogic": "Where to stop and why"
    }
  ],
  "technicals": "1-2 sentences on which timeframe and indicators matter for this event type",
  "risk": "1-2 sentences on de-escalation risk — what flips the bias",
  "actionVerdict": "One final sentence: the single most important action a trader should take RIGHT NOW"
}

Rules:
- topPicks: include the top 2-3 instruments only (the clearest setups)
- keyStatements: include 2-4 statements from officials (Trump, Iran, Gulf, Israel etc). If none, use empty array
- Use instrument symbols (CL, GC, ES, NQ, 6J, DX etc)
- Be direct, professional. No disclaimers.
- situation should be an array of strings (bullet points)
- MUST be valid parseable JSON`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    });

    const rawText = response.content[0]?.text || '';

    // Parse JSON response
    let parsed = null;
    try {
      // Try direct parse
      parsed = JSON.parse(rawText);
    } catch (e) {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1].trim()); } catch (e2) { /* fall through */ }
      }
      // Try finding first { to last }
      if (!parsed) {
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          try { parsed = JSON.parse(rawText.slice(start, end + 1)); } catch (e3) { /* fall through */ }
        }
      }
    }

    if (parsed) {
      return {
        ...parsed,
        generated: true,
        model: 'claude-sonnet',
        timestamp: new Date().toISOString(),
        // Keep raw text as fallback
        text: rawText
      };
    }

    // If JSON parse failed, return as text
    return {
      text: rawText,
      headline: null,
      situation: null,
      topPicks: null,
      generated: true,
      model: 'claude-sonnet',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('WarWatch AI brief error:', error.message);
    return buildFallbackWarBrief(warData, top5, eventType);
  }
}

/**
 * Fallback brief without AI
 */
function buildFallbackWarBrief(warData, top5, eventType) {
  const risk = warData.riskSummary;
  const zones = risk.escalatingZones?.join(', ') || 'multiple regions';

  return {
    headline: `${risk.overallRisk} geopolitical risk — ${eventType.replace(/_/g, ' ')}`,
    situation: [
      `Escalation detected in ${zones}`,
      `${risk.breakingAlerts} breaking alert(s) active`,
      risk.tradingImplication
    ],
    keyStatements: [],
    topPicks: top5.slice(0, 3).map(inst => ({
      symbol: inst.instrument,
      direction: inst.warBias === 'BULLISH' ? 'LONG' : 'SHORT',
      reason: inst.warReason,
      entry: 'Monitor for headline-driven entries',
      target: 'See expected move data',
      stopLogic: 'Use session high/low as stop reference'
    })),
    technicals: `Event type ${eventType.replace(/_/g, ' ')} — use primary timeframe for momentum entries`,
    risk: 'Monitor for de-escalation headlines that would flip bias',
    actionVerdict: `${risk.marketBias} environment — safe havens bid, reduce equity exposure`,
    text: null,
    generated: false,
    model: 'fallback',
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get top 5 most affected instruments only (lightweight)
 */
export async function getTop5Affected() {
  const data = await generateWarWatchAnalysis();
  return data.top5MostAffected;
}

/**
 * Clear cache
 */
export function clearWarAnalysisCache() {
  warAnalysisCache = null;
  warAnalysisCacheTime = null;
}

/**
 * Get cache status
 */
export function getWarAnalysisCacheStatus() {
  return {
    cached: !!warAnalysisCache,
    cacheAge: warAnalysisCacheTime ? Date.now() - warAnalysisCacheTime : null,
    maxAge: WAR_ANALYSIS_CACHE_DURATION
  };
}

export default {
  generateWarWatchAnalysis,
  getTop5Affected,
  clearWarAnalysisCache,
  getWarAnalysisCacheStatus
};
