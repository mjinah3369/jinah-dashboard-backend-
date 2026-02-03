/**
 * News Analysis Service
 * Analyzes news headlines using Claude AI for trading insights
 * Now supports unified news from all sources (Google Sheets, NewsAPI, Finnhub)
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchGoogleSheetsNews, clearGoogleSheetsCache } from './googleSheets.js';
import { fetchUnifiedNews, clearUnifiedNewsCache } from './unifiedNews.js';

// Initialize Anthropic client
let anthropic = null;

function getAnthropicClient() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropic;
}

// Cache for analyzed news
let analysisCache = new Map();
let lastFullAnalysis = null;
let fullAnalysisTime = null;
const ANALYSIS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for full analysis

// Symbol mapping for futures
const SYMBOL_KEYWORDS = {
  ES: ['s&p', 'sp500', 'spx', 'equity', 'stock market', 'wall street', 'dow jones', 'nasdaq', 'stocks'],
  NQ: ['nasdaq', 'tech', 'technology', 'software', 'ai ', 'artificial intelligence', 'semiconductor', 'chips', 'apple', 'microsoft', 'google', 'amazon', 'meta', 'nvidia', 'tesla'],
  CL: ['oil', 'crude', 'wti', 'brent', 'opec', 'petroleum', 'energy', 'gasoline', 'drilling', 'refinery'],
  GC: ['gold', 'precious metal', 'bullion', 'safe haven', 'inflation hedge'],
  SI: ['silver', 'precious metal'],
  ZN: ['treasury', 'bond', 'yield', 'interest rate', 'fed ', 'federal reserve', 'fomc', 'powell', 'rate cut', 'rate hike', 'monetary policy'],
  ZB: ['30-year', 'long bond', 'treasury bond'],
  DX: ['dollar', 'usd', 'greenback', 'currency', 'forex', 'dxy'],
  '6E': ['euro', 'eur', 'ecb', 'european central bank', 'eurozone'],
  '6J': ['yen', 'jpy', 'bank of japan', 'boj', 'japan'],
  '6B': ['pound', 'gbp', 'sterling', 'bank of england', 'boe', 'uk economy'],
  ZC: ['corn', 'grain', 'crop', 'agriculture', 'usda'],
  ZS: ['soybean', 'soy', 'oilseed'],
  ZW: ['wheat', 'grain'],
  HG: ['copper', 'industrial metal', 'china manufacturing'],
  NG: ['natural gas', 'natgas', 'lng', 'heating', 'weather'],
  BTC: ['bitcoin', 'btc', 'crypto', 'cryptocurrency', 'digital currency'],
  ETH: ['ethereum', 'eth', 'crypto'],
  RTY: ['russell', 'small cap', 'small-cap', 'regional bank'],
  YM: ['dow', 'djia', 'industrial', 'blue chip']
};

/**
 * Detect affected symbols from headline text (quick heuristic)
 */
function detectSymbolsFromText(text) {
  const lowerText = text.toLowerCase();
  const detectedSymbols = [];

  for (const [symbol, keywords] of Object.entries(SYMBOL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        if (!detectedSymbols.includes(symbol)) {
          detectedSymbols.push(symbol);
        }
        break;
      }
    }
  }

  return detectedSymbols;
}

/**
 * Build the analysis prompt for Claude
 */
function buildAnalysisPrompt(headlines) {
  const headlinesList = headlines.map((h, i) =>
    `${i + 1}. [${h.source}] ${h.headline}`
  ).join('\n');

  return `You are a professional futures trader analyzing news headlines for intraday trading opportunities.

Analyze these financial news headlines and provide trading insights:

${headlinesList}

For EACH headline, return a JSON object with:
- index: (1-based index matching the headline number)
- summary: (1-2 sentence summary explaining the market relevance)
- symbols: (array of affected futures symbols: ES, NQ, CL, GC, ZN, DX, RTY, YM, 6E, 6J, 6B, NG, BTC, etc.)
- impact: ("high", "medium", or "low" - how market-moving is this)
- bias: ("bullish", "bearish", or "neutral" - directional implication)
- timeframe: ("intraday" for same-day impact, "multi-day" for longer-term)
- relevance: (1-10 score, 10 being most relevant to futures trading)
- category: ("Fed", "Geopolitical", "Economic", "Earnings", "Tech", "Energy", "Crypto", or "General")

HIGH impact criteria:
- Fed/FOMC decisions, rate changes, Powell speeches
- Major economic data (CPI, NFP, GDP)
- Geopolitical crises (wars, sanctions, elections)
- Breaking market moves (circuit breakers, flash crashes)
- Major earnings surprises from market leaders

MEDIUM impact criteria:
- Regional Fed speeches
- Secondary economic data
- Sector-specific news affecting multiple stocks
- Corporate M&A activity
- Commodity supply disruptions

LOW impact criteria:
- Routine corporate updates
- Analyst upgrades/downgrades
- Industry commentary without immediate catalyst
- Old news or already priced-in events

Return ONLY a valid JSON array with the analysis objects. No markdown, no explanation, just the JSON array.`;
}

