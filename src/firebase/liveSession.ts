import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db, firebaseConfigured } from './config';
import {
  DEFAULT_LIVE_STATE,
  activeChallengeKeys,
  type AttemptRow,
  type ClassSettings,
  type LiveSessionState,
  type RoundView,
  type StudentRow,
} from './types';
import { bestAttemptsByStudent, nextChallengeKey, normalizeLiveState } from './liveLogic';

// The pure phase/standings logic lives in ./liveLogic (no Firestore imports, so
// it is unit-testable); re-exported here so callers have a single entry point.
export {
  bestAttemptsByStudent,
  cumulativeStandings,
  formatCountdown,
  biggestClimber,
  buildRoster,
  isAwaitingTimer,
  previousRanks,
  rankRows,
  streakFor,
  type RankedRow,
  isRoundClosed,
  reflectionGateBlocker,
  sortRoster,
  NUDGE_AFTER_MS,
  type RosterEntry,
  type RosterSort,
  nextChallengeKey,
  normalizeLiveState,
  roundStandings,
  type RoundStanding,
} from './liveLogic';
import type { SimConfig } from '../engine/types';

const LIVE_DOC = ['live', 'state'] as const;

function liveRef(classCode: string) {
  return doc(db, 'classes', classCode, ...LIVE_DOC);
}

// ── Firestore access ────────────────────────────────────────────────────────

export function subscribeLiveState(classCode: string, cb: (s: LiveSessionState) => void): () => void {
  if (!firebaseConfigured) {
    cb(DEFAULT_LIVE_STATE);
    return () => {};
  }
  return onSnapshot(
    liveRef(classCode),
    (snap) => cb(normalizeLiveState(snap.data())),
    (err) => {
      console.warn('Live session subscription failed (check Firestore rules for classes/*/live):', err);
      cb(DEFAULT_LIVE_STATE);
    },
  );
}

export async function getLiveState(classCode: string): Promise<LiveSessionState> {
  if (!firebaseConfigured) return DEFAULT_LIVE_STATE;
  const snap = await getDoc(liveRef(classCode));
  return normalizeLiveState(snap.data());
}

async function writeLive(classCode: string, patch: Partial<LiveSessionState>): Promise<void> {
  if (!firebaseConfigured) return;
  await setDoc(liveRef(classCode), patch, { merge: true });
}

// Add a challenge to unlockedChallenges without rewriting the whole settings map.
async function unlockChallenge(classCode: string, settings: ClassSettings, key: string): Promise<void> {
  if (!firebaseConfigured) return;
  const current = settings.unlockedChallenges ?? [];
  if (current.includes(key)) return;
  await updateDoc(doc(db, 'classes', classCode), {
    'settings.unlockedChallenges': [...current, key],
  });
}

// Start the class: move to the briefing for the first playlist challenge and
// unlock it so students gain access as the instructor starts talking.
export async function startClass(classCode: string, settings: ClassSettings): Promise<void> {
  const first = activeChallengeKeys(settings)[0] ?? null;
  await writeLive(classCode, {
    phase: 'briefing',
    currentChallenge: first,
    timer: null,
    roundView: 'round',
  });
  if (first) await unlockChallenge(classCode, settings, first);
}

// endsAt is computed once here and read by every client; nobody writes per tick.
export async function startTimer(classCode: string, durationSeconds: number): Promise<void> {
  const startedAt = Date.now();
  await writeLive(classCode, {
    phase: 'timed_round',
    timer: { durationSeconds, startedAt, endsAt: startedAt + durationSeconds * 1000 },
  });
}

export async function setRoundView(classCode: string, roundView: RoundView): Promise<void> {
  await writeLive(classCode, { roundView });
}

export async function resetToLobby(classCode: string): Promise<void> {
  // A fresh session starts with no history, so streaks and rank movement do not
  // carry over from the previous run of the class.
  await writeLive(classCode, {
    phase: 'lobby',
    currentChallenge: null,
    timer: null,
    roundView: 'round',
    roundHistory: [],
  });
}

// Move to the next playlist challenge, or finish the session when there is none.
export async function nextChallenge(classCode: string, settings: ClassSettings, current: string | null): Promise<void> {
  const order = activeChallengeKeys(settings);
  const next = nextChallengeKey(order, current);
  if (!next) {
    await writeLive(classCode, { phase: 'wrap_up', timer: null, roundView: 'cumulative' });
    return;
  }
  await writeLive(classCode, { phase: 'briefing', currentChallenge: next, timer: null, roundView: 'round' });
  await unlockChallenge(classCode, settings, next);
}

export async function getRoster(classCode: string): Promise<StudentRow[]> {
  if (!firebaseConfigured) return [];
  const snap = await getDocs(collection(db, 'classes', classCode, 'students'));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      displayName: String(data.displayName ?? 'Anonymous'),
      joinedAt: typeof data.joinedAt === 'number' ? data.joinedAt : 0,
    };
  });
}

