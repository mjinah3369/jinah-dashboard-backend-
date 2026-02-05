/**
 * Report Schedule - Key economic reports affecting instruments
 * From INSTRUMENT_DRIVERS_REFERENCE.md
 *
 * Provides the AI agents with awareness of upcoming reports
 * so they can factor in event risk and volatility expectations
 */

// ============================================================================
// WEEKLY RECURRING REPORTS
// ============================================================================

const WEEKLY_REPORTS = {
  MONDAY: [
    {
      time: '16:00 ET',
      report: 'USDA Crop Progress',
      affects: ['ZC', 'ZS', 'ZW'],
      season: 'Apr-Nov',
      impact: 'HIGH',
      description: 'Weekly crop condition ratings - Good/Excellent percentage'
    }
  ],
  TUESDAY: [
    {
      time: '16:30 ET',
      report: 'API Crude Inventory',
      affects: ['CL', 'RB'],
      impact: 'MEDIUM',
      description: 'Preview of Wednesday EIA data - sets overnight tone'
    }
  ],
  WEDNESDAY: [
    {
      time: '10:30 ET',
      report: 'EIA Petroleum Status',
      affects: ['CL', 'NG', 'RB'],
      impact: 'VERY_HIGH',
      description: 'Official crude/gas inventory - Draw = bullish, Build = bearish'
    }
  ],
  THURSDAY: [
    {
      time: '08:30 ET',
      report: 'USDA Export Sales',
      affects: ['ZC', 'ZS', 'ZW'],
      impact: 'MEDIUM',
      description: 'Weekly export data - large sales flash = bullish'
    },
    {
      time: '10:30 ET',
      report: 'EIA Natural Gas Storage',
      affects: ['NG'],
      impact: 'VERY_HIGH',
      description: 'Weekly storage injection/draw vs expectations'
    }
  ],
  FRIDAY: [
    {
      time: '08:30 ET',
      report: 'US Employment / NFP',
      affects: ['ES', 'NQ', 'YM', 'RTY', 'DX', 'GC', '6E', '6J'],
      impact: 'VERY_HIGH',
      description: 'Non-Farm Payrolls - 1st Friday only',
      condition: 'first_friday'
    },
    {
      time: '13:00 ET',
      report: 'Baker Hughes Rig Count',
      affects: ['CL', 'NG'],
      impact: 'MEDIUM',
      description: 'US oil/gas rig count - production capacity indicator'
    },
    {
      time: '15:30 ET',
      report: 'CFTC COT Report',
      affects: ['ALL'],
      impact: 'LOW',
      description: 'Commitments of Traders positioning data'
    }
  ]
};

// ============================================================================
// MONTHLY REPORTS
// ============================================================================

const MONTHLY_REPORTS = [
  {
    report: 'USDA WASDE',
    affects: ['ZC', 'ZS', 'ZW', 'ZM', 'ZL'],
    day: '~12th',
    impact: 'VERY_HIGH',
    description: 'World Agricultural Supply/Demand Estimates - biggest ag mover'
  },
  {
    report: 'US CPI',
    affects: ['ES', 'NQ', 'GC', 'DX', 'ZN', '6E', '6J'],
    day: '~13th',
    time: '08:30 ET',
    impact: 'VERY_HIGH',
    description: 'Consumer Price Index - Fed policy driver'
  },
  {
    report: 'US PPI',
    affects: ['ES', 'CL', 'DX'],
    day: '~14th',
    time: '08:30 ET',
    impact: 'HIGH',
    description: 'Producer Price Index - input cost inflation'
  },
  {
    report: 'US Retail Sales',
    affects: ['ES', 'YM', 'RTY'],
    day: '~15th',
    time: '08:30 ET',
    impact: 'HIGH',
    description: 'Consumer spending health'
  },
  {
    report: 'OPEC Monthly Report',
    affects: ['CL', 'NG', 'RB'],
    day: 'varies',
    impact: 'HIGH',
    description: 'Production and demand forecasts'
  },
  {
    report: 'USDA Cattle on Feed',
    affects: ['LE'],
    day: '3rd_friday',
    impact: 'VERY_HIGH',
    description: 'Placements, marketings - key cattle report'
  },
  {
    report: 'China PMI',
    affects: ['HG', '6A', 'ZS', 'GC'],
    day: '1st',
    impact: 'HIGH',
    description: 'Manufacturing PMI - copper/commodity demand proxy'
  },
  {
    report: 'German IFO',
    affects: ['DAX', '6E', 'STOXX'],
    day: '~25th',
    impact: 'MEDIUM',
    description: 'German business confidence survey'
  },
  {
    report: 'US PCE',
    affects: ['ES', 'NQ', 'GC', 'DX'],
    day: 'last_friday',
    time: '08:30 ET',
    impact: 'VERY_HIGH',
    description: 'Fed preferred inflation measure'
  },
  {
    report: 'EIA Short-Term Energy Outlook',
    affects: ['CL', 'NG'],
    day: 'varies',
    impact: 'MEDIUM',
    description: 'Monthly production and demand forecasts'
  }
];

