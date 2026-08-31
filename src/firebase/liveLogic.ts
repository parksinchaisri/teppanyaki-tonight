import {
  DEFAULT_ROUND_SECONDS,
  activeChallengeKeys,
  type AttemptRow,
  type ClassSettings,
  type LeaderboardRow,
  type LivePhase,
  type LiveSessionState,
  type RoundHistoryEntry,
  type StudentRow,
} from './types';

// ── Pure helpers ────────────────────────────────────────────────────────────
// Exported separately from the Firestore calls so the phase machine and the
// standings maths can be exercised without a network round-trip.

export function normalizeLiveState(data: unknown): LiveSessionState {
  const d = (data ?? {}) as Partial<LiveSessionState>;
  const phases: LivePhase[] = ['lobby', 'intro', 'briefing', 'timed_round', 'round_results', 'wrap_up'];
  const t = d.timer as Partial<LiveSessionState['timer']> | null | undefined;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    phase: phases.includes(d.phase as LivePhase) ? (d.phase as LivePhase) : 'lobby',
    currentChallenge: typeof d.currentChallenge === 'string' ? d.currentChallenge : null,
    timer: t
      ? {
          durationSeconds: num((t as { durationSeconds?: unknown }).durationSeconds) ?? DEFAULT_ROUND_SECONDS,
          startedAt: num((t as { startedAt?: unknown }).startedAt),
          endsAt: num((t as { endsAt?: unknown }).endsAt),
        }
      : null,
    roundView:
      d.roundView === 'cumulative' ? 'cumulative' : d.roundView === 'debrief' ? 'debrief' : 'round',
    roundHistory: Array.isArray(d.roundHistory)
      ? (d.roundHistory as RoundHistoryEntry[])
          .filter((e) => e && typeof e.challengeKey === 'string')
          .map((e) => ({
            challengeKey: e.challengeKey,
            top5: Array.isArray(e.top5) ? e.top5.filter((x) => typeof x === 'string') : [],
          }))
      : [],
  };
}

// ── D3: ranking movement, streaks and per-round deltas ──────────────────────

// Rank map (1-indexed) for a list already in ranked order.
function rankMap(standings: RoundStanding[]): Map<string, number> {
  const m = new Map<string, number>();
  let rank = 0;
  for (const s of standings) {
    if (!s.submitted) continue;
    rank += 1;
    m.set(s.studentId, rank);
  }
  return m;
}

// Where everyone stood *before* the current challenge. Derived from the results
// that already exist rather than stored, so no extra schema is needed: the
// previous cumulative standing is the same sum with the current challenge left
// out, and the previous round standing is simply the preceding challenge.
export function previousRanks(
  rows: LeaderboardRow[],
  order: string[],
  currentChallenge: string | null,
  view: 'round' | 'cumulative',
  roster: StudentRow[] = [],
): Map<string, number> {
  if (!currentChallenge) return new Map();
  const i = order.indexOf(currentChallenge);
  if (i <= 0) return new Map(); // nothing precedes the first challenge
  if (view === 'cumulative') {
    return rankMap(cumulativeStandings(rows, order.slice(0, i), roster));
  }
  return rankMap(roundStandings(rows, roster, order[i - 1]));
}

export interface RankedRow extends RoundStanding {
  rank: number;
  delta: number | null; // positions gained since the previous round; null if new
  streak: number; // consecutive most-recent rounds finishing in the top 5
  roundDelta: number | null; // profit added by the current round (cumulative view)
  share: number; // 0–1, this row's value against the leader, for the bar
}

export function rankRows(
  standings: RoundStanding[],
  previous: Map<string, number>,
  roundHistory: RoundHistoryEntry[],
  roundContribution?: Map<string, number>,
): RankedRow[] {
  const top = standings.find((s) => s.submitted)?.value ?? 0;
  let rank = 0;
  return standings.map((s) => {
    if (s.submitted) rank += 1;
    const prev = previous.get(s.studentId);
    return {
      ...s,
      rank,
      delta: s.submitted && prev !== undefined ? prev - rank : null,
      streak: streakFor(roundHistory, s.studentId),
      roundDelta: roundContribution?.get(s.studentId) ?? null,
      share: top > 0 && s.submitted ? Math.max(0, s.value) / top : 0,
    };
  });
}

// Consecutive trailing rounds in which the student finished top 5.
export function streakFor(roundHistory: RoundHistoryEntry[], studentId: string): number {
  let n = 0;
  for (let i = roundHistory.length - 1; i >= 0; i--) {
    if (roundHistory[i].top5.includes(studentId)) n += 1;
    else break;
  }
  return n;
}

// Whoever gained the most positions this round, for the callout banner.
export function biggestClimber(rows: RankedRow[]): RankedRow | null {
  const climbers = rows.filter((r) => (r.delta ?? 0) > 0);
  if (!climbers.length) return null;
  return climbers.reduce((a, b) => ((b.delta ?? 0) > (a.delta ?? 0) ? b : a));
}

