/**
 * Dashboard Chatbot Service — Enhanced with Full Market Analysis
 *
 * An AI-powered chatbot that can:
 * - Analyze ALL live data and give actionable briefs
 * - Answer questions about dashboard data
 * - Explain why instruments are bullish/bearish
 * - Explain news headlines and their market impact
 * - Provide "what to look for now" analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { NEWS_KEYWORD_MAP, KEYWORD_GROUP_TO_SYMBOLS, tagHeadlineWithSymbols } from './aiAgents.js';
import { getESCommandCenter } from './esCommandCenter.js';
import { generateFinalAnalysis } from './finalAnalysis.js';
import { getCurrentSession, getNextSession } from './sessionEngine.js';
import { getTodaysReports, getEventRiskSummary } from './reportSchedule.js';
import { getAllCOTData } from './cftcCot.js';
import { getPutCallRatio } from './cboePutCall.js';
import {
  buildKnowledgeContext,
  getReportKnowledge,
  getExtendedInstrumentKnowledge,
  searchResearchKnowledge,
  getCrossMarketAnalysis,
  getSessionKnowledge,
  REPORT_KNOWLEDGE,
  DASHBOARD_SYSTEM_KNOWLEDGE,
  CROSS_MARKET_KNOWLEDGE,
  EXTENDED_INSTRUMENT_KNOWLEDGE,
  RESEARCH_KNOWLEDGE
} from './CHATBOT_KNOWLEDGE_BASE.js';
import { buildReportsCalendar } from './fundamentalReports.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ============================================================================
// KNOWLEDGE BASE - Everything the chatbot knows about markets
// ============================================================================

const MARKET_KNOWLEDGE = {
  // === SENTIMENT KEYWORDS AND WHY THEY MATTER ===
  sentimentKeywords: {
    bearish: {
      'rate hike': 'Higher interest rates increase borrowing costs, reduce corporate profits, and make bonds more attractive vs stocks',
      'rate hikes': 'Multiple rate increases signal aggressive Fed tightening, negative for growth stocks especially',
      'inflation': 'High inflation erodes purchasing power and forces Fed to keep rates higher for longer',
      'sticky inflation': 'Persistent inflation means no Fed pivot coming soon - bearish for rate-sensitive assets',
      'recession': 'Economic contraction means lower earnings, job losses, reduced spending',
      'layoffs': 'Companies cutting costs signals weak demand and economic slowdown',
      'downturn': 'Economic weakness ahead, defensive positioning recommended',
      'miss': 'Earnings or economic data below expectations disappoints investors',
      'weak': 'Below-trend performance suggests deteriorating conditions',
      'decline': 'Falling metrics indicate worsening fundamentals',
      'tariff': 'Trade barriers increase costs and reduce global trade',
      'sanctions': 'Economic restrictions disrupt supply chains and trade',
      'default': 'Credit events signal systemic risk and contagion fears',
      'bankruptcy': 'Company failure raises concerns about sector health',
      'crash': 'Severe price drops indicate panic selling',
      'plunge': 'Sharp declines trigger stop losses and margin calls',
      'sell-off': 'Broad liquidation across assets',
      'hawkish': 'Fed bias toward higher rates - negative for stocks',
      'tightening': 'Reduced liquidity and higher rates'
    },
    bullish: {
      'rate cut': 'Lower rates reduce borrowing costs, boost corporate profits, make stocks more attractive',
      'rate cuts': 'Multiple cuts signal accommodative Fed policy - very bullish for growth',
      'stimulus': 'Government spending or monetary easing adds liquidity to markets',
      'dovish': 'Fed bias toward lower rates or slower hikes - positive for risk assets',
      'beat': 'Earnings or data exceeding expectations drives buying',
      'strong': 'Above-trend performance indicates healthy fundamentals',
      'growth': 'Economic expansion supports higher earnings and valuations',
      'rally': 'Sustained buying pressure and positive momentum',
      'surge': 'Sharp price increases indicate strong demand',
      'breakout': 'Price moving above resistance signals continuation',
      'recovery': 'Bounce from lows suggests bottom formation',
      'pivot': 'Fed changing direction from hawkish to dovish - major bullish catalyst',
      'easing': 'Looser monetary policy adds liquidity',
      'deal': 'M&A or trade agreements are typically bullish',
      'approval': 'Regulatory or FDA approval removes uncertainty',
      'upgrade': 'Analyst upgrades signal higher price targets'
    }
  },

  // === INSTRUMENT RELATIONSHIPS ===
  instrumentRelationships: {
    ES: {
      fullName: 'E-mini S&P 500 Futures',
      correlations: {
        positive: ['NQ', 'YM', 'RTY', 'SPY'],
        negative: ['VIX', '6J'],
        related: ['HYG', 'TLT']
      },
      drivers: [
        'Fed policy (most important)',
        'Earnings season',
        'Economic data (NFP, CPI, GDP)',
        'VIX levels',
        'Dollar strength (inverse)'
      ],
      interpretation: 'Broad market benchmark - when ES moves, most risk assets follow'
    },
    NQ: {
      fullName: 'E-mini Nasdaq 100 Futures',
      correlations: {
        positive: ['ES', 'SOX', 'QQQ'],
        negative: ['VIX', 'TLT', '6J'],
        related: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA']
      },
      drivers: [
        'Mag7 earnings (AAPL, MSFT, NVDA, GOOGL, META, AMZN, TSLA)',
        'Interest rates (very rate-sensitive)',
        'AI/semiconductor news',
        'Tech regulation',
        'SOX (semiconductors) leading indicator'
      ],
      interpretation: 'Tech-heavy index - more volatile than ES, very sensitive to rates and growth expectations'
    },
    CL: {
      fullName: 'Crude Oil Futures (WTI)',
      correlations: {
        positive: ['NG', 'XLE', '6C'],
        negative: ['DX'],
        related: ['RB', 'HO']
      },
      drivers: [
        'EIA Weekly Petroleum Report (Wednesdays 10:30 AM ET)',
        'OPEC+ decisions',
        'Geopolitical tensions (Middle East, Russia)',
        'Dollar strength (inverse)',
        'China demand',
        'Refinery utilization'
      ],
      interpretation: 'Key inflation input - affects transportation, manufacturing, and consumer prices'
    },
    NG: {
      fullName: 'Natural Gas Futures',
      correlations: {
        positive: ['Weather'],
        negative: ['Mild weather'],
        related: ['LNG exports', 'Storage']
      },
      drivers: [
        'EIA Natural Gas Storage Report (Thursdays 10:30 AM ET)',
        'Weather forecasts (heating/cooling degree days)',
        'LNG export demand',
        'Production levels',
        'Storage vs 5-year average'
      ],
      interpretation: 'Very weather-sensitive - cold = bullish, mild = bearish. High volatility around EIA reports'
    },
    GC: {
      fullName: 'Gold Futures',
      correlations: {
        positive: ['SI', '6J', 'TLT'],
        negative: ['DX', 'Real yields'],
        related: ['GDX', 'Central bank buying']
      },
      drivers: [
        'Real yields (10Y minus CPI) - inverse relationship',
        'Dollar strength - inverse relationship',
        'Geopolitical fear - safe haven bid',
        'Central bank buying (China, India)',
        'Inflation expectations'
      ],
      interpretation: 'Safe haven and inflation hedge - rallies when real yields fall or fear rises'
    },
    '6J': {
      fullName: 'Japanese Yen Futures',
      correlations: {
        positive: ['VIX', 'GC', 'TLT'],
        negative: ['ES', 'NQ', 'Risk assets'],
        related: ['Nikkei', 'BOJ policy']
      },
      drivers: [
        'Risk sentiment (Yen up = risk-off)',
        'BOJ policy (yield curve control)',
        'US-Japan yield spread (carry trade)',
        'Japan intervention threats'
      ],
      interpretation: 'Classic safe haven - Yen strength signals risk-off, weakness signals risk-on'
    },
    '6E': {
      fullName: 'Euro Futures',
      correlations: {
        positive: ['European stocks'],
        negative: ['DX'],
        related: ['ECB policy', 'German data']
      },
      drivers: [
        'ECB policy vs Fed policy',
        'German economic data (IFO, ZEW)',
        'EU political stability',
        'Energy prices (Europe is energy importer)'
      ],
      interpretation: 'Inverse of dollar - EUR/USD is most traded currency pair globally'
    },
    ZC: {
      fullName: 'Corn Futures',
      correlations: {
        positive: ['ZS', 'ZW', 'Ethanol'],
        negative: ['Favorable weather'],
        related: ['Livestock feed', 'Brazil exports']
      },
      drivers: [
        'WASDE Report (monthly ~12th)',
        'USDA Crop Progress (Mondays Apr-Nov)',
        'Weather in Corn Belt (Iowa, Illinois)',
        'Ethanol demand',
        'Export sales'
      ],
      interpretation: 'Key feed grain - drought = bullish, good weather = bearish'
    },
    ZS: {
      fullName: 'Soybean Futures',
      correlations: {
        positive: ['ZC', 'ZM', 'ZL'],
        negative: ['Brazil harvest'],
        related: ['China demand', 'Crush margins']
      },
      drivers: [
        'China demand (largest importer)',
        'Brazil/Argentina production',
        'WASDE Report',
        'Crush demand (meal + oil)',
        'Weather'
      ],
      interpretation: 'Most globally traded grain - China demand is key driver'
    },
    BTC: {
      fullName: 'Bitcoin',
      correlations: {
        positive: ['NQ', 'ETH', 'Risk assets'],
        negative: ['DX', 'VIX'],
        related: ['MSTR', 'COIN', 'ETF flows']
      },
      drivers: [
        'ETF inflows/outflows (IBIT, FBTC)',
        'Risk sentiment (trades like NQ)',
        'Halving cycles',
        'Regulatory news',
        'Institutional adoption'
      ],
      interpretation: 'Risk-on asset - correlates with NQ. ETF flows are now major driver'
    }
  },

  // === INDICATOR EXPLANATIONS ===
  indicators: {
    VIX: {
      name: 'CBOE Volatility Index',
      what: 'Measures expected 30-day volatility in S&P 500 options',
      levels: {
        'below 15': 'Low fear, complacency - potential for complacent selloff',
        '15-20': 'Normal range, healthy market',
        '20-25': 'Elevated concern, increased hedging',
        '25-30': 'High fear, potential panic',
        'above 30': 'Extreme fear, often near market bottoms (contrarian buy)'
      },
      tradingUse: 'VIX spikes often mark short-term bottoms. Sustained low VIX can precede corrections.'
    },
    putCallRatio: {
      name: 'CBOE Put/Call Ratio',
      what: 'Ratio of put volume to call volume - measures options market sentiment',
      levels: {
        'below 0.65': 'Extreme greed/complacency - CONTRARIAN BEARISH (too many bulls)',
        '0.65-0.85': 'Neutral range - no strong signal',
        '0.85-1.0': 'Elevated fear - cautiously bullish',
        'above 1.0': 'Extreme fear - CONTRARIAN BULLISH (everyone bearish = time to buy)'
      },
      tradingUse: 'Works best at extremes. High P/C ratio means excessive put buying = contrarian buy signal'
    },
    COT: {
      name: 'Commitment of Traders',
      what: 'CFTC report showing futures positioning of different trader types',
      categories: {
        'Commercial': 'Hedgers (producers/consumers) - smart money',
        'Non-Commercial': 'Speculators (hedge funds) - trend followers',
        'Non-Reportable': 'Small traders - often wrong at extremes'
      },
      tradingUse: 'When speculators are extremely long = contrarian bearish. When extremely short = contrarian bullish.'
    },
    yieldCurve: {
      name: '10Y-2Y Treasury Spread',
      what: 'Difference between 10-year and 2-year Treasury yields',
      interpretation: {
        'Positive (normal)': 'Economy healthy, longer maturities pay more',
        'Flat': 'Slowing economy, uncertainty about growth',
        'Inverted (negative)': 'Recession warning - short rates above long rates'
      },
      tradingUse: 'Inversion predicts recessions but timing is unreliable. Un-inversion often precedes actual recession.'
    },
    goldSilverRatio: {
      name: 'Gold/Silver Ratio',
      what: 'How many ounces of silver needed to buy one ounce of gold',
      levels: {
        'below 65': 'Silver outperforming - risk-on, industrial demand strong',
        '65-80': 'Normal range',
        'above 80': 'Fear elevated - gold preferred over silver (safe haven bid)'
      },
      tradingUse: 'High ratio = fear. Extreme high = contrarian signal to buy silver vs gold.'
    },
    realYield: {
      name: 'Real Yield (10Y - CPI)',
      what: 'Treasury yield minus inflation - actual return after inflation',
      interpretation: {
        'Positive': 'Bonds offer real return - competition for stocks, negative for gold',
        'Negative': 'Bonds lose purchasing power - bullish for gold, supports stocks'
      },
      tradingUse: 'Rising real yields = headwind for gold and growth stocks. Falling = tailwind.'
    },
    crackSpread: {
      name: 'Crack Spread (RB - CL)',
      what: 'Difference between gasoline and crude oil prices - refinery profit margin',
      levels: {
        'below $15': 'Low margins - refineries may cut runs, bullish for crude',
        '$15-30': 'Normal margins',
        'above $30': 'High margins - refineries running full out, abundant gasoline'
      },
      tradingUse: 'Tight crack spreads can support crude as refineries bid for supply.'
    }
  },

  // === EVENT IMPACT EXPLANATIONS ===
  events: {
    FOMC: {
      name: 'Federal Open Market Committee',
      frequency: '8 times per year',
      impact: 'EXTREME',
      affects: ['ES', 'NQ', 'ZN', 'GC', 'DX', 'All risk assets'],
      whatToExpect: 'Rate decisions move everything. Statement language matters. Press conference can reverse initial move.'
    },
    NFP: {
      name: 'Non-Farm Payrolls',
      frequency: 'First Friday of month, 8:30 AM ET',
      impact: 'EXTREME',
      affects: ['ES', 'NQ', 'ZN', 'DX', 'GC'],
      interpretation: {
        'Strong jobs': 'Good for economy but Fed stays hawkish - mixed for stocks',
        'Weak jobs': 'Bad for economy but Fed may cut - often bullish for stocks',
        'Goldilocks': 'Moderate job growth with low wage inflation - best outcome'
      }
    },
    CPI: {
      name: 'Consumer Price Index',
      frequency: 'Monthly, ~13th, 8:30 AM ET',
      impact: 'EXTREME',
      affects: ['ES', 'NQ', 'ZN', 'GC', 'TLT'],
      interpretation: {
        'Higher than expected': 'Inflation fears rise, Fed stays hawkish - bearish stocks/bonds',
        'Lower than expected': 'Disinflation, Fed can pivot - bullish stocks/bonds',
        'As expected': 'Usually muted reaction unless trend changes'
      }
    },
    EIA_PETROLEUM: {
      name: 'EIA Weekly Petroleum Status',
      frequency: 'Wednesdays 10:30 AM ET',
      impact: 'HIGH for energy',
      affects: ['CL', 'RB', 'NG', 'XLE'],
      interpretation: {
        'Draw (inventory decrease)': 'Demand > supply = BULLISH for oil',
        'Build (inventory increase)': 'Supply > demand = BEARISH for oil',
        'vs expectations': 'What matters is actual vs forecast, not absolute number'
      }
    },
    EIA_NATGAS: {
      name: 'EIA Natural Gas Storage',
      frequency: 'Thursdays 10:30 AM ET',
      impact: 'EXTREME for NG',
      affects: ['NG'],
      interpretation: {
        'Injection less than expected': 'BULLISH - less supply added',
        'Injection more than expected': 'BEARISH - more supply added',
        'vs 5-year average': 'Storage relative to historical norms matters'
      }
    },
    WASDE: {
      name: 'World Agriculture Supply & Demand Estimates',
      frequency: 'Monthly, ~12th',
      impact: 'EXTREME for grains',
      affects: ['ZC', 'ZS', 'ZW', 'ZM', 'ZL'],
      interpretation: {
        'Lower production estimate': 'BULLISH - less supply',
        'Higher production estimate': 'BEARISH - more supply',
        'Demand changes': 'Export and consumption estimates also move prices'
      }
    }
  },

  // === WHY CERTAIN NEWS IS BEARISH/BULLISH ===
  newsLogic: {
    rateHikes: {
      why: 'Rate hikes hurt stocks because:',
      reasons: [
        '1. Higher borrowing costs reduce corporate profits',
        '2. Higher discount rate lowers present value of future earnings',
        '3. Bonds become more attractive (higher yields) vs stocks',
        '4. Slows economic growth by reducing spending/investment',
        '5. Growth stocks (NQ) especially hurt - rely on future earnings'
      ]
    },
    inflation: {
      why: 'High inflation hurts most assets because:',
      reasons: [
        '1. Forces Fed to keep rates higher for longer',
        '2. Erodes consumer purchasing power',
        '3. Increases input costs for companies',
        '4. Creates uncertainty - harder to plan/invest',
        '5. Exception: commodities and gold often benefit'
      ]
    },
    strongDollar: {
      why: 'Strong dollar (DXY up) affects markets:',
      reasons: [
        '1. Hurts US multinationals (foreign revenue worth less)',
        '2. Hurts commodities (priced in dollars, more expensive for foreign buyers)',
        '3. Hurts emerging markets (dollar-denominated debt harder to service)',
        '4. Helps importers (cheaper to buy foreign goods)',
        '5. Gold, oil, copper typically fall when dollar rises'
      ]
    },
    geopolitical: {
      why: 'Geopolitical tensions move markets:',
      reasons: [
        '1. Oil spikes on Middle East conflict (supply fears)',
        '2. Safe havens rally - gold, yen, Swiss franc, Treasuries',
        '3. Risk assets sell off - stocks, crypto, high-yield',
        '4. Grain prices spike on Black Sea/Ukraine issues',
        '5. Uncertainty causes volatility spike (VIX up)'
      ]
    },
    fedSpeak: {
      why: 'Fed officials\' comments move markets:',
      keywords: {
        'hawkish': 'Favors higher rates or slower cuts - BEARISH for stocks',
        'dovish': 'Favors lower rates or faster cuts - BULLISH for stocks',
        'data dependent': 'Waiting for more info - NEUTRAL but focus on upcoming data',
        'patient': 'No rush to change policy - status quo',
        'behind the curve': 'Fed needs to act faster - suggests bigger moves coming'
      }
    }
  }
};

// ============================================================================
// DATA GATHERING - Fetches current dashboard state
// ============================================================================

/**
 * Gather all current dashboard data for context
 */
