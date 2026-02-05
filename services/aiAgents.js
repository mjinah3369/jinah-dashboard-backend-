/**
 * AI Agents - Hierarchical Claude AI analysis system
 * Phase 5 of Session Enhancement
 *
 * Sub-agents:
 * - News Agent: Analyzes headlines for session impact
 * - Levels Agent: Analyzes price levels and structure
 * - Macro Agent: Analyzes correlations and macro conditions
 * - Master Orchestrator: Synthesizes all agent outputs
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Cache for agent results (5 minute TTL)
const agentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * NEWS AGENT - Analyzes headlines and news flow
 */
async function newsAgent(newsData, session) {
  const cacheKey = `news_${session}_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  if (!newsData || newsData.length === 0) {
    return { topStories: [], overallSentiment: 'neutral', urgentAlerts: [], keyThemes: [] };
  }

  const prompt = `You are a futures trading news analyst. Analyze these headlines for the ${session} session.

HEADLINES:
${newsData.slice(0, 15).map(n => `- ${n.headline || n.title} (${n.source || 'Unknown'})`).join('\n')}

Respond in JSON format ONLY (no markdown, no explanation):
{
  "topStories": [{"headline": "", "impact": "HIGH/MEDIUM/LOW", "affectedSymbols": [], "bias": "bullish/bearish/neutral"}],
  "overallSentiment": "risk-on/risk-off/mixed",
  "urgentAlerts": [],
  "keyThemes": []
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('News agent error:', error.message);
    return { error: true, message: error.message, topStories: [], overallSentiment: 'unknown' };
  }
}

/**
 * LEVELS AGENT - Analyzes price levels and structure
 */
async function levelsAgent(levelData, sweepData, session) {
  const cacheKey = `levels_${session}_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  const prompt = `You are an ICT/SMC price action analyst. Analyze these levels for the ${session} session.

CURRENT LEVELS:
${JSON.stringify(levelData, null, 2)}

RECENT SWEEPS:
${JSON.stringify(sweepData, null, 2)}

Respond in JSON format ONLY (no markdown, no explanation):
{
  "keyLevelsToWatch": [{"level": "", "price": 0, "reason": "", "probability": 0}],
  "sweepAnalysis": {"interpretation": "", "bias": "bullish/bearish/neutral"},
  "structureBias": "bullish/bearish/neutral",
  "tradingZones": {"buyZone": {"from": 0, "to": 0}, "sellZone": {"from": 0, "to": 0}}
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Levels agent error:', error.message);
    return { error: true, message: error.message };
  }
}

/**
 * MACRO AGENT - Analyzes correlations and macro conditions
 */
async function macroAgent(macroData) {
  const cacheKey = `macro_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  const prompt = `You are a macro analyst for futures trading. Analyze these conditions:

VIX: ${macroData.vix || 'N/A'} (${macroData.vixChange > 0 ? '+' : ''}${macroData.vixChange || 0}%)
DXY: ${macroData.dxy || 'N/A'} (${macroData.dxyChange > 0 ? '+' : ''}${macroData.dxyChange || 0}%)
10Y Yield: ${macroData.yield10y || 'N/A'}
HYG: ${macroData.hyg?.price || 'N/A'} (${macroData.hyg?.changePercent || 0}%) - ${macroData.hyg?.interpretation || 'N/A'}
TLT: ${macroData.tlt?.price || 'N/A'} (${macroData.tlt?.changePercent || 0}%)

SECTORS:
${Object.entries(macroData.sectors || {}).map(([k, v]) => `${k}: ${v.changePercent || 0}%`).join('\n')}

Respond in JSON format ONLY (no markdown, no explanation):
{
  "riskEnvironment": "risk-on/risk-off/neutral",
  "vixInterpretation": "",
  "dollarImpact": {"direction": "up/down/neutral", "affectedSymbols": []},
  "sectorRotation": {"leading": [], "lagging": []},
  "correlationAlerts": [],
  "overallBias": "bullish/bearish/neutral"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Macro agent error:', error.message);
    return { error: true, message: error.message };
  }
}

/**
 * MASTER ORCHESTRATOR - Synthesizes all agent outputs
 */
