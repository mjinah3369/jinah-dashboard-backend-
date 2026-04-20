/**
 * CHATBOT KNOWLEDGE BASE — Comprehensive Market Intelligence
 *
 * This module provides the AI chatbot with deep domain knowledge to:
 * 1. Explain every report type and how it impacts markets
 * 2. Understand how dashboard outputs are generated
 * 3. Evaluate and analyze all instrument data
 * 4. Research and answer questions about specific reports
 * 5. Explain cross-market relationships and correlations
 * 6. Provide actionable trading context
 */

// ============================================================================
// SECTION 1: COMPREHENSIVE REPORT KNOWLEDGE
// Every report the dashboard tracks, with deep explanations
// ============================================================================

export const REPORT_KNOWLEDGE = {

  // ─────────────────────────────────────────────────────────
  // ENERGY REPORTS
  // ─────────────────────────────────────────────────────────

  EIA_PETROLEUM: {
    fullName: 'EIA Weekly Petroleum Status Report',
    source: 'U.S. Energy Information Administration (EIA)',
    schedule: 'Every Wednesday at 10:30 AM ET',
    impact: 'VERY HIGH — Primary mover for CL (crude oil), RB (gasoline), and energy sector',
    affectedInstruments: ['CL', 'NG', 'RB', 'XLE'],
    whatItMeasures: 'Official weekly data on US crude oil inventories, gasoline stocks, distillate stocks, refinery utilization rates, crude oil imports, and Cushing Oklahoma storage levels.',
    howToRead: {
      crude_inventory: {
        draw: 'Inventory DECREASE (draw) = demand exceeding supply = BULLISH for CL. A draw > 2M barrels is significant.',
        build: 'Inventory INCREASE (build) = supply exceeding demand = BEARISH for CL. A build > 3M barrels is significant.',
        vsExpectations: 'What matters most is ACTUAL vs FORECAST. A 1M draw when analysts expected a 3M build is very bullish.'
      },
      gasoline_stocks: 'Gasoline inventory changes affect RB (RBOB gasoline futures). Draws during summer driving season are especially bullish.',
      refinery_utilization: 'Above 92% = refineries running hard, good demand signal. Below 88% = maintenance or weak demand.',
      cushing_storage: 'Cushing, Oklahoma is the WTI delivery point. Low Cushing stocks can cause price spikes and backwardation.'
    },
    tradingStrategy: 'Volatility spikes at 10:30 AM ET. Many traders wait 2-3 minutes for initial spike to settle before entering. The API report (Tuesday 4:30 PM) often previews direction.',
    relatedReports: ['API Weekly Inventory (preview, Tuesday 4:30 PM)', 'Baker Hughes Rig Count (Friday 1:00 PM)'],
    historicalContext: 'The EIA report has been the single most important weekly data point for oil traders since 1979. It replaced less reliable API data as the official government source.'
  },

  EIA_NATURAL_GAS: {
    fullName: 'EIA Weekly Natural Gas Storage Report',
    source: 'U.S. Energy Information Administration (EIA)',
    schedule: 'Every Thursday at 10:30 AM ET',
    impact: 'EXTREME for NG — The #1 weekly mover of natural gas prices',
    affectedInstruments: ['NG'],
    whatItMeasures: 'Weekly change in underground natural gas storage in the Lower 48 states. Reports injection (adding gas) or withdrawal (using gas) in billion cubic feet (Bcf).',
    howToRead: {
      injection_season: 'April-October: Gas is INJECTED into storage. Smaller injection than expected = BULLISH (less supply being stored). Larger injection = BEARISH.',
      withdrawal_season: 'November-March: Gas is WITHDRAWN for heating. Larger withdrawal than expected = BULLISH (strong demand). Smaller withdrawal = BEARISH.',
      vs_5year_average: 'Storage level relative to the 5-year average is critical. Below average = structurally bullish. Above average = bearish overhang.',
      vs_expectations: 'Actual vs analyst consensus is the primary price mover. A 10 Bcf miss from expectations can move NG 3-5%.'
    },
    tradingStrategy: 'NG is the most volatile commodity around its report. Expect 2-5% moves. Many traders use options straddles ahead of the report.',
    seasonalContext: {
      winter: 'Nov-Mar: WITHDRAWAL season. Cold weather forecasts + large withdrawals = explosive rallies. Mild weather = collapses.',
      summer: 'Apr-Oct: INJECTION season. Typically bearish as storage builds. But extreme heat (cooling demand) can reverse this.',
      shoulder: 'Apr/May and Sep/Oct: Transition periods with lowest demand. Prices often hit seasonal lows.'
    },
    weatherConnection: 'NG is the most weather-sensitive commodity. The 6-10 day and 8-14 day temperature forecasts from NOAA directly impact price. Heating Degree Days (HDD) in winter and Cooling Degree Days (CDD) in summer quantify the demand impact.'
  },

  API_INVENTORY: {
    fullName: 'API Weekly Statistical Bulletin',
    source: 'American Petroleum Institute (API)',
    schedule: 'Every Tuesday at 4:30 PM ET',
    impact: 'MEDIUM — Preview/leading indicator for Wednesday EIA data',
    affectedInstruments: ['CL', 'RB'],
    whatItMeasures: 'Private industry estimate of crude oil and product inventories. Voluntary reporting from refiners and pipeline operators.',
    howToRead: {
      purpose: 'Acts as a preview of the official EIA data released the next morning. Sets the overnight tone for crude oil.',
      reliability: 'Generally directionally correct (~75% agreement with EIA) but magnitudes can differ significantly.',
      afterHours: 'Released after regular trading hours, so it primarily affects Globex/overnight futures trading.'
    },
    tradingStrategy: 'If API and EIA agree, the move is typically sustained. If they disagree, EIA takes precedence and can cause sharp reversals.'
  },

  BAKER_HUGHES: {
    fullName: 'Baker Hughes Rig Count',
    source: 'Baker Hughes (now Baker Hughes, a GE company)',
    schedule: 'Every Friday at 1:00 PM ET',
    impact: 'MEDIUM — Leading indicator for future US oil/gas production',
    affectedInstruments: ['CL', 'NG'],
    whatItMeasures: 'Number of active drilling rigs in the United States, split by oil rigs, gas rigs, and miscellaneous. Also reports international rig count.',
    howToRead: {
      rising_count: 'More rigs = more future production capacity = potentially BEARISH for prices (more supply coming online in 3-6 months).',
      falling_count: 'Fewer rigs = less future production = potentially BULLISH (supply tightening ahead).',
      lag_effect: 'Rig count changes take 3-6 months to impact actual production. It is a LEADING indicator, not immediate.',
      permian_focus: 'Permian Basin rig count is most closely watched as it is the most productive US oil region.'
    },
    tradingStrategy: 'Lower impact than EIA but useful for medium-term positioning. A sustained trend in rig count matters more than weekly fluctuations.'
  },

  OPEC_REPORT: {
    fullName: 'OPEC Monthly Oil Market Report (MOMR)',
    source: 'Organization of the Petroleum Exporting Countries',
    schedule: 'Monthly, usually around the 12th',
    impact: 'HIGH — Sets production and demand expectations globally',
    affectedInstruments: ['CL', 'RB', 'NG'],
    whatItMeasures: 'OPEC\'s assessment of global oil supply/demand balance, production levels by member country, demand growth forecasts, and economic outlook.',
    howToRead: {
      demand_forecast: 'OPEC raising demand growth forecast = BULLISH. Lowering = BEARISH. Watch for revisions to current and next year.',
      production_data: 'Actual production vs quotas. Non-compliance (overproduction) = BEARISH. Compliance = BULLISH.',
      supply_forecast: 'Non-OPEC supply growth estimates matter. Higher non-OPEC growth = less need for OPEC oil.',
      secondary_sources: 'OPEC reports production using "secondary sources" (independent agencies) vs self-reported. Discrepancies signal cheating.'
    },
    relatedEvents: 'OPEC+ meetings (typically every 1-2 months) are separate and even more impactful — these are where production cut/increase decisions are made.'
  },

  // ─────────────────────────────────────────────────────────
  // AGRICULTURE REPORTS
  // ─────────────────────────────────────────────────────────

  USDA_WASDE: {
    fullName: 'World Agricultural Supply and Demand Estimates (WASDE)',
    source: 'United States Department of Agriculture (USDA)',
    schedule: 'Monthly, usually around the 12th at 12:00 PM ET',
    impact: 'EXTREME for grains — The single most important agricultural report',
    affectedInstruments: ['ZC', 'ZS', 'ZW', 'ZM', 'ZL', 'LE', 'HE'],
    whatItMeasures: 'Comprehensive global supply and demand estimates for major crops (corn, soybeans, wheat, cotton, rice) and livestock. Includes US and world production estimates, consumption, exports, imports, and ending stocks.',
    howToRead: {
      ending_stocks: 'The most important number. Lower ending stocks = tighter supply = BULLISH. Higher ending stocks = ample supply = BEARISH.',
      production_estimate: 'Based on yield per acre × harvested acres. Lower production = BULLISH. Higher = BEARISH.',
      demand_changes: 'Export demand, feed use (livestock), food/industrial use (ethanol for corn). Rising demand = BULLISH.',
      stocks_to_use_ratio: 'Ending stocks divided by total use. Below 10% for corn = very tight. Above 15% = comfortable.',
      global_vs_us: 'Global balance matters too. Brazil/Argentina soybean production, Black Sea wheat can offset US changes.',
      revisions: 'Month-over-month changes matter more than absolute levels. A surprise revision moves prices.'
    },
    tradingStrategy: 'Markets often "position" ahead of WASDE. The report at 12:00 PM causes limit moves in grains. Many traders square positions before and re-enter after the initial reaction.',
    keyMonths: {
      january: 'Final production estimates for previous crop year. Important for setting baseline.',
      march: 'Prospective Plantings preview — acres matter.',
      june_august: 'Growing season — yield estimates are speculative and weather-dependent. Most volatile.',
      october_november: 'Harvest data becomes more certain. Production estimates firm up.'
    },
    historicalContext: 'WASDE has been published since 1973. It is the gold standard for agricultural market analysis. The USDA lockup procedure (analysts locked in a room until release) was created to prevent information leaks.'
  },

  CATTLE_ON_FEED: {
    fullName: 'USDA Cattle on Feed Report',
    source: 'United States Department of Agriculture, National Agricultural Statistics Service (NASS)',
    schedule: 'Monthly, released on the 3rd Friday of each month at 3:00 PM ET',
    impact: 'VERY HIGH for LE (Live Cattle) — The key cattle market report',
    affectedInstruments: ['LE'],
    whatItMeasures: 'Three critical data points for feedlots with 1,000+ head capacity: (1) On-Feed inventory — total cattle currently in feedlots being fattened for slaughter, (2) Placements — new cattle placed into feedlots during the month, (3) Marketings — cattle sold from feedlots to packers for slaughter.',
    howToRead: {
      on_feed: {
        description: 'Total cattle in feedlots. Reported as a percentage of the previous year.',
        bullish: 'On-feed below 95% of last year = tighter supply ahead = BULLISH for cattle prices.',
        bearish: 'On-feed above 105% of last year = ample supply = BEARISH.'
      },
      placements: {
        description: 'New cattle entering feedlots. This is the MOST IMPORTANT number for future supply.',
        bullish: 'Placements below 90% of last year = fewer cattle coming to market in 4-6 months = very BULLISH.',
        bearish: 'Placements above 110% = more supply coming = BEARISH.',
        weight_categories: 'Light-weight placements (<600 lbs) take longer to finish (6+ months). Heavy-weight (>800 lbs) are market-ready sooner (2-3 months). Weight distribution matters for timing.'
      },
      marketings: {
        description: 'Cattle leaving feedlots for slaughter.',
        bullish: 'Marketings above expectations = pipeline being cleared faster = near-term BEARISH but longer-term BULLISH (less future supply).',
        bearish: 'Below-expected marketings = cattle backing up in feedlots = near-term pressure on cash cattle.'
      },
      vs_expectations: 'Like all USDA reports, actual vs analyst estimates is what drives price reaction. A 3% miss on placements can cause limit moves.'
    },
    cattleCycle: {
      description: 'Cattle have a 10-year production cycle. Currently (2025-2026), the US herd is at its SMALLEST since the 1960s.',
      implication: 'This structural supply shortage means the long-term trend for cattle prices is bullish. Rebuilding the herd takes 3-4 years because cows have a 9-month gestation period.',
      phases: {
        liquidation: 'Drought or poor economics forces ranchers to sell breeding stock → herd shrinks → prices eventually rise.',
        retention: 'Rising prices incentivize keeping heifers for breeding → supply temporarily tightens further → prices spike.',
        expansion: 'Larger breeding herd produces more calves → supply gradually increases → prices moderate.',
        peak: 'Maximum herd size → oversupply → prices decline → cycle restarts.'
      }
    },
    relatedFactors: {
      feed_costs: 'Corn (ZC) is the primary feed. High corn prices squeeze cattle feeder margins and can force early liquidation.',
      drought: 'Drought destroys pasture → ranchers must sell cattle they cannot feed → short-term supply surge (bearish) but long-term herd shrinkage (bullish).',
      beef_cutout: 'USDA daily wholesale beef prices (Choice and Select cutouts) indicate packer demand. Rising cutout = packers can pay more for cattle.',
      competing_proteins: 'Chicken and pork prices affect beef demand. Cheap alternatives reduce beef consumption.',
      exports: 'Japan, South Korea, and China are major beef importers. Trade agreements and BSE (mad cow) concerns affect exports.',
      seasonal: 'Cattle prices typically peak in April-May (grilling season demand) and dip in October-November (fall run of cattle).'
    },
    tradingStrategy: 'The report at 3:00 PM Friday causes gap risk over the weekend. Many traders reduce positions ahead of the report. The placement number drives the biggest reactions.',
    historicalContext: 'The Cattle on Feed report has been the premier livestock report since the 1960s. It covers roughly 80% of all cattle in US feedlots. States covered include Texas, Nebraska, Kansas, Colorado, Iowa, and California.'
  },

  HOGS_AND_PIGS: {
    fullName: 'USDA Hogs and Pigs Report',
    source: 'USDA NASS',
    schedule: 'Quarterly (March, June, September, December), released at 3:00 PM ET',
    impact: 'VERY HIGH for HE (Lean Hogs)',
    affectedInstruments: ['HE'],
    whatItMeasures: 'Total US hog inventory, breeding herd size, pig crop (pigs born), pigs per litter, and farrowing intentions (future breeding plans).',
    howToRead: {
      total_inventory: 'All hogs on US farms. Below 100% of year-ago = tightening supply = BULLISH.',
      breeding_herd: 'Sows kept for breeding. Declining breeding herd = fewer pigs in future = BULLISH long-term.',
      pig_crop: 'Total pigs born during the quarter. Smaller pig crop = less future supply = BULLISH.',
      farrowing_intentions: 'Forward-looking breeding plans for next 2 quarters. Fewer farrowings expected = BULLISH.',
      pigs_per_litter: 'Productivity measure. Rising = more supply even with same breeding herd.'
    },
    tradingStrategy: 'Released only 4x/year, so each report has outsized impact. HE can make limit moves (3-4%). Weight categories in the inventory break determine when supply hits the market.',
    uniqueCharacteristics: 'Hogs have a shorter production cycle than cattle (breeding to market is ~10 months vs 2+ years for cattle). This means supply adjusts faster to price signals.'
  },

  CROP_PROGRESS: {
    fullName: 'USDA Crop Progress Report',
    source: 'USDA NASS',
    schedule: 'Every Monday at 4:00 PM ET (April through November only)',
    impact: 'HIGH during growing season for ZC, ZS, ZW',
    affectedInstruments: ['ZC', 'ZS', 'ZW'],
    whatItMeasures: 'Weekly planting progress, crop development stage, and crop condition ratings (Very Poor, Poor, Fair, Good, Excellent) for major US crops.',
    howToRead: {
      condition_ratings: {
        good_excellent: 'The "Good/Excellent" percentage is the key number. Higher = better crop = BEARISH for prices. Lower = stressed crop = BULLISH.',
        week_over_week: 'A 3%+ drop in Good/Excellent in one week signals deterioration (often drought) = BULLISH.',
        historical: 'Compare to 5-year average. Above average conditions = above average yields expected.'
      },
      planting_progress: 'Percentage of intended acres planted. Behind the 5-year pace = potential for prevented planting = BULLISH.',
      harvest_progress: 'Fall harvest pace. Delays from wet weather can mean quality issues and supply delays.',
      key_states: 'Iowa, Illinois, Indiana, Minnesota, Nebraska for corn. Iowa, Illinois, Minnesota, Indiana for soybeans.'
    },
    seasonalContext: 'Most impactful during June-August when crops are in critical growth stages. Corn pollination (July) and soybean pod-fill (August) are the most weather-sensitive periods.'
  },

  EXPORT_SALES: {
    fullName: 'USDA Export Sales Report',
    source: 'USDA Foreign Agricultural Service (FAS)',
    schedule: 'Every Thursday at 8:30 AM ET',
    impact: 'MEDIUM for ZC, ZS, ZW',
    affectedInstruments: ['ZC', 'ZS', 'ZW'],
    whatItMeasures: 'Weekly US agricultural export sales (new sales, cancellations) and actual export shipments by commodity and destination country.',
    howToRead: {
      flash_sales: 'Large single-day sales (>100K MT for soybeans, >400K MT for corn) trigger USDA "flash" reporting = BULLISH signal.',
      china_purchases: 'China buying US soybeans is the most closely watched. Large China purchases = very BULLISH for ZS.',
      cancellations: 'Order cancellations, especially from China, are BEARISH and can signal trade tension.',
      pace_vs_estimate: 'Compare cumulative sales to USDA\'s full-year export estimate. Running ahead of pace = BULLISH.'
    }
  },

  PLANTING_INTENTIONS: {
    fullName: 'USDA Prospective Plantings Report',
    source: 'USDA NASS',
    schedule: 'March 31 at 12:00 PM ET (annual)',
    impact: 'EXTREME — Sets the entire year\'s supply expectations',
    affectedInstruments: ['ZC', 'ZS', 'ZW'],
    whatItMeasures: 'Survey of US farmers\' planting intentions for the coming crop year. Total acres intended for corn, soybeans, wheat, and other crops.',
    howToRead: {
      corn_vs_soybeans: 'Farmers shift between corn and soybeans based on relative profitability. More corn acres = BEARISH corn, BULLISH soybeans (and vice versa).',
      total_acres: 'Overall crop acreage vs last year. Expansion = more potential supply.',
      price_impact: 'This report + Quarterly Stocks (same day) often causes the biggest single-day moves of the year in grains.'
    }
  },

  // ─────────────────────────────────────────────────────────
  // ECONOMIC / MACRO REPORTS
  // ─────────────────────────────────────────────────────────

  NFP: {
    fullName: 'Non-Farm Payrolls (US Employment Situation)',
    source: 'Bureau of Labor Statistics (BLS)',
    schedule: 'First Friday of each month at 8:30 AM ET',
    impact: 'EXTREME — Moves all major markets simultaneously',
    affectedInstruments: ['ES', 'NQ', 'YM', 'RTY', 'DX', 'GC', '6E', '6J', 'ZN'],
    whatItMeasures: 'Total number of paid US workers (excluding farm, government, private household, and nonprofit employees). Also reports unemployment rate, average hourly earnings (wage inflation), and labor force participation rate.',
    howToRead: {
      jobs_number: {
        strong: 'Above 200K = strong economy but Fed stays hawkish. Mixed for stocks (good economy but higher rates).',
        moderate: '100K-200K = "Goldilocks" — enough growth without overheating. Best outcome for stocks.',
        weak: 'Below 100K = economic weakness. Bad for economy but Fed may cut rates = often BULLISH for stocks (perversely).'
      },
      unemployment_rate: 'Below 4% = tight labor market (inflationary pressure). Above 4.5% = Fed concern, rate cut territory.',
      wage_growth: 'Average Hourly Earnings YoY above 4% = inflation concern = BEARISH for bonds and stocks. Below 3% = Fed comfort zone.',
      revisions: 'Previous two months are revised. Large downward revisions signal weakening trend even if current month looks strong.'
    },
    marketReaction: {
      good_news_bad_news: 'In rate-hiking cycles, strong jobs = bad (hawkish Fed). In rate-cutting cycles, strong jobs = good (soft landing). Context matters.',
      initial_vs_sustained: 'First reaction (30 seconds) often reverses. The sustained move develops over 30-60 minutes as traders digest details.',
      bond_market: 'ZN (10Y) often moves first and most cleanly on NFP. Equity reaction is more complex.'
    },
    tradingStrategy: 'Most volatile 30 minutes of the month. Many professional traders reduce size or sit out the first 5 minutes. The "true" reaction often doesn\'t become clear until 9:00-9:30 AM ET.'
  },

  CPI: {
    fullName: 'Consumer Price Index',
    source: 'Bureau of Labor Statistics (BLS)',
    schedule: 'Monthly, usually around the 13th at 8:30 AM ET',
    impact: 'EXTREME — Fed\'s primary inflation gauge for headline, PCE for policy',
    affectedInstruments: ['ES', 'NQ', 'GC', 'DX', 'ZN', 'TLT', '6E', '6J'],
    whatItMeasures: 'Monthly change in prices paid by consumers for a basket of goods and services. Headline CPI (all items) and Core CPI (excluding food and energy).',
    howToRead: {
      month_over_month: 'MoM change matters most. Above 0.3% = hot inflation. Below 0.1% = disinflation. Negative = deflation concern.',
      year_over_year: 'YoY for trend context. Fed targets 2% PCE (CPI runs ~0.3-0.5% higher than PCE). CPI above 3% = Fed stays tight.',
      core_vs_headline: 'Core CPI (ex-food and energy) is more important for Fed policy. Food and energy are volatile and "transitory".',
      shelter_component: 'Shelter/rent is ~1/3 of CPI. It lags real-time rents by 12-18 months. Falling real-time rents = future CPI disinflation.',
      supercore: '"Supercore" (core services ex-shelter) is what Powell watches most closely. This is the stickiest component.'
    },
    marketReaction: {
      hotter_than_expected: 'ES/NQ sell off, DXY rallies, GC falls, ZN falls (yields rise). Rate cut expectations pushed back.',
      cooler_than_expected: 'ES/NQ rally, DXY falls, GC rallies, ZN rallies. Rate cut expectations brought forward.',
      as_expected: 'Usually muted reaction unless it confirms a trend change.'
    }
  },

  PCE: {
    fullName: 'Personal Consumption Expenditures Price Index',
    source: 'Bureau of Economic Analysis (BEA)',
    schedule: 'Monthly, usually last Friday of the month at 8:30 AM ET',
    impact: 'VERY HIGH — Fed\'s PREFERRED inflation measure',
    affectedInstruments: ['ES', 'NQ', 'GC', 'DX', 'ZN'],
    whatItMeasures: 'Price changes in consumer spending. Broader than CPI and uses a different weighting methodology that accounts for consumer substitution behavior.',
    howToRead: {
      core_pce: 'Core PCE (excluding food and energy) is THE Fed target. The goal is 2.0% YoY.',
      vs_cpi: 'PCE typically runs 0.3-0.5% below CPI due to methodology differences. Both matter but PCE is what the Fed officially targets.',
      fed_reaction: 'Core PCE above 2.5% = Fed staying hawkish. Below 2.2% = rate cuts likely. At 2.0% = mission accomplished.'
    }
  },

  GDP: {
    fullName: 'Gross Domestic Product',
    source: 'Bureau of Economic Analysis (BEA)',
    schedule: 'Quarterly, with Advance (1st), Second, and Third estimates',
    impact: 'VERY HIGH — Broadest measure of economic health',
    affectedInstruments: ['ES', 'NQ', 'YM', 'RTY', 'DX'],
    whatItMeasures: 'Total value of goods and services produced in the US. Components: Consumer spending (~68%), Business investment, Government spending, Net exports.',
    howToRead: {
      advance_estimate: 'Released ~30 days after quarter ends. Most market-moving of the three releases.',
      growth_rate: 'Above 2.5% = strong growth. 1-2% = moderate. Below 1% = stall speed. Negative = recession risk.',
      gdp_now: 'Atlanta Fed GDPNow provides real-time tracking estimates throughout the quarter.',
      recession: 'Two consecutive quarters of negative GDP = technical recession (though NBER uses broader criteria).'
    }
  },

  FOMC: {
    fullName: 'Federal Open Market Committee Meeting',
    source: 'Federal Reserve',
    schedule: '8 times per year, decision at 2:00 PM ET, press conference at 2:30 PM ET',
    impact: 'EXTREME — The most important scheduled market event',
    affectedInstruments: ['ES', 'NQ', 'YM', 'RTY', 'GC', 'DX', 'ZN', '6E', '6J', 'ZB'],
    whatItMeasures: 'Fed Funds Rate target, monetary policy statement language, and economic projections (quarterly SEP with dot plot).',
    howToRead: {
      rate_decision: 'Usually priced in by Fed Funds futures. A surprise cut/hike (rare) causes massive moves.',
      statement_language: 'Word changes from previous statement matter enormously. "Elevated" vs "somewhat elevated" inflation can move markets.',
      dot_plot: 'Released quarterly — shows individual FOMC members\' rate projections. Median dot for year-end is the key number.',
      press_conference: 'Powell\'s tone often REVERSES the initial reaction to the statement. Dovish tone rescues hawkish statement (and vice versa).',
      dissents: 'Unanimous decisions are less interesting. Multiple dissents signal upcoming policy change.'
    },
    tradingStrategy: 'The period from 2:00-3:30 PM on FOMC days is the most volatile of the year. Many institutional traders are sidelined. The first move on the statement (2:00 PM) often reverses during the press conference (2:30 PM). The "true" FOMC reaction often isn\'t clear until the next day.',
    keyTerms: {
      hawkish: 'Bias toward higher rates or tighter policy. BEARISH for stocks/bonds, BULLISH for dollar.',
      dovish: 'Bias toward lower rates or easier policy. BULLISH for stocks/bonds, BEARISH for dollar.',
      data_dependent: 'Fed watching incoming data before deciding. Puts focus on next NFP/CPI.',
      restrictive: 'Rates above neutral — intentionally slowing economy.',
      neutral: 'Rate that neither stimulates nor restricts growth. Fed estimates around 2.5-3.0%.'
    }
  },

  ISM_MANUFACTURING: {
    fullName: 'ISM Manufacturing PMI',
    source: 'Institute for Supply Management',
    schedule: 'First business day of each month at 10:00 AM ET',
    impact: 'HIGH — Leading indicator for industrial economy',
    affectedInstruments: ['ES', 'YM', 'RTY', 'CL', 'HG'],
    whatItMeasures: 'Purchasing Managers Index — survey of manufacturing sector activity. Components: New Orders, Production, Employment, Supplier Deliveries, Inventories.',
    howToRead: {
      headline: 'Above 50 = expansion. Below 50 = contraction. Above 55 = strong expansion.',
      new_orders: 'Most forward-looking component. New Orders above 55 = strong demand ahead.',
      prices_paid: 'Inflation indicator. Rising prices paid = input cost inflation for manufacturers.',
      employment: 'Leads NFP manufacturing employment. Falling = layoffs ahead.'
    }
  },

  RETAIL_SALES: {
    fullName: 'US Advance Monthly Retail Sales',
    source: 'Census Bureau',
    schedule: 'Monthly, around the 15th at 8:30 AM ET',
    impact: 'HIGH — Consumer spending is 68% of GDP',
    affectedInstruments: ['ES', 'YM', 'RTY'],
    whatItMeasures: 'Total retail and food services sales. Headline and "control group" (excludes autos, gas, building materials, food services) which feeds into GDP calculations.',
    howToRead: {
      control_group: 'The control group number matters most for GDP calculations and market reaction.',
      ex_autos: 'Auto sales are volatile. Ex-auto number gives cleaner read on consumer health.',
      trend: 'Three consecutive months of decline = recession warning for consumer sector.'
    }
  },

  // ─────────────────────────────────────────────────────────
  // TREASURY & BOND REPORTS
  // ─────────────────────────────────────────────────────────

  TREASURY_AUCTIONS: {
    fullName: 'US Treasury Note and Bond Auctions',
    source: 'US Department of the Treasury',
    schedule: 'Multiple times monthly — 2Y, 5Y, 10Y, 30Y on specific schedules',
    impact: 'HIGH for ZT, ZF, ZN, TN, ZB',
    affectedInstruments: ['ZT', 'ZF', 'ZN', 'TN', 'ZB'],
    whatItMeasures: 'Government borrowing via bond sales. Results show demand for US government debt.',
    howToRead: {
      bid_to_cover: 'Ratio of bids received to amount offered. Above 2.5 = strong demand. Below 2.0 = weak demand. Weak auction = yields rise = BEARISH for bonds.',
      tail: 'Difference between high yield at auction and pre-auction "When Issued" yield. A "tail" (higher yield) = weak demand. Stopping "through" (lower yield) = strong demand.',
      indirect_bidders: 'Proxy for foreign central bank demand. Above 65% = strong foreign demand for US debt.',
      direct_bidders: 'Domestic institutional buyers. Rising direct bids can offset weak indirect.',
      implications: 'Weak Treasury auction = yields rise = BEARISH for stocks and bonds. Strong auction = yields fall = BULLISH.'
    },
    schedule_detail: {
      '2Y': 'Monthly, usually 4th week Tuesday. Most sensitive to Fed rate expectations.',
      '5Y': 'Monthly, usually 4th week Wednesday. Belly of the curve, affects mortgages.',
      '10Y': 'Monthly, usually 2nd week Wednesday. Benchmark rate for everything.',
      '30Y': 'Monthly, usually 2nd week Thursday. Long-term inflation expectations.'
    }
  },

  // ─────────────────────────────────────────────────────────
  // POSITIONING & SENTIMENT REPORTS
  // ─────────────────────────────────────────────────────────

  COT: {
    fullName: 'Commitments of Traders (COT) Report',
    source: 'Commodity Futures Trading Commission (CFTC)',
    schedule: 'Every Friday at 3:30 PM ET (data as of previous Tuesday)',
    impact: 'MEDIUM — Positioning/sentiment indicator for all futures',
    affectedInstruments: ['ALL futures markets'],
    whatItMeasures: 'Breakdown of open interest (outstanding contracts) by trader category: Commercial (hedgers), Non-Commercial (speculators/funds), and Non-Reportable (small traders).',
    howToRead: {
      commercial: 'Producers and consumers hedging. They are naturally short (selling future production) or long (locking in purchase prices). Considered "smart money" at extremes.',
      non_commercial: 'Speculative/managed money (hedge funds). They follow trends. Extreme positioning = CONTRARIAN signal.',
      crowded_long: 'When speculators are extremely net long (e.g., top 10% historically), it means everyone who wants to buy already has. Further upside limited. CONTRARIAN BEARISH.',
      crowded_short: 'When speculators are extremely net short, maximum pessimism is priced in. Short covering can trigger sharp rallies. CONTRARIAN BULLISH.',
      net_position_change: 'Week-over-week change in net speculative position shows flow direction.'
    },
    tradingStrategy: 'COT is best used as a confirming indicator at extremes, not a timing tool. Crowded positioning can persist for weeks before reversing.',
    instruments_covered: 'All major futures: ES, NQ, CL, NG, GC, SI, ZC, ZS, ZW, 6E, 6J, 6B, 6A, ZN, and more.'
  },

  PUT_CALL_RATIO: {
    fullName: 'CBOE Put/Call Ratio',
    source: 'Chicago Board Options Exchange (CBOE)',
    schedule: 'Daily, end of day',
    impact: 'MEDIUM — Sentiment/contrarian indicator',
    affectedInstruments: ['ES', 'NQ', 'SPY'],
    whatItMeasures: 'Ratio of put option volume to call option volume. Equity-only and total (including index options).',
    howToRead: {
      below_065: 'Extreme greed/complacency — too many bulls buying calls. CONTRARIAN BEARISH. Pullback likely.',
      normal_065_085: 'Neutral range — no strong signal.',
      elevated_085_100: 'Elevated fear — more puts being bought. Cautiously BULLISH.',
      above_100: 'Extreme fear — everyone buying puts/hedging. CONTRARIAN BULLISH. Often near bottoms.'
    },
    tradingStrategy: 'Works best at extremes as a contrarian indicator. 5-day or 10-day moving average smooths noise.'
  }
};


