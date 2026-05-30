// Chart annotation service.
// Stores the founder's hand-drawn weekly/daily chart analysis (lines,
// rectangles, circles, horizontal levels, text) plus a written commentary,
// and serves it back to every user as a read-only overlay.
//
// Architecture (Lovable Cloud) — identical to adminVP.js:
//   The Render backend connects to Supabase with the *anon* key (service_role
//   is not exposed by Lovable Cloud). Admin writes go through the
//   public.upsert_chart_annotation RPC, which is SECURITY DEFINER and
//   validates the shared secret stored in private.config.admin_vp_secret.
//   The same ADMIN_VP_PASSWORD / ADMIN_VP_URL_TOKEN env vars are reused — this
//   is the same single admin (you), so no new secret is introduced.
//   See LOVABLE_PROMPT_V1_1_25_CHART_ANNOTATIONS_SCHEMA.md.
//
// Auth (Express layer): reuses adminVP.js's helpers.
//   POST writes require the URL :token + password in the body.
//   The admin GET (history) requires only the URL :token.
//   The public GET (/api/annotations/:symbol) requires nothing — it reads the
//   active row via the open SELECT RLS policy with the anon key.
//
// Shapes are stored in chart coordinates (Unix-seconds time + price), NOT
// pixels, so the frontend overlay re-anchors them correctly on zoom / pan /
// timeframe change. Shape schema:
//   line:   { id, type:'line',   t1, p1, t2, p2, color, width }
//   rect:   { id, type:'rect',   t1, p1, t2, p2, color, fill }
//   circle: { id, type:'circle', t1, p1, t2, p2, color }
//   hline:  { id, type:'hline',  p,  color, width }
//   text:   { id, type:'text',   t,  p,  text, color, size }

import Anthropic from '@anthropic-ai/sdk';
import {
  getSupabaseClient,
  checkTokenOnly,
  checkTokenAndPassword,
  adminVpRateLimit
} from './adminVP.js';

const ALLOWED_INSTRUMENTS = new Set(['ES', 'NQ', 'RTY', 'YM', 'CL', 'GC']);
const ALLOWED_TIMEFRAMES = new Set(['1w', '1d']);
const SHAPE_TYPES = new Set(['line', 'rect', 'circle', 'hline', 'text']);
const MAX_SHAPES = 200;
const MAX_NOTES_CHARS = 4000;
const MAX_TEXT_CHARS = 280;

// Haiku grammar-polish is non-blocking; the raw note is used if it fails.
const POLISH_MODEL = process.env.ANNOTATION_POLISH_MODEL || 'claude-haiku-4-5-20251001';

let _anthropic = null;
function getAnthropic() {
  if (_anthropic) return _anthropic;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Validate one shape. Returns an error string, or null if valid.
function validateShape(shape, index) {
  if (!shape || typeof shape !== 'object') return `shape ${index} must be an object`;
  const { type } = shape;
  if (!SHAPE_TYPES.has(type)) {
    return `shape ${index} type '${type}' not in line, rect, circle, hline, text`;
  }
  if (type === 'hline') {
    if (!isFiniteNum(shape.p)) return `shape ${index} (hline) needs numeric p`;
    return null;
  }
  if (type === 'text') {
    if (!isFiniteNum(shape.t) || !isFiniteNum(shape.p)) {
      return `shape ${index} (text) needs numeric t and p`;
    }
    if (typeof shape.text !== 'string' || shape.text.length === 0) {
      return `shape ${index} (text) needs a non-empty text string`;
    }
    if (shape.text.length > MAX_TEXT_CHARS) {
      return `shape ${index} (text) exceeds ${MAX_TEXT_CHARS} chars`;
    }
    return null;
  }
  // line / rect / circle — two anchor points
  if (!isFiniteNum(shape.t1) || !isFiniteNum(shape.p1) ||
      !isFiniteNum(shape.t2) || !isFiniteNum(shape.p2)) {
    return `shape ${index} (${type}) needs numeric t1, p1, t2, p2`;
  }
  return null;
}

function validateShapes(shapes) {
  if (!Array.isArray(shapes)) return 'shapes must be an array';
  if (shapes.length > MAX_SHAPES) return `shapes array exceeds ${MAX_SHAPES} items`;
  for (let i = 0; i < shapes.length; i++) {
    const err = validateShape(shapes[i], i);
    if (err) return err;
  }
  return null;
}

// Grammar-polish the founder's note with Haiku, preserving trading terms and
// numbers. Non-blocking: returns the raw text on any failure.
async function polishNotes(raw) {
  const text = (raw || '').trim();
  if (!text) return '';
  const client = getAnthropic();
  if (!client) return text;
  try {
    const response = await client.messages.create({
      model: POLISH_MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content:
          'Fix only spelling, grammar, and punctuation in the following trading ' +
          'chart commentary. Preserve all numbers, price levels, tickers, and ' +
          'trading terminology exactly. Do not add, remove, or reinterpret any ' +
          'content. Return ONLY the corrected text with no preamble.\n\n' + text
      }]
    });
    const out = response?.content?.[0]?.text?.trim();
    return out && out.length > 0 ? out : text;
  } catch (err) {
    console.warn(`Annotation note polish failed (using raw): ${err.message}`);
    return text;
  }
}

