/**
 * AI Agents - Hierarchical Claude AI analysis system
 * Phase 5 of Session Enhancement
 *
 * Sub-agents:
 * - News Agent: Analyzes headlines for session impact
 * - Levels Agent: Analyzes price levels and structure
 * - Macro Agent: Analyzes correlations and macro conditions
 * - Master Orchestrator: Synthesizes all agent outputs
 */

import Anthropic from '@anthropic-ai/sdk';
import { calculateAllMetrics } from './calculatedMetrics.js';
import { formatReportsForPrompt, getEventRiskSummary } from './reportSchedule.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Cache for agent results (5 minute TTL)
const agentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ============================================================================
// NEWS KEYWORD DICTIONARY - Maps keywords to affected instruments
// From INSTRUMENT_DRIVERS_REFERENCE.md
// ============================================================================

const NEWS_KEYWORD_MAP = {

  // === US INDICES ===
  ES_NQ_YM_RTY: [
    'Fed', 'FOMC', 'Powell', 'rate cut', 'rate hike', 'interest rate',
    'CPI', 'inflation', 'PCE', 'NFP', 'payroll', 'jobs report',
    'GDP', 'recession', 'ISM', 'manufacturing PMI', 'services PMI',
    'consumer confidence', 'retail sales', 'unemployment'
  ],
  NQ_SPECIFIC: [
    'NVDA', 'Nvidia', 'AAPL', 'Apple', 'MSFT', 'Microsoft',
    'GOOGL', 'Google', 'Alphabet', 'META', 'Facebook',
    'AMZN', 'Amazon', 'TSLA', 'Tesla',
    'semiconductor', 'AI chip', 'artificial intelligence',
    'antitrust', 'tech regulation', 'cloud spending',
    'SOX', 'chip stocks', 'Magnificent Seven', 'Mag7'
  ],
  YM_SPECIFIC: [
    'UnitedHealth', 'UNH', 'Goldman Sachs', 'JPMorgan',
    'Boeing', 'Caterpillar', 'Dow Jones',
    'infrastructure bill', 'defense spending',
    'dividend', 'blue chip', 'industrial production',
    'durable goods', 'trade tariff'
  ],
  RTY_SPECIFIC: [
    'small cap', 'Russell 2000', 'IWM',
    'regional bank', 'KRE', 'community bank',
    'small business', 'NFIB', 'credit tightening',
    'junk bond', 'high yield', 'IPO', 'M&A',
    'biotech', 'FDA approval', 'PDUFA'
  ],

  // === METALS ===
  GC_GOLD: [
    'gold', 'bullion', 'gold reserve', 'GLD',
    'PBOC gold', 'central bank buying',
    'safe haven', 'real yield', 'COMEX gold',
    'London fix', 'India gold', 'China gold',
    'gold mine', 'Newmont', 'Barrick'
  ],
  SI_SILVER: [
    'silver', 'SLV', 'silver mine',
    'solar panel', 'photovoltaic',
    'gold silver ratio', 'industrial metal',
    'COMEX silver'
  ],
  HG_COPPER: [
    'copper', 'Dr. Copper', 'LME copper',
    'copper mine', 'Chile copper', 'Peru copper',
    'Freeport', 'copper inventory',
    'EV copper', 'electric vehicle copper',
    'data center copper', 'power grid'
  ],

  // === ENERGY ===
  CL_CRUDE: [
    'crude oil', 'WTI', 'Brent', 'OPEC',
    'oil inventory', 'EIA petroleum', 'API inventory',
    'Baker Hughes', 'rig count', 'oil production',
    'SPR', 'strategic petroleum', 'refinery',
    'Iran', 'Saudi', 'OPEC+', 'production cut',
    'Houthi', 'Red Sea', 'Strait of Hormuz',
    'oil tanker', 'pipeline', 'Cushing'
  ],
  NG_NATGAS: [
    'natural gas', 'Henry Hub', 'LNG',
    'EIA storage', 'gas storage', 'gas injection',
    'polar vortex', 'heating degree', 'cooling degree',
    'Freeport LNG', 'gas pipeline', 'gas production',
    'TTF', 'European gas'
  ],
  RB_GASOLINE: [
    'gasoline', 'RBOB', 'gas prices',
    'crack spread', 'refinery utilization',
    'driving season', 'summer blend',
    'ethanol', 'RIN credit', 'fuel demand'
  ],

  // === AGRICULTURE ===
  ZC_CORN: [
    'corn', 'USDA corn', 'ethanol', 'corn belt',
    'Iowa', 'Illinois', 'planting', 'corn harvest',
    'WASDE corn', 'corn export', 'feed grain',
    'crop condition', 'corn drought'
  ],
  ZS_SOYBEANS: [
    'soybean', 'USDA soy', 'soy crush',
    'China soybean', 'Brazil soybean', 'Argentina soy',
    'soy export', 'WASDE soy', 'bean harvest'
  ],
  ZW_WHEAT: [
    'wheat', 'Black Sea grain', 'Russia wheat',
    'Ukraine grain', 'wheat export', 'WASDE wheat',
    'India wheat ban', 'Kansas wheat',
    'spring wheat', 'winter wheat'
  ],
  ZM_SOYMEAL: [
    'soybean meal', 'NOPA crush', 'feed demand',
    'livestock feed', 'meal export', 'Argentina meal'
  ],
  ZL_SOYOIL: [
    'soybean oil', 'renewable diesel', 'biodiesel',
    'RIN', 'EPA renewable', 'palm oil',
    'canola', 'rapeseed', 'cooking oil'
  ],
  LE_CATTLE: [
    'cattle', 'beef', 'cattle on feed',
    'beef cutout', 'packer margin', 'cattle herd',
    'beef export', 'drought pasture', 'feeder cattle'
  ],
  HE_HOGS: [
    'lean hog', 'pork', 'hogs and pigs',
    'pork cutout', 'hog slaughter', 'African swine fever',
    'ASF', 'pork export', 'China pork'
  ],

  // === CURRENCIES ===
  DX_DOLLAR: [
    'dollar index', 'DXY', 'US dollar',
    'dollar strength', 'greenback',
    'reserve currency', 'de-dollarization'
  ],
  E6_EURO: [
    'ECB', 'Lagarde', 'euro', 'eurozone',
    'German economy', 'IFO', 'ZEW',
    'EU PMI', 'European growth', 'Italian debt',
    'French election', 'EU fiscal'
  ],
  J6_YEN: [
    'BOJ', 'Bank of Japan', 'yen', 'Ueda',
    'yield curve control', 'YCC', 'Japan intervention',
    'MOF intervention', 'carry trade', 'yen unwind',
    'Japan CPI', 'Tokyo CPI', 'Nikkei'
  ],
  B6_POUND: [
    'BOE', 'Bank of England', 'pound', 'sterling',
    'UK CPI', 'UK GDP', 'UK employment', 'UK wages',
    'gilt', 'UK housing', 'UK PMI'
  ],
  A6_AUD: [
    'RBA', 'Australian dollar', 'Aussie',
    'iron ore', 'Australia employment',
    'Australia CPI', 'China stimulus'
  ],
  C6_CAD: [
    'Bank of Canada', 'BOC', 'Canadian dollar', 'loonie',
    'Canada jobs', 'Canada employment',
    'USMCA', 'Canada housing', 'Canadian oil'
  ],
  S6_CHF: [
    'SNB', 'Swiss National Bank', 'Swiss franc',
    'Switzerland', 'SNB intervention',
    'Swiss CPI', 'safe haven franc'
  ],

  // === CRYPTO ===
  BTC_BITCOIN: [
    'Bitcoin', 'BTC', 'IBIT', 'FBTC',
    'Bitcoin ETF', 'spot ETF', 'crypto regulation',
    'SEC crypto', 'MicroStrategy', 'MSTR', 'Saylor',
    'halving', 'mining hash rate', 'Coinbase',
    'Bitcoin reserve', 'crypto executive order'
  ],
  ETH_ETHEREUM: [
    'Ethereum', 'ETH', 'Ether',
    'ETH ETF', 'DeFi', 'smart contract',
    'layer 2', 'Arbitrum', 'staking',
    'gas fee', 'Vitalik', 'NFT'
  ],

  // === INTERNATIONAL ===
  DAX_GERMAN: [
    'DAX', 'German', 'Germany', 'Bundesbank',
    'VW', 'BMW', 'Siemens', 'SAP',
    'German PMI', 'German industry', 'Scholz',
    'German auto', 'EU tariff'
  ],
  FTSE_UK: [
    'FTSE', 'London Stock Exchange', 'UK market',
    'BP', 'Shell', 'Rio Tinto', 'Glencore',
    'AstraZeneca', 'HSBC', 'UK economy'
  ],
  STOXX_EU: [
    'Euro Stoxx', 'European stocks', 'EU market',
    'ASML', 'LVMH', 'TotalEnergies',
    'European bank', 'Eurozone', 'EU growth'
  ]
};

