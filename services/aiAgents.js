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
import { fetchAllEnergyData, getEIASummaryForAgent } from './eiaApi.js';
import { fetchAllAgricultureData, getUSDASSummaryForAgent } from './usdaApi.js';
import { getAllCOTData, getCOTSummaryForAgent } from './cftcCot.js';
import { getPutCallRatio, getPutCallSummaryForAgent } from './cboePutCall.js';
import {
  fetchEnergyReports,
  fetchAgricultureReports,
  fetchCentralBankCalendar,
  buildReportsCalendar
} from './fundamentalReports.js';
import { fetchComprehensiveEconomicData, getEconomicSummaryForAgent, analyzeEconomicSignals } from './fred.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Cache for agent results (5 minute TTL)
const agentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ============================================================================
// SESSION BRIEF CACHE (Fix 2)
// ============================================================================
// Separate from agentCache because the previous bucket-rotation key
// (`brief_${sessionKey}_${Math.floor(Date.now() / CACHE_TTL)}`) made
// background pre-warm awkward — the cache key flipped every 5 min, so a
// pre-warm at minute 4:30 of bucket N still left bucket N+1 empty.
//
// This cache uses a stable key per session + an explicit timestamp so a
// background pre-warm can simply overwrite the entry and the first user
// after expiry never triggers a cold LLM call.
const briefCache = new Map();   // sessionKey -> { value, timestamp }
const BRIEF_TTL = 5 * 60 * 1000; // 5 minutes

function getBriefFromCache(sessionKey) {
  const entry = briefCache.get(sessionKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > BRIEF_TTL) return null;
  return entry.value;
}

function setBriefCache(sessionKey, value) {
  briefCache.set(sessionKey, { value, timestamp: Date.now() });
}

// v1.1 Step 3K: invalidate one session's cached brief so the next read
// regenerates from a fresh LLM call. Used by POST /api/analysis/brief/refresh.
function invalidateBriefCache(sessionKey) {
  briefCache.delete(sessionKey);
}

// ============================================================================
// FUNDAMENTAL REPORTS HELPER - Formats report calendar for AI prompts
// ============================================================================

/**
 * Get today's and upcoming reports formatted for AI prompt
 * Includes bullish/bearish scenarios for context
 */
function getReportsForAIPrompt() {
  try {
    const energyReports = fetchEnergyReports();
    const agReports = fetchAgricultureReports();
    const centralBankReports = fetchCentralBankCalendar();

    const allReports = [...energyReports, ...agReports, ...centralBankReports];

    // Filter to today and tomorrow only
    const todayReports = allReports.filter(r => r.isToday);
    const tomorrowReports = allReports.filter(r => r.isTomorrow);

    const lines = [];

    if (todayReports.length > 0) {
      lines.push('TODAY\'S REPORTS (High Alert):');
      todayReports.forEach(r => {
        lines.push(`  - ${r.shortName} at ${r.time} [${r.importance}]`);
        lines.push(`    Affects: ${r.affectedInstruments.join(', ')}`);
        if (r.scenarios) {
          lines.push(`    Bullish if: ${r.scenarios.bullish}`);
          lines.push(`    Bearish if: ${r.scenarios.bearish}`);
        }
      });
    }

    if (tomorrowReports.length > 0) {
      lines.push('TOMORROW\'S REPORTS (Prepare):');
      tomorrowReports.forEach(r => {
        lines.push(`  - ${r.shortName} at ${r.time} [${r.importance}] → ${r.affectedInstruments.join(', ')}`);
      });
    }

    // High importance reports this week
    const highImportance = allReports.filter(r => r.importance === 'HIGH' && !r.isToday && !r.isTomorrow).slice(0, 5);
    if (highImportance.length > 0) {
      lines.push('HIGH IMPACT THIS WEEK:');
      highImportance.forEach(r => {
        lines.push(`  - ${r.shortName} on ${r.dateLabel} → ${r.affectedInstruments.join(', ')}`);
      });
    }

    return {
      summary: lines.join('\n'),
      todayCount: todayReports.length,
      tomorrowCount: tomorrowReports.length,
      todayReports,
      tomorrowReports,
      eventRisk: todayReports.some(r => r.importance === 'HIGH') ? 'HIGH' :
                 todayReports.length > 0 ? 'MEDIUM' : 'LOW'
    };
  } catch (err) {
    console.warn('Could not fetch fundamental reports:', err.message);
    return { summary: 'Report calendar unavailable', todayCount: 0, tomorrowCount: 0, eventRisk: 'UNKNOWN' };
  }
}

