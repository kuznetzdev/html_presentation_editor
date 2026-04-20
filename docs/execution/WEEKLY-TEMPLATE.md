# Weekly Tracker — YYYY-wNN

> Copy this file to `WEEKLY-YYYY-wNN.md` every Sunday. Fill in 30 minutes.

---

```
week: YYYY-wNN
dates: YYYY-MM-DD to YYYY-MM-DD
quarter: Q<n> YYYY

## Track-1 status
target_wos_this_week: N
actual_wos_merged: M
wos_merged: [WO-NN title, ...]
blockers: <none | list>
velocity_ratio: M/N
cumulative_wos_this_quarter: X
cumulative_planned_this_quarter: Y
on_track: YES / SLIPPING / PAUSE

## Velocity forecast
at_current_rate_v1_ga: YYYY-MM-DD
vs_plan_2027-03-23: <+N weeks ahead | -N weeks behind>
kill_signal_triggered: YES / NO
  if YES: see KILL-SWITCH-CONDITIONS.md §SS-02

## Track-2 status
hours_spent_this_week: N (max 4)
interviews_this_week: N (name/handle if consented)
competitor_digest_filed: YES / NO
track2_hours_ok: YES / NO (flag if > 5h)

## Next week targets
wos_planned: [WO-NN, ...]
interviews_scheduled: YES / NO / NA (none in pipeline)
notes: <any context that will help next week's review>

## Micro-win
<one sentence: what shipped or unblocked this week — even tiny wins count>
```

---

## How to use

1. Copy this file: `cp WEEKLY-TEMPLATE.md WEEKLY-YYYY-wNN.md`
2. Fill in ALL fields (blanks = decision not made, which is also information)
3. If `kill_signal_triggered: YES` → stop WO execution, read KILL-SWITCH-CONDITIONS.md

The micro-win field is non-optional. 2 years of work without celebration produces burnout.
Even "WO-01 agent prompt launched" counts.