/**
 * Analyze a batch of headlines using Claude
 * Exported for use by other services (e.g., finalAnalysis.js)
 */
export async function analyzeHeadlinesBatch(headlines) {
  const client = getAnthropicClient();

  if (!client) {
    console.warn('Anthropic client not available - returning unanalyzed headlines');
    return headlines.map(h => ({
      ...h,
      summary: h.headline,
      symbols: detectSymbolsFromText(h.headline),
      affectedInstruments: detectSymbolsFromText(h.headline),
      impact: 'LOW',
      bias: 'neutral',
      timeframe: 'intraday',
      relevance: 5,
      category: 'General',
      isAnalyzed: false
    }));
  }

  try {
    const prompt = buildAnalysisPrompt(headlines);

    console.log('Calling Claude API for', headlines.length, 'headlines...');
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    console.log('Claude API response received');

    const content = response.content[0]?.text || '[]';

    // Parse JSON response
    let analysisResults;
    try {
      // Clean potential markdown code blocks
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResults = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      console.log('Raw response:', content.substring(0, 500));
      return headlines.map(h => ({
        ...h,
        summary: h.headline,
        symbols: detectSymbolsFromText(h.headline),
        affectedInstruments: detectSymbolsFromText(h.headline),
        impact: 'LOW',
        bias: 'neutral',
        timeframe: 'intraday',
        relevance: 5,
        category: 'General',
        isAnalyzed: false
      }));
    }

    // Merge analysis with original headlines
    return headlines.map((headline, idx) => {
      const analysis = analysisResults.find(a => a.index === idx + 1) || {};

      return {
        ...headline,
        summary: analysis.summary || headline.headline,
        symbols: analysis.symbols || detectSymbolsFromText(headline.headline),
        affectedInstruments: analysis.symbols || detectSymbolsFromText(headline.headline),
        impact: (analysis.impact || 'low').toUpperCase(),
        bias: analysis.bias || 'neutral',
        timeframe: analysis.timeframe || 'intraday',
        relevance: analysis.relevance || 5,
        category: analysis.category || 'General',
        isAnalyzed: true
      };
    });
  } catch (error) {
    console.error('Claude analysis error:', error.message);
    console.error('Full error:', error);

    // Return with heuristic analysis on error
    return headlines.map(h => ({
      ...h,
      summary: h.headline,
      symbols: detectSymbolsFromText(h.headline),
      affectedInstruments: detectSymbolsFromText(h.headline),
      impact: 'LOW',
      bias: 'neutral',
      timeframe: 'intraday',
      relevance: 5,
      category: 'General',
      isAnalyzed: false
    }));
  }
}

/**
 * Check if a headline has been analyzed (by content hash)
 */
function getHeadlineHash(headline) {
  return `${headline.headline}-${headline.source}`.toLowerCase().replace(/\s+/g, '');
}

/**
 * Fetch and analyze all news
 */
export async function fetchAnalyzedNews(options = {}) {
  const { forceRefresh = false, symbol = null } = options;
  const now = Date.now();

  // Check if we can use cached full analysis
  if (!forceRefresh && lastFullAnalysis && fullAnalysisTime &&
      (now - fullAnalysisTime) < ANALYSIS_CACHE_DURATION) {
    console.log('Returning cached analyzed news');
    let results = lastFullAnalysis;

    // Filter by symbol if requested
    if (symbol) {
      results = results.filter(item =>
        item.symbols?.includes(symbol) || item.affectedInstruments?.includes(symbol)
      );
    }

    return results;
  }

  // Fetch raw news from Google Sheets
  const rawNews = await fetchGoogleSheetsNews();

  if (rawNews.length === 0) {
    return [];
  }

  // Separate already-analyzed (cached) from new headlines
  const toAnalyze = [];
  const alreadyAnalyzed = [];

  for (const item of rawNews) {
    const hash = getHeadlineHash(item);
    if (analysisCache.has(hash)) {
      alreadyAnalyzed.push(analysisCache.get(hash));
    } else {
      toAnalyze.push(item);
    }
  }

  console.log(`News analysis: ${alreadyAnalyzed.length} cached, ${toAnalyze.length} to analyze`);

  // Analyze new headlines in batches
  let newlyAnalyzed = [];
  if (toAnalyze.length > 0) {
    // Process in batches of 10 to avoid token limits
    const batchSize = 10;
    for (let i = 0; i < toAnalyze.length; i += batchSize) {
      const batch = toAnalyze.slice(i, i + batchSize);
      const analyzed = await analyzeHeadlinesBatch(batch);

      // Cache individual results
      for (const item of analyzed) {
        const hash = getHeadlineHash(item);
        analysisCache.set(hash, item);
      }

      newlyAnalyzed = newlyAnalyzed.concat(analyzed);
    }
  }

  // Combine and sort by timestamp
  const allAnalyzed = [...alreadyAnalyzed, ...newlyAnalyzed]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Cache full results
  lastFullAnalysis = allAnalyzed;
  fullAnalysisTime = now;

  // Filter by symbol if requested
  if (symbol) {
    return allAnalyzed.filter(item =>
      item.symbols?.includes(symbol) || item.affectedInstruments?.includes(symbol)
    );
  }

  return allAnalyzed;
}

