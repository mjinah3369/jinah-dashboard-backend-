// Alpha Vantage - Economic Calendar & News
// Free tier: 25 requests/day
// Get API key: https://www.alphavantage.co/support/#api-key

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';

// Fetch top market news and sentiment
export async function fetchEconomicCalendar() {
  try {
    // Alpha Vantage News Sentiment API
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=SPY,QQQ,DIA&apikey=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();

    // Check for API limit message
    if (data.Note || data.Information) {
      console.warn('Alpha Vantage rate limit or info:', data.Note || data.Information);
      return getDefaultEconomicEvents();
    }

    // Extract relevant news for macro events
    const feed = data.feed || [];
    const macroEvents = [];

    // Convert news to event format (top 5 relevant items)
    feed.slice(0, 5).forEach(item => {
      const sentiment = item.overall_sentiment_score || 0;
      let importance = 'LOW';
      if (Math.abs(sentiment) > 0.3) importance = 'HIGH';
      else if (Math.abs(sentiment) > 0.15) importance = 'MEDIUM';

      macroEvents.push({
        time: new Date(item.time_published).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York'
        }) + ' ET',
        event: item.title?.substring(0, 50) + '...' || 'Market News',
        importance: importance,
        previous: '-',
        forecast: '-',
        actual: sentiment > 0 ? 'Positive' : sentiment < 0 ? 'Negative' : 'Neutral',
        source: item.source || 'News'
      });
    });

    return macroEvents.length > 0 ? macroEvents : getDefaultEconomicEvents();

  } catch (error) {
    console.error('Alpha Vantage fetch error:', error.message);
    return getDefaultEconomicEvents();
  }
}

// Fetch earnings calendar
export async function fetchEarningsCalendar() {
  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=1day&apikey=${API_KEY}`;

    const response = await fetch(url);
    const text = await response.text();

    // Parse CSV response
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0]?.split(',') || [];
    const earnings = [];

    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const values = lines[i].split(',');
      if (values.length >= 3) {
        const symbol = values[0]?.replace(/"/g, '');
        const reportDate = values[2]?.replace(/"/g, '');

        // Determine affected instruments based on sector
        let affected = ['ES'];
        if (['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'].includes(symbol)) {
          affected = ['NQ', 'ES'];
        }
        if (['JPM', 'BAC', 'WFC', 'GS'].includes(symbol)) {
          affected = ['ES', 'YM'];
        }

        earnings.push({
          company: symbol,
          time: 'TBD',
          affectedInstruments: affected
        });
      }
    }

    return earnings;
  } catch (error) {
    console.error('Earnings calendar fetch error:', error.message);
    return [];
  }
}

// Default events when API fails or rate limited
function getDefaultEconomicEvents() {
  const now = new Date();

  // Get upcoming economic events with actual dates
  const upcomingEvents = getUpcomingEconomicCalendar(now);

  // Filter to events within next 14 days
  const twoWeeksFromNow = new Date(now);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  return upcomingEvents.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= now && eventDate <= twoWeeksFromNow;
  });
}

// Generate upcoming economic calendar with real dates
function getUpcomingEconomicCalendar(fromDate) {
  const events = [];
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth();

  // Helper: Find nth weekday of month (0=Sun, 1=Mon, ..., 5=Fri)
  function getNthWeekdayOfMonth(year, month, weekday, n) {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    let dayOffset = weekday - firstWeekday;
    if (dayOffset < 0) dayOffset += 7;
    const date = 1 + dayOffset + (n - 1) * 7;
    return new Date(year, month, date);
  }

  // Helper: Get last weekday of month
  function getLastWeekdayOfMonth(year, month, weekday) {
    const lastDay = new Date(year, month + 1, 0);
    const lastDayWeekday = lastDay.getDay();
    let dayOffset = lastDayWeekday - weekday;
    if (dayOffset < 0) dayOffset += 7;
    return new Date(year, month + 1, -dayOffset);
  }

  // Generate events for current and next month
  for (let m = 0; m <= 1; m++) {
    const targetMonth = month + m;
    const targetYear = targetMonth > 11 ? year + 1 : year;
    const adjustedMonth = targetMonth % 12;

    // Non-Farm Payrolls - First Friday of month
    const nfpDate = getNthWeekdayOfMonth(targetYear, adjustedMonth, 5, 1);
    events.push({
      date: nfpDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Non-Farm Payrolls',
      importance: 'HIGH',
      previous: '256K',
      forecast: '170K',
      actual: null
    });

    // Unemployment Rate - Same day as NFP
    events.push({
      date: nfpDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Unemployment Rate',
      importance: 'HIGH',
      previous: '4.1%',
      forecast: '4.1%',
      actual: null
    });

    // CPI - Usually around 12th-14th of month
    const cpiDate = new Date(targetYear, adjustedMonth, 12);
    // Adjust to nearest Wednesday
    while (cpiDate.getDay() !== 3) {
      cpiDate.setDate(cpiDate.getDate() + 1);
    }
    events.push({
      date: cpiDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'CPI (Consumer Price Index)',
      importance: 'HIGH',
      previous: '2.9%',
      forecast: '2.8%',
      actual: null
    });

    // Core CPI - Same day as CPI
    events.push({
      date: cpiDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Core CPI (ex Food & Energy)',
      importance: 'HIGH',
      previous: '3.2%',
      forecast: '3.1%',
      actual: null
    });

    // Retail Sales - Around 15th of month
    const retailDate = new Date(targetYear, adjustedMonth, 15);
    // Adjust to nearest Thursday
    while (retailDate.getDay() !== 4) {
      retailDate.setDate(retailDate.getDate() + 1);
    }
    events.push({
      date: retailDate.toISOString().split('T')[0],
      time: '8:30 AM ET',
      event: 'Retail Sales',
      importance: 'HIGH',
      previous: '0.4%',
      forecast: '0.3%',
      actual: null
    });

    // ISM Manufacturing PMI - First business day of month
    const ismDate = new Date(targetYear, adjustedMonth, 1);
    while (ismDate.getDay() === 0 || ismDate.getDay() === 6) {
      ismDate.setDate(ismDate.getDate() + 1);
    }
    events.push({
      date: ismDate.toISOString().split('T')[0],
      time: '10:00 AM ET',
      event: 'ISM Manufacturing PMI',
      importance: 'HIGH',
      previous: '49.3',
      forecast: '49.5',
      actual: null
    });

    // Initial Jobless Claims - Every Thursday
    let thursday = new Date(targetYear, adjustedMonth, 1);
    while (thursday.getDay() !== 4) {
      thursday.setDate(thursday.getDate() + 1);
    }
    // Add all Thursdays of the month
    while (thursday.getMonth() === adjustedMonth) {
      events.push({
        date: thursday.toISOString().split('T')[0],
        time: '8:30 AM ET',
        event: 'Initial Jobless Claims',
        importance: 'MEDIUM',
        previous: '214K',
        forecast: '212K',
        actual: null
      });
      thursday.setDate(thursday.getDate() + 7);
    }
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Filter out past events
  return events.filter(e => new Date(e.date) >= new Date(fromDate.toISOString().split('T')[0]));
}
