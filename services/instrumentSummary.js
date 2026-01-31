// Instrument Summary Service
// Generates user-friendly summaries explaining what's driving each instrument

/**
 * Instrument-specific fundamental relationships
 * Defines how each instrument responds to key market factors
 */
const INSTRUMENT_DRIVERS = {
  // Equity Index Futures
  ES: {
    name: 'S&P 500 E-mini',
    category: 'Equity Index',
    drivers: {
      VIX: { relationship: 'inverse', description: 'Lower VIX = risk-on = bullish ES' },
      ZN: { relationship: 'inverse', description: 'Rising ZN (falling yields) = bullish ES' },
      DX: { relationship: 'inverse', description: 'Weaker dollar = bullish for US equities' },
      earnings: { relationship: 'direct', description: 'Strong earnings = bullish' }
    },
    keyFactors: ['Fed policy', 'Earnings season', 'Economic data', 'Risk sentiment']
  },
  NQ: {
    name: 'Nasdaq 100 E-mini',
    category: 'Equity Index',
    drivers: {
      VIX: { relationship: 'inverse', description: 'Lower VIX = risk-on = bullish NQ' },
      ZN: { relationship: 'inverse', description: 'Lower yields favor growth stocks' },
      DX: { relationship: 'inverse', description: 'Weaker dollar supports tech' },
      mag7: { relationship: 'direct', description: 'Mag 7 earnings drive NQ' }
    },
    keyFactors: ['Tech earnings', 'AI narrative', 'Interest rates', 'Mag 7 stocks']
  },
  YM: {
    name: 'Dow Jones E-mini',
    category: 'Equity Index',
    drivers: {
      VIX: { relationship: 'inverse', description: 'Lower VIX = bullish' },
      ZN: { relationship: 'inverse', description: 'Lower yields help industrials' },
      DX: { relationship: 'mixed', description: 'Multi-nationals prefer weaker dollar' }
    },
    keyFactors: ['Industrial production', 'Trade policy', 'Blue chip earnings']
  },
  RTY: {
    name: 'Russell 2000 E-mini',
    category: 'Equity Index',
    drivers: {
      VIX: { relationship: 'inverse', description: 'Risk-on = small caps outperform' },
      ZN: { relationship: 'strong_inverse', description: 'Rate-sensitive small caps love lower yields' },
      DX: { relationship: 'inverse', description: 'Domestic focus benefits from strong dollar less' }
    },
    keyFactors: ['Regional banks', 'Credit conditions', 'Domestic economy']
  },

  // Energy Futures
  CL: {
    name: 'Crude Oil WTI',
    category: 'Energy',
    drivers: {
      DX: { relationship: 'inverse', description: 'Weaker dollar = higher oil prices' },
      VIX: { relationship: 'complex', description: 'Fear can spike or crash oil depending on cause' },
      geopolitical: { relationship: 'direct', description: 'Middle East tensions = bullish' }
    },
    keyFactors: ['EIA inventories', 'OPEC+ decisions', 'Geopolitics', 'China demand'],
    reports: ['EIA Petroleum Status', 'API Weekly Inventory', 'Baker Hughes Rig Count']
  },
  NG: {
    name: 'Natural Gas',
    category: 'Energy',
    drivers: {
      weather: { relationship: 'direct', description: 'Cold = more heating demand = bullish' },
      storage: { relationship: 'inverse', description: 'Below-average storage = bullish' }
    },
    keyFactors: ['Weather forecasts', 'Storage levels', 'LNG exports', 'Production'],
    reports: ['EIA Natural Gas Storage']
  },
  RB: {
    name: 'RBOB Gasoline',
    category: 'Energy',
    drivers: {
      CL: { relationship: 'direct', description: 'Follows crude oil direction' },
      seasonal: { relationship: 'direct', description: 'Summer driving season = bullish' }
    },
    keyFactors: ['Crude oil', 'Refinery utilization', 'Driving season']
  },

  // Metals
  GC: {
    name: 'Gold',
    category: 'Precious Metals',
    drivers: {
      DX: { relationship: 'strong_inverse', description: 'Weaker dollar = higher gold' },
      ZN: { relationship: 'direct', description: 'Rising ZN (falling yields) = bullish gold' },
      VIX: { relationship: 'direct', description: 'Fear = safe haven bid = bullish' },
      realYields: { relationship: 'inverse', description: 'Lower real yields = bullish gold' }
    },
    keyFactors: ['Real yields', 'Dollar strength', 'Central bank buying', 'Geopolitics']
  },
  SI: {
    name: 'Silver',
    category: 'Precious Metals',
    drivers: {
      GC: { relationship: 'direct', description: 'Follows gold with higher beta' },
      DX: { relationship: 'inverse', description: 'Weaker dollar = higher silver' },
      industrial: { relationship: 'direct', description: 'Industrial demand (solar, electronics)' }
    },
    keyFactors: ['Gold direction', 'Industrial demand', 'Dollar', 'Risk sentiment']
  },
  HG: {
    name: 'Copper',
    category: 'Base Metals',
    drivers: {
      china: { relationship: 'direct', description: 'China demand drives copper' },
      DX: { relationship: 'inverse', description: 'Weaker dollar = higher copper' },
      globalGrowth: { relationship: 'direct', description: 'Economic growth = more copper demand' }
    },
    keyFactors: ['China PMI', 'Global growth', 'Green energy demand', 'Supply disruptions']
  },

  // Bonds/Treasuries
  ZN: {
    name: '10-Year T-Note',
    category: 'Bonds',
    drivers: {
      fedPolicy: { relationship: 'direct', description: 'Dovish Fed = higher ZN (lower yields)' },
      inflation: { relationship: 'inverse', description: 'Higher inflation = lower ZN' },
      riskOff: { relationship: 'direct', description: 'Risk-off = flight to safety = higher ZN' }
    },
    keyFactors: ['Fed policy', 'Inflation data', 'Economic growth', 'Risk sentiment'],
    marketImpact: {
      rising: {
        label: 'Yields Falling',
        effects: ['Bullish for growth stocks (NQ)', 'Bullish for gold (GC)', 'Supportive for ES', 'Lower borrowing costs']
      },
      falling: {
        label: 'Yields Rising',
        effects: ['Bearish for growth stocks', 'Bearish for gold', 'Headwind for equities', 'Dollar supportive']
      }
    }
  },
  ZB: {
    name: '30-Year T-Bond',
    category: 'Bonds',
    drivers: {
      fedPolicy: { relationship: 'direct', description: 'Dovish Fed = higher ZB' },
      inflation: { relationship: 'inverse', description: 'Inflation expectations matter most' }
    },
    keyFactors: ['Long-term inflation expectations', 'Fed policy path', 'Fiscal policy']
  },

  // Agriculture
  ZC: {
    name: 'Corn',
    category: 'Agriculture',
    drivers: {
      weather: { relationship: 'inverse', description: 'Drought/heat stress = bullish' },
      exports: { relationship: 'direct', description: 'Strong exports = bullish' },
      ethanol: { relationship: 'direct', description: 'Ethanol demand supports prices' }
    },
    keyFactors: ['Weather (US Midwest)', 'USDA reports', 'Exports', 'Ethanol demand'],
    reports: ['WASDE', 'Crop Progress', 'Export Sales']
  },
  ZS: {
    name: 'Soybeans',
    category: 'Agriculture',
    drivers: {
      weather: { relationship: 'inverse', description: 'Drought during pod fill = very bullish' },
      china: { relationship: 'direct', description: 'China buying = bullish' },
      brazil: { relationship: 'inverse', description: 'Good Brazil crop = bearish' }
    },
    keyFactors: ['Weather', 'China demand', 'Brazil competition', 'Crush demand'],
    reports: ['WASDE', 'Crop Progress', 'Export Sales']
  },
  ZW: {
    name: 'Wheat',
    category: 'Agriculture',
    drivers: {
      weather: { relationship: 'complex', description: 'Depends on growing region and stage' },
      geopolitical: { relationship: 'direct', description: 'Black Sea disruptions = bullish' },
      globalSupply: { relationship: 'inverse', description: 'Global supply concerns = bullish' }
    },
    keyFactors: ['Global weather', 'Black Sea exports', 'US winter wheat conditions'],
    reports: ['WASDE', 'Crop Progress']
  },
  LE: {
    name: 'Live Cattle',
    category: 'Agriculture',
    drivers: {
      supply: { relationship: 'inverse', description: 'Tight supply = bullish' },
      demand: { relationship: 'direct', description: 'Strong beef demand = bullish' },
      feedCosts: { relationship: 'inverse', description: 'Higher corn = higher costs' }
    },
    keyFactors: ['Cattle on Feed report', 'Beef demand', 'Feed costs', 'Seasonal patterns'],
    reports: ['Cattle on Feed', 'Cold Storage']
  },
  HE: {
    name: 'Lean Hogs',
    category: 'Agriculture',
    drivers: {
      supply: { relationship: 'inverse', description: 'Lower inventory = bullish' },
      exports: { relationship: 'direct', description: 'China buying = bullish' },
      seasonal: { relationship: 'varies', description: 'Grilling season = higher demand' }
    },
    keyFactors: ['Hogs & Pigs report', 'Export demand', 'Feed costs'],
    reports: ['Hogs & Pigs', 'Cold Storage']
  },

  // Currencies
  DX: {
    name: 'US Dollar Index',
    category: 'Currency',
    drivers: {
      fedPolicy: { relationship: 'direct', description: 'Hawkish Fed = stronger dollar' },
      riskSentiment: { relationship: 'varies', description: 'Safe haven in crisis, but risk-on can weaken' },
      yieldDifferential: { relationship: 'direct', description: 'Higher US yields vs others = stronger dollar' }
    },
    keyFactors: ['Fed policy', 'Interest rate differentials', 'Risk sentiment', 'Trade balance'],
    marketImpact: {
      rising: {
        label: 'Stronger Dollar',
        effects: ['Bearish for commodities (GC, CL)', 'Headwind for emerging markets', 'Bearish for multi-nationals', 'Deflationary']
      },
      falling: {
        label: 'Weaker Dollar',
        effects: ['Bullish for commodities', 'Supportive for EM', 'Bullish for exporters', 'Inflationary']
      }
    }
  },

  // Volatility
  VIX: {
    name: 'VIX (Fear Index)',
    category: 'Volatility',
    drivers: {
      spxOptions: { relationship: 'direct', description: 'SPX options demand drives VIX' },
      uncertainty: { relationship: 'direct', description: 'More uncertainty = higher VIX' }
    },
    keyFactors: ['S&P 500 direction', 'Event risk', 'Options activity', 'Hedging demand'],
    levels: {
      extreme: { min: 30, label: 'Extreme Fear', meaning: 'Panic selling, potential capitulation' },
      high: { min: 20, label: 'High Fear', meaning: 'Elevated concern, hedging active' },
      elevated: { min: 16, label: 'Elevated', meaning: 'Above normal caution' },
      normal: { min: 12, label: 'Normal', meaning: 'Complacent, low hedging' },
      low: { min: 0, label: 'Very Low', meaning: 'Extreme complacency, watch for reversal' }
    },
    marketImpact: {
      rising: {
        label: 'Fear Increasing',
        effects: ['Bearish for equities (ES, NQ)', 'Bullish for gold (safe haven)', 'Bullish for bonds (ZN)', 'Risk-off positioning']
      },
      falling: {
        label: 'Fear Decreasing',
        effects: ['Bullish for equities', 'May reduce gold demand', 'Risk-on sentiment']
      }
    }
  },

  // Crypto
  BTC: {
    name: 'Bitcoin',
    category: 'Crypto',
    drivers: {
      riskSentiment: { relationship: 'direct', description: 'Risk-on = bullish BTC' },
      DX: { relationship: 'inverse', description: 'Weaker dollar = bullish BTC' },
      etfFlows: { relationship: 'direct', description: 'ETF inflows = bullish' }
    },
    keyFactors: ['ETF flows', 'Risk sentiment', 'Regulatory news', 'Halving cycle']
  },
  ETH: {
    name: 'Ethereum',
    category: 'Crypto',
    drivers: {
      BTC: { relationship: 'direct', description: 'Generally follows Bitcoin' },
      defi: { relationship: 'direct', description: 'DeFi activity = bullish' }
    },
    keyFactors: ['Bitcoin direction', 'DeFi activity', 'Network upgrades', 'ETF developments']
  }
};