/**
 * Get only high impact news
 */
export async function fetchHighImpactNews(limit = 5) {
  const allNews = await fetchAnalyzedNews();

  return allNews
    .filter(item => item.impact === 'HIGH' && item.relevance >= 5)
    .slice(0, limit);
}

/**
 * Force refresh - clear caches and re-analyze
 */
export async function refreshNewsAnalysis() {
  clearGoogleSheetsCache();
  analysisCache.clear();
  lastFullAnalysis = null;
  fullAnalysisTime = null;

  console.log('News analysis cache cleared, fetching fresh data...');

  return await fetchAnalyzedNews({ forceRefresh: true });
}

/**
 * Get analysis cache status
 */
export function getAnalysisCacheStatus() {
  return {
    cachedHeadlines: analysisCache.size,
    hasFullAnalysis: !!lastFullAnalysis,
    fullAnalysisItemCount: lastFullAnalysis?.length || 0,
    cacheAge: fullAnalysisTime ? Date.now() - fullAnalysisTime : null,
    maxAge: ANALYSIS_CACHE_DURATION,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY
  };
}

// ============================================================================
// UNIFIED NEWS ANALYSIS (All Sources with Claude AI)
// ============================================================================

// Cache for unified analyzed news
let unifiedAnalysisCache = null;
let unifiedAnalysisTime = null;
const UNIFIED_ANALYSIS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch and analyze news from ALL sources (Google Sheets, NewsAPI, Finnhub)
 * This is the main function for comprehensive news analysis
 */
export async function analyzeAllSourcesNews(options = {}) {
  const { forceRefresh = false, symbol = null, source = null, lastHours = null } = options;
  const now = Date.now();

  // Check if we can use cached unified analysis
  if (!forceRefresh && unifiedAnalysisCache && unifiedAnalysisTime &&
      (now - unifiedAnalysisTime) < UNIFIED_ANALYSIS_CACHE_DURATION) {
    console.log('Returning cached unified analyzed news');
    let results = unifiedAnalysisCache;

    // Apply filters
    if (symbol) {
      results = results.filter(item =>
        item.symbols?.includes(symbol) || item.affectedInstruments?.includes(symbol)
      );
    }
    if (source) {
      const normalizedSource = source.toLowerCase().replace(/\s+/g, '');
      results = results.filter(item =>
        item.source.toLowerCase().replace(/\s+/g, '').includes(normalizedSource)
      );
    }
    if (lastHours) {
      const cutoff = new Date(now - lastHours * 60 * 60 * 1000);
      results = results.filter(item => new Date(item.timestamp) >= cutoff);
    }

    return results;
  }

  // Fetch unified news from all sources
  const rawNews = await fetchUnifiedNews({ forceRefresh });

  if (rawNews.length === 0) {
    return [];
  }

  // Separate already-analyzed (cached) from new headlines
  const toAnalyze = [];
  const alreadyAnalyzed = [];

  for (const item of rawNews) {
    const hash = getHeadlineHash(item);
    if (analysisCache.has(hash)) {
      alreadyAnalyzed.push(analysisCache.get(hash));
    } else {
      toAnalyze.push(item);
    }
  }

  console.log(`Unified news analysis: ${alreadyAnalyzed.length} cached, ${toAnalyze.length} to analyze`);

  // Analyze new headlines in batches
  let newlyAnalyzed = [];
  if (toAnalyze.length > 0) {
    // Process in batches of 10 to avoid token limits
    const batchSize = 10;
    for (let i = 0; i < toAnalyze.length; i += batchSize) {
      const batch = toAnalyze.slice(i, i + batchSize);
      const analyzed = await analyzeHeadlinesBatch(batch);

      // Cache individual results
      for (const item of analyzed) {
        const hash = getHeadlineHash(item);
        analysisCache.set(hash, item);
      }

      newlyAnalyzed = newlyAnalyzed.concat(analyzed);
    }
  }

  // Combine and sort by timestamp
  const allAnalyzed = [...alreadyAnalyzed, ...newlyAnalyzed]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Cache full results
  unifiedAnalysisCache = allAnalyzed;
  unifiedAnalysisTime = now;

  // Apply filters
  let results = allAnalyzed;

  if (symbol) {
    results = results.filter(item =>
      item.symbols?.includes(symbol) || item.affectedInstruments?.includes(symbol)
    );
  }
  if (source) {
    const normalizedSource = source.toLowerCase().replace(/\s+/g, '');
    results = results.filter(item =>
      item.source.toLowerCase().replace(/\s+/g, '').includes(normalizedSource)
    );
  }
  if (lastHours) {
    const cutoff = new Date(now - lastHours * 60 * 60 * 1000);
    results = results.filter(item => new Date(item.timestamp) >= cutoff);
  }

  return results;
}

