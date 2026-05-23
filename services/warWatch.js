// WarWatch Service - Real-time War/Conflict News Aggregator & Market Impact Tracker
// Data sources:
// - NewsAPI: war/conflict/geopolitical headlines (uses existing NEWS_API_KEY)
// - Finnhub: geopolitical news filtering (uses existing FINNHUB_API_KEY)
// - BBC RSS: global conflict feeds (FREE, no key needed)
// - ACLED-style conflict zone tracking (structured data)

const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

// ============================================================================
// CONFLICT ZONES DATABASE — Tracked Regions with Market Impact
// ============================================================================

const CONFLICT_ZONES = {
  'ukraine-russia': {
    id: 'ukraine-russia',
    region: 'Eastern Europe',
    name: 'Ukraine-Russia War',
    countries: ['Ukraine', 'Russia'],
    startDate: '2022-02-24',
    severity: 'CRITICAL',          // CRITICAL / HIGH / ELEVATED / MODERATE / LOW
    affectedInstruments: ['CL', 'NG', 'ZW', 'ZC', 'GC', 'DX', '6E'],
    marketImpact: {
      energy: 'Russia is a top oil/gas exporter — escalation spikes CL & NG',
      agriculture: 'Ukraine is a major wheat/corn exporter — disruption bullish ZW, ZC',
      safeHaven: 'Escalation drives gold (GC) and dollar (DX) higher',
      currencies: 'Euro (6E) weakens on European energy vulnerability'
    },
    keywords: ['ukraine', 'russia', 'kyiv', 'moscow', 'donbas', 'crimea', 'zelensky', 'putin', 'nato expansion', 'black sea']
  },
  'israel-palestine': {
    id: 'israel-palestine',
    region: 'Middle East',
    name: 'Israel-Palestine Conflict',
    countries: ['Israel', 'Palestine', 'Gaza', 'Lebanon'],
    startDate: '2023-10-07',
    severity: 'CRITICAL',
    affectedInstruments: ['CL', 'NG', 'GC', 'DX', '6J'],
    marketImpact: {
      energy: 'Middle East escalation threatens oil supply routes — bullish CL',
      safeHaven: 'Conflict drives safe-haven demand — bullish GC, DX, 6J',
      shipping: 'Red Sea/Suez disruption raises shipping costs globally'
    },
    keywords: ['israel', 'gaza', 'hamas', 'hezbollah', 'netanyahu', 'iran', 'west bank', 'idf', 'ceasefire', 'hostage', 'red sea', 'houthi', 'lebanon']
  },
  'taiwan-strait': {
    id: 'taiwan-strait',
    region: 'East Asia',
    name: 'Taiwan Strait Tensions',
    countries: ['Taiwan', 'China'],
    startDate: '2022-08-01',
    severity: 'HIGH',
    affectedInstruments: ['NQ', 'ES', 'GC', '6J', '6A', 'DX'],
    marketImpact: {
      tech: 'Taiwan produces 90% of advanced chips — NQ crash risk if escalation',
      safeHaven: 'Major escalation = massive risk-off, GC/6J/DX surge',
      trade: 'US-China decoupling accelerates — bearish 6A, global trade'
    },
    keywords: ['taiwan', 'taipei', 'china military', 'strait', 'tsmc', 'pelosi taiwan', 'one china', 'pla', 'chinese military', 'south china sea']
  },
  'iran-tensions': {
    id: 'iran-tensions',
    region: 'Middle East / Persian Gulf',
    name: 'Iran Nuclear & Regional Tensions',
    countries: ['Iran', 'USA', 'Israel'],
    startDate: '2020-01-01',
    severity: 'HIGH',
    affectedInstruments: ['CL', 'NG', 'GC', 'DX'],
    marketImpact: {
      energy: 'Iran controls Strait of Hormuz — 20% of global oil flows through it',
      safeHaven: 'Any military strike = oil spike + gold surge',
      nuclear: 'Nuclear deal progress = bearish CL, no deal = bullish CL'
    },
    keywords: ['iran', 'tehran', 'hormuz', 'iranian', 'irgc', 'nuclear', 'enrichment', 'sanctions iran', 'proxy', 'militia']
  },
  'south-china-sea': {
    id: 'south-china-sea',
    region: 'Southeast Asia',
    name: 'South China Sea Disputes',
    countries: ['China', 'Philippines', 'Vietnam', 'Taiwan'],
    startDate: '2013-01-01',
    severity: 'ELEVATED',
    affectedInstruments: ['ES', 'NQ', '6A', '6J', 'CL', 'GC'],
    marketImpact: {
      shipping: '$5 trillion in goods transit SCS annually — disruption = global inflation',
      trade: 'US-China friction bearish for equities',
      regional: 'ASEAN currencies weaken, safe havens rally'
    },
    keywords: ['south china sea', 'philippines', 'spratly', 'scarborough', 'nine-dash', 'freedom of navigation', 'chinese coast guard']
  },
  'korea-peninsula': {
    id: 'korea-peninsula',
    region: 'East Asia',
    name: 'Korean Peninsula',
    countries: ['North Korea', 'South Korea'],
    startDate: '1950-06-25',
    severity: 'MODERATE',
    affectedInstruments: ['ES', 'NQ', 'GC', '6J', '6A'],
    marketImpact: {
      safeHaven: 'Missile tests = brief risk-off spikes in GC, 6J',
      equities: 'Usually short-lived market impact unless nuclear test'
    },
    keywords: ['north korea', 'pyongyang', 'kim jong', 'icbm', 'missile test', 'korean peninsula', 'dmz', 'denuclearization']
  },
  'sudan-civil-war': {
    id: 'sudan-civil-war',
    region: 'East Africa',
    name: 'Sudan Civil War',
    countries: ['Sudan'],
    startDate: '2023-04-15',
    severity: 'HIGH',
    affectedInstruments: ['GC', 'CL'],
    marketImpact: {
      humanitarian: 'Refugee crisis affects neighboring economies',
      resources: 'Sudan has gold reserves — instability = minor GC support',
      energy: 'Red Sea proximity adds to regional instability premium on CL'
    },
    keywords: ['sudan', 'khartoum', 'rsf', 'rapid support forces', 'sudanese army', 'darfur']
  },
  'india-pakistan': {
    id: 'india-pakistan',
    region: 'South Asia',
    name: 'India-Pakistan Tensions',
    countries: ['India', 'Pakistan'],
    startDate: '1947-08-14',
    severity: 'MODERATE',
    affectedInstruments: ['GC', 'CL', 'ES'],
    marketImpact: {
      nuclear: 'Both are nuclear powers — escalation = global risk-off',
      energy: 'Regional instability adds risk premium to CL',
      emerging: 'India is a major emerging market — affects global growth outlook'
    },
    keywords: ['india pakistan', 'kashmir', 'loc', 'line of control', 'modi pakistan', 'indo-pak', 'india military', 'pakistan military']
  }
};

