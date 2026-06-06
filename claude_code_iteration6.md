# Teppanyaki Tonight — Iteration 6

Five changes. Read existing code before editing. Test credentials: class code `test1`, PIN `1234`.

---

## 1. Bar seats slider — continuous range with correct table formula

The slider currently snaps to 10 discrete steps of 8. Replace it with a **continuous slider** from 15 to 87 (step 1), but use the correct non-uniform mapping to derive dining tables:

```typescript
function barSeatsToTables(barSeats: number): number {
  if (barSeats <= 15) return 19;
  return 18 - Math.floor((barSeats - 16) / 8);
  // Results: 15→19, 16-23→18, 24-31→17, 32-39→16,
  //          40-47→15, 48-55→14, 56-63→13, 64-71→12,
  //          72-79→11, 80-87→10
}
```

The first step is intentionally asymmetric (just 1 seat removes a table), then bands of 8 after that. This is more interesting pedagogically — students discover the nonlinearity.

Display the derived table count in real-time next to the slider as the student drags: `"40 bar seats → 15 dining tables"`.

Apply this formula everywhere bar seats appear: Bar Size challenge, Final Challenge.

---

## 2. Collapsible 20-run outcomes table

The 20-run table currently takes significant vertical space. Make it collapsible:

- Default state: **collapsed**, showing only the summary row (Avg / Best / Worst as three stat badges inline)
- A "Show all 20 runs ▼" toggle button expands it to show the full table
- When expanded, a "Hide ▲" button collapses it again
- The summary badges (Avg profit, Best night, Worst night) are always visible even when collapsed
- This applies everywhere `OutcomesTable` renders

---

## 3. Admin: strict batching toggle

Add a new toggle to the admin Settings tab:

**"Strict table-of-8 only (no partial seatings)"**
- Description: "When on, tables only seat when exactly 8 guests are ready. When off, tables can seat 6–8 (more flexible, allows partial fills)."
- Default: **on** (strict mode — matches HBS behavior)
- Stored as `strictBatching: boolean` in the `settings` map on the Firestore class document

**Engine change:** In `simulation.ts`, when `strictBatching` is true, the time-pressure override for the `eight` batching mode is disabled. Currently the engine seats whatever is available when the oldest party has waited longer than `PATIENCE_MEAN`. With `strictBatching: true`, this override is removed — the engine will only seat a full 8. Students will see more reneging as a result, which is the intended tension.

Pass `strictBatching` through the same param-override path already established (Firestore → `classSettings.ts` → `appContext` → `runChallenge()`).

---

## 4. Bar visual redesign — cocktail tables + bar counter

Replace the current grid of uniform seat circles with a realistic bar layout:

### Layout components

**Cocktail tables:** Round tables, each seating 4. Rendered as a center circle (the table surface, ~24px) with 4 smaller seat circles (~14px) at N/E/S/W positions. Number of cocktail tables = `Math.floor((barSeats - 7) / 4)` (reserve 7 for the bar counter).

**Bar counter strip:** A rectangular strip along the bottom edge of the bar panel representing the physical bar. Seats = `barSeats - (cocktailTables × 4)`, minimum 7. Rendered as a thin horizontal rectangle (the counter surface) with evenly spaced seat circles sitting above it in a single row.

### Seat fill logic
When the bar has N occupied customers, fill seats greedily: fill cocktail tables first (all 4 seats at a table before starting the next), then overflow to the bar counter. A full cocktail table renders all 4 seat circles in `--color-accent` (blue). A partial table shows filled seats in blue, empty in dark outline.

### Layout arrangement
Arrange cocktail tables in rows of 3 or 4 per row (whichever fits), bar counter strip along the bottom. The overall bar panel should feel like a real lounge — scattered round tables, a bar to order at.

### Example for 40 bar seats
`Math.floor((40-7)/4) = 8` cocktail tables (32 seats) + 8 bar counter seats = 40 total. Show 8 round tables in 2–3 rows, bar strip at bottom with 8 stools.

---

## 5. Chef between two tables — pair the dining room tables visually

In real teppanyaki, one chef stands at the grill between two U-shaped table halves, cooking for both parties simultaneously. Reflect this in the floor animation.

### Visual change
Pair dining tables: (T1, T2), (T3, T4), … Render each pair as a unit with the two U-shapes facing each other and a single chef icon **between** them (in the gap between the two tables). The gap between paired tables should be slightly smaller than the gap between pairs, making the pairing visually clear.

```
  T1        T2
[○○○□○○○] [○○○□○○○]
           👨‍🍳
```

The chef icon is centered in the gap between the two tables in the pair. When both tables are empty, the chef icon is dim/absent. When either table is occupied, the chef icon is visible (the chef is actively cooking).

### No engine change required
This is a visual layout change only. The engine already seats tables independently. The pairing is purely presentational — `(T1, T2)`, `(T3, T4)` etc. based on table index order. If there is an odd number of tables (e.g. 15), the last table stands alone without a pair.

### Grid adjustment
With tables paired, arrange the dining room as a grid of **pairs** rather than individual tables. Each pair unit takes roughly the width of two tables side by side. For 15 tables: 7 pairs + 1 solo.

---

## Summary of files to touch

- `src/components/challenges/BarSize.tsx` — continuous slider + new formula (#1)
- `src/components/challenges/FinalChallenge.tsx` — continuous slider + new formula (#1)
- `src/engine/simulation.ts` — `barSeatsToTables()` function, `strictBatching` param (#1, #3)
- `src/components/results/OutcomesTable.tsx` — collapsible with summary badges (#2)
- `src/admin/SettingsTab.tsx` — strict batching toggle (#3)
- `src/firebase/classSettings.ts` — include `strictBatching` in settings (#3)
- `src/store/appContext.tsx` — expose `strictBatching` (#3)
- `src/components/animation/FloorView.tsx` — bar redesign + paired table layout (#4, #5)

Do not change seeds, challenge descriptions, Firebase schema beyond adding `strictBatching`, or any challenge other than Bar Size and Final Challenge sliders.
