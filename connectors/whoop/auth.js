#!/usr/bin/env node
/*
 * WHOOP OAuth authorizer — adds a user's tokens to tokens.json.
 * -----------------------------------------------------------------
 * The MCP server (index.js) only USES tokens; it has no way to obtain them.
 * This one-time script runs the WHOOP OAuth flow and writes the resulting
 * access + refresh tokens into tokens.json under the chosen user key ("me"
 * or "wife"), which is exactly where index.js reads them from.
 *
 * Usage (from this folder):
 *   node auth.js wife        # authorize the wife account
 *   node auth.js me          # (re)authorize the primary account
 *
 * Credentials: reads WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET from the environment
 * if set; otherwise falls back to the values in claude_desktop_config.snippet.json
 * in this folder (so you don't have to export anything).
 *
 * Redirect URI: defaults to http://localhost:3000/whoop/callback. Override with
 * WHOOP_REDIRECT_URI=... if your WHOOP developer app registers a different one.
 * It MUST exactly match a redirect URI registered in your WHOOP developer app,
 * or WHOOP rejects the authorization.
 *
 * IMPORTANT: when the browser opens, log in as the ACCOUNT YOU'RE AUTHORIZING.
 * For "wife", log in with HER WHOOP credentials, not yours.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, 'tokens.json');
const SNIPPET_FILE = path.join(__dirname, 'claude_desktop_config.snippet.json');

const WHOOP_AUTH_HOST = 'api.prod.whoop.com';
const AUTHORIZE_PATH = '/oauth/oauth2/auth';
const TOKEN_PATH = '/oauth/oauth2/token';

// Scopes: full read set + offline (so we get a refresh token). Mirrors what the
// primary account uses.
// Exact scope string from the proven original auth script.
const SCOPES =
  'offline read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout';

// Mirror the existing/proven WHOOP infrastructure: the original auth script
// (whoop/skills/whoop/scripts/whoop.js) and the developer app both use
// http://localhost:3000/callback. Default to that so it matches the registered
// redirect URI. Override with WHOOP_REDIRECT_URI only if the app changes.
const REDIRECT_URI =
  process.env.WHOOP_REDIRECT_URI || 'http://localhost:3000/callback';
const REDIRECT_PORT = Number(new URL(REDIRECT_URI).port || 3000);
const REDIRECT_PATHNAME = new URL(REDIRECT_URI).pathname;

// ---- resolve client credentials (env first, then the snippet file) ----
function resolveCreds() {
  let id = process.env.WHOOP_CLIENT_ID;
  let secret = process.env.WHOOP_CLIENT_SECRET;
  if ((!id || !secret) && fs.existsSync(SNIPPET_FILE)) {
    try {
      const env = JSON.parse(fs.readFileSync(SNIPPET_FILE, 'utf8'))
        ?.mcpServers?.whoop?.env || {};
      id = id || env.WHOOP_CLIENT_ID;
      secret = secret || env.WHOOP_CLIENT_SECRET;
    } catch { /* ignore */ }
  }
  if (!id || !secret) {
    throw new Error(
      'Missing WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET (not in env or snippet file).'
    );
  }
  return { id, secret };
}

function postToken(body) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams(body).toString();
    const req = https.request(
      {
        hostname: WHOOP_AUTH_HOST,
        path: TOKEN_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(`Token endpoint HTTP ${res.statusCode}: ${data}`));
          } catch (e) {
            reject(new Error(`Token parse error (HTTP ${res.statusCode}): ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function readTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch { /* ignore corrupt */ }
  return {};
}

function writeTokens(obj) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(obj, null, 2), { mode: 0o600 });
}

async function main() {
  const user = (process.argv[2] || '').toLowerCase();
  if (!['me', 'wife'].includes(user)) {
    console.error('Usage: node auth.js <me|wife>');
    process.exit(1);
  }

  const { id: clientId, secret: clientSecret } = resolveCreds();
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl =
    `https://${WHOOP_AUTH_HOST}${AUTHORIZE_PATH}?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${state}`;

  await new Promise((resolve, reject) => {
    const srv = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== REDIRECT_PATHNAME) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error || !code) {
        res.end(`Authorization failed: ${error || 'no code returned'}. You can close this tab.`);
        srv.close();
        return reject(new Error(`Auth failed: ${error || 'no code'}`));
      }
      if (returnedState !== state) {
        res.end('State mismatch (possible CSRF). Aborting. You can close this tab.');
        srv.close();
        return reject(new Error('OAuth state mismatch'));
      }

      try {
        const tok = await postToken({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
        });
        if (!tok.access_token) throw new Error(`No access_token: ${JSON.stringify(tok)}`);

        const all = readTokens();
        all[user] = {
          access: tok.access_token,
          refresh: tok.refresh_token || '',
        };
        writeTokens(all);

        res.end(`✅ Authorized WHOOP for "${user}". Tokens saved. You can close this tab and return to Terminal.`);
        console.error(`\n✅ Success — wrote ${user} tokens to tokens.json`);
        console.error('   Now fully quit (Cmd-Q) and reopen Claude Desktop to load them.\n');
        srv.close();
        resolve();
      } catch (e) {
        res.end(`Token exchange failed: ${e.message}. You can close this tab.`);
        srv.close();
        reject(e);
      }
    });

    srv.on('error', reject);
    srv.listen(REDIRECT_PORT, () => {
      console.error(`\nAuthorizing WHOOP for "${user}".`);
      console.error(`Redirect URI: ${REDIRECT_URI}`);
      console.error(`\n>>> Log in as the ${user.toUpperCase()} account when the browser opens. <<<\n`);
      console.error(`If the browser doesn't open, paste this URL manually:\n${authUrl}\n`);
      exec(`open "${authUrl}" || xdg-open "${authUrl}"`);
    });
  });

  process.exit(0);
}

main().catch((e) => {
  console.error('\nError:', e.message);
  if (/redirect/i.test(e.message)) {
    console.error('Tip: the redirect URI must EXACTLY match one registered in your WHOOP developer app.');
    console.error('Override with: WHOOP_REDIRECT_URI="http://localhost:3000/your/path" node auth.js ' + (process.argv[2] || 'wife'));
  }
  process.exit(1);
});
