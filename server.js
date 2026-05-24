import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fetchYahooFinanceFutures, fetchCurrencyFutures, fetchInternationalIndices, fetchSectorETFs, fetchMag7Stocks, fetchTreasuryYields, fetchCryptoPrices, calculateExpectationMeters, fetchAsiaInstruments, fetchLondonInstruments, fetchUSInstruments, getGoldSilverRatio } from './services/yahooFinance.js';
import { fetchEconomicCalendar, fetchEarningsCalendar } from './services/alphaVantage.js';
import { fetchFredData, fetchComprehensiveEconomicData, getEconomicSummaryForAgent, analyzeEconomicSignals, getAvailableSeries, FRED_SERIES } from './services/fred.js';
import { fetchPolygonData } from './services/polygon.js';
import { fetchFinnhubNews, fetchMag7News } from './services/finnhubNews.js';
import { fetchNewsApiHeadlines } from './services/newsApi.js';
import { buildDashboardResponse } from './services/dashboardBuilder.js';
import {
  fetchEnergyReports,
  fetchAgricultureReports,
  fetchTreasuryAuctions,
  fetchCentralBankCalendar,
  buildReportsCalendar
} from './services/fundamentalReports.js';
import {
  buildWeatherReport,
  fetchDroughtMonitor,
  fetch610DayOutlook
} from './services/weather.js';
import {
  analyzeTechnicals,
  analyzeAllInstruments,
  detectTrending,
  getChartData,
  YAHOO_SYMBOLS
} from './services/technicalAnalysis.js';
import {
  generateInstrumentSummary,
  generateMarketDriversSummary,
  INSTRUMENT_DRIVERS
} from './services/instrumentSummary.js';
import {
  processWebhook,
  getAllScannerData,
  getICTScannerData,
  getOrderFlowScannerData,
  getNinjaSignalsData,
  getScannerData,
  getScannerSummary,
  clearScannerData
} from './services/scannerWebhook.js';
import {
  getCurrentSession,
  getNextSession,
  updateSessionLevels,
  getSessionHandoff,
  getSessionSummary
} from './services/sessionEngine.js';
import {
  calculateTicks,
  calculateTickValue,
  getNearestLevels,
  calculatePivots,
  getATRTargets,
  TICK_SIZES,
  TICK_VALUES
} from './services/levelCalculator.js';
import {
  detectSweep,
  getRecentSweeps,
  getSweepSummary,
  getReclaimedLevels,
  clearSweepHistory,
  addSweep
} from './services/sweepTracker.js';
import {
  runFullAnalysis,
  getQuickSessionBrief,
  prewarmSessionBrief,
  getSessionBriefStatus,
  clearCache as clearAICache,
  getCacheStatus as getAICacheStatus
} from './services/aiAgents.js';
import {
  answerQuestion,
  answerQuestionSmart,
  getMarketBrief,
  explainHeadline,
  explainInstrumentBias
} from './services/chatbot.js';
import {
  getESCommandCenter,
  getBiasBreakdown
} from './services/esCommandCenter.js';
import {
  fetchWarWatchData,
  getBreakingAlerts,
  getConflictZone,
  getRiskSummary,
  getNewsByRegion,
  clearWarWatchCache,
  getWarWatchCacheStatus
} from './services/warWatch.js';
import {
  generateWarWatchAnalysis,
  getTop5Affected,
  clearWarAnalysisCache,
  getWarAnalysisCacheStatus
} from './services/warWatchAnalysis.js';
import {
  fetchGoogleSheetsNews,
  clearGoogleSheetsCache,
  getGoogleSheetsCacheStatus
} from './services/googleSheets.js';
import {
  fetchAnalyzedNews,
  fetchHighImpactNews,
  refreshNewsAnalysis,
  getAnalysisCacheStatus,
  analyzeAllSourcesNews,
  getNewsSentimentSummary,
  refreshUnifiedNewsAnalysis,
  getUnifiedAnalysisCacheStatus
} from './services/newsAnalysis.js';
import {
  generateFinalAnalysis,
  generateAISynthesis,
  clearFinalAnalysisCache,
  getFinalAnalysisCacheStatus
} from './services/finalAnalysis.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Cache to store data and reduce API calls
let cachedData = null;
let lastFetchTime = null;
let inflightFetch = null; // Single-flight: shared promise while a fetch is running
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Does the actual fan-out and dashboard build. Updates cachedData/lastFetchTime on success.
// Called by the route handler AND by the background pre-warm scheduler.
async function refreshDashboardData() {
  console.log('Fetching fresh data from APIs...');

  const [
    futuresData,
    economicData,
    fredData,
    polygonData,
    currencyData,
    internationalData,
    finnhubNewsData,
    newsApiData,
    sectorData,
    mag7Data,
    mag7NewsData,
    treasuryYieldsData,
    cryptoData
  ] = await Promise.allSettled([
    fetchYahooFinanceFutures(),
    fetchEconomicCalendar(),
    fetchFredData(),
    fetchPolygonData(),
    fetchCurrencyFutures(),
    fetchInternationalIndices(),
    fetchFinnhubNews(),
    fetchNewsApiHeadlines(),
    fetchSectorETFs(),
    fetchMag7Stocks(),
    fetchMag7News(),
    fetchTreasuryYields(),
    fetchCryptoPrices()
  ]);

  const futures = futuresData.status === 'fulfilled' ? futuresData.value : {};
  const economic = economicData.status === 'fulfilled' ? economicData.value : [];
  const fred = fredData.status === 'fulfilled' ? fredData.value : {};
  const polygon = polygonData.status === 'fulfilled' ? polygonData.value : {};
  const currencies = currencyData.status === 'fulfilled' ? currencyData.value : {};
  const international = internationalData.status === 'fulfilled' ? internationalData.value : {};
  const finnhubNews = finnhubNewsData.status === 'fulfilled' ? finnhubNewsData.value : [];
  const newsApiNews = newsApiData.status === 'fulfilled' ? newsApiData.value : [];
  const sectors = sectorData.status === 'fulfilled' ? sectorData.value : {};
  const mag7 = mag7Data.status === 'fulfilled' ? mag7Data.value : {};
  const mag7News = mag7NewsData.status === 'fulfilled' ? mag7NewsData.value : {};
  const treasuryYields = treasuryYieldsData.status === 'fulfilled' ? treasuryYieldsData.value : {};
  const crypto = cryptoData.status === 'fulfilled' ? cryptoData.value : {};

  let analyzedNews = [];
  try {
    analyzedNews = await analyzeAllSourcesNews({ lastHours: 2 });
    console.log(`Analyzed news: ${analyzedNews.length} items with Claude AI analysis`);
  } catch (err) {
    console.warn('Could not fetch analyzed news, using raw news:', err.message);
  }

  const seenHeadlines = new Set();
  const allNews = [...finnhubNews, ...newsApiNews]
    .filter(item => {
      const normalizedHeadline = (item.headline || item.title || '').toLowerCase().slice(0, 50);
      if (seenHeadlines.has(normalizedHeadline)) return false;
      seenHeadlines.add(normalizedHeadline);
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    })
    .slice(0, 20);

  const news = analyzedNews.length > 0 ? analyzedNews : allNews;
  console.log(`Using ${analyzedNews.length > 0 ? 'analyzed' : 'raw'} news: ${news.length} items`);

  const expectationMeters = calculateExpectationMeters(futures, currencies, news);

  const sources = ['Yahoo Finance', 'Alpha Vantage', 'FRED', 'Polygon', 'Currency', 'International', 'Finnhub News', 'NewsAPI', 'Sectors', 'Mag7 Stocks', 'Mag7 News', 'Treasury Yields', 'Crypto'];
  [futuresData, economicData, fredData, polygonData, currencyData, internationalData, finnhubNewsData, newsApiData, sectorData, mag7Data, mag7NewsData, treasuryYieldsData, cryptoData].forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`${sources[i]} error:`, result.reason?.message || result.reason);
    }
  });

  const dashboard = buildDashboardResponse(futures, economic, fred, polygon, currencies, international, news, sectors, mag7, mag7News, treasuryYields, crypto, expectationMeters);

  cachedData = dashboard;
  lastFetchTime = Date.now();
  return dashboard;
}