async function gatherDashboardContext(dashboardData) {
  const context = {
    timestamp: new Date().toISOString(),
    instruments: {},
    news: [],
    fundamentals: {},
    indicators: {},
    events: []
  };

  // Extract instrument data
  if (dashboardData.instruments) {
    context.instruments = dashboardData.instruments;
  }

  // Extract news
  if (dashboardData.news || dashboardData.newsSummary) {
    context.news = dashboardData.news || dashboardData.newsSummary?.headlines || [];
  }

  // Extract fundamental data
  if (dashboardData.cotExtremes) {
    context.fundamentals.cot = dashboardData.cotExtremes;
  }
  if (dashboardData.putCallSentiment) {
    context.fundamentals.putCall = dashboardData.putCallSentiment;
  }
  if (dashboardData.eventRisk) {
    context.fundamentals.eventRisk = dashboardData.eventRisk;
  }

  // Extract scheduled reports
  if (dashboardData.scheduledReportsToday) {
    context.events = dashboardData.scheduledReportsToday;
  }

  // Extract daily brief
  if (dashboardData.dailyBrief) {
    context.dailyBrief = dashboardData.dailyBrief;
  }

  // Extract trending instruments
  if (dashboardData.trendingInstruments) {
    context.trending = dashboardData.trendingInstruments;
  }

  return context;
}