// ============================================================================
// QUARTERLY REPORTS
// ============================================================================

const QUARTERLY_REPORTS = [
  {
    report: 'US GDP',
    affects: ['ES', 'NQ', 'YM', 'RTY', 'DX'],
    impact: 'VERY_HIGH',
    description: 'Advance estimate moves most'
  },
  {
    report: 'USDA Quarterly Stocks',
    affects: ['ZC', 'ZS', 'ZW'],
    impact: 'HIGH',
    description: 'Grain stocks on hand'
  },
  {
    report: 'USDA Hogs & Pigs',
    affects: ['HE'],
    impact: 'VERY_HIGH',
    description: 'Breeding herd size, pig crop'
  },
  {
    report: 'Fed Dot Plot / SEP',
    affects: ['ES', 'NQ', 'YM', 'RTY', 'GC', 'DX', '6E', '6J', 'ZN'],
    impact: 'VERY_HIGH',
    description: 'Summary of Economic Projections - rate path'
  }
];

// ============================================================================
// ANNUAL REPORTS
// ============================================================================

const ANNUAL_REPORTS = [
  {
    report: 'USDA Planting Intentions',
    affects: ['ZC', 'ZS', 'ZW'],
    date: 'March 31',
    impact: 'VERY_HIGH',
    description: 'Prospective Plantings - sets annual supply expectations'
  }
];

// ============================================================================
// CENTRAL BANK MEETING SCHEDULES (2026)
// ============================================================================

const CENTRAL_BANK_SCHEDULE = {
  FOMC: {
    meetings: 8,
    affects: ['ES', 'NQ', 'YM', 'RTY', 'GC', 'DX', 'ZN', '6E', '6J'],
    impact: 'VERY_HIGH',
    description: 'Federal Reserve rate decisions'
  },
  ECB: {
    meetings: 8,
    affects: ['6E', 'DAX', 'STOXX'],
    impact: 'VERY_HIGH',
    description: 'European Central Bank rate decisions'
  },
  BOJ: {
    meetings: 8,
    affects: ['6J', 'NQ'],
    impact: 'HIGH',
    description: 'Bank of Japan - carry trade impact'
  },
  BOE: {
    meetings: 8,
    affects: ['6B', 'FTSE'],
    impact: 'HIGH',
    description: 'Bank of England rate decisions'
  },
  RBA: {
    meetings: 11,
    affects: ['6A'],
    impact: 'MEDIUM',
    description: 'Reserve Bank of Australia'
  },
  BOC: {
    meetings: 8,
    affects: ['6C'],
    impact: 'MEDIUM',
    description: 'Bank of Canada'
  },
  SNB: {
    meetings: 4,
    affects: ['6S'],
    impact: 'MEDIUM',
    description: 'Swiss National Bank - quarterly'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the day of week name
 */
function getDayOfWeek(date = new Date()) {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()];
}

/**
 * Check if today is the first Friday of the month
 */
function isFirstFriday(date = new Date()) {
  return date.getDay() === 5 && date.getDate() <= 7;
}

/**
 * Check if today is the third Friday of the month
 */
function isThirdFriday(date = new Date()) {
  return date.getDay() === 5 && date.getDate() >= 15 && date.getDate() <= 21;
}

/**
 * Check if today is the last Friday of the month
 */
function isLastFriday(date = new Date()) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDay() === 5 && date.getDate() > lastDay - 7;
}