// Main dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
  try {
    const now = Date.now();

    if (cachedData && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('Returning cached data');
      return res.json(cachedData);
    }

    // Single-flight: concurrent cache-miss requests share the same in-flight fetch
    // instead of each launching a parallel fan-out (which caused OOM crashes).
    if (!inflightFetch) {
      inflightFetch = refreshDashboardData()
        .finally(() => { inflightFetch = null; });
    }
    const dashboard = await inflightFetch;
    res.json(dashboard);
  } catch (error) {
    console.error('Dashboard API error:', error);
    // Stale-cache fallback: better than 502 during upstream outages
    if (cachedData) {
      return res.json({ ...cachedData, stale: true });
    }
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
});

// Force refresh endpoint (bypasses cache)
app.post('/api/dashboard/refresh', async (req, res) => {
  cachedData = null;
  lastFetchTime = null;
  res.json({ message: 'Cache cleared. Next request will fetch fresh data.' });
});

// ============================================================================
// FUNDAMENTAL REPORTS ENDPOINTS
// ============================================================================

// Cache for reports calendar
let reportsCache = null;
let reportsLastFetch = null;
const REPORTS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour (reports don't change frequently)

// Get all upcoming reports calendar
app.get('/api/reports/calendar', (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (reportsCache && reportsLastFetch && (now - reportsLastFetch) < REPORTS_CACHE_DURATION) {
      return res.json(reportsCache);
    }

    console.log('Building fresh reports calendar...');
    const calendar = buildReportsCalendar();

    // Cache the result
    reportsCache = calendar;
    reportsLastFetch = now;

    res.json(calendar);
  } catch (error) {
    console.error('Reports calendar error:', error);
    res.status(500).json({
      error: 'Failed to fetch reports calendar',
      message: error.message
    });
  }
});