// ============================================================================
// KNOWLEDGE FORMATTING - Prepares knowledge for AI
// ============================================================================

/**
 * Format relevant knowledge based on the question
 * Enhanced with comprehensive knowledge base
 */
function formatRelevantKnowledge(question) {
  const questionLower = question.toLowerCase();
  let relevantKnowledge = [];

  // === ENHANCED: Pull from comprehensive knowledge base ===
  const kbContext = buildKnowledgeContext(question);
  if (kbContext && kbContext.trim().length > 0) {
    relevantKnowledge.push(kbContext);
  }

  // Check for instrument-specific questions
  for (const [symbol, info] of Object.entries(MARKET_KNOWLEDGE.instrumentRelationships)) {
    if (questionLower.includes(symbol.toLowerCase()) ||
        questionLower.includes(info.fullName.toLowerCase())) {
      relevantKnowledge.push(`
ABOUT ${symbol} (${info.fullName}):
- Correlations: Positive with ${info.correlations.positive.join(', ')}. Negative with ${info.correlations.negative.join(', ')}.
- Key Drivers: ${info.drivers.join('; ')}
- Interpretation: ${info.interpretation}
`);
    }
  }

  // Check for indicator questions
  for (const [key, indicator] of Object.entries(MARKET_KNOWLEDGE.indicators)) {
    if (questionLower.includes(key.toLowerCase()) ||
        questionLower.includes(indicator.name.toLowerCase())) {
      let levelInfo = '';
      if (indicator.levels) {
        levelInfo = '\nLevels:\n' + Object.entries(indicator.levels)
          .map(([level, meaning]) => `  ${level}: ${meaning}`)
          .join('\n');
      }
      if (indicator.interpretation) {
        levelInfo = '\nInterpretation:\n' + Object.entries(indicator.interpretation)
          .map(([level, meaning]) => `  ${level}: ${meaning}`)
          .join('\n');
      }
      relevantKnowledge.push(`
ABOUT ${indicator.name}:
What it is: ${indicator.what}
${levelInfo}
Trading use: ${indicator.tradingUse}
`);
    }
  }

  // Check for news/sentiment questions
  if (questionLower.includes('bearish') || questionLower.includes('bullish') ||
      questionLower.includes('news') || questionLower.includes('headline') ||
      questionLower.includes('sentiment')) {
    relevantKnowledge.push(`
SENTIMENT KEYWORDS AND THEIR MEANING:

BEARISH keywords:
${Object.entries(MARKET_KNOWLEDGE.sentimentKeywords.bearish).slice(0, 10)
  .map(([word, meaning]) => `- "${word}": ${meaning}`).join('\n')}

BULLISH keywords:
${Object.entries(MARKET_KNOWLEDGE.sentimentKeywords.bullish).slice(0, 10)
  .map(([word, meaning]) => `- "${word}": ${meaning}`).join('\n')}
`);
  }

  // Check for event questions
  if (questionLower.includes('report') || questionLower.includes('event') ||
      questionLower.includes('cpi') || questionLower.includes('nfp') ||
      questionLower.includes('fomc') || questionLower.includes('eia')) {
    for (const [key, event] of Object.entries(MARKET_KNOWLEDGE.events)) {
      if (questionLower.includes(key.toLowerCase()) ||
          questionLower.includes(event.name.toLowerCase())) {
        let interpInfo = '';
        if (event.interpretation) {
          interpInfo = '\nInterpretation:\n' + Object.entries(event.interpretation)
            .map(([scenario, meaning]) => `  ${scenario}: ${meaning}`)
            .join('\n');
        }
        relevantKnowledge.push(`
ABOUT ${event.name}:
- Frequency: ${event.frequency}
- Impact: ${event.impact}
- Affects: ${event.affects.join(', ')}
${interpInfo}
${event.whatToExpect ? `What to expect: ${event.whatToExpect}` : ''}
`);
      }
    }
  }

  // Check for "why" questions about market logic
  if (questionLower.includes('why') || questionLower.includes('how') ||
      questionLower.includes('explain')) {
    if (questionLower.includes('rate') || questionLower.includes('fed')) {
      relevantKnowledge.push(`
${MARKET_KNOWLEDGE.newsLogic.rateHikes.why}
${MARKET_KNOWLEDGE.newsLogic.rateHikes.reasons.join('\n')}
`);
    }
    if (questionLower.includes('inflation')) {
      relevantKnowledge.push(`
${MARKET_KNOWLEDGE.newsLogic.inflation.why}
${MARKET_KNOWLEDGE.newsLogic.inflation.reasons.join('\n')}
`);
    }
    if (questionLower.includes('dollar') || questionLower.includes('dxy')) {
      relevantKnowledge.push(`
${MARKET_KNOWLEDGE.newsLogic.strongDollar.why}
${MARKET_KNOWLEDGE.newsLogic.strongDollar.reasons.join('\n')}
`);
    }
  }

  // Check for COT/positioning questions
  if (questionLower.includes('cot') || questionLower.includes('crowded') ||
      questionLower.includes('positioning') || questionLower.includes('contrarian')) {
    relevantKnowledge.push(`
ABOUT COT (Commitment of Traders):
${MARKET_KNOWLEDGE.indicators.COT.what}

Categories:
${Object.entries(MARKET_KNOWLEDGE.indicators.COT.categories)
  .map(([cat, desc]) => `- ${cat}: ${desc}`).join('\n')}

Trading Use: ${MARKET_KNOWLEDGE.indicators.COT.tradingUse}

CROWDED POSITIONING EXPLAINED:
- "Crowded Long" means speculators have extreme long positions
  → This is CONTRARIAN BEARISH because everyone who wants to buy already has
  → When they need to exit, selling pressure causes pullbacks

- "Crowded Short" means speculators have extreme short positions
  → This is CONTRARIAN BULLISH because everyone who wants to sell already has
  → Short covering can cause sharp rallies
`);
  }

  // Check for Put/Call questions
  if (questionLower.includes('put') || questionLower.includes('call') ||
      questionLower.includes('p/c') || questionLower.includes('fear') ||
      questionLower.includes('greed')) {
    relevantKnowledge.push(`
ABOUT PUT/CALL RATIO:
${MARKET_KNOWLEDGE.indicators.putCallRatio.what}

Levels:
${Object.entries(MARKET_KNOWLEDGE.indicators.putCallRatio.levels)
  .map(([level, meaning]) => `- ${level}: ${meaning}`).join('\n')}

Trading Use: ${MARKET_KNOWLEDGE.indicators.putCallRatio.tradingUse}
`);
  }

  return relevantKnowledge.join('\n---\n');
}