/**
 * Check if a specific instrument has a report today
 */
function getInstrumentReportsToday(symbol) {
  try {
    const energyReports = fetchEnergyReports();
    const agReports = fetchAgricultureReports();
    const allReports = [...energyReports, ...agReports];

    return allReports.filter(r => r.isToday && r.affectedInstruments.includes(symbol));
  } catch (err) {
    return [];
  }
}

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
 * Enhanced with calculated metrics, EIA/USDA data, COT positioning, and Put/Call ratios
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

  // Fetch fundamental data (EIA, USDA, COT, Put/Call, Economic Indicators)
  let fundamentalData = {};
  try {
    const [eiaData, usdaData, cotData, putCallData, economicData] = await Promise.all([
      fetchAllEnergyData(process.env.EIA_API_KEY).catch(() => null),
      fetchAllAgricultureData(process.env.USDA_API_KEY).catch(() => null),
      Promise.resolve(getAllCOTData()),
      Promise.resolve(getPutCallRatio()),
      fetchComprehensiveEconomicData(process.env.FRED_API_KEY).catch(() => null)
    ]);

    fundamentalData = { eiaData, usdaData, cotData, putCallData, economicData };
  } catch (err) {
    console.log('Could not fetch fundamental data:', err.message);
  }

  // Fetch report calendar with scenarios
  let reportsData = { summary: '', todayCount: 0, eventRisk: 'LOW' };
  try {
    reportsData = getReportsForAIPrompt();
    fundamentalData.reportsCalendar = reportsData;
  } catch (err) {
    console.log('Could not fetch reports calendar:', err.message);
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

  // Build fundamental data section
  let fundamentalSection = '';
  if (fundamentalData.eiaData) {
    fundamentalSection += `
EIA ENERGY DATA (Latest Reports):
${getEIASummaryForAgent(fundamentalData.eiaData)}
`;
  }
  if (fundamentalData.usdaData) {
    fundamentalSection += `
USDA AGRICULTURE DATA:
${getUSDASSummaryForAgent(fundamentalData.usdaData)}
`;
  }
  if (fundamentalData.cotData) {
    fundamentalSection += `
CFTC COT POSITIONING (As of ${fundamentalData.cotData._summary?.dataDate || 'Tuesday'}):
${getCOTSummaryForAgent(fundamentalData.cotData)}
`;
  }
  if (fundamentalData.putCallData) {
    fundamentalSection += `
CBOE PUT/CALL RATIO:
${getPutCallSummaryForAgent(fundamentalData.putCallData)}
`;
  }

  // Add FRED economic indicators (NFP, CPI, GDP, etc.)
  if (fundamentalData.economicData && fundamentalData.economicData.indicators) {
    fundamentalSection += `
ECONOMIC INDICATORS (FRED - Live Data):
${fundamentalData.economicData.summary || 'Economic data loading...'}
`;
    // Add economic signals if any
    if (fundamentalData.economicData.signals && fundamentalData.economicData.signals.length > 0) {
      fundamentalSection += `
ECONOMIC SIGNALS:
${fundamentalData.economicData.signals.map(s => `- ${s.indicator}: ${s.signal} [${s.severity}] - ${s.message}`).join('\n')}
`;
    }
  }

  // Add reports calendar with scenarios
  if (reportsData.summary) {
    fundamentalSection += `
SCHEDULED REPORTS & EVENTS:
Event Risk Level: ${reportsData.eventRisk}
${reportsData.summary}
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
${fundamentalSection}
SECTORS:
${Object.entries(macroData.sectors || {}).map(([k, v]) => `${k}: ${v.changePercent || 0}%`).join('\n')}

IMPORTANT: Use the CALCULATED METRICS and FUNDAMENTAL DATA above as your primary signals. These are pre-computed interpretations based on quantitative thresholds. Pay special attention to:
- EIA data for CL/NG direction (draws = bullish, builds = bearish)
- COT positioning extremes (crowded long = contrarian bearish, crowded short = contrarian bullish)
- Put/Call ratio for sentiment (high = contrarian bullish, low = contrarian bearish)
- SCHEDULED REPORTS: If a report is TODAY, warn about volatility for affected instruments and provide the bullish/bearish scenarios

Respond in JSON format ONLY (no markdown, no explanation):
{
  "riskEnvironment": "risk-on/risk-off/neutral",
  "riskConfidence": "high/medium/low",
  "vixInterpretation": "",
  "dollarImpact": {"direction": "up/down/neutral", "affectedSymbols": []},
  "sectorRotation": {"leading": [], "lagging": [], "signal": ""},
  "yieldSignals": {"realYield": "", "carryTrade": ""},
  "energySignals": {"crude": "", "natgas": ""},
  "positioningSignals": {"cotExtreme": "", "putCallSignal": ""},
  "eventRisk": {"level": "HIGH/MEDIUM/LOW", "reports": [], "warning": ""},
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

    // Attach the calculated metrics and fundamental data to the result
    result.calculatedMetrics = calculatedMetrics;
    result.fundamentalData = fundamentalData;

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Macro agent error:', error.message);
    return { error: true, message: error.message, calculatedMetrics, fundamentalData };
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

  // Get detailed reports with bullish/bearish scenarios
  const detailedReports = getReportsForAIPrompt();

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

DETAILED REPORT CALENDAR WITH SCENARIOS:
${detailedReports.summary || 'No reports scheduled'}
Event Risk Level: ${detailedReports.eventRisk || 'LOW'}

IMPORTANT: Factor in the EVENT RISK level and any scheduled reports when making your analysis. If major reports are scheduled (EIA, CPI, NFP, WASDE):
1. Warn about volatility windows for affected instruments
2. Use the bullish/bearish scenarios provided to guide expectations
3. Adjust confidence based on event risk (HIGH = lower confidence, wait for report)
4. Include specific times when traders should be cautious

Provide a unified trading brief. Respond in JSON format ONLY (no markdown, no explanation):
{
  "sessionBrief": "2-3 sentence summary of what to expect this session",
  "focusSymbols": [{"symbol": "", "bias": "bullish/bearish/neutral", "confidence": 0, "reason": ""}],
  "keyLevels": [{"symbol": "", "level": "", "price": 0, "action": "watch/fade/breakout"}],
  "risks": [],
  "eventRisk": "${eventRisk.riskLevel}",
  "reportAlerts": [{"report": "", "time": "", "affects": [], "bullishIf": "", "bearishIf": ""}],
  "volatilityWindows": [{"time": "", "reason": "", "affectedSymbols": []}],
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
 * Build a rule-based session brief when the LLM is unavailable.
 *
 * Per AI_CONTENT_AUDIT.md issue #1 + Fix 2: the previous fallback was the
 * string "Analysis unavailable" which the frontend rendered as an eternal
 * "loading..." state. This fallback returns the same JSON shape as the LLM
 * version with deterministic, useful content — so the frontend can render a
 * real brief with an "Auto-generated summary — AI synthesis unavailable"
 * disclaimer instead of a broken loading state.
 */
function buildSessionBriefFallback(sessionInfo, newsData, reason) {
  const cur = sessionInfo?.current || {};
  const sessName = cur.name || 'Current';
  const desc = cur.description || '';
  const isIB = !!cur.isIB;
  const ibMin = cur.ibMinutesRemaining;
  const focus = Array.isArray(cur.focus) && cur.focus.length > 0 ? cur.focus : ['ES', 'NQ'];

  // Pull HIGH-impact news headlines that survived the Fix 4b suppression filter.
  const highImpactNews = (newsData || []).filter(n =>
    n && n.impact === 'HIGH'
    && !n.analysisUnavailable
    && Array.isArray(n.symbols) && n.symbols.length > 0
  );
  const topHigh = highImpactNews[0]?.headline || highImpactNews[0]?.title;

  // Brief sentence
  let brief = `${sessName} session in progress.`;
  if (desc) brief += ` ${desc}.`;
  if (isIB && typeof ibMin === 'number') brief += ` Initial Balance active for ${ibMin} more minutes.`;
  else if (isIB) brief += ' Initial Balance active.';
  brief += ` Focus instruments: ${focus.join(', ')}.`;

  // Caution
  let caution;
  if (topHigh) {
    caution = `Watch: ${topHigh}`;
  } else {
    const lower = sessName.toLowerCase();
    if (lower.includes('asia')) caution = 'Thin liquidity typical in Asia hours — expect wider spreads.';
    else if (lower.includes('london')) caution = 'London open often sets directional tone; watch DXY and treasury reaction.';
    else if (lower.includes('us') || lower.includes('new york')) caution = 'US open typically expands range — wait for IB to complete before sizing up.';
    else caution = 'Standard session caution — confirm direction against macro data.';
  }

  // Opportunity
  const opportunity = focus.length > 1
    ? `${focus[0]} / ${focus[1]} likely to lead any directional move this session.`
    : `${focus[0]} likely to lead any directional move this session.`;

  return {
    brief,
    focus,
    caution,
    opportunity,
    generated: false,
    fallbackReason: reason,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Quick session brief (lighter weight, faster).
 *
 * Two-tier per Fix 2 / Gap 1 decision:
 *   1. Live Claude call (tagged generated: true)
 *   2. Rule-based fallback labeled "Auto-generated summary — AI synthesis
 *      unavailable" (tagged generated: false, fallbackReason set)
 *
 * The "yesterday's brief" persistence tier was explicitly skipped — stale
 * brief framed as current is the same credibility problem this is fixing.
 *
 * Cache: stable key per session + explicit timestamp so a background
 * pre-warm (see prewarmSessionBrief) can simply overwrite the entry. The
 * fallback IS cached too, so a flapping LLM doesn't trigger per-request
 * retry storms — the next pre-warm cycle will retry and either succeed
 * or refresh the fallback.
 */
async function getQuickSessionBrief(sessionInfo, newsData) {
  const sessionKey = sessionInfo?.current?.key || 'unknown';
  const cached = getBriefFromCache(sessionKey);
  if (cached) return cached;

  const topNews = (newsData || []).slice(0, 5).map(n => n.headline || n.title).join('; ');

  const prompt = `You are explaining the ${sessionInfo.current?.name || 'current'} futures session to a retail trader who wants clear, plain-English context — not desk commentary.

Session: ${sessionInfo.current?.name || 'Unknown'} (${sessionInfo.current?.description || ''})
IB Status: ${sessionInfo.current?.isIB ? `Active - ${sessionInfo.current?.ibMinutesRemaining}m remaining` : 'Complete'}
Focus: ${sessionInfo.current?.focus?.join(', ') || 'ES, NQ'}
Top News: ${topNews || 'No recent news'}

WRITING GUIDELINES — follow these strictly:
- Plain everyday English. Short sentences. Concrete, not abstract.
- Avoid finance-desk jargon. If you must use a technical term (VWAP, IB, gap fill, etc.) briefly explain it inline in 3-5 words.
- Name specific drivers when possible (e.g., "Apple earnings" not "Mag7 prints"; "Fed minutes" not "monetary policy event risk").
- No words like: risk-on, risk-off, positioning, bid, offer, prints, leg, squeeze setup, conviction, tape, flow.

GOOD example: "Stocks pushed higher overnight after Apple posted strong earnings. Watch for follow-through into the US open."
BAD example: "Risk-on positioning emerged on robust Mag7 prints; bid tape into the US handoff."

Respond in JSON format ONLY:
{
  "brief": "1-2 sentence plain-English summary of what's happening this session",
  "focus": ["symbol1", "symbol2"],
  "caution": "things to watch out for, plain language",
  "opportunity": "main thing worth watching this session, plain language"
}`;

  try {
    // Fix 2 v2: 15-second Promise.race timeout. Yesterday's outage was
    // caused by an Anthropic call that hung indefinitely instead of failing
    // fast, leaving the boot pre-warm pending forever and cascading into a
    // Render health-check failure. This race ensures we ALWAYS resolve in
    // <=15s, either with a real response or with a controlled timeout that
    // routes to buildSessionBriefFallback.
    const LLM_TIMEOUT_MS = 15_000;
    const response = await Promise.race([
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`llm_timeout_${LLM_TIMEOUT_MS}ms`)), LLM_TIMEOUT_MS)
      ),
    ]);

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const fallback = buildSessionBriefFallback(sessionInfo, newsData, 'json_extract_failed');
      setBriefCache(sessionKey, fallback);
      return fallback;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      const fallback = buildSessionBriefFallback(sessionInfo, newsData, `json_parse_error: ${e.message}`);
      setBriefCache(sessionKey, fallback);
      return fallback;
    }

    const result = {
      ...parsed,
      generated: true,
      fallbackReason: null,
      generatedAt: new Date().toISOString(),
    };
    setBriefCache(sessionKey, result);
    return result;
  } catch (error) {
    console.error('Quick brief error:', error.message);
    const fallback = buildSessionBriefFallback(sessionInfo, newsData, `llm_call_error: ${error.message}`);
    setBriefCache(sessionKey, fallback);
    return fallback;
  }
}

/**
 * Background pre-warm helper for Session Brief. Called by server.js on a
 * setInterval just under the cache TTL so the first user after expiry never
 * triggers a cold LLM call (same pattern as the dashboard pre-warm built
 * during the OOM crash fix).
 *
 * Takes async-resolved session + news fetchers as dependencies so we don't
 * create a circular import between aiAgents.js and sessionEngine.js /
 * newsAnalysis.js.
 */
async function prewarmSessionBrief({ getSession, getNews, label = 'interval' } = {}) {
  if (typeof getSession !== 'function') {
    throw new Error('prewarmSessionBrief: getSession must be a function');
  }
  try {
    const sessionInfo = await getSession();
    let newsData = [];
    if (typeof getNews === 'function') {
      try {
        newsData = await getNews();
      } catch (e) {
        console.warn(`[brief-prewarm:${label}] news fetch failed:`, e.message);
      }
    }
    const result = await getQuickSessionBrief(sessionInfo, newsData);
    console.log(`[brief-prewarm:${label}] ok (generated=${result.generated})`);
    return result;
  } catch (err) {
    console.error(`[brief-prewarm:${label}] failed:`, err.message);
    return null;
  }
}

/**
 * Get the session-brief cache status (for diagnostic endpoints).
 */
function getSessionBriefStatus() {
  const entries = Array.from(briefCache.entries()).map(([key, { value, timestamp }]) => ({
    sessionKey: key,
    ageMs: Date.now() - timestamp,
    generated: value.generated,
    fallbackReason: value.fallbackReason || null,
  }));
  return {
    cacheSize: briefCache.size,
    ttlMs: BRIEF_TTL,
    entries,
  };
}

/**
 * Clear agent cache
 */
function clearCache() {
  agentCache.clear();
  briefCache.clear();
  console.log('AI agent cache cleared (including session-brief cache)');
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
  prewarmSessionBrief,        // Fix 2: background pre-warm
  getSessionBriefStatus,      // Fix 2: diagnostic
  invalidateBriefCache,       // v1.1 Step 3K: per-session refresh
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