/**
 * Check if we're in crop reporting season (Apr-Nov)
 */
function isCropSeason(date = new Date()) {
  const month = date.getMonth(); // 0-indexed
  return month >= 3 && month <= 10; // April (3) through November (10)
}

/**
 * Get today's scheduled reports
 * @param {Date} date - Date to check (defaults to today)
 * @returns {Array} - Array of reports scheduled for today
 */
function getTodaysReports(date = new Date()) {
  const dayOfWeek = getDayOfWeek(date);
  const dayOfMonth = date.getDate();
  const reports = [];

  // Add weekly reports for today's day of week
  const dailyReports = WEEKLY_REPORTS[dayOfWeek] || [];
  dailyReports.forEach(report => {
    // Check conditions
    if (report.condition === 'first_friday' && !isFirstFriday(date)) return;
    if (report.season === 'Apr-Nov' && !isCropSeason(date)) return;

    reports.push({
      ...report,
      type: 'WEEKLY',
      isToday: true
    });
  });

  // Check monthly reports (approximate matching)
  MONTHLY_REPORTS.forEach(report => {
    let isLikelyToday = false;

    if (report.day === '~12th' && dayOfMonth >= 10 && dayOfMonth <= 14) isLikelyToday = true;
    if (report.day === '~13th' && dayOfMonth >= 11 && dayOfMonth <= 15) isLikelyToday = true;
    if (report.day === '~14th' && dayOfMonth >= 12 && dayOfMonth <= 16) isLikelyToday = true;
    if (report.day === '~15th' && dayOfMonth >= 13 && dayOfMonth <= 17) isLikelyToday = true;
    if (report.day === '~25th' && dayOfMonth >= 23 && dayOfMonth <= 27) isLikelyToday = true;
    if (report.day === '1st' && dayOfMonth === 1) isLikelyToday = true;
    if (report.day === '3rd_friday' && isThirdFriday(date)) isLikelyToday = true;
    if (report.day === 'last_friday' && isLastFriday(date)) isLikelyToday = true;

    if (isLikelyToday) {
      reports.push({
        ...report,
        type: 'MONTHLY',
        isLikelyToday: true
      });
    }
  });

  return reports;
}

/**
 * Get reports affecting a specific symbol
 * @param {string} symbol - Instrument symbol (e.g., 'CL', 'ES')
 * @returns {Object} - Reports categorized by frequency
 */
function getReportsForSymbol(symbol) {
  const result = {
    weekly: [],
    monthly: [],
    quarterly: []
  };

  // Check weekly
  Object.entries(WEEKLY_REPORTS).forEach(([day, reports]) => {
    reports.forEach(report => {
      if (report.affects.includes(symbol) || report.affects.includes('ALL')) {
        result.weekly.push({ ...report, day });
      }
    });
  });

  // Check monthly
  MONTHLY_REPORTS.forEach(report => {
    if (report.affects.includes(symbol)) {
      result.monthly.push(report);
    }
  });

  // Check quarterly
  QUARTERLY_REPORTS.forEach(report => {
    if (report.affects.includes(symbol)) {
      result.quarterly.push(report);
    }
  });

  return result;
}

/**
 * Get a summary of today's event risk for AI agents
 * @returns {Object} - Event risk summary
 */