/**
 * Format keyword mappings for context
 */
function formatKeywordMappings() {
  let output = 'NEWS KEYWORD TO INSTRUMENT MAPPINGS:\n\n';

  for (const [group, keywords] of Object.entries(NEWS_KEYWORD_MAP)) {
    const symbols = KEYWORD_GROUP_TO_SYMBOLS[group] || [];
    output += `${group} → Affects: ${symbols.join(', ')}\n`;
    output += `  Keywords: ${keywords.slice(0, 8).join(', ')}...\n\n`;
  }

  return output;
}

// ============================================================================
// MAIN CHAT FUNCTION - Uses ALL available data
// ============================================================================

// Cache for full market context (30 second TTL)
let fullContextCache = null;
let contextCacheTimestamp = 0;
const CONTEXT_CACHE_TTL = 30 * 1000;

function isContextCacheValid() {
  return fullContextCache && (Date.now() - contextCacheTimestamp < CONTEXT_CACHE_TTL);
}

/**
 * Build comprehensive market context for the AI
 */
async function buildFullMarketContext() {
  // Return cached if valid
  if (isContextCacheValid()) {
    return fullContextCache;
  }

  console.log('Chatbot: Building full market context...');

  // Fetch ALL data sources in parallel
  const [
    esCommandCenter,
    finalAnalysis,
    todaysReports,
    eventRisk,
    cotData,
    putCallData
  ] = await Promise.allSettled([
    getESCommandCenter().catch(e => null),
    generateFinalAnalysis().catch(e => null),
    Promise.resolve(getTodaysReports()),
    Promise.resolve(getEventRiskSummary()),
    Promise.resolve(getAllCOTData()),
    Promise.resolve(getPutCallRatio())
  ]);

  const context = {
    timestamp: new Date().toISOString(),
    session: getCurrentSession(),
    nextSession: getNextSession(),

    // ES Command Center - drivers, correlations, institutional
    esCommandCenter: esCommandCenter.status === 'fulfilled' ? {
      es: esCommandCenter.value?.es,
      bias: esCommandCenter.value?.bias,
      drivers: esCommandCenter.value?.drivers?.slice(0, 6),
      correlations: esCommandCenter.value?.correlations,
      vix: esCommandCenter.value?.correlations?.VIX,
      institutional: {
        creditSpread: esCommandCenter.value?.institutional?.creditSpread,
        gapAnalysis: esCommandCenter.value?.institutional?.gapAnalysis,
        opex: esCommandCenter.value?.institutional?.opexCalendar,
        seasonality: esCommandCenter.value?.institutional?.seasonality
      },
      mag7: esCommandCenter.value?.mag7?.stocks,
      sectors: esCommandCenter.value?.sectors
    } : null,

    // Final Analysis - top picks, trending, news
    analysis: finalAnalysis.status === 'fulfilled' ? {
      topPicks: finalAnalysis.value?.topPicks?.slice(0, 5),
      trending: finalAnalysis.value?.trendingInstruments?.slice(0, 5),
      dailyBrief: finalAnalysis.value?.dailyBrief,
      overallBias: finalAnalysis.value?.overallBias
    } : null,

    // Today's Reports from reportSchedule.js (field names: report, affects, impact, description)
    scheduledReports: todaysReports.status === 'fulfilled' ?
      todaysReports.value?.map(r => ({
        name: r.report || r.name || 'Unknown Report',
        shortName: r.shortName || r.report || 'Report',
        time: r.time || 'TBD',
        importance: r.impact || r.importance || 'MEDIUM',
        affectedInstruments: r.affects || r.affectedInstruments || [],
        description: r.description || '',
        scenarios: r.scenarios || null,
        type: r.type || 'SCHEDULED'
      })) : [],

    // Full Reports Calendar from fundamentalReports.js (richer data with scenarios)
    upcomingReports: (() => {
      try {
        const cal = buildReportsCalendar();
        return cal?.calendar?.slice(0, 3)?.map(day => ({
          date: day.date,
          dateLabel: day.dateLabel,
          isToday: day.isToday,
          isTomorrow: day.isTomorrow,
          reports: day.reports?.map(r => ({
            name: r.name || r.shortName,
            shortName: r.shortName || r.name,
            time: r.time,
            importance: r.importance,
            category: r.category,
            affectedInstruments: r.affectedInstruments || [],
            description: r.description || '',
            scenarios: r.scenarios || null
          }))
        })) || [];
      } catch (e) {
        return [];
      }
    })(),

    // Event Risk Level
    eventRisk: eventRisk.status === 'fulfilled' ? eventRisk.value : null,

    // COT Positioning
    cot: cotData.status === 'fulfilled' ? {
      extremes: cotData.value?.extremes,
      crowdedLong: cotData.value?.extremes?.crowdedLong || [],
      crowdedShort: cotData.value?.extremes?.crowdedShort || []
    } : null,

    // Put/Call Sentiment
    putCall: putCallData.status === 'fulfilled' ? {
      equityPC: putCallData.value?.equityPC,
      totalPC: putCallData.value?.totalPC,
      interpretation: putCallData.value?.interpretation,
      signal: putCallData.value?.signal
    } : null,

    // Top News Headlines
    news: esCommandCenter.status === 'fulfilled' ?
      esCommandCenter.value?.news?.slice(0, 10).map(n => ({
        headline: n.headline,
        bias: n.bias,
        impact: n.impact,
        affectedInstruments: n.affectedInstruments,
        relativeTime: n.relativeTime
      })) : []
  };

  // Cache it
  fullContextCache = context;
  contextCacheTimestamp = Date.now();

  return context;
}

