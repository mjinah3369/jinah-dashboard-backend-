// Fundamental Reports Service
// Provides calendar data for high-impact market reports across all sectors

// ============================================================================
// ENERGY REPORTS (CL, NG, RB)
// ============================================================================

const ENERGY_REPORTS = [
  {
    id: 'opec-momr',
    name: 'OPEC Monthly Oil Market Report',
    shortName: 'OPEC Report',
    category: 'energy',
    monthlyDate: 12, // Around the 12th of each month
    time: '7:00 AM ET',
    timeET: '07:00',
    importance: 'HIGH',
    affectedInstruments: ['CL', 'RB'],
    description: 'OPEC monthly report with oil demand forecasts, production data, and market analysis. Major market mover for crude oil.',
    scenarios: {
      bullish: 'Lower production forecast, higher demand estimates, supply concerns',
      bearish: 'Higher production forecast, lower demand estimates, oversupply warnings'
    }
  },
  {
    id: 'opec-meeting',
    name: 'OPEC+ Meeting',
    shortName: 'OPEC+ Meeting',
    category: 'energy',
    monthlyDate: 1, // Usually first week of month (approximate)
    time: 'Varies',
    timeET: '10:00',
    importance: 'HIGH',
    affectedInstruments: ['CL', 'RB', 'NG'],
    description: 'OPEC+ production policy meeting. Decisions on output quotas directly impact oil prices.',
    scenarios: {
      bullish: 'Production cuts, extended cuts, compliance emphasis',
      bearish: 'Production increases, quota relaxation, member disputes'
    }
  },
  {
    id: 'api-inventory',
    name: 'API Weekly Inventory',
    shortName: 'API Inventory',
    category: 'energy',
    dayOfWeek: 2, // Tuesday
    time: '4:30 PM ET',
    timeET: '16:30',
    importance: 'MEDIUM',
    affectedInstruments: ['CL', 'RB'],
    description: 'American Petroleum Institute weekly crude oil inventory report. Preview of official EIA data.',
    scenarios: {
      bullish: 'Larger than expected draw (negative number)',
      bearish: 'Larger than expected build (positive number)'
    }
  },
  {
    id: 'eia-petroleum',
    name: 'EIA Petroleum Status Report',
    shortName: 'EIA Petroleum',
    category: 'energy',
    dayOfWeek: 3, // Wednesday
    time: '10:30 AM ET',
    timeET: '10:30',
    importance: 'HIGH',
    affectedInstruments: ['CL', 'NG', 'RB'],
    description: 'Official weekly inventory data from the Energy Information Administration. Includes crude stocks, gasoline, distillates, refinery utilization, and Cushing OK levels.',
    scenarios: {
      bullish: 'Draw > 2M bbl, low refinery utilization, declining Cushing stocks',
      bearish: 'Build > 3M bbl, high refinery utilization, rising Cushing stocks'
    }
  },
  {
    id: 'eia-natgas',
    name: 'EIA Natural Gas Storage',
    shortName: 'EIA Nat Gas',
    category: 'energy',
    dayOfWeek: 4, // Thursday
    time: '10:30 AM ET',
    timeET: '10:30',
    importance: 'HIGH',
    affectedInstruments: ['NG'],
    description: 'Weekly natural gas storage report. Shows injection/withdrawal vs 5-year average. Critical for NG pricing.',
    scenarios: {
      bullish: 'Withdrawal larger than expected (winter) or injection smaller than expected (summer)',
      bearish: 'Withdrawal smaller than expected or injection larger than expected'
    }
  },
  {
    id: 'baker-hughes',
    name: 'Baker Hughes Rig Count',
    shortName: 'Rig Count',
    category: 'energy',
    dayOfWeek: 5, // Friday
    time: '1:00 PM ET',
    timeET: '13:00',
    importance: 'MEDIUM',
    affectedInstruments: ['CL', 'NG'],
    description: 'Weekly count of active drilling rigs in the US. Leading indicator for future oil/gas production.',
    scenarios: {
      bullish: 'Declining rig count (less future supply)',
      bearish: 'Rising rig count (more future supply)'
    }
  }
];

