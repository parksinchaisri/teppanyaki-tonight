# Teppanyaki Tonight — Iteration 9

Four parts, ordered by priority. Part A is bug fixes (do first — low risk, high value). Parts B–D are larger design work. Test credentials: class code `test1`, PIN `1234`.

Work through parts in order. Run `tsc` after each part, not just at the end — this iteration touches login, progression logic, two leaderboard surfaces, and Challenge 1's core interaction.

---

## Part A — Bug fixes (do first)

### A1. Case-insensitive class code entry everywhere

Every text input that accepts a class code (student `JoinScreen`, the shared admin PIN gate used by both `AdminApp` and `TheaterMode`, and anywhere else one exists) must auto-uppercase as the student types, matching the existing behavior already present in the "Create New Class" form. Add `style={{ textTransform: 'uppercase' }}` or an `onChange` handler that uppercases the value, consistently across all such inputs.

**Also defensively normalize before every Firestore lookup** — call `.toUpperCase().trim()` on the class code value immediately before any `getDoc`/`setDoc` call that uses it as a path segment, regardless of what the input displays. This guards against any input that doesn't get the visual treatment.

### A2. Reflection gates progress

New setting: `reflectionGatesProgress: boolean`, default `false`, toggle in Session Control (near the other per-challenge settings).

When `true`: a student cannot switch into the *next* challenge in playlist order if the current one required a reflection (`reflectionsRequiredByChallenge[current] ?? reflectionsRequired`) and they haven't submitted one yet — regardless of whether the instructor has already unlocked the next challenge or `liveSessionMode` is on or off. Applies uniformly in both self-paced and live mode.

Show the gated tab in a distinct locked state (different from "waiting for instructor" or "submit the previous one") with the message: **"Finish your reflection for {Challenge Name} to continue."** Clicking it does not navigate; it can optionally jump the student back to the current challenge's reflection field.

### A3. Auto-end timer when everyone has submitted (Kahoot-style)

During `timed_round`, subscribe to the current challenge's submission count alongside the roster count (same denominators already used for the progress display). The moment `submittedCount >= joinedCount` (using the live roster size at that moment), automatically trigger the exact same round-close logic as clicking "End Round Now" — no need to wait for the timer or an instructor click. Show a brief transition banner in Theater Mode: **"Everyone's in — closing the round!"** for ~2 seconds before moving to `round_results`.

### A4. Lock Simulate until the timer actually starts

