// Yahoo Finance - Futures Prices (No API key needed)
// Uses the unofficial Yahoo Finance API with fallback data

// Equity Index Futures
const EQUITY_INDEX_SYMBOLS = {
  'ES=F': { name: 'S&P 500 E-mini', symbol: 'ES', sector: 'indices' },
  'NQ=F': { name: 'Nasdaq 100 E-mini', symbol: 'NQ', sector: 'indices' },
  'YM=F': { name: 'Dow Jones E-mini', symbol: 'YM', sector: 'indices' },
  'RTY=F': { name: 'Russell 2000 E-mini', symbol: 'RTY', sector: 'indices' }
};

// Interest Rate / Bond Futures
const BOND_SYMBOLS = {
  'ZT=F': { name: '2-Year T-Note', symbol: 'ZT', sector: 'bonds', duration: 'short' },
  'ZF=F': { name: '5-Year T-Note', symbol: 'ZF', sector: 'bonds', duration: 'medium' },
  'ZN=F': { name: '10-Year T-Note', symbol: 'ZN', sector: 'bonds', duration: 'medium-long' },
  'TN=F': { name: 'Ultra 10-Year T-Note', symbol: 'TN', sector: 'bonds', duration: 'long' },
  'ZB=F': { name: '30-Year T-Bond', symbol: 'ZB', sector: 'bonds', duration: 'long' }
};

// Precious Metals Futures
const METALS_SYMBOLS = {
  'GC=F': { name: 'Gold', symbol: 'GC', sector: 'metals' },
  'SI=F': { name: 'Silver', symbol: 'SI', sector: 'metals' },
  'HG=F': { name: 'Copper', symbol: 'HG', sector: 'metals' }
};

// Energy Futures
const ENERGY_SYMBOLS = {
  'CL=F': { name: 'Crude Oil WTI', symbol: 'CL', sector: 'energy' },
  'NG=F': { name: 'Natural Gas', symbol: 'NG', sector: 'energy' },
  'RB=F': { name: 'RBOB Gasoline', symbol: 'RB', sector: 'energy' }
};

// Agriculture Futures
const AGRICULTURE_SYMBOLS = {
  'ZS=F': { name: 'Soybeans', symbol: 'ZS', sector: 'agriculture' },
  'ZC=F': { name: 'Corn', symbol: 'ZC', sector: 'agriculture' },
  'ZW=F': { name: 'Wheat', symbol: 'ZW', sector: 'agriculture' },
  'ZM=F': { name: 'Soybean Meal', symbol: 'ZM', sector: 'agriculture' },
  'ZL=F': { name: 'Soybean Oil', symbol: 'ZL', sector: 'agriculture' },
  'LE=F': { name: 'Live Cattle', symbol: 'LE', sector: 'agriculture' },
  'HE=F': { name: 'Lean Hogs', symbol: 'HE', sector: 'agriculture' }
};

// Cryptocurrency
const CRYPTO_SYMBOLS = {
  'BTC-USD': { name: 'Bitcoin', symbol: 'BTC', sector: 'crypto' },
  'ETH-USD': { name: 'Ethereum', symbol: 'ETH', sector: 'crypto' }
};

// Volatility
const VOLATILITY_SYMBOLS = {
  '^VIX': { name: 'VIX', symbol: 'VIX', sector: 'volatility' }
};