/**
 * Generate comprehensive instrument summary
 */
function generateInstrumentSummary(symbol, instrumentData, marketContext, technicals, recentReports) {
  const config = INSTRUMENT_DRIVERS[symbol];
  if (!config) {
    return {
      symbol,
      available: false,
      reason: 'Instrument not configured'
    };
  }

  const { price, change, changePercent, bias } = instrumentData;
  const { vix, dxy, zn, marketBias } = marketContext;

  // Build fundamental analysis
  const fundamentalFactors = analyzeFundamentalFactors(symbol, config, marketContext, recentReports);

  // Combine with technicals
  const technicalFactors = technicals?.available ? {
    trend: technicals.ema?.trend,
    strength: technicals.adx?.strength,
    direction: technicals.adx?.direction,
    summary: technicals.summary
  } : null;

  // Determine overall status
  const overallStatus = determineOverallStatus(fundamentalFactors, technicalFactors, changePercent);

  // Generate human-readable summary
  const summary = generateHumanSummary(symbol, config, overallStatus, fundamentalFactors, technicalFactors, instrumentData);

  return {
    symbol,
    name: config.name,
    category: config.category,
    price,
    change,
    changePercent,
    bias,
    status: overallStatus.status,
    statusColor: overallStatus.color,
    confidence: overallStatus.confidence,
    summary: summary.short,
    detailedSummary: summary.detailed,
    whyItMatters: config.marketImpact || null,
    fundamentalFactors: fundamentalFactors.factors,
    fundamentalBias: fundamentalFactors.bias,
    technicalFactors,
    keyFactors: config.keyFactors,
    upcomingCatalysts: findUpcomingCatalysts(symbol, config, recentReports),
    available: true
  };
}

