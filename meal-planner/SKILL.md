---
name: meal-planner
description: Generate and continuously tune a household's macros, meal plan, and grocery list, driven by live workout data (TrainingPeaks/intervals.icu), recovery (WHOOP), and body composition (Withings). Use for any food-planning, macro-tuning, weekly-shopping, or fueling request for the household — a weekly plan or a daily macro tweak. Works for one person, a couple, or a family with kids. Reads all tunable numbers from the household's profile files; never hardcodes personal data.
---

# Household Meal Planner (engine)

Fuels training first, drives body composition toward each person's goal through a slow, performance‑protecting approach, and keeps grocery spend near a soft budget. Two cadences: a **weekly (Sunday)** framework + shopping list, and a **daily** weigh‑in tweak. It's a lifestyle planner, not a strict diet.

> **This file is the logic. All personal numbers live in the profile files** — read them every run, never bake specifics into this engine. This is what makes it shareable and per‑household.

## Files it reads (from the household's working folder)

- `profiles.md` — each person's stats, goal (or "no goal"), and all macro parameters (protein g/kg, carb bands, deficit caps, energy‑availability floor, burn model). **All tunable numbers live here.**
- `restrictions-allergies.md` — allergies (hard blocks) and medical/dietary needs. The safety file.
- `how-we-eat.md` — cooking/prep style, equipment, eat‑out days, stores, budget.
- `meal-library.md` — enjoyed meals tagged with macros, cost, prep. Grows over time.
- `week-input.md` — weekly/daily scratch: travel, overrides, body‑fat entries, connector fallbacks.
- `bf-tracker.md` — the body‑fat & weight log + rolling averages (per person with a body‑comp goal). Read + update every run.
- `calibration-log.md` — the feedback loop; reconciles predicted vs actual and holds the calibrated burn formula. Monthly.

## Data sources (pull live; fall back to `week-input.md` if a pull fails — a missing connector never blocks a plan)

- **Workouts** — TrainingPeaks (`tp_get_workouts`) or intervals.icu. Planned TSS + duration for the coming days; completed for calibration; fitness (CTL/ATL/TSB) and events/races for context.
- **WHOOP** — `whoop_body` (weight), `whoop_recovery` (recovery guardrail), `whoop_cycle` (whole‑day calories, for burn calibration only).
- **Withings** — `withings_snapshot` → `fat_ratio_pct` (body‑fat %) and `weight_kg`. Body‑fat % is the one number WHOOP can't give.
- Body‑fat fallback order: Withings → the value in `week-input.md`. If a reading is >~7 days old, still run but note it.

## ZERO‑QUESTION DEFAULT (never block on questions)

A bare prompt is a complete instruction. Run the full workflow end‑to‑end and **do not ask a clarifying question before producing the plan.** Triggers like "meal plan", "make this week's plan", "shopping list", "what are we eating" → run the **weekly** plan now. "macro check‑in", "today's macros" → run the **daily** tweak now.

When details are omitted, resolve every input from the files: body‑fat % (Withings → `week-input.md`), travel/who's‑home (`week-input.md`; if blank/stale assume everyone home and note it), overrides/races (`week-input.md` + live events), weight/workouts/recovery (live → fallbacks). Anything stated inline in the prompt **overrides** the file for that run. **Only after the plan is printed** may you invite adjustments.

## Dates (do this first, every run)

Never hand‑label weekday names — derive them from the date programmatically. Confirm "today" against the real system date. The week runs the next 7 days unless stated.

## Output rule — plans stay IN CHAT

Deliver every plan, daily tweak, and shopping list **in the chat reply**. Do **not** create plan documents. The only files written are the persistent tracking/preference files: append to `bf-tracker.md`, record parsed travel/body‑fat/overrides/feedback in `week-input.md`, add dishes to `meal-library.md`, and (only on a recalibration run) update `profiles.md` / `calibration-log.md`.

## Handling different household types

- **A person with a body‑comp or performance goal** (e.g. an athlete cutting or maintaining): full treatment — periodized macros, deficit logic, energy‑availability floor, body‑fat trend tracking.
- **A person with no goal / "just feed me well"**: skip deficit and body‑fat tracking; target sensible maintenance and good whole‑food meals.
- **Kids**: **never** apply a deficit or body‑fat target. Plan nutritious, age‑appropriate portions; growth and adequacy come first. Record only allergies/preferences.
- **Solo household**: everything still works; just one profile, smaller shopping list.
- Scale meals and the shopping list to **who's actually eating at home** each day.

## Estimating workout burn

