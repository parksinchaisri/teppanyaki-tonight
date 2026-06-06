import { collection, doc, getDoc, onSnapshot, setDoc, query, where } from 'firebase/firestore';
import { db, firebaseConfigured } from './config';
import type { LeaderboardRow } from './types';
import type { SimConfig } from '../engine/types';

interface SubmitArgs {
  classCode: string;
  studentId: string;
  studentName: string;
  challengeKey: string;
  avgProfit: number;
  maxProfit: number;
  config: SimConfig;
}

// Submit (or update) a student's best result for a challenge. Keeps the best
// avgProfit seen and increments the attempt counter.
export async function submitResult(args: SubmitArgs): Promise<void> {
  if (!firebaseConfigured) return;
  const docId = `${args.studentId}_${args.challengeKey}`;
  const ref = doc(db, 'classes', args.classCode, 'studentResults', docId);
  const existing = await getDoc(ref);
  const prev = existing.exists() ? (existing.data() as Partial<LeaderboardRow>) : null;

  const prevBest = prev?.bestAvgProfit ?? -Infinity;
  const improved = args.avgProfit > prevBest;

  await setDoc(ref, {
    studentId: args.studentId,
    studentName: args.studentName,
    classCode: args.classCode,
    challengeKey: args.challengeKey,
    bestAvgProfit: improved ? args.avgProfit : prevBest,
    bestMaxProfit: improved ? args.maxProfit : (prev?.bestMaxProfit ?? args.maxProfit),
    bestConfig: improved ? args.config : (prev?.bestConfig ?? args.config),
    attempts: (prev?.attempts ?? 0) + 1,
    lastSubmittedAt: Date.now(),
  });
}

function rowFromDoc(id: string, data: Record<string, unknown>): LeaderboardRow {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? 'Anonymous'),
    classCode: String(data.classCode ?? ''),
    challengeKey: String(data.challengeKey ?? ''),
    bestAvgProfit: Number(data.bestAvgProfit ?? 0),
    bestMaxProfit: Number(data.bestMaxProfit ?? data.bestAvgProfit ?? 0),
    attempts: Number(data.attempts ?? 0),
    lastSubmittedAt: Number(data.lastSubmittedAt ?? 0),
    bestConfig: data.bestConfig as SimConfig,
  };
}

// Live subscription to all results for a class (optionally filtered by challenge).
export function subscribeLeaderboard(
  classCode: string,
  challengeKey: string | null,
  cb: (rows: LeaderboardRow[]) => void,
): () => void {
  if (!firebaseConfigured) {
    cb([]);
    return () => {};
  }
  const col = collection(db, 'classes', classCode, 'studentResults');
  const q = challengeKey ? query(col, where('challengeKey', '==', challengeKey)) : col;
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => rowFromDoc(d.id, d.data()))),
    () => cb([]),
  );
}