/**
 * Analyze fundamental factors affecting the instrument
 */
function analyzeFundamentalFactors(symbol, config, marketContext, recentReports) {
  const factors = [];
  let bullishCount = 0;
  let bearishCount = 0;

  const { vix, vixChange, dxy, dxyChange, zn, znChange } = marketContext;

  // Check each driver
  if (config.drivers.VIX && vix) {
    const vixLevel = parseFloat(vix);
    const vixChg = parseFloat(vixChange) || 0;

    if (config.drivers.VIX.relationship === 'inverse') {
      if (vixLevel < 16) {
        factors.push({ factor: 'VIX', status: 'Supportive', detail: `Low fear (${vixLevel.toFixed(1)})`, bullish: true });
        bullishCount++;
      } else if (vixLevel > 20) {
        factors.push({ factor: 'VIX', status: 'Headwind', detail: `Elevated fear (${vixLevel.toFixed(1)})`, bullish: false });
        bearishCount++;
      } else {
        factors.push({ factor: 'VIX', status: 'Neutral', detail: `Normal (${vixLevel.toFixed(1)})`, bullish: null });
      }
    } else if (config.drivers.VIX.relationship === 'direct') {
      // For gold - higher VIX is bullish
      if (vixLevel > 20) {
        factors.push({ factor: 'VIX', status: 'Supportive', detail: `Safe haven bid (${vixLevel.toFixed(1)})`, bullish: true });
        bullishCount++;
      } else if (vixLevel < 14) {
        factors.push({ factor: 'VIX', status: 'Headwind', detail: `Low hedging demand`, bullish: false });
        bearishCount++;
      }
    }
  }

  if (config.drivers.DX && dxy) {
    const dxChg = parseFloat(dxyChange) || 0;

    if (config.drivers.DX.relationship === 'inverse' || config.drivers.DX.relationship === 'strong_inverse') {
      if (dxChg < -0.3) {
        factors.push({ factor: 'Dollar', status: 'Supportive', detail: `Weaker dollar (${dxChg.toFixed(2)}%)`, bullish: true });
        bullishCount++;
      } else if (dxChg > 0.3) {
        factors.push({ factor: 'Dollar', status: 'Headwind', detail: `Stronger dollar (${dxChg.toFixed(2)}%)`, bullish: false });
        bearishCount++;
      }
    }
  }

  if (config.drivers.ZN && zn) {
    const znChg = parseFloat(znChange) || 0;

    if (config.drivers.ZN.relationship === 'direct') {
      // For gold - rising ZN (falling yields) is bullish
      if (znChg > 0.1) {
        factors.push({ factor: 'Yields', status: 'Supportive', detail: `Yields falling`, bullish: true });
        bullishCount++;
      } else if (znChg < -0.1) {
        factors.push({ factor: 'Yields', status: 'Headwind', detail: `Yields rising`, bullish: false });
        bearishCount++;
      }
    } else if (config.drivers.ZN.relationship === 'inverse' || config.drivers.ZN.relationship === 'strong_inverse') {
      // For equities - rising ZN (falling yields) is bullish
      if (znChg > 0.1) {
        factors.push({ factor: 'Yields', status: 'Supportive', detail: `Lower yields supportive`, bullish: true });
        bullishCount++;
      } else if (znChg < -0.1) {
        factors.push({ factor: 'Yields', status: 'Headwind', detail: `Rising yields pressure`, bullish: false });
        bearishCount++;
      }
    }
  }

  // Check for recent reports affecting this instrument
  if (recentReports && recentReports.length > 0) {
    const relevantReports = recentReports.filter(r =>
      r.affectedInstruments?.includes(symbol)
    );

    relevantReports.forEach(report => {
      if (report.impact) {
        factors.push({
          factor: report.shortName || report.name,
          status: report.impact.direction,
          detail: report.impact.summary,
          bullish: report.impact.direction === 'Bullish'
        });
        if (report.impact.direction === 'Bullish') bullishCount++;
        if (report.impact.direction === 'Bearish') bearishCount++;
      }
    });
  }

  // Determine overall fundamental bias
  let bias = 'Neutral';
  if (bullishCount > bearishCount + 1) {
    bias = 'Bullish';
  } else if (bearishCount > bullishCount + 1) {
    bias = 'Bearish';
  } else if (bullishCount > bearishCount) {
    bias = 'Slight Bullish';
  } else if (bearishCount > bullishCount) {
    bias = 'Slight Bearish';
  }

  return { factors, bias, bullishCount, bearishCount };
}

