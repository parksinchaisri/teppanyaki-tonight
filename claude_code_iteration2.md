# Teppanyaki Tonight — Iteration 2 Changes

These are targeted fixes and improvements to the existing codebase. Do not rebuild from scratch. Read the existing code before changing anything.

---

## 1. Bug fix — Toggle switches

The toggle components render incorrectly in the OFF state (the circle appears on the right side regardless of state). Fix the toggle CSS so it behaves correctly:
- OFF state: circle on the LEFT, dark/gray background
- ON state: circle on the RIGHT, green background (`var(--color-accent-green)`)

Find the toggle component (likely `src/components/shared/Toggle.tsx` or similar) and fix the transform/translate logic. A correct implementation:

```tsx
<div
  onClick={onChange}
  className="relative inline-flex items-center w-12 h-6 rounded-full cursor-pointer transition-colors"
  style={{ backgroundColor: value ? 'var(--color-accent-green)' : 'var(--color-border)' }}
>
  <span
    className="inline-block w-5 h-5 bg-white rounded-full shadow transition-transform"
    style={{ transform: value ? 'translateX(1.5rem)' : 'translateX(0.125rem)' }}
  />
</div>
```

---

## 2. Admin — Change PIN

Add a "Change PIN" section at the bottom of the Settings tab. It should have:
- A password-type text input labelled "New PIN"
- A "Save PIN" button
- On save: write the new value to the `instructorPin` field on the class document in Firestore
- Show a brief confirmation message ("PIN updated") on success

---

## 3. Admin — Reset Class Data

Add a "Reset Class Data" button in the Settings tab (below Change PIN, styled in red/destructive style). Behaviour:
- Show a confirmation dialog: "This will delete all student results and reflections for class [classCode]. This cannot be undone. Continue?"
- On confirm: delete all documents in `classes/{classCode}/studentResults/` and `classes/{classCode}/reflections/` using Firestore batch deletes
- Do NOT delete the class document itself or its `settings` / `instructorPin` fields
- Show a confirmation message when complete

---

## 4. Admin — Per-Class Parameter Overrides

Add a collapsible "Economics & Calibration" section to the Settings tab. This lets the instructor override engine constants per class without affecting other classes.

### Firestore storage
Store overrides as a `params` map on the class document:
```
classes/{classCode}/
  params: {
    dinnerMargin: number       // default 12
    drinkMargin: number        // default 6
    fixedCostEvening: number   // default 3600
    patienceMean: number       // default 28
    defaultBarSeats: number    // default 40
    defaultTables: number      // default 15
  }
```

### Admin UI
Six numeric input fields with labels and defaults shown as placeholder text:

| Label | Field | Default | Unit |
|---|---|---|---|
| Dinner margin | `dinnerMargin` | 12 | $/cover |
| Drink margin | `drinkMargin` | 6 | $/drink |
| Fixed cost per evening | `fixedCostEvening` | 3600 | $ |
| Avg customer patience | `patienceMean` | 28 | minutes |
| Default bar seats | `defaultBarSeats` | 40 | seats |
| Default dining tables | `defaultTables` | 15 | tables |

Add a note: "Changes take effect for students on their next page load."

Save button writes the whole `params` map to Firestore in one update.

### Engine integration
In `src/firebase/classSettings.ts`, include `params` in the settings object returned to the student app. In `src/store/appContext.tsx`, store the params alongside settings. Pass them into `runChallenge()` / `runSimulation()` as overrides on top of `PARAMS`. In `src/engine/simulation.ts`, accept an optional `ParamOverrides` argument and merge it with the base `PARAMS` at the start of each run:

```typescript
const P = { ...PARAMS, ...overrides };
// use P.FIXED_COST_EVENING instead of PARAMS.FIXED_COST_EVENING etc.
```

Map the Firestore field names to the PARAMS constants:
- `dinnerMargin` → affects `DINNER_PRICE - DINNER_VAR_COST` (simplest: store as a margin and derive price/cost at engine entry)
- `drinkMargin` → affects `DRINK_PRICE - DRINK_VAR_COST`
- `fixedCostEvening` → `FIXED_COST_EVENING`
- `patienceMean` → `PATIENCE_MEAN`
- `defaultBarSeats` → default value for `barSeats` in all challenge configs
- `defaultTables` → default value for `tables` in all challenge configs

If `params` is absent from the Firestore document, use all PARAMS defaults as normal.

---

