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
  clearCache as clearAICache,
  getCacheStatus as getAICacheStatus
} from './services/aiAgents.js';
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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (cachedData && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('Returning cached data');
      return res.json(cachedData);
    }

    console.log('Fetching fresh data from APIs...');

    // Fetch data from all sources in parallel
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

    // Extract results (use empty defaults if failed)
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

    // Fetch Claude AI analyzed news from all sources (Google Sheets, NewsAPI, Finnhub)
    // This provides bias, relevance, and sentiment for each headline
    let analyzedNews = [];
    try {
      analyzedNews = await analyzeAllSourcesNews({ lastHours: 2 });
      console.log(`Analyzed news: ${analyzedNews.length} items with Claude AI analysis`);
    } catch (err) {
      console.warn('Could not fetch analyzed news, using raw news:', err.message);
    }

    // Merge raw news as fallback (for display in news feed)
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

    // Use analyzed news if available, otherwise fall back to raw news
    const news = analyzedNews.length > 0 ? analyzedNews : allNews;
    console.log(`Using ${analyzedNews.length > 0 ? 'analyzed' : 'raw'} news: ${news.length} items`);

    // Calculate expectation meters
    const expectationMeters = calculateExpectationMeters(futures, currencies, news);

    // Log any errors
    const sources = ['Yahoo Finance', 'Alpha Vantage', 'FRED', 'Polygon', 'Currency', 'International', 'Finnhub News', 'NewsAPI', 'Sectors', 'Mag7 Stocks', 'Mag7 News', 'Treasury Yields', 'Crypto'];
    [futuresData, economicData, fredData, polygonData, currencyData, internationalData, finnhubNewsData, newsApiData, sectorData, mag7Data, mag7NewsData, treasuryYieldsData, cryptoData].forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`${sources[i]} error:`, result.reason?.message || result.reason);
      }
    });

    // Build the dashboard response
    const dashboard = buildDashboardResponse(futures, economic, fred, polygon, currencies, international, news, sectors, mag7, mag7News, treasuryYields, crypto, expectationMeters);

    // Cache the result
    cachedData = dashboard;
    lastFetchTime = now;

    res.json(dashboard);
  } catch (error) {
    console.error('Dashboard API error:', error);
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

// Receive webhook from TradingView (supports ICT, OrderFlow, and Multi-Symbol)
app.post('/api/scanner/webhook', (req, res) => {
  try {
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({
        error: 'Empty payload',
        message: 'Webhook payload is empty'
      });
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

app.listen(PORT, () => {
  console.log(`Jinah Dashboard API running on port ${PORT}`);
  console.log(`Dashboard endpoint: http://localhost:${PORT}/api/dashboard`);
  console.log(`Final Analysis: http://localhost:${PORT}/api/final-analysis`);
  console.log(`News Analysis (All Sources): http://localhost:${PORT}/api/news/analyzed`);
  console.log(`High Impact News: http://localhost:${PORT}/api/news/high-impact`);
  console.log(`Earnings Calendar: http://localhost:${PORT}/api/earnings`);
  console.log(`Scanner webhook: http://localhost:${PORT}/api/scanner/webhook`);
  console.log(`Session Info: http://localhost:${PORT}/api/session/current`);
});
