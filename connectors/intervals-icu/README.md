# intervals.icu connector

[intervals.icu](https://intervals.icu) is a free training‑analytics platform that can auto‑sync your workouts from Garmin, Strava, Wahoo, and more. Its MCP gives the meal planner your **workouts, training load (CTL/ATL/TSB), wellness, and calendar/events** — the same essentials as TrainingPeaks, usually with the simplest setup (a single API key).

This is the easiest workout source for most people. If you're not already committed to TrainingPeaks, start here.

## Option A — Use a hosted intervals.icu MCP (simplest)

Some Claude setups let you add intervals.icu as a connector without running anything locally.

1. In Claude's connector settings, search for **intervals.icu** and add it (or use the MCP registry from within Claude and ask it to "add the intervals.icu connector").
2. When prompted, paste your intervals.icu **API key**:
   - Log in at https://intervals.icu → **Settings** → **Developer** → copy your **API Key** (and note your **Athlete ID**).
3. Authorize, then ask Claude: **"pull my intervals.icu fitness and recent workouts."**

## Option B — Run an intervals.icu MCP locally

If you prefer a fully local setup like the other connectors, run an intervals.icu MCP server and register it in your Claude config the same way (absolute path + API key in the env). intervals.icu's API is documented at https://intervals.icu/api-docs.html. Point the meal planner at whichever workout connector you end up using — it only needs planned TSS and duration.

## What the meal planner uses from here

- **Planned workouts** for the coming days → estimate each day's energy burn (`~baseline + kcal/TSS × TSS`) and periodize carbs.
- **Completed workouts + whole‑day calories** → monthly recalibration of the burn model.
- **Fitness (CTL/ATL/TSB)** and **events/races** → protect fueling on key days.

## Getting your API key

1. https://intervals.icu → **Settings** → scroll to **Developer**.
2. Copy the **API Key**. Your **Athlete ID** is shown as `iNNNNN` in the same area / your profile URL.
3. Keep the key private — treat it like a password. It goes in a local `.env` or the connector's settings, never in the repo.
