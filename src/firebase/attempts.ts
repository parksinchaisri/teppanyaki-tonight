import { addDoc, collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db, firebaseConfigured } from './config';
import type { AttemptRow, StudentRow } from './types';
import type { ChallengeResult, SimConfig } from '../engine/types';

interface LogAttemptArgs {
  classCode: string;
  studentId: string;
  displayName: string;
  challengeKey: string;
  attemptNumber: number;
  config: SimConfig;
  result: ChallengeResult;
  confidenceRating: number | null;
}

// Append one row to the permanent attempts audit trail. Called on every
// brand-new Simulate run — not on re-viewing an already-simulated config, and
// not on "Submit to Leaderboard" (which still writes studentResults separately).
export async function logAttempt(args: LogAttemptArgs): Promise<void> {
  if (!firebaseConfigured) return;
  try {
    await addDoc(collection(db, 'classes', args.classCode, 'attempts'), {
      studentId: args.studentId,
      displayName: args.displayName,
      challengeKey: args.challengeKey,
      attemptNumber: args.attemptNumber,
      isFirstAttempt: args.attemptNumber === 1,
      config: JSON.stringify(args.config),
      resultSummary: {
        avgProfit: args.result.avgProfit,
        avgLost: args.result.avgLost,
        chefUtilisation: args.result.avgChefUtil,
        bestNight: args.result.maxProfit,
      },
      confidenceRating: args.confidenceRating,
      timestamp: Date.now(),
    });
  } catch (err) {
    // A denied write here usually means the `attempts` rules have not been
    // deployed yet. Attempt limits still hold for the current session, but the
    // audit trail and the cross-refresh count are lost, so make it visible.
    console.warn('Attempt log write failed (check Firestore rules for classes/*/attempts):', err);
  }
}

function attemptFromDoc(id: string, data: Record<string, unknown>): AttemptRow {
  const summary = (data.resultSummary ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    id,
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
  };
}

// Live per-challenge attempt counts for one student, so the attempt limit
// survives a page refresh and stays correct across two open tabs.
export function subscribeAttemptCounts(
  classCode: string,
  studentId: string,
  cb: (counts: Record<string, number>) => void,
): () => void {
  if (!firebaseConfigured) {
    cb({});
    return () => {};
  }
  const q = query(collection(db, 'classes', classCode, 'attempts'), where('studentId', '==', studentId));
  return onSnapshot(
    q,
    (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const key = String((d.data() as { challengeKey?: unknown }).challengeKey ?? '');
        if (key) counts[key] = (counts[key] ?? 0) + 1;
      });
      cb(counts);
    },
    (err) => {
      console.warn('Attempt count subscription failed (check Firestore rules for classes/*/attempts):', err);
      cb({});
    },
  );
}

// Live subscription to every attempt in a class, for the roster/activity panel.
export function subscribeAttempts(classCode: string, cb: (rows: AttemptRow[]) => void): () => void {
  if (!firebaseConfigured) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'classes', classCode, 'attempts'),
    (snap) => cb(snap.docs.map((d) => attemptFromDoc(d.id, d.data()))),
    (err) => {
      console.warn('Attempts subscription failed (check Firestore rules for classes/*/attempts):', err);
      cb([]);
    },
  );
}

// Admin-only full read of the audit trail, for the attempts CSV export.
export async function getAttempts(classCode: string): Promise<AttemptRow[]> {
  if (!firebaseConfigured) return [];
  const snap = await getDocs(collection(db, 'classes', classCode, 'attempts'));
  return snap.docs
    .map((d) => attemptFromDoc(d.id, d.data()))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Live roster, used by the Session Control progress counters
// ("{submitted} / {joined} submitted").
export function subscribeStudents(classCode: string, cb: (rows: StudentRow[]) => void): () => void {
  if (!firebaseConfigured) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'classes', classCode, 'students'),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            displayName: String(data.displayName ?? 'Anonymous'),
            joinedAt: typeof data.joinedAt === 'number' ? data.joinedAt : 0,
            currentView: String(data.currentView ?? ''),
            lastSeenAt: typeof data.lastSeenAt === 'number' ? data.lastSeenAt : 0,
          };
        }),
      ),
    () => cb([]),
  );
}