// ============================================================================
// SECTION 2: HOW THE DASHBOARD GENERATES ITS OUTPUTS
// ============================================================================

export const DASHBOARD_SYSTEM_KNOWLEDGE = {

  overview: `The Jinah Fundamental Dashboard is a professional trading intelligence platform with:
- A React/TypeScript frontend (hosted on Lovable)
- A Node.js/Express backend (hosted on Render)
- Multiple data sources feeding into AI analysis agents
- Real-time TradingView integration via Pine Script webhooks`,

  dataFlow: {
    description: 'Data flows from external APIs → Backend services → AI analysis → Frontend display',
    sources: {
      'Yahoo Finance': 'FREE — Provides 15-min delayed prices for futures (ES, NQ, CL, GC, etc.), ETFs (XLK, HYG, TLT), stocks (Mag7), currencies, and international indices. This is the primary price data source.',
      'Finnhub': 'FREE tier (60 calls/min) — Market news headlines, earnings calendar, economic calendar, company-specific news for Mag7.',
      'NewsAPI': 'FREE tier (100 req/day) — Reuters, Bloomberg, CNBC, Financial Times headlines. Merged with Finnhub and deduplicated.',
      'FRED API': 'FREE (unlimited) — Federal Reserve economic data: NFP, CPI, GDP, unemployment, yields, Fed Funds rate, and 25+ economic indicators.',
      'EIA API': 'FREE — Energy data: crude/gas inventories, refinery utilization, production.',
      'CFTC': 'FREE — Commitments of Traders positioning data.',
      'CBOE': 'FREE — Put/Call ratio sentiment data.',
      'Google Sheets': 'User-curated news headlines via CSV export. Analyzed by Claude AI.',
      'TradingView Webhooks': 'Real-time data from Pine Script indicators: prices, delta, CVD, session levels, sweeps.'
    }
  },

  aiAnalysis: {
    description: 'Three specialized AI agents analyze data and a Master Orchestrator synthesizes:',
    newsAgent: 'Scans headlines from Finnhub, NewsAPI, and Google Sheets. Tags each headline with affected instruments using a 300+ keyword dictionary. Determines impact level and bias.',
    levelsAgent: 'Analyzes technical levels, session data, and sweep tracker output.',
    macroAgent: 'Processes FRED economic indicators, COT positioning, put/call ratio, calculated metrics (crack spread, real yield, carry trade, gold/silver ratio), and report schedule.',
    masterOrchestrator: 'Combines all agent outputs into a unified analysis with bias, confidence, top picks, and actionable recommendations.',
    model: 'Uses Claude Sonnet for analysis (claude-sonnet-4-20250514). Cached for 5 minutes to reduce API costs.'
  },

  outputs: {
    dashboardPage: 'Main page showing instrument cards with prices, changes, context blurbs, and news. Includes VIX gauge, sector performance, Mag7 stocks, currency futures with DXY strength meter, and international indices.',
    reportsCalendar: 'Dedicated page showing upcoming energy, agriculture, treasury, and central bank reports grouped by date with countdown timers and bullish/bearish scenarios.',
    weatherSection: 'Agricultural impact analysis with drought monitor, temperature/precipitation outlooks, and commodity-specific impact assessments.',
    newsAnalysis: 'AI-analyzed news page with impact/bias badges, symbol tags, filtering, and search.',
    sessionControlCenter: 'Shows current trading session (Asia/London/US), IB countdown, session levels, and next session info.',
    dailyBrief: 'AI-generated "What to Look For Today" analysis combining all data sources into actionable trading intelligence.',
    esCommandCenter: 'ES-specific analysis with drivers, correlations, institutional context (credit spreads, gap analysis, OPEX, seasonality), and Mag7 impact.'
  },

  howBiasIsCalculated: `Market bias for each instrument is determined by combining:
1. Price action (change %, trend direction)
2. Technical indicators (EMA 21/55 alignment, ADX trend strength)
3. Correlated instrument behavior (VIX for ES, DXY for GC, etc.)
4. News sentiment (keyword-tagged headlines analyzed by AI)
5. Fundamental context (reports, COT positioning, economic data)
6. Session context (Asia vs London vs US session behavior)

Confidence levels range from 0-100% based on how many factors align.
Grade system: A+ (135+), A (115-134), B (95-114), C (70-94), F (<70).`,

  howContextBlurbsWork: `Each instrument gets a short "contextBlurb" — a 5-10 word phrase explaining what's driving the current price action.

Blurbs are generated based on 5 price change levels:
- strong_up (>1.5%): e.g., "Dollar firm on safe-haven demand"
- up (>0.3%): e.g., "Euro supported by ECB hawks"
- flat (-0.3% to +0.3%): e.g., "Gold consolidating near support"
- down (<-0.3%): e.g., "Oil soft on demand concerns"
- strong_down (<-1.5%): e.g., "Yen weak as carry trades resume"

Each instrument has custom blurb templates that incorporate its specific drivers.`
};


