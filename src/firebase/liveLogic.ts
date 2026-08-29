import {
  DEFAULT_ROUND_SECONDS,
  activeChallengeKeys,
  type AttemptRow,
  type ClassSettings,
  type LeaderboardRow,
  type LivePhase,
  type LiveSessionState,
  type StudentRow,
} from './types';

// ── Pure helpers ────────────────────────────────────────────────────────────
// Exported separately from the Firestore calls so the phase machine and the
// standings maths can be exercised without a network round-trip.

export function normalizeLiveState(data: unknown): LiveSessionState {
  const d = (data ?? {}) as Partial<LiveSessionState>;
  const phases: LivePhase[] = ['lobby', 'briefing', 'timed_round', 'round_results', 'wrap_up'];
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
    roundView: d.roundView === 'cumulative' ? 'cumulative' : 'round',
  };
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

  return out.sort((a, b) => {
    if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
    return b.value - a.value;
  });
}

// Sum of each student's best avgProfit across every playlist challenge they have
// submitted so far.
export function cumulativeStandings(
  rows: LeaderboardRow[],
  activeChallenges: string[],
  roster: StudentRow[] = [],
): RoundStanding[] {
  const active = new Set(activeChallenges);
  const totals = new Map<string, { name: string; total: number; count: number }>();

  for (const s of roster) {
    totals.set(s.id, { name: s.displayName, total: 0, count: 0 });
  }
  for (const r of rows) {
    if (!active.has(r.challengeKey)) continue;
    const cur = totals.get(r.studentId) ?? { name: r.studentName, total: 0, count: 0 };
    cur.total += r.bestAvgProfit;
    cur.count += 1;
    if (r.studentName) cur.name = r.studentName;
    totals.set(r.studentId, cur);
  }

  return [...totals.entries()]
    .map(([studentId, v]) => ({
      studentId,
      studentName: v.name,
      value: v.total,
      submitted: v.count > 0,
      autoSubmitted: false,
    }))
    .sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      return b.value - a.value;
    });
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

export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