// ============================================================================
// AGRICULTURE REPORTS (ZS, ZC, ZW, ZM, ZL, LE, HE)
// ============================================================================

const AGRICULTURE_REPORTS = [
  {
    id: 'usda-wasde',
    name: 'USDA WASDE Report',
    shortName: 'WASDE',
    category: 'agriculture',
    monthlyDate: 12, // Around the 12th of each month
    time: '12:00 PM ET',
    timeET: '12:00',
    importance: 'HIGH',
    affectedInstruments: ['ZS', 'ZC', 'ZW', 'ZM', 'ZL', 'LE', 'HE'],
    description: 'World Agricultural Supply and Demand Estimates. Most important monthly USDA report covering global production, consumption, and ending stocks.',
    scenarios: {
      bullish: 'Lower than expected production, higher demand, lower ending stocks',
      bearish: 'Higher than expected production, lower demand, higher ending stocks'
    }
  },
  {
    id: 'usda-crop-progress',
    name: 'USDA Crop Progress',
    shortName: 'Crop Progress',
    category: 'agriculture',
    dayOfWeek: 1, // Monday
    time: '4:00 PM ET',
    timeET: '16:00',
    importance: 'MEDIUM',
    affectedInstruments: ['ZS', 'ZC', 'ZW'],
    description: 'Weekly report on planting/harvest progress and crop condition ratings. Released during growing season (April-November).',
    seasonalMonths: [4, 5, 6, 7, 8, 9, 10, 11], // April-November
    scenarios: {
      bullish: 'Poor crop conditions, planting delays, drought stress',
      bearish: 'Good/excellent crop conditions, ahead of schedule planting'
    }
  },
  {
    id: 'usda-export-sales',
    name: 'USDA Export Sales',
    shortName: 'Export Sales',
    category: 'agriculture',
    dayOfWeek: 4, // Thursday
    time: '8:30 AM ET',
    timeET: '08:30',
    importance: 'MEDIUM',
    affectedInstruments: ['ZS', 'ZC', 'ZW'],
    description: 'Weekly report on US agricultural export sales and shipments. Key indicator of global demand.',
    scenarios: {
      bullish: 'Large export sales, especially to China',
      bearish: 'Weak export sales, order cancellations'
    }
  },
  {
    id: 'usda-cattle-on-feed',
    name: 'USDA Cattle on Feed',
    shortName: 'Cattle on Feed',
    category: 'agriculture',
    monthlyDate: 20, // Around the 20th of each month
    time: '3:00 PM ET',
    timeET: '15:00',
    importance: 'HIGH',
    affectedInstruments: ['LE'],
    description: 'Monthly report on cattle inventory in feedlots. Shows placements, marketings, and on-feed numbers.',
    scenarios: {
      bullish: 'Lower placements than expected, smaller on-feed inventory',
      bearish: 'Higher placements, larger on-feed inventory'
    }
  },
  {
    id: 'usda-hogs-pigs',
    name: 'USDA Hogs & Pigs',
    shortName: 'Hogs & Pigs',
    category: 'agriculture',
    quarterlyMonths: [3, 6, 9, 12], // Quarterly
    monthlyDate: 28, // Around end of month
    time: '3:00 PM ET',
    timeET: '15:00',
    importance: 'HIGH',
    affectedInstruments: ['HE'],
    description: 'Quarterly report on US hog inventory, breeding herd, and pig crop.',
    scenarios: {
      bullish: 'Smaller than expected hog inventory, declining breeding herd',
      bearish: 'Larger inventory, expanding breeding herd'
    }
  }
];

// ============================================================================
// TREASURY AUCTIONS (ZT, ZF, ZN, TN, ZB)
// ============================================================================

