// Finnhub News Service - Fetches market news with category analysis
// Free tier: 60 calls/minute - https://finnhub.io/register

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

// Keyword-based categorization
const CATEGORY_KEYWORDS = {
  'Fed': ['fed', 'federal reserve', 'fomc', 'powell', 'rate hike', 'rate cut', 'monetary policy', 'interest rate'],
  'Geopolitical': ['war', 'conflict', 'sanctions', 'tariff', 'china', 'russia', 'ukraine', 'middle east', 'iran', 'military', 'tensions'],
  'Economic': ['gdp', 'inflation', 'cpi', 'ppi', 'jobs', 'employment', 'unemployment', 'retail sales', 'consumer', 'housing', 'pmi'],
  'Earnings': ['earnings', 'revenue', 'profit', 'quarterly', 'guidance', 'beat', 'miss', 'eps'],
  'Tech': ['tech', 'ai', 'artificial intelligence', 'semiconductor', 'chip', 'apple', 'microsoft', 'google', 'nvidia', 'meta', 'amazon'],
  'Energy': ['oil', 'crude', 'opec', 'natural gas', 'energy', 'petroleum', 'drilling', 'refinery'],
  'Crypto': ['bitcoin', 'crypto', 'ethereum', 'blockchain', 'digital currency']
};

// Keywords that suggest high impact
const HIGH_IMPACT_KEYWORDS = ['breaking', 'urgent', 'crash', 'surge', 'plunge', 'crisis', 'emergency', 'record', 'historic', 'unexpected', 'shock', 'fed', 'fomc', 'rate'];
const MEDIUM_IMPACT_KEYWORDS = ['rally', 'drop', 'rise', 'fall', 'decline', 'gain', 'loss', 'growth', 'beat', 'miss'];

// Instrument affection mapping
const INSTRUMENT_KEYWORDS = {
  'ES': ['s&p', 'sp500', 'spx', 'stocks', 'equities', 'market', 'dow', 'nasdaq'],
  'NQ': ['tech', 'nasdaq', 'technology', 'growth stocks', 'faang', 'magnificent'],
  'CL': ['oil', 'crude', 'opec', 'energy', 'petroleum', 'barrel'],
  'GC': ['gold', 'precious', 'safe haven', 'bullion'],
  'ZN': ['bond', 'treasury', 'yield', 'fixed income', 'debt'],
  'DX': ['dollar', 'usd', 'currency', 'forex', 'dxy']
};

export async function fetchFinnhubNews() {
  if (!FINNHUB_API_KEY) {
    console.warn('FINNHUB_API_KEY not set, using fallback news data');
    return getFallbackNews();
  }

  const url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Finnhub API returned status: ${response.status}`);
      return getFallbackNews();
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Finnhub returned no news, using fallback data');
      return getFallbackNews();
    }

    // Process and categorize news
    const processedNews = data.slice(0, 10).map(item => processNewsItem(item));

    console.log(`Finnhub News: fetched ${processedNews.length} articles`);
    return processedNews;

  } catch (error) {
    console.error('Finnhub fetch error:', error.message);
    return getFallbackNews();
  }
}

function processNewsItem(item) {
  const headline = item.headline || '';
  const summary = item.summary || '';
  const fullText = `${headline} ${summary}`.toLowerCase();

  // Determine category
  const category = determineCategory(fullText);

  // Determine impact level
  const impact = determineImpact(fullText);

  // Determine affected instruments
  const affectedInstruments = determineAffectedInstruments(fullText);

  // Format timestamp
  const timestamp = item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString();
  const relativeTime = getRelativeTime(item.datetime ? item.datetime * 1000 : Date.now());

  return {
    id: item.id || Math.random().toString(36).substr(2, 9),
    headline: headline,
    summary: item.summary ? item.summary.slice(0, 200) + (item.summary.length > 200 ? '...' : '') : '',
    source: item.source || 'Unknown',
    url: item.url || '#',
    timestamp: timestamp,
    relativeTime: relativeTime,
    category: category,
    impact: impact,
    affectedInstruments: affectedInstruments,
    image: item.image || null
  };
}

function determineCategory(text) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }
  return 'General';
}

function determineImpact(text) {
  if (HIGH_IMPACT_KEYWORDS.some(keyword => text.includes(keyword))) {
    return 'HIGH';
  }
  if (MEDIUM_IMPACT_KEYWORDS.some(keyword => text.includes(keyword))) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function determineAffectedInstruments(text) {
  const affected = [];
  for (const [instrument, keywords] of Object.entries(INSTRUMENT_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      affected.push(instrument);
    }
  }
  return affected.length > 0 ? affected : ['ES']; // Default to ES if no specific match
}

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

function getFallbackNews() {
  // Generate contextually relevant mock news
  const now = new Date();
  const hour = now.getHours();

  const mockHeadlines = [
    {
      headline: 'Markets await key economic data release later this week',
      category: 'Economic',
      impact: 'MEDIUM',
      affectedInstruments: ['ES', 'NQ']
    },
    {
      headline: 'Fed officials signal continued data-dependent approach',
      category: 'Fed',
      impact: 'HIGH',
      affectedInstruments: ['ES', 'ZN', 'DX']
    },
    {
      headline: 'Tech sector leads early gains as investors assess earnings outlook',
      category: 'Tech',
      impact: 'MEDIUM',
      affectedInstruments: ['NQ', 'ES']
    },
    {
      headline: 'Oil prices steady amid supply concerns and demand uncertainty',
      category: 'Energy',
      impact: 'LOW',
      affectedInstruments: ['CL']
    },
    {
      headline: 'Treasury yields edge higher on inflation expectations',
      category: 'Economic',
      impact: 'MEDIUM',
      affectedInstruments: ['ZN', 'ES']
    },
    {
      headline: 'Dollar strengthens against major currencies',
      category: 'Economic',
      impact: 'MEDIUM',
      affectedInstruments: ['DX', 'GC', 'CL']
    },
    {
      headline: 'Gold prices consolidate near key support levels',
      category: 'General',
      impact: 'LOW',
      affectedInstruments: ['GC']
    },
    {
      headline: 'Analysts remain cautious ahead of upcoming earnings season',
      category: 'Earnings',
      impact: 'MEDIUM',
      affectedInstruments: ['ES', 'NQ']
    }
  ];

  return mockHeadlines.slice(0, 6).map((item, index) => ({
    id: `fallback-${index}`,
    headline: item.headline,
    summary: '',
    source: 'Market Analysis',
    url: '#',
    timestamp: new Date(now.getTime() - index * 30 * 60000).toISOString(),
    relativeTime: index === 0 ? 'Just now' : `${index * 30}m ago`,
    category: item.category,
    impact: item.impact,
    affectedInstruments: item.affectedInstruments,
    image: null,
    isFallback: true
  }));
}
