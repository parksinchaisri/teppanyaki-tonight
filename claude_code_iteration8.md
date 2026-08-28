# Teppanyaki Tonight — Iteration 8: Theater Mode (Live Host View)

Adds a Kahoot-style live host screen for running the game synchronously over Zoom. Builds on top of Iteration 7's Live Session Mode (playlist, unlock gating, attempt limits, leaderboard reveal) — this iteration adds the *orchestration layer* on top: a lobby, a phase state machine, a shared countdown timer, forced round-close, and a combined round/cumulative leaderboard that never requires leaving the screen being projected.

Test credentials: class code `test1`, PIN `1234`.

---

## Design decisions (resolved — do not re-ask)

- Theater Mode is a new route, `/admin/theater`, gated by the same PIN auth as the rest of admin. It is meant to be opened in its own browser tab (so the instructor can keep Session Control open elsewhere) via a button in Session Control: **"Open Theater Mode ↗"** using `window.open('/admin/theater', '_blank')`.
- Source of truth for session state is Firestore, not which browser tab is "driving." Both the Session Control tab and the Theater Mode tab read and can write the same live-session document, so either surface can control the session and both stay in sync in real time. No cross-tab messaging needed.
- Round-close (when the timer runs out) is an explicit instructor button click, not an automatic client-side race. The timer visually indicates expiry (flashes/turns red) but the actual "close this round and force-submit" action only happens when the instructor clicks it — this avoids multiple open tabs/clients racing to write simultaneously.
- Cumulative ranking = sum of each student's best submitted `avgProfit` across every challenge in `activeChallenges` they've submitted so far. Computed live from the existing `studentResults` collection — no new per-student running-total field to maintain.
- "Force submit at timer end" = for every joined student who has at least one simulated (but not yet submitted-to-leaderboard) config for the current challenge, auto-submit their best simulated run as their result for that round, flagged `autoSubmitted: true`. Students with zero simulated configs get no result for that round and show as "No submission" in that round's ranking — not silently omitted.

---

## 1. New Firestore document: live session state

A dedicated document, separate from `settings` (which changes rarely) since this updates during live play:

```
classes/{classCode}/live/state
```

```typescript
interface LiveSessionState {
  phase: 'lobby' | 'briefing' | 'timed_round' | 'round_results' | 'wrap_up';
  currentChallenge: string | null;   // challenge key, or null during lobby/wrap_up
  timer: {
    durationSeconds: number;
    startedAt: number | null;   // ms epoch, set when instructor starts the timer
    endsAt: number | null;      // startedAt + durationSeconds*1000, computed once and stored
  } | null;
  roundView: 'round' | 'cumulative';   // which leaderboard Theater Mode currently shows
}
```

