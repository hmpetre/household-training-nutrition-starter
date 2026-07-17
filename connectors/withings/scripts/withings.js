#!/usr/bin/env node
/*
 * Withings API client — mirrors the WHOOP skill's pattern.
 *
 * Credentials are read from environment variables (never bundled):
 *   WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET
 *   WITHINGS_ACCESS_TOKEN,  WITHINGS_REFRESH_TOKEN        (primary user, "me")
 *   WITHINGS_ACCESS_TOKEN_WIFE, WITHINGS_REFRESH_TOKEN_WIFE (second user, optional)
 * If a .env file exists in the current working directory it is loaded first.
 *
 * Usage:
 *   node withings.js auth [me|wife]                 one-time OAuth authorization
 *   node withings.js snapshot [me|wife|both]        latest body composition (flat)
 *   node withings.js body     [user] [--start ISO|YYYY-MM-DD] [--end ...] [--limit N]
 *   node withings.js measures [user] [--types 1,6,8,...] [--start ...] [--end ...]
 *   node withings.js heart    [user] [--start ...] [--end ...]
 *   node withings.js raw <service> [k=v ...] [user]  e.g. raw measure action=getmeas meastypes=1,6
 *
 * `user` defaults to "me". Use "both" (where supported) for me + wife.
 * Output is always JSON on stdout. Errors go to stderr with non-zero exit.
 *
 * Notes on Withings vs WHOOP:
 *  - OAuth + token both use the SAME endpoint with action=requesttoken.
 *  - Every API response is wrapped as { status, body }. status 0 = success.
 *  - access_token lives ~3h, refresh_token ~1y. We auto-refresh on expiry.
 *  - Measurements come back as coded types + (value, unit) where
 *    real = value * 10^unit. We decode the documented types to named fields.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const OAUTH_HOST = 'account.withings.com';          // browser authorize/consent screen ONLY
const API_HOST = 'wbsapi.withings.net';             // data services AND token exchange/refresh
const TOKEN_PATH = '/v2/oauth2';                     // action=requesttoken — posted to API_HOST (account host 302-redirects)
const AUTHORIZE_PATH = '/oauth2_user/authorize2';    // browser consent screen
const REDIRECT_URI = 'http://localhost:3000/callback'; // MUST match the URL registered in the Withings dev console
const REDIRECT_PORT = 3000;
const SCOPES = 'user.info,user.metrics,user.activity';

// Resolve the .env (credentials + tokens) from a writable, stable location.
// When invoked via the installed plugin, cwd is NOT the plugin folder and the plugin
// itself is read-only — so we look, in order:
//   1. $WITHINGS_ENV_PATH                (explicit override)
//   2. the user's Meal_Planning data folder (writable, survives reinstalls)
//   3. ./.env next to wherever we're run   (dev / standalone fallback)
function resolveEnvPath() {
  const candidates = [
    process.env.WITHINGS_ENV_PATH,
    path.join(process.env.HOME || '', '.config/household-planner/withings/.env'),
    path.join(process.cwd(), '.env'),
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  // Default to the Meal_Planning location (so the auth flow WRITES tokens there even if it doesn't exist yet).
  return candidates[1] || candidates[candidates.length - 1];
}
const ENV_PATH = resolveEnvPath();

// Withings measurement type codes -> friendly name + unit label.
// real value = value * 10^unit (unit is per-measure, supplied in the response).
const MEAS_TYPES = {
  1:  { key: 'weight_kg',          label: 'Weight (kg)' },
  4:  { key: 'height_m',           label: 'Height (m)' },
  5:  { key: 'lean_mass_kg',       label: 'Fat Free / Lean Mass (kg)' },
  6:  { key: 'fat_ratio_pct',      label: 'Fat Ratio (%)' },
  8:  { key: 'fat_mass_kg',        label: 'Fat Mass Weight (kg)' },
  9:  { key: 'diastolic_bp',       label: 'Diastolic BP (mmHg)' },
  10: { key: 'systolic_bp',        label: 'Systolic BP (mmHg)' },
  11: { key: 'heart_rate_bpm',     label: 'Heart Rate (bpm)' },
  12: { key: 'temperature_c',      label: 'Temperature (C)' },
  54: { key: 'spo2_pct',           label: 'SpO2 (%)' },
  71: { key: 'body_temperature_c', label: 'Body Temperature (C)' },
  73: { key: 'skin_temperature_c', label: 'Skin Temperature (C)' },
  76: { key: 'muscle_mass_kg',     label: 'Muscle Mass (kg)' },
  77: { key: 'body_water_pct',     label: 'Hydration / Body Water (%)' },
  88: { key: 'bone_mass_kg',       label: 'Bone Mass (kg)' },
  91: { key: 'pulse_wave_velocity',label: 'Pulse Wave Velocity (m/s)' },
  155:{ key: 'vascular_age',        label: 'Vascular Age' },
  170:{ key: 'visceral_fat',        label: 'Visceral Fat' },
  226:{ key: 'basal_metabolic_rate',label: 'Basal Metabolic Rate (kcal)' },
};
// Default set we request when none specified — "everything useful for the meal planner".
const DEFAULT_MEASTYPES = Object.keys(MEAS_TYPES).join(',');

// ---- minimal .env loader (no dependency) ----
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

function updateEnv(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  content = regex.test(content)
    ? content.replace(regex, `${key}=${value}`)
    : content.trimEnd() + `\n${key}=${value}\n`;
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

// ---- HTTP helpers ----
// Withings data + token calls are POST form-encoded to wbsapi/account.
function withingsPost(host, apiPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams(body).toString();
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = https.request(
      { hostname: host, path: apiPath, method: 'POST', headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
          let json;
          try { json = JSON.parse(data); }
          catch (e) { return reject(new Error(`Parse error: ${data}`)); }
          resolve(json);
        });
      });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// A data-service call. Returns the unwrapped `body`, throws on Withings error status.
async function apiCall(service, params, token) {
  const json = await withingsPost(API_HOST, `/${service}`, params, token);
  if (json.status !== 0) {
    const err = new Error(`Withings status ${json.status}: ${json.error || JSON.stringify(json)}`);
    err.withingsStatus = json.status;
    throw err;
  }
  return json.body;
}

// ---- token management ----
function keysFor(user) {
  const suffix = user === 'wife' ? '_WIFE' : '';
  return { access: `WITHINGS_ACCESS_TOKEN${suffix}`, refresh: `WITHINGS_REFRESH_TOKEN${suffix}` };
}

async function refreshAccessToken(refreshToken, refreshKey) {
  const json = await withingsPost(API_HOST, TOKEN_PATH, {
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: process.env.WITHINGS_CLIENT_ID,
    client_secret: process.env.WITHINGS_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  if (json.status !== 0 || !json.body || !json.body.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  }
  const accessKey = refreshKey.replace('_REFRESH_TOKEN', '_ACCESS_TOKEN');
  process.env[accessKey] = json.body.access_token;
  updateEnv(accessKey, json.body.access_token);
  if (json.body.refresh_token) {
    process.env[refreshKey] = json.body.refresh_token;
    updateEnv(refreshKey, json.body.refresh_token);
  }
  return json.body.access_token;
}

async function resolveToken(user) {
  const { access, refresh } = keysFor(user);
  const accessToken = process.env[access];
  const refreshToken = process.env[refresh];
  if (accessToken && accessToken.trim()) return { user, token: accessToken, refresh };
  if (refreshToken && refreshToken.trim()) {
    const t = await refreshAccessToken(refreshToken, refresh);
    return { user, token: t, refresh };
  }
  throw new Error(`No tokens for "${user}". Run: node withings.js auth ${user}`);
}

// Data call that auto-refreshes once when the token is expired/invalid.
// Withings signals an expired token with status 401 (and sometimes 0 + empty); we retry on auth-ish errors.
async function authedCall(service, params, user) {
  let { token, refresh } = await resolveToken(user);
  try {
    return await apiCall(service, params, token);
  } catch (e) {
    const authIssue = e.withingsStatus === 401 || /HTTP 401/.test(e.message) ||
                      e.withingsStatus === 601 || /invalid|expired|token/i.test(e.message);
    if (authIssue && process.env[refresh]) {
      token = await refreshAccessToken(process.env[refresh], refresh);
      return apiCall(service, params, token);
    }
    throw e;
  }
}

// ---- OAuth authorization flow ----
function runAuthFlow(user) {
  return new Promise((resolve, reject) => {
    const clientId = process.env.WITHINGS_CLIENT_ID;
    if (!clientId) return reject(new Error('WITHINGS_CLIENT_ID not set'));
    const state = `withingscli_${user}`;
    const authUrl =
      `https://${OAUTH_HOST}${AUTHORIZE_PATH}?response_type=code` +
      `&client_id=${clientId}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${state}`;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== '/callback') { res.end('Not found'); return; }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error || !code) {
        res.end(`<h2>Auth failed: ${error || 'no code'}</h2>`);
        server.close(); reject(new Error(`Auth failed: ${error}`)); return;
      }
      res.end('<h2>Authorized! You can close this tab.</h2>');
      server.close();
      try {
        const json = await withingsPost(API_HOST, TOKEN_PATH, {
          action: 'requesttoken',
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: process.env.WITHINGS_CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
        });
        if (json.status !== 0 || !json.body || !json.body.access_token) {
          throw new Error(`Exchange failed: ${JSON.stringify(json)}`);
        }
        const { access, refresh } = keysFor(user);
        updateEnv(access, json.body.access_token);
        if (json.body.refresh_token) updateEnv(refresh, json.body.refresh_token);
        resolve();
      } catch (e) { reject(e); }
    });
    server.on('error', reject);
    server.listen(REDIRECT_PORT, () => {
      console.error(`Opening browser to authorize Withings for "${user}"...`);
      console.error(`If the browser doesn't open, visit:\n${authUrl}`);
      exec(`open "${authUrl}" || xdg-open "${authUrl}"`);
    });
  });
}

// ---- date helpers ----
// Withings getmeas uses unix-second startdate/enddate. Accept ISO or YYYY-MM-DD.
function toUnix(v) {
  if (v == null) return null;
  if (/^\d+$/.test(String(v))) return Number(v);          // already unix seconds
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) throw new Error(`Bad date: ${v}`);
  return Math.floor(ms / 1000);
}

// ---- measurement decoding ----
// getmeas returns measuregrps: [{ date, measures: [{ type, value, unit }] }]
// Decode each group into named real-valued fields.
function decodeGroups(body) {
  const grps = (body && body.measuregrps) || [];
  return grps
    .map((g) => {
      const out = {
        date: g.date,                                  // unix seconds
        date_iso: g.date ? new Date(g.date * 1000).toISOString() : null,
        created_iso: g.created ? new Date(g.created * 1000).toISOString() : null,
      };
      for (const m of g.measures || []) {
        const def = MEAS_TYPES[m.type];
        const real = m.value * Math.pow(10, m.unit);
        const name = def ? def.key : `type_${m.type}`;
        out[name] = +real.toFixed(4);
      }
      return out;
    })
    .sort((a, b) => b.date - a.date);                  // newest first
}

// Flatten to the single most-recent value seen for each field across the window.
function latestComposite(groups) {
  const composite = { as_of_iso: groups[0] ? groups[0].date_iso : null };
  const seen = new Set();
  for (const g of groups) {                            // groups already newest-first
    for (const [k, v] of Object.entries(g)) {
      if (k === 'date' || k === 'date_iso' || k === 'created_iso') continue;
      if (!seen.has(k)) { composite[k] = v; seen.add(k); }
    }
  }
  return composite;
}

// ---- high-level fetchers ----
async function getMeasures(user, opts) {
  const params = { action: 'getmeas', category: 1 };
  params.meastypes = opts.types || DEFAULT_MEASTYPES;
  if (opts.start) params.startdate = toUnix(opts.start);
  if (opts.end) params.enddate = toUnix(opts.end);
  if (!opts.start && !opts.end) params.lastupdate = 0;  // all history if no window
  if (opts.limit) params.limit = opts.limit;
  const body = await authedCall('measure', params, user);
  const groups = decodeGroups(body);
  const sliced = opts.limit ? groups.slice(0, Number(opts.limit)) : groups;
  return { count: sliced.length, measures: sliced };
}

// snapshot = the single latest value for every body-comp field (what the meal planner wants)
async function snapshot(user) {
  // Pull the last ~60 days so partial scans still fill every field from the most recent reading.
  const start = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;
  const body = await authedCall('measure', {
    action: 'getmeas', category: 1, meastypes: DEFAULT_MEASTYPES, startdate: start,
  }, user);
  const groups = decodeGroups(body);
  if (!groups.length) return { user, note: 'no measurements in the last 60 days' };
  return { user, ...latestComposite(groups) };
}

async function getHeart(user, opts) {
  const params = { action: 'list' };
  if (opts.start) params.startdate = toUnix(opts.start);
  if (opts.end) params.enddate = toUnix(opts.end);
  return authedCall('v2/heart', params, user);
}

// ---- arg parsing ----
function parseOpts(args) {
  const opts = {};
  let user = 'me';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--limit') opts.limit = args[++i];
    else if (a === '--start') opts.start = args[++i];
    else if (a === '--end') opts.end = args[++i];
    else if (a === '--types') opts.types = args[++i];
    else if (['me', 'wife', 'both'].includes(a)) user = a;
  }
  return { user, opts };
}

function usersList(user) {
  return user === 'both' ? ['me', 'wife'] : [user];
}

async function collectForUsers(user, fn) {
  const out = {};
  for (const u of usersList(user)) {
    try { out[u] = await fn(u); }
    catch (e) { out[u] = { error: e.message }; }
  }
  return out;
}

// ---- main ----
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'auth') {
    const user = rest[0] === 'wife' ? 'wife' : 'me';
    await runAuthFlow(user);
    console.error(`Tokens saved for "${user}".`);
    return;
  }

  if (cmd === 'raw') {
    const service = rest[0];
    if (!service) throw new Error('raw requires a service, e.g. raw measure action=getmeas meastypes=1,6');
    const params = {};
    let rawUser = 'me';
    for (const tok of rest.slice(1)) {
      if (['me', 'wife'].includes(tok)) { rawUser = tok; continue; }
      const eq = tok.indexOf('=');
      if (eq > 0) params[tok.slice(0, eq)] = tok.slice(eq + 1);
    }
    const result = await authedCall(service, params, rawUser);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const { user, opts } = parseOpts(rest);

  switch (cmd) {
    case 'snapshot': {
      const result = await collectForUsers(user, snapshot);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'body':
    case 'measures': {
      const result = await collectForUsers(user, (u) => getMeasures(u, opts));
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'heart': {
      const result = await collectForUsers(user, (u) => getHeart(u, opts));
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      console.error('Usage: node withings.js <auth|snapshot|body|measures|heart|raw> [me|wife|both] [--types 1,6,8 --start ISO --end ISO --limit N]');
      process.exit(1);
  }
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