const TREASURY_AUCTIONS = [
  {
    id: 'auction-2yr',
    name: '2-Year Treasury Auction',
    shortName: '2Y Auction',
    category: 'bonds',
    monthlyWeek: 4, // 4th week of month typically
    dayOfWeek: 2, // Tuesday
    time: '1:00 PM ET',
    timeET: '13:00',
    importance: 'HIGH',
    affectedInstruments: ['ZT'],
    description: '2-Year Treasury note auction. Short-end of the yield curve, sensitive to Fed policy expectations.',
    scenarios: {
      bullish: 'Strong demand (high bid-to-cover >2.5, low tail)',
      bearish: 'Weak demand (low bid-to-cover <2.3, large tail)'
    }
  },
  {
    id: 'auction-5yr',
    name: '5-Year Treasury Auction',
    shortName: '5Y Auction',
    category: 'bonds',
    monthlyWeek: 4,
    dayOfWeek: 3, // Wednesday
    time: '1:00 PM ET',
    timeET: '13:00',
    importance: 'HIGH',
    affectedInstruments: ['ZF'],
    description: '5-Year Treasury note auction. Belly of the curve, important for mortgage rates.',
    scenarios: {
      bullish: 'Strong demand (high bid-to-cover, strong indirect bidders)',
      bearish: 'Weak demand (low bid-to-cover, weak foreign participation)'
    }
  },
  {
    id: 'auction-10yr',
    name: '10-Year Treasury Auction',
    shortName: '10Y Auction',
    category: 'bonds',
    monthlyWeek: 2, // 2nd week typically
    dayOfWeek: 3, // Wednesday
    time: '1:00 PM ET',
    timeET: '13:00',
    importance: 'HIGH',
    affectedInstruments: ['ZN', 'TN'],
    description: '10-Year Treasury note auction. Benchmark rate for mortgages and corporate bonds.',
    scenarios: {
      bullish: 'Strong demand (bid-to-cover >2.5, high indirect bidders >70%)',
      bearish: 'Weak demand (low bid-to-cover, weak indirect bidders)'
    }
  },
  {
    id: 'auction-30yr',
    name: '30-Year Treasury Bond Auction',
    shortName: '30Y Auction',
    category: 'bonds',
    monthlyWeek: 2,
    dayOfWeek: 4, // Thursday
    time: '1:00 PM ET',
    timeET: '13:00',
    importance: 'HIGH',
    affectedInstruments: ['ZB'],
    description: '30-Year Treasury bond auction. Long-end of the curve, sensitive to inflation expectations.',
    scenarios: {
      bullish: 'Strong demand, especially from pension funds and insurers',
      bearish: 'Weak demand, primary dealers forced to absorb supply'
    }
  }
];

// ============================================================================
// CENTRAL BANK CALENDARS
// ============================================================================

// 2025-2026 FOMC Meeting Dates (approximate, actual dates may vary)
const FOMC_MEETINGS_2025_2026 = [
  // 2025
  { year: 2025, month: 1, days: [28, 29], pressConference: true },
  { year: 2025, month: 3, days: [18, 19], pressConference: true },
  { year: 2025, month: 5, days: [6, 7], pressConference: true },
  { year: 2025, month: 6, days: [17, 18], pressConference: true },
  { year: 2025, month: 7, days: [29, 30], pressConference: true },
  { year: 2025, month: 9, days: [16, 17], pressConference: true },
  { year: 2025, month: 11, days: [4, 5], pressConference: true },
  { year: 2025, month: 12, days: [16, 17], pressConference: true },
  // 2026
  { year: 2026, month: 1, days: [27, 28], pressConference: true },
  { year: 2026, month: 3, days: [17, 18], pressConference: true },
  { year: 2026, month: 5, days: [5, 6], pressConference: true },
  { year: 2026, month: 6, days: [16, 17], pressConference: true },
  { year: 2026, month: 7, days: [28, 29], pressConference: true },
  { year: 2026, month: 9, days: [15, 16], pressConference: true },
  { year: 2026, month: 11, days: [3, 4], pressConference: true },
  { year: 2026, month: 12, days: [15, 16], pressConference: true },
];

