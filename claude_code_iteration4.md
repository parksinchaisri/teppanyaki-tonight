# Teppanyaki Tonight — Iteration 4 Fixes

Three targeted changes. Read existing code before editing. Test credentials: class code `test1`, PIN `1234`.

---

## 1. Persist timeline scrubber position across tab switches

Currently when a student moves the animation playhead to e.g. 7:20 PM, switches to another tab, and comes back, the scrubber resets to 6:00 PM.

**Fix:** Add `animationTime: Record<string, number>` to `appContext` (keyed by challenge key, value = current playback time in minutes from midnight). When the scrubber moves, write to this map. When the animation mounts, initialise from this map instead of defaulting to `openTime`.

This is a small addition alongside the existing `challengeStates` map — same pattern, different key.

---

## 2. Bar seats slider — snap to discrete steps, fix the rounding bug

**The bug:** The current continuous slider has a rounding ambiguity — dragging back down from 32 to 28 shows 17 tables instead of 18, because `Math.floor((28-15)/8) = 1` but the slider's stored float value is slightly above the breakpoint.

**The fix and pedagogy improvement:** Make the bar seats slider snap to exactly 10 discrete values — one per valid table count. The valid pairs are:

| Bar seats | Dining tables |
|-----------|---------------|
| 15 | 19 |
| 23 | 18 |
| 31 | 17 |
| 39 | 16 |
| 47 | 15 |
| 55 | 14 |
| 63 | 13 |
| 71 | 12 |
| 79 | 11 |
| 87 | 10 |

Implementation: replace the continuous `min=15 max=87` slider with a discrete slider that has `step=8, min=15, max=87`. This snaps to exactly these 10 values and eliminates the rounding bug entirely.

Display both values clearly next to each other: `"47 bar seats  ↔  15 dining tables"` so the trade-off is visible in one line.

This change applies to the Bar Size challenge slider AND the Final Challenge bar seats slider (both should use the same discrete steps).

Remove the "(auto)" label on the dining tables display — just show the number directly.

---

## 3. Final Challenge config panel — compact layout, max 35% page height

The current 3-column layout is still too tall. The main culprit is the Batching column — it has 3 × 4 = 12 stacked radio items. Redesign the config panel so the entire thing fits in approximately 35% of the viewport height (roughly 280–320px on a typical laptop screen).

### Batching — replace stacked radios with a compact matrix table

Turn the 3 period × 4 option grid into a proper HTML table:

```
               No Batch   4–8   8   4-Share
Open → 7 PM      ○        ○     ●     ○
7 PM → 8 PM      ○        ○     ●     ○
8 PM → close     ○        ●     ○     ○
```

- Column headers: short labels ("No Batch", "4–8", "8", "4-Share")
- Row labels: "Open→7", "Peak", "Late" (very short)
- Each cell contains a single radio button (no text, no description — the column header provides it)
- This collapses 12 radio items into a ~80px tall table
- Clicking anywhere in a cell selects that radio

### Bar & Timing — single compact column

Stack these tightly with minimal vertical spacing:
- Bar seats: one line — label left, `"47 seats ↔ 15 tables"` right, slider below (same discrete steps as #2)
- Dining time early/peak/late: three compact rows, each showing `"Early  ──●──  60 min"` inline (label + slider + value all on one line, slider ~120px wide)
- Total height for this section: ~150px

### Advertising — single compact column

Same compact treatment:
- Budget: one line — `"Budget  ──●──  1.0×"` inline
- Campaign: 4 small pill-style toggle buttons in one row (None / Awareness / Discount / Happy Hour) — not a 2×2 grid
- Opening time: 3 small pill-style buttons in one row (5 PM / 6 PM / 7 PM)
- Total height: ~100px

### Overall Final Challenge layout

```
┌────────────────────────────────────────────────────────────┐
│ [Config 1] [Config 2] [+ Add Config]    (compact tab bar)  │
├──────────────────┬──────────────┬───────────────────────────┤
│ BATCHING MATRIX  │ BAR & TIMING │ ADVERTISING               │
│ (table, ~80px)   │ (~150px)     │ (~100px)                  │
└──────────────────┴──────────────┴───────────────────────────┘
        [ ▶ Simulate 20 Nights ]   (full width button)
─────────────────── results below ────────────────────────────
```

Target: the entire config section (3 columns + simulate button) should be no taller than ~320px. Results (animation, charts, outcomes) fill the rest of the page below.

### Do not change other challenges

Only `FinalChallenge.tsx` gets this treatment. All other challenges keep their existing right-panel layout.

---

## Summary of files to touch

- `src/store/appContext.tsx` — add `animationTime` map (#1)
- `src/components/animation/AnimationPanel.tsx` or `TimelineScrubber.tsx` — read/write `animationTime` from context (#1)
- `src/components/challenges/BarSize.tsx` — discrete slider (#2)
- `src/components/challenges/FinalChallenge.tsx` — compact layout with batching matrix and discrete slider (#2, #3)
- Any shared `Slider` component if bar seats slider logic is centralised (#2)

Do not change the engine, seeds, Firebase schema, or any other challenge components.
