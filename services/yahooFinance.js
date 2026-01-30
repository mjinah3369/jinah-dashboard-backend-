// Yahoo Finance - Futures Prices (No API key needed)
// Uses the unofficial Yahoo Finance API with fallback data

const FUTURES_SYMBOLS = {
  'ES=F': { name: 'S&P 500 E-mini', symbol: 'ES' },
  'NQ=F': { name: 'Nasdaq 100 E-mini', symbol: 'NQ' },
  'YM=F': { name: 'Dow Jones E-mini', symbol: 'YM' },
  'RTY=F': { name: 'Russell 2000 E-mini', symbol: 'RTY' },
  'CL=F': { name: 'Crude Oil', symbol: 'CL' },
  'GC=F': { name: 'Gold', symbol: 'GC' },
  'ZN=F': { name: '10-Year T-Note', symbol: 'ZN' },
  '^VIX': { name: 'VIX', symbol: 'VIX' }
};

// Currency Futures Symbols
const CURRENCY_SYMBOLS = {
  'DX-Y.NYB': { name: 'US Dollar Index', symbol: 'DX' },
  '6E=F': { name: 'Euro FX', symbol: '6E' },
  '6J=F': { name: 'Japanese Yen', symbol: '6J' },
  '6B=F': { name: 'British Pound', symbol: '6B' },
  '6A=F': { name: 'Australian Dollar', symbol: '6A' }
};

// International Indices Symbols
const INTERNATIONAL_SYMBOLS = {
  '^N225': { name: 'Nikkei 225', symbol: 'N225', timezone: 'Asia/Tokyo', marketHours: { open: 9, close: 15 } },
  '^GDAXI': { name: 'German DAX', symbol: 'DAX', timezone: 'Europe/Berlin', marketHours: { open: 9, close: 17.5 } },
  '^STOXX50E': { name: 'Euro Stoxx 50', symbol: 'STOXX', timezone: 'Europe/Paris', marketHours: { open: 9, close: 17.5 } },
  '^FTSE': { name: 'UK FTSE 100', symbol: 'FTSE', timezone: 'Europe/London', marketHours: { open: 8, close: 16.5 } }
};

// Sector ETF Symbols
const SECTOR_SYMBOLS = {
  'XLK': { name: 'Technology', symbol: 'XLK' },
  'XLF': { name: 'Financials', symbol: 'XLF' },
  'XLE': { name: 'Energy', symbol: 'XLE' },
  'XLY': { name: 'Consumer Discretionary', symbol: 'XLY' },
  'XLP': { name: 'Consumer Staples', symbol: 'XLP' },
  'XLV': { name: 'Healthcare', symbol: 'XLV' },
  'XLU': { name: 'Utilities', symbol: 'XLU' }
};

export async function fetchYahooFinanceFutures() {
  const symbols = Object.keys(FUTURES_SYMBOLS).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      console.error(`Yahoo Finance API returned status: ${response.status}`);
      return getFallbackData();
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    if (quotes.length === 0) {
      console.warn('Yahoo Finance returned no quotes, using fallback data');
      return getFallbackData();
    }

    const result = {};

    quotes.forEach(quote => {
      const config = FUTURES_SYMBOLS[quote.symbol];
      if (config) {
        const price = quote.regularMarketPrice || 0;
        const change = quote.regularMarketChange || 0;
        const changePercent = quote.regularMarketChangePercent || 0;
        const prevClose = quote.regularMarketPreviousClose || price;

        result[config.symbol] = {
          name: config.name,
          price: price,
          change: change,
          changePercent: changePercent,
          previousClose: prevClose,
          high: quote.regularMarketDayHigh || price,
          low: quote.regularMarketDayLow || price,
          volume: quote.regularMarketVolume || 0,
          marketState: quote.marketState || 'REGULAR'
        };
      }
    });

    // If we got some data but not all, fill in missing with fallback
    const fallback = getFallbackData();
    Object.keys(fallback).forEach(symbol => {
      if (!result[symbol]) {
        result[symbol] = fallback[symbol];
      }
    });

    console.log(`Yahoo Finance: fetched ${Object.keys(result).length} instruments`);
    return result;

  } catch (error) {
    console.error('Yahoo Finance fetch error:', error.message);
    console.log('Using fallback data instead');
    return getFallbackData();
  }
}

