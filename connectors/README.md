# Connectors — your data sources

These are small, **locally hosted** programs (MCP servers) that let Claude read your health and training data. They run on your own computer and talk to each service's API. Connect only the ones you use — each is optional.

| Connector | Gives the planner | Auth | Runtime |
|-----------|-------------------|------|---------|
| **whoop** | Recovery, sleep, day strain, workouts, weight, resting HR/HRV | Free WHOOP developer app + one‑time OAuth | Node.js |
| **withings** | Weight and **body‑fat %**, lean/muscle mass, body water, BMR, BP | Free Withings developer app + one‑time OAuth | Node.js |
| **trainingpeaks** | Planned & completed workouts, TSS, fitness (CTL/ATL/TSB), events/races | Account login | Python 3.11 |
| **intervals-icu** | Same shape as TrainingPeaks (workouts, wellness, fitness) from intervals.icu | One API key | MCP (hosted or local) |

## The one rule that keeps these working

**Install them on a plain local disk — never inside a cloud‑synced folder** (OneDrive, Dropbox, iCloud Drive, Google Drive). Those services "offload" files you haven't opened recently to save space; when that happens, Node or Python tries to read a file that isn't really there and the connector fails at launch (usually a read timeout). The included `scripts/install.sh` puts everything in `~/mcp-servers`, which is safe.

## How they get wired into Claude

Each connector is registered in Claude's desktop config with an absolute path to its start file and any credentials. See [`../config/claude_desktop_config.example.json`](../config/claude_desktop_config.example.json) for the exact shape, and each connector's README for its specific block.

## Two ways to feed workouts in

**TrainingPeaks** and **intervals.icu** both provide your workouts and training load. Most people use one or the other:

- On **intervals.icu**? Use the `intervals-icu` connector — it's the simplest (one API key) and intervals.icu can auto‑sync from Garmin/Strava/Wahoo.
- Committed to **TrainingPeaks** (e.g. you have a coach there)? Use the `trainingpeaks` connector.

You can run both; the meal planner just needs *a* source of planned TSS and duration.

## Security

- Credentials live only in per‑connector `.env` files on your machine. These are git‑ignored and never leave your computer.
- The one‑time "Authorize" step uses each service's official OAuth screen in your browser. Claude never sees your account password.