async function masterOrchestrator(newsResult, levelsResult, macroResult, sessionInfo) {
  const prompt = `You are the chief trading strategist. Synthesize these analyses for the ${sessionInfo.current?.name || 'current'} session:

NEWS ANALYSIS:
${JSON.stringify(newsResult, null, 2)}

LEVELS ANALYSIS:
${JSON.stringify(levelsResult, null, 2)}

MACRO ANALYSIS:
${JSON.stringify(macroResult, null, 2)}

SESSION CONTEXT:
- Current: ${sessionInfo.current?.name || 'Unknown'}
- IB Status: ${sessionInfo.current?.isIB ? `Active (${sessionInfo.current?.ibMinutesRemaining}m remaining)` : 'Complete'}
- Next Session: ${sessionInfo.next?.name || 'Unknown'} in ${sessionInfo.next?.countdown || 'N/A'}
- Focus Symbols: ${sessionInfo.current?.focus?.join(', ') || 'N/A'}

Provide a unified trading brief. Respond in JSON format ONLY (no markdown, no explanation):
{
  "sessionBrief": "2-3 sentence summary of what to expect this session",
  "focusSymbols": [{"symbol": "", "bias": "bullish/bearish/neutral", "confidence": 0, "reason": ""}],
  "keyLevels": [{"symbol": "", "level": "", "price": 0, "action": "watch/fade/breakout"}],
  "risks": [],
  "tradingPlan": "What to do in this session"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' };
  } catch (error) {
    console.error('Orchestrator error:', error.message);
    return { error: true, message: error.message };
  }
}

/**
 * Run full analysis pipeline
 */
async function runFullAnalysis(data) {
  const { news, levels, sweeps, macro, session } = data;

  console.log('Running AI analysis pipeline...');

  // Run sub-agents in parallel
  const [newsResult, levelsResult, macroResult] = await Promise.all([
    newsAgent(news || [], session.current?.name || 'Unknown'),
    levelsAgent(levels || {}, sweeps || [], session.current?.name || 'Unknown'),
    macroAgent(macro || {})
  ]);

  console.log('Sub-agents complete, running orchestrator...');

  // Orchestrator synthesizes
  const finalAnalysis = await masterOrchestrator(
    newsResult,
    levelsResult,
    macroResult,
    session
  );

  return {
    timestamp: new Date().toISOString(),
    session: session.current?.name || 'Unknown',
    subAgents: {
      news: newsResult,
      levels: levelsResult,
      macro: macroResult
    },
    analysis: finalAnalysis
  };
}

/**
 * Quick session brief (lighter weight, faster)
 */
async function getQuickSessionBrief(sessionInfo, newsData) {
  const cacheKey = `brief_${sessionInfo.current?.key}_${Math.floor(Date.now() / CACHE_TTL)}`;
  if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

  const topNews = (newsData || []).slice(0, 5).map(n => n.headline || n.title).join('; ');

  const prompt = `You are a futures trading analyst. Give a quick brief for the ${sessionInfo.current?.name || 'current'} session.

Session: ${sessionInfo.current?.name || 'Unknown'} (${sessionInfo.current?.description || ''})
IB Status: ${sessionInfo.current?.isIB ? `Active - ${sessionInfo.current?.ibMinutesRemaining}m remaining` : 'Complete'}
Focus: ${sessionInfo.current?.focus?.join(', ') || 'ES, NQ'}
Top News: ${topNews || 'No recent news'}

Respond in JSON format ONLY:
{
  "brief": "1-2 sentence trading brief",
  "focus": ["symbol1", "symbol2"],
  "caution": "any warnings or cautions",
  "opportunity": "main opportunity this session"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { brief: 'Analysis unavailable' };

    agentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Quick brief error:', error.message);
    return { brief: 'Analysis unavailable', error: error.message };
  }
}

/**
 * Clear agent cache
 */
function clearCache() {
  agentCache.clear();
  console.log('AI agent cache cleared');
}

/**
 * Get cache status
 */
function getCacheStatus() {
  return {
    size: agentCache.size,
    ttl: CACHE_TTL,
    keys: Array.from(agentCache.keys())
  };
}

export {
  newsAgent,
  levelsAgent,
  macroAgent,
  masterOrchestrator,
  runFullAnalysis,
  getQuickSessionBrief,
  clearCache,
  getCacheStatus
};
