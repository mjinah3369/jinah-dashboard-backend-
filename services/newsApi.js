// NewsAPI Service - Aggregates news from Reuters, Bloomberg, BBC, etc.
// Free tier: 100 requests/day - https://newsapi.org/register

const NEWS_API_KEY = process.env.NEWS_API_KEY || '';

const BUSINESS_SOURCES = 'reuters,bloomberg,financial-times,the-wall-street-journal,business-insider,cnbc';

/**
 * Fetch top business/market headlines from NewsAPI
 */
export async function fetchNewsApiHeadlines() {
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not set, skipping NewsAPI');
    return [];
  }

  // Note: Free tier only works from backend (not browser) and excludes some sources
  const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=15&apiKey=${NEWS_API_KEY}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JinahDashboard/1.0'
      }
    });

    if (!response.ok) {
      console.error(`NewsAPI returned status: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.status !== 'ok' || !data.articles) {
      console.warn('NewsAPI returned no articles');
      return [];
    }

    // Process articles
    const processedNews = data.articles
      .filter(article => article.title && article.url)
      .map(article => ({
        id: `newsapi-${Buffer.from(article.url).toString('base64').slice(0, 12)}`,
        headline: article.title,
        summary: article.description || '',
        source: article.source?.name || 'Unknown',
        url: article.url,
        timestamp: article.publishedAt || new Date().toISOString(),
        relativeTime: getRelativeTime(new Date(article.publishedAt).getTime()),
        image: article.urlToImage,
        category: categorizeHeadline(article.title),
        impact: determineImpact(article.title),
        affectedInstruments: determineAffectedInstruments(article.title)
      }));

    console.log(`NewsAPI: fetched ${processedNews.length} articles`);
    return processedNews;

  } catch (error) {
    console.error('NewsAPI fetch error:', error.message);
    return [];
  }
}

/**
 * Search for specific market news
 */
export async function searchMarketNews(query = 'stock market OR federal reserve OR oil prices') {
  if (!NEWS_API_KEY) {
    return [];
  }

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JinahDashboard/1.0'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (data.status !== 'ok' || !data.articles) {
      return [];
    }

    return data.articles
      .filter(article => article.title && article.url)
      .slice(0, 10)
      .map(article => ({
        id: `newsapi-${Buffer.from(article.url).toString('base64').slice(0, 12)}`,
        headline: article.title,
        summary: article.description || '',
        source: article.source?.name || 'Unknown',
        url: article.url,
        timestamp: article.publishedAt,
        relativeTime: getRelativeTime(new Date(article.publishedAt).getTime()),
        category: categorizeHeadline(article.title),
        impact: determineImpact(article.title),
        affectedInstruments: determineAffectedInstruments(article.title)
      }));

  } catch (error) {
    console.error('NewsAPI search error:', error.message);
    return [];
  }
}

// Helper functions
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const CATEGORY_KEYWORDS = {
  'Fed': ['fed', 'federal reserve', 'fomc', 'powell', 'rate hike', 'rate cut', 'interest rate'],
  'Geopolitical': ['war', 'conflict', 'sanctions', 'tariff', 'china', 'russia', 'ukraine', 'iran'],
  'Economic': ['gdp', 'inflation', 'cpi', 'jobs', 'employment', 'unemployment', 'retail sales'],
  'Earnings': ['earnings', 'revenue', 'profit', 'quarterly', 'guidance'],
  'Tech': ['tech', 'ai', 'artificial intelligence', 'apple', 'microsoft', 'google', 'nvidia'],
  'Energy': ['oil', 'crude', 'opec', 'natural gas', 'energy']
};

function categorizeHeadline(headline) {
  const text = headline.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }
  return 'General';
}

const HIGH_IMPACT_KEYWORDS = ['breaking', 'crash', 'surge', 'plunge', 'crisis', 'fed', 'fomc', 'rate'];
const MEDIUM_IMPACT_KEYWORDS = ['rally', 'drop', 'rise', 'fall', 'growth', 'beat', 'miss'];

function determineImpact(headline) {
  const text = headline.toLowerCase();
  if (HIGH_IMPACT_KEYWORDS.some(keyword => text.includes(keyword))) return 'HIGH';
  if (MEDIUM_IMPACT_KEYWORDS.some(keyword => text.includes(keyword))) return 'MEDIUM';
  return 'LOW';
}

const INSTRUMENT_KEYWORDS = {
  'ES': ['s&p', 'stock', 'market', 'wall street', 'dow', 'nasdaq'],
  'NQ': ['tech', 'nasdaq', 'technology'],
  'CL': ['oil', 'crude', 'opec', 'energy'],
  'GC': ['gold', 'precious'],
  'ZN': ['bond', 'treasury', 'yield'],
  'DX': ['dollar', 'currency', 'forex']
};

function determineAffectedInstruments(headline) {
  const text = headline.toLowerCase();
  const affected = [];
  for (const [instrument, keywords] of Object.entries(INSTRUMENT_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      affected.push(instrument);
    }
  }
  return affected.length > 0 ? affected : ['ES'];
}

export default {
  fetchNewsApiHeadlines,
  searchMarketNews
};