/**
 * Determine overall status combining fundamentals and technicals
 */
function determineOverallStatus(fundamentals, technicals, changePercent) {
  let score = 0;

  // Fundamental score
  if (fundamentals.bias === 'Bullish') score += 2;
  else if (fundamentals.bias === 'Slight Bullish') score += 1;
  else if (fundamentals.bias === 'Bearish') score -= 2;
  else if (fundamentals.bias === 'Slight Bearish') score -= 1;

  // Technical score
  if (technicals) {
    if (technicals.trend?.includes('Strong Bullish')) score += 2;
    else if (technicals.trend?.includes('Bullish')) score += 1;
    else if (technicals.trend?.includes('Strong Bearish')) score -= 2;
    else if (technicals.trend?.includes('Bearish')) score -= 1;
  }

  // Price action confirmation
  if (changePercent > 1) score += 1;
  else if (changePercent < -1) score -= 1;

  // Determine status
  let status, color, confidence;

  if (score >= 4) {
    status = 'Strong Bullish';
    color = 'emerald';
    confidence = 'High';
  } else if (score >= 2) {
    status = 'Bullish';
    color = 'green';
    confidence = 'Moderate';
  } else if (score >= 1) {
    status = 'Slight Bullish';
    color = 'lime';
    confidence = 'Low';
  } else if (score <= -4) {
    status = 'Strong Bearish';
    color = 'red';
    confidence = 'High';
  } else if (score <= -2) {
    status = 'Bearish';
    color = 'rose';
    confidence = 'Moderate';
  } else if (score <= -1) {
    status = 'Slight Bearish';
    color = 'orange';
    confidence = 'Low';
  } else {
    status = 'Neutral';
    color = 'slate';
    confidence = 'Low';
  }

  // Check alignment
  const aligned = technicals &&
    ((fundamentals.bias.includes('Bullish') && technicals.trend?.includes('Bullish')) ||
      (fundamentals.bias.includes('Bearish') && technicals.trend?.includes('Bearish')));

  return { status, color, confidence, score, aligned };
}

