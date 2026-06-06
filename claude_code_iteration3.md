# Teppanyaki Tonight — Iteration 3 Fixes

Targeted fixes only. Read the existing code before editing anything. Do not rebuild components from scratch unless the fix genuinely requires it.

---

## 1. Event log — switch back to vertical, but well-designed

The horizontal event log is breaking the page layout by expanding the window width. The horizontal approach is fundamentally hard to constrain correctly in a flex layout. Switch back to a **vertical scrolling log** but make it well-designed so it doesn't look like a plain list.

### Design spec for the new vertical log

- Fixed height container: `height: 180px`, `overflow-y: auto`, `overflow-x: hidden`, `width: 100%`
- Each row is a single horizontal line (not a tall card): timestamp on the left, icon in the middle, description on the right
- Row height: ~28px, so about 6–7 events visible at once
- Newest events appear at the **bottom**; auto-scroll to bottom as events are added
- Colour-coded left border (3px) per event type: blue = ENTER_BAR, green = SEAT_DINING, red = BALK/RENEGE, muted = DEPART
- Monospaced timestamp (`IBM Plex Mono`), regular text for description
- Subtle alternating row background for readability

Example row layout:
```
[7:14 PM]  →  Batch of 7 seated at table 5
[7:16 PM]  ✗  Party of 3 gave up after 31 min
```

This gives a clean, readable log without any layout breakage. Remove the horizontal scroll implementation entirely.

---

## 2. Prepare tab — update floor diagram to use U-shaped tables

The static floor diagram on the Prepare tab still shows the old rectangular table design. Update it to match the new U-shaped teppanyaki table design introduced in iteration 2. Show a small grid of U-shaped table outlines (no need for live seat states — just the shape) so the Prepare tab matches the actual animation.

---

## 3. Tab switching loses config state — lift state up

When a student switches away from a challenge tab and comes back, all their saved configs are gone. This is because config state lives inside each challenge component and React discards it on unmount.

**Fix:** Lift the per-challenge config and results state up to `ChallengesTab` (or `appContext`), keyed by challenge key. Each challenge component receives its state as props and calls a setter rather than owning local state.

Specifically:
- In `ChallengesTab.tsx`, maintain a `challengeState` map: `Record<string, ChallengeLocalState>` where `ChallengeLocalState` holds the list of saved configs and their results
- Pass the relevant slice down to each challenge via `ChallengeShell`
- `ChallengeShell` uses the passed state instead of `useState` for configs/results
- When the student switches tabs and comes back, their configs and results are restored exactly as they left them

This does NOT need to persist to Firestore — in-memory per session is fine. It just needs to survive React unmount/remount cycles within the same session.

```typescript
interface ChallengeLocalState {
  configs: SimConfig[];
  results: (ChallengeResult | null)[];
  selectedConfigIndex: number;
  selectedRunIndex: number;
  reflectionText: string;
  submitted: boolean;
}
```

---

## 4. Advanced Batching engine bug — four_share doubling all tables

**The bug:** When `four_share` is selected for any period (e.g. peak only), the engine doubles the total table count for the **entire evening**, not just during that period. This causes:
- The floor animation to show 30 tables instead of 15
- Very low chef utilisation (9%) because the doubled table pool is mostly empty
- Negative average profit

**Root cause:** The current code likely initialises `effectiveTables = config.tables * 2` when any period uses `four_share`. Instead, `four_share` should only apply its 4-capacity seating rule **at the moment a table becomes free during that period**.

**Fix:** Refactor the table model so `four_share` is handled per-seating-event, not at initialisation:

- Always initialise `tables` with `config.tables` entries (never doubled)
- Each table has **two independent slots**: `slot0OccupiedUntil` and `slot1OccupiedUntil` (both start at `openTime`)
- At seat time, check `getModeAtTime()` for the current period:
  - If mode is NOT `four_share`: treat the table as one unit. A table is free when `slot0OccupiedUntil <= now`. Use the full 8-seat capacity. Set `slot0OccupiedUntil = departTime`.
  - If mode IS `four_share`: treat each slot independently. A table has a free slot when either `slot0OccupiedUntil <= now` OR `slot1OccupiedUntil <= now`. Seat up to 4 people per slot. Set the relevant slot's `occupiedUntil = departTime`.