// Map keyword groups to actual trading symbols
const KEYWORD_GROUP_TO_SYMBOLS = {
  ES_NQ_YM_RTY: ['ES', 'NQ', 'YM', 'RTY'],
  NQ_SPECIFIC: ['NQ'],
  YM_SPECIFIC: ['YM'],
  RTY_SPECIFIC: ['RTY'],
  GC_GOLD: ['GC'],
  SI_SILVER: ['SI'],
  HG_COPPER: ['HG'],
  CL_CRUDE: ['CL'],
  NG_NATGAS: ['NG'],
  RB_GASOLINE: ['RB'],
  ZC_CORN: ['ZC'],
  ZS_SOYBEANS: ['ZS'],
  ZW_WHEAT: ['ZW'],
  ZM_SOYMEAL: ['ZM'],
  ZL_SOYOIL: ['ZL'],
  LE_CATTLE: ['LE'],
  HE_HOGS: ['HE'],
  DX_DOLLAR: ['DX'],
  E6_EURO: ['6E'],
  J6_YEN: ['6J'],
  B6_POUND: ['6B'],
  A6_AUD: ['6A'],
  C6_CAD: ['6C'],
  S6_CHF: ['6S'],
  BTC_BITCOIN: ['BTC'],
  ETH_ETHEREUM: ['ETH'],
  DAX_GERMAN: ['DAX'],
  FTSE_UK: ['FTSE'],
  STOXX_EU: ['STOXX']
};

