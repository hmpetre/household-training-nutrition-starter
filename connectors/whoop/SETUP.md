# WHOOP MCP connector — setup

This makes WHOOP show up as native tools you can just ask about in chat. The
server runs locally on your Mac (where reaching WHOOP works) and Claude Desktop
bridges it into Cowork.

Already done for you: the server is built and its dependencies are installed in
this folder. You only need to register it and restart.

## 1. Open your Claude Desktop config file

In Terminal, paste:

```
open -e "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

- If it opens an existing file with content, you'll **merge** the WHOOP entry in (step 2).
- If it says the file doesn't exist, create it:

```
mkdir -p "$HOME/Library/Application Support/Claude"
cp "/Users/YOUR_USERNAME/Library/CloudStorage/<local path>" "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

…then skip to step 3.

## 2. Merge the WHOOP entry (only if the file already had content)

The file is JSON. If it already has an `"mcpServers"` block, add the `"whoop"`
key inside it. The WHOOP entry to add is in:

`mcp-server/claude_desktop_config.snippet.json`

A merged file looks like:

```json
{
  "mcpServers": {
    "existing-server": { ... },
    "whoop": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Library/CloudStorage/<local path>"],
      "env": {
        "WHOOP_CLIENT_ID": "...",
        "WHOOP_CLIENT_SECRET": "...",
        "WHOOP_ACCESS_TOKEN": "...",
        "WHOOP_REFRESH_TOKEN": "..."
      }
    }
  }
}
```

(The full values are already filled into the snippet file — copy them from there.)
Save and close.

## 3. Fully quit and reopen Claude

Quit Claude completely (Cmd+Q, not just close the window), then reopen it.
On restart, Claude loads the WHOOP server.

## 4. Confirm it loaded

In Claude's settings, look under Connectors / MCP for **whoop** showing as
connected. Or just ask in chat: "What WHOOP tools do you have?" — you should see
whoop_snapshot, whoop_sleep, whoop_recovery, etc.

## 5. Use it

Just ask:
- "What's my WHOOP recovery today?"
- "How did I sleep last night?"
- "My workouts this week"
- "Compare my and my wife's recovery" (after adding wife's tokens)

## Adding your wife later

Authorize her account (the auth flow in the original whoop.js or proxy), then
add `WHOOP_ACCESS_TOKEN_WIFE` and `WHOOP_REFRESH_TOKEN_WIFE` to the `env` block
in the config and restart Claude.

## Notes & troubleshooting

- **Tokens live only in this local config**, never sent anywhere except WHOOP.
- Access tokens auto-refresh using the refresh token, so this keeps working.
- If tools don't appear: confirm `node` is installed (`node --version`), the path
  in `args` is exactly right, and that you fully quit + reopened Claude.
- If a call returns an auth error, your refresh token may have expired — re-run
  authorization and update the tokens in the config.
- This works in Claude Desktop / Cowork. To use the same WHOOP access from
  Claude on the web, you'd need the hosted (HTTP) version instead — ask if you
  want that later.