// Close the round: force-submit anyone who simulated but never pressed Submit,
// reveal the leaderboard for the challenge, and move to the results phase.
export async function endRound(
  classCode: string,
  challengeKey: string,
): Promise<{ forced: number; noSubmission: number }> {
  if (!firebaseConfigured) {
    await writeLive(classCode, { phase: 'round_results', roundView: 'round' });
    return { forced: 0, noSubmission: 0 };
  }

  const [roster, resultsSnap, attemptsSnap] = await Promise.all([
    getRoster(classCode),
    getDocs(
      query(collection(db, 'classes', classCode, 'studentResults'), where('challengeKey', '==', challengeKey)),
    ),
    getDocs(query(collection(db, 'classes', classCode, 'attempts'), where('challengeKey', '==', challengeKey))),
  ]);

  const alreadySubmitted = new Set(
    resultsSnap.docs.map((d) => String((d.data() as { studentId?: unknown }).studentId ?? '')),
  );

  const attempts = attemptsSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const summary = (data.resultSummary ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
      id: d.id,
      studentId: String(data.studentId ?? ''),
      displayName: String(data.displayName ?? 'Anonymous'),
      challengeKey: String(data.challengeKey ?? ''),
      attemptNumber: num(data.attemptNumber),
      isFirstAttempt: Boolean(data.isFirstAttempt),
      config: String(data.config ?? ''),
      resultSummary: {
        avgProfit: num(summary.avgProfit),
        avgLost: num(summary.avgLost),
        chefUtilisation: num(summary.chefUtilisation),
        bestNight: num(summary.bestNight),
      },
      confidenceRating: typeof data.confidenceRating === 'number' ? data.confidenceRating : null,
      timestamp: num(data.timestamp),
    } satisfies AttemptRow;
  });

  const best = bestAttemptsByStudent(attempts, challengeKey);

  // Anyone on the roster who never submitted, plus anyone who has attempts but
  // never made it onto the roster.
  const candidates = new Map<string, { name: string }>();
  for (const s of roster) if (!alreadySubmitted.has(s.id)) candidates.set(s.id, { name: s.displayName });
  for (const [studentId, a] of best) {
    if (!alreadySubmitted.has(studentId) && !candidates.has(studentId)) {
      candidates.set(studentId, { name: a.displayName });
    }
  }

  let forced = 0;
  let noSubmission = 0;
  const batch = writeBatch(db);

  for (const [studentId, info] of candidates) {
    const attempt = best.get(studentId);
    if (!attempt) {
      // Never ran a simulation — no document, so they read as "No submission".
      noSubmission += 1;
      continue;
    }
    let config: SimConfig | null = null;
    try {
      config = JSON.parse(attempt.config) as SimConfig;
    } catch {
      config = null;
    }
    if (!config) {
      noSubmission += 1;
      continue;
    }
    // The studentResults rule requires a 2–30 character name.
    const rawName = attempt.displayName || info.name || 'Anonymous';
    const studentName = rawName.length < 2 ? 'Anonymous' : rawName.slice(0, 30);

    batch.set(doc(db, 'classes', classCode, 'studentResults', `${studentId}_${challengeKey}`), {
      studentId,
      studentName,
      classCode,
      challengeKey,
      bestAvgProfit: attempt.resultSummary.avgProfit,
      bestMaxProfit: attempt.resultSummary.bestNight,
      bestConfig: config,
      attempts: 1,
      lastSubmittedAt: Date.now(),
      autoSubmitted: true,
    });
    forced += 1;
  }

  if (forced > 0) await batch.commit();

  // Re-read after the forced writes so the recorded top 5 reflects them.
  const finalSnap = await getDocs(
    query(collection(db, 'classes', classCode, 'studentResults'), where('challengeKey', '==', challengeKey)),
  );
  const top5 = finalSnap.docs
    .map((d) => d.data() as { studentId?: unknown; bestAvgProfit?: unknown })
    .map((d) => ({
      studentId: String(d.studentId ?? ''),
      value: typeof d.bestAvgProfit === 'number' ? d.bestAvgProfit : 0,
    }))
    .filter((d) => d.studentId)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((d) => d.studentId);

  // Append this round to the history, replacing any earlier entry for the same
  // challenge so re-closing a round cannot double-count a streak.
  const live = await getLiveState(classCode);
  const history = [
    ...live.roundHistory.filter((h) => h.challengeKey !== challengeKey),
    { challengeKey, top5 },
  ];

  // Reveal this challenge's leaderboard, then advance the phase.
  await updateDoc(doc(db, 'classes', classCode), {
    [`settings.leaderboardVisible.${challengeKey}`]: true,
  });
  await writeLive(classCode, { phase: 'round_results', roundView: 'round', roundHistory: history });

  return { forced, noSubmission };
}