/**
 * Answer a user question with FULL market context
 */
async function answerQuestion(question, dashboardData = {}) {
  // Get FULL market context (cached for 30 sec)
  const fullContext = await buildFullMarketContext();

  // Get relevant knowledge based on question
  const relevantKnowledge = formatRelevantKnowledge(question);

  // Build the prompt with ALL data
  const prompt = `You are the Jinah Dashboard AI Assistant - a senior trading desk analyst with encyclopedic knowledge of futures markets, fundamental reports, and cross-market relationships.

You have COMPLETE access to all market data AND a comprehensive knowledge base covering:
- Every major economic/commodity report (WASDE, Cattle on Feed, EIA, NFP, CPI, FOMC, etc.)
- How each report is generated, what it measures, and exactly how to read the results
- Deep instrument profiles for 30+ futures contracts across indices, metals, energy, agriculture, currencies, and crypto
- Cross-market correlations and what multi-asset moves mean
- How the dashboard generates its outputs (bias calculations, context blurbs, AI analysis)
- Educational explanations of trading concepts (carry trade, order blocks, value area, liquidity sweeps, etc.)
- Agricultural market cycles (cattle cycle, crop seasons, etc.)
- Session-specific analysis (Asia, London, US)

When answering questions about reports, explain WHAT the report measures, HOW to read it, WHO publishes it, WHEN it comes out, and HOW it impacts specific instruments. Be specific and educational.

When asked about market impact (e.g., "how will cattle on feed affect cattle"), provide the actual mechanism and historical context, not just generic commentary.

=== CURRENT MARKET STATE ===

SESSION: ${fullContext.session?.name || 'Unknown'} (Next: ${fullContext.nextSession?.name})

ES FUTURES:
${fullContext.esCommandCenter?.es ? `- Price: ${fullContext.esCommandCenter.es.price} (${fullContext.esCommandCenter.es.changePercent?.toFixed(2)}%)
- Bias: ${fullContext.esCommandCenter?.bias?.direction} (${fullContext.esCommandCenter?.bias?.confidence}% confidence)` : 'Data unavailable'}

TOP DRIVERS RIGHT NOW:
${fullContext.esCommandCenter?.drivers?.map(d => `- ${d.name}: ${d.direction} — ${d.reason}`).join('\n') || 'None detected'}

KEY CORRELATIONS:
${fullContext.esCommandCenter?.correlations ? `- VIX: ${fullContext.esCommandCenter.correlations.VIX?.price} (${fullContext.esCommandCenter.correlations.VIX?.changePercent?.toFixed(1)}%)
- 10Y Yield: ${fullContext.esCommandCenter.correlations.TNX?.price}% (${fullContext.esCommandCenter.correlations.TNX?.changeBps}bp)
- DXY: ${fullContext.esCommandCenter.correlations.DXY?.price} (${fullContext.esCommandCenter.correlations.DXY?.changePercent?.toFixed(2)}%)
- NQ: ${fullContext.esCommandCenter.correlations.NQ?.changePercent?.toFixed(2)}%
- RTY: ${fullContext.esCommandCenter.correlations.RTY?.changePercent?.toFixed(2)}%` : 'Data unavailable'}

=== SCHEDULED REPORTS TODAY ===
${fullContext.scheduledReports?.length > 0 ?
  fullContext.scheduledReports.map(r => `- ${r.name} at ${r.time} [${r.importance}] → Affects: ${Array.isArray(r.affectedInstruments) ? r.affectedInstruments.join(', ') : r.affectedInstruments}${r.description ? ' — ' + r.description : ''}${r.scenarios ? '\n  Bullish: ' + r.scenarios.bullish + '\n  Bearish: ' + r.scenarios.bearish : ''}`).join('\n')
  : 'No major reports from reportSchedule today'}

=== UPCOMING REPORTS CALENDAR (from dashboard) ===
${fullContext.upcomingReports?.length > 0 ?
  fullContext.upcomingReports.map(day => `${day.dateLabel} (${day.date}):\n${day.reports?.map(r => `  - ${r.name} at ${r.time} [${r.importance}] [${r.category}] → Affects: ${Array.isArray(r.affectedInstruments) ? r.affectedInstruments.join(', ') : r.affectedInstruments}${r.description ? '\n    ' + r.description : ''}${r.scenarios ? '\n    Bullish: ' + r.scenarios.bullish + '\n    Bearish: ' + r.scenarios.bearish : ''}`).join('\n') || '  No reports'}`).join('\n')
  : 'No upcoming reports loaded'}

EVENT RISK LEVEL: ${fullContext.eventRisk?.level || fullContext.eventRisk?.riskLevel || 'Unknown'}

=== POSITIONING & SENTIMENT ===

COT EXTREMES:
- Crowded Long (contrarian bearish): ${fullContext.cot?.crowdedLong?.join(', ') || 'None'}
- Crowded Short (contrarian bullish): ${fullContext.cot?.crowdedShort?.join(', ') || 'None'}

PUT/CALL RATIO: ${fullContext.putCall?.equityPC || 'N/A'} — ${fullContext.putCall?.interpretation || 'No signal'}

=== TOP PICKS FROM ANALYSIS ===
${fullContext.analysis?.topPicks?.map(p => `- ${p.symbol}: ${p.bias} (${p.confidence}%) — ${p.summary || p.reason || ''}`).join('\n') || 'None'}

=== TRENDING INSTRUMENTS ===
${fullContext.analysis?.trending?.map(t => `- ${t.symbol}: ${t.mentionCount} mentions, ${t.bias}`).join('\n') || 'None'}

=== LATEST NEWS ===
${fullContext.news?.map(n => `- [${n.bias?.toUpperCase()}] ${n.headline} (${n.relativeTime})`).join('\n') || 'No recent news'}

=== INSTITUTIONAL CONTEXT ===
- Credit Spread: ${fullContext.esCommandCenter?.institutional?.creditSpread?.signal || 'N/A'}
- Gap: ${fullContext.esCommandCenter?.institutional?.gapAnalysis?.gapType || 'N/A'} (${fullContext.esCommandCenter?.institutional?.gapAnalysis?.fillProbability}% fill probability)
- OPEX: ${fullContext.esCommandCenter?.institutional?.opex?.context || 'N/A'}
- Seasonality: ${fullContext.esCommandCenter?.institutional?.seasonality?.overallBias || 'N/A'}

=== MAG7 IMPACT ===
${fullContext.esCommandCenter?.mag7 ? Object.entries(fullContext.esCommandCenter.mag7).map(([sym, data]) =>
  `- ${data.name}: ${data.changePercent?.toFixed(1)}% (${data.esContribution?.toFixed(1)} pts ES impact)`
).join('\n') : 'Data unavailable'}

=== KNOWLEDGE BASE ===
${relevantKnowledge}

=== USER QUESTION ===
${question}

INSTRUCTIONS:
1. Answer using the SPECIFIC DATA above - cite numbers, levels, reports
2. If asked about reports/events, use BOTH the SCHEDULED REPORTS section AND the KNOWLEDGE BASE for deep explanations
3. If asked about positioning, use the COT EXTREMES section and explain what crowded positioning means
4. If asked about news, use the LATEST NEWS section and explain WHY the headline is bullish/bearish
5. If asked "what is" or "how does" questions, provide educational answers from the knowledge base
6. If asked about a specific report (e.g., "what is cattle on feed"), explain what it measures, how to read it, when it comes out, and what the bullish/bearish scenarios are
7. If asked about cross-market relationships, explain the correlation mechanism and trading implications
8. If asked how dashboard outputs are generated, explain the data flow and calculation methodology
9. Be concise for simple data queries, but thorough for educational/research questions
10. Always explain the WHY behind market moves, not just the WHAT
11. If data is missing, say so clearly

For data queries: keep under 200 words.
For educational/research questions: be as thorough as needed (up to 500 words).`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      success: true,
      answer: response.content[0].text,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Chatbot error:', error.message);
    return {
      success: false,
      error: error.message,
      answer: 'I encountered an error processing your question. Please try again.'
    };
  }
}