// ============================================================================
// SEVERITY LEVELS — Color coding and priority
// ============================================================================

const SEVERITY_LEVELS = {
  CRITICAL: { level: 5, color: '#FF0000', label: 'Critical', description: 'Active large-scale warfare, immediate market impact' },
  HIGH:     { level: 4, color: '#FF6600', label: 'High',     description: 'Significant military operations or major escalation' },
  ELEVATED: { level: 3, color: '#FFCC00', label: 'Elevated', description: 'Rising tensions, military posturing, or proxy conflicts' },
  MODERATE: { level: 2, color: '#66CC00', label: 'Moderate', description: 'Ongoing tensions with occasional flare-ups' },
  LOW:      { level: 1, color: '#00CC66', label: 'Low',      description: 'Historical tension, currently stable' }
};

// ============================================================================
// SENTIMENT KEYWORDS — For conflict news analysis
// ============================================================================

const ESCALATION_KEYWORDS = [
  'attack', 'strike', 'bomb', 'missile', 'invasion', 'offensive', 'advance',
  'casualties', 'killed', 'dead', 'troops deploy', 'mobilization', 'declares war',
  'nuclear threat', 'chemical weapon', 'genocide', 'massacre', 'airstrike',
  'drone strike', 'ground offensive', 'siege', 'blockade', 'military buildup',
  'martial law', 'emergency', 'evacuate', 'shelling', 'artillery', 'tank',
  'warship', 'aircraft carrier', 'special forces', 'commando', 'ambush',
  'counter-offensive', 'encircle', 'capture', 'fall of', 'retreat'
];