// ============================================================================
// SECTION 3: CROSS-MARKET ANALYSIS FRAMEWORK
// ============================================================================

export const CROSS_MARKET_KNOWLEDGE = {

  correlationMatrix: {
    'GC ↑ + DXY ↓ + VIX ↑': { interpretation: 'Classic risk-off environment', tradeImplication: 'Short NQ, long GC. Expect equity weakness.', reason: 'Gold rises as safe haven, dollar weakens on rate cut expectations, VIX spikes on fear.' },
    'CL ↑ + HG ↑ + 6A ↑': { interpretation: 'China demand / global growth optimism', tradeImplication: 'Long RTY, long commodity currencies.', reason: 'Copper (Dr. Copper) and oil rising together signals genuine industrial demand. AUD benefits from commodity exports to China.' },
    'CL ↓ + NG ↓ + HYG ↓': { interpretation: 'Recession fear', tradeImplication: 'Short ES, long ZN (bonds).', reason: 'Energy demand falling + credit stress (high yield selling) = economic contraction signal.' },
    '6J ↑ + VIX ↑': { interpretation: 'Carry trade unwind / risk-off', tradeImplication: 'Danger for NQ (especially tech). Reduce risk.', reason: 'Yen strengthening means leveraged carry trade positions unwinding. Aug 2024 showed how violent this can be.' },
    'DXY ↑ + GC ↑': { interpretation: 'Extreme geopolitical fear', tradeImplication: 'Maximum caution — both safe havens bid simultaneously.', reason: 'Normally inverse. When both rise, fear is so high it overrides the dollar-gold relationship. Rare and dangerous.' },
    'BTC ↑ + GC ↑ + VIX ↓': { interpretation: 'Liquidity expansion / risk-on', tradeImplication: 'Long NQ, long crypto. Broad liquidity lift.', reason: 'Both risk assets and safe havens rising with low fear = excess liquidity entering all markets.' },
    'NQ ↑ + RTY ↓': { interpretation: 'Narrow tech rally — fragile', tradeImplication: 'Caution on equity longs. Breadth not confirming.', reason: 'Only mega-cap tech participating. Small caps not confirming = rally built on narrow foundation.' },
    'NQ ↓ + RTY ↑': { interpretation: 'Healthy rotation — breadth expanding', tradeImplication: 'Constructive for broad market. Consider YM over NQ.', reason: 'Money rotating from overvalued tech to undervalued small caps. Sign of healthy market.' },
    'LE ↑ + ZC ↑': { interpretation: 'Feed cost squeeze for ranchers', tradeImplication: 'Margin pressure on cattle feeders. Watch for liquidation if sustained.', reason: 'Rising cattle prices are good for ranchers but rising corn (feed) costs squeeze feeder margins.' },
    'ZS ↓ + ZC ↓ + ZW ↓': { interpretation: 'Agricultural demand destruction or bumper crop', tradeImplication: 'Check WASDE context — is this supply-driven (good crop) or demand-driven (recession)?', reason: 'All grains falling together = either excellent growing conditions (bearish supply) or global demand collapse.' }
  },

  rotationSignals: {
    techToValue: 'NQ lagging while YM/RTY outperform. Triggered by: rate cuts (RTY most sensitive), earnings disappointments in Mag7, or bank sector strength.',
    valueToTech: 'NQ outperforming while RTY/YM lag. Triggered by: AI narrative acceleration, rate hike fears (RTY most hurt), or weak economic data (small caps most domestic).',
    riskOnToRiskOff: 'ES/NQ falling, GC/6J/VIX rising, ZN rallying. Triggered by: geopolitical shock, recession fear, or financial system stress.',
    riskOffToRiskOn: 'ES/NQ rallying, GC/6J flat or falling, VIX crushed. Triggered by: FOMC dovish surprise, strong economic data with low inflation, or geopolitical resolution.'
  },

  sessionAnalysis: {
    asia: {
      hours: '6:00 PM - 2:00 AM ET',
      keyInstruments: ['N225 (Nikkei)', 'HSI (Hang Seng)', 'Shanghai Composite', '6J (Yen)', '6A (AUD)'],
      whatToWatch: 'BOJ decisions, China PMI/stimulus, yen carry trade dynamics. If Nikkei strong + Yen weak = risk-on. If Yen surging = risk-off warning for US session.',
      esImplication: 'Asia sets the overnight tone. A strong Asia session with weak yen typically means ES gaps up at US open.'
    },
    london: {
      hours: '2:00 AM - 8:00 AM ET',
      keyInstruments: ['DAX', 'FTSE', 'STOXX', '6E (Euro)', '6B (Pound)', 'GC (Gold — London Fix)'],
      whatToWatch: 'ECB/BOE decisions, European PMI data, London gold fix. European data releases happen 2:00-4:00 AM ET.',
      esImplication: 'London provides the "real" pre-market setup. Strong European session usually supports US open.'
    },
    us: {
      hours: '8:00 AM - 5:00 PM ET',
      keyInstruments: ['ES', 'NQ', 'CL', 'ZN', 'All US instruments'],
      whatToWatch: 'Economic data releases (8:30 AM), options flow, institutional rebalancing. 80%+ of volume occurs during US session.',
      subSessions: {
        preMarket: '8:00-9:30 AM — Data releases, gap analysis, positioning.',
        initialBalance: '9:30-10:30 AM — First hour range sets the day\'s framework.',
        midday: '10:30 AM-1:00 PM — Often lower volatility, range-bound.',
        afternoon: '1:00-3:00 PM — Institutional flow, bond auction results.',
        close: '3:00-4:00 PM — MOC (Market on Close) orders, final positioning.'
      }
    }
  }
};