/**
 * Explain a specific headline's sentiment
 */
async function explainHeadline(headline, sentiment, dashboardData = {}) {
  // Tag the headline with affected symbols
  const affectedSymbols = tagHeadlineWithSymbols(headline);

  // Find which keywords matched
  const headlineLower = headline.toLowerCase();
  const matchedKeywords = [];

  for (const [group, keywords] of Object.entries(NEWS_KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (headlineLower.includes(keyword.toLowerCase())) {
        const symbols = KEYWORD_GROUP_TO_SYMBOLS[group] || [];
        matchedKeywords.push({
          keyword,
          group,
          symbols,
          explanation: MARKET_KNOWLEDGE.sentimentKeywords.bearish[keyword.toLowerCase()] ||
                       MARKET_KNOWLEDGE.sentimentKeywords.bullish[keyword.toLowerCase()] ||
                       'Triggers instrument detection'
        });
      }
    }
  }

  const prompt = `You are explaining why a news headline is ${sentiment} to a trader.

HEADLINE: "${headline}"

DETECTED AFFECTED SYMBOLS: ${affectedSymbols.join(', ') || 'None detected'}

MATCHED KEYWORDS:
${matchedKeywords.map(k => `- "${k.keyword}" → Affects ${k.symbols.join(', ')}: ${k.explanation}`).join('\n')}

SENTIMENT CLASSIFIED AS: ${sentiment}

Explain in 2-3 sentences:
1. What specific words/phrases in the headline trigger this sentiment
2. Why those factors are ${sentiment} for the affected instruments
3. What a trader should take away from this headline`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      success: true,
      headline,
      sentiment,
      affectedSymbols,
      matchedKeywords: matchedKeywords.map(k => k.keyword),
      explanation: response.content[0].text,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Headline explanation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Explain why an instrument has a specific bias
 */
async function explainInstrumentBias(symbol, instrumentData, dashboardData = {}) {
  const context = await gatherDashboardContext(dashboardData);
  const instrumentKnowledge = MARKET_KNOWLEDGE.instrumentRelationships[symbol] || {};

  const prompt = `Explain why ${symbol} is showing ${instrumentData.bias || 'this'} bias.

INSTRUMENT DATA:
${JSON.stringify(instrumentData, null, 2)}

INSTRUMENT KNOWLEDGE:
${JSON.stringify(instrumentKnowledge, null, 2)}

CURRENT MARKET CONTEXT:
${JSON.stringify(context, null, 2)}

Explain in 3-4 bullet points:
1. The primary factors driving the bias (news, technicals, fundamentals)
2. Any correlated instruments supporting this view
3. Key levels or events to watch
4. Confidence level and what could change the outlook`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      success: true,
      symbol,
      explanation: response.content[0].text,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Instrument explanation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// COMPREHENSIVE MARKET ANALYSIS - "What to look for now"
// ============================================================================

// Cache for market brief (60 second TTL)
let marketBriefCache = null;
let briefCacheTimestamp = 0;
const BRIEF_CACHE_TTL = 60 * 1000; // 60 seconds

function isBriefCacheValid() {
  return marketBriefCache && (Date.now() - briefCacheTimestamp < BRIEF_CACHE_TTL);
}

/**
 * Fetch ALL available data for comprehensive analysis
 */
async function fetchAllMarketData() {
  const results = {
    timestamp: new Date().toISOString(),
    session: getCurrentSession(),
    nextSession: getNextSession()
  };

  // Fetch all data sources in parallel
  const [
    esCommandCenter,
    finalAnalysis,
    todaysReports,
    eventRisk,
    cotData,
    putCallData
  ] = await Promise.allSettled([
    getESCommandCenter().catch(e => ({ error: e.message })),
    generateFinalAnalysis().catch(e => ({ error: e.message })),
    Promise.resolve(getTodaysReports()),
    Promise.resolve(getEventRiskSummary()),
    Promise.resolve(getAllCOTData()),
    Promise.resolve(getPutCallRatio())
  ]);

  // Extract successful results
  if (esCommandCenter.status === 'fulfilled') {
    results.esCommandCenter = esCommandCenter.value;
  }
  if (finalAnalysis.status === 'fulfilled') {
    results.finalAnalysis = finalAnalysis.value;
  }
  if (todaysReports.status === 'fulfilled') {
    results.todaysReports = todaysReports.value;
  }
  if (eventRisk.status === 'fulfilled') {
    results.eventRisk = eventRisk.value;
  }
  if (cotData.status === 'fulfilled') {
    results.cot = cotData.value;
  }
  if (putCallData.status === 'fulfilled') {
    results.putCall = putCallData.value;
  }

  return results;
}

/**
 * Generate a smart market brief - "What to look for now"
 */
async function getMarketBrief() {
  // Return cached brief if valid
  if (isBriefCacheValid()) {
    console.log('Market Brief: returning cached data');
    return marketBriefCache;
  }

  console.log('Market Brief: generating fresh analysis...');
  const startTime = Date.now();

  const data = await fetchAllMarketData();

  // Build condensed summary for AI
  const summary = {
    session: `${data.session?.name || 'Unknown'} session`,
    nextSession: data.nextSession?.name || 'Unknown',

    // ES specific
    esPrice: data.esCommandCenter?.es?.price,
    esChange: data.esCommandCenter?.es?.changePercent?.toFixed(2) + '%',
    esBias: data.esCommandCenter?.bias?.direction,
    esConfidence: data.esCommandCenter?.bias?.confidence,
    topDrivers: data.esCommandCenter?.drivers?.slice(0, 4).map(d => ({
      name: d.name,
      direction: d.direction,
      reason: d.reason
    })),

    // Key correlations
    vix: data.esCommandCenter?.correlations?.VIX,
    dxy: data.esCommandCenter?.correlations?.DXY,

    // Institutional context
    creditSpread: data.esCommandCenter?.institutional?.creditSpread?.signal,
    gapType: data.esCommandCenter?.institutional?.gapAnalysis?.gapType,
    gapFillProb: data.esCommandCenter?.institutional?.gapAnalysis?.fillProbability,

    // Final analysis top picks
    topPicks: data.finalAnalysis?.topPicks?.slice(0, 3).map(p => ({
      symbol: p.symbol,
      bias: p.bias,
      confidence: p.confidence,
      reason: p.summary || p.reason
    })),

    // Trending
    trending: data.finalAnalysis?.trendingInstruments?.slice(0, 3).map(t => ({
      symbol: t.symbol,
      mentions: t.mentionCount,
      bias: t.bias
    })),

    // Events
    eventRisk: data.eventRisk?.level,
    todaysReports: data.todaysReports?.slice(0, 3).map(r => ({
      name: r.shortName || r.name,
      time: r.time,
      importance: r.importance,
      affects: r.affectedInstruments?.slice(0, 3)
    })),

    // COT extremes
    crowdedLong: data.cot?.extremes?.crowdedLong || [],
    crowdedShort: data.cot?.extremes?.crowdedShort || [],

    // Put/Call
    putCallRatio: data.putCall?.equityPC,
    putCallSignal: data.putCall?.interpretation,

    // Top news
    topNews: data.esCommandCenter?.news?.slice(0, 3).map(n => ({
      headline: n.headline?.substring(0, 80),
      bias: n.bias,
      impact: n.impact
    }))
  };

  // Generate AI brief
  const prompt = `You are a senior trading desk analyst giving a 30-second morning brief. Be EXTREMELY concise.

CURRENT MARKET STATE:
${JSON.stringify(summary, null, 2)}

Give a brief that answers "What should I look for now?" in this EXACT format:

**[SESSION] BRIEF**

🎯 **TOP FOCUS:** [1 symbol] - [1 sentence why]

⚠️ **WATCH:** [1-2 other symbols with quick reason]

📊 **DRIVERS:** [List 2-3 key drivers in bullet format]

🗓️ **EVENTS:** [Any upcoming reports or "Clear calendar"]

💡 **EDGE:** [One actionable insight]

RULES:
- Maximum 100 words total
- No fluff, no disclaimers
- Symbol + direction + why in minimal words
- If no clear opportunity, say "No clear setup, wait for X"`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = {
      success: true,
      brief: response.content[0].text,
      data: summary,
      timestamp: new Date().toISOString()
    };

    // Cache the result
    marketBriefCache = result;
    briefCacheTimestamp = Date.now();
    console.log(`Market Brief: generated in ${Date.now() - startTime}ms`);

    return result;
  } catch (error) {
    console.error('Market brief error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if question is asking for market overview/brief
 */
function isMarketBriefQuestion(question) {
  const briefKeywords = [
    'what to look for',
    'what should i look',
    'what to watch',
    'what\'s moving',
    'whats moving',
    'market brief',
    'morning brief',
    'quick brief',
    'give me a brief',
    'summary',
    'overview',
    'what\'s happening',
    'whats happening',
    'what now',
    'what should i trade',
    'any opportunities',
    'any setups',
    'what\'s the play',
    'whats the play',
    'what do you see',
    'analyze the market',
    'market analysis',
    'current situation',
    'give me the rundown',
    'what\'s hot',
    'whats hot'
  ];

  const questionLower = question.toLowerCase();
  return briefKeywords.some(kw => questionLower.includes(kw));
}

/**
 * Check if question is a research/educational question that needs deep knowledge
 * Only triggers for questions that are clearly asking for explanations about
 * specific reports, concepts, or mechanisms — NOT simple market data queries
 */
function isResearchQuestion(question) {
  const questionLower = question.toLowerCase().trim();

  // Skip short questions (< 5 words) — those are simple data queries
  if (questionLower.split(/\s+/).length < 5) return false;

  // These specific topics ALWAYS trigger research mode
  const topicKeywords = [
    'cattle on feed', 'wasde', 'crop progress',
    'eia report', 'nfp report', 'cpi report',
    'fomc meeting', 'cattle cycle',
    'carry trade', 'crack spread',
    'order block', 'value area', 'liquidity sweep',
    'yield curve', 'contango', 'backwardation',
    'opex effect', 'options expiration effect',
    'cot report', 'put call ratio',
    'hogs and pigs', 'export sales report',
    'planting intentions', 'treasury auction',
    'cattle market', 'hog market',
    'how dashboard', 'how bias is calculated'
  ];

  if (topicKeywords.some(kw => questionLower.includes(kw))) return true;

  // These phrases indicate educational intent (but only if question is long enough)
  const educationalPhrases = [
    'what is the ', 'what are the ', 'what does the ',
    'how does the ', 'how do the ',
    'explain the ', 'explain how ', 'explain why ',
    'tell me about the ', 'describe the ', 'describe how ',
    'teach me about', 'help me understand',
    'what impact does', 'what effect does',
    'what happens when', 'what happens if',
    'how will the ', 'how would the ',
    'how is the ', 'how are the '
  ];

  if (educationalPhrases.some(kw => questionLower.includes(kw))) return true;

  return false;
}

/**
 * Answer a research/educational question with deep knowledge base
 * Falls back to standard handler if research handler fails
 */
async function answerResearchQuestion(question, cachedData = {}) {
  try {
    // Safely build knowledge context — if KB import failed, these return empty strings
    let knowledgeContext = '';
    let researchContext = '';
    let systemOverview = '';

    try {
      knowledgeContext = buildKnowledgeContext(question) || '';
    } catch (e) {
      console.error('Knowledge context build failed:', e.message);
    }

    try {
      researchContext = searchResearchKnowledge(question) || '';
    } catch (e) {
      console.error('Research context build failed:', e.message);
    }

    try {
      systemOverview = DASHBOARD_SYSTEM_KNOWLEDGE?.overview || '';
    } catch (e) {
      systemOverview = '';
    }

    // If we got no knowledge context at all, fall back to standard handler
    if (!knowledgeContext && !researchContext) {
      console.log('Research: No knowledge context found, falling back to standard handler');
      return await answerQuestion(question, cachedData);
    }

    const prompt = `You are the Jinah Dashboard AI Assistant — a senior trading desk analyst and educator. A trader is asking a research or educational question.

QUESTION: "${question}"

=== KNOWLEDGE BASE CONTEXT ===
${knowledgeContext || 'No specific knowledge base match found.'}

${researchContext ? `=== RESEARCH CONCEPTS ===\n${researchContext}` : ''}

${systemOverview ? `=== DASHBOARD SYSTEM OVERVIEW ===\n${systemOverview}` : ''}

INSTRUCTIONS:
1. Answer the question thoroughly and educationally
2. Use the knowledge base context above — it contains detailed report explanations, instrument profiles, and market concepts
3. Explain the MECHANISM — not just "it's bullish" but WHY and HOW
4. Include specific numbers, dates, and schedules where relevant
5. If the question is about a report, cover: what it measures, how to read it, when it comes out, bullish/bearish scenarios, and which instruments it affects
6. If the question is about market impact, explain the transmission mechanism (e.g., "drought → less pasture → forced cattle liquidation → short-term supply surge → prices drop temporarily → long-term herd shrinkage → prices rise")
7. Use bullet points and clear structure for readability
8. Be thorough — this is an educational response, not a quick data query

Aim for 200-500 words depending on complexity.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      success: true,
      type: 'research',
      answer: response.content[0].text,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Research question error, falling back to standard handler:', error.message);
    // FALLBACK: Use the standard answerQuestion instead of showing error
    try {
      return await answerQuestion(question, cachedData);
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError.message);
      return {
        success: false,
        error: fallbackError.message,
        answer: 'I encountered an error processing your question. Please try again.'
      };
    }
  }
}

/**
 * Enhanced answer function with smart analysis and research capability
 */
async function answerQuestionSmart(question, cachedData = {}) {
  // Check if asking for market brief/overview
  if (isMarketBriefQuestion(question)) {
    return await getMarketBrief();
  }

  // Check if this is a research/educational question
  if (isResearchQuestion(question)) {
    return await answerResearchQuestion(question, cachedData);
  }

  // Otherwise use standard answer with cached data only (fast)
  return await answerQuestion(question, cachedData);
}

export {
  answerQuestion,
  answerQuestionSmart,
  answerResearchQuestion,
  getMarketBrief,
  explainHeadline,
  explainInstrumentBias,
  gatherDashboardContext,
  fetchAllMarketData,
  isResearchQuestion,
  MARKET_KNOWLEDGE,
  REPORT_KNOWLEDGE,
  EXTENDED_INSTRUMENT_KNOWLEDGE,
  RESEARCH_KNOWLEDGE
};
