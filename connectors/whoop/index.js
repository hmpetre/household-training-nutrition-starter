#!/usr/bin/env node
/*
 * WHOOP v2 MCP server (stdio transport).
 *
 * Exposes WHOOP data as MCP tools so Claude (Desktop / Cowork) can call them
 * directly. Runs locally on your Mac, where reaching api.prod.whoop.com works.
 *
 * Credentials come from environment variables (set in claude_desktop_config.json):
 *   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
 *   WHOOP_ACCESS_TOKEN,  WHOOP_REFRESH_TOKEN          (user "me")
 *   WHOOP_ACCESS_TOKEN_WIFE, WHOOP_REFRESH_TOKEN_WIFE (user "wife", optional)
 *
 * Tools: whoop_snapshot, whoop_recovery, whoop_cycle, whoop_sleep,
 *        whoop_workout, whoop_profile, whoop_body, whoop_raw
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WHOOP_HOST = 'api.prod.whoop.com';
const API_PREFIX = '/developer';
// Refresh requires only the "offline" scope per WHOOP docs; sending the full
// scope list causes a 400. Access tokens carry whatever was granted at auth.
const REFRESH_SCOPE = 'offline';

// Persistent token store lives next to this script. This is what makes the
// server self-healing: WHOOP rotates the refresh token on every refresh, so we
// must save the new one or the next refresh fails.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, 'tokens.json');

// Load tokens from the persistent file, falling back to env vars (used only to
// seed the very first run). After that, the file is the source of truth.
function loadTokens() {
  let fromFile = {};
  try {
    if (fs.existsSync(TOKEN_FILE)) fromFile = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch { /* ignore corrupt file, fall back to env */ }
  return {
    me: {
      access: fromFile.me?.access || process.env.WHOOP_ACCESS_TOKEN || '',
      refresh: fromFile.me?.refresh || process.env.WHOOP_REFRESH_TOKEN || '',
    },
    wife: {
      access: fromFile.wife?.access || process.env.WHOOP_ACCESS_TOKEN_WIFE || '',
      refresh: fromFile.wife?.refresh || process.env.WHOOP_REFRESH_TOKEN_WIFE || '',
    },
  };
}

const tokens = loadTokens();

// Persist the current token cache to disk (atomic-ish write).
function saveTokens() {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error('Warning: could not persist tokens:', e.message);
  }
}

// Seed the file on first run so subsequent refreshes have somewhere to save.
if (!fs.existsSync(TOKEN_FILE)) saveTokens();

function whoopGet(apiPath, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: WHOOP_HOST, path: API_PREFIX + apiPath, method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data || '{}')); }
            catch (e) { reject(new Error(`Parse error: ${data}`)); }
          } else {
            const err = new Error(`HTTP ${res.statusCode}: ${data}`);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      });
    req.on('error', reject);
    req.end();
  });
}

