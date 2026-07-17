# Setup — the human version

The easiest path is to let **Claude Cowork** do this with you (see the main [README](README.md)). But if you'd rather see the whole map first, here it is in plain language. Nothing here requires coding — you'll mostly create a couple of free accounts and paste some values.

Do the steps in order. Skip any data source you don't use.

---

## Before you start

You need:

- A **Mac** (these steps are Mac‑first).
- The **Claude desktop app** with **Cowork** turned on.
- **Node.js** installed — get the "LTS" installer from https://nodejs.org if you don't have it.
- **Python 3.11+** — only if you'll use TrainingPeaks. Get it from https://www.python.org/downloads/.

Don't worry if you're not sure whether you have Node/Python — Cowork checks for you and links the installer if needed.

---

## Step 1 — Put the kit on your computer

Download this repository (green "Code" button → "Download ZIP", then unzip), or if you know git, clone it. Put it somewhere easy like your home folder. A good spot is `~/household-planner`.

## Step 2 — Install the connectors

The connectors are little local programs that fetch your data. Open the **Terminal** app and run:

```
bash scripts/install.sh
```

It asks which data sources you use (WHOOP, Withings, TrainingPeaks, intervals.icu) and sets up only those, in a plain local folder (`~/mcp-servers`). **Important:** keep these on your normal hard drive — not inside OneDrive, Dropbox, or iCloud Drive. Cloud‑synced folders quietly "offload" files and break these programs. (This kit exists partly because that happened to the original author.)

## Step 3 — Connect each data source

Each connector has a short README with exact clicks:

| Data source | What you'll do | Guide |
|-------------|----------------|-------|
| **WHOOP** | Make a free WHOOP "developer app," paste its ID/secret, click Authorize once. | [connectors/whoop/README.md](connectors/whoop/README.md) |
| **Withings scale** | Make a free Withings developer app, set the redirect URL, click Authorize once. | [connectors/withings/README.md](connectors/withings/README.md) |
| **TrainingPeaks** | Follow the auth steps to link your account. | [connectors/trainingpeaks/README.md](connectors/trainingpeaks/README.md) |
| **intervals.icu** | Copy one API key from your intervals.icu settings. | [connectors/intervals-icu/README.md](connectors/intervals-icu/README.md) |

For each, you'll create a small `.env` file (copy the provided `.env.example` and fill in the blanks). This file holds your keys and **stays on your computer** — it's never shared or committed.

If you're doing this with Cowork, it writes those files for you — you just paste the values.

## Step 4 — Tell Claude about the connectors

Claude needs to know these programs exist. That means adding a few lines to Claude's config file:

`~/Library/Application Support/Claude/claude_desktop_config.json`

Use [`config/claude_desktop_config.example.json`](config/claude_desktop_config.example.json) as the template — it shows exactly what each connector's block looks like. **Make a backup of your existing config first.** Then fully quit Claude (Cmd+Q) and reopen it.

(Again: Cowork does this edit for you, backup and all. Highly recommended.)

## Step 5 — Build your household's plan

Copy the blank templates to a private folder that's yours:

```
mkdir -p ~/household-planner/my-plan
cp -R meal-planner/templates/ ~/household-planner/my-plan/
```

Then fill them in — either by hand, or (much easier) by chatting with Claude, which will ask you the right questions and write the answers for you. The files are:

- **profiles.md** — who's in the house and each person's goals.
- **restrictions-allergies.md** — allergies and medical/dietary needs (the safety file).
- **how-we-eat.md** — how you cook, shop, and eat; your budget.
- **meal-library.md** — a few meals you already love (it grows over time).
- **week-input.md / bf-tracker.md / calibration-log.md** — mostly auto‑filled as you use it.

See [meal-planner/README.md](meal-planner/README.md) for what each file does.

## Step 6 — Use it

Ask Claude: **"make this week's meal plan."** You'll get a periodized plan and a shopping list. There are two rhythms:

- **Sunday:** the weekly plan + shopping list.
- **Any day:** a quick "today's macros" tweak based on your weigh‑in and today's training.

Tell Claude what meals you loved or want to skip, and it learns.

---

## Troubleshooting

- **A connector won't show up in Claude:** confirm its files are on a plain local disk (not cloud‑synced), that you restarted Claude, and that its `.env` has real values. Re‑read the connector's README.
- **"cryptography" build error (TrainingPeaks):** make sure Python 3.11 is installed; the installer pulls prebuilt packages with `--prefer-binary`.
- **npm permission error:** run `sudo chown -R $(id -u):$(id -g) ~/.npm` once, then retry.
- **Still stuck?** Paste the error into Cowork and ask it to debug — that's exactly the kind of thing it's good at.