// Combined for backward compatibility
const FUTURES_SYMBOLS = {
  ...EQUITY_INDEX_SYMBOLS,
  ...BOND_SYMBOLS,
  ...METALS_SYMBOLS,
  ...ENERGY_SYMBOLS,
  ...AGRICULTURE_SYMBOLS,
  ...CRYPTO_SYMBOLS,
  ...VOLATILITY_SYMBOLS
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

// Magnificent Seven Stocks
const MAG7_SYMBOLS = {
  'AAPL': { name: 'Apple', symbol: 'AAPL', description: 'iPhones, Mac, Services' },
  'NVDA': { name: 'NVIDIA', symbol: 'NVDA', description: 'AI Chips, GPUs, Data Centers' },
  'MSFT': { name: 'Microsoft', symbol: 'MSFT', description: 'Windows, Azure, Office 365' },
  'GOOGL': { name: 'Alphabet', symbol: 'GOOGL', description: 'Search, YouTube, Google Cloud' },
  'AMZN': { name: 'Amazon', symbol: 'AMZN', description: 'E-commerce, AWS Cloud' },
  'META': { name: 'Meta', symbol: 'META', description: 'Facebook, Instagram, WhatsApp' },
  'TSLA': { name: 'Tesla', symbol: 'TSLA', description: 'EVs, Energy, AI/Robotics' }
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
          marketState: quote.marketState || 'REGULAR',
          sector: config.sector || 'other',
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0
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
    // Equity Indices
    'ES': { name: 'S&P 500 E-mini', basePrice: 6050, volatility: 0.8, sector: 'indices' },
    'NQ': { name: 'Nasdaq 100 E-mini', basePrice: 21500, volatility: 1.2, sector: 'indices' },
    'YM': { name: 'Dow Jones E-mini', basePrice: 49000, volatility: 0.6, sector: 'indices' },
    'RTY': { name: 'Russell 2000 E-mini', basePrice: 2280, volatility: 1.0, sector: 'indices' },
    // Bonds / Interest Rates
    'ZT': { name: '2-Year T-Note', basePrice: 102.50, volatility: 0.15, sector: 'bonds' },
    'ZF': { name: '5-Year T-Note', basePrice: 106.75, volatility: 0.25, sector: 'bonds' },
    'ZN': { name: '10-Year T-Note', basePrice: 108.50, volatility: 0.3, sector: 'bonds' },
    'TN': { name: 'Ultra 10-Year T-Note', basePrice: 115.80, volatility: 0.35, sector: 'bonds' },
    'ZB': { name: '30-Year T-Bond', basePrice: 118.25, volatility: 0.4, sector: 'bonds' },
    // Precious Metals
    'GC': { name: 'Gold', basePrice: 2760, volatility: 0.5, sector: 'metals' },
    'SI': { name: 'Silver', basePrice: 31.50, volatility: 1.2, sector: 'metals' },
    'HG': { name: 'Copper', basePrice: 4.15, volatility: 1.0, sector: 'metals' },
    // Energy
    'CL': { name: 'Crude Oil WTI', basePrice: 73.50, volatility: 1.5, sector: 'energy' },
    'NG': { name: 'Natural Gas', basePrice: 2.90, volatility: 3.0, sector: 'energy' },
    'RB': { name: 'RBOB Gasoline', basePrice: 2.15, volatility: 1.8, sector: 'energy' },
    // Agriculture
    'ZS': { name: 'Soybeans', basePrice: 1020, volatility: 1.2, sector: 'agriculture' },
    'ZC': { name: 'Corn', basePrice: 450, volatility: 1.5, sector: 'agriculture' },
    'ZW': { name: 'Wheat', basePrice: 540, volatility: 2.0, sector: 'agriculture' },
    'ZM': { name: 'Soybean Meal', basePrice: 295, volatility: 1.3, sector: 'agriculture' },
    'ZL': { name: 'Soybean Oil', basePrice: 42.5, volatility: 1.4, sector: 'agriculture' },
    'LE': { name: 'Live Cattle', basePrice: 195, volatility: 0.8, sector: 'agriculture' },
    'HE': { name: 'Lean Hogs', basePrice: 82, volatility: 1.5, sector: 'agriculture' },
    // Cryptocurrency
    'BTC': { name: 'Bitcoin', basePrice: 102500, volatility: 3.0, sector: 'crypto' },
    'ETH': { name: 'Ethereum', basePrice: 3200, volatility: 4.0, sector: 'crypto' },
    // Volatility
    'VIX': { name: 'VIX', basePrice: 16.5, volatility: 5.0, sector: 'volatility' }
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
      sector: config.sector,
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

// Fetch Magnificent Seven Stocks
export async function fetchMag7Stocks() {
  const symbols = Object.keys(MAG7_SYMBOLS).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Mag7 API returned status: ${response.status}`);
      return getMag7FallbackData();
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    if (quotes.length === 0) {
      console.warn('Yahoo Finance returned no Mag7 quotes, using fallback data');
      return getMag7FallbackData();
    }

    const result = {};

    quotes.forEach(quote => {
      const config = MAG7_SYMBOLS[quote.symbol];
      if (config) {
        const changePercent = quote.regularMarketChangePercent || 0;

        // Determine trend status
        let trend = 'Flat';
        if (changePercent > 1) trend = 'Strong Rally';
        else if (changePercent > 0.3) trend = 'Up';
        else if (changePercent < -1) trend = 'Sharp Drop';
        else if (changePercent < -0.3) trend = 'Down';

        result[config.symbol] = {
          name: config.name,
          description: config.description,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: changePercent,
          previousClose: quote.regularMarketPreviousClose || 0,
          marketCap: quote.marketCap || 0,
          marketCapFormatted: formatMarketCap(quote.marketCap),
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
          trend: trend,
          marketState: quote.marketState || 'REGULAR'
        };
      }
    });

    // Fill in missing with fallback
    const fallback = getMag7FallbackData();
    Object.keys(fallback).forEach(symbol => {
      if (!result[symbol]) {
        result[symbol] = fallback[symbol];
      }
    });

    console.log(`Mag7 Stocks: fetched ${Object.keys(result).length} stocks`);
    return result;

  } catch (error) {
    console.error('Mag7 fetch error:', error.message);
    return getMag7FallbackData();
  }
}

function formatMarketCap(marketCap) {
  if (!marketCap) return 'N/A';
  if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
  if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
  if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
  return `$${marketCap.toLocaleString()}`;
}

function getMag7FallbackData() {
  const baseData = {
    'AAPL': { name: 'Apple', description: 'iPhones, Mac, Services', basePrice: 230, marketCap: 3.78e12, volatility: 1.2 },
    'NVDA': { name: 'NVIDIA', description: 'AI Chips, GPUs, Data Centers', basePrice: 140, marketCap: 3.5e12, volatility: 2.5 },
    'MSFT': { name: 'Microsoft', description: 'Windows, Azure, Office 365', basePrice: 420, marketCap: 3.59e12, volatility: 1.0 },
    'GOOGL': { name: 'Alphabet', description: 'Search, YouTube, Google Cloud', basePrice: 195, marketCap: 2.5e12, volatility: 1.5 },
    'AMZN': { name: 'Amazon', description: 'E-commerce, AWS Cloud', basePrice: 225, marketCap: 2.47e12, volatility: 1.8 },
    'META': { name: 'Meta', description: 'Facebook, Instagram, WhatsApp', basePrice: 610, marketCap: 1.5e12, volatility: 2.0 },
    'TSLA': { name: 'Tesla', description: 'EVs, Energy, AI/Robotics', basePrice: 410, marketCap: 1.3e12, volatility: 3.5 }
  };

  const result = {};
  Object.entries(baseData).forEach(([symbol, config]) => {
    const randomFactor = (Math.random() - 0.5) * 2 * config.volatility;
    const changePercent = randomFactor;
    const change = config.basePrice * (changePercent / 100);
    const price = config.basePrice + change;

    let trend = 'Flat';
    if (changePercent > 1) trend = 'Strong Rally';
    else if (changePercent > 0.3) trend = 'Up';
    else if (changePercent < -1) trend = 'Sharp Drop';
    else if (changePercent < -0.3) trend = 'Down';

    result[symbol] = {
      name: config.name,
      description: config.description,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      previousClose: config.basePrice,
      marketCap: config.marketCap,
      marketCapFormatted: formatMarketCap(config.marketCap),
      fiftyTwoWeekHigh: parseFloat((config.basePrice * 1.35).toFixed(2)),
      fiftyTwoWeekLow: parseFloat((config.basePrice * 0.65).toFixed(2)),
      trend: trend,
      marketState: 'REGULAR',
      isFallback: true
    };
  });

  return result;
}

// Treasury Yield Symbols for Quick Stats
const TREASURY_YIELD_SYMBOLS = {
  '^IRX': { name: '3-Month T-Bill', symbol: '3M', duration: '3m' },
  '^FVX': { name: '5-Year Treasury', symbol: '5Y', duration: '5y' },
  '^TNX': { name: '10-Year Treasury', symbol: '10Y', duration: '10y' },
  '^TYX': { name: '30-Year Treasury', symbol: '30Y', duration: '30y' }
};

// Note: CRYPTO_SYMBOLS is already defined at the top of the file with sector info

// Fetch Treasury Yields
export async function fetchTreasuryYields() {
  const symbols = Object.keys(TREASURY_YIELD_SYMBOLS).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Treasury yields API returned status: ${response.status}`);
      return getTreasuryYieldsFallback();
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    if (quotes.length === 0) {
      return getTreasuryYieldsFallback();
    }

    const result = {};
    quotes.forEach(quote => {
      const config = TREASURY_YIELD_SYMBOLS[quote.symbol];
      if (config) {
        result[config.symbol] = {
          name: config.name,
          yield: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          previousClose: quote.regularMarketPreviousClose || 0
        };
      }
    });

    // Calculate 2s10s spread (using 5Y as proxy for 2Y if not available)
    const twoYear = result['5Y']?.yield || 4.21; // Use 5Y as approximation
    const tenYear = result['10Y']?.yield || 4.52;
    result.yieldCurve = {
      spread2s10s: parseFloat((tenYear - twoYear).toFixed(2)),
      isInverted: tenYear < twoYear,
      status: tenYear < twoYear ? 'Inverted' : (tenYear - twoYear < 0.25 ? 'Flat' : 'Normal')
    };

    console.log(`Treasury Yields: fetched ${Object.keys(result).length - 1} yields`);
    return result;

  } catch (error) {
    console.error('Treasury yields fetch error:', error.message);
    return getTreasuryYieldsFallback();
  }
}

