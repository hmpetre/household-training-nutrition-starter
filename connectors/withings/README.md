# Withings connector

Reads body‑composition data from a Withings scale (Body / Body+): **weight and body‑fat %**, plus lean/muscle mass, body water %, bone mass, BMR, visceral fat, and (from a Withings BPM) blood pressure & heart rate. This is the natural source for **body‑fat %**, the one number the meal planner otherwise needs typed in by hand.

Supports one or two people.

> The connector **code** is placed here by the installer/publisher. This README is the setup guide.

## What you'll need

- A Withings scale + account.
- A free **Withings developer app**.

## Step 1 — Create a Withings developer app

1. Go to https://developer.withings.com and sign in; create an application.
2. Set the **Callback / Redirect URL** to exactly:
   ```
   http://localhost:3000/callback
   ```
   It must match character‑for‑character or the login will fail.
3. Copy the **Client ID** and **Client Secret**.

## Step 2 — Create your `.env`

```
cp .env.example .env
```

Fill in `WITHINGS_CLIENT_ID` and `WITHINGS_CLIENT_SECRET`; leave the token lines blank.

## Step 3 — Authorize once

From the connector's code folder:

```
node withings.js auth me      # primary person
node withings.js auth wife    # optional second person
```

A browser opens to Withings — click **Authorize**. Tokens are written to `.env`. Access tokens last ~3 hours and refresh automatically; refresh tokens last ~1 year.

> Both the WHOOP and Withings auth flows use port 3000. They're one‑time steps, so just don't run them at the exact same moment.

## Step 4 — Prove it works

```
node withings.js snapshot me
```

Look for `fat_ratio_pct` (your body‑fat %) and `weight_kg`. `as_of_iso` tells you when the reading was taken.

## Step 5 — Register it in Claude

Add the `withings` block from [`../../config/claude_desktop_config.example.json`](../../config/claude_desktop_config.example.json) to your Claude config (absolute paths), then restart Claude. Ask: **"what's my body fat?"**

## Notes

- `snapshot` returns the latest value for each field. The meal planner reads `fat_ratio_pct` + `weight_kg`.
- The connector resolves its `.env` from `WITHINGS_ENV_PATH` (set in your Claude config) or the current folder. Keep the `.env` next to the code, on a local disk.

## Troubleshooting

- **Login redirect fails** → the redirect URL in the Withings console must be exactly `http://localhost:3000/callback`.
- **Reading is old** → step on the scale; the API only has what's synced to your Withings account.
- **Nothing in Claude** → absolute path in config, real `.env` values, restart Claude.
