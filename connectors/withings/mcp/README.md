# Withings MCP

Chat with your Withings body-composition data directly in Claude — like the WHOOP MCP.

## What it is

`withings-mcp.js` is a small MCP server that wraps the existing `../scripts/withings.js`
CLI. It runs on **your Mac** (launched by Claude Desktop), so it has internet access and
reuses the tokens already in `../scripts/.env`. No new auth, no `npm install` (Node stdlib
only).

## Tools

- `withings_snapshot` — latest value for every body-comp field (weight, body-fat %,
  fat mass, lean/muscle mass, body water %, bone mass, visceral fat, BMR, HR).
- `withings_history` — measurements over a date window (trends). Args: `start`, `end`,
  `limit`, `types`.
- `withings_heart` — blood-pressure / heart-rate readings over a window.
- `withings_raw` — escape hatch to call any Withings service.

## One-time setup

1. Open your Claude Desktop config:
   `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the `withings` block under `mcpServers` (see snippet Claude gave you, or below).
3. **Fully quit and reopen Claude Desktop** (Cmd-Q, not just close the window).
4. Ask: "What's my body fat from Withings?" — it should call `withings_snapshot`.

## Config snippet

```json
{
  "mcpServers": {
    "withings": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/Library/CloudStorage/<local path>"
      ]
    }
  }
}
```

If `node` isn't on Claude Desktop's PATH, replace `"command": "node"` with the absolute
path from `which node` in your terminal (e.g. `/usr/local/bin/node` or an nvm path).

## Notes

- Tokens auto-refresh via `withings.js`; if they ever fully expire, run
  `node ../scripts/withings.js auth me` in Terminal once to re-authorize.
- This server only exposes user "me" (User) by design.
