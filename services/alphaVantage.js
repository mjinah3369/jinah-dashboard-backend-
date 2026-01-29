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
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Typical events by day of week
  const typicalEvents = {
    1: [ // Monday
      { time: '10:00 AM ET', event: 'ISM Manufacturing PMI', importance: 'HIGH', previous: '49.3', forecast: '49.5', actual: null },
    ],
    2: [ // Tuesday
      { time: '10:00 AM ET', event: 'JOLTS Job Openings', importance: 'MEDIUM', previous: '8.79M', forecast: '8.75M', actual: null },
    ],
    3: [ // Wednesday
      { time: '8:15 AM ET', event: 'ADP Employment Change', importance: 'MEDIUM', previous: '164K', forecast: '150K', actual: null },
      { time: '2:00 PM ET', event: 'FOMC Minutes', importance: 'HIGH', previous: '-', forecast: '-', actual: null },
    ],
    4: [ // Thursday
      { time: '8:30 AM ET', event: 'Initial Jobless Claims', importance: 'MEDIUM', previous: '214K', forecast: '212K', actual: null },
    ],
    5: [ // Friday
      { time: '8:30 AM ET', event: 'Non-Farm Payrolls', importance: 'HIGH', previous: '256K', forecast: '170K', actual: null },
      { time: '8:30 AM ET', event: 'Unemployment Rate', importance: 'HIGH', previous: '4.1%', forecast: '4.1%', actual: null },
    ]
  };

  return typicalEvents[dayOfWeek] || [
    { time: 'All Day', event: 'No Major Events Scheduled', importance: 'LOW', previous: '-', forecast: '-', actual: null }
  ];
}