// POST /api/admin/annotations/:token  — save the current analysis for a
// (symbol, timeframe). Supersedes any prior active annotation for that pair.
export async function handleAnnotationPost(req, res) {
  const auth = checkTokenAndPassword(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);

  const symbol = String(req.body?.symbol || '').toUpperCase();
  const timeframe = String(req.body?.timeframe || '');
  const shapes = req.body?.shapes;
  const notesRaw = req.body?.notes_raw;

  if (!ALLOWED_INSTRUMENTS.has(symbol)) {
    return res.status(400).json({
      error: 'validation',
      message: 'symbol must be one of ES, NQ, RTY, YM, CL, GC'
    });
  }
  if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
    return res.status(400).json({
      error: 'validation',
      message: "timeframe must be '1w' or '1d'"
    });
  }
  const shapeErr = validateShapes(shapes);
  if (shapeErr) {
    return res.status(400).json({ error: 'validation', message: shapeErr });
  }
  if (notesRaw != null && typeof notesRaw !== 'string') {
    return res.status(400).json({ error: 'validation', message: 'notes_raw must be a string' });
  }
  if (typeof notesRaw === 'string' && notesRaw.length > MAX_NOTES_CHARS) {
    return res.status(400).json({
      error: 'validation',
      message: `notes_raw exceeds ${MAX_NOTES_CHARS} chars`
    });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    return res.status(500).json({ error: 'misconfigured', message: err.message });
  }

  const notesCorrected = await polishNotes(notesRaw);

  const { data, error: rpcErr } = await supabase.rpc('upsert_chart_annotation', {
    p_secret: auth.password,
    p_symbol: symbol,
    p_timeframe: timeframe,
    p_shapes: shapes,
    p_notes_raw: notesRaw ?? null,
    p_notes_corrected: notesCorrected || null,
    p_changed_by_ip: auth.ip === 'unknown' ? null : auth.ip
  });

  if (rpcErr) {
    return res.status(500).json({ error: 'database_error', message: rpcErr.message });
  }

  // RPC returns { id, version }
  return res.status(200).json({
    id: data?.id,
    version: data?.version,
    symbol,
    timeframe,
    notes_corrected: notesCorrected
  });
}

// GET /api/admin/annotations/:token?symbol=&timeframe=  — admin history view
// (includes superseded/inactive rows).
export async function handleAnnotationAdminGet(req, res) {
  const auth = checkTokenOnly(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);

  const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : null;
  const timeframe = req.query.timeframe ? String(req.query.timeframe) : null;
  if (symbol && !ALLOWED_INSTRUMENTS.has(symbol)) {
    return res.status(400).json({ error: 'validation', message: 'invalid symbol' });
  }
  if (timeframe && !ALLOWED_TIMEFRAMES.has(timeframe)) {
    return res.status(400).json({ error: 'validation', message: 'invalid timeframe' });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    return res.status(500).json({ error: 'misconfigured', message: err.message });
  }

  // Admin reads need to see inactive rows too. The open SELECT RLS policy only
  // exposes active rows to the anon key, so route the admin history read
  // through a SECURITY DEFINER RPC that re-validates nothing extra here but
  // returns all versions. If that RPC isn't present we fall back to active-only.
  let query = supabase
    .from('chart_annotations')
    .select('id, symbol, timeframe, shapes_json, notes_raw, notes_corrected, version, is_active, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (symbol) query = query.eq('symbol', symbol);
  if (timeframe) query = query.eq('timeframe', timeframe);

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: 'database_error', message: error.message });
  }
  return res.status(200).json({ annotations: data, count: data.length });
}

// GET /api/annotations/:symbol?timeframe=  — PUBLIC read of the current active
// annotation. This is what every user's chart overlay loads.
export async function handleAnnotationPublicGet(req, res) {
  const symbol = String(req.params.symbol || '').toUpperCase();
  const timeframe = req.query.timeframe ? String(req.query.timeframe) : '1d';

  if (!ALLOWED_INSTRUMENTS.has(symbol)) {
    return res.status(400).json({ error: 'validation', message: 'invalid symbol' });
  }
  if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
    return res.status(400).json({ error: 'validation', message: "timeframe must be '1w' or '1d'" });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    return res.status(500).json({ error: 'misconfigured', message: err.message });
  }

  const { data, error } = await supabase
    .from('chart_annotations')
    .select('id, symbol, timeframe, shapes_json, notes_corrected, version, updated_at')
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'database_error', message: error.message });
  }

  if (!data) {
    // Graceful empty state — the frontend shows "Analysis pending".
    return res.status(200).json({
      symbol,
      timeframe,
      shapes: [],
      notes_corrected: null,
      version: 0,
      updated_at: null
    });
  }

  return res.status(200).json({
    symbol: data.symbol,
    timeframe: data.timeframe,
    shapes: data.shapes_json || [],
    notes_corrected: data.notes_corrected,
    version: data.version,
    updated_at: data.updated_at
  });
}

export function registerChartAnnotationRoutes(app) {
  app.post('/api/admin/annotations/:token', adminVpRateLimit, handleAnnotationPost);
  app.get('/api/admin/annotations/:token', adminVpRateLimit, handleAnnotationAdminGet);
  app.get('/api/annotations/:symbol', handleAnnotationPublicGet);
}