// The next challenge in the playlist after `current`, or null when `current` is
// the last one (which means the session is finished).
export function nextChallengeKey(activeChallenges: string[], current: string | null): string | null {
  if (!current) return activeChallenges[0] ?? null;
  const i = activeChallenges.indexOf(current);
  if (i < 0) return activeChallenges[0] ?? null;
  return activeChallenges[i + 1] ?? null;
}

// A challenge is closed to further simulation once its round is over: either the
// class has moved past it in the playlist, or it is the current challenge and
// the instructor has already ended the round.
export function isRoundClosed(
  settings: ClassSettings,
  live: LiveSessionState,
  challengeKey: string,
): boolean {
  if (!settings.liveSessionMode) return false;
  if (!live.currentChallenge) return false;
  const order = activeChallengeKeys(settings);
  const currentIndex = order.indexOf(live.currentChallenge);
  const keyIndex = order.indexOf(challengeKey);
  if (currentIndex < 0 || keyIndex < 0) return false;
  if (keyIndex < currentIndex) return true; // the class has moved on
  if (keyIndex > currentIndex) return false; // not reached yet
  return live.phase === 'round_results' || live.phase === 'wrap_up';
}

// A4: during the briefing the challenge is already unlocked and visible, but the
// round has not started — simulating is held until the instructor starts the timer.
export function isAwaitingTimer(
  settings: ClassSettings,
  live: LiveSessionState,
  challengeKey: string,
): boolean {
  if (!settings.liveSessionMode) return false;
  return live.phase === 'briefing' && live.currentChallenge === challengeKey;
}

// A2: the challenge whose reflection is blocking entry to `targetKey`, or null
// when the student may proceed. Only the immediately preceding playlist entry
// gates the next one.
export function reflectionGateBlocker(
  settings: ClassSettings,
  targetKey: string,
  reflected: Record<string, boolean>,
): string | null {
  if (!settings.reflectionGatesProgress) return null;
  const order = activeChallengeKeys(settings);
  const i = order.indexOf(targetKey);
  if (i <= 0) return null; // the first challenge is never gated
  const prev = order[i - 1];
  const required = settings.reflectionsRequiredByChallenge?.[prev] ?? settings.reflectionsRequired;
  if (!required) return null;
  return reflected[prev] ? null : prev;
}

export interface RoundStanding {
  studentId: string;
  studentName: string;
  value: number;
  submitted: boolean;
  autoSubmitted: boolean;
}

// Submission time breaks ties and nothing else. It is deliberately absent from
// RoundStanding: it never reaches a component, so there is nothing for the UI to
// render even by accident.
//
// The rule this protects: score is the only thing that decides who outranks
// whom. Timing is consulted only after two students prove identical, which on
// Batching — where there are just two reachable scores — is most of the class.
// A row with no usable timestamp sorts to the end of its tie group rather than
// the front, so a malformed document cannot win a place it did not earn.
const NO_TIMESTAMP = Number.MAX_SAFE_INTEGER;

function byValueThenTime(ts: Map<string, number>) {
  return (a: RoundStanding, b: RoundStanding): number => {
    if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
    if (b.value !== a.value) return b.value - a.value;
    if (!a.submitted) return 0;
    return (ts.get(a.studentId) || NO_TIMESTAMP) - (ts.get(b.studentId) || NO_TIMESTAMP);
  };
}

// Ranking for a single challenge. Every roster member appears: students without
// a result for the challenge sort to the bottom as "No submission".
export function roundStandings(
  rows: LeaderboardRow[],
  roster: StudentRow[],
  challengeKey: string,
): RoundStanding[] {
  const byStudent = new Map<string, LeaderboardRow>();
  for (const r of rows) {
    if (r.challengeKey === challengeKey) byStudent.set(r.studentId, r);
  }

  const seen = new Set<string>();
  const out: RoundStanding[] = [];
  for (const s of roster) {
    seen.add(s.id);
    const row = byStudent.get(s.id);
    out.push({
      studentId: s.id,
      studentName: row?.studentName || s.displayName,
      value: row?.bestAvgProfit ?? 0,
      submitted: Boolean(row),
      autoSubmitted: row?.autoSubmitted ?? false,
    });
  }
  // Results from students missing off the roster (joined before the roster was
  // recorded) still deserve a place on the board.
  for (const [studentId, row] of byStudent) {
    if (seen.has(studentId)) continue;
    out.push({
      studentId,
      studentName: row.studentName,
      value: row.bestAvgProfit,
      submitted: true,
      autoSubmitted: row.autoSubmitted,
    });
  }

  const submittedAt = new Map([...byStudent].map(([id, r]) => [id, r.lastSubmittedAt]));
  return out.sort(byValueThenTime(submittedAt));
}

