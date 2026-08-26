# Teppanyaki Tonight — Iteration 7: Live Session Mode

Adds instructor-paced live classroom play (Zoom, individual students) on top of the existing self-paced game. **Self-paced mode must continue working exactly as it does today with zero regressions** — this is an additive mode, not a replacement.

Test credentials: class code `test1`, PIN `1234`.

---

## Design decisions (already resolved — do not re-ask)

- A new top-level setting `liveSessionMode: boolean` (default `false`) switches between the existing auto-unlock-on-submit behavior (`false`) and full instructor-gated unlock (`true`).
- "Skip a challenge" and "choose which challenges are in the playlist" are the same mechanism: `activeChallenges: string[]`, a live-editable ordered list. Removing a challenge from this list at any time — before or during class — immediately hides it from students and treats it as satisfied for progression purposes.
- "Attempt" = each time a student runs a brand-new configuration through Simulate. Viewing/comparing/re-visiting an already-simulated config does not consume an attempt.
- Progress dashboard counts submissions to the leaderboard (`studentResults`), not raw attempts, matching the "32/44 submitted" framing.
- The instructor's leaderboard-reveal control is what naturally protects "first unaided decision" — no separate UI is needed for that; it falls out of leaderboard visibility being hidden by default in live mode.

---

## 1. Firestore schema additions

Extend the `settings` map on the class document:

```typescript
interface ClassSettings {
  // ...existing fields unchanged...

  liveSessionMode: boolean;                    // default false

  activeChallenges: string[];                  // ordered; default all 6 in original order
  // e.g. ['batching','barSize','diningTime','advancedBatching','finalChallenge']
  // Any challenge key omitted is hidden from ChallengesTab and treated as
  // automatically satisfied when checking whether finalChallenge can unlock.

  unlockedChallenges: string[];                // only meaningful when liveSessionMode=true
  // Subset of activeChallenges currently accessible to students right now.
  // Empty by default when liveSessionMode is turned on — instructor unlocks
  // challenges one at a time from the admin Session Control tab.

  finalChallengeLevers: {
    batching: boolean;      // default true
    barSize: boolean;       // default true
    diningTime: boolean;    // default true
    advertising: boolean;   // default true
  };
  // When a lever is false, that column is omitted entirely from the Final
  // Challenge config panel, and the engine uses the class's default value for
  // that parameter (not the student's choice) when simulating.

  maxAttempts: Record<string, number>;
  // Keyed by challenge key, including 'finalChallenge'. Default 20 for every
  // key (effectively unlimited for self-paced/homework use). Instructor sets
  // low numbers (1, 2, 3) for live class per challenge.

  leaderboardVisible: Record<string, boolean>;
  // Keyed by challenge key. Default true for every key (self-paced/homework
  // behavior unchanged). In live mode, instructor typically sets a challenge
  // to false when unlocking it, then flips to true after enough submissions.

  reflectionsRequiredByChallenge: Record<string, boolean>;
  // Keyed by challenge key. If a key is present, it overrides the existing
  // global `reflectionsRequired` for that specific challenge. If absent for
  // a given key, fall back to the global `reflectionsRequired` value.
  // This lets the instructor turn reflections off for live-class challenges
  // while keeping them on for homework challenges within the same class.

  confidenceRatingEnabled: Record<string, boolean>;
  // Keyed by challenge key. Default false for every key.
}
```

New top-level subcollection under each class document:

```
classes/{classCode}/attempts/{autoId}
  studentId: string           // stable anonymous UUID, same one used elsewhere
  displayName: string         // nickname shown on leaderboard at time of attempt
  challengeKey: string
  attemptNumber: number       // 1-indexed, per student per challenge
  isFirstAttempt: boolean     // true iff attemptNumber === 1
  config: string              // JSON.stringify(SimConfig)
  resultSummary: {
    avgProfit: number
    avgLost: number
    chefUtilisation: number
    bestNight: number
  }
  confidenceRating: number | null   // 1-5, or null if not collected
  timestamp: Timestamp
```