// Fallback data when Yahoo Finance is unavailable
function getFallbackData() {
  // Generate realistic-looking data based on typical market values
  const baseData = {
    'ES': { name: 'S&P 500 E-mini', basePrice: 6050, volatility: 0.8 },
    'NQ': { name: 'Nasdaq 100 E-mini', basePrice: 21500, volatility: 1.2 },
    'YM': { name: 'Dow Jones E-mini', basePrice: 44200, volatility: 0.6 },
    'RTY': { name: 'Russell 2000 E-mini', basePrice: 2280, volatility: 1.0 },
    'CL': { name: 'Crude Oil', basePrice: 73.50, volatility: 1.5 },
    'GC': { name: 'Gold', basePrice: 2760, volatility: 0.5 },
    'ZN': { name: '10-Year T-Note', basePrice: 108.50, volatility: 0.3 },
    'VIX': { name: 'VIX', basePrice: 16.5, volatility: 5.0 }
  };

  const result = {};

  Object.entries(baseData).forEach(([symbol, config]) => {
    // Add some randomness to make it look realistic
    const randomFactor = (Math.random() - 0.5) * 2 * config.volatility;
    const changePercent = randomFactor;
    const change = config.basePrice * (changePercent / 100);
    const price = config.basePrice + change;

    result[symbol] = {
      name: config.name,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      previousClose: config.basePrice,
      high: parseFloat((price * 1.005).toFixed(2)),
      low: parseFloat((price * 0.995).toFixed(2)),
      volume: Math.floor(Math.random() * 500000) + 100000,
      marketState: 'REGULAR',
      isFallback: true
    };
  });

  return result;
}

// Determine bias based on price action and change
export function calculateBias(instrument, vixLevel) {
  const { changePercent } = instrument;

  // Higher VIX = more likely bearish bias
  const vixAdjustment = vixLevel > 20 ? -0.5 : vixLevel > 15 ? -0.25 : 0;
  const adjustedChange = changePercent + vixAdjustment;

  if (adjustedChange > 0.5) return 'Bullish';
  if (adjustedChange < -0.5) return 'Bearish';
  if (Math.abs(adjustedChange) <= 0.25) return 'Neutral';
  return 'Mixed';
}