function whoopTokenPost(body) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams(body).toString();
    const req = https.request(
      { hostname: WHOOP_HOST, path: '/oauth/oauth2/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                   'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Token parse error: ${data}`)); }
        });
      });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function refreshFor(user) {
  const t = tokens[user];
  if (!t || !t.refresh) throw new Error(`No refresh token for "${user}"`);
  const result = await whoopTokenPost({
    grant_type: 'refresh_token',
    refresh_token: t.refresh,
    client_id: process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
    scope: REFRESH_SCOPE,
  });
  if (!result.access_token) throw new Error(`Refresh failed: ${JSON.stringify(result)}`);
  t.access = result.access_token;
  // WHOOP rotates the refresh token — capture and persist the new one, or the
  // next refresh will fail.
  if (result.refresh_token) t.refresh = result.refresh_token;
  saveTokens();
  return t.access;
}

async function authedGet(apiPath, user) {
  const t = tokens[user];
  if (!t || (!t.access && !t.refresh)) throw new Error(`No tokens for "${user}"`);
  if (!t.access && t.refresh) await refreshFor(user);
  try {
    return await whoopGet(apiPath, t.access);
  } catch (e) {
    if (e.statusCode === 401 && t.refresh) {
      await refreshFor(user);
      return whoopGet(apiPath, t.access);
    }
    throw e;
  }
}

function buildQuery({ limit, start, end }) {
  const p = new URLSearchParams();
  if (limit) p.set('limit', String(limit));
  if (start) p.set('start', start);
  if (end) p.set('end', end);
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function snapshot(user) {
  const [profile, body, recovery, cycle, sleep] = await Promise.all([
    authedGet('/v2/user/profile/basic', user).catch(() => null),
    authedGet('/v2/user/measurement/body', user).catch(() => null),
    authedGet('/v2/recovery?limit=1', user).catch(() => null),
    authedGet('/v2/cycle?limit=1', user).catch(() => null),
    authedGet('/v2/activity/sleep?limit=1', user).catch(() => null),
  ]);
  const rec = recovery?.records?.[0]?.score ?? {};
  const cyc = cycle?.records?.[0]?.score ?? {};
  const slp = sleep?.records?.[0]?.score ?? {};
  return {
    user,
    name: profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : null,
    weight_kg: body?.weight_kilogram ?? null,
    height_m: body?.height_meter ?? null,
    max_heart_rate: body?.max_heart_rate ?? null,
    recovery_score: rec.recovery_score ?? null,
    resting_heart_rate: rec.resting_heart_rate ?? null,
    hrv_ms: rec.hrv_rmssd_milli ?? null,
    spo2_percentage: rec.spo2_percentage ?? null,
    skin_temp_celsius: rec.skin_temp_celsius ?? null,
    day_strain: cyc.strain ?? null,
    calories_burned: cyc.kilojoule != null ? Math.round(cyc.kilojoule / 4.184) : null,
    avg_heart_rate: cyc.average_heart_rate ?? null,
    sleep_performance_pct: slp.sleep_performance_percentage ?? null,
    sleep_efficiency_pct: slp.sleep_efficiency_percentage ?? null,
    sleep_hours: slp.stage_summary
      ? +((slp.stage_summary.total_in_bed_time_milli - slp.stage_summary.total_awake_time_milli) / 3600000).toFixed(2)
      : null,
    respiratory_rate: slp.respiratory_rate ?? null,
  };
}

const usersOf = (u) => (u === 'both' ? ['me', 'wife'] : [u || 'me']);

async function collect(user, fn) {
  const out = {};
  for (const u of usersOf(user)) {
    try { out[u] = await fn(u); }
    catch (e) { out[u] = { error: e.message }; }
  }
  return out;
}

const COLLECTION = {
  whoop_recovery: '/v2/recovery',
  whoop_cycle: '/v2/cycle',
  whoop_sleep: '/v2/activity/sleep',
  whoop_workout: '/v2/activity/workout',
};

// ---- MCP wiring ----
const server = new Server(
  { name: 'whoop', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const userProp = {
  type: 'string',
  enum: ['me', 'wife', 'both'],
  description: 'Which user. Defaults to "me". Use "both" for me + wife.',
};
const rangeProps = {
  user: userProp,
  limit: { type: 'number', description: 'Max records (1-25, default 10).' },
  start: { type: 'string', description: 'ISO 8601 start datetime, e.g. 2026-06-14T00:00:00Z' },
  end: { type: 'string', description: 'ISO 8601 end datetime.' },
};

const TOOLS = [
  { name: 'whoop_snapshot', description: 'Today\'s WHOOP summary: recovery, strain, sleep, RHR, HRV, calories, body. Best for "how am I doing".',
    inputSchema: { type: 'object', properties: { user: userProp } } },
  { name: 'whoop_recovery', description: 'Recovery records: score, resting HR, HRV, SpO2, skin temp.',
    inputSchema: { type: 'object', properties: rangeProps } },
  { name: 'whoop_cycle', description: 'Day-strain cycles: strain, kilojoules/calories, avg & max HR.',
    inputSchema: { type: 'object', properties: rangeProps } },
  { name: 'whoop_sleep', description: 'Sleep records: stages, performance %, efficiency %, respiratory rate.',
    inputSchema: { type: 'object', properties: rangeProps } },
  { name: 'whoop_workout', description: 'Workouts: sport, strain, HR zones, distance, calories.',
    inputSchema: { type: 'object', properties: rangeProps } },
  { name: 'whoop_profile', description: 'Basic profile: name and email.',
    inputSchema: { type: 'object', properties: { user: userProp } } },
  { name: 'whoop_body', description: 'Body measurements: height, weight, max heart rate.',
    inputSchema: { type: 'object', properties: { user: userProp } } },
  { name: 'whoop_raw', description: 'Call any WHOOP v2 endpoint directly. Provide path like /v2/cycle?limit=3.',
    inputSchema: { type: 'object', properties: {
      path: { type: 'string', description: 'API path starting with /v2/...' },
      user: { type: 'string', enum: ['me', 'wife'], description: 'Defaults to "me".' },
    }, required: ['path'] } },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const wrap = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
  try {
    if (name === 'whoop_snapshot') return wrap(await collect(args.user, snapshot));
    if (name === 'whoop_profile')  return wrap(await collect(args.user, (u) => authedGet('/v2/user/profile/basic', u)));
    if (name === 'whoop_body')     return wrap(await collect(args.user, (u) => authedGet('/v2/user/measurement/body', u)));
    if (COLLECTION[name]) {
      const base = COLLECTION[name];
      const opts = { limit: args.limit || 10, start: args.start, end: args.end };
      return wrap(await collect(args.user, (u) => authedGet(base + buildQuery(opts), u)));
    }
    if (name === 'whoop_raw') {
      if (!args.path || !args.path.startsWith('/')) throw new Error('path must start with /v2/...');
      const u = ['me', 'wife'].includes(args.user) ? args.user : 'me';
      return wrap(await authedGet(args.path, u));
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('WHOOP MCP server running on stdio');