const CENTRAL_BANK_MEETINGS = {
  FOMC: {
    name: 'FOMC Rate Decision',
    shortName: 'FOMC',
    bank: 'Federal Reserve',
    time: '2:00 PM ET',
    timeET: '14:00',
    importance: 'HIGH',
    affectedInstruments: ['ES', 'NQ', 'YM', 'RTY', 'ZN', 'ZB', 'DX', '6E', '6J', '6B', '6A', 'GC', 'CL'],
    meetings: FOMC_MEETINGS_2025_2026,
    description: 'Federal Reserve interest rate decision and policy statement. Most important market-moving event.',
    scenarios: {
      bullish: 'Dovish surprise (rate cut, pause in hikes, softer language)',
      bearish: 'Hawkish surprise (rate hike, faster tightening, inflation concerns)'
    }
  },
  ECB: {
    name: 'ECB Rate Decision',
    shortName: 'ECB',
    bank: 'European Central Bank',
    time: '8:15 AM ET',
    timeET: '08:15',
    importance: 'HIGH',
    affectedInstruments: ['6E', 'DX', 'ES'],
    description: 'European Central Bank interest rate decision. Affects Euro and dollar correlations.'
  },
  BOJ: {
    name: 'BOJ Policy Decision',
    shortName: 'BOJ',
    bank: 'Bank of Japan',
    time: 'Overnight',
    timeET: '00:00',
    importance: 'HIGH',
    affectedInstruments: ['6J', 'DX'],
    description: 'Bank of Japan policy decision. Watch for yield curve control adjustments and intervention signals.'
  },
  BOE: {
    name: 'BOE Rate Decision',
    shortName: 'BOE',
    bank: 'Bank of England',
    time: '7:00 AM ET',
    timeET: '07:00',
    importance: 'HIGH',
    affectedInstruments: ['6B', 'DX'],
    description: 'Bank of England interest rate decision. Affects British Pound futures.'
  },
  RBA: {
    name: 'RBA Rate Decision',
    shortName: 'RBA',
    bank: 'Reserve Bank of Australia',
    time: 'Overnight',
    timeET: '00:30',
    importance: 'MEDIUM',
    affectedInstruments: ['6A', 'DX'],
    description: 'Reserve Bank of Australia rate decision. Affects Australian Dollar and risk sentiment.'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the next occurrence of a weekday
 */
function getNextWeekday(dayOfWeek, fromDate = new Date()) {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);

  const currentDay = result.getDay();
  let daysToAdd = dayOfWeek - currentDay;

  if (daysToAdd < 0) {
    daysToAdd += 7;
  } else if (daysToAdd === 0) {
    // If today is the target day, check if the report time has passed
    const now = new Date();
    if (now.getHours() >= 17) { // Past 5 PM, get next week
      daysToAdd = 7;
    }
  }

  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Get approximate date for monthly reports (e.g., around the 12th)
 */
function getNextMonthlyDate(targetDay, fromDate = new Date()) {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);

  const currentDay = result.getDate();

  if (currentDay > targetDay) {
    // Move to next month
    result.setMonth(result.getMonth() + 1);
  }

  result.setDate(targetDay);
  return result;
}

/**
 * Get next FOMC meeting date
 */
function getNextFOMCMeeting(fromDate = new Date()) {
  const now = fromDate.getTime();

  for (const meeting of FOMC_MEETINGS_2025_2026) {
    const meetingDate = new Date(meeting.year, meeting.month - 1, meeting.days[1]);
    if (meetingDate.getTime() > now) {
      return {
        date: meetingDate,
        isDecisionDay: true,
        pressConference: meeting.pressConference
      };
    }
  }

  return null;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Check if date is today
 */
function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

/**
 * Check if date is tomorrow
 */
function isTomorrow(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.getDate() === tomorrow.getDate() &&
         date.getMonth() === tomorrow.getMonth() &&
         date.getFullYear() === tomorrow.getFullYear();
}

/**
 * Get date label (Today, Tomorrow, or formatted date)
 */
function getDateLabel(date) {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';

  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Check if a month is in the growing season
 */
function isGrowingSeason(month) {
  return month >= 4 && month <= 11; // April - November
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Fetch energy sector reports for the next 14 days
 */
export function fetchEnergyReports() {
  const reports = [];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30); // Extended to 30 days for monthly reports

  for (const report of ENERGY_REPORTS) {
    if (report.dayOfWeek !== undefined) {
      // Weekly report
      let nextDate = getNextWeekday(report.dayOfWeek, now);

      // Add all occurrences within the next 14 days
      while (nextDate <= endDate) {
        reports.push({
          ...report,
          date: formatDate(nextDate),
          dateLabel: getDateLabel(nextDate),
          isToday: isToday(nextDate),
          isTomorrow: isTomorrow(nextDate)
        });

        // Get next week's occurrence
        const nextWeek = new Date(nextDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextDate = nextWeek;
      }
    } else if (report.monthlyDate !== undefined) {
      // Monthly report (like OPEC)
      let nextDate = getNextMonthlyDate(report.monthlyDate, now);

      if (nextDate <= endDate) {
        reports.push({
          ...report,
          date: formatDate(nextDate),
          dateLabel: getDateLabel(nextDate),
          isToday: isToday(nextDate),
          isTomorrow: isTomorrow(nextDate)
        });
      }
    }
  }

  // Sort by date
  reports.sort((a, b) => new Date(a.date) - new Date(b.date));

  return reports;
}

/**
 * Fetch agriculture sector reports for the next 30 days
 */
export function fetchAgricultureReports() {
  const reports = [];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30);
  const currentMonth = now.getMonth() + 1;

  for (const report of AGRICULTURE_REPORTS) {
    // Skip seasonal reports outside their season
    if (report.seasonalMonths && !report.seasonalMonths.includes(currentMonth)) {
      continue;
    }

    // Skip quarterly reports not in their quarter
    if (report.quarterlyMonths && !report.quarterlyMonths.includes(currentMonth)) {
      continue;
    }

    let nextDate;

    if (report.dayOfWeek !== undefined) {
      // Weekly report
      nextDate = getNextWeekday(report.dayOfWeek, now);

      while (nextDate <= endDate) {
        reports.push({
          ...report,
          date: formatDate(nextDate),
          dateLabel: getDateLabel(nextDate),
          isToday: isToday(nextDate),
          isTomorrow: isTomorrow(nextDate)
        });

        const nextWeek = new Date(nextDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextDate = nextWeek;
      }
    } else if (report.monthlyDate) {
      // Monthly report
      nextDate = getNextMonthlyDate(report.monthlyDate, now);

      if (nextDate <= endDate) {
        reports.push({
          ...report,
          date: formatDate(nextDate),
          dateLabel: getDateLabel(nextDate),
          isToday: isToday(nextDate),
          isTomorrow: isTomorrow(nextDate)
        });
      }
    }
  }

  // Sort by date
  reports.sort((a, b) => new Date(a.date) - new Date(b.date));

  return reports;
}

/**
 * Fetch Treasury auction calendar
 */
export function fetchTreasuryAuctions() {
  const reports = [];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30);

  for (const auction of TREASURY_AUCTIONS) {
    // For simplicity, we'll use the weekday pattern
    // In production, you'd want to use actual Treasury auction schedule
    let nextDate = getNextWeekday(auction.dayOfWeek, now);

    // Check if we're in the right week of the month (approximate)
    const weekOfMonth = Math.ceil(nextDate.getDate() / 7);
    if (weekOfMonth !== auction.monthlyWeek) {
      // Adjust to the correct week
      const daysToAdd = (auction.monthlyWeek - weekOfMonth) * 7;
      nextDate.setDate(nextDate.getDate() + daysToAdd);
    }

    if (nextDate <= endDate && nextDate >= now) {
      reports.push({
        ...auction,
        date: formatDate(nextDate),
        dateLabel: getDateLabel(nextDate),
        isToday: isToday(nextDate),
        isTomorrow: isTomorrow(nextDate)
      });
    }
  }

  // Sort by date
  reports.sort((a, b) => new Date(a.date) - new Date(b.date));

  return reports;
}

/**
 * Fetch Central Bank meeting calendar
 */
export function fetchCentralBankCalendar() {
  const reports = [];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 60); // Look ahead 60 days for central banks

  // FOMC meetings
  const fomc = CENTRAL_BANK_MEETINGS.FOMC;
  for (const meeting of fomc.meetings) {
    const meetingDate = new Date(meeting.year, meeting.month - 1, meeting.days[1]);

    if (meetingDate >= now && meetingDate <= endDate) {
      reports.push({
        id: `fomc-${meeting.year}-${meeting.month}`,
        name: fomc.name,
        shortName: fomc.shortName,
        category: 'centralbank',
        date: formatDate(meetingDate),
        dateLabel: getDateLabel(meetingDate),
        time: fomc.time,
        timeET: fomc.timeET,
        importance: fomc.importance,
        affectedInstruments: fomc.affectedInstruments,
        description: fomc.description + (meeting.pressConference ? ' Press conference follows.' : ''),
        scenarios: fomc.scenarios,
        isToday: isToday(meetingDate),
        isTomorrow: isTomorrow(meetingDate),
        pressConference: meeting.pressConference
      });
    }
  }

  // Sort by date
  reports.sort((a, b) => new Date(a.date) - new Date(b.date));

  return reports;
}

/**
 * Build complete reports calendar combining all categories
 */
export function buildReportsCalendar() {
  const allReports = [
    ...fetchEnergyReports(),
    ...fetchAgricultureReports(),
    ...fetchTreasuryAuctions(),
    ...fetchCentralBankCalendar()
  ];

  // Sort all reports by date and time
  allReports.sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return dateCompare;

    // If same date, sort by time
    return (a.timeET || '00:00').localeCompare(b.timeET || '00:00');
  });

  // Group by date
  const groupedReports = {};
  for (const report of allReports) {
    const dateKey = report.date;
    if (!groupedReports[dateKey]) {
      groupedReports[dateKey] = {
        date: dateKey,
        dateLabel: report.dateLabel,
        isToday: report.isToday,
        isTomorrow: report.isTomorrow,
        reports: []
      };
    }
    groupedReports[dateKey].reports.push(report);
  }

  // Convert to array and take next 14 days
  const sortedDays = Object.values(groupedReports)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 14);

  return {
    calendar: sortedDays,
    summary: {
      totalReports: allReports.length,
      highImportance: allReports.filter(r => r.importance === 'HIGH').length,
      todayReports: allReports.filter(r => r.isToday).length,
      tomorrowReports: allReports.filter(r => r.isTomorrow).length,
      categories: {
        energy: allReports.filter(r => r.category === 'energy').length,
        agriculture: allReports.filter(r => r.category === 'agriculture').length,
        bonds: allReports.filter(r => r.category === 'bonds').length,
        centralbank: allReports.filter(r => r.category === 'centralbank').length
      }
    },
    lastUpdate: new Date().toISOString()
  };
}

// Default export for convenience
export default {
  fetchEnergyReports,
  fetchAgricultureReports,
  fetchTreasuryAuctions,
  fetchCentralBankCalendar,
  buildReportsCalendar
};