// ============================================================================
// SECTION 4: DEEP INSTRUMENT PROFILES
// (Supplements what's already in chatbot.js MARKET_KNOWLEDGE)
// ============================================================================

export const EXTENDED_INSTRUMENT_KNOWLEDGE = {

  // Agriculture instruments that were missing from original knowledge base
  ZW: {
    fullName: 'Wheat Futures (CBOT Soft Red Winter)',
    tickSize: '$12.50 per tick (1/4 cent per bushel)',
    contractSize: '5,000 bushels',
    drivers: [
      'Black Sea supply (Russia/Ukraine = ~30% of global exports)',
      'USDA WASDE monthly report',
      'US Plains weather (Kansas, Oklahoma) for winter wheat',
      'Russian export policy (taxes, quotas, bans)',
      'Global stockpiles and stocks-to-use ratio',
      'India export ban (periodic — supply shock)',
      'Australian crop (El Niño/La Niña effect)',
      'Quality concerns (protein content — wet harvest = low quality)'
    ],
    interpretation: 'Most geopolitically sensitive grain. Russia-Ukraine war made wheat a headline commodity. Different classes: SRW (CBOT), HRW (KCBT), HRS (MGEX).',
    correlations: { positive: ['ZC', 'ZS'], negative: ['Favorable weather'], related: ['Russian policy', 'Black Sea'] }
  },

  ZM: {
    fullName: 'Soybean Meal Futures',
    tickSize: '$10 per tick (10 cents per short ton)',
    contractSize: '100 short tons',
    drivers: [
      'Livestock feed demand (primary protein feed for hogs/poultry)',
      'Crush margins (soybean crush profitability)',
      'Soybeans (ZS) — ZM is a soybean product',
      'Argentine supply (largest meal exporter)',
      'China hog herd size (African Swine Fever recovery)',
      'NOPA monthly crush report',
      'DDGS competition (distillers grains from ethanol)'
    ],
    interpretation: 'Often leads soybeans during demand-driven rallies. The Meal/Oil spread is a key trade.',
    correlations: { positive: ['ZS', 'ZL', 'LE', 'HE'], negative: ['DDGS supply'], related: ['Argentine weather'] }
  },

  ZL: {
    fullName: 'Soybean Oil Futures',
    tickSize: '$6 per tick (1/100 cent per pound)',
    contractSize: '60,000 pounds',
    drivers: [
      'Renewable diesel policy (EPA mandates)',
      'Palm oil (Malaysia) — direct competitor',
      'Crush margins (oil share of crush value)',
      'Biodiesel blending (RIN credit values)',
      'Canola/rapeseed (Canadian substitute)',
      'Energy complex (renewable diesel competes with CL)'
    ],
    interpretation: 'Transformed from food commodity to energy commodity due to renewable diesel demand. EPA rulings are major catalysts.',
    correlations: { positive: ['ZS', 'CL'], negative: ['Palm oil'], related: ['EPA policy', 'RIN credits'] }
  },

  LE: {
    fullName: 'Live Cattle Futures',
    tickSize: '$10 per tick (2.5 cents per pound)',
    contractSize: '40,000 pounds',
    drivers: [
      'Cattle on Feed Report (USDA monthly, 3rd Friday)',
      'Beef cutout values (USDA daily wholesale beef)',
      'Packer margins (spread between cattle and beef)',
      'US herd size (cyclical — currently smallest since 1960s)',
      'Feed costs (corn = primary feed)',
      'Drought (pasture conditions → forced liquidation)',
      'Export markets (Japan, South Korea, China)',
      'Seasonal pattern (prices peak Apr-May for grilling)'
    ],
    interpretation: 'Currently in a multi-year structural bull market due to smallest US herd since 1960s. Rebuilding takes 3-4 years.',
    correlations: { positive: ['Beef cutout'], negative: ['ZC (feed costs)', 'Drought'], related: ['HE (competing protein)'] }
  },

  HE: {
    fullName: 'Lean Hog Futures',
    tickSize: '$10 per tick (2.5 cents per pound)',
    contractSize: '40,000 pounds',
    drivers: [
      'USDA Hogs & Pigs Report (quarterly)',
      'Pork cutout values (USDA daily wholesale)',
      'China export demand (swing buyer)',
      'Cold storage (monthly frozen pork stocks)',
      'Slaughter pace (daily/weekly data)',
      'Feed costs (corn + soybean meal)',
      'Disease risk (PRRS, African Swine Fever)',
      'Seasonal demand (summer grilling peak Jun-Jul)'
    ],
    interpretation: 'Most volatile agricultural market. Limit moves are common. Thin liquidity causes extreme swings. Shorter production cycle than cattle (~10 months).',
    correlations: { positive: ['Pork cutout'], negative: ['ZC + ZM (feed costs)'], related: ['LE (competing protein)', 'China demand'] }
  },

  SI: {
    fullName: 'Silver Futures',
    tickSize: '$25 per tick (0.5 cents per troy ounce)',
    contractSize: '5,000 troy ounces',
    drivers: [
      'Gold (GC) — silver follows gold directionally but amplifies 2-3x',
      'Gold/Silver ratio (>80 = silver cheap, <60 = silver expensive)',
      'Industrial demand (solar panels, electronics, EVs)',
      'US Dollar (DXY) — inverse',
      'China Manufacturing PMI — industrial demand proxy',
      'COMEX inventory levels'
    ],
    interpretation: 'Hybrid metal — part precious (safe haven), part industrial. More volatile than gold. In recession, gold outperforms. In growth boom, silver outperforms.',
    correlations: { positive: ['GC', 'HG', 'Risk sentiment'], negative: ['DXY'], related: ['Solar policy'] }
  },

  HG: {
    fullName: 'Copper Futures ("Dr. Copper")',
    tickSize: '$12.50 per tick (0.05 cents per pound)',
    contractSize: '25,000 pounds',
    drivers: [
      'China economy (consumes ~55% of global copper)',
      'China PMI (direct demand indicator)',
      'US Housing Starts (copper in wiring, plumbing)',
      'EV production (EVs use 4x more copper than ICE)',
      'LME inventory levels',
      'Chile/Peru supply (~40% of global production)',
      'Infrastructure spending (power grids, 5G, data centers)',
      'Green energy policy (solar, wind all need copper)'
    ],
    interpretation: '"Dr. Copper" — best real-time gauge of global industrial health. Copper rising + equities rising = genuine growth. Copper falling + equities rising = fragile liquidity-driven rally.',
    correlations: { positive: ['6A (AUD)', 'China PMI', 'Industrial metals'], negative: ['DXY'], related: ['BHP', 'FCX'] }
  },

  RB: {
    fullName: 'RBOB Gasoline Futures',
    tickSize: '$4.20 per tick (0.01 cents per gallon)',
    contractSize: '42,000 gallons',
    drivers: [
      'Crude Oil (CL) — input cost (~60% of gasoline price)',
      'Crack spread (RB - CL) — refinery profit margin',
      'Refinery utilization and turnaround schedules',
      'Driving season (Memorial Day → Labor Day)',
      'EIA gasoline inventory (Wednesday)',
      'Hurricane season (Gulf Coast refineries)',
      'Political pressure (SPR releases to lower gas prices)'
    ],
    interpretation: 'Retail gasoline benchmark. Most seasonal energy product. Feb-May prices typically rise (turnaround + summer blend), Jun-Aug peak, Sep-Nov decline.',
    correlations: { positive: ['CL'], negative: ['Refinery outages (temporarily bullish RB)'], related: ['Ethanol/corn'] }
  },

  DX: {
    fullName: 'US Dollar Index Futures',
    composition: 'EUR (57.6%), JPY (13.6%), GBP (11.9%), CAD (9.1%), SEK (4.2%), CHF (3.6%)',
    drivers: [
      'Fed interest rate policy (PRIMARY)',
      'US economic data (NFP, CPI, GDP)',
      'Risk sentiment (dollar = safe haven)',
      'ECB/BOJ relative policy divergence',
      'US Treasury yields (especially 2Y)',
      'Capital flows into US assets',
      'Geopolitical crises (reserve currency bid)'
    ],
    interpretation: 'DX up = headwind for commodities (GC, SI, CL), multinationals (NQ), and emerging markets. DX down = tailwind for gold, commodities, and international assets.',
    impact: {
      commodities: 'All commodities priced in USD become more expensive for foreign buyers when dollar rises.',
      stocks: 'S&P 500 multinationals earn ~40% of revenue abroad. Strong dollar reduces translated earnings.',
      gold: 'Strongest inverse correlation. DXY is the #1 driver of gold prices.',
      emerging_markets: 'Dollar strength makes dollar-denominated debt more expensive for EM countries.'
    }
  },

  '6C': {
    fullName: 'Canadian Dollar Futures',
    drivers: [
      'Bank of Canada (BOC) rate decisions',
      'Crude oil (CL) — Canada is a major oil exporter',
      'US economic health (75% of Canadian exports go to US)',
      'Canadian employment (same day as US NFP, 1st Friday)',
      'Canadian housing market (rate-sensitive)',
      'USMCA trade agreement stability'
    ],
    interpretation: 'Essentially an oil trade with a central bank overlay. When you trade CL, you are indirectly trading 6C.',
    correlations: { positive: ['CL', 'Commodities'], negative: ['DX'], related: ['US economy', 'USMCA'] }
  },

  '6S': {
    fullName: 'Swiss Franc Futures',
    drivers: [
      'Swiss National Bank (SNB) policy — most interventionist central bank',
      'Safe haven flows (CHF = traditional haven)',
      'European risk events (Swiss safe haven during EU crises)',
      'Gold prices (Switzerland = gold trading hub)',
      'SNB direct currency intervention (actively manages CHF)'
    ],
    interpretation: 'Like JPY — safe haven behavior. SNB shock of 2015 (abandoning EUR/CHF floor) is still remembered. SNB will intervene if CHF gets too strong.',
    correlations: { positive: ['GC', '6J'], negative: ['Risk-on'], related: ['European stability'] }
  }
};


