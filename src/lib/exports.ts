// Shared CSV builders. The admin Results/Reflections tabs and the cross-class
// Game Manager all go through these so column definitions live in one place.

import { getDocs, collection } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase/config';
import { getAttempts } from '../firebase/attempts';
import { getReflections } from '../firebase/reflections';
import type { LeaderboardRow, ReflectionRow } from '../firebase/types';
import type { SimConfig } from '../engine/types';
import { downloadCSV, toCSV } from './csv';

export const RESULTS_HEADERS = [
  'Anonymous ID',
  'studentName',
  'challengeKey',
  'bestAvgProfit',
  'attempts',
  'autoSubmitted',
  'lastSubmittedAt',
  'bestConfig',
];

export function resultsCSV(rows: LeaderboardRow[]): string {
  return toCSV(
    RESULTS_HEADERS,
    rows.map((r) => [
      r.studentId,
      r.studentName,
      r.challengeKey,
      Math.round(r.bestAvgProfit),
      r.attempts,
      r.autoSubmitted,
      r.lastSubmittedAt ? new Date(r.lastSubmittedAt).toISOString() : '',
      JSON.stringify(r.bestConfig),
    ]),
  );
}

export function reflectionsCSV(rows: ReflectionRow[]): string {
  return toCSV(
    ['Anonymous ID', 'studentName', 'challengeKey', 'questionText', 'response', 'submittedAt'],
    rows.map((r) => [
      r.studentId,
      r.studentName,
      r.challengeKey,
      r.questionText,
      r.response,
      r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
    ]),
  );
}

export function attemptsCSV(
  rows: Array<{
    studentId: string;
    displayName: string;
    challengeKey: string;
    attemptNumber: number;
    isFirstAttempt: boolean;
    config: string;
    resultSummary: { avgProfit: number; avgLost: number; chefUtilisation: number; bestNight: number };
    confidenceRating: number | null;
    timestamp: number;
  }>,
): string {
  return toCSV(
    [
      'Anonymous ID',
      'displayName',
      'challengeKey',
      'attemptNumber',
      'isFirstAttempt',
      'config',
      'avgProfit',
      'avgLost',
      'chefUtilisation',
      'bestNight',
      'confidenceRating',
      'timestamp',
    ],
    rows.map((a) => [
      a.studentId,
      a.displayName,
      a.challengeKey,
      a.attemptNumber,
      a.isFirstAttempt,
      a.config,
      Math.round(a.resultSummary.avgProfit),
      a.resultSummary.avgLost.toFixed(1),
      a.resultSummary.chefUtilisation.toFixed(4),
      Math.round(a.resultSummary.bestNight),
      a.confidenceRating ?? '',
      a.timestamp ? new Date(a.timestamp).toISOString() : '',
    ]),
  );
}

async function fetchResults(classCode: string): Promise<LeaderboardRow[]> {
  if (!firebaseConfigured) return [];
  const snap = await getDocs(collection(db, 'classes', classCode, 'studentResults'));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
      id: d.id,
      studentId: String(data.studentId ?? ''),
      studentName: String(data.studentName ?? 'Anonymous'),
      classCode: String(data.classCode ?? classCode),
      challengeKey: String(data.challengeKey ?? ''),
      bestAvgProfit: num(data.bestAvgProfit),
      bestMaxProfit: num(data.bestMaxProfit),
      attempts: num(data.attempts),
      lastSubmittedAt: num(data.lastSubmittedAt),
      bestConfig: data.bestConfig as SimConfig,
      autoSubmitted: data.autoSubmitted === true,
    };
  });
}

// Download all three CSVs for a class, one after another.
export async function exportAllForClass(classCode: string): Promise<void> {
  const [results, attempts, reflections] = await Promise.all([
    fetchResults(classCode),
    getAttempts(classCode),
    getReflections(classCode),
  ]);
  downloadCSV(`teppanyaki-results-${classCode}.csv`, resultsCSV(results));
  downloadCSV(`teppanyaki-attempts-${classCode}.csv`, attemptsCSV(attempts));
  downloadCSV(`teppanyaki-reflections-${classCode}.csv`, reflectionsCSV(reflections));
}