const DEESCALATION_KEYWORDS = [
  'ceasefire', 'peace talk', 'peace deal', 'negotiation', 'diplomacy',
  'truce', 'withdrawal', 'pullback', 'de-escalation', 'humanitarian corridor',
  'prisoner exchange', 'peace agreement', 'peace plan', 'mediation',
  'calm restored', 'tensions ease', 'stand down', 'agreement reached',
  'peace summit', 'reconciliation', 'armistice', 'treaty', 'normalize',
  'diplomatic solution', 'UN resolution', 'peacekeeping'
];

const SANCTIONS_KEYWORDS = [
  'sanctions', 'embargo', 'trade ban', 'freeze assets', 'blacklist',
  'export control', 'import ban', 'economic warfare', 'trade war',
  'tariffs', 'secondary sanctions', 'swift ban', 'oil embargo'
];

// ============================================================================
// CACHE SYSTEM
// ============================================================================

let warWatchCache = null;
let warWatchLastFetch = null;
const WARWATCH_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes (conflict news is time-sensitive)

let alertsHistory = [];                          // Rolling 24h alert log
const MAX_ALERTS = 100;                          // Keep last 100 alerts
let lastSeenHeadlines = new Set();               // Dedup for breaking alerts

// ============================================================================
// NEWS FETCHERS
// ============================================================================

/**
 * Fetch conflict news from NewsAPI
 */