// Sum of each student's best avgProfit across every playlist challenge they have
// submitted so far.
export function cumulativeStandings(
  rows: LeaderboardRow[],
  activeChallenges: string[],
  roster: StudentRow[] = [],
): RoundStanding[] {
  const active = new Set(activeChallenges);
  const totals = new Map<string, { name: string; total: number; count: number; timeTotal: number }>();

  for (const s of roster) {
    totals.set(s.id, { name: s.displayName, total: 0, count: 0, timeTotal: 0 });
  }
  for (const r of rows) {
    if (!active.has(r.challengeKey)) continue;
    const cur = totals.get(r.studentId) ?? { name: r.studentName, total: 0, count: 0, timeTotal: 0 };
    cur.total += r.bestAvgProfit;
    cur.count += 1;
    // Summed across every challenge they have submitted, so the tiebreak
    // reflects a whole session rather than one lucky early round.
    cur.timeTotal += r.lastSubmittedAt;
    if (r.studentName) cur.name = r.studentName;
    totals.set(r.studentId, cur);
  }

  const submittedAt = new Map([...totals].map(([id, v]) => [id, v.timeTotal]));
  return [...totals.entries()]
    .map(([studentId, v]) => ({
      studentId,
      studentName: v.name,
      value: v.total,
      submitted: v.count > 0,
      autoSubmitted: false,
    }))
    .sort(byValueThenTime(submittedAt));
}

// Highest-avgProfit attempt per student for one challenge.
export function bestAttemptsByStudent(attempts: AttemptRow[], challengeKey: string): Map<string, AttemptRow> {
  const best = new Map<string, AttemptRow>();
  for (const a of attempts) {
    if (a.challengeKey !== challengeKey) continue;
    const cur = best.get(a.studentId);
    if (!cur || a.resultSummary.avgProfit > cur.resultSummary.avgProfit) best.set(a.studentId, a);
  }
  return best;
}

// ── Presence ────────────────────────────────────────────────────────────────

export type PresenceStatus = 'active' | 'idle' | 'away';

export const PRESENCE_ACTIVE_MS = 30 * 1000;
export const PRESENCE_IDLE_MS = 2 * 60 * 1000;

// Derived from the heartbeat alone. A backgrounded tab stops beating, so a
// student who alt-tabbed away decays to Idle and then Away on their own.
export function presenceStatus(lastSeenAt: number, now: number): PresenceStatus {
  if (!lastSeenAt) return 'away';
  const age = now - lastSeenAt;
  if (age <= PRESENCE_ACTIVE_MS) return 'active';
  if (age <= PRESENCE_IDLE_MS) return 'idle';
  return 'away';
}

// 'Challenges:barSize' → 'Challenges: Bar Size'. Anything unrecognised is
// passed through, so an older client reporting a view this build has never
// heard of still reads sensibly.
export function formatCurrentView(view: string, labelFor: (key: string) => string | undefined): string {
  if (!view) return '—';
  const [head, key] = view.split(':');
  if (head === 'Challenges' && key) return `Challenges: ${labelFor(key) ?? key}`;
  return head;
}

// ── B1: roster / activity ───────────────────────────────────────────────────

export interface RosterEntry {
  studentId: string;
  displayName: string;
  joinedAt: number;
  lastActivity: number | null; // most recent attempt across any challenge
  hasAttempted: boolean; // for the current live challenge
  hasSubmitted: boolean; // for the current live challenge
  needsNudge: boolean; // joined a while ago, nothing logged this challenge
}

export type RosterSort = 'alphabetical' | 'recent' | 'unsubmitted';

// Students who joined longer ago than this with no attempt on the current
// challenge get flagged — a glanceable "may be stuck", not a notification.
export const NUDGE_AFTER_MS = 3 * 60 * 1000;

export function buildRoster(
  students: StudentRow[],
  attempts: AttemptRow[],
  results: LeaderboardRow[],
  currentChallenge: string | null,
  now: number,
): RosterEntry[] {
  const lastByStudent = new Map<string, number>();
  const attemptedCurrent = new Set<string>();
  for (const a of attempts) {
    const prev = lastByStudent.get(a.studentId) ?? 0;
    if (a.timestamp > prev) lastByStudent.set(a.studentId, a.timestamp);
    if (currentChallenge && a.challengeKey === currentChallenge) attemptedCurrent.add(a.studentId);
  }
  const submittedCurrent = new Set(
    results.filter((r) => currentChallenge && r.challengeKey === currentChallenge).map((r) => r.studentId),
  );

  return students.map((s) => {
    const hasAttempted = attemptedCurrent.has(s.id);
    return {
      studentId: s.id,
      displayName: s.displayName,
      joinedAt: s.joinedAt,
      lastActivity: lastByStudent.get(s.id) ?? null,
      hasAttempted,
      hasSubmitted: submittedCurrent.has(s.id),
      needsNudge: Boolean(currentChallenge) && !hasAttempted && now - s.joinedAt > NUDGE_AFTER_MS,
    };
  });
}

export function sortRoster(rows: RosterEntry[], sort: RosterSort): RosterEntry[] {
  const out = [...rows];
  if (sort === 'alphabetical') {
    return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  if (sort === 'recent') {
    return out.sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0));
  }
  // Stragglers first: not submitted, then not attempted, then least recent.
  return out.sort((a, b) => {
    if (a.hasSubmitted !== b.hasSubmitted) return a.hasSubmitted ? 1 : -1;
    if (a.hasAttempted !== b.hasAttempted) return a.hasAttempted ? 1 : -1;
    return (a.lastActivity ?? 0) - (b.lastActivity ?? 0);
  });
}

export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
