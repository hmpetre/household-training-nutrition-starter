# Calibration Log — the feedback loop with reality

Where the system checks its predictions against what actually happened and tunes itself. Only relevant for a training person with a burn model. Run monthly, or when weight/fitness shifts.

## How to recalibrate

### A. Burn model (kcal vs TSS)
1. Pull completed rides/workouts for the window → TSS per day.
2. Pull whole‑day calories for the same days (WHOOP `whoop_cycle` → kilojoule ÷ 4.184).
3. Match by day; non‑training days (TSS ≈ 0) anchor the resting baseline.
4. Fit `kcal_day = intercept + slope × TSS`. **Fix the intercept at the true rest‑day baseline first, then derive the slope** (a free intercept absorbs ride energy and biases the slope low). Cross‑check against physiology.
5. Write the new baseline + kcal/TSS into `profiles.md`.
6. Log the run below with R² and sample size. Trust the fit at R² > ~0.7 and n ≥ 10.

### B. Fat‑loss response (did the deficit do what we predicted?)
1. Each ~4 weeks: planned weekly deficit → predicted loss (deficit × 7 ÷ ~7700 kcal/kg).
2. Compare to the actual change in the **14‑day BF average + weight trend** from the tracker.
3. Actual < predicted → real burn lower or intake crept up; nudge. Actual > predicted (or recovery/power dropping) → ease up.

## Log

### [YYYY‑MM‑DD] — Baseline calibration
- Data: [n workouts, TSS range] + whole‑day kcal.
- **MODEL: kcal_day ≈ [baseline] + [slope] × TSS.**
- Method note: [fixed‑intercept vs free‑intercept; physiology cross‑check].
- Resting baseline: ~[ ] kcal (rest‑day range [ ]–[ ]).
- Action: wrote the model into `profiles.md`. Recalibrate monthly.
- Fat‑loss response: [not yet — need ≥4 weeks of tracker data].
