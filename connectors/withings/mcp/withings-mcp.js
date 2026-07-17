#!/usr/bin/env node
/*
 * Withings MCP server
 * -------------------
 * Exposes the existing, proven `withings.js` CLI as MCP tools so you can chat
 * with your Withings body-composition data directly (like the WHOOP MCP).
 *
 * Design: this is a THIN wrapper. It does NOT reimplement OAuth, token refresh,
 * or measurement decoding — it shells out to the sibling `withings.js`, which
 * already handles all of that and auto-refreshes tokens. That means there is
 * exactly one source of truth for auth/parsing and no drift.
 *
 * It runs on your Mac (launched by Claude Desktop), so it has internet access
 * and reads your real tokens from the same .env withings.js already uses.
 *
 * Protocol: JSON-RPC 2.0 over stdio, MCP 2024-11-05. Zero npm dependencies
 * (Node stdlib only), so there is nothing to `npm install`.
 *
 * Tools exposed:
 *   withings_snapshot  - latest value for every body-comp field (today's read)
 *   withings_history   - time series of measurements over a window (trends)
 *   withings_heart     - heart measurements (BP / HR list) over a window
 *   withings_raw       - escape hatch: call any Withings service directly
 */

'use strict';

const path = require('path');
const { execFile } = require('child_process');

// withings.js lives one directory up, in scripts/. Resolve relative to THIS file
// so it works no matter what cwd Claude Desktop launches us from.
const WITHINGS_CLI = path.join(__dirname, '..', 'scripts', 'withings.js');

// ---- run the CLI and parse its JSON stdout ----
function runCli(args) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,            // the node binary running this server
      [WITHINGS_CLI, ...args],
      { maxBuffer: 8 * 1024 * 1024, timeout: 30000 },
      (err, stdout, stderr) => {
        // withings.js prints data to stdout and diagnostics/errors to stderr.
        if (err) {
          const msg = (stderr || stdout || err.message || '').trim();
          return reject(new Error(msg || `withings.js exited: ${err.code}`));
        }
        const text = (stdout || '').trim();
        if (!text) return resolve({}); // no data, not an error
        try {
          resolve(JSON.parse(text));
        } catch (_) {
          // Not JSON (shouldn't happen) — return raw so the user still sees it.
          resolve({ raw: text });
        }
      }
    );
  });
}

// ---- MCP tool definitions ----
const TOOLS = [
  {
    name: 'withings_snapshot',
    description:
      "Latest Withings body-composition snapshot for User: weight, body-fat % " +
      "(fat_ratio_pct), fat mass, lean/muscle mass, body water %, bone mass, " +
      "visceral fat, BMR, and heart rate — each field is the most recent reading. " +
      "Use this for 'what's my body fat / weight / body comp right now'.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'withings_history',
    description:
      "Time series of Withings measurements over a date window, newest first. " +
      "Use for trends: 'show my body fat over the last 30 days', 'weight trend', " +
      "'how has lean mass changed'. Returns one row per measurement group.",
    inputSchema: {
      type: 'object',
      properties: {
        start: {
          type: 'string',
          description:
            "Window start, ISO date/datetime or YYYY-MM-DD (e.g. '2026-05-01'). " +
            "Omit for all available history.",
        },
        end: {
          type: 'string',
          description: "Window end, ISO date/datetime or YYYY-MM-DD. Omit for 'up to now'.",
        },
        limit: {
          type: 'number',
          description: 'Max number of measurement rows to return (newest first).',
        },
        types: {
          type: 'string',
          description:
            "Optional comma-separated Withings measure-type codes to restrict to " +
            "(e.g. '1,6' for weight + fat-ratio). Omit for the full body-comp set.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'withings_heart',
    description:
      "List Withings heart measurements (blood pressure, heart rate readings) over " +
      "an optional date window. Use for 'show my blood pressure history'.",
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'Window start, ISO or YYYY-MM-DD. Optional.' },
        end: { type: 'string', description: 'Window end, ISO or YYYY-MM-DD. Optional.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'withings_raw',
    description:
      "Escape hatch: call any Withings data service directly. Advanced use only. " +
      "Provide the service (e.g. 'measure') and key=value params " +
      "(e.g. action=getmeas, meastypes=1,6).",
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: "Withings service, e.g. 'measure' or 'v2/heart'." },
        params: {
          type: 'object',
          description: "Key/value params, e.g. { action: 'getmeas', meastypes: '1,6' }.",
          additionalProperties: true,
        },
      },
      required: ['service'],
      additionalProperties: false,
    },
  },
];

// ---- map a tool call to withings.js CLI args (always user "me") ----
async function callTool(name, args = {}) {
  switch (name) {
    case 'withings_snapshot':
      return runCli(['snapshot', 'me']);

    case 'withings_history': {
      const cli = ['measures', 'me'];
      if (args.types) cli.push('--types', String(args.types));
      if (args.start) cli.push('--start', String(args.start));
      if (args.end) cli.push('--end', String(args.end));
      if (args.limit) cli.push('--limit', String(args.limit));
      return runCli(cli);
    }

    case 'withings_heart': {
      const cli = ['heart', 'me'];
      if (args.start) cli.push('--start', String(args.start));
      if (args.end) cli.push('--end', String(args.end));
      return runCli(cli);
    }

    case 'withings_raw': {
      const cli = ['raw', String(args.service)];
      const params = args.params || {};
      for (const [k, v] of Object.entries(params)) cli.push(`${k}=${v}`);
      cli.push('me');
      return runCli(cli);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---- JSON-RPC over stdio ----
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;

  // Notifications (no id) require no response.
  if (id === undefined || id === null) {
    return;
  }

  try {
    if (method === 'initialize') {
      return reply(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'withings', version: '1.0.0' },
      });
    }

    if (method === 'tools/list') {
      return reply(id, { tools: TOOLS });
    }

    if (method === 'tools/call') {
      const toolName = params && params.name;
      const toolArgs = (params && params.arguments) || {};
      try {
        const data = await callTool(toolName, toolArgs);
        return reply(id, {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        });
      } catch (e) {
        // Surface Withings/auth errors as a tool error, not a transport crash.
        return reply(id, {
          content: [{ type: 'text', text: `Withings error: ${e.message}` }],
          isError: true,
        });
      }
    }

    // Unknown method.
    return replyError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    return replyError(id, -32603, e.message);
  }
}

// Read newline-delimited JSON-RPC messages from stdin.
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (_) {
      continue; // ignore non-JSON lines
    }
    handle(msg);
  }
});

process.stdin.on('end', () => process.exit(0));
