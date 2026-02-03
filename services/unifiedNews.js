/**
 * Unified News Service
 * Combines all news sources (Google Sheets, NewsAPI, Finnhub) into one analyzed feed
 */

import { fetchGoogleSheetsNews } from './googleSheets.js';
import { fetchNewsApiHeadlines } from './newsApi.js';
import { fetchFinnhubNews } from './finnhubNews.js';

// Cache for unified news
let unifiedNewsCache = null;
let unifiedNewsCacheTime = null;
const UNIFIED_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Normalize headline for deduplication
 */
function normalizeHeadline(headline) {
  return (headline || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * Calculate similarity between two headlines (Jaccard similarity)
 */
function calculateSimilarity(headline1, headline2) {
  const words1 = new Set(normalizeHeadline(headline1).split(' '));
  const words2 = new Set(normalizeHeadline(headline2).split(' '));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Check if a headline is a duplicate of any existing headline
 */
function isDuplicate(headline, existingHeadlines, threshold = 0.6) {
  for (const existing of existingHeadlines) {
    if (calculateSimilarity(headline, existing) > threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Transform news item to unified format
 */
function transformToUnified(item, source) {
  const headline = item.headline || item.title || '';
  const timestamp = item.timestamp || item.publishedAt || new Date().toISOString();

  return {
    id: item.id || `${source.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    headline: headline.trim(),
    summary: item.summary || item.description || '',
    source: source,
    originalSource: item.source || source,
    url: item.url || item.link || '#',
    timestamp: new Date(timestamp).toISOString(),
    relativeTime: item.relativeTime || getRelativeTime(new Date(timestamp)),
    // Pre-existing heuristic analysis (will be enhanced by Claude)
    category: item.category || 'General',
    impact: item.impact || 'LOW',
    affectedInstruments: item.affectedInstruments || item.symbols || [],
    // These will be filled by Claude AI analysis
    bias: item.bias || 'neutral',
    relevance: item.relevance || 5,
    timeframe: item.timeframe || 'intraday',
    isAnalyzed: false
  };
}

/**
 * Calculate relative time string
 */
function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

/**
 * Fetch and merge news from all sources
 * @param {Object} options - Options for fetching
 * @param {boolean} options.forceRefresh - Force refresh cache
 * @param {number} options.lastHours - Filter news from last N hours
 * @returns {Promise<Array>} Merged and deduplicated news array
 */
export async function fetchUnifiedNews(options = {}) {
  const { forceRefresh = false, lastHours = null } = options;
  const now = Date.now();

  // Check cache
  if (!forceRefresh && unifiedNewsCache && unifiedNewsCacheTime &&
      (now - unifiedNewsCacheTime) < UNIFIED_CACHE_DURATION) {
    console.log('Returning cached unified news');
    let results = unifiedNewsCache;

    // Filter by time if requested
    if (lastHours) {
      const cutoff = new Date(now - lastHours * 60 * 60 * 1000);
      results = results.filter(item => new Date(item.timestamp) >= cutoff);
    }

    return results;
  }

  console.log('Fetching unified news from all sources...');

  // Fetch from all sources in parallel
  const [googleSheetsResult, newsApiResult, finnhubResult] = await Promise.allSettled([
    fetchGoogleSheetsNews(),
    fetchNewsApiHeadlines(),
    fetchFinnhubNews()
  ]);

  // Extract results
  const googleSheetsNews = googleSheetsResult.status === 'fulfilled' ? googleSheetsResult.value : [];
  const newsApiNews = newsApiResult.status === 'fulfilled' ? newsApiResult.value : [];
  const finnhubNews = finnhubResult.status === 'fulfilled' ? finnhubResult.value : [];

  console.log(`News sources: Google Sheets=${googleSheetsNews.length}, NewsAPI=${newsApiNews.length}, Finnhub=${finnhubNews.length}`);

  // Transform to unified format
  const allNews = [];
  const seenHeadlines = [];

  // Add Google Sheets news first (priority source)
  for (const item of googleSheetsNews) {
    if (item.headline && !isDuplicate(item.headline, seenHeadlines)) {
      allNews.push(transformToUnified(item, 'Google Sheets'));
      seenHeadlines.push(item.headline);
    }
  }

  // Add NewsAPI news
  for (const item of newsApiNews) {
    const headline = item.headline || item.title;
    if (headline && !isDuplicate(headline, seenHeadlines)) {
      allNews.push(transformToUnified(item, 'NewsAPI'));
      seenHeadlines.push(headline);
    }
  }

  // Add Finnhub news
  for (const item of finnhubNews) {
    if (item.headline && !isDuplicate(item.headline, seenHeadlines)) {
      allNews.push(transformToUnified(item, 'Finnhub'));
      seenHeadlines.push(item.headline);
    }
  }

  // Sort by timestamp (newest first)
  allNews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Limit to 50 items
  const mergedNews = allNews.slice(0, 50);

  console.log(`Unified news: ${mergedNews.length} items after deduplication`);

  // Cache results
  unifiedNewsCache = mergedNews;
  unifiedNewsCacheTime = now;

  // Filter by time if requested
  if (lastHours) {
    const cutoff = new Date(now - lastHours * 60 * 60 * 1000);
    return mergedNews.filter(item => new Date(item.timestamp) >= cutoff);
  }

  return mergedNews;
}

/**
 * Get news filtered by source
 */
export async function fetchNewsBySource(source, options = {}) {
  const allNews = await fetchUnifiedNews(options);

  if (!source) return allNews;

  const normalizedSource = source.toLowerCase().replace(/\s+/g, '');
  return allNews.filter(item => {
    const itemSource = item.source.toLowerCase().replace(/\s+/g, '');
    return itemSource === normalizedSource || itemSource.includes(normalizedSource);
  });
}

/**
 * Get news filtered by affected instrument
 */
export async function fetchNewsForInstrument(symbol, options = {}) {
  const allNews = await fetchUnifiedNews(options);
  const upperSymbol = symbol.toUpperCase();

  return allNews.filter(item =>
    item.affectedInstruments?.includes(upperSymbol) ||
    item.symbols?.includes(upperSymbol)
  );
}

/**
 * Clear unified news cache
 */
export function clearUnifiedNewsCache() {
  unifiedNewsCache = null;
  unifiedNewsCacheTime = null;
  console.log('Unified news cache cleared');
}

/**
 * Get cache status
 */
export function getUnifiedNewsCacheStatus() {
  return {
    isCached: !!unifiedNewsCache,
    itemCount: unifiedNewsCache?.length || 0,
    cacheAge: unifiedNewsCacheTime ? Date.now() - unifiedNewsCacheTime : null,
    maxAge: UNIFIED_CACHE_DURATION,
    sources: {
      googleSheets: unifiedNewsCache?.filter(n => n.source === 'Google Sheets').length || 0,
      newsApi: unifiedNewsCache?.filter(n => n.source === 'NewsAPI').length || 0,
      finnhub: unifiedNewsCache?.filter(n => n.source === 'Finnhub').length || 0
    }
  };
}

export default {
  fetchUnifiedNews,
  fetchNewsBySource,
  fetchNewsForInstrument,
  clearUnifiedNewsCache,
  getUnifiedNewsCacheStatus
};