function getEventRiskSummary(date = new Date()) {
  const reports = getTodaysReports(date);
  const dayOfWeek = getDayOfWeek(date);

  // Determine overall risk level
  let riskLevel = 'LOW';
  let veryHighCount = 0;
  let highCount = 0;

  reports.forEach(r => {
    if (r.impact === 'VERY_HIGH') veryHighCount++;
    if (r.impact === 'HIGH') highCount++;
  });

  if (veryHighCount >= 2) riskLevel = 'EXTREME';
  else if (veryHighCount >= 1) riskLevel = 'HIGH';
  else if (highCount >= 2) riskLevel = 'ELEVATED';
  else if (highCount >= 1 || reports.length >= 2) riskLevel = 'MODERATE';

  // Affected symbols today
  const affectedSymbols = new Set();
  reports.forEach(r => {
    (r.affects || []).forEach(s => {
      if (s !== 'ALL') affectedSymbols.add(s);
    });
  });

  // Special day flags
  const isNFPDay = isFirstFriday(date);
  const isEIADay = dayOfWeek === 'WEDNESDAY';
  const isNGStorageDay = dayOfWeek === 'THURSDAY';

  return {
    date: date.toISOString().split('T')[0],
    dayOfWeek,
    riskLevel,
    reportCount: reports.length,
    veryHighImpact: veryHighCount,
    highImpact: highCount,
    reports,
    affectedSymbols: Array.from(affectedSymbols),
    flags: {
      isNFPDay,
      isEIADay,
      isNGStorageDay,
      isCropSeason: isCropSeason(date)
    },
    warnings: generateWarnings(reports, riskLevel)
  };
}

/**
 * Generate warnings based on scheduled reports
 */
function generateWarnings(reports, riskLevel) {
  const warnings = [];

  if (riskLevel === 'EXTREME' || riskLevel === 'HIGH') {
    warnings.push('HIGH_EVENT_RISK — Multiple market-moving reports today');
  }

  reports.forEach(r => {
    if (r.report === 'US Employment / NFP') {
      warnings.push('NFP_DAY — Expect high volatility around 8:30 AM ET');
    }
    if (r.report === 'EIA Petroleum Status') {
      warnings.push('EIA_DAY — Oil volatility expected at 10:30 AM ET');
    }
    if (r.report === 'EIA Natural Gas Storage') {
      warnings.push('NG_STORAGE — Natural gas volatility at 10:30 AM ET');
    }
    if (r.report === 'US CPI') {
      warnings.push('CPI_DAY — Inflation data moves everything at 8:30 AM ET');
    }
    if (r.report === 'USDA WASDE') {
      warnings.push('WASDE_DAY — Major grain report, expect ag volatility');
    }
  });

  return warnings;
}

/**
 * Format report schedule for AI agent prompt
 */
function formatReportsForPrompt(date = new Date()) {
  const summary = getEventRiskSummary(date);

  if (summary.reports.length === 0) {
    return `EVENT RISK: ${summary.riskLevel} — No major reports scheduled today (${summary.dayOfWeek})`;
  }

  let prompt = `EVENT RISK: ${summary.riskLevel} (${summary.dayOfWeek})\n`;
  prompt += `Affected Symbols: ${summary.affectedSymbols.join(', ') || 'None specific'}\n\n`;
  prompt += `SCHEDULED REPORTS:\n`;

  summary.reports.forEach(r => {
    prompt += `- ${r.time || 'TBD'}: ${r.report} [${r.impact}] → ${r.affects.join(', ')}\n`;
    prompt += `  ${r.description}\n`;
  });

  if (summary.warnings.length > 0) {
    prompt += `\nWARNINGS:\n`;
    summary.warnings.forEach(w => {
      prompt += `⚠️ ${w}\n`;
    });
  }

  return prompt;
}

export {
  WEEKLY_REPORTS,
  MONTHLY_REPORTS,
  QUARTERLY_REPORTS,
  ANNUAL_REPORTS,
  CENTRAL_BANK_SCHEDULE,
  getTodaysReports,
  getReportsForSymbol,
  getEventRiskSummary,
  formatReportsForPrompt,
  isFirstFriday,
  isThirdFriday,
  isLastFriday,
  isCropSeason,
  getDayOfWeek
};