/**
 * Generate human-readable summaries
 */
function generateHumanSummary(symbol, config, overallStatus, fundamentals, technicals, instrumentData) {
  const direction = instrumentData.changePercent >= 0 ? 'up' : 'down';
  const changeAbs = Math.abs(instrumentData.changePercent).toFixed(2);

  // Short summary (1-2 sentences for sidebar)
  let short = '';

  if (overallStatus.aligned) {
    short = `Fundamentals and technicals aligned ${overallStatus.status.toLowerCase()}. `;
  } else if (fundamentals.factors.length > 0) {
    const mainFactor = fundamentals.factors[0];
    short = `${mainFactor.factor}: ${mainFactor.detail}. `;
  }

  if (technicals?.strength === 'Strong' || technicals?.strength === 'Very Strong') {
    short += `Strong trend in place.`;
  } else if (technicals?.strength === 'Weak') {
    short += `Choppy, no clear trend.`;
  }

  if (!short) {
    short = `${config.name} ${direction} ${changeAbs}% today.`;
  }

  // Detailed summary (for popup)
  let detailed = `**${config.name} (${symbol})**\n\n`;

  detailed += `**Current Status:** ${overallStatus.status}\n`;
  detailed += `Price ${direction} ${changeAbs}% today.\n\n`;

  if (fundamentals.factors.length > 0) {
    detailed += `**Fundamental Drivers:**\n`;
    fundamentals.factors.forEach(f => {
      const icon = f.bullish === true ? '✅' : f.bullish === false ? '❌' : '➖';
      detailed += `${icon} ${f.factor}: ${f.detail}\n`;
    });
    detailed += '\n';
  }

  if (technicals) {
    detailed += `**Technical Picture:**\n`;
    detailed += `Trend: ${technicals.trend || 'N/A'}\n`;
    detailed += `Strength: ${technicals.strength || 'N/A'} (ADX)\n`;
    detailed += `Direction: ${technicals.direction || 'N/A'}\n\n`;
  }

  if (overallStatus.aligned) {
    detailed += `⚡ **Key Insight:** Fundamentals and technicals are aligned - higher conviction setup.\n`;
  }

  return { short, detailed };
}

