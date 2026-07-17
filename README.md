# Household Training & Nutrition Starter

A do‑it‑with‑you kit that turns Claude into your household's **training‑aware meal planner**.

It connects the health data you already have — **WHOOP** (recovery/sleep/strain), a **Withings** scale (weight + body‑fat %), and **TrainingPeaks / intervals.icu** (your workouts) — and layers a **meal‑planning brain** on top that fuels your training, drives body composition slowly and safely, and builds a weekly shopping list. It works for one person, a couple, or a whole family with kids.

You do **not** need to know how to code. If you can copy‑paste one sentence, you can set this up.

---

## The easiest way to set this up (recommended)

This kit is designed to be handed to **Claude Cowork**, which will then read the instructions inside and set everything up *with* you, one step at a time.

1. Install the **Claude desktop app** and turn on **Cowork mode** (it's in the app).
2. Open a Cowork chat and paste this, replacing the link with wherever this repo lives:

   > **"Set up the household training & nutrition system from https://github.com/YOUR‑USERNAME/household-training-nutrition-starter — walk me through it one step at a time."**

3. That's it. Cowork will read [`cowork-setup/SKILL.md`](cowork-setup/SKILL.md), check what you have, help you create the free accounts/keys you need, install the connectors locally, and then interview you to build your household's plan. It will pause and wait for you at each step.

> **Why "one step at a time"?** Setup touches a few outside accounts (WHOOP, Withings, intervals.icu). The kit is written so Claude does the technical parts and only asks *you* for the things a human has to do — clicking "authorize," pasting a key, telling it what your family likes to eat.

---

## Prefer to read it yourself?

Open [`SETUP.md`](SETUP.md) — the same steps, written for a human, in plain language.

---

## What's inside

| Folder | What it is |
|--------|-----------|
| [`cowork-setup/`](cowork-setup/) | The step‑by‑step runbook Claude Cowork follows to install everything. **Start here.** |
| [`connectors/`](connectors/) | The four data sources and how to connect each: **WHOOP**, **Withings**, **TrainingPeaks**, **intervals.icu**. |
| [`meal-planner/`](meal-planner/) | The meal‑planning brain: the engine (`SKILL.md`) plus **blank templates** you fill in for your household. |
| [`config/`](config/) | A template Claude config file showing how the connectors are wired. |
| [`scripts/`](scripts/) | `install.sh` — sets up the local connectors on your computer. |

---

## What you'll need (all free / already owned)

- A Mac (these instructions are Mac‑first; the pieces work on other systems with small tweaks).
- A **WHOOP** account (optional but recommended) + a free WHOOP developer app.
- A **Withings** scale + account (optional) + a free Withings developer app.
- A **TrainingPeaks** and/or **intervals.icu** account for your workouts (optional).
- The Claude desktop app.

Everything is optional — connect only the data sources you use. The meal planner still works with whatever you give it, even if that's just body‑fat % typed in by hand.

---

## Privacy

- **None of the original author's personal data is in this repo.** Every profile, weight log, allergy list, store, and budget is a **blank template** for you to fill in.
- Your credentials (WHOOP/Withings tokens, etc.) live only on **your** computer, in `.env` files that are never committed (see [`.gitignore`](.gitignore)). Nothing is uploaded anywhere.

---

## This is a starter, not medical advice

The meal planner is a lifestyle tool for organizing food around training. It is **not** medical, dietary, or clinical advice. If anyone in your household has a medical condition, is pregnant, is a child with special needs, or has an eating disorder history, talk to a qualified professional before following any plan. The kit is built to be cautious and performance‑first, never extreme — keep it that way.

## License

MIT — see [`LICENSE`](LICENSE). Use it, fork it, share it, make it yours.