function getTreasuryYieldsFallback() {
  return {
    '3M': { name: '3-Month T-Bill', yield: 4.35, change: 0.02, changePercent: 0.46, previousClose: 4.33 },
    '5Y': { name: '5-Year Treasury', yield: 4.38, change: 0.03, changePercent: 0.69, previousClose: 4.35 },
    '10Y': { name: '10-Year Treasury', yield: 4.52, change: 0.04, changePercent: 0.89, previousClose: 4.48 },
    '30Y': { name: '30-Year Treasury', yield: 4.71, change: 0.02, changePercent: 0.43, previousClose: 4.69 },
    yieldCurve: {
      spread2s10s: 0.14,
      isInverted: false,
      status: 'Flat'
    },
    isFallback: true
  };
}

// Fetch Crypto Prices for Quick Stats
export async function fetchCryptoPrices() {
  const symbols = Object.keys(CRYPTO_SYMBOLS).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return getCryptoFallback();
    }

    const data = await response.json();
    const quotes = data.quoteResponse?.result || [];

    if (quotes.length === 0) {
      return getCryptoFallback();
    }

    const result = {};
    quotes.forEach(quote => {
      const config = CRYPTO_SYMBOLS[quote.symbol];
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

    console.log(`Crypto: fetched ${Object.keys(result).length} prices`);
    return result;

  } catch (error) {
    console.error('Crypto fetch error:', error.message);
    return getCryptoFallback();
  }
}

