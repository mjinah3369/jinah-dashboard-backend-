// Admin Volume Profile entry endpoint.
// v1.1 Step 1 of the dashboard build.
//
// Architecture (Lovable Cloud):
//   The Render backend connects to Supabase with the *anon* key (service_role
//   is not exposed by Lovable Cloud). Writes to admin-only tables go through
//   the public.upsert_daily_vp_level RPC, which is SECURITY DEFINER and
//   validates a shared secret stored in private.config. Render's
//   ADMIN_VP_PASSWORD env var must match private.config.admin_vp_secret in
//   Supabase. See LOVABLE_PROMPT_V1_1_01B_ADMIN_RPC.md.
//
// Auth (Express layer):
//   POST writes require the URL :token + a password in the request body.
//   GET reads require only the URL :token.
//   Express validates the password fast-fail (no DB hit on bad input). The
//   same password is then forwarded to the RPC as the shared secret, which
//   re-validates inside the database. Defense in depth.
//
// Rate limit: 10 requests per minute per IP per route.
// Abuse guard: 5 failed auth attempts within 10 minutes from the same IP ->
// 1-hour ban on that IP (in-memory; resets on restart, acceptable since this
// is abuse mitigation not authentication).
//
// Required env vars:
//   ADMIN_VP_URL_TOKEN, ADMIN_VP_PASSWORD,
//   SUPABASE_URL, SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';

const ALLOWED_INSTRUMENTS = new Set(['ES', 'NQ', 'RTY', 'YM', 'CL', 'GC']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FAILED_AUTH_THRESHOLD = 5;
const FAILED_AUTH_WINDOW_MS = 10 * 60 * 1000;
const IP_BAN_DURATION_MS = 60 * 60 * 1000;

const failedAuthAttempts = new Map();
const ipBans = new Map();

let _supabase = null;
export function getSupabaseClient() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isIpBanned(ip) {
  const banUntil = ipBans.get(ip);
  if (!banUntil) return false;
  if (Date.now() < banUntil) return true;
  ipBans.delete(ip);
  return false;
}

function recordFailedAuth(ip) {
  const now = Date.now();
  const attempts = (failedAuthAttempts.get(ip) || []).filter(
    (t) => now - t < FAILED_AUTH_WINDOW_MS
  );
  attempts.push(now);
  failedAuthAttempts.set(ip, attempts);
  if (attempts.length >= FAILED_AUTH_THRESHOLD) {
    ipBans.set(ip, now + IP_BAN_DURATION_MS);
    failedAuthAttempts.delete(ip);
  }
}

export function checkTokenOnly(req) {
  const ip = getClientIp(req);
  if (isIpBanned(ip)) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'ip_banned',
        message: 'Too many failed authentication attempts. Try again in an hour.'
      }
    };
  }
  const expectedToken = process.env.ADMIN_VP_URL_TOKEN;
  if (!expectedToken) {
    return {
      ok: false,
      status: 500,
      body: { error: 'misconfigured', message: 'Admin VP endpoint not configured on server' }
    };
  }
  if (req.params.token !== expectedToken) {
    recordFailedAuth(ip);
    return {
      ok: false,
      status: 401,
      body: { error: 'admin_auth_failed', message: 'Invalid token or password' }
    };
  }
  return { ok: true, ip };
}