/**
 * Tag a headline with affected symbols based on keyword matching
 * @param {string} headline - The news headline text
 * @returns {string[]} - Array of affected symbol names
 */
function tagHeadlineWithSymbols(headline) {
  if (!headline) return [];

  const headlineLower = headline.toLowerCase();
  const affectedSymbols = new Set();

  for (const [group, keywords] of Object.entries(NEWS_KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (headlineLower.includes(keyword.toLowerCase())) {
        const symbols = KEYWORD_GROUP_TO_SYMBOLS[group] || [];
        symbols.forEach(s => affectedSymbols.add(s));
        break; // Found a match in this group, move to next group
      }
    }
  }

  return Array.from(affectedSymbols);
}

/**
 * Pre-process news data to add instrument tags
 * @param {Array} newsData - Raw news headlines
 * @returns {Array} - News with affectedSymbols added
 */
function preprocessNewsWithTags(newsData) {
  if (!newsData || !Array.isArray(newsData)) return [];

  return newsData.map(item => {
    const headline = item.headline || item.title || '';
    const autoTaggedSymbols = tagHeadlineWithSymbols(headline);

    return {
      ...item,
      autoTaggedSymbols,
      tagCount: autoTaggedSymbols.length
    };
  });
}

/**
 * NEWS AGENT - Analyzes headlines and news flow
 * Enhanced with keyword-based instrument tagging
 */