// Get energy sector reports only
app.get('/api/reports/energy', (req, res) => {
  try {
    const reports = fetchEnergyReports();
    res.json({
      category: 'energy',
      reports,
      count: reports.length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Energy reports error:', error);
    res.status(500).json({
      error: 'Failed to fetch energy reports',
      message: error.message
    });
  }
});

// Get agriculture sector reports only
app.get('/api/reports/agriculture', (req, res) => {
  try {
    const reports = fetchAgricultureReports();
    res.json({
      category: 'agriculture',
      reports,
      count: reports.length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Agriculture reports error:', error);
    res.status(500).json({
      error: 'Failed to fetch agriculture reports',
      message: error.message
    });
  }
});

// Get Treasury auctions only
app.get('/api/reports/treasury', (req, res) => {
  try {
    const reports = fetchTreasuryAuctions();
    res.json({
      category: 'bonds',
      reports,
      count: reports.length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Treasury auctions error:', error);
    res.status(500).json({
      error: 'Failed to fetch Treasury auctions',
      message: error.message
    });
  }
});

// Get Central Bank meetings only
app.get('/api/reports/centralbanks', (req, res) => {
  try {
    const reports = fetchCentralBankCalendar();
    res.json({
      category: 'centralbank',
      reports,
      count: reports.length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Central Bank calendar error:', error);
    res.status(500).json({
      error: 'Failed to fetch Central Bank calendar',
      message: error.message
    });
  }
});

// ============================================================================
// WEATHER DATA ENDPOINTS
// ============================================================================

// Cache for weather data
let weatherCache = null;
let weatherLastFetch = null;
const WEATHER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Get comprehensive weather report
app.get('/api/weather', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (weatherCache && weatherLastFetch && (now - weatherLastFetch) < WEATHER_CACHE_DURATION) {
      return res.json(weatherCache);
    }

    console.log('Fetching fresh weather data...');
    const weatherReport = await buildWeatherReport();

    // Cache the result
    weatherCache = weatherReport;
    weatherLastFetch = now;

    res.json(weatherReport);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather data',
      message: error.message
    });
  }
});

// Get drought monitor data only
app.get('/api/weather/drought', async (req, res) => {
  try {
    const drought = await fetchDroughtMonitor();
    res.json(drought);
  } catch (error) {
    console.error('Drought API error:', error);
    res.status(500).json({
      error: 'Failed to fetch drought data',
      message: error.message
    });
  }
});

// Get 6-10 day outlook only
app.get('/api/weather/outlook', async (req, res) => {
  try {
    const outlook = await fetch610DayOutlook();
    res.json(outlook);
  } catch (error) {
    console.error('Outlook API error:', error);
    res.status(500).json({
      error: 'Failed to fetch outlook data',
      message: error.message
    });
  }
});

// ============================================================================
// ECONOMIC DATA ENDPOINTS (FRED API)
// ============================================================================

// Get comprehensive economic indicators (NFP, CPI, GDP, etc.)
app.get('/api/economic', async (req, res) => {
  try {
    console.log('Fetching comprehensive economic data from FRED...');
    const data = await fetchComprehensiveEconomicData(process.env.FRED_API_KEY);

    if (data.error) {
      return res.status(400).json({
        error: data.error,
        message: 'FRED API key required. Get free key at: https://fred.stlouisfed.org/docs/api/api_key.html'
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Economic data error:', error);
    res.status(500).json({
      error: 'Failed to fetch economic data',
      message: error.message
    });
  }
});

// Get specific economic indicator
app.get('/api/economic/:indicator', async (req, res) => {
  try {
    const { indicator } = req.params;
    const upperIndicator = indicator.toUpperCase();

    if (!FRED_SERIES[upperIndicator]) {
      return res.status(400).json({
        error: 'Invalid indicator',
        message: `Indicator ${indicator} not found`,
        availableIndicators: Object.keys(FRED_SERIES)
      });
    }

    const data = await fetchComprehensiveEconomicData(process.env.FRED_API_KEY);
    const indicatorData = data.indicators?.[upperIndicator];

    if (!indicatorData) {
      return res.status(404).json({
        error: 'Data not available',
        message: `No data found for ${indicator}`
      });
    }

    res.json(indicatorData);
  } catch (error) {
    console.error(`Economic indicator error for ${req.params.indicator}:`, error);
    res.status(500).json({
      error: 'Failed to fetch indicator data',
      message: error.message
    });
  }
});

// Get economic signals (trading implications)
app.get('/api/economic/signals', async (req, res) => {
  try {
    const data = await fetchComprehensiveEconomicData(process.env.FRED_API_KEY);

    if (data.error) {
      return res.json({ signals: [], message: 'Using default signals (API key needed for live data)' });
    }

    res.json({
      signals: data.signals || [],
      summary: data.summary,
      lastUpdated: data.lastUpdated
    });
  } catch (error) {
    console.error('Economic signals error:', error);
    res.status(500).json({
      error: 'Failed to fetch economic signals',
      message: error.message
    });
  }
});

// Get list of available economic indicators
app.get('/api/economic-indicators', (req, res) => {
  const indicators = getAvailableSeries();
  res.json({
    count: indicators.length,
    indicators: indicators,
    categories: [...new Set(indicators.map(i => i.category))]
  });
});

// ============================================================================
// ENHANCED INSTRUMENT ANALYSIS ENDPOINTS
// ============================================================================

// Cache for technical analysis (expensive operation)
let technicalCache = null;
let technicalLastFetch = null;
const TECHNICAL_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Get technical analysis for all main instruments
app.get('/api/technicals', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (technicalCache && technicalLastFetch && (now - technicalLastFetch) < TECHNICAL_CACHE_DURATION) {
      return res.json(technicalCache);
    }

    console.log('Calculating technical analysis for all instruments...');
    const technicals = await analyzeAllInstruments();

    // Cache the result
    technicalCache = {
      data: technicals,
      lastUpdate: new Date().toISOString()
    };
    technicalLastFetch = now;

    res.json(technicalCache);
  } catch (error) {
    console.error('Technical analysis error:', error);
    res.status(500).json({
      error: 'Failed to calculate technical analysis',
      message: error.message
    });
  }
});

// Get chart data (OHLC + EMAs) for an instrument
// Supports interval query param: 5m, 15m, 1h, 1d (default)
app.get('/api/chart/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1d' } = req.query;
    const upperSymbol = symbol.toUpperCase();

    console.log(`Fetching chart data for ${upperSymbol} (${interval})...`);
    const chartData = await getChartData(upperSymbol, interval);

    if (chartData.error) {
      return res.status(400).json({
        error: chartData.error,
        symbol: upperSymbol
      });
    }

    res.json(chartData);
  } catch (error) {
    console.error(`Chart data error for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to fetch chart data',
      message: error.message
    });
  }
});

// Get technical analysis for a specific instrument
app.get('/api/technicals/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const yahooSymbol = YAHOO_SYMBOLS[symbol.toUpperCase()];

    if (!yahooSymbol) {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: `Symbol ${symbol} not found`
      });
    }

    console.log(`Calculating technicals for ${symbol}...`);
    const technicals = await analyzeTechnicals(yahooSymbol);

    res.json({
      symbol: symbol.toUpperCase(),
      ...technicals,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Technical analysis error for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to calculate technical analysis',
      message: error.message
    });
  }
});

// Get comprehensive instrument summary (fundamentals + technicals)
app.get('/api/instrument/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();

    // Check if instrument is configured
    if (!INSTRUMENT_DRIVERS[upperSymbol]) {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: `Symbol ${symbol} not configured for analysis`
      });
    }

    // Get current price data from cache or fetch fresh
    let instrumentData = {};
    if (cachedData?.instruments?.[upperSymbol]) {
      instrumentData = cachedData.instruments[upperSymbol];
    } else if (cachedData?.currencies?.[upperSymbol]) {
      instrumentData = cachedData.currencies[upperSymbol];
    } else {
      // Fetch fresh data
      const futures = await fetchYahooFinanceFutures();
      instrumentData = futures[upperSymbol] || {};
    }

    // Get market context
    const marketContext = {
      vix: cachedData?.volatility?.level || 16,
      vixChange: cachedData?.volatility?.changePercent || 0,
      dxy: cachedData?.currencies?.DX?.price || 104,
      dxyChange: cachedData?.currencies?.DX?.changePercent || 0,
      zn: cachedData?.instruments?.ZN?.price || 108,
      znChange: cachedData?.instruments?.ZN?.changePercent || 0,
      marketBias: cachedData?.marketBias || { sentiment: 'Neutral' }
    };

    // Get technical analysis
    const yahooSymbol = YAHOO_SYMBOLS[upperSymbol];
    const technicals = yahooSymbol ? await analyzeTechnicals(yahooSymbol) : null;

    // Get recent reports that affect this instrument
    const reportsCalendar = buildReportsCalendar();
    const todayReports = reportsCalendar.calendar
      .filter(day => day.isToday || day.isTomorrow)
      .flatMap(day => day.reports)
      .filter(report => report.affectedInstruments?.includes(upperSymbol));

    // Generate comprehensive summary
    const summary = generateInstrumentSummary(
      upperSymbol,
      instrumentData,
      marketContext,
      technicals,
      todayReports
    );

    // Detect if instrument is trending
    const trending = detectTrending(instrumentData, technicals, todayReports.length > 0);

    res.json({
      ...summary,
      trending,
      upcomingReports: todayReports.slice(0, 3),
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Instrument summary error for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to generate instrument summary',
      message: error.message
    });
  }
});

// Get market drivers summary (what's moving markets today)
app.get('/api/market-drivers', async (req, res) => {
  try {
    // Ensure we have cached data
    if (!cachedData) {
      // Trigger a dashboard fetch
      const futures = await fetchYahooFinanceFutures();
      const currencies = await fetchCurrencyFutures();

      // Build minimal context
      const marketContext = {
        vix: futures?.VIX?.price || 16,
        vixChange: futures?.VIX?.changePercent || 0,
        dxy: currencies?.DX?.price || 104,
        dxyChange: currencies?.DX?.changePercent || 0,
        zn: futures?.ZN?.price || 108,
        znChange: futures?.ZN?.changePercent || 0,
        marketBias: { sentiment: 'Neutral' }
      };

      // Get today's reports
      const reportsCalendar = buildReportsCalendar();
      const todayReports = reportsCalendar.calendar
        .filter(day => day.isToday)
        .flatMap(day => day.reports);

      // Calculate trending for main instruments
      const mainSymbols = ['ES', 'NQ', 'CL', 'GC', 'ZN'];
      const trendingInstruments = [];

      for (const symbol of mainSymbols) {
        const data = futures[symbol] || {};
        const yahooSymbol = YAHOO_SYMBOLS[symbol];
        const technicals = yahooSymbol ? await analyzeTechnicals(yahooSymbol) : null;
        const hasCatalyst = todayReports.some(r => r.affectedInstruments?.includes(symbol));
        const trending = detectTrending(data, technicals, hasCatalyst);
        trendingInstruments.push({ symbol, ...trending });
      }

      const summary = generateMarketDriversSummary(marketContext, todayReports, trendingInstruments);

      return res.json({
        ...summary,
        lastUpdate: new Date().toISOString()
      });
    }

    // Use cached data
    const marketContext = {
      vix: cachedData?.volatility?.level || 16,
      vixChange: cachedData?.volatility?.changePercent || 0,
      dxy: cachedData?.currencies?.DX?.price || 104,
      dxyChange: cachedData?.currencies?.DX?.changePercent || 0,
      zn: cachedData?.instruments?.ZN?.price || 108,
      znChange: cachedData?.instruments?.ZN?.changePercent || 0,
      marketBias: cachedData?.marketBias || { sentiment: 'Neutral' }
    };

    // Get today's reports
    const reportsCalendar = buildReportsCalendar();
    const todayReports = reportsCalendar.calendar
      .filter(day => day.isToday)
      .flatMap(day => day.reports);

    // Calculate trending for main instruments
    const mainSymbols = ['ES', 'NQ', 'CL', 'GC', 'ZN', 'RTY', 'BTC'];
    const trendingInstruments = [];

    for (const symbol of mainSymbols) {
      const data = cachedData?.instruments?.[symbol] || cachedData?.currencies?.[symbol] || {};
      const hasCatalyst = todayReports.some(r => r.affectedInstruments?.includes(symbol));
      // Use cached technicals if available
      const technicals = technicalCache?.data?.[symbol] || null;
      const trending = detectTrending(data, technicals, hasCatalyst);
      trendingInstruments.push({ symbol, ...trending });
    }

    const summary = generateMarketDriversSummary(marketContext, todayReports, trendingInstruments);

    res.json({
      ...summary,
      todayReports: todayReports.slice(0, 5),
      trendingInstruments: trendingInstruments.filter(t => t.isTrending),
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Market drivers error:', error);
    res.status(500).json({
      error: 'Failed to generate market drivers summary',
      message: error.message
    });
  }
});

// Get all instrument summaries (for sidebar display)
app.get('/api/instruments/summaries', async (req, res) => {
  try {
    // Ensure we have cached data
    if (!cachedData) {
      return res.status(503).json({
        error: 'Data not ready',
        message: 'Dashboard data is still loading. Please try again.'
      });
    }

    const marketContext = {
      vix: cachedData?.volatility?.level || 16,
      vixChange: cachedData?.volatility?.changePercent || 0,
      dxy: cachedData?.currencies?.DX?.price || 104,
      dxyChange: cachedData?.currencies?.DX?.changePercent || 0,
      zn: cachedData?.instruments?.ZN?.price || 108,
      znChange: cachedData?.instruments?.ZN?.changePercent || 0,
      marketBias: cachedData?.marketBias || { sentiment: 'Neutral' }
    };

    const summaries = {};
    const allInstruments = {
      ...cachedData.instruments,
      ...cachedData.currencies
    };

    // Generate quick summaries for all instruments
    for (const [symbol, data] of Object.entries(allInstruments)) {
      if (INSTRUMENT_DRIVERS[symbol]) {
        const technicals = technicalCache?.data?.[symbol] || null;
        const summary = generateInstrumentSummary(symbol, data, marketContext, technicals, []);

        summaries[symbol] = {
          symbol,
          name: summary.name,
          category: summary.category,
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          status: summary.status,
          statusColor: summary.statusColor,
          shortSummary: summary.summary,
          trending: detectTrending(data, technicals, false)
        };
      }
    }

    res.json({
      summaries,
      count: Object.keys(summaries).length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Instrument summaries error:', error);
    res.status(500).json({
      error: 'Failed to generate instrument summaries',
      message: error.message
    });
  }
});

// ============================================================================
// NEWS ANALYSIS ENDPOINTS (Google Sheets + Claude AI)
// ============================================================================

// Get raw (unanalyzed) news headlines from Google Sheets
app.get('/api/news/raw', async (req, res) => {
  try {
    const news = await fetchGoogleSheetsNews();
    res.json({
      count: news.length,
      news,
      cache: getGoogleSheetsCacheStatus(),
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Raw news fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch raw news',
      message: error.message
    });
  }
});

// Get AI-analyzed news from ALL sources (Google Sheets + NewsAPI + Finnhub)
// Supports filters: symbol, source, lastHours
app.get('/api/news/analyzed', async (req, res) => {
  try {
    const { symbol, source, lastHours } = req.query;
    const news = await analyzeAllSourcesNews({
      symbol: symbol?.toUpperCase(),
      source,
      lastHours: lastHours ? parseInt(lastHours) : null
    });

    res.json({
      count: news.length,
      news,
      cache: getUnifiedAnalysisCacheStatus(),
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analyzed news fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch analyzed news',
      message: error.message
    });
  }
});

// Get only high impact news
app.get('/api/news/high-impact', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const news = await fetchHighImpactNews(parseInt(limit));

    res.json({
      count: news.length,
      news,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('High impact news fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch high impact news',
      message: error.message
    });
  }
});

// Force refresh - clear caches and re-analyze all news from all sources
app.post('/api/news/refresh', async (req, res) => {
  try {
    const news = await refreshUnifiedNewsAnalysis();

    res.json({
      success: true,
      count: news.length,
      message: 'All news caches cleared and re-analyzed',
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('News refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh news',
      message: error.message
    });
  }
});

// Get news analysis cache status
app.get('/api/news/status', (req, res) => {
  res.json({
    sheets: getGoogleSheetsCacheStatus(),
    analysis: getAnalysisCacheStatus(),
    unified: getUnifiedAnalysisCacheStatus(),
    lastUpdate: new Date().toISOString()
  });
});

// Get news sentiment summary (for final analysis)
app.get('/api/news/sentiment', async (req, res) => {
  try {
    const { lastHours = 1 } = req.query;
    const sentiment = await getNewsSentimentSummary({ lastHours: parseInt(lastHours) });

    res.json({
      ...sentiment,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('News sentiment error:', error);
    res.status(500).json({
      error: 'Failed to get news sentiment',
      message: error.message
    });
  }
});

// ============================================================================
// FINAL ANALYSIS ENDPOINT (Comprehensive Bias for 6 Instruments)
// ============================================================================

// Cache for market data (used by final analysis)
let marketDataCache = null;
let marketDataCacheTime = null;
const MARKET_DATA_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Get comprehensive final analysis with bias for ES, NQ, YM, RTY, GC, CL
app.get('/api/final-analysis', async (req, res) => {
  try {
    const now = Date.now();

    // Get market data (use cache if available, otherwise fetch)
    let marketData;
    if (marketDataCache && marketDataCacheTime && (now - marketDataCacheTime) < MARKET_DATA_CACHE_DURATION) {
      marketData = marketDataCache;
    } else {
      // Fetch fresh market data in parallel
      const [futuresResult, currencyResult, sectorResult, mag7Result] = await Promise.allSettled([
        fetchYahooFinanceFutures(),
        fetchCurrencyFutures(),
        fetchSectorETFs(),
        fetchMag7Stocks()
      ]);

      const futures = futuresResult.status === 'fulfilled' ? futuresResult.value : {};
      const currencies = currencyResult.status === 'fulfilled' ? currencyResult.value : {};
      const sectors = sectorResult.status === 'fulfilled' ? sectorResult.value : {};
      const mag7 = mag7Result.status === 'fulfilled' ? mag7Result.value : {};

      marketData = {
        vix: futures?.VIX?.price || 16,
        vixChange: futures?.VIX?.changePercent || 0,
        znChange: futures?.ZN?.changePercent || 0,
        dxyChange: currencies?.DX?.changePercent || 0,
        sectors,
        mag7
      };

      // Cache market data
      marketDataCache = marketData;
      marketDataCacheTime = now;
    }

    // Generate final analysis
    const analysis = await generateFinalAnalysis(marketData);

    // Optionally add AI synthesis
    const { withSynthesis } = req.query;
    if (withSynthesis === 'true') {
      analysis.aiSynthesis = await generateAISynthesis(analysis);
    }

    res.json(analysis);
  } catch (error) {
    console.error('Final analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate final analysis',
      message: error.message
    });
  }
});

// Force refresh final analysis
app.post('/api/final-analysis/refresh', async (req, res) => {
  try {
    // Clear all caches
    clearFinalAnalysisCache();
    marketDataCache = null;
    marketDataCacheTime = null;

    // Fetch fresh market data
    const [futuresResult, currencyResult, sectorResult, mag7Result] = await Promise.allSettled([
      fetchYahooFinanceFutures(),
      fetchCurrencyFutures(),
      fetchSectorETFs(),
      fetchMag7Stocks()
    ]);

    const futures = futuresResult.status === 'fulfilled' ? futuresResult.value : {};
    const currencies = currencyResult.status === 'fulfilled' ? currencyResult.value : {};
    const sectors = sectorResult.status === 'fulfilled' ? sectorResult.value : {};
    const mag7 = mag7Result.status === 'fulfilled' ? mag7Result.value : {};

    const marketData = {
      vix: futures?.VIX?.price || 16,
      vixChange: futures?.VIX?.changePercent || 0,
      znChange: futures?.ZN?.changePercent || 0,
      dxyChange: currencies?.DX?.changePercent || 0,
      sectors,
      mag7
    };

    // Cache market data
    marketDataCache = marketData;
    marketDataCacheTime = Date.now();

    // Generate fresh analysis
    const analysis = await generateFinalAnalysis(marketData, { forceRefresh: true });

    res.json({
      success: true,
      message: 'Final analysis refreshed',
      analysis
    });
  } catch (error) {
    console.error('Final analysis refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh final analysis',
      message: error.message
    });
  }
});

// Get final analysis cache status
app.get('/api/final-analysis/status', (req, res) => {
  res.json({
    analysis: getFinalAnalysisCacheStatus(),
    marketData: {
      isCached: !!marketDataCache,
      cacheAge: marketDataCacheTime ? Date.now() - marketDataCacheTime : null,
      maxAge: MARKET_DATA_CACHE_DURATION
    },
    lastUpdate: new Date().toISOString()
  });
});

// ============================================================================
// EARNINGS CALENDAR ENDPOINT
// ============================================================================

// Get today's earnings calendar
app.get('/api/earnings', async (req, res) => {
  try {
    const earnings = await fetchEarningsCalendar();

    res.json({
      count: earnings.length,
      earnings,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Earnings calendar error:', error);
    res.status(500).json({
      error: 'Failed to fetch earnings calendar',
      message: error.message
    });
  }
});

// ============================================================================
// REAL-TIME SCANNER ENDPOINTS (TradingView Webhooks)
// ============================================================================

// Receive webhook from TradingView (ICT, OrderFlow, Multi-Symbol) and NinjaTrader (orderflow)
app.post('/api/scanner/webhook', (req, res) => {
  try {
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({
        error: 'Empty payload',
        message: 'Webhook payload is empty'
      });
    }

    // Auth guard: NinjaTrader source must present the shared secret.
    // (Pine/TradingView sources remain unauthenticated for now; consider adding later.)
    // Accepts the new 'ninjatrader_signals' identifier plus the prior
    // 'ninjatrader_orderflow' string for back-compat with stale indicators.
    const ninjaType =
      payload.scanner_type === 'ninjatrader_signals' || payload.scannerType === 'ninjatrader_signals' ||
      payload.scanner_type === 'ninjatrader_orderflow' || payload.scannerType === 'ninjatrader_orderflow';
    if (ninjaType) {
      const expected = process.env.NINJA_SCANNER_SECRET;
      const provided = req.headers['x-ninja-secret'];
      if (!expected) {
        console.error('NINJA_SCANNER_SECRET env var not set on server; rejecting NinjaTrader payload');
        return res.status(503).json({ error: 'NinjaTrader webhook not configured on server' });
      }
      if (!provided || provided !== expected) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing x-ninja-secret header' });
      }
    }

    const result = processWebhook(payload);

    if (result.error) {
      return res.status(400).json(result);
    }

    // Handle different response types
    res.json({
      success: true,
      type: result.type,
      count: result.count || 1,
      data: result.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scanner webhook error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

// Get all scanner data (both ICT and Order Flow)
app.get('/api/scanner', (req, res) => {
  try {
    const data = getAllScannerData();
    res.json(data);
  } catch (error) {
    console.error('Scanner data error:', error);
    res.status(500).json({
      error: 'Failed to get scanner data',
      message: error.message
    });
  }
});

// Get scanner summary (with top opportunities)
app.get('/api/scanner/summary', (req, res) => {
  try {
    const summary = getScannerSummary();
    res.json(summary);
  } catch (error) {
    console.error('Scanner summary error:', error);
    res.status(500).json({
      error: 'Failed to get scanner summary',
      message: error.message
    });
  }
});

// Get ICT scanner data only
app.get('/api/scanner/ict', (req, res) => {
  try {
    const data = getICTScannerData();
    res.json({
      type: 'ict',
      count: Object.keys(data).length,
      lastUpdate: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('ICT scanner data error:', error);
    res.status(500).json({
      error: 'Failed to get ICT scanner data',
      message: error.message
    });
  }
});

// Get Order Flow scanner data only
app.get('/api/scanner/orderflow', (req, res) => {
  try {
    const data = getOrderFlowScannerData();
    res.json({
      type: 'orderflow',
      count: Object.keys(data).length,
      lastUpdate: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('Order Flow scanner data error:', error);
    res.status(500).json({
      error: 'Failed to get Order Flow scanner data',
      message: error.message
    });
  }
});

// Get NinjaTrader Signals scanner data (event + heartbeat stream from NT8)
// MUST be declared before the /:symbol catch-all below.
app.get('/api/scanner/ninjatrader', (req, res) => {
  try {
    const data = getNinjaSignalsData();
    res.json({
      type: 'ninjatrader_signals',
      count: Object.keys(data).length,
      lastUpdate: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('NinjaTrader scanner data error:', error);
    res.status(500).json({
      error: 'Failed to get NinjaTrader scanner data',
      message: error.message
    });
  }
});

// Get scanner data for specific symbol
app.get('/api/scanner/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const data = getScannerData(symbol);

    if (!data) {
      return res.status(404).json({
        error: 'Symbol not found',
        message: `No scanner data for ${symbol}. Make sure TradingView webhook is configured.`
      });
    }

    res.json(data);
  } catch (error) {
    console.error(`Scanner data error for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to get scanner data',
      message: error.message
    });
  }
});

// Clear scanner data (for testing)
app.delete('/api/scanner', (req, res) => {
  try {
    clearScannerData();
    res.json({ success: true, message: 'Scanner data cleared' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear scanner data',
      message: error.message
    });
  }
});

// ============================================================================
// SESSION TRACKING ENDPOINTS (Phase 1 - Session Engine)
// ============================================================================

// Get current session info (Asia/London/US/etc.)
app.get('/api/session/current', (req, res) => {
  try {
    const current = getCurrentSession();
    const next = getNextSession();
    res.json({
      current,
      next,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

// Get all session levels (for handoff between sessions)
app.get('/api/session/levels', (req, res) => {
  try {
    const handoff = getSessionHandoff();
    res.json(handoff);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session levels' });
  }
});

// Get session summary for a specific session (for AI analysis)
app.get('/api/session/summary/:session', (req, res) => {
  try {
    const summary = getSessionSummary(req.params.session.toUpperCase());
    res.json(summary || { error: 'Session not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session summary' });
  }
});

// Update session data (from TradingView webhook or other sources)
app.post('/api/session/update', (req, res) => {
  try {
    const { session, priceData } = req.body;
    updateSessionLevels(session, priceData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Get session-specific instruments (Phase 2)
app.get('/api/session/instruments/:session', async (req, res) => {
  try {
    const session = req.params.session.toLowerCase();
    let instruments;

    switch (session) {
      case 'asia':
        instruments = await fetchAsiaInstruments();
        break;
      case 'london':
        instruments = await fetchLondonInstruments();
        // Add Gold/Silver ratio if we have gold price
        if (cachedData?.instruments?.GC && cachedData?.instruments?.SI) {
          instruments.goldSilverRatio = getGoldSilverRatio(
            cachedData.instruments.GC.price,
            cachedData.instruments.SI.price
          );
        }
        break;
      case 'us':
        instruments = await fetchUSInstruments();
        break;
      default:
        return res.status(400).json({ error: 'Invalid session. Use: asia, london, or us' });
    }

    res.json({
      session,
      instruments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Session instruments error for ${req.params.session}:`, error);
    res.status(500).json({ error: 'Failed to fetch session instruments' });
  }
});

// Get all session instruments combined
app.get('/api/session/instruments', async (req, res) => {
  try {
    const [asia, london, us] = await Promise.allSettled([
      fetchAsiaInstruments(),
      fetchLondonInstruments(),
      fetchUSInstruments()
    ]);

    const result = {
      asia: asia.status === 'fulfilled' ? asia.value : {},
      london: london.status === 'fulfilled' ? london.value : {},
      us: us.status === 'fulfilled' ? us.value : {},
      timestamp: new Date().toISOString()
    };

    // Add Gold/Silver ratio
    if (cachedData?.instruments?.GC && cachedData?.instruments?.SI) {
      result.london.goldSilverRatio = getGoldSilverRatio(
        cachedData.instruments.GC.price,
        cachedData.instruments.SI.price
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Session instruments error:', error);
    res.status(500).json({ error: 'Failed to fetch session instruments' });
  }
});

// ============================================================================
// LEVEL CALCULATOR ENDPOINTS (Phase 3)
// ============================================================================

// Get levels with tick distance for a symbol
app.get('/api/levels/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Get current price from cache or fetch
    let currentPrice;
    if (cachedData?.instruments?.[symbol]) {
      currentPrice = cachedData.instruments[symbol].price;
    } else if (cachedData?.currencies?.[symbol]) {
      currentPrice = cachedData.currencies[symbol].price;
    } else {
      // Fetch fresh if not in cache
      const futures = await fetchYahooFinanceFutures();
      currentPrice = futures[symbol]?.price;
    }

    if (!currentPrice) {
      return res.status(404).json({ error: `Price not found for ${symbol}` });
    }

    // Get session levels
    const sessionData = getSessionHandoff();

    // Build levels object
    const levels = {
      'PDH': cachedData?.instruments?.[symbol]?.high || currentPrice * 1.005,
      'PDL': cachedData?.instruments?.[symbol]?.low || currentPrice * 0.995,
      'Asia High': sessionData.sessions.ASIA?.high,
      'Asia Low': sessionData.sessions.ASIA?.low,
      'Asia IB High': sessionData.initialBalances.ASIA?.high,
      'Asia IB Low': sessionData.initialBalances.ASIA?.low,
      'London High': sessionData.sessions.LONDON?.high,
      'London Low': sessionData.sessions.LONDON?.low,
      'London IB High': sessionData.initialBalances.LONDON?.high,
      'London IB Low': sessionData.initialBalances.LONDON?.low,
      'US IB High': sessionData.initialBalances.US_RTH?.high,
      'US IB Low': sessionData.initialBalances.US_RTH?.low
    };

    // Calculate pivots if we have PDH/PDL
    const pdh = levels['PDH'];
    const pdl = levels['PDL'];
    const prevClose = cachedData?.instruments?.[symbol]?.previousClose || currentPrice;

    if (pdh && pdl && prevClose) {
      const pivots = calculatePivots(pdh, pdl, prevClose);
      levels['Daily Pivot'] = pivots.pivot;
      levels['R1'] = pivots.r1;
      levels['R2'] = pivots.r2;
      levels['S1'] = pivots.s1;
      levels['S2'] = pivots.s2;
    }

    const result = getNearestLevels(symbol, currentPrice, levels);

    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Levels error for ${req.params.symbol}:`, error);
    res.status(500).json({ error: 'Failed to calculate levels' });
  }
});

// Get tick info for a symbol
app.get('/api/ticks/:symbol', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const tickSize = TICK_SIZES[symbol];
    const tickValue = TICK_VALUES[symbol];

    if (!tickSize) {
      return res.status(404).json({ error: `Tick info not found for ${symbol}` });
    }

    res.json({
      symbol,
      tickSize,
      tickValue,
      example: {
        onePoint: {
          ticks: Math.round(1 / tickSize),
          dollarValue: Math.round(1 / tickSize) * tickValue
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tick info' });
  }
});

// Calculate distance between two prices
app.get('/api/ticks/:symbol/distance', (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Missing from or to price' });
    }

    const fromPrice = parseFloat(from);
    const toPrice = parseFloat(to);

    const ticks = calculateTicks(symbol, fromPrice, toPrice);
    const dollarValue = calculateTickValue(symbol, Math.abs(ticks));

    res.json({
      symbol,
      from: fromPrice,
      to: toPrice,
      ticks: Math.abs(ticks),
      direction: ticks > 0 ? 'up' : ticks < 0 ? 'down' : 'flat',
      dollarValue,
      tickSize: TICK_SIZES[symbol] || 0.01,
      tickValue: TICK_VALUES[symbol] || 10.00
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate distance' });
  }
});

// ============================================================================
// SWEEP TRACKER ENDPOINTS (Phase 4)
// ============================================================================

// Receive sweep detection from TradingView webhook or manual entry
app.post('/api/sweeps/detect', (req, res) => {
  try {
    const sweeps = detectSweep(req.body);
    res.json({
      detected: sweeps.length,
      sweeps,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sweep detection error:', error);
    res.status(500).json({ error: 'Sweep detection failed' });
  }
});

// Add a manual sweep entry
app.post('/api/sweeps/add', (req, res) => {
  try {
    const sweep = addSweep(req.body);
    res.json({
      success: true,
      sweep,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add sweep' });
  }
});

// Get recent sweeps (optionally filtered by symbol)
app.get('/api/sweeps', (req, res) => {
  try {
    const { symbol, limit } = req.query;
    const sweeps = getRecentSweeps(symbol, limit ? parseInt(limit) : 20);
    res.json({
      count: sweeps.length,
      sweeps,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sweeps' });
  }
});

// Get sweeps for a specific symbol
app.get('/api/sweeps/:symbol', (req, res) => {
  try {
    const sweeps = getRecentSweeps(req.params.symbol, 20);
    res.json({
      symbol: req.params.symbol.toUpperCase(),
      count: sweeps.length,
      sweeps,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sweeps' });
  }
});

// Get sweep summary (for AI analysis)
app.get('/api/sweeps/summary/:symbol?', (req, res) => {
  try {
    const summary = getSweepSummary(req.params.symbol);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sweep summary' });
  }
});

// Get reclaimed levels (high probability reversal zones)
app.get('/api/sweeps/reclaimed/:symbol?', (req, res) => {
  try {
    const levels = getReclaimedLevels(req.params.symbol);
    res.json({
      count: levels.length,
      levels,
      description: 'Levels that were swept and reclaimed - potential reversal zones',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get reclaimed levels' });
  }
});

// Clear sweep history (for new day)
app.delete('/api/sweeps', (req, res) => {
  try {
    clearSweepHistory();
    res.json({ success: true, message: 'Sweep history cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear sweep history' });
  }
});

// ============================================================================
// AI AGENT ENDPOINTS (Phase 5)
// ============================================================================

// Run full AI analysis pipeline
app.get('/api/analysis/full', async (req, res) => {
  try {
    // Gather session info
    const session = {
      current: getCurrentSession(),
      next: getNextSession()
    };

    // Get news (use cached or fetch)
    let news = [];
    try {
      news = await analyzeAllSourcesNews({ lastHours: 2 });
    } catch (e) {
      console.warn('Could not fetch news for AI analysis:', e.message);
    }

    // Get levels
    const levels = getSessionHandoff();

    // Get sweeps
    const sweeps = getRecentSweeps(null, 10);

    // Get macro data
    const macro = {
      vix: cachedData?.instruments?.VIX?.price || 16,
      vixChange: cachedData?.instruments?.VIX?.changePercent || 0,
      dxy: cachedData?.currencies?.DX?.price || 104,
      dxyChange: cachedData?.currencies?.DX?.changePercent || 0,
      yield10y: cachedData?.treasuryYields?.['10Y']?.yield || 4.5,
      sectors: cachedData?.sectors || {},
      hyg: null,
      tlt: null
    };

    // Try to get HYG/TLT
    try {
      const usInstruments = await fetchUSInstruments();
      macro.hyg = usInstruments.HYG;
      macro.tlt = usInstruments.TLT;
    } catch (e) {
      console.warn('Could not fetch HYG/TLT:', e.message);
    }

    // Run full analysis
    const analysis = await runFullAnalysis({
      news,
      levels,
      sweeps,
      macro,
      session
    });

    res.json(analysis);
  } catch (error) {
    console.error('Full analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// Get quick session brief (lighter weight)
app.get('/api/analysis/brief', async (req, res) => {
  try {
    const session = {
      current: getCurrentSession(),
      next: getNextSession()
    };

    // Get recent news
    let news = [];
    try {
      news = await analyzeAllSourcesNews({ lastHours: 1 });
    } catch (e) {
      console.warn('Could not fetch news for brief:', e.message);
    }

    const brief = await getQuickSessionBrief(session, news);

    res.json({
      session: session.current.name,
      isIB: session.current.isIB,
      ibMinutesRemaining: session.current.ibMinutesRemaining,
      ...brief,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session brief error:', error);
    res.status(500).json({ error: 'Brief generation failed', message: error.message });
  }
});

// Get AI cache status
app.get('/api/analysis/cache', (req, res) => {
  try {
    const status = getAICacheStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache status' });
  }
});

// Clear AI cache
app.post('/api/analysis/cache/clear', (req, res) => {
  try {
    clearAICache();
    res.json({ success: true, message: 'AI cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// ============================================================================
// CHATBOT ENDPOINTS - Ask questions about the dashboard
// ============================================================================

// Main chat endpoint - FULL CONTEXT AWARE
// Chatbot now fetches ALL data itself: ES Command Center, Final Analysis,
// Reports (NFP, CPI, EIA), COT positioning, Put/Call, News, etc.
// Data is cached for 30 seconds for fast responses
app.post('/api/chat', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: 'Missing question',
        message: 'Please provide a question in the request body'
      });
    }

    // Smart answer - chatbot fetches ALL data internally (cached 30 sec)
    // Knows about: reports, COT, news, drivers, correlations, everything
    const response = await answerQuestionSmart(question);

    // Ensure 'answer' field always exists for frontend compatibility
    // getMarketBrief returns 'brief' instead of 'answer'
    if (!response.answer && response.brief) {
      response.answer = response.brief;
    }
    if (!response.answer) {
      response.answer = response.message || response.error || 'No response generated. Please try again.';
    }

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Chat failed',
      message: error.message,
      answer: 'Something went wrong on the server. Please try again in a moment.'
    });
  }
});

// Direct market brief endpoint - comprehensive analysis
app.get('/api/chat/brief', async (req, res) => {
  try {
    const brief = await getMarketBrief();
    res.json(brief);
  } catch (error) {
    console.error('Market brief error:', error);
    res.status(500).json({
      error: 'Brief failed',
      message: error.message
    });
  }
});

// Explain a specific headline's sentiment
app.post('/api/chat/headline', async (req, res) => {
  try {
    const { headline, sentiment } = req.body;

    if (!headline) {
      return res.status(400).json({
        error: 'Missing headline',
        message: 'Please provide a headline to explain'
      });
    }

    const response = await explainHeadline(headline, sentiment || 'unknown');
    res.json(response);
  } catch (error) {
    console.error('Headline explanation error:', error);
    res.status(500).json({
      error: 'Explanation failed',
      message: error.message
    });
  }
});

// Explain why an instrument has a specific bias
app.post('/api/chat/instrument', async (req, res) => {
  try {
    const { symbol, instrumentData } = req.body;

    if (!symbol) {
      return res.status(400).json({
        error: 'Missing symbol',
        message: 'Please provide a symbol to explain'
      });
    }

    // Use cached data only - don't fetch fresh (too slow)
    const data = instrumentData || cachedData?.instruments?.[symbol.toUpperCase()] || {};

    const response = await explainInstrumentBias(symbol, data, cachedData || {});
    res.json(response);
  } catch (error) {
    console.error('Instrument explanation error:', error);
    res.status(500).json({
      error: 'Explanation failed',
      message: error.message
    });
  }
});

// ============================================================================
// ES COMMAND CENTER ENDPOINTS - Everything driving ES right now
// ============================================================================

// ES Command Center — Real-time drivers and institutional context
app.get('/api/es/live', async (req, res) => {
  try {
    const data = await getESCommandCenter();
    res.json(data);
  } catch (error) {
    console.error('ES Command Center error:', error);
    res.status(500).json({
      error: 'Failed to get ES data',
      message: error.message
    });
  }
});

// ES Bias Breakdown — Scoring transparency for modal
app.get('/api/es/bias-breakdown', async (req, res) => {
  try {
    const breakdown = await getBiasBreakdown();
    res.json(breakdown);
  } catch (error) {
    console.error('ES Bias Breakdown error:', error);
    res.status(500).json({
      error: 'Failed to get bias breakdown',
      message: error.message
    });
  }
});

// ============================================================================
// WARWATCH ENDPOINTS — Geopolitical Conflict Intelligence
// ============================================================================

// Cache for WarWatch (handled internally by service, but we add polling support here)
let warWatchPollingClients = [];

// Get full WarWatch report (news, zones, risk, alerts)
app.get('/api/warwatch', async (req, res) => {
  try {
    console.log('Fetching WarWatch conflict intelligence...');
    const data = await fetchWarWatchData();
    res.json(data);
  } catch (error) {
    console.error('WarWatch error:', error);
    res.status(500).json({
      error: 'Failed to fetch WarWatch data',
      message: error.message
    });
  }
});

// Get geopolitical risk summary only (lightweight, for dashboard cards)
app.get('/api/warwatch/risk', async (req, res) => {
  try {
    const summary = await getRiskSummary();
    res.json(summary);
  } catch (error) {
    console.error('WarWatch risk summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch risk summary',
      message: error.message
    });
  }
});

// Get breaking alerts (supports ?since=ISO_DATE for polling)
app.get('/api/warwatch/alerts', (req, res) => {
  try {
    const since = req.query.since || null;
    const alerts = getBreakingAlerts(since);
    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('WarWatch alerts error:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      message: error.message
    });
  }
});

// Get specific conflict zone details
app.get('/api/warwatch/zone/:zoneId', async (req, res) => {
  try {
    const zone = await getConflictZone(req.params.zoneId);
    if (zone.error) {
      return res.status(404).json(zone);
    }
    res.json(zone);
  } catch (error) {
    console.error('WarWatch zone error:', error);
    res.status(500).json({
      error: 'Failed to fetch conflict zone',
      message: error.message
    });
  }
});

// Get news filtered by region (e.g., /api/warwatch/region/middle%20east)
app.get('/api/warwatch/region/:region', async (req, res) => {
  try {
    const data = await getNewsByRegion(req.params.region);
    res.json(data);
  } catch (error) {
    console.error('WarWatch region error:', error);
    res.status(500).json({
      error: 'Failed to fetch region data',
      message: error.message
    });
  }
});

// SSE (Server-Sent Events) endpoint for live updates — frontend can subscribe
app.get('/api/warwatch/stream', (req, res) => {
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Add client to polling list
  const clientId = Date.now();
  warWatchPollingClients.push({ id: clientId, res });

  console.log(`WarWatch SSE client connected: ${clientId} (total: ${warWatchPollingClients.length})`);

  // Remove client on disconnect
  req.on('close', () => {
    warWatchPollingClients = warWatchPollingClients.filter(c => c.id !== clientId);
    console.log(`WarWatch SSE client disconnected: ${clientId} (total: ${warWatchPollingClients.length})`);
  });
});

// Force refresh WarWatch data
app.post('/api/warwatch/refresh', (req, res) => {
  clearWarWatchCache();
  res.json({ message: 'WarWatch cache cleared. Next request will fetch fresh data.' });
});

// Get WarWatch cache status
app.get('/api/warwatch/status', (req, res) => {
  const status = getWarWatchCacheStatus();
  res.json({
    ...status,
    sseClients: warWatchPollingClients.length
  });
});

// ============================================================================
// WARWATCH AI ANALYSIS ENDPOINTS
// ============================================================================

// Full AI-powered war analysis (instruments, technicals, bias, AI brief)
app.get('/api/warwatch/analysis', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    console.log('Generating WarWatch AI analysis...');
    const analysis = await generateWarWatchAnalysis({ forceRefresh });
    res.json(analysis);
  } catch (error) {
    console.error('WarWatch analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate WarWatch analysis',
      message: error.message
    });
  }
});

// Top 5 most affected instruments only (lightweight)
app.get('/api/warwatch/top5', async (req, res) => {
  try {
    const top5 = await getTop5Affected();
    res.json({
      instruments: top5,
      count: top5.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('WarWatch top5 error:', error);
    res.status(500).json({
      error: 'Failed to get top 5 affected instruments',
      message: error.message
    });
  }
});

// Force refresh analysis
app.post('/api/warwatch/analysis/refresh', (req, res) => {
  clearWarAnalysisCache();
  clearWarWatchCache();
  res.json({ message: 'WarWatch analysis and data cache cleared.' });
});

// WarWatch SSE broadcast interval — push updates to all connected clients every 3 minutes
setInterval(async () => {
  if (warWatchPollingClients.length === 0) return;

  try {
    const data = await fetchWarWatchData();

    // Only broadcast if there are new breaking alerts
    if (data.newAlerts && data.newAlerts.length > 0) {
      const payload = JSON.stringify({
        type: 'breaking',
        alerts: data.newAlerts,
        riskSummary: data.riskSummary,
        timestamp: new Date().toISOString()
      });

      warWatchPollingClients.forEach(client => {
        client.res.write(`data: ${payload}\n\n`);
      });

      console.log(`WarWatch: Broadcast ${data.newAlerts.length} alerts to ${warWatchPollingClients.length} clients`);
    }

    // Send heartbeat with risk level every cycle
    const heartbeat = JSON.stringify({
      type: 'heartbeat',
      overallRisk: data.riskSummary.overallRisk,
      breakingCount: data.riskSummary.breakingAlerts,
      timestamp: new Date().toISOString()
    });

    warWatchPollingClients.forEach(client => {
      client.res.write(`data: ${heartbeat}\n\n`);
    });

  } catch (error) {
    console.error('WarWatch broadcast error:', error.message);
  }
}, 3 * 60 * 1000); // Every 3 minutes

// ---- Dashboard pre-warm scheduler ----
// Refreshes the dashboard cache every 4 minutes (just under the 5-min TTL) so users
// never trigger a cold-start. Reuses the same inflightFetch guard as the route
// handler, so a real user request during a scheduled refresh awaits the in-flight
// promise instead of launching a second parallel fan-out (which caused OOM crashes).
const DASHBOARD_REFRESH_INTERVAL = 4 * 60 * 1000;
let dashboardRefreshTimer = null;

async function prewarmDashboard(label) {
  if (inflightFetch) {
    console.log(`[prewarm:${label}] skip - fetch already in flight`);
    return;
  }
  inflightFetch = refreshDashboardData()
    .then(() => console.log(`[prewarm:${label}] ok`))
    .catch(err => console.error(`[prewarm:${label}] failed:`, err.message))
    .finally(() => { inflightFetch = null; });
  await inflightFetch;
}

// Kick off initial fetch on boot so the first user never sees the cold-start delay
prewarmDashboard('boot').catch(() => {});

dashboardRefreshTimer = setInterval(
  () => { prewarmDashboard('interval').catch(() => {}); },
  DASHBOARD_REFRESH_INTERVAL
);

// ============================================================================
// SESSION BRIEF BACKGROUND PRE-WARM (Fix 2)
// ============================================================================
// Mirrors the dashboard pre-warm above. Without it, the first user after
// each 5-min cache expiry triggers a cold Claude call and sees the "AI
// analysis loading..." placeholder for several seconds (or forever if the
// LLM call fails). Pre-warming every 4 min keeps the cache fresh AND
// surfaces credit/network failures here in the logs before they reach a
// real user.
const BRIEF_REFRESH_INTERVAL = 4 * 60 * 1000;
let briefRefreshTimer = null;

async function runBriefPrewarm(label) {
  return prewarmSessionBrief({
    label,
    getSession: () => Promise.resolve({
      current: getCurrentSession(),
      next: getNextSession(),
    }),
    getNews: () => analyzeAllSourcesNews({ lastHours: 1 }),
  }).catch(err => {
    // prewarmSessionBrief already logs - swallow here so the interval never throws.
    console.error(`[brief-prewarm:${label}] unexpected:`, err.message);
    return null;
  });
}

// Kick off initial fetch on boot
runBriefPrewarm('boot').catch(() => {});

briefRefreshTimer = setInterval(
  () => { runBriefPrewarm('interval').catch(() => {}); },
  BRIEF_REFRESH_INTERVAL
);

// Diagnostic endpoint: lets ops see whether the session brief is currently
// AI-generated or fallback-rendered without opening the UI.
app.get('/api/analysis/brief/status', (_req, res) => {
  try {
    res.json(getSessionBriefStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clean shutdown so Render doesn't get stray timers during deploys
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  if (dashboardRefreshTimer) clearInterval(dashboardRefreshTimer);
  if (briefRefreshTimer) clearInterval(briefRefreshTimer);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

app.listen(PORT, () => {
  console.log(`Jinah Dashboard API running on port ${PORT}`);
  console.log(`Dashboard endpoint: http://localhost:${PORT}/api/dashboard`);
  console.log(`Final Analysis: http://localhost:${PORT}/api/final-analysis`);
  console.log(`News Analysis (All Sources): http://localhost:${PORT}/api/news/analyzed`);
  console.log(`High Impact News: http://localhost:${PORT}/api/news/high-impact`);
  console.log(`Earnings Calendar: http://localhost:${PORT}/api/earnings`);
  console.log(`Scanner webhook: http://localhost:${PORT}/api/scanner/webhook`);
  console.log(`Session Info: http://localhost:${PORT}/api/session/current`);
  console.log(`Chatbot: http://localhost:${PORT}/api/chat`);
  console.log(`ES Command Center: http://localhost:${PORT}/api/es/live`);
  console.log(`WarWatch: http://localhost:${PORT}/api/warwatch`);
  console.log(`WarWatch Alerts: http://localhost:${PORT}/api/warwatch/alerts`);
  console.log(`WarWatch Live Stream: http://localhost:${PORT}/api/warwatch/stream`);
  console.log(`WarWatch AI Analysis: http://localhost:${PORT}/api/warwatch/analysis`);
});