This is a full audit trail distinct from `studentResults` (which only ever stores each student's *best* result per challenge). Every simulate-and-submit action writes one row here. Nothing is ever overwritten or deleted from `attempts` by the existing "Reset Class Data" — treat `attempts` as permanent research/pedagogy data unless the instructor explicitly asks for a separate "wipe attempts log" action (do not build that; not requested).

---

## 2. Student-facing changes

### Challenge tab bar respects `activeChallenges`
`ChallengesTab` renders only the challenges present in `activeChallenges`, in that order. If `advertising` is omitted, its sub-tab does not appear at all.

### Progression logic under `liveSessionMode`
When `liveSessionMode: true`:
- A challenge is accessible only if it appears in `unlockedChallenges`. All others show a "Waiting for instructor" locked state (not the existing "submit the previous one" locked state).
- Submitting a challenge does **not** automatically unlock the next one. Only the instructor's admin action changes `unlockedChallenges`.
- Real-time: subscribe to the settings document so a newly-unlocked challenge appears within a second or two of the instructor unlocking it, without requiring a page refresh.

When `liveSessionMode: false`: existing auto-unlock-on-submit behavior, completely unchanged.

### Final Challenge unlock condition
The Final Challenge is considered reachable once every challenge in `activeChallenges` *other than* `finalChallenge` itself has been submitted (self-paced) or explicitly unlocked-and-submitted (live mode) — challenges not in `activeChallenges` at all don't block it. This preserves your "1 → 2 → 3 → 5 → 6" sequence: since `advertising` is simply absent from `activeChallenges`, its absence never blocks Final Challenge from unlocking.

### Final Challenge lever visibility
`FinalChallenge.tsx` reads `finalChallengeLevers` and omits the corresponding column/control entirely when `false`. If `advertising: false`, the Advertising column and Opening Time control do not render; the engine call uses the class's default advertising budget (0 or 1.0×, whichever the existing default is) and default opening time for every Final Challenge simulation.

### Attempt limits
Before allowing a new Simulate run in any challenge, check the student's attempt count for that challenge (query `attempts` where `studentId == me && challengeKey == X`, or maintain a local count synced from Firestore). If `attemptCount >= maxAttempts[challengeKey]`, disable the "Add Config" / "Simulate" action and show: `"Attempt limit reached (2/2) for this challenge."` Students can still view, compare, and submit from configs they've already run.

### Leaderboard visibility
The Leaderboard tab (and any in-challenge leaderboard preview, if one exists) checks `leaderboardVisible[challengeKey]`. When `false`, show: `"Your instructor will reveal results after everyone has submitted."` instead of the ranked list. This is what protects first-attempt independence — students literally cannot see classmates' results before the instructor reveals them.

### Reflection toggle per challenge
`ChallengeShell` checks `reflectionsRequiredByChallenge[challengeKey]` first; if that key is absent, fall back to the existing global `reflectionsRequired`. No other change to the reflection UI itself.

### Confidence rating (optional, per challenge)
When `confidenceRatingEnabled[challengeKey]` is true, show a simple 1–5 scale ("How confident are you that this strategy will perform well?") **immediately before** the Simulate button fires — i.e., clicking Simulate first opens a small inline prompt (5 numbered buttons or a slider) that must be answered before the simulation runs. Store the selected value and pass it through to the `attempts` write for that run. When disabled (default), Simulate behaves exactly as it does today with no added step.

### Every attempt writes to the `attempts` collection
Every time a student clicks Simulate to run a new config (not re-viewing a saved one), write a row to `classes/{classCode}/attempts/` with the full config, result summary, current attempt number for that student+challenge, `isFirstAttempt` flag, and confidence rating if collected. This is in addition to — not a replacement for — the existing `studentResults` write that happens on "Submit to Leaderboard."

---

## 3. Admin dashboard changes

Add a new admin tab: **Session Control** (alongside the existing Settings / Live Board / Results / Reflections tabs). This is the tab an instructor lives in during a live Zoom session.

### Session Control tab layout

**Top: Live Session Mode toggle.** A prominent on/off switch for `liveSessionMode`. Turning it on immediately switches all connected students into gated mode (they'll see "Waiting for instructor" on anything not yet unlocked).

**Playlist editor.** A reorderable/toggleable list of all 6 challenges, each with an on/off switch, editing `activeChallenges`. Changes apply immediately (live). A short label under this: *"Removing a challenge here hides it from students and skips it when checking whether the Final Challenge can unlock."*

**Per-challenge control row**, one row per challenge currently in `activeChallenges`, each showing:
- Challenge name
- **Unlock / Lock** toggle button → edits `unlockedChallenges` (only shown/relevant when Live Session Mode is on)
- **Progress: `{submittedCount} / {joinedStudentCount} submitted`** — live count via Firestore listener, comparing distinct `studentId`s in `studentResults` for that challenge key against total docs in the `students` subcollection
- **Max attempts** — small numeric input editing `maxAttempts[challengeKey]`
- **Reflection required** — toggle editing `reflectionsRequiredByChallenge[challengeKey]`
- **Confidence rating** — toggle editing `confidenceRatingEnabled[challengeKey]`
- **Leaderboard: Hidden / Reveal** — toggle button editing `leaderboardVisible[challengeKey]`. Label the button dynamically: shows "Reveal Leaderboard" when currently hidden, "Hide Leaderboard" when currently visible.

**Final Challenge lever row** (separate small section): four toggles — Batching / Bar & Timing / Dining Time / Advertising — editing `finalChallengeLevers`. Pre-populate sensible defaults when the instructor first enables Live Session Mode: default each lever to `true` if that challenge is in `activeChallenges`, `false` otherwise — but leave it fully editable afterward.

**Quick Compare panel** (bottom of Session Control tab, appears once a challenge has at least 2 submissions):
- A dropdown to pick which challenge's submissions to browse
- Two buttons: **"Load Top Strategy"** and **"Load Contrasting Strategy"**
  - Top = highest `bestAvgProfit` in `studentResults` for that challenge
  - Contrasting = lowest `bestAvgProfit` among students who still completed the challenge (not zero/failed runs — lowest valid completed result)
- Clicking either button feeds that student's saved config into the *same* `ComparePanel` / `FloorView` / `DualCharts` components already built for the student app, rendered right there in the admin tab, so the instructor can screen-share this tab directly during the Zoom debrief without hunting through individual student data manually.

### Results tab — attempts export
Add a second CSV export button in the existing Results tab: **"Download Attempts Log (CSV)"**, separate from the existing best-result export. Columns: `studentId (Anonymous ID), displayName, challengeKey, attemptNumber, isFirstAttempt, config (JSON), avgProfit, avgLost, chefUtilisation, bestNight, confidenceRating, timestamp`. This is the full audit trail — every attempt, not just best results — for pedagogical review or research use.

### Existing Results tab — add Anonymous ID column
Add the `studentId` field as a visible column (labeled "Anonymous ID") in the existing best-results table and its CSV export, alongside the existing `displayName` column. This lets the instructor cross-reference a display name to a stable ID even if two students pick similar nicknames.

---

## 4. Backward compatibility checklist

Before considering this done, verify:
- With `liveSessionMode: false` (the default for any existing or newly created class), the app behaves identically to before this iteration — sequential auto-unlock on submit, leaderboard always visible, no attempt limits, global reflection toggle only.
- Existing class `test1` continues to work without any manual Firestore migration — missing new fields should be treated as their stated defaults in code (do not assume they exist; use `?? default` throughout).
- The existing "Create New Class" flow initializes all new settings fields to their defaults (`liveSessionMode: false`, `activeChallenges` = all 6 in order, `unlockedChallenges: []`, `finalChallengeLevers` all true, `maxAttempts` all 20, `leaderboardVisible` all true, `reflectionsRequiredByChallenge: {}`, `confidenceRatingEnabled` all false).

---

## Summary of files likely touched

- `src/firebase/classSettings.ts` — new settings fields, defaults, `createClass` update
- `src/store/appContext.tsx` — expose new settings + attempt-count tracking
- `src/components/tabs/ChallengesTab.tsx` — respect `activeChallenges`, gated unlock logic
- `src/components/challenges/ChallengeShell.tsx` — attempt limit enforcement, per-challenge reflection toggle, confidence rating prompt, write to `attempts` collection
- `src/components/challenges/FinalChallenge.tsx` — respect `finalChallengeLevers`
- `src/components/tabs/LeaderboardTab.tsx` — respect `leaderboardVisible`
- `src/firebase/attempts.ts` (new file) — `logAttempt()`, query helpers for attempt counts and progress dashboard
- `src/admin/SessionControlTab.tsx` (new file) — the full Session Control tab described above
- `src/admin/AdminApp.tsx` — add Session Control to the tab nav
- `src/admin/ResultsTab.tsx` — Anonymous ID column, attempts CSV export

Do not change the engine's simulation logic, seeds, or the calibration parameters. This iteration is entirely about session orchestration and instructor controls around the existing, already-verified engine.