- The floor animation should show the actual table count (always `config.tables`, max 15), with `four_share` tables visually split into two halves when that mode is active

This also means `emptyChairHours` calculation needs to use the slot capacity (4) when `four_share`, not 8.

The chef utilisation calculation should use seat-based occupancy as before, just with correct per-slot capacity.

---

## 5. Final Challenge — wide config panel layout

The Final Challenge config panel is extremely long because it stacks all options vertically in a narrow right-side panel. Redesign it to use the full page width with a multi-column grid layout.

**Layout change for Final Challenge only:**

Remove the right-side narrow panel pattern used by other challenges. Instead, use a full-width config area **above** the Simulate button, arranged in a 3-column grid:

```
┌─────────────────┬─────────────────┬─────────────────┐
│   BATCHING      │   BAR & TIMING  │   ADVERTISING   │
│                 │                 │                  │
│ Open→7pm: [  ] │ Bar seats: [  ] │ Budget: [slider]│
│ 7→8pm:    [  ] │ Tables: [auto]  │ Campaign: [  ]  │
│ 8→close:  [  ] │                 │ Opening: [  ]   │
│                 │ Dining times:   │                  │
│                 │ Early: [slider] │                  │
│                 │ Peak:  [slider] │                  │
│                 │ Late:  [slider] │                  │
└─────────────────┴─────────────────┴─────────────────┘

        [ ▶ Simulate 20 Nights ]
```

- Each column has a section header
- Batching column: 3 period selectors (radio groups), same 4 options each
- Bar & Timing column: bar seats slider + auto-derived tables display + 3 dining time sliders
- Advertising column: budget slider + campaign radio + opening time radio
- The Simulate button is full-width below the grid
- Saved configs appear above the grid as compact "Config 1 / Config 2 / + Add" tabs
- Results appear below the Simulate button as normal

This applies to the Final Challenge component only. All other challenges keep their existing right-panel layout.

---

## 6. Advanced Batching — visual fix for four_share in animation

When `four_share` mode is active for any period, the floor animation currently shows 30 tables. After the engine fix in #4, it will correctly show 15 tables. Additionally, when a table is in `four_share` mode and has both slots occupied, show the table visually split into two halves with a dividing line down the middle — left 4 seats and right 4 seats as two independent groups. When only one slot is occupied, show that half filled and the other half empty.

This is a visual enhancement only and should follow naturally from the engine fix. If it adds significant complexity, just ensure the table count is correct (15, not 30) and skip the split-visual for now.

---

## Firebase test credentials

When testing any Firebase-related features (admin login, settings save, reset, param overrides), use these credentials — they correspond to a real class document in the connected Firebase project:

- **Class code:** `test1`
- **Instructor PIN:** `1234`

Do not use `OPS101` or any other class code — that document does not exist. If any existing code or test scripts reference `OPS101`, replace those references with `test1`.

---

## Summary of files to touch

- `src/components/animation/EventLog.tsx` — rewrite as vertical log (#1)
- `src/components/tabs/PrepareTab.tsx` — update static floor diagram to U-shapes (#2)
- `src/components/tabs/ChallengesTab.tsx` — add `challengeState` map (#3)
- `src/components/challenges/ChallengeShell.tsx` — accept state as props instead of owning it (#3)
- `src/engine/simulation.ts` — fix four_share slot model (#4)
- `src/engine/types.ts` — update TableState to include slot0/slot1 (#4)
- `src/components/challenges/FinalChallenge.tsx` — wide config panel layout (#5)
- `src/components/animation/FloorView.tsx` — four_share visual fix (#6)

Do not change seeds, challenge definitions, Firebase schema, or any behaviour not listed above.