async function newsAgent(newsData, session) {
  const cacheKey = `news_${session}_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  if (!newsData || newsData.length === 0) {
    return { topStories: [], overallSentiment: 'neutral', urgentAlerts: [], keyThemes: [], taggedNews: [] };
  }

  // Pre-process news with instrument tags
  const taggedNews = preprocessNewsWithTags(newsData);

  // Format headlines with their auto-detected symbols
  const formattedHeadlines = taggedNews.slice(0, 15).map(n => {
    const headline = n.headline || n.title;
    const symbols = n.autoTaggedSymbols?.length > 0 ? ` [${n.autoTaggedSymbols.join(', ')}]` : '';
    return `- ${headline}${symbols} (${n.source || 'Unknown'})`;
  }).join('\n');

  // Count which symbols are most mentioned
  const symbolCounts = {};
  taggedNews.forEach(n => {
    (n.autoTaggedSymbols || []).forEach(s => {
      symbolCounts[s] = (symbolCounts[s] || 0) + 1;
    });
  });
  const topMentionedSymbols = Object.entries(symbolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symbol, count]) => `${symbol}(${count})`)
    .join(', ');

  const prompt = `You are a futures trading news analyst. Analyze these headlines for the ${session} session.

HEADLINES (with auto-detected affected instruments in brackets):
${formattedHeadlines}

MOST MENTIONED SYMBOLS: ${topMentionedSymbols || 'None detected'}

IMPORTANT: Use the auto-detected symbols in brackets as a guide. Each headline has been pre-tagged with the futures instruments it affects based on keyword analysis.

Respond in JSON format ONLY (no markdown, no explanation):
{
  "topStories": [{"headline": "", "impact": "HIGH/MEDIUM/LOW", "affectedSymbols": [], "bias": "bullish/bearish/neutral"}],
  "overallSentiment": "risk-on/risk-off/mixed",
  "urgentAlerts": [],
  "keyThemes": [],
  "hotSymbols": []
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };

    // Add the pre-tagged news and symbol counts to the result
    result.taggedNews = taggedNews.slice(0, 15);
    result.symbolMentions = symbolCounts;

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('News agent error:', error.message);
    return { error: true, message: error.message, topStories: [], overallSentiment: 'unknown', taggedNews: [] };
  }
}

/**
 * LEVELS AGENT - Analyzes price levels and structure
 */
async function levelsAgent(levelData, sweepData, session) {
  const cacheKey = `levels_${session}_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  const prompt = `You are an ICT/SMC price action analyst. Analyze these levels for the ${session} session.

CURRENT LEVELS:
${JSON.stringify(levelData, null, 2)}

RECENT SWEEPS:
${JSON.stringify(sweepData, null, 2)}

Respond in JSON format ONLY (no markdown, no explanation):
{
  "keyLevelsToWatch": [{"level": "", "price": 0, "reason": "", "probability": 0}],
  "sweepAnalysis": {"interpretation": "", "bias": "bullish/bearish/neutral"},
  "structureBias": "bullish/bearish/neutral",
  "tradingZones": {"buyZone": {"from": 0, "to": 0}, "sellZone": {"from": 0, "to": 0}}
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Levels agent error:', error.message);
    return { error: true, message: error.message };
  }
}

/**
 * MACRO AGENT - Analyzes correlations and macro conditions
 * Enhanced with calculated metrics for quantitative signals
 */