async function fetchConflictNewsFromNewsAPI() {
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not set, skipping NewsAPI conflict news');
    return [];
  }

  const query = encodeURIComponent(
    '(war OR conflict OR military OR attack OR missile OR airstrike OR troops) AND NOT (trade war OR price war OR star wars)'
  );

  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JinahDashboard/1.0'
      }
    });

    if (!response.ok) {
      console.error(`NewsAPI conflict fetch returned status: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.status !== 'ok' || !data.articles) {
      return [];
    }

    return data.articles
      .filter(article => article.title && article.url)
      .map(article => ({
        id: `newsapi-war-${Buffer.from(article.url).toString('base64').slice(0, 12)}`,
        headline: article.title,
        summary: article.description || '',
        source: article.source?.name || 'Unknown',
        url: article.url,
        timestamp: article.publishedAt || new Date().toISOString(),
        origin: 'newsapi'
      }));

  } catch (error) {
    console.error('NewsAPI conflict fetch error:', error.message);
    return [];
  }
}

/**
 * Fetch geopolitical news from Finnhub
 */
async function fetchConflictNewsFromFinnhub() {
  if (!FINNHUB_API_KEY) {
    return [];
  }

  const url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    // Filter for conflict-related headlines only
    const conflictKeywords = Object.values(CONFLICT_ZONES).flatMap(z => z.keywords);

    return data
      .filter(item => {
        const text = `${item.headline} ${item.summary || ''}`.toLowerCase();
        return conflictKeywords.some(kw => text.includes(kw));
      })
      .slice(0, 15)
      .map(item => ({
        id: `finnhub-war-${item.id || Buffer.from(item.url || '').toString('base64').slice(0, 12)}`,
        headline: item.headline,
        summary: item.summary || '',
        source: item.source || 'Finnhub',
        url: item.url || '',
        timestamp: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
        origin: 'finnhub'
      }));

  } catch (error) {
    console.error('Finnhub conflict fetch error:', error.message);
    return [];
  }
}

/**
 * Fetch conflict news from BBC RSS feed (FREE, no key needed)
 */
async function fetchConflictNewsFromBBC() {
  // BBC World RSS feed — free, no API key, reliable
  const rssFeedUrl = 'https://feeds.bbci.co.uk/news/world/rss.xml';

  try {
    const response = await fetch(rssFeedUrl, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'JinahDashboard/1.0'
      }
    });

    if (!response.ok) {
      console.error(`BBC RSS returned status: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();

    // Parse RSS XML manually (no dependency needed)
    const items = parseRSSItems(xmlText);

    // Filter for conflict-related items
    const conflictKeywords = Object.values(CONFLICT_ZONES).flatMap(z => z.keywords);
    const globalConflictKeywords = ['war', 'conflict', 'military', 'attack', 'troops', 'missile', 'bomb', 'strike', 'killed', 'casualties'];
    const allKeywords = [...new Set([...conflictKeywords, ...globalConflictKeywords])];

    return items
      .filter(item => {
        const text = `${item.title} ${item.description || ''}`.toLowerCase();
        return allKeywords.some(kw => text.includes(kw));
      })
      .slice(0, 15)
      .map(item => ({
        id: `bbc-war-${Buffer.from(item.link || item.title).toString('base64').slice(0, 12)}`,
        headline: item.title,
        summary: item.description || '',
        source: 'BBC News',
        url: item.link || '',
        timestamp: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        origin: 'bbc'
      }));

  } catch (error) {
    console.error('BBC RSS fetch error:', error.message);
    return [];
  }
}

/**
 * Simple RSS XML parser (avoids external dependency)
 */
function parseRSSItems(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const description = extractTag(itemXml, 'description');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title) {
      items.push({ title, description, link, pubDate });
    }
  }

  return items;
}

/**
 * Extract text content from an XML tag
 */
function extractTag(xml, tagName) {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular text content
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  if (match) return match[1].trim();

  return '';
}

// ============================================================================
// NEWS PROCESSING & ANALYSIS
// ============================================================================

/**
 * Analyze sentiment of a conflict headline
 */
function analyzeConflictSentiment(headline, summary = '') {
  const text = `${headline} ${summary}`.toLowerCase();

  let escalationScore = 0;
  let deescalationScore = 0;
  let sanctionsScore = 0;
  const matchedKeywords = [];

  ESCALATION_KEYWORDS.forEach(kw => {
    if (text.includes(kw)) {
      escalationScore++;
      matchedKeywords.push({ keyword: kw, type: 'escalation' });
    }
  });

  DEESCALATION_KEYWORDS.forEach(kw => {
    if (text.includes(kw)) {
      deescalationScore++;
      matchedKeywords.push({ keyword: kw, type: 'deescalation' });
    }
  });

  SANCTIONS_KEYWORDS.forEach(kw => {
    if (text.includes(kw)) {
      sanctionsScore++;
      matchedKeywords.push({ keyword: kw, type: 'sanctions' });
    }
  });

  // Determine overall sentiment
  let sentiment, marketBias;
  if (escalationScore > deescalationScore + 1) {
    sentiment = 'ESCALATION';
    marketBias = 'RISK-OFF';
  } else if (deescalationScore > escalationScore + 1) {
    sentiment = 'DE-ESCALATION';
    marketBias = 'RISK-ON';
  } else if (sanctionsScore > 0) {
    sentiment = 'SANCTIONS';
    marketBias = 'MIXED';
  } else {
    sentiment = 'NEUTRAL';
    marketBias = 'NEUTRAL';
  }

  return {
    sentiment,
    marketBias,
    escalationScore,
    deescalationScore,
    sanctionsScore,
    intensity: escalationScore + deescalationScore + sanctionsScore,
    matchedKeywords
  };
}