// Fetch Currency Futures
export async function fetchCurrencyFutures() {
  const symbols = Object.keys(CURRENCY_SYMBOLS).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Currency API returned status: ${response.status}`);
      return getCurrencyFallbackData();
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    if (quotes.length === 0) {
      console.warn('Yahoo Finance returned no currency quotes, using fallback data');
      return getCurrencyFallbackData();
    }

    const result = {};

    quotes.forEach(quote => {
      const config = CURRENCY_SYMBOLS[quote.symbol];
      if (config) {
        result[config.symbol] = {
          name: config.name,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          previousClose: quote.regularMarketPreviousClose || 0,
          high: quote.regularMarketDayHigh || 0,
          low: quote.regularMarketDayLow || 0,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
          marketState: quote.marketState || 'REGULAR'
        };
      }
    });

    // Fill in missing with fallback
    const fallback = getCurrencyFallbackData();
    Object.keys(fallback).forEach(symbol => {
      if (!result[symbol]) {
        result[symbol] = fallback[symbol];
      }
    });

    console.log(`Currency Futures: fetched ${Object.keys(result).length} currencies`);
    return result;

  } catch (error) {
    console.error('Currency fetch error:', error.message);
    return getCurrencyFallbackData();
  }
}

function getCurrencyFallbackData() {
  const baseData = {
    'DX': { name: 'US Dollar Index', basePrice: 104.50, volatility: 0.3 },
    '6E': { name: 'Euro FX', basePrice: 1.0850, volatility: 0.4 },
    '6J': { name: 'Japanese Yen', basePrice: 0.0067, volatility: 0.5 },
    '6B': { name: 'British Pound', basePrice: 1.2650, volatility: 0.4 },
    '6A': { name: 'Australian Dollar', basePrice: 0.6550, volatility: 0.5 }
  };

  const result = {};
  Object.entries(baseData).forEach(([symbol, config]) => {
    const randomFactor = (Math.random() - 0.5) * 2 * config.volatility;
    const changePercent = randomFactor;
    const change = config.basePrice * (changePercent / 100);
    const price = config.basePrice + change;

    result[symbol] = {
      name: config.name,
      price: parseFloat(price.toFixed(symbol === 'DX' ? 2 : 4)),
      change: parseFloat(change.toFixed(symbol === 'DX' ? 2 : 4)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      previousClose: config.basePrice,
      high: parseFloat((price * 1.002).toFixed(symbol === 'DX' ? 2 : 4)),
      low: parseFloat((price * 0.998).toFixed(symbol === 'DX' ? 2 : 4)),
      fiftyTwoWeekHigh: parseFloat((config.basePrice * 1.08).toFixed(symbol === 'DX' ? 2 : 4)),
      fiftyTwoWeekLow: parseFloat((config.basePrice * 0.92).toFixed(symbol === 'DX' ? 2 : 4)),
      marketState: 'REGULAR',
      isFallback: true
    };
  });

  return result;
}

// Fetch International Indices
export async function fetchInternationalIndices() {
  const symbols = Object.keys(INTERNATIONAL_SYMBOLS).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`International indices API returned status: ${response.status}`);
      return getInternationalFallbackData();
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    if (quotes.length === 0) {
      console.warn('Yahoo Finance returned no international quotes, using fallback data');
      return getInternationalFallbackData();
    }

    const result = {};

    quotes.forEach(quote => {
      const config = INTERNATIONAL_SYMBOLS[quote.symbol];
      if (config) {
        const sessionStatus = getSessionStatus(config.timezone, config.marketHours);
        result[config.symbol] = {
          name: config.name,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          previousClose: quote.regularMarketPreviousClose || 0,
          high: quote.regularMarketDayHigh || 0,
          low: quote.regularMarketDayLow || 0,
          marketState: quote.marketState || 'CLOSED',
          sessionStatus: sessionStatus,
          timezone: config.timezone
        };
      }
    });

    // Fill in missing with fallback
    const fallback = getInternationalFallbackData();
    Object.keys(fallback).forEach(symbol => {
      if (!result[symbol]) {
        result[symbol] = fallback[symbol];
      }
    });

    console.log(`International Indices: fetched ${Object.keys(result).length} indices`);
    return result;

  } catch (error) {
    console.error('International indices fetch error:', error.message);
    return getInternationalFallbackData();
  }
}

function getSessionStatus(timezone, marketHours) {
  try {
    const now = new Date();
    const options = { timeZone: timezone, hour: 'numeric', minute: 'numeric', hour12: false };
    const localTime = new Intl.DateTimeFormat('en-US', options).format(now);
    const [hours, minutes] = localTime.split(':').map(Number);
    const currentHour = hours + minutes / 60;

    // Check if it's a weekday
    const dayOptions = { timeZone: timezone, weekday: 'short' };
    const dayOfWeek = new Intl.DateTimeFormat('en-US', dayOptions).format(now);
    if (dayOfWeek === 'Sat' || dayOfWeek === 'Sun') {
      return 'CLOSED';
    }

    if (currentHour >= marketHours.open && currentHour < marketHours.close) {
      return 'LIVE';
    }
    return 'CLOSED';
  } catch (error) {
    return 'UNKNOWN';
  }
}

function getInternationalFallbackData() {
  const baseData = {
    'N225': { name: 'Nikkei 225', basePrice: 38500, volatility: 1.0, timezone: 'Asia/Tokyo', marketHours: { open: 9, close: 15 } },
    'DAX': { name: 'German DAX', basePrice: 18200, volatility: 0.8, timezone: 'Europe/Berlin', marketHours: { open: 9, close: 17.5 } },
    'STOXX': { name: 'Euro Stoxx 50', basePrice: 4850, volatility: 0.7, timezone: 'Europe/Paris', marketHours: { open: 9, close: 17.5 } },
    'FTSE': { name: 'UK FTSE 100', basePrice: 7750, volatility: 0.6, timezone: 'Europe/London', marketHours: { open: 8, close: 16.5 } }
  };

  const result = {};
  Object.entries(baseData).forEach(([symbol, config]) => {
    const randomFactor = (Math.random() - 0.5) * 2 * config.volatility;
    const changePercent = randomFactor;
    const change = config.basePrice * (changePercent / 100);
    const price = config.basePrice + change;
    const sessionStatus = getSessionStatus(config.timezone, config.marketHours);

    result[symbol] = {
      name: config.name,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      previousClose: config.basePrice,
      high: parseFloat((price * 1.005).toFixed(2)),
      low: parseFloat((price * 0.995).toFixed(2)),
      marketState: sessionStatus === 'LIVE' ? 'REGULAR' : 'CLOSED',
      sessionStatus: sessionStatus,
      timezone: config.timezone,
      isFallback: true
    };
  });

  return result;
}

// Fetch Sector ETFs
export async function fetchSectorETFs() {
  const symbols = Object.keys(SECTOR_SYMBOLS).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Sector ETFs API returned status: ${response.status}`);
      return getSectorFallbackData();
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    if (quotes.length === 0) {
      console.warn('Yahoo Finance returned no sector quotes, using fallback data');
      return getSectorFallbackData();
    }

    const result = {};

    quotes.forEach(quote => {
      const config = SECTOR_SYMBOLS[quote.symbol];
      if (config) {
        result[config.symbol] = {
          name: config.name,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          previousClose: quote.regularMarketPreviousClose || 0
        };
      }
    });

    // Fill in missing with fallback
    const fallback = getSectorFallbackData();
    Object.keys(fallback).forEach(symbol => {
      if (!result[symbol]) {
        result[symbol] = fallback[symbol];
      }
    });

    // Sort by changePercent to identify leaders and laggards
    const sorted = Object.entries(result).sort((a, b) => b[1].changePercent - a[1].changePercent);
    if (sorted.length > 0) {
      result[sorted[0][0]].isLeader = true;
      result[sorted[sorted.length - 1][0]].isLaggard = true;
    }

    console.log(`Sector ETFs: fetched ${Object.keys(result).length} sectors`);
    return result;

  } catch (error) {
    console.error('Sector ETFs fetch error:', error.message);
    return getSectorFallbackData();
  }
}