export function checkTokenAndPassword(req) {
  const tokenCheck = checkTokenOnly(req);
  if (!tokenCheck.ok) return tokenCheck;
  const expectedPassword = process.env.ADMIN_VP_PASSWORD;
  if (!expectedPassword) {
    return {
      ok: false,
      status: 500,
      body: { error: 'misconfigured', message: 'Admin VP endpoint not configured on server' }
    };
  }
  const supplied = req.body?.password;
  if (supplied !== expectedPassword) {
    recordFailedAuth(tokenCheck.ip);
    return {
      ok: false,
      status: 401,
      body: { error: 'admin_auth_failed', message: 'Invalid token or password' }
    };
  }
  return { ok: true, ip: tokenCheck.ip, password: supplied };
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') return 'must be an object';
  const { instrument_symbol, trading_date, vah, val, poc } = entry;
  if (!ALLOWED_INSTRUMENTS.has(instrument_symbol)) {
    return `instrument_symbol '${instrument_symbol}' not in ES, NQ, RTY, YM, CL, GC`;
  }
  if (typeof trading_date !== 'string' || !DATE_PATTERN.test(trading_date)) {
    return `trading_date '${trading_date}' must be YYYY-MM-DD`;
  }
  if (!Number.isFinite(vah) || !Number.isFinite(val) || !Number.isFinite(poc)) {
    return 'vah, val, poc must be numbers';
  }
  if (vah <= val) {
    return `vah (${vah}) must be greater than val (${val}) for '${instrument_symbol}'`;
  }
  if (poc < val || poc > vah) {
    return `poc (${poc}) must be between val (${val}) and vah (${vah}) for '${instrument_symbol}'`;
  }
  return null;
}

export const adminVpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit', message: 'Too many requests. Limit is 10 per minute.' }
});

export async function handleAdminVpPost(req, res) {
  const auth = checkTokenAndPassword(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);

  const entries = req.body?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res
      .status(400)
      .json({ error: 'validation', message: 'Request body must include a non-empty entries array' });
  }
  for (let i = 0; i < entries.length; i++) {
    const err = validateEntry(entries[i]);
    if (err) {
      return res
        .status(400)
        .json({ error: 'validation', message: `Entry index ${i}: ${err}` });
    }
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    return res.status(500).json({ error: 'misconfigured', message: err.message });
  }

  let inserted = 0;
  let updated = 0;
  const writeErrors = [];

  for (const entry of entries) {
    const { instrument_symbol, trading_date, vah, val, poc, notes } = entry;

    const { data, error: rpcErr } = await supabase.rpc('upsert_daily_vp_level', {
      p_secret: auth.password,
      p_instrument: instrument_symbol,
      p_trading_date: trading_date,
      p_vah: vah,
      p_val: val,
      p_poc: poc,
      p_notes: notes ?? null,
      p_changed_by_ip: auth.ip === 'unknown' ? null : auth.ip
    });

    if (rpcErr) {
      writeErrors.push({
        instrument_symbol,
        trading_date,
        error: rpcErr.message
      });
      continue;
    }

    // data is the jsonb returned from the RPC: { id, change_type }
    if (data && data.change_type === 'update') updated++;
    else if (data && data.change_type === 'insert') inserted++;
  }

  if (writeErrors.length > 0) {
    return res.status(207).json({
      partial: true,
      inserted,
      updated,
      audit_rows_written: inserted + updated,
      errors: writeErrors
    });
  }

  return res.status(200).json({
    inserted,
    updated,
    audit_rows_written: inserted + updated
  });
}

export async function handleAdminVpGet(req, res) {
  const auth = checkTokenOnly(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);

  const { date, instrument } = req.query;
  if (date && !DATE_PATTERN.test(date)) {
    return res
      .status(400)
      .json({ error: 'validation', message: 'date query param must be YYYY-MM-DD' });
  }
  if (instrument && !ALLOWED_INSTRUMENTS.has(instrument)) {
    return res.status(400).json({
      error: 'validation',
      message: 'instrument query param must be one of ES, NQ, RTY, YM, CL, GC'
    });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    return res.status(500).json({ error: 'misconfigured', message: err.message });
  }

  // daily_vp_levels has an open SELECT policy (USING (true)), so anon-key read
  // works directly without going through an RPC.
  let query = supabase
    .from('daily_vp_levels')
    .select('id, instrument_symbol, trading_date, vah_price, val_price, poc_price, entered_by, entered_at, notes')
    .order('trading_date', { ascending: false })
    .limit(100);
  if (date) query = query.eq('trading_date', date);
  if (instrument) query = query.eq('instrument_symbol', instrument);

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: 'database_error', message: error.message });
  }
  return res.status(200).json({ entries: data, count: data.length });
}

export function registerAdminVpRoutes(app) {
  app.post('/api/admin/vp/:token', adminVpRateLimit, handleAdminVpPost);
  app.get('/api/admin/vp/:token', adminVpRateLimit, handleAdminVpGet);
}