For each planned session, estimate calories from the person's **calibrated burn model in `profiles.md`**, of the form `whole‑day kcal ≈ baseline + (kcal per TSS) × TSS`. Start from a documented default and **calibrate to the individual over time** (see `calibration-log.md`); always trust observed data over the generic starting numbers. A rest day ≈ the baseline.

## Daily run (weigh‑in tweak)

1. Load config. 2. Pull live: today's weight, recovery, today's + tomorrow's planned workouts; read latest body‑fat % from `week-input.md`/Withings. 3. Update trends (weight ~7‑day, body‑fat ~14‑day); never react to a single day. 4. Set today's macros from `profiles.md`: **calories** = projected burn − that person's goal deficit (0 for kids/no‑goal); **protein** = their constant g/kg; **carbs** = scale the daily total to today's load, then time it around the session (night‑before load if a key day is next, pre/during/post, remainder elsewhere); **fat** fills the rest above its floor. 5. Apply the adjust loop + guardrails. 6. Output today's calories + macros + carb timing (+ on‑bike fueling count if cycling), a one‑line "why", and which numbers were live vs fallback.

## Weekly (Sunday) run

1. Load config. 2. Pull the coming 7 days of planned workouts + body metrics/recovery + body‑fat trend. 3. Lay out each day's projected burn + macro framework across the week so carbs periodize to the hard/easy pattern. 4. Assign meal slots (committed / flex / out); push travel/social days to out/flex; key/race days get full fueling and zero deficit. 5. Select recipes from `meal-library.md`: allergy hard‑filter, maximize ingredient overlap, fit prep style/time, whole‑food bias. 6. **Prescribe exact portions** — the user does not track; you do the math. For every meal give a specified build with weighed/measured quantities for **each component including the needle‑movers** (oils/butter, cheese, sauces/dressings, nuts, avocado, tortillas, condiments — often 100–300 kcal). Show the resulting macros per plate. For multiple eaters, give each person's portion sized to their targets (kids' portions age‑appropriate). Add extra carbs as specified add‑ons, never vague "more carbs." 7. Build the **consolidated shopping list** with quantities + estimated cost; amortize bulk buys; treat budget as a soft multi‑week average; scale to home‑cooked meals only.

## The adjust loop — dual‑trend body‑fat tracker (for anyone with a body‑comp goal)

Goal and bands live in `profiles.md`. The decision signal is the **body‑fat trend**, not raw weight.

- **14‑day rolling average = the goal benchmark + stability anchor.** "Have I hit target?" is answered only by the 14‑day average reaching it.
- **7‑day average + slope = the throttle** that sets the pace, so the lagging 14‑day never artificially holds calories high.
- Above goal, 7‑day below 14‑day and falling → cut is working, **hold** the deficit (don't add). 7‑day flat/rising for ~7–10 days while above goal → small deficit nudge (per `profiles.md`), on easy/rest days only. Losing faster than the weekly weight cap → **shrink** the deficit, protect lean mass.
- Approaching goal → ease toward maintenance. At goal → maintenance + hold band. Below band or recovery trending low → calories up.
- Consumer body‑fat readings are noisy — trust averages; flag any single reading >~1.5 pts off the 7‑day as likely noise.

**Guardrails that override the trend math:** never let the lagging 14‑day keep calories artificially high when the 7‑day shows progress; never chase the fast 7‑day into an aggressive deficit (the weekly weight cap limits pace).

## Energy‑availability floor (absolute, for training people)

Never let **(intake − exercise energy)** fall below the floor in `profiles.md` (a common floor is ~30 kcal/kg fat‑free mass). Always cover today's training carbs in full. **No deficit the day before or day of a key session/race** (carb‑up instead). If recovery craters or weight drops faster than the cap, pause the deficit regardless of body‑fat.

## Learning loop (gets smarter every week)

After each plan, capture what was actually eaten, liked/disliked, repeated, or skipped → update `meal-library.md` (add dishes, tag favorites, note "make again" vs "miss"). Never re‑suggest a "miss"; lean toward favorites. Fold emerging preferences and seasonal shifts into `how-we-eat.md` / `meal-library.md`. Keep edits small and cumulative.

## Calibration layer

Monthly (or on a big weight/fitness change), compare projected burn vs actual whole‑day calories, and projected vs actual body‑comp change, then nudge the kcal/TSS factor and resting baseline in `profiles.md`. Over ~8–12 weeks of clean logs this converges on each person's real response curve. See `calibration-log.md`.

## Hard rules

- **Performance first** — never under‑fuel training to chase fat loss.
- **Energy‑availability floor is absolute.**
- **Allergies are absolute.**
- **No deficits for children**, ever.
- **One decision signal:** the body‑fat trend; weight is only a guardrail.
- When data is thin, prefer maintenance over a deficit.
