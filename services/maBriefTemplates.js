// MA Brief Templates — rule-based prose generator for the per-timeframe
// 9/21/55 EMA reads on the instrument detail page.
//
// This is 100% mechanical: no LLM. Given a current price and the three EMAs
// (and optionally a previous EMA9 value for slope), the function returns a
// short narrative describing the trend state on that timeframe.
//
// The brief is per timeframe (Daily, Hourly, 15-min). Each call produces one
// narrative line. The instrument detail page concatenates the three lines.
//
// Per AI_LABEL_INVENTORY.md, this output is labeled 📊 Rule-based — never ✨.
//
// Spec reference: V1_1_BUILD_PLAN.md §B2.2 and the master roadmap §2.

/**
 * Classify price position relative to the three EMAs.
 * Returns one of: 'above_all', 'above_9_21', 'between_9_21', 'between_21_55',
 *                 'below_all', 'mixed'
 */
function classifyPricePosition(price, ema9, ema21, ema55) {
  const above9 = price > ema9;
  const above21 = price > ema21;
  const above55 = price > ema55;
  if (above9 && above21 && above55) return 'above_all';
  if (!above9 && !above21 && !above55) return 'below_all';
  if (above9 && above21 && !above55) return 'above_9_21';
  if (above9 && !above21 && !above55) return 'between_9_21';
  if (!above9 && !above21 && above55) return 'between_21_55';
  if (!above9 && above21 && above55) return 'between_21_55';
  return 'mixed';
}

/**
 * Classify the EMA stack alignment.
 * Returns 'bull_stack', 'bear_stack', or 'mixed'.
 */
function classifyEmaStack(ema9, ema21, ema55) {
  if (ema9 > ema21 && ema21 > ema55) return 'bull_stack';
  if (ema9 < ema21 && ema21 < ema55) return 'bear_stack';
  return 'mixed';
}

/**
 * Determine the slope of EMA9 if we have a previous value to compare.
 * Returns 'rising', 'falling', or 'flat'.
 */
function classifySlope(ema9Current, ema9Previous) {
  if (ema9Previous == null) return 'unknown';
  const change = ema9Current - ema9Previous;
  const pctChange = Math.abs(change) / ema9Previous;
  if (pctChange < 0.0005) return 'flat'; // <0.05% move = flat
  return change > 0 ? 'rising' : 'falling';
}

/**
 * Compose a brief sentence describing the current state on this timeframe.
 *
 * Inputs:
 *   timeframeLabel  — 'Daily' | 'Hourly' | '15-min'
 *   currentPrice    — number
 *   ema9, ema21, ema55  — numbers
 *   ema9Previous    — number | null (optional, for slope detection)
 *
 * Output:
 *   { narrative: string, position, stack, slope, priceVsEmas: {...} }
 */
export function generateTimeframeBrief({
  timeframeLabel,
  currentPrice,
  ema9,
  ema21,
  ema55,
  ema9Previous = null
}) {
  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(ema9) ||
    !Number.isFinite(ema21) ||
    !Number.isFinite(ema55)
  ) {
    return {
      narrative: `${timeframeLabel}: data incomplete — insufficient history for 9/21/55 EMAs.`,
      position: 'unknown',
      stack: 'unknown',
      slope: 'unknown',
      priceVsEmas: { ema9: null, ema21: null, ema55: null }
    };
  }

  const position = classifyPricePosition(currentPrice, ema9, ema21, ema55);
  const stack = classifyEmaStack(ema9, ema21, ema55);
  const slope = classifySlope(ema9, ema9Previous);

  let narrative;

  // The 12 main cases. position × stack covers most of the meaningful states.
  if (position === 'above_all' && stack === 'bull_stack') {
    narrative = `Price above all 9/21/55 EMAs in a bull stack — aligned uptrend`;
  } else if (position === 'above_all' && stack === 'mixed') {
    narrative = `Price above all three EMAs but stack is mixed — trend exists, alignment doesn't confirm`;
  } else if (position === 'above_all' && stack === 'bear_stack') {
    narrative = `Price above all three EMAs but EMAs remain bear-stacked — likely a counter-trend bounce`;
  } else if (position === 'above_9_21' && stack === 'bull_stack') {
    narrative = `Price above 9 and 21 EMAs, below 55 EMA in a bull stack — uptrend in progress, not yet through long-term resistance`;
  } else if (position === 'above_9_21') {
    narrative = `Price above 9 and 21 EMAs, below 55 — mixed read; short-term up, long-term overhead resistance`;
  } else if (position === 'between_9_21' && stack === 'bull_stack') {
    narrative = `Price between 9 and 21 EMAs in a bull stack — pullback into support within an uptrend`;
  } else if (position === 'between_9_21' && stack === 'bear_stack') {
    narrative = `Price between 9 and 21 EMAs in a bear stack — bounce into resistance within a downtrend`;
  } else if (position === 'between_21_55') {
    narrative = `Price between 21 and 55 EMAs — middle of the range, no clear direction`;
  } else if (position === 'below_all' && stack === 'bear_stack') {
    narrative = `Price below all 9/21/55 EMAs in a bear stack — aligned downtrend`;
  } else if (position === 'below_all' && stack === 'mixed') {
    narrative = `Price below all three EMAs but stack is mixed — trend exists, alignment doesn't confirm`;
  } else if (position === 'below_all' && stack === 'bull_stack') {
    narrative = `Price below all three EMAs but EMAs remain bull-stacked — likely a counter-trend pullback`;
  } else {
    narrative = `Mixed read on ${timeframeLabel}: price and EMAs not in clean alignment`;
  }

  if (slope === 'rising') {
    narrative += `, EMA9 rising`;
  } else if (slope === 'falling') {
    narrative += `, EMA9 falling`;
  } else if (slope === 'flat') {
    narrative += `, EMA9 flat`;
  }

  narrative += '.';

  return {
    narrative,
    position,
    stack,
    slope,
    priceVsEmas: {
      ema9: currentPrice > ema9 ? 'Above' : 'Below',
      ema21: currentPrice > ema21 ? 'Above' : 'Below',
      ema55: currentPrice > ema55 ? 'Above' : 'Below'
    }
  };
}

/**
 * Compose an overall alignment summary across three timeframes.
 * Returns a single string describing whether they agree or disagree.
 */
export function generateAlignmentSummary(daily, hourly, fifteen) {
  const stacks = [daily?.stack, hourly?.stack, fifteen?.stack];
  const positions = [daily?.position, hourly?.position, fifteen?.position];

  const allBullStack = stacks.every(s => s === 'bull_stack');
  const allBearStack = stacks.every(s => s === 'bear_stack');
  const allAbove = positions.every(p => p === 'above_all');
  const allBelow = positions.every(p => p === 'below_all');

  if (allBullStack && allAbove) {
    return `All three timeframes aligned bullish — uptrend across all horizons.`;
  }
  if (allBearStack && allBelow) {
    return `All three timeframes aligned bearish — downtrend across all horizons.`;
  }
  if (allBullStack) {
    return `EMAs bull-stacked on all timeframes, but price hasn't broken cleanly through — uptrend setup not yet triggered on every horizon.`;
  }
  if (allBearStack) {
    return `EMAs bear-stacked on all timeframes, but price hasn't broken cleanly down — downtrend setup not yet triggered on every horizon.`;
  }
  return `Timeframes disagree — mixed trend signals across Daily, Hourly, and 15-min.`;
}