function getSectorFallbackData() {
  const baseData = {
    'XLK': { name: 'Technology', basePrice: 195, volatility: 1.2 },
    'XLF': { name: 'Financials', basePrice: 42, volatility: 0.8 },
    'XLE': { name: 'Energy', basePrice: 88, volatility: 1.5 },
    'XLY': { name: 'Consumer Discretionary', basePrice: 185, volatility: 1.0 },
    'XLP': { name: 'Consumer Staples', basePrice: 78, volatility: 0.5 },
    'XLV': { name: 'Healthcare', basePrice: 142, volatility: 0.6 },
    'XLU': { name: 'Utilities', basePrice: 68, volatility: 0.4 }
  };

  const result = {};
  Object.entries(baseData).forEach(([symbol, config]) => {
    const randomFactor = (Math.random() - 0.5) * 2 * config.volatility;
    const changePercent = randomFactor;
    const change = config.basePrice * (changePercent / 100);
    const price = config.basePrice + change;

    result[symbol] = {
      name: config.name,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      previousClose: config.basePrice,
      isFallback: true
    };
  });

  // Mark leader and laggard
  const sorted = Object.entries(result).sort((a, b) => b[1].changePercent - a[1].changePercent);
  if (sorted.length > 0) {
    result[sorted[0][0]].isLeader = true;
    result[sorted[sorted.length - 1][0]].isLaggard = true;
  }

  return result;
}

// Calculate DXY strength level
export function calculateDXYStrength(dxChangePercent) {
  if (dxChangePercent >= 0.5) return { level: 'Strong', implication: 'Bearish for commodities & EM' };
  if (dxChangePercent >= 0.2) return { level: 'Firm', implication: 'Mild headwind for risk assets' };
  if (dxChangePercent <= -0.5) return { level: 'Weak', implication: 'Supportive for commodities & EM' };
  if (dxChangePercent <= -0.2) return { level: 'Soft', implication: 'Mild tailwind for risk assets' };
  return { level: 'Neutral', implication: 'No significant currency impact' };
}
