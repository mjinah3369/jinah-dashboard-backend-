import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fetchYahooFinanceFutures, fetchCurrencyFutures, fetchInternationalIndices, fetchSectorETFs, fetchMag7Stocks, fetchTreasuryYields, fetchCryptoPrices, calculateExpectationMeters } from './services/yahooFinance.js';
import { fetchEconomicCalendar } from './services/alphaVantage.js';
import { fetchFredData } from './services/fred.js';
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
  fetchGoogleSheetsNews,
  clearGoogleSheetsCache,
  getGoogleSheetsCacheStatus
} from './services/googleSheets.js';
import {
  fetchAnalyzedNews,
  fetchHighImpactNews,
  refreshNewsAnalysis,
  getAnalysisCacheStatus
} from './services/newsAnalysis.js';

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

    // Merge news from Finnhub and NewsAPI, prioritizing by timestamp
    // Remove duplicates based on headline similarity
    const seenHeadlines = new Set();
    const allNews = [...finnhubNews, ...newsApiNews]
      .filter(item => {
        // Simple deduplication based on headline
        const normalizedHeadline = (item.headline || item.title || '').toLowerCase().slice(0, 50);
        if (seenHeadlines.has(normalizedHeadline)) return false;
        seenHeadlines.add(normalizedHeadline);
        return true;
      })
      .sort((a, b) => {
        // Sort by timestamp, most recent first
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 20); // Limit to 20 news items

    const news = allNews;
    console.log(`Merged news: ${finnhubNews.length} from Finnhub + ${newsApiNews.length} from NewsAPI = ${news.length} total`);

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

// Get AI-analyzed news (with optional symbol filter)
app.get('/api/news/analyzed', async (req, res) => {
  try {
    const { symbol } = req.query;
    const news = await fetchAnalyzedNews({ symbol: symbol?.toUpperCase() });

    res.json({
      count: news.length,
      news,
      cache: getAnalysisCacheStatus(),
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

// Force refresh - clear caches and re-analyze all news
app.post('/api/news/refresh', async (req, res) => {
  try {
    const news = await refreshNewsAnalysis();

    res.json({
      success: true,
      count: news.length,
      message: 'News cache cleared and re-analyzed',
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
    lastUpdate: new Date().toISOString()
  });
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

app.listen(PORT, () => {
  console.log(`Jinah Dashboard API running on port ${PORT}`);
  console.log(`Dashboard endpoint: http://localhost:${PORT}/api/dashboard`);
  console.log(`News Analysis: http://localhost:${PORT}/api/news/analyzed`);
  console.log(`High Impact News: http://localhost:${PORT}/api/news/high-impact`);
  console.log(`Scanner webhook: http://localhost:${PORT}/api/scanner/webhook`);
  console.log(`ICT Scanner: http://localhost:${PORT}/api/scanner/ict`);
  console.log(`Order Flow Scanner: http://localhost:${PORT}/api/scanner/orderflow`);
});