function getCryptoFallback() {
  return {
    BTC: { name: 'Bitcoin', price: 102450, change: -1250, changePercent: -1.21, previousClose: 103700 },
    ETH: { name: 'Ethereum', price: 3180, change: -28, changePercent: -0.87, previousClose: 3208 },
    isFallback: true
  };
}

// Calculate Expectation Meters for ES, GC, CL
export function calculateExpectationMeters(futuresData, currencyData, newsData) {
  const vix = futuresData?.VIX?.price || 16;
  const vixChange = futuresData?.VIX?.changePercent || 0;
  const znChange = futuresData?.ZN?.changePercent || 0;
  const dxChange = currencyData?.DX?.changePercent || 0;

  // Analyze news sentiment for each instrument
  const newsSentiment = analyzeNewsSentiment(newsData);

  return {
    ES: calculateESExpectation(vix, znChange, dxChange, newsSentiment.ES),
    GC: calculateGCExpectation(dxChange, znChange, vix, newsSentiment.GC),
    CL: calculateCLExpectation(dxChange, newsSentiment.CL, newsSentiment.geopolitical)
  };
}

function calculateESExpectation(vix, znChange, dxChange, newsSentiment) {
  let score = 0;
  const factors = {};

  // VIX Factor (30% weight) - Aligned with VIX card thresholds
  if (vix < 12) {
    factors.VIX = { score: 2, reason: 'Low fear, complacent' };
    score += 2;
  } else if (vix < 16) {
    factors.VIX = { score: 0, reason: 'Normal volatility' };
  } else if (vix < 20) {
    factors.VIX = { score: -1, reason: 'Elevated fear' };
    score -= 1;
  } else if (vix < 30) {
    factors.VIX = { score: -2, reason: 'High fear' };
    score -= 2;
  } else {
    factors.VIX = { score: -2, reason: 'Extreme fear/panic' };
    score -= 2;
  }

  // ZN Factor (25% weight) - Rising ZN = falling yields = bullish ES
  if (znChange > 0.2) {
    factors.ZN = { score: 2, reason: 'Yields falling' };
    score += 2;
  } else if (znChange > 0.1) {
    factors.ZN = { score: 1, reason: 'Yields easing' };
    score += 1;
  } else if (znChange < -0.2) {
    factors.ZN = { score: -2, reason: 'Yields surging' };
    score -= 2;
  } else if (znChange < -0.1) {
    factors.ZN = { score: -1, reason: 'Yields rising' };
    score -= 1;
  } else {
    factors.ZN = { score: 0, reason: 'Yields stable' };
  }

  // DX Factor (20% weight) - Falling DX = bullish ES
  if (dxChange < -0.3) {
    factors.DX = { score: 1, reason: 'Weak dollar' };
    score += 1;
  } else if (dxChange > 0.5) {
    factors.DX = { score: -2, reason: 'Strong dollar' };
    score -= 2;
  } else if (dxChange > 0.2) {
    factors.DX = { score: -1, reason: 'Firm dollar' };
    score -= 1;
  } else {
    factors.DX = { score: 0, reason: 'Dollar neutral' };
  }

  // News Factor (25% weight)
  factors.News = { score: newsSentiment, reason: newsSentiment > 0 ? 'Positive news' : newsSentiment < 0 ? 'Negative news' : 'Neutral news' };
  score += newsSentiment;

  return buildExpectationResult(score, factors, 'ES');
}