async function macroAgent(macroData, priceData = null) {
  const cacheKey = `macro_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  // Calculate derived metrics if price data is available
  let calculatedMetrics = null;
  if (priceData) {
    try {
      calculatedMetrics = calculateAllMetrics(priceData);
    } catch (err) {
      console.log('Could not calculate metrics:', err.message);
    }
  }

  // Build calculated metrics section for prompt
  let metricsSection = '';
  if (calculatedMetrics) {
    metricsSection = `
CALCULATED METRICS (Pre-computed signals):
- NQ-RTY Spread: ${calculatedMetrics.rotation?.nqRtySpread?.value || 'N/A'} → ${calculatedMetrics.rotation?.nqRtySpread?.interpretation || 'N/A'}
- Growth/Value (XLK-XLF): ${calculatedMetrics.rotation?.growthValue?.value || 'N/A'} → ${calculatedMetrics.rotation?.growthValue?.interpretation || 'N/A'}
- Gold/Silver Ratio: ${calculatedMetrics.riskSentiment?.goldSilverRatio?.value || 'N/A'} → ${calculatedMetrics.riskSentiment?.goldSilverRatio?.interpretation || 'N/A'}
- VIX Level: ${calculatedMetrics.riskSentiment?.vix?.value || 'N/A'} → ${calculatedMetrics.riskSentiment?.vix?.interpretation || 'N/A'}
- HYG Risk Signal: ${calculatedMetrics.riskSentiment?.hygSignal?.interpretation || 'N/A'}
- Crack Spread (RB-CL): ${calculatedMetrics.energy?.crackSpread?.value || 'N/A'} → ${calculatedMetrics.energy?.crackSpread?.interpretation || 'N/A'}
- Real Yield (10Y-CPI): ${calculatedMetrics.yields?.realYield?.value || 'N/A'} → ${calculatedMetrics.yields?.realYield?.interpretation || 'N/A'}
- Carry Trade Spread: ${calculatedMetrics.yields?.carryTrade?.value || 'N/A'} → ${calculatedMetrics.yields?.carryTrade?.interpretation || 'N/A'}
- Dollar Impact: ${calculatedMetrics.currency?.dollarImpact?.interpretation || 'N/A'}
- BTC-NQ Correlation: ${calculatedMetrics.crypto?.btcNqCorrelation?.interpretation || 'N/A'}
- OVERALL RISK TONE: ${calculatedMetrics.overallRiskTone?.tone || 'N/A'} (${calculatedMetrics.overallRiskTone?.confidence || 'N/A'} confidence)
`;
  }

  const prompt = `You are a macro analyst for futures trading. Analyze these conditions:

RAW DATA:
VIX: ${macroData.vix || 'N/A'} (${macroData.vixChange > 0 ? '+' : ''}${macroData.vixChange || 0}%)
DXY: ${macroData.dxy || 'N/A'} (${macroData.dxyChange > 0 ? '+' : ''}${macroData.dxyChange || 0}%)
10Y Yield: ${macroData.yield10y || 'N/A'}
HYG: ${macroData.hyg?.price || 'N/A'} (${macroData.hyg?.changePercent || 0}%)
TLT: ${macroData.tlt?.price || 'N/A'} (${macroData.tlt?.changePercent || 0}%)
${metricsSection}
SECTORS:
${Object.entries(macroData.sectors || {}).map(([k, v]) => `${k}: ${v.changePercent || 0}%`).join('\n')}

IMPORTANT: Use the CALCULATED METRICS above as your primary signals. These are pre-computed interpretations based on quantitative thresholds. Your analysis should align with and explain these signals.

Respond in JSON format ONLY (no markdown, no explanation):
{
  "riskEnvironment": "risk-on/risk-off/neutral",
  "riskConfidence": "high/medium/low",
  "vixInterpretation": "",
  "dollarImpact": {"direction": "up/down/neutral", "affectedSymbols": []},
  "sectorRotation": {"leading": [], "lagging": [], "signal": ""},
  "yieldSignals": {"realYield": "", "carryTrade": ""},
  "correlationAlerts": [],
  "overallBias": "bullish/bearish/neutral"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };

    // Attach the calculated metrics to the result
    result.calculatedMetrics = calculatedMetrics;

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Macro agent error:', error.message);
    return { error: true, message: error.message, calculatedMetrics };
  }
}

/**
 * MASTER ORCHESTRATOR - Synthesizes all agent outputs
 * Enhanced with event risk awareness from report schedule
 */