// ============================================================================
// SECTION 5: RESEARCH KNOWLEDGE — Common trader questions
// ============================================================================

export const RESEARCH_KNOWLEDGE = {

  // Common "what is" questions with educational answers
  concepts: {
    carry_trade: {
      question: 'What is the carry trade and how does it affect markets?',
      answer: `The carry trade involves borrowing in a low-interest-rate currency (like the Japanese yen at ~0.5%) and investing in a higher-yielding currency/asset (like US treasuries at ~4.5%). The "carry" is the interest rate differential.

HOW IT WORKS:
1. Borrow yen cheaply (near-zero rates)
2. Convert yen to dollars
3. Buy US bonds/stocks earning higher yield
4. Pocket the yield difference

WHY IT MATTERS:
- Creates steady selling pressure on yen (6J falls) and buying pressure on US assets
- When it UNWINDS (carry trade reversal), it causes violent yen strength + asset selling
- August 2024 showed a carry trade unwind can crash NQ 5%+ in days
- BOJ rate hikes or US rate cuts narrow the spread and trigger unwinds

KEY INDICATOR: US-Japan 10Y yield spread. Above 3.5% = strong carry incentive. Below 2.0% = unwind risk.`
    },

    contango_backwardation: {
      question: 'What is contango and backwardation in futures?',
      answer: `Contango: Future month prices are HIGHER than spot. Normal in most markets (storage costs, insurance, financing). Oil in contango = market expects future supply concerns or costs.

Backwardation: Future month prices are LOWER than spot. Signals current supply tightness — buyers willing to pay a premium for immediate delivery. Oil in backwardation = current demand exceeding supply = BULLISH signal.

TRADING IMPLICATION: In backwardation, rolling long positions earns "roll yield" (selling high near-month, buying low far-month). In contango, rolling costs money.`
    },

    value_area: {
      question: 'What is Value Area and how do traders use it?',
      answer: `Value Area is derived from Volume Profile analysis — the price range where 70% of trading volume occurred during a specific period.

KEY LEVELS:
- VAH (Value Area High): Upper boundary of the 70% volume zone
- VAL (Value Area Low): Lower boundary
- POC (Point of Control): Single price level with the highest volume

TRADING RULES:
- Price above VAH = PREMIUM zone (sellers have edge)
- Price below VAL = DISCOUNT zone (buyers have edge)
- Price at POC = FAIR VALUE (balanced, expect rotation)
- Opening above previous day's VAH and holding = BULLISH
- Opening below previous day's VAL and holding = BEARISH

The dashboard calculates these using a 200-bucket Volume Profile algorithm with 200-bar lookback.`
    },

    liquidity_sweep: {
      question: 'What is a liquidity sweep?',
      answer: `A liquidity sweep occurs when price briefly pierces a significant level (like a swing high/low) to trigger stop-loss orders sitting there, then quickly reverses back.

HOW IT WORKS:
1. Traders place stop losses above swing highs (shorts) or below swing lows (longs)
2. Large players push price through these levels to trigger the stops
3. The stop orders provide liquidity (counterparty) for the large player's real position
4. Price reverses sharply after the stops are triggered

TYPES:
- High sweep + close below = BEARISH (sell signal — false breakout above resistance)
- Low sweep + close above = BULLISH (buy signal — false breakdown below support)

The dashboard's ICT Scanner detects sweeps of PDH/PDL, PWH/PWL, and liquidity swing levels.`
    },

    order_blocks: {
      question: 'What are order blocks in ICT trading?',
      answer: `Order blocks are price zones where institutional traders placed large orders, creating supply/demand imbalances.

IDENTIFICATION:
- Bullish OB: Last bearish candle before a strong bullish move (displacement)
- Bearish OB: Last bullish candle before a strong bearish move

WHY THEY WORK:
- Institutions can't fill large orders at once — they need multiple entries
- The order block zone represents unfilled institutional orders
- When price returns to this zone, those unfilled orders get triggered again

TRADING USE:
- Buy at bullish OB (demand zone) with stop below
- Sell at bearish OB (supply zone) with stop above
- Mitigation: When price passes through an OB completely, it's "mitigated" (used up)
- Breaker: Failed OB that becomes the opposite zone

The dashboard detects OBs using three methods: displacement, engulfing, and swing break.`
    },

    cattle_cycle: {
      question: 'What is the cattle cycle and where are we now?',
      answer: `The cattle cycle is a 10-year biological production cycle unique to cattle:

THE CYCLE:
1. LIQUIDATION (current phase ending): Drought or poor economics → ranchers sell breeding cows → herd shrinks → prices eventually rise
2. RETENTION (beginning now): High prices → ranchers keep heifers for breeding instead of selling → supply tightens further → prices spike
3. EXPANSION: Larger breeding herd → more calves born → 2-3 years until market-ready → supply gradually increases
4. PEAK: Maximum herd size → oversupply → prices decline → cycle restarts

WHY IT TAKES SO LONG:
- Cow gestation: 9 months
- Calf to market: 18-24 months
- Total cycle: Birth to slaughter = 2.5-3 years
- You can't speed up biology

WHERE WE ARE (2025-2026):
- US herd is at its SMALLEST since the 1960s
- We are transitioning from liquidation to retention
- Herd rebuilding will take 3-4 years minimum
- Structural BULL MARKET for cattle prices
- Cattle on Feed Report is the key monthly indicator for tracking this cycle`
    },

    crack_spread: {
      question: 'What is the crack spread?',
      answer: `The crack spread measures refinery profit margins — the difference between the cost of crude oil (input) and the value of refined products like gasoline (output).

SIMPLE CALCULATION: (RB gasoline price × 42) - CL crude price = crack spread per barrel
(RB is priced per gallon, CL per barrel. 42 gallons = 1 barrel)

INTERPRETATION:
- Above $35: WIDE — Strong refinery margins, refineries running at full capacity
- $15-$30: NORMAL — Healthy refinery economics
- Below $15: TIGHT — Weak demand or oversupply of refined products, refineries may cut production

WHY IT MATTERS:
- Tight crack spreads mean refineries reduce crude oil purchases → bearish CL
- Wide crack spreads mean refineries bid aggressively for crude → bullish CL
- Seasonal: Crack spreads typically widen in spring (turnaround season + summer blend switch) and narrow in fall`
    },

    yield_curve_inversion: {
      question: 'What is yield curve inversion and what does it predict?',
      answer: `Yield curve inversion occurs when short-term Treasury yields exceed long-term yields (2Y yield > 10Y yield).

NORMAL CURVE: Long-term bonds pay more than short-term (investors need compensation for locking up money longer).
INVERTED CURVE: Short-term bonds pay more — signals the market expects the Fed will need to cut rates because the economy is weakening.

TRACK RECORD: Yield curve inversion has preceded every US recession since 1969. However:
- Timing is unreliable (recession can come 6-24 months after inversion)
- The UN-INVERSION (curve normalizing from inverted) often signals the recession is about to START
- Bull steepening (short rates falling faster) = Fed cutting into recession

THE DASHBOARD TRACKS THIS:
- 10Y-2Y spread via FRED API
- Negative spread = INVERTED = recession warning
- Used by the Macro Agent to adjust overall risk assessment`
    },

    opex_effect: {
      question: 'What is OPEX and how does it affect the market?',
      answer: `OPEX (Options Expiration) is when options contracts expire, forcing position adjustments.

TYPES:
- Monthly OPEX: 3rd Friday of each month
- Quarterly OPEX ("Triple Witching"): 3rd Friday of March, June, September, December — stock options, index options, and futures all expire
- 0DTE (Zero Days to Expiry): Daily expiring options (growing in impact)

HOW IT AFFECTS MARKETS:
1. Gamma exposure: Dealers who sold options must hedge. As OPEX approaches, hedging flows increase, potentially pinning price to key strikes.
2. Max pain: The price at which the most options expire worthless. Market often gravitates toward max pain into OPEX.
3. Unpin: Once OPEX passes, the "gravity" of options positioning releases, and the market can move freely.
4. Volatility: Typically lower before OPEX (gamma hedging dampens moves) and higher after (hedging flows removed).

The dashboard tracks monthly OPEX as part of institutional context in the ES Command Center.`
    }
  }
};