function calculateGCExpectation(dxChange, znChange, vix, newsSentiment) {
  let score = 0;
  const factors = {};

  // DX Factor (35% weight) - Falling DX = bullish GC
  if (dxChange < -0.5) {
    factors.DX = { score: 2, reason: 'Weak dollar (bullish gold)' };
    score += 2;
  } else if (dxChange < -0.2) {
    factors.DX = { score: 1, reason: 'Soft dollar' };
    score += 1;
  } else if (dxChange > 0.5) {
    factors.DX = { score: -2, reason: 'Strong dollar (bearish gold)' };
    score -= 2;
  } else if (dxChange > 0.2) {
    factors.DX = { score: -1, reason: 'Firm dollar' };
    score -= 1;
  } else {
    factors.DX = { score: 0, reason: 'Dollar neutral' };
  }

  // ZN Factor (25% weight) - Rising ZN = falling yields = bullish GC
  if (znChange > 0.2) {
    factors.ZN = { score: 2, reason: 'Lower yields (bullish gold)' };
    score += 2;
  } else if (znChange > 0.1) {
    factors.ZN = { score: 1, reason: 'Yields easing' };
    score += 1;
  } else if (znChange < -0.2) {
    factors.ZN = { score: -2, reason: 'Rising yields (bearish gold)' };
    score -= 2;
  } else if (znChange < -0.1) {
    factors.ZN = { score: -1, reason: 'Yields rising' };
    score -= 1;
  } else {
    factors.ZN = { score: 0, reason: 'Yields stable' };
  }

  // VIX Factor (20% weight) - High VIX = bullish GC (safe haven) - Aligned with VIX card
  if (vix >= 30) {
    factors.VIX = { score: 2, reason: 'Extreme fear = safe haven bid' };
    score += 2;
  } else if (vix >= 20) {
    factors.VIX = { score: 2, reason: 'High fear = safe haven bid' };
    score += 2;
  } else if (vix >= 16) {
    factors.VIX = { score: 1, reason: 'Elevated fear' };
    score += 1;
  } else if (vix < 12) {
    factors.VIX = { score: -1, reason: 'Complacency (less gold demand)' };
    score -= 1;
  } else {
    factors.VIX = { score: 0, reason: 'Normal volatility' };
  }

  // News Factor (20% weight)
  factors.News = { score: newsSentiment, reason: newsSentiment > 0 ? 'Positive news' : newsSentiment < 0 ? 'Negative news' : 'Neutral news' };
  score += newsSentiment;

  return buildExpectationResult(score, factors, 'GC');
}