async function masterOrchestrator(newsResult, levelsResult, macroResult, sessionInfo) {
  // Get today's scheduled reports and event risk
  const eventRisk = getEventRiskSummary();
  const reportSchedule = formatReportsForPrompt();

  const prompt = `You are the chief trading strategist. Synthesize these analyses for the ${sessionInfo.current?.name || 'current'} session:

NEWS ANALYSIS:
${JSON.stringify(newsResult, null, 2)}

LEVELS ANALYSIS:
${JSON.stringify(levelsResult, null, 2)}

MACRO ANALYSIS:
${JSON.stringify(macroResult, null, 2)}

SESSION CONTEXT:
- Current: ${sessionInfo.current?.name || 'Unknown'}
- IB Status: ${sessionInfo.current?.isIB ? `Active (${sessionInfo.current?.ibMinutesRemaining}m remaining)` : 'Complete'}
- Next Session: ${sessionInfo.next?.name || 'Unknown'} in ${sessionInfo.next?.countdown || 'N/A'}
- Focus Symbols: ${sessionInfo.current?.focus?.join(', ') || 'N/A'}

${reportSchedule}

IMPORTANT: Factor in the EVENT RISK level and any scheduled reports when making your analysis. If major reports are scheduled (EIA, CPI, NFP, WASDE), warn about volatility windows and adjust confidence accordingly.

Provide a unified trading brief. Respond in JSON format ONLY (no markdown, no explanation):
{
  "sessionBrief": "2-3 sentence summary of what to expect this session",
  "focusSymbols": [{"symbol": "", "bias": "bullish/bearish/neutral", "confidence": 0, "reason": ""}],
  "keyLevels": [{"symbol": "", "level": "", "price": 0, "action": "watch/fade/breakout"}],
  "risks": [],
  "eventRisk": "${eventRisk.riskLevel}",
  "volatilityWindows": [],
  "tradingPlan": "What to do in this session"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };
  } catch (error) {
    console.error('Orchestrator error:', error.message);
    return { error: true, message: error.message };
  }
}

/**
 * Run full analysis pipeline
 */
async function runFullAnalysis(data) {
  const { news, levels, sweeps, macro, session, priceData } = data;

  console.log('Running AI analysis pipeline...');

  // Run sub-agents in parallel
  // Pass priceData to macroAgent for calculated metrics
  const [newsResult, levelsResult, macroResult] = await Promise.all([
    newsAgent(news || [], session.current?.name || 'Unknown'),
    levelsAgent(levels || {}, sweeps || [], session.current?.name || 'Unknown'),
    macroAgent(macro || {}, priceData || null)
  ]);

  console.log('Sub-agents complete, running orchestrator...');

  // Orchestrator synthesizes
  const finalAnalysis = await masterOrchestrator(
    newsResult,
    levelsResult,
    macroResult,
    session
  );

  return {
    timestamp: new Date().toISOString(),
    session: session.current?.name || 'Unknown',
    subAgents: {
      news: newsResult,
      levels: levelsResult,
      macro: macroResult
    },
    analysis: finalAnalysis
  };
}

/**
 * Quick session brief (lighter weight, faster)
 */
async function getQuickSessionBrief(sessionInfo, newsData) {
  const cacheKey = `brief_${sessionInfo.current?.key}_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  const topNews = (newsData || []).slice(0, 5).map(n => n.headline || n.title).join('; ');

  const prompt = `You are a futures trading analyst. Give a quick brief for the ${sessionInfo.current?.name || 'current'} session.

Session: ${sessionInfo.current?.name || 'Unknown'} (${sessionInfo.current?.description || ''})
IB Status: ${sessionInfo.current?.isIB ? `Active - ${sessionInfo.current?.ibMinutesRemaining}m remaining` : 'Complete'}
Focus: ${sessionInfo.current?.focus?.join(', ') || 'ES, NQ'}
Top News: ${topNews || 'No recent news'}

Respond in JSON format ONLY:
{
  "brief": "1-2 sentence trading brief",
  "focus": ["symbol1", "symbol2"],
  "caution": "any warnings or cautions",
  "opportunity": "main opportunity this session"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { brief: 'Analysis unavailable' };

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Quick brief error:', error.message);
    return { brief: 'Analysis unavailable', error: error.message };
  }
}

/**
 * Clear agent cache
 */
function clearCache() {
  agentCache.clear();
  console.log('AI agent cache cleared');
}

/**
 * Get cache status
 */
function getCacheStatus() {
  return {
    size: agentCache.size,
    ttl: CACHE_TTL,
    keys: Array.from(agentCache.keys())
  };
}

export {
  newsAgent,
  levelsAgent,
  macroAgent,
  masterOrchestrator,
  runFullAnalysis,
  getQuickSessionBrief,
  clearCache,
  getCacheStatus,
  // Keyword tagging utilities
  tagHeadlineWithSymbols,
  preprocessNewsWithTags,
  NEWS_KEYWORD_MAP,
  KEYWORD_GROUP_TO_SYMBOLS,
  // Re-export calculated metrics
  calculateAllMetrics,
  // Re-export report schedule
  formatReportsForPrompt,
  getEventRiskSummary
};