// ============================================================================
// SECTION 6: FORMATTING FUNCTIONS FOR AI PROMPTS
// ============================================================================

/**
 * Get comprehensive knowledge for a specific report
 */
export function getReportKnowledge(reportName) {
  const reportKey = reportName.toUpperCase().replace(/[\s-]/g, '_');

  // Direct match
  if (REPORT_KNOWLEDGE[reportKey]) {
    return formatReportForPrompt(REPORT_KNOWLEDGE[reportKey]);
  }

  // Fuzzy match
  const searchTerms = reportName.toLowerCase();
  for (const [key, report] of Object.entries(REPORT_KNOWLEDGE)) {
    if (report.fullName.toLowerCase().includes(searchTerms) ||
        key.toLowerCase().includes(searchTerms.replace(/[\s-]/g, '_'))) {
      return formatReportForPrompt(report);
    }
  }

  return null;
}

function formatReportForPrompt(report) {
  let output = `\n=== ${report.fullName} ===\n`;
  output += `Source: ${report.source}\n`;
  output += `Schedule: ${report.schedule}\n`;
  output += `Impact: ${report.impact}\n`;
  output += `Affects: ${report.affectedInstruments.join(', ')}\n\n`;
  output += `WHAT IT MEASURES:\n${report.whatItMeasures}\n\n`;

  if (report.howToRead) {
    output += `HOW TO READ:\n`;
    for (const [key, value] of Object.entries(report.howToRead)) {
      if (typeof value === 'string') {
        output += `- ${key}: ${value}\n`;
      } else if (typeof value === 'object') {
        output += `  ${key}:\n`;
        for (const [subKey, subValue] of Object.entries(value)) {
          output += `    - ${subKey}: ${subValue}\n`;
        }
      }
    }
  }

  if (report.tradingStrategy) {
    output += `\nTRADING STRATEGY: ${report.tradingStrategy}\n`;
  }

  if (report.historicalContext) {
    output += `\nHISTORICAL CONTEXT: ${report.historicalContext}\n`;
  }

  return output;
}

