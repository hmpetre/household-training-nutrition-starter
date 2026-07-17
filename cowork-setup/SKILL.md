---
name: household-setup
description: Step-by-step runbook for Claude (Cowork) to install the Household Training & Nutrition Starter for a non-technical user. Use when the user asks to "set up the household training & nutrition system", pastes this repo's link, or asks to connect WHOOP / Withings / TrainingPeaks / intervals.icu and start meal planning. Drive it ONE step at a time; do the technical work yourself and only ask the human for things a human must do (click authorize, paste a key, describe their food preferences).
---

# Household Training & Nutrition — Setup Runbook

You (Claude, in Cowork) are the installer. The person you're helping likely has **no technical background**. Your job: do every technical step yourself, and pause at each human‑only step with a short, friendly instruction and wait.

## Golden rules

1. **One step at a time.** Never dump the whole process. Do a step, show the result, then say what's next and wait.
2. **Do the work, don't assign homework.** You run the commands, create the files, edit the config. Ask the human only to: create an account, click "Authorize," paste a key, or answer a question about their household.
3. **Everything is optional.** If they don't use WHOOP, skip it. A working plan needs *nothing* except a person and some food preferences. Connectors just make it smarter.
4. **Never ask for or handle passwords, or type credentials into websites for them.** For OAuth "Authorize" screens and pasting secret keys, the human does that part.
5. **Confirm before anything irreversible** — editing their Claude config, restarting the app, pushing to git.
6. **Be encouraging.** Celebrate each connector that comes online.

## What "done" looks like

- The connectors they want are running locally and answering (e.g. "what's my recovery", "what's my body fat", "this week's workouts").
- Their household's meal‑planner files are filled in from a short interview.
- They can say "make this week's meal plan" and get a real plan.

---

## STEP 0 — Orient & check the basics

1. Greet them, in one or two sentences say what this does, and ask **who's in the household** (just names/ages and who trains) — you'll need it later, and it tells you which connectors matter.
2. Check prerequisites by running (Bash):
   - `node --version` (need Node 18+). If missing → point them to https://nodejs.org (LTS installer) and wait.
   - `python3 --version` (need 3.11+ for TrainingPeaks). If missing/older → https://www.python.org/downloads/ and wait. *(Only needed if they'll use TrainingPeaks.)*
   - `git --version` and `gh --version` are only needed if they later want to re‑share; not required to use the kit.
3. Ask **where they want the kit to live** on their computer. Default suggestion: `~/household-planner`. Clone or copy this repo there (or, if they already downloaded it, `cd` into it).
4. Ask **which data sources they use** (WHOOP? Withings scale? TrainingPeaks? intervals.icu? none?). Only set up what they say yes to.

## STEP 1 — Install the local connectors

Run the installer, which copies each chosen connector into `~/mcp-servers/<name>` and rebuilds its dependencies **locally** (never inside a cloud‑synced folder like OneDrive/Dropbox/iCloud — that is the #1 cause of these breaking):

```
bash scripts/install.sh
```

The installer is interactive and will ask which connectors to set up. Watch its output; if a step errors, read the error and fix it before moving on. Common fixes:
- **npm cache EACCES / root‑owned** → re‑run using a local cache: the installer already passes `--cache`; if it still fails, tell them to run `sudo chown -R $(id -u):$(id -g) ~/.npm` once.
- **Python building `cryptography` from source / OpenSSL error** → make sure a real Python **3.11** is used and pip pulls wheels (`--prefer-binary`); the installer does this.

## STEP 2 — Get credentials for each connector (human clicks; you handle the rest)

Do these **only for the connectors they chose**, one connector at a time. Each connector folder has a README with the exact clicks — follow it and relay the human‑only parts.

- **WHOOP** → `connectors/whoop/README.md`. They create a free WHOOP developer app, copy the Client ID/Secret to you, you write the `.env`, then you run the one‑time `auth` command and they click "Authorize" in the browser that opens.
- **Withings** → `connectors/withings/README.md`. Same shape: free Withings developer app, redirect URL must be exactly `http://localhost:3000/callback`, then the one‑time `auth`.
- **TrainingPeaks** → `connectors/trainingpeaks/README.md`. Follow its auth steps.
- **intervals.icu** → `connectors/intervals-icu/README.md`. Simplest of all — usually just an API key from their intervals.icu settings.

For each: create the `.env` from the connector's `.env.example`, fill the values they paste, run the auth flow, then **prove it works** by calling the connector once and showing them the number (their recovery, their body‑fat %, a recent workout).

## STEP 3 — Wire the connectors into Claude

1. Open `config/claude_desktop_config.example.json`. For each connector they set up, add its block to their real Claude config at
   `~/Library/Application Support/Claude/claude_desktop_config.json`.
2. **Back up first**: copy the existing config to `...json.bak-<date>` before editing. Edit the JSON programmatically (e.g. a small `python3 -c` json load/dump), never by hand‑typing over their secrets.
3. Use **absolute paths** to `~/mcp-servers/<name>/…` and an **absolute `node`/`python` path** (find with `command -v node`). Point each connector's env/creds at its local `.env`.
4. Tell them to **fully quit Claude (Cmd+Q) and reopen it**, then confirm each connector's tools appear and answer.

## STEP 4 — Build the household's meal plan files

Now the fun part — no more tech. Copy the blank templates into a private working folder that is **theirs** and stays out of the repo:

```
mkdir -p ~/household-planner/my-plan
cp -R meal-planner/templates/ ~/household-planner/my-plan/
```

Then **interview them** to fill each file (see `meal-planner/SKILL.md` for what each file drives). Keep it conversational — a few questions at a time, not a form dump:

- **profiles.md** — who's in the house, ages, training or not, goals (lose fat / maintain / perform / feed the kids well), any target body‑fat or weight, activity level. Kids: just "growing kids, feed them well, no cutting" is fine.
- **restrictions-allergies.md** — allergies (hard blocks) and medical/dietary needs per person. This is the safety file — get it right.
- **how-we-eat.md** — cooking style, equipment, who cooks, eat‑out days, favorite cuisines, weeknight time limit, breakfast/lunch/dinner rhythm.
- **shopping** (inside how-we-eat.md) — where they shop, rough weekly budget, bulk vs fresh habits.
- **meal-library.md** — a handful of meals they already love, to seed the catalog. It grows over time.
- **week-input.md**, **bf-tracker.md**, **calibration-log.md** — leave mostly blank; explain they get filled as the system runs.

Save their answers into the files. **Never invent medical facts or allergies** — only record what they tell you.

## STEP 5 — First plan + set expectations

1. Run one real request: **"make this week's meal plan."** Pull live workouts/recovery/body‑fat where connected; otherwise ask for the one or two missing numbers.
2. Deliver the plan in chat (per `meal-planner/SKILL.md`, plans stay in chat; only the tracker/preference files get written).
3. Explain the two rhythms: a **Sunday** weekly plan + shopping list, and quick **daily** macro tweaks. Offer to set a weekly reminder.
4. Tell them how to make it smarter: after meals, tell Claude what they loved/hated and it updates `meal-library.md`.

## If something's not connecting

- The connector's files must be on a **plain local disk**, not a cloud‑synced folder. If they insist on cloud storage, at least mark it "always keep on this device."
- Re‑read the connector README's troubleshooting section.
- A missing connector must **never** block a plan — fall back to asking for the number by hand and continue.

## Tone reminder

You're a patient guide sitting next to a friend who's a little nervous about "tech stuff." Small steps, plain words, quick wins, and reassurance. When in doubt, do more of the work yourself and ask less of them.