/**
 * Get news sentiment summary for multiple instruments
 * Used by final analysis service
 */
export async function getNewsSentimentSummary(options = {}) {
  const { lastHours = 1 } = options;
  const news = await analyzeAllSourcesNews({ lastHours });

  const summary = {
    total: news.length,
    analyzed: news.filter(n => n.isAnalyzed).length,
    byImpact: {
      HIGH: news.filter(n => n.impact === 'HIGH').length,
      MEDIUM: news.filter(n => n.impact === 'MEDIUM').length,
      LOW: news.filter(n => n.impact === 'LOW').length
    },
    byBias: {
      bullish: news.filter(n => n.bias === 'bullish').length,
      bearish: news.filter(n => n.bias === 'bearish').length,
      neutral: news.filter(n => n.bias === 'neutral').length
    },
    byInstrument: {},
    byCategory: {},
    topNews: news.filter(n => n.impact === 'HIGH' && n.relevance >= 7).slice(0, 5)
  };

  // Count by instrument
  const instruments = ['ES', 'NQ', 'YM', 'RTY', 'GC', 'CL', 'ZN', 'DX'];
  for (const instrument of instruments) {
    const instrumentNews = news.filter(n =>
      n.symbols?.includes(instrument) || n.affectedInstruments?.includes(instrument)
    );
    const bullish = instrumentNews.filter(n => n.bias === 'bullish').length;
    const bearish = instrumentNews.filter(n => n.bias === 'bearish').length;

    summary.byInstrument[instrument] = {
      total: instrumentNews.length,
      bullish,
      bearish,
      neutral: instrumentNews.length - bullish - bearish,
      sentiment: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral',
      score: (bullish - bearish) / Math.max(1, instrumentNews.length)
    };
  }

  // Count by category
  const categories = ['Fed', 'Geopolitical', 'Economic', 'Earnings', 'Tech', 'Energy', 'Crypto', 'General'];
  for (const category of categories) {
    summary.byCategory[category] = news.filter(n => n.category === category).length;
  }

  return summary;
}

/**
 * Force refresh unified news analysis
 */
export async function refreshUnifiedNewsAnalysis() {
  clearGoogleSheetsCache();
  clearUnifiedNewsCache();
  analysisCache.clear();
  unifiedAnalysisCache = null;
  unifiedAnalysisTime = null;
  lastFullAnalysis = null;
  fullAnalysisTime = null;

  console.log('All news analysis caches cleared, fetching fresh data...');

  return await analyzeAllSourcesNews({ forceRefresh: true });
}

/**
 * Get unified analysis cache status
 */
export function getUnifiedAnalysisCacheStatus() {
  return {
    cachedHeadlines: analysisCache.size,
    hasUnifiedAnalysis: !!unifiedAnalysisCache,
    unifiedItemCount: unifiedAnalysisCache?.length || 0,
    unifiedCacheAge: unifiedAnalysisTime ? Date.now() - unifiedAnalysisTime : null,
    maxAge: UNIFIED_ANALYSIS_CACHE_DURATION,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    sources: {
      googleSheets: unifiedAnalysisCache?.filter(n => n.source === 'Google Sheets').length || 0,
      newsApi: unifiedAnalysisCache?.filter(n => n.source === 'NewsAPI').length || 0,
      finnhub: unifiedAnalysisCache?.filter(n => n.source === 'Finnhub').length || 0
    }
  };
}