/**
 * Get extended instrument knowledge
 */
export function getExtendedInstrumentKnowledge(symbol) {
  const upper = symbol.toUpperCase();
  const info = EXTENDED_INSTRUMENT_KNOWLEDGE[upper];
  if (!info) return null;

  let output = `\n=== ${upper} — ${info.fullName} ===\n`;
  if (info.tickSize) output += `Tick Size: ${info.tickSize}\n`;
  if (info.contractSize) output += `Contract Size: ${info.contractSize}\n`;
  if (info.composition) output += `Composition: ${info.composition}\n`;
  output += `\nKey Drivers:\n${info.drivers.map(d => `  - ${d}`).join('\n')}\n`;
  output += `\nInterpretation: ${info.interpretation}\n`;

  if (info.correlations) {
    output += `\nCorrelations:\n`;
    if (info.correlations.positive) output += `  Positive: ${Array.isArray(info.correlations.positive) ? info.correlations.positive.join(', ') : info.correlations.positive}\n`;
    if (info.correlations.negative) output += `  Negative: ${Array.isArray(info.correlations.negative) ? info.correlations.negative.join(', ') : info.correlations.negative}\n`;
    if (info.correlations.related) output += `  Related: ${Array.isArray(info.correlations.related) ? info.correlations.related.join(', ') : info.correlations.related}\n`;
  }

  if (info.impact) {
    output += `\nMarket Impact:\n`;
    for (const [key, value] of Object.entries(info.impact)) {
      output += `  - ${key}: ${value}\n`;
    }
  }

  return output;
}

