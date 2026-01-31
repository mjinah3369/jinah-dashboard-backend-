import express from 'express';
import cors from 'cors';
import { fetchYahooFinanceFutures, fetchCurrencyFutures, fetchInternationalIndices, fetchSectorETFs, fetchMag7Stocks, fetchTreasuryYields, fetchCryptoPrices, calculateExpectationMeters } from './services/yahooFinance.js';
import { fetchEconomicCalendar } from './services/alphaVantage.js';
import { fetchFredData } from './services/fred.js';
import { fetchPolygonData } from './services/polygon.js';
import { fetchFinnhubNews, fetchMag7News } from './services/finnhubNews.js';
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
      newsData,
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
    const news = newsData.status === 'fulfilled' ? newsData.value : [];
    const sectors = sectorData.status === 'fulfilled' ? sectorData.value : {};
    const mag7 = mag7Data.status === 'fulfilled' ? mag7Data.value : {};
    const mag7News = mag7NewsData.status === 'fulfilled' ? mag7NewsData.value : {};
    const treasuryYields = treasuryYieldsData.status === 'fulfilled' ? treasuryYieldsData.value : {};
    const crypto = cryptoData.status === 'fulfilled' ? cryptoData.value : {};

    // Calculate expectation meters
    const expectationMeters = calculateExpectationMeters(futures, currencies, news);

    // Log any errors
    const sources = ['Yahoo Finance', 'Alpha Vantage', 'FRED', 'Polygon', 'Currency', 'International', 'Finnhub News', 'Sectors', 'Mag7 Stocks', 'Mag7 News', 'Treasury Yields', 'Crypto'];
    [futuresData, economicData, fredData, polygonData, currencyData, internationalData, newsData, sectorData, mag7Data, mag7NewsData, treasuryYieldsData, cryptoData].forEach((result, i) => {
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

app.listen(PORT, () => {
  console.log(`Jinah Dashboard API running on port ${PORT}`);
  console.log(`Dashboard endpoint: http://localhost:${PORT}/api/dashboard`);
});