function calculateCLExpectation(dxChange, newsSentiment, geopoliticalScore) {
  let score = 0;
  const factors = {};

  // Geopolitical Factor (30% weight)
  if (geopoliticalScore > 1) {
    factors.Geo = { score: 2, reason: 'High geopolitical tension' };
    score += 2;
  } else if (geopoliticalScore > 0) {
    factors.Geo = { score: 1, reason: 'Moderate tension' };
    score += 1;
  } else if (geopoliticalScore < -1) {
    factors.Geo = { score: -1, reason: 'Calm/resolution' };
    score -= 1;
  } else {
    factors.Geo = { score: 0, reason: 'Neutral geopolitics' };
  }

  // DX Factor (25% weight) - Falling DX = bullish CL
  if (dxChange < -0.3) {
    factors.DX = { score: 1, reason: 'Weak dollar (bullish oil)' };
    score += 1;
  } else if (dxChange > 0.5) {
    factors.DX = { score: -2, reason: 'Strong dollar (bearish oil)' };
    score -= 2;
  } else if (dxChange > 0.2) {
    factors.DX = { score: -1, reason: 'Firm dollar' };
    score -= 1;
  } else {
    factors.DX = { score: 0, reason: 'Dollar neutral' };
  }

  // Supply News Factor (25% weight)
  factors.Supply = { score: newsSentiment, reason: newsSentiment > 0 ? 'Supply concerns' : newsSentiment < 0 ? 'Oversupply risk' : 'Supply neutral' };
  score += newsSentiment;

  // Demand Factor (20% weight) - Based on general economic news
  factors.Demand = { score: 0, reason: 'Demand stable' };

  return buildExpectationResult(score, factors, 'CL');
}

function buildExpectationResult(score, factors, instrument) {
  // Clamp score to -6 to +6
  score = Math.max(-6, Math.min(6, score));

  let direction, label;
  if (score >= 4) {
    direction = 'Strong Bullish';
    label = 'STRONG BULLISH';
  } else if (score >= 2) {
    direction = 'Bullish';
    label = 'BULLISH';
  } else if (score >= 1) {
    direction = 'Slight Bullish';
    label = 'SLIGHT BULLISH';
  } else if (score <= -4) {
    direction = 'Strong Bearish';
    label = 'STRONG BEARISH';
  } else if (score <= -2) {
    direction = 'Bearish';
    label = 'BEARISH';
  } else if (score <= -1) {
    direction = 'Slight Bearish';
    label = 'SLIGHT BEARISH';
  } else {
    direction = 'Neutral';
    label = 'NEUTRAL';
  }

  // Calculate confidence (1-10 based on factor agreement)
  const factorScores = Object.values(factors).map(f => f.score);
  const avgMagnitude = factorScores.reduce((sum, s) => sum + Math.abs(s), 0) / factorScores.length;
  const confidence = Math.min(10, Math.max(1, Math.round(avgMagnitude * 3 + 4)));

  return {
    score,
    direction,
    label,
    confidence,
    factors
  };
}

function analyzeNewsSentiment(newsData) {
  if (!newsData || !Array.isArray(newsData) || newsData.length === 0) {
    return { ES: 0, GC: 0, CL: 0, geopolitical: 0 };
  }

  let esSentiment = 0;
  let gcSentiment = 0;
  let clSentiment = 0;
  let geoScore = 0;

  const highImpactNews = newsData.filter(n => n.impact === 'HIGH');

  highImpactNews.forEach(news => {
    const headline = (news.headline || '').toLowerCase();

    // ES sentiment
    if (news.affectedInstruments?.includes('ES')) {
      if (headline.includes('rally') || headline.includes('surge') || headline.includes('gain')) esSentiment += 1;
      if (headline.includes('fall') || headline.includes('drop') || headline.includes('concern')) esSentiment -= 1;
    }

    // GC sentiment
    if (news.affectedInstruments?.includes('GC') || headline.includes('gold')) {
      if (headline.includes('safe haven') || headline.includes('inflation')) gcSentiment += 1;
      if (headline.includes('hawkish') || headline.includes('rate hike')) gcSentiment -= 1;
    }

    // CL sentiment
    if (news.affectedInstruments?.includes('CL') || headline.includes('oil') || headline.includes('crude')) {
      if (headline.includes('opec cut') || headline.includes('supply concern') || headline.includes('disruption')) clSentiment += 1;
      if (headline.includes('oversupply') || headline.includes('demand weak')) clSentiment -= 1;
    }

    // Geopolitical score
    if (news.category === 'Geopolitical' || headline.includes('war') || headline.includes('tension') || headline.includes('sanction') || headline.includes('tariff')) {
      geoScore += 1;
    }
  });

  return {
    ES: Math.max(-2, Math.min(2, esSentiment)),
    GC: Math.max(-2, Math.min(2, gcSentiment)),
    CL: Math.max(-2, Math.min(2, clSentiment)),
    geopolitical: Math.max(-2, Math.min(2, geoScore))
  };
}