/**
 * Search research knowledge for common questions
 */
export function searchResearchKnowledge(question) {
  const questionLower = question.toLowerCase();
  const matches = [];

  for (const [key, concept] of Object.entries(RESEARCH_KNOWLEDGE.concepts)) {
    // Check if the question relates to this concept
    const keywords = key.split('_');
    const questionWords = concept.question.toLowerCase().split(' ');

    if (keywords.some(kw => questionLower.includes(kw)) ||
        questionWords.some(w => w.length > 3 && questionLower.includes(w))) {
      matches.push(concept);
    }
  }

  return matches.map(m => `Q: ${m.question}\n\n${m.answer}`).join('\n\n---\n\n');
}

/**
 * Get cross-market correlation analysis
 */
export function getCrossMarketAnalysis(scenario) {
  const scenarioLower = scenario?.toLowerCase() || '';
  const matches = [];

  for (const [pattern, analysis] of Object.entries(CROSS_MARKET_KNOWLEDGE.correlationMatrix)) {
    const patternLower = pattern.toLowerCase();
    // Check if any symbols from the scenario appear in the pattern
    if (scenarioLower.split(/\s+/).some(word => patternLower.includes(word))) {
      matches.push({
        pattern,
        ...analysis
      });
    }
  }

  return matches;
}

/**
 * Get session-specific analysis framework
 */
export function getSessionKnowledge(session) {
  const sessionLower = (session || '').toLowerCase();
  if (sessionLower.includes('asia')) return CROSS_MARKET_KNOWLEDGE.sessionAnalysis.asia;
  if (sessionLower.includes('london')) return CROSS_MARKET_KNOWLEDGE.sessionAnalysis.london;
  if (sessionLower.includes('us') || sessionLower.includes('ny')) return CROSS_MARKET_KNOWLEDGE.sessionAnalysis.us;
  return CROSS_MARKET_KNOWLEDGE.sessionAnalysis;
}

/**
 * Build comprehensive knowledge context for AI prompt based on question
 */
export function buildKnowledgeContext(question) {
  const questionLower = question.toLowerCase();
  let context = '';

  // 1. Check for report-specific questions
  const reportKeywords = {
    'cattle on feed': 'CATTLE_ON_FEED', 'cattle': 'CATTLE_ON_FEED',
    'hogs and pigs': 'HOGS_AND_PIGS', 'hogs': 'HOGS_AND_PIGS',
    'wasde': 'USDA_WASDE', 'crop progress': 'CROP_PROGRESS',
    'export sales': 'EXPORT_SALES', 'planting': 'PLANTING_INTENTIONS',
    'eia petroleum': 'EIA_PETROLEUM', 'eia crude': 'EIA_PETROLEUM', 'crude inventory': 'EIA_PETROLEUM',
    'eia natural gas': 'EIA_NATURAL_GAS', 'eia gas': 'EIA_NATURAL_GAS', 'gas storage': 'EIA_NATURAL_GAS',
    'api inventory': 'API_INVENTORY', 'baker hughes': 'BAKER_HUGHES', 'rig count': 'BAKER_HUGHES',
    'opec': 'OPEC_REPORT',
    'nfp': 'NFP', 'non-farm': 'NFP', 'payroll': 'NFP', 'jobs report': 'NFP',
    'cpi': 'CPI', 'consumer price': 'CPI', 'inflation report': 'CPI',
    'pce': 'PCE', 'personal consumption': 'PCE',
    'gdp': 'GDP', 'gross domestic': 'GDP',
    'fomc': 'FOMC', 'fed meeting': 'FOMC', 'rate decision': 'FOMC',
    'ism': 'ISM_MANUFACTURING', 'manufacturing pmi': 'ISM_MANUFACTURING',
    'retail sales': 'RETAIL_SALES',
    'treasury auction': 'TREASURY_AUCTIONS', 'bond auction': 'TREASURY_AUCTIONS',
    'cot': 'COT', 'commitment of traders': 'COT', 'positioning': 'COT',
    'put/call': 'PUT_CALL_RATIO', 'put call': 'PUT_CALL_RATIO'
  };

  for (const [keyword, reportKey] of Object.entries(reportKeywords)) {
    if (questionLower.includes(keyword)) {
      const report = REPORT_KNOWLEDGE[reportKey];
      if (report) {
        context += formatReportForPrompt(report) + '\n';
      }
    }
  }

  // 2. Check for instrument-specific questions
  const instrumentSymbols = Object.keys(EXTENDED_INSTRUMENT_KNOWLEDGE);
  for (const symbol of instrumentSymbols) {
    const info = EXTENDED_INSTRUMENT_KNOWLEDGE[symbol];
    if (questionLower.includes(symbol.toLowerCase()) ||
        (info.fullName && questionLower.includes(info.fullName.toLowerCase().split(' ')[0]))) {
      context += getExtendedInstrumentKnowledge(symbol) + '\n';
    }
  }

  // 3. Check for research/educational questions
  const researchContext = searchResearchKnowledge(question);
  if (researchContext) {
    context += '\nRELATED CONCEPTS:\n' + researchContext + '\n';
  }

  // 4. Check for cross-market questions
  if (questionLower.includes('correlat') || questionLower.includes('relationship') ||
      questionLower.includes('affect') || questionLower.includes('impact') ||
      questionLower.includes('when') || questionLower.includes('together')) {
    const crossMarket = getCrossMarketAnalysis(question);
    if (crossMarket.length > 0) {
      context += '\nCROSS-MARKET PATTERNS:\n';
      crossMarket.forEach(m => {
        context += `Pattern: ${m.pattern}\n`;
        context += `  Interpretation: ${m.interpretation}\n`;
        context += `  Trade Implication: ${m.tradeImplication}\n`;
        context += `  Reason: ${m.reason}\n\n`;
      });
    }
  }

  // 5. Check for dashboard/system questions
  if (questionLower.includes('dashboard') || questionLower.includes('how does') ||
      questionLower.includes('how is') || questionLower.includes('generated') ||
      questionLower.includes('calculated') || questionLower.includes('output')) {
    context += '\nDASHBOARD SYSTEM:\n' + DASHBOARD_SYSTEM_KNOWLEDGE.overview + '\n';
    if (questionLower.includes('bias')) {
      context += '\n' + DASHBOARD_SYSTEM_KNOWLEDGE.howBiasIsCalculated + '\n';
    }
    if (questionLower.includes('blurb') || questionLower.includes('context')) {
      context += '\n' + DASHBOARD_SYSTEM_KNOWLEDGE.howContextBlurbsWork + '\n';
    }
  }

  // 6. Check for session questions
  if (questionLower.includes('session') || questionLower.includes('asia') ||
      questionLower.includes('london') || questionLower.includes('overnight')) {
    const sessionInfo = getSessionKnowledge(question);
    if (sessionInfo) {
      context += '\nSESSION KNOWLEDGE:\n' + JSON.stringify(sessionInfo, null, 2) + '\n';
    }
  }

  return context;
}