During `briefing` phase, the challenge is unlocked (per Iteration 8, this already happens automatically) and visible, but the Simulate button should be disabled with the message: **"Get ready — your instructor will start the timer shortly."** It becomes enabled the moment `phase` flips to `timed_round`. This prevents students from starting to fiddle with configs before the instructor has finished explaining the round (see Part D's briefing-preview feature, which is what fills this waiting time productively).

---

## Part B — Admin visibility

### B1. Roster / activity panel ("who's here, who's behind, who might be stuck")

Add a panel — either its own new admin tab **"Roster"**, or a prominent section within Session Control (your call on placement, but it needs to be visible without opening Theater Mode) — listing every joined student with:

- Display name
- Joined-at time
- For the *current* live-session challenge (if `liveSessionMode` is on): has-attempted (✓/—), has-submitted (✓/—)
- Last activity timestamp — the most recent `timestamp` among that student's rows in `attempts`, across any challenge
- A visual flag (amber/red row tint) for students who joined more than a few minutes ago but have zero attempts logged for the current challenge — a rough "may need a nudge" signal, not a notification system, just a glance-able highlight

Sort options: alphabetical, most-recent-activity-first, or not-yet-submitted-first (to surface stragglers quickly during a live round).

This panel should work identically whether `liveSessionMode` is on or off — for self-paced/homework classes it's still useful to see who's joined and how recently active they were, just without the "current challenge" columns.

### B2. Cross-class Game Manager

New route, `/admin/manager`, reachable via a link on the existing admin PIN-gate screen ("Manage all classes"). This page does **not** require a specific class's PIN to view the list — it lists every document in the top-level `classes` collection (code, `createdAt`, and a roster count via a quick read of the `students` subcollection size) since that collection is already publicly readable per the existing rules.

Per-class row, two actions:

- **"Export All Data"** — triggers all three existing CSV downloads for that class (results, attempts, reflections) in sequence. Mark that class as "exported" in local component state (a `Set<string>` of class codes exported this session — no need to persist this anywhere).
- **"Delete Class"** — disabled and grayed out until that class code appears in the "exported this session" set. Once enabled, clicking it prompts for that specific class's instructor PIN (reusing the existing per-class PIN security model — no new global secret), then a second confirmation requiring the instructor to type the class code exactly to confirm. On confirmation, delete the class: batch-delete every document in `studentResults`, `reflections`, `attempts`, `students`, and the `live/state` doc, then delete the class document itself last.

This reuses the batch-delete pattern already built for "Reset Class Data," just extended to cover `attempts` and `live/state` (which the existing reset intentionally leaves alone) and the class document itself.

---

## Part C — Challenge 1 redesign

Batching has exactly two possible configurations and both are fully deterministic (same 20 seeds every time). Repeatedly clicking Simulate on an unchanged choice can only ever return the same number, which is confusing given every other challenge rewards re-simulating after a change.

**Redesign `Batching.tsx`:** replace the single-choice-then-Simulate flow with an automatic side-by-side comparison. On loading the challenge (or via one "Compare Both Policies" button, your call on which feels better — a button is probably safer so it doesn't fire before the student has read the challenge description), run **both** configs at once and display their full results side by side — same `OutcomesTable`/`ProfitHistogram`/`DualCharts`/`FloorView` components already used elsewhere, just duplicated into two columns or a toggle between two fully-computed results rather than one at a time.

The student's actual decision becomes: **which policy do you submit to the leaderboard** — a clear pick between two already-visible, fully-realized outcomes, rather than a guess-and-check loop that can only ever confirm what they already saw. The reflection question is unchanged; it's now answerable with concrete numbers already on screen from both policies.

If `liveSessionMode` attempt limits apply to this challenge, interpret "attempt" here as *loading the comparison* (i.e., running the compare action counts as one attempt total, not two), since both configs come from a single action.

---

## Part D — Live Board & Theater ranking overhaul

### D1. Move Live Board controls into the Live Board tab

Currently, which challenge to display and its reveal state live in Settings. Move these controls directly into the existing (non-Theater) admin **Live Board** tab: a challenge selector and a reveal toggle, both local to that tab. Settings retains only the one-time class-configuration toggles (playlist, attempt limits, per-challenge reflection/confidence toggles, `liveSessionMode`, `reflectionGatesProgress`). Add a Round/Cumulative toggle to Live Board as well, matching Theater Mode's `roundView`.

### D2. Cumulative view = one bar per student

Replace whatever currently renders for "all challenges" / cumulative view (in both Live Board and Theater Mode's `round_results` cumulative toggle) with a proper bar chart: one horizontal or vertical bar per student, sorted descending by total cumulative profit, bar length proportional to score, name and value labeled directly. Do not dump every individual per-challenge row — the cumulative view's whole purpose is a single clean "where does everyone stand overall" read.

### D3. Theater Mode ranking — scrollable, visual, and alive

This is the core "make it fun" ask, scoped for a 38-person class:

- **Scrollable container**: fixed max-height (viewport minus header/controls), `overflow-y: auto`, so all students are reachable by scroll rather than shrunk to illegibility or cut off.
- **Bar visualization per row**: each leaderboard row shows a proportional horizontal bar alongside the name and number, for instant visual comparison — not just a plain numbered list.
- **Rank-change indicators**: compare each student's current rank (in whichever view — round or cumulative) against their rank from the *previous* round, show `▲3` / `▼1` / `—` next to their name. Requires storing each round's standings snapshot — see the data note below.
- **Cumulative delta**: in cumulative view, show the amount added this specific round next to the running total, e.g. `$4,261 total (+$1,939 this round)`.
- **"Biggest Climber" callout**: a small banner above the leaderboard highlighting whoever gained the most rank positions this round: `🚀 Biggest Climber: Paula (+5 spots)`.
- **Animated reordering**: when advancing rounds or toggling round/cumulative, rows should visibly slide to their new position rather than snapping instantly — implement with a CSS-transform FLIP technique (capture each row's position before the data changes, apply the position delta as a transform, then transition it to zero) keyed by `studentId`. Do not add a new animation library dependency for this — plain CSS transitions are sufficient at this scale.
- **Highlight #1 distinctly**: gold accent border/background on the top row, visually louder than the rest — this is the moment that should feel like a win.
- **Streaks**: track "rounds in the top 5" as a running counter. Store each closed round's top-5 student IDs in a small array on the live-session document: `roundHistory: Array<{ challengeKey: string, top5: string[] }>`, appended each time a round closes. Compute each student's current streak client-side as the number of consecutive trailing entries in `roundHistory` containing their ID. Show a small flame/streak badge next to students on a streak of 2+.

### D4. Briefing-phase config preview

On Theater Mode's `briefing` screen (before the timer starts), render a compact, non-interactive summary of that challenge's config options, sourced from the same challenge metadata already used elsewhere — e.g., for Bar Size: "Bar seats: 15–87 (continuous) ↔ Dining tables: 10–19 (auto)"; for Advanced Batching: "3 periods × 4 batching modes each." This gives the instructor something concrete on the projected screen to point at while explaining the round, filling the dead time created by Part A4's Simulate lock.

---

## Data model additions (summary)

```typescript
// ClassSettings additions
reflectionGatesProgress: boolean;   // default false

// LiveSessionState addition
roundHistory: Array<{ challengeKey: string; top5: string[] }>;  // default []
```

No other schema changes. Everything else in this iteration is UI/logic built on data that already exists.

---

## Summary of files likely touched

- `src/components/onboarding/JoinScreen.tsx`, `src/admin/AdminLogin.tsx` — uppercase inputs (A1)
- `src/firebase/*.ts` — defensive `.toUpperCase()` before class-code lookups (A1)
- `src/components/tabs/ChallengesTab.tsx` — reflection-gates-progress logic (A2)
- `src/firebase/liveSession.ts` / `liveLogic.ts` — auto-end-on-full-submission (A3), roundHistory tracking (D3)
- `src/components/challenges/ChallengeShell.tsx` — Simulate lock during briefing (A4)
- `src/admin/SessionControlTab.tsx` or new `src/admin/RosterTab.tsx` — roster/activity panel (B1)
- `src/admin/GameManager.tsx` (new) — cross-class list/export/delete (B2)
- `src/App.tsx` — `/admin/manager` route (B2)
- `src/components/challenges/Batching.tsx` — side-by-side compare redesign (Part C)
- `src/admin/LiveBoardTab.tsx` — local controls, bar-chart cumulative view (D1, D2)
- `src/admin/TheaterMode.tsx` — full ranking overhaul (D3), briefing preview (D4)

Do not change the engine, seeds, or calibration. Do not change the scoring metric itself (ranking stays `avgProfit`-based) — this iteration explicitly does not implement speed- or luck-based ranking; that was a deliberate design call, not an oversight.