/**
 * Match a headline to conflict zones
 */
function matchConflictZones(headline, summary = '') {
  const text = `${headline} ${summary}`.toLowerCase();
  const matched = [];

  for (const [id, zone] of Object.entries(CONFLICT_ZONES)) {
    const matchCount = zone.keywords.filter(kw => text.includes(kw)).length;
    if (matchCount > 0) {
      matched.push({
        zoneId: id,
        name: zone.name,
        region: zone.region,
        severity: zone.severity,
        matchCount,
        affectedInstruments: zone.affectedInstruments,
        marketImpact: zone.marketImpact
      });
    }
  }

  // Sort by match count (best match first)
  return matched.sort((a, b) => b.matchCount - a.matchCount);
}

/**
 * Determine if a headline is a BREAKING alert
 */
function isBreakingAlert(headline, sentiment) {
  const text = headline.toLowerCase();

  const breakingKeywords = [
    'breaking', 'urgent', 'just in', 'developing',
    'declares war', 'invasion', 'nuclear', 'missile launch',
    'major attack', 'mass casualties', 'emergency session'
  ];

  const isBreaking = breakingKeywords.some(kw => text.includes(kw));
  const isHighIntensity = sentiment.intensity >= 3;
  const isEscalation = sentiment.sentiment === 'ESCALATION' && sentiment.escalationScore >= 2;

  return isBreaking || isHighIntensity || isEscalation;
}

/**
 * Determine market impact level from conflict news
 */
function determineMarketImpact(headline, zones, sentiment) {
  // High impact: breaking + critical zone + escalation
  if (sentiment.sentiment === 'ESCALATION' && zones.some(z => z.severity === 'CRITICAL')) {
    return 'HIGH';
  }

  // Medium impact: known zone + clear sentiment
  if (zones.length > 0 && sentiment.intensity >= 2) {
    return 'MEDIUM';
  }

  // Low impact: general conflict news
  return 'LOW';
}

/**
 * Process raw news items into enriched conflict intelligence
 */