## 5. Floor animation — U-shaped teppanyaki tables

Replace the current rectangular table rendering with U-shaped teppanyaki grill tables. Each table seats 8: 3 seats on the left side, 2 seats across the top (the grill end), and 3 seats on the right side.

### Layout of one table unit (SVG or CSS)

```
    [1] [2]          ← top: 2 seats
  [8]       [3]      ← sides: 3 left, 3 right
  [7]  🍳   [4]
  [6]       [5]
```

The grill/table surface is a rounded rectangle in the centre. Seats are circles arranged around three sides. The chef icon sits inside the grill surface when the table is occupied.

### Seat rendering
- Each of the 8 seats is an individual circle
- Filled seats (up to `occupiedCount`): use `var(--color-accent-green)` fill
- Empty seats: dark outline only, no fill
- Fill seats from position 1 upward (left column top-to-bottom, then right column top-to-bottom, then top seats)
- This means at 5/8 you can see exactly which 5 seats are taken visually

### Table label
Show "T{n}" (e.g. "T1", "T2") in small muted text in the top-left corner of each table unit.

### Fraction label
Keep the "5/8" fraction as small secondary text below the chef icon, but it is now supplementary to the visual seat state.

### Sizing
Each table unit should be roughly 110×130px. Arrange in a grid (5 columns × 3 rows for 15 tables). The dining room panel should expand to fit.

---

## 6. Floor animation — Bar layout

The current bar packs all seats into two short rows at the top, leaving a large empty gap below. Fix the layout:

- Spread seats evenly across the full bar panel using a CSS grid or flex-wrap layout
- Seats should fill the panel naturally — if there are 40 seats, show 8 per row × 5 rows, or 10 per row × 4 rows, filling the available space
- Each seat is a circle (~18px). Occupied seats use `var(--color-accent)` (blue). Empty seats are dark outline.
- The panel should have no awkward empty space

---

## 7. Event log — horizontal scrolling timeline

Replace the vertical scrolling event log with a horizontal scrolling timeline matching the HBS style.

### Layout
- A horizontally scrolling strip of event cards
- Each card is approximately 130px wide × 80px tall
- Cards appear left to right in chronological order, newest card added to the right
- Auto-scroll to the rightmost card as new events appear during playback

### Card design
Each card contains:
- Top: timestamp in muted small text (e.g. "7:14 PM")
- Middle: a small directional icon indicating event type (arrow in for arrivals, arrow out for departures, seated icon for seatings)
- Bottom: short description in 2 lines max (e.g. "Batch of 7 / seated at table 5")

### Colour coding
- ENTER_BAR events: blue accent border
- SEAT_DINING events: green accent border  
- BALK / RENEGE events: red accent border
- DEPART events: muted/gray border

### Container
The horizontal strip sits in a fixed-height container (~100px) with `overflow-x: auto`, `overflow-y: hidden`, and `scroll-behavior: smooth`. Show a subtle fade on the right edge to indicate more cards exist.

---

## 8. Layout reorder — animation above results

Currently the floor animation appears below the charts and outcomes table, requiring significant scrolling. Move it above.

The new vertical order within the challenge results section should be:

1. **Config summary bar** (which config is being viewed, avg profit badge)
2. **Floor animation panel** (FloorView + TimelineScrubber + horizontal EventLog) ← MOVE THIS UP
3. **Utilisation meter** (if visible)
4. **Auto-debrief** (if visible)
5. **Profit histogram**
6. **Dual charts** (customers over time + items served)
7. **Outcomes table** (20 runs)
8. **Compare panel** (if active)
9. **Reflection textarea** (if required)
10. **Submit to Leaderboard button**

Make this change in `ChallengeShell.tsx` (or wherever the results layout is composed).

---

## Summary of files likely touched

- `src/components/shared/Toggle.tsx` (or wherever toggles are defined) — bug fix
- `src/admin/SettingsTab.tsx` — PIN change, reset, param overrides
- `src/firebase/classSettings.ts` — include params in settings fetch
- `src/store/appContext.tsx` — store and expose params
- `src/engine/simulation.ts` — accept and apply param overrides
- `src/components/animation/FloorView.tsx` — U-shaped tables, bar layout
- `src/components/animation/EventLog.tsx` — horizontal timeline
- `src/components/challenges/ChallengeShell.tsx` — layout reorder

Do not change the engine logic, seeds, challenge definitions, Firebase schema (beyond adding `params`), or any other behaviour not listed here.