Clients (Theater Mode, and the student's in-challenge countdown badge) compute remaining time locally as `endsAt - Date.now()` on a local `setInterval`, ticking every second. **Do not write to Firestore on every tick** — `startedAt`/`endsAt` are written once when the timer starts and read by everyone from there.

Firestore rules: same no-auth pattern as the rest of the app — `allow read: if true; allow create, update: if true;` on this document. It's a single document per class holding only session-flow state, no sensitive data.

---

## 2. Phase state machine

### `lobby`
- Default phase before a session starts, and the phase to explicitly return to via a "Reset to Lobby" button if the instructor wants to restart.
- Theater Mode shows, large: the join URL, the class code, and a live-updating grid of student names as they join — subscribe to the existing `students` subcollection. New names animate in as they arrive (a light fade/scale-in is enough; this doesn't need to be elaborate).
- A prominent **"Start Class"** button (available both in Theater Mode and in Session Control) transitions `phase` to `briefing` and sets `currentChallenge` to the first entry in `activeChallenges`.
- Students who have joined but see `phase === 'lobby'` on their own screen (not just instructor's) should see a simple "Waiting for your instructor to start…" screen instead of the normal Prepare/Challenges/Leaderboard tab bar. Once phase leaves `lobby`, their normal tab interface appears.

### `briefing`
- Theater Mode shows the current challenge's title and description large on screen (reuse the existing challenge metadata already defined for each of the 6 challenges) — this is the instructor's cue to talk over it.
- A timer duration input (default suggestion: 5 minutes, editable) and a **"Start Timer"** button. Clicking it writes `timer.startedAt = Date.now()`, `timer.endsAt = startedAt + duration*1000`, and transitions `phase` to `timed_round`.
- Entering `briefing` for a challenge should also add that challenge to `unlockedChallenges` (from Iteration 7's schema) automatically, so students gain access at the same moment the instructor starts talking about it — no separate manual unlock step needed in Session Control during live play.

### `timed_round`
- Theater Mode shows a large countdown (MM:SS), counting down from `timer.endsAt`. At zero, the display flashes/changes color (e.g., border turns red, "TIME'S UP" label appears) but phase does **not** auto-advance.
- Below the timer: live progress — **"{submittedCount} / {joinedCount} submitted"** for the current challenge, same counting logic as Iteration 7's Session Control progress rows.
- An **"End Round Now"** button is available at any time (not just after expiry — instructor may want to close early if everyone's done). Clicking it:
  1. Runs the force-submit logic described above for any student with a simulated-but-unsubmitted config
  2. Sets `leaderboardVisible[currentChallenge] = true` (revealing results)
  3. Transitions `phase` to `round_results`
- On the student side, once `phase` leaves `timed_round` for their current challenge, further Simulate actions for that challenge are disabled (same visual treatment as hitting an attempt limit) — the round is over.

### `round_results`
- Theater Mode shows a ranked leaderboard with a toggle between **"This Round"** and **"Cumulative"** — a simple two-button switch at the top of the leaderboard, editing `roundView` in the live-session doc. This is the fix for the "hard to control, always shows the wrong challenge" complaint: Theater Mode always shows whichever challenge is `currentChallenge`, automatically, with no need to go find it in Session Control.
  - **This Round view**: ranks by `bestAvgProfit` for `currentChallenge` only. Students with no submission for this round appear at the bottom in a visually distinct muted row labeled "No submission."
  - **Cumulative view**: ranks by sum of `bestAvgProfit` across all challenges in `activeChallenges` each student has submitted so far.
- A **"Next Challenge"** button advances `currentChallenge` to the next entry in `activeChallenges` and returns `phase` to `briefing`. If there is no next challenge (the just-finished one was the last in `activeChallenges`), the button instead reads **"Show Final Results"** and transitions to `wrap_up`.

### `wrap_up`
- Theater Mode shows final cumulative standings, large, styled as a closing screen (e.g., top 3 highlighted distinctly — gold/silver/bronze framing is fine given the classroom-game context).
- A **"Reset to Lobby"** button is available here (and really from any phase, as an escape hatch) for the instructor to restart a session if needed.

---

## 3. Theater Mode UI structure

New file `src/admin/TheaterMode.tsx`, routed at `/admin/theater`.

- **Control strip**: a compact bar at the top of Theater Mode with the phase-appropriate action button(s) described above. Include a small **"Hide controls"** toggle that collapses this strip to a tiny reopen tab in the corner — useful once the instructor wants a clean projection surface and prefers to drive the session from the Session Control tab instead, without controls cluttering the projected screen.
- **Main display area**: fills the rest of the viewport, large text, dark theme consistent with the rest of the app, designed to be legible from across a room / on a shared screen — favor large type sizes over dense layouts here specifically, more so than the regular admin dashboard.
- Auth: reuses the existing admin PIN gate component. If the tab isn't already authenticated (e.g., opened fresh), show the same login form before rendering Theater Mode.

### Add to Session Control tab
A single new button near the top: **"Open Theater Mode ↗"** — opens `/admin/theater` in a new tab. Also surface the current `phase` and `currentChallenge` as a small read-only status line in Session Control itself, so an instructor glancing at Session Control (without Theater Mode open) still knows where the class is.

---

## 4. Student-side additions

- **Lobby waiting screen**: when `phase === 'lobby'` (read from the live-session doc), show a simple centered message instead of the normal tabs: "Waiting for your instructor to start the session…" with the restaurant name/logo styling consistent with the rest of the app.
- **In-challenge countdown badge**: when `phase === 'timed_round'` and `currentChallenge` matches the challenge the student is currently viewing, show a small persistent countdown badge (reusing the same `endsAt`-based local countdown logic as Theater Mode) somewhere visible in the challenge view — e.g., top-right of `ChallengeShell`. This lets students self-pace against the same clock the instructor is watching, without needing to alt-tab or ask "how much time is left."
- **Round-closed state**: once `phase` leaves `timed_round` for the student's current challenge (instructor clicked "End Round Now"), disable further Simulate actions for that challenge with a message: "This round has ended." Previously-run configs remain viewable.

---

## 5. Force-submit implementation detail

When "End Round Now" fires:

```typescript
async function forceCloseRound(classCode: string, challengeKey: string) {
  // 1. Get every joined student (from students subcollection)
  const roster = await getRoster(classCode);

  // 2. Get every student who already has a studentResults doc for this challenge
  const alreadySubmitted = await getSubmittedStudentIds(classCode, challengeKey);

  // 3. For students in roster but not in alreadySubmitted, find their best
  //    attempt for this challenge from the `attempts` collection
  const pending = roster.filter(s => !alreadySubmitted.has(s.studentId));
  for (const student of pending) {
    const bestAttempt = await getBestAttempt(classCode, student.studentId, challengeKey);
    if (bestAttempt) {
      await writeStudentResult(classCode, student.studentId, challengeKey, {
        ...bestAttempt.resultSummary,
        bestConfig: bestAttempt.config,
        autoSubmitted: true,     // new field — distinguishes forced submits in exports
      });
    }
    // If bestAttempt is null (student never even ran a simulation), do nothing —
    // they show as "No submission" in the round leaderboard by simply having no
    // studentResults doc for this challengeKey.
  }

  // 4. Reveal leaderboard + advance phase (as described in section 2)
}
```

Add `autoSubmitted: boolean` to the `studentResults` schema (default `false` for normal manual submissions) and include it as a column in the existing Results tab CSV export, so the instructor can see afterward which results were forced vs. manually submitted.

---

## 6. Cumulative leaderboard query

```typescript
async function getCumulativeStandings(classCode: string, activeChallenges: string[]) {
  // Fetch all studentResults docs for the class where challengeKey is in activeChallenges.
  // Group by studentId, sum bestAvgProfit, keep the most recent displayName seen.
  // Return sorted descending by total.
}
```

This is a client-side aggregation over a small dataset (one document per student per challenge, at most ~6× class size) — no need for a maintained running-total field or a Cloud Function.

---

## Summary of files to touch

- `src/firebase/liveSession.ts` (new) — `subscribeLiveState`, `startClass`, `startTimer`, `endRound` (force-submit logic), `nextChallenge`, `resetToLobby`, `setRoundView`
- `src/admin/TheaterMode.tsx` (new) — the full host view described in Section 3
- `src/admin/SessionControlTab.tsx` — add "Open Theater Mode ↗" button and phase/challenge status line
- `src/App.tsx` — add `/admin/theater` route
- `src/components/tabs/ChallengesTab.tsx` or a new wrapper — lobby waiting screen, in-challenge countdown badge, round-closed disabling
- `src/firebase/types.ts` — `LiveSessionState` type, `autoSubmitted` field on `StudentResult`
- `src/admin/ResultsTab.tsx` — add `autoSubmitted` column to CSV export
- `firestore.rules` — add rule block for `classes/{classCode}/live/state`

Do not change the engine, seeds, or Iteration 7's attempt-limit/reflection/confidence-rating logic — this iteration only adds the phase/timer/lobby orchestration layer on top of what already exists.