function processConflictNews(rawItems) {
  // Deduplicate by headline similarity
  const seenHeadlines = new Set();
  const uniqueItems = rawItems.filter(item => {
    const normalized = (item.headline || '').toLowerCase().slice(0, 60);
    if (seenHeadlines.has(normalized)) return false;
    seenHeadlines.add(normalized);
    return true;
  });

  // Process each item
  const processed = uniqueItems.map(item => {
    const sentiment = analyzeConflictSentiment(item.headline, item.summary);
    const zones = matchConflictZones(item.headline, item.summary);
    const impact = determineMarketImpact(item.headline, zones, sentiment);
    const breaking = isBreakingAlert(item.headline, sentiment);

    return {
      ...item,
      relativeTime: getRelativeTime(new Date(item.timestamp).getTime()),
      sentiment,
      conflictZones: zones,
      impact,
      isBreaking: breaking,
      affectedInstruments: [...new Set(zones.flatMap(z => z.affectedInstruments))],
      primaryZone: zones.length > 0 ? zones[0].name : 'General Conflict'
    };
  });

  // Sort: breaking first, then by timestamp
  return processed.sort((a, b) => {
    if (a.isBreaking && !b.isBreaking) return -1;
    if (!a.isBreaking && b.isBreaking) return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

// ============================================================================
// ALERT SYSTEM
// ============================================================================

/**
 * Check for new breaking alerts and add to history
 */
function checkAndLogAlerts(processedNews) {
  const newAlerts = [];

  for (const item of processedNews) {
    if (!item.isBreaking) continue;

    // Skip if we've already seen this headline
    const normalizedHeadline = item.headline.toLowerCase().slice(0, 80);
    if (lastSeenHeadlines.has(normalizedHeadline)) continue;

    lastSeenHeadlines.add(normalizedHeadline);

    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      headline: item.headline,
      source: item.source,
      timestamp: item.timestamp,
      detectedAt: new Date().toISOString(),
      sentiment: item.sentiment.sentiment,
      marketBias: item.sentiment.marketBias,
      primaryZone: item.primaryZone,
      impact: item.impact,
      affectedInstruments: item.affectedInstruments,
      url: item.url
    };

    newAlerts.push(alert);
    alertsHistory.unshift(alert);
  }

  // Trim alerts history
  if (alertsHistory.length > MAX_ALERTS) {
    alertsHistory = alertsHistory.slice(0, MAX_ALERTS);
  }

  // Trim seen headlines (keep last 500)
  if (lastSeenHeadlines.size > 500) {
    const arr = [...lastSeenHeadlines];
    lastSeenHeadlines = new Set(arr.slice(-300));
  }

  return newAlerts;
}

// ============================================================================
// CONFLICT ZONE TRACKER
// ============================================================================

/**
 * Build structured conflict zone status report
 */
function buildConflictZoneReport(processedNews) {
  const zoneReport = {};

  for (const [id, zone] of Object.entries(CONFLICT_ZONES)) {
    // Count recent news mentioning this zone
    const relatedNews = processedNews.filter(item =>
      item.conflictZones.some(z => z.zoneId === id)
    );

    // Calculate zone-specific sentiment
    let escalationCount = 0;
    let deescalationCount = 0;

    relatedNews.forEach(item => {
      if (item.sentiment.sentiment === 'ESCALATION') escalationCount++;
      if (item.sentiment.sentiment === 'DE-ESCALATION') deescalationCount++;
    });

    let trend;
    if (escalationCount > deescalationCount + 1) trend = 'ESCALATING';
    else if (deescalationCount > escalationCount + 1) trend = 'DE-ESCALATING';
    else if (relatedNews.length === 0) trend = 'QUIET';
    else trend = 'STABLE';

    zoneReport[id] = {
      ...zone,
      severityMeta: SEVERITY_LEVELS[zone.severity],
      recentNewsCount: relatedNews.length,
      trend,
      escalationCount,
      deescalationCount,
      latestHeadline: relatedNews.length > 0 ? relatedNews[0].headline : null,
      latestTimestamp: relatedNews.length > 0 ? relatedNews[0].timestamp : null
    };
  }

  return zoneReport;
}

/**
 * Generate overall geopolitical risk summary for market analysis
 */
function buildGeopoliticalRiskSummary(processedNews, zoneReport) {
  // Count active zones by severity
  const activeCritical = Object.values(zoneReport).filter(z => z.severity === 'CRITICAL' && z.recentNewsCount > 0).length;
  const activeHigh = Object.values(zoneReport).filter(z => z.severity === 'HIGH' && z.recentNewsCount > 0).length;
  const escalatingZones = Object.values(zoneReport).filter(z => z.trend === 'ESCALATING');

  // Overall risk level
  let overallRisk;
  if (activeCritical >= 2 || escalatingZones.length >= 3) {
    overallRisk = 'EXTREME';
  } else if (activeCritical >= 1 && escalatingZones.length >= 1) {
    overallRisk = 'HIGH';
  } else if (activeHigh >= 2 || escalatingZones.length >= 1) {
    overallRisk = 'ELEVATED';
  } else if (activeHigh >= 1) {
    overallRisk = 'MODERATE';
  } else {
    overallRisk = 'LOW';
  }

  // Aggregate affected instruments across all active zones
  const allAffectedInstruments = [...new Set(
    Object.values(zoneReport)
      .filter(z => z.recentNewsCount > 0)
      .flatMap(z => z.affectedInstruments)
  )];

  // Count sentiments
  const totalEscalation = processedNews.filter(n => n.sentiment.sentiment === 'ESCALATION').length;
  const totalDeescalation = processedNews.filter(n => n.sentiment.sentiment === 'DE-ESCALATION').length;
  const totalSanctions = processedNews.filter(n => n.sentiment.sentiment === 'SANCTIONS').length;
  const breakingCount = processedNews.filter(n => n.isBreaking).length;

  // Market bias from geopolitical risk
  let marketBias;
  if (overallRisk === 'EXTREME' || overallRisk === 'HIGH') {
    marketBias = 'RISK-OFF';
  } else if (totalDeescalation > totalEscalation * 2) {
    marketBias = 'RISK-ON';
  } else {
    marketBias = 'NEUTRAL';
  }

  return {
    overallRisk,
    overallRiskMeta: SEVERITY_LEVELS[overallRisk] || SEVERITY_LEVELS.MODERATE,
    marketBias,
    totalNewsItems: processedNews.length,
    breakingAlerts: breakingCount,
    sentimentBreakdown: {
      escalation: totalEscalation,
      deescalation: totalDeescalation,
      sanctions: totalSanctions,
      neutral: processedNews.length - totalEscalation - totalDeescalation - totalSanctions
    },
    escalatingZones: escalatingZones.map(z => z.name),
    affectedInstruments: allAffectedInstruments,
    tradingImplication: getTradingImplication(overallRisk, marketBias)
  };
}

/**
 * Generate trading implication text from risk level
 */
function getTradingImplication(overallRisk, marketBias) {
  const implications = {
    EXTREME: 'EXTREME geopolitical risk — expect safe-haven surge (GC, DX, 6J). SIZE DOWN all positions. Energy volatility extreme.',
    HIGH: 'HIGH geopolitical risk — safe havens bid (GC, DX). Watch energy closely for supply disruption. Reduce equity exposure.',
    ELEVATED: 'ELEVATED tensions — monitor headlines for escalation triggers. Keep stops tight on affected instruments.',
    MODERATE: 'MODERATE background risk — factor into overall bias but do not over-weight. Watch for catalyst headlines.',
    LOW: 'LOW geopolitical risk — conflict risk premium is minimal. Focus on economic data and earnings.'
  };

  return implications[overallRisk] || implications.MODERATE;
}

// ============================================================================
// MAIN AGGREGATOR — Combines all sources
// ============================================================================

/**
 * Fetch and aggregate all conflict news from all sources
 */
export async function fetchWarWatchData() {
  const now = Date.now();

  // Return cached data if still valid
  if (warWatchCache && warWatchLastFetch && (now - warWatchLastFetch) < WARWATCH_CACHE_DURATION) {
    return warWatchCache;
  }

  console.log('WarWatch: Fetching fresh conflict intelligence...');

  // Fetch from all sources in parallel
  const [newsApiItems, finnhubItems, bbcItems] = await Promise.allSettled([
    fetchConflictNewsFromNewsAPI(),
    fetchConflictNewsFromFinnhub(),
    fetchConflictNewsFromBBC()
  ]);

  // Extract results (use empty arrays if failed)
  const allRaw = [
    ...(newsApiItems.status === 'fulfilled' ? newsApiItems.value : []),
    ...(finnhubItems.status === 'fulfilled' ? finnhubItems.value : []),
    ...(bbcItems.status === 'fulfilled' ? bbcItems.value : [])
  ];

  // Log source stats
  const sourceStats = {
    newsapi: newsApiItems.status === 'fulfilled' ? newsApiItems.value.length : 0,
    finnhub: finnhubItems.status === 'fulfilled' ? finnhubItems.value.length : 0,
    bbc: bbcItems.status === 'fulfilled' ? bbcItems.value.length : 0
  };
  console.log(`WarWatch sources: NewsAPI=${sourceStats.newsapi}, Finnhub=${sourceStats.finnhub}, BBC=${sourceStats.bbc}`);

  // Process and enrich all news
  const processedNews = processConflictNews(allRaw);

  // Check for new breaking alerts
  const newAlerts = checkAndLogAlerts(processedNews);
  if (newAlerts.length > 0) {
    console.log(`WarWatch: ${newAlerts.length} NEW BREAKING ALERT(S) detected!`);
  }

  // Build conflict zone report
  const conflictZones = buildConflictZoneReport(processedNews);

  // Build overall risk summary
  const riskSummary = buildGeopoliticalRiskSummary(processedNews, conflictZones);

  // Build response
  const _nowET = new Date();
  const result = {
    lastUpdate: _nowET.toISOString(),
    lastUpdateLabel: _nowET.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET',
    riskSummary,
    conflictZones,
    news: processedNews.slice(0, 30),     // Top 30 most relevant items
    breakingAlerts: alertsHistory.slice(0, 10),
    newAlerts,
    sourceStats,
    totalItems: processedNews.length
  };

  // Cache the result
  warWatchCache = result;
  warWatchLastFetch = now;

  return result;
}

/**
 * Get only breaking alerts (for polling/WebSocket use)
 */
export function getBreakingAlerts(since = null) {
  if (!since) {
    return alertsHistory.slice(0, 10);
  }

  const sinceTime = new Date(since).getTime();
  return alertsHistory.filter(a => new Date(a.detectedAt).getTime() > sinceTime);
}

/**
 * Get conflict zone status for a specific zone
 */
export async function getConflictZone(zoneId) {
  const data = await fetchWarWatchData();
  const zone = data.conflictZones[zoneId];

  if (!zone) {
    return { error: `Unknown conflict zone: ${zoneId}`, availableZones: Object.keys(CONFLICT_ZONES) };
  }

  // Get related news for this zone
  const relatedNews = data.news.filter(item =>
    item.conflictZones.some(z => z.zoneId === zoneId)
  );

  return {
    ...zone,
    relatedNews: relatedNews.slice(0, 10),
    lastUpdate: data.lastUpdate
  };
}

/**
 * Get risk summary only (lightweight for dashboard integration)
 */
export async function getRiskSummary() {
  const data = await fetchWarWatchData();
  return data.riskSummary;
}

/**
 * Get WarWatch data filtered by region
 */
export async function getNewsByRegion(region) {
  const data = await fetchWarWatchData();

  const normalizedRegion = region.toLowerCase();
  const filteredZones = Object.entries(data.conflictZones)
    .filter(([, zone]) => zone.region.toLowerCase().includes(normalizedRegion))
    .reduce((acc, [id, zone]) => ({ ...acc, [id]: zone }), {});

  const zoneIds = Object.keys(filteredZones);
  const filteredNews = data.news.filter(item =>
    item.conflictZones.some(z => zoneIds.includes(z.zoneId))
  );

  return {
    region,
    zones: filteredZones,
    news: filteredNews,
    count: filteredNews.length,
    lastUpdate: data.lastUpdate
  };
}

/**
 * Clear WarWatch cache (force refresh)
 */
export function clearWarWatchCache() {
  warWatchCache = null;
  warWatchLastFetch = null;
  return { message: 'WarWatch cache cleared' };
}

/**
 * Get WarWatch cache status
 */
export function getWarWatchCacheStatus() {
  return {
    cached: !!warWatchCache,
    lastFetch: warWatchLastFetch ? new Date(warWatchLastFetch).toISOString() : null,
    cacheDuration: WARWATCH_CACHE_DURATION,
    alertsInHistory: alertsHistory.length,
    trackedHeadlines: lastSeenHeadlines.size
  };
}

// ============================================================================
// HELPER
// ============================================================================

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

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  fetchWarWatchData,
  getBreakingAlerts,
  getConflictZone,
  getRiskSummary,
  getNewsByRegion,
  clearWarWatchCache,
  getWarWatchCacheStatus
};