/**
 * Find upcoming catalysts for an instrument
 */
function findUpcomingCatalysts(symbol, config, recentReports) {
  const catalysts = [];

  // Add known report dates if configured
  if (config.reports) {
    config.reports.forEach(reportName => {
      catalysts.push({
        name: reportName,
        type: 'Scheduled Report'
      });
    });
  }

  return catalysts.slice(0, 3); // Return top 3
}

/**
 * Generate market drivers summary (what's moving markets today)
 */
function generateMarketDriversSummary(marketContext, recentReports, trendingInstruments) {
  const drivers = [];

  const { vix, vixChange, dxy, dxyChange, zn, znChange, marketBias } = marketContext;

  // VIX driver
  if (Math.abs(parseFloat(vixChange) || 0) > 3) {
    const vixDir = parseFloat(vixChange) > 0 ? 'spiking' : 'dropping';
    drivers.push({
      factor: 'Volatility',
      description: `VIX ${vixDir} (${vixChange}%) - ${parseFloat(vixChange) > 0 ? 'Risk-off' : 'Risk-on'} sentiment`,
      impact: parseFloat(vixChange) > 0 ? 'Risk-off' : 'Risk-on',
      affectedInstruments: ['ES', 'NQ', 'GC', 'ZN']
    });
  }

  // Yields driver
  if (Math.abs(parseFloat(znChange) || 0) > 0.3) {
    const yieldDir = parseFloat(znChange) > 0 ? 'falling' : 'rising';
    drivers.push({
      factor: 'Treasury Yields',
      description: `10Y yields ${yieldDir} - ${parseFloat(znChange) > 0 ? 'supportive' : 'headwind'} for growth`,
      impact: parseFloat(znChange) > 0 ? 'Dovish' : 'Hawkish',
      affectedInstruments: ['ES', 'NQ', 'GC', 'RTY']
    });
  }

  // Dollar driver
  if (Math.abs(parseFloat(dxyChange) || 0) > 0.3) {
    const dxDir = parseFloat(dxyChange) > 0 ? 'strengthening' : 'weakening';
    drivers.push({
      factor: 'US Dollar',
      description: `Dollar ${dxDir} (${dxyChange}%) - impacts commodities`,
      impact: parseFloat(dxyChange) > 0 ? 'Bearish commodities' : 'Bullish commodities',
      affectedInstruments: ['GC', 'CL', 'SI', 'HG']
    });
  }

  // Recent reports
  if (recentReports && recentReports.length > 0) {
    recentReports.slice(0, 2).forEach(report => {
      if (report.impact) {
        drivers.push({
          factor: report.shortName || report.name,
          description: report.impact.summary,
          impact: report.impact.direction,
          affectedInstruments: report.affectedInstruments || []
        });
      }
    });
  }

  // Watch list (trending instruments)
  const watchList = trendingInstruments?.filter(t => t.isTrending).map(t => t.symbol) || [];

  return {
    drivers: drivers.slice(0, 4),
    watchList,
    overallBias: marketBias?.sentiment || 'Neutral',
    summary: generateDriversSummaryText(drivers, marketBias)
  };
}

/**
 * Generate summary text for market drivers
 */
function generateDriversSummaryText(drivers, marketBias) {
  if (drivers.length === 0) {
    return 'Markets relatively quiet. No major drivers today.';
  }

  const parts = drivers.slice(0, 2).map(d => d.description);

  return parts.join('. ') + '.';
}

export {
  INSTRUMENT_DRIVERS,
  generateInstrumentSummary,
  generateMarketDriversSummary,
  analyzeFundamentalFactors,
  determineOverallStatus
};
