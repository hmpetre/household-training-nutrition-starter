# Meal Planner

The brain of the kit. It fuels training first, moves body composition slowly and safely toward each person's goal, and keeps grocery spend near a soft budget. It runs on two rhythms — a **Sunday** weekly plan + shopping list, and quick **daily** macro tweaks.

It works for **any household**: one person, a couple, or a family with kids. Not everyone needs a goal or macros — a child's profile can simply say "growing kid, feed well, no cutting," and the planner will just cook good food for them.

## The pieces

- **`SKILL.md`** — the engine. This is the logic Claude follows. You generally don't edit it; it reads its numbers from your profile files.
- **`templates/`** — the files that make it *yours*. Copy these into a private working folder and fill them in (Claude can interview you and do the filling):

  | File | What it holds | How often you touch it |
  |------|---------------|------------------------|
  | `profiles.md` | Each person: stats, goal, macro parameters (or "no goal") | Set once, tweak as you learn |
  | `restrictions-allergies.md` | Allergies (hard blocks) + medical/dietary needs | Set once — the **safety** file |
  | `how-we-eat.md` | Cooking style, equipment, eat‑out rhythm, shopping, budget | Set once |
  | `meal-library.md` | Meals you love, tagged with macros/cost | Grows over time |
  | `week-input.md` | This week's travel, overrides, body‑fat entry | Weekly / as needed |
  | `bf-tracker.md` | Weight + body‑fat log and trends (per person with a goal) | Auto‑filled each run |
  | `calibration-log.md` | The feedback loop that tunes the burn model | Monthly |

- **`examples/`** — filled‑in samples so you can see what "good" looks like: a single person, and a family with kids.

## How to set it up

```
mkdir -p ~/household-planner/my-plan
cp -R templates/ ~/household-planner/my-plan/
```

Then tell Claude: **"help me fill in my household meal‑planner files"** — it'll ask you the right questions and write your answers in. When you're ready: **"make this week's meal plan."**

> Keep your filled‑in files **out of the public repo** (they're personal). The `.gitignore` already ignores a `my-plan/` folder for exactly this reason.

## The safety stance

This is a lifestyle planner, not a diet or medical tool. It's built to be **performance‑first and cautious**: it never under‑fuels training to chase fat loss, it enforces an energy‑availability floor, and it treats allergies as absolute. It does not put children on deficits. If anyone has a medical condition or a history of disordered eating, involve a professional and keep the tool conservative.
