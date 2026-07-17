# WHOOP connector

Reads WHOOP recovery, sleep, day strain, workouts, and body measurements (weight, resting HR, HRV) via the WHOOP v2 API. Supports one or two people (`me` and an optional second account).

> The connector **code** is placed here by the installer/publisher. This README is the setup guide. If the code folder is empty, run `scripts/install.sh` from the repo root first.

## What you'll need

- A WHOOP account (and membership).
- A free **WHOOP developer app** (takes ~2 minutes to create).

## Step 1 — Create a WHOOP developer app

1. Go to the WHOOP developer dashboard: https://developer.whoop.com and sign in.
2. Create a new app. Give it any name (e.g. "My Household Planner").
3. Set the **Redirect URL** to exactly:
   ```
   http://localhost:3000/callback
   ```
4. Request these scopes: `read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout offline`.
5. Copy the **Client ID** and **Client Secret**.

## Step 2 — Create your `.env`

Copy `.env.example` to `.env` in this connector's folder and paste your values:

```
cp .env.example .env
```

Fill in `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`. Leave the token lines blank — the next step fills them.

## Step 3 — Authorize once

From the connector's code folder (where its start script lives), run the one‑time auth. It opens WHOOP in your browser; click **Authorize**. It captures the code on `localhost:3000` and writes your access + refresh tokens into `.env`.

```
node whoop.js auth me      # primary person
node whoop.js auth wife    # optional second person
```

After this, the connector auto‑refreshes expired tokens on its own — you rarely touch it again.

## Step 4 — Prove it works

```
node whoop.js snapshot me
```

You should see a JSON blob with recovery, strain, sleep, and body summary. If you do, you're done.

## Step 5 — Register it in Claude

Add the `whoop` block from [`../../config/claude_desktop_config.example.json`](../../config/claude_desktop_config.example.json) to your Claude config, using absolute paths, then restart Claude. Ask: **"what's my WHOOP recovery?"**

## Notes

- **Body‑fat %** is *not* in WHOOP's API — that comes from the Withings connector (or you type it in).
- Recovery: green ≥67, yellow 34–66, red ≤33. Calories = kilojoules ÷ 4.184.
- Two people share one developer app; the second person just needs their own `..._WIFE` tokens (rename the variables to whatever you like if you prefer).

## Troubleshooting

- **"missing tokens"** → re‑run `node whoop.js auth me`.
- **Nothing shows in Claude** → confirm the path in your config is absolute and correct, the `.env` has real values, and you restarted Claude.
- **Port 3000 in use** → close whatever's using it (don't run two auth flows at once).
