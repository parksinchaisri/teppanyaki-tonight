import type { ParamOverrides, SimConfig } from '../engine/types';

// The canonical challenge order, duplicated here (rather than imported from
// challenges/definitions) so this module stays free of engine dependencies.
export const ALL_CHALLENGE_KEYS = [
  'batching',
  'barSize',
  'diningTime',
  'advertising',
  'advancedBatching',
  'finalChallenge',
] as const;

export const DEFAULT_MAX_ATTEMPTS = 20;

export interface FinalChallengeLevers {
  batching: boolean;
  barSize: boolean;
  diningTime: boolean;
  advertising: boolean;
}

export interface ClassSettings {
  reflectionsRequired: boolean;
  autoDebrief: boolean;
  utilizationVisible: boolean;
  leaderboardMode: 'challenge' | 'final';
  leaderboardMetric: 'avgProfit' | 'maxProfit';
  lockChallenges: boolean;
  activeLeaderboardChallenge: string;
  strictBatching: boolean; // table-of-8 only (no time-pressure partial seatings)

  // ── Iteration 7: live session mode ────────────────────────────────────────
  // false = existing self-paced behaviour (auto-unlock on submit, everything
  // visible). true = instructor gates every unlock from the Session Control tab.
  liveSessionMode: boolean;
  // Ordered playlist. A challenge absent from here is hidden from students and
  // treated as satisfied when deciding whether the Final Challenge can unlock.
  activeChallenges: string[];
  // Only meaningful when liveSessionMode is true: the subset students can reach.
  unlockedChallenges: string[];
  // Final Challenge columns; a false lever hides the column and makes the engine
  // use the class default for that parameter.
  finalChallengeLevers: FinalChallengeLevers;
  // Per-challenge caps on brand-new Simulate runs.
  maxAttempts: Record<string, number>;
  // Per-challenge leaderboard reveal.
  leaderboardVisible: Record<string, boolean>;
  // Per-challenge override of the global `reflectionsRequired`. A key that is
  // absent falls back to the global value.
  reflectionsRequiredByChallenge: Record<string, boolean>;
  // Per-challenge 1–5 confidence prompt before Simulate.
  confidenceRatingEnabled: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: ClassSettings = {
  reflectionsRequired: true,
  autoDebrief: false,
  utilizationVisible: false,
  leaderboardMode: 'challenge',
  leaderboardMetric: 'avgProfit',
  lockChallenges: true,
  activeLeaderboardChallenge: 'batching',
  strictBatching: true,

  liveSessionMode: false,
  activeChallenges: [...ALL_CHALLENGE_KEYS],
  unlockedChallenges: [],
  finalChallengeLevers: { batching: true, barSize: true, diningTime: true, advertising: true },
  maxAttempts: Object.fromEntries(ALL_CHALLENGE_KEYS.map((k) => [k, DEFAULT_MAX_ATTEMPTS])),
  leaderboardVisible: Object.fromEntries(ALL_CHALLENGE_KEYS.map((k) => [k, true])),
  reflectionsRequiredByChallenge: {},
  confidenceRatingEnabled: Object.fromEntries(ALL_CHALLENGE_KEYS.map((k) => [k, false])),
};

// ── Per-challenge settings accessors ────────────────────────────────────────
// Every new field may be missing entirely on a class document written before
// iteration 7, so nothing here assumes the map (or the key inside it) exists.

export function activeChallengeKeys(s: ClassSettings): string[] {
  const list = Array.isArray(s.activeChallenges) ? s.activeChallenges : null;
  if (!list) return [...ALL_CHALLENGE_KEYS];
  const valid = list.filter((k): k is string => typeof k === 'string' && (ALL_CHALLENGE_KEYS as readonly string[]).includes(k));
  // An empty/garbage playlist would lock students out of everything; fall back.
  return valid.length ? Array.from(new Set(valid)) : [...ALL_CHALLENGE_KEYS];
}

export function isChallengeActive(s: ClassSettings, key: string): boolean {
  return activeChallengeKeys(s).includes(key);
}

export function isChallengeUnlocked(s: ClassSettings, key: string): boolean {
  return Array.isArray(s.unlockedChallenges) && s.unlockedChallenges.includes(key);
}

export function maxAttemptsFor(s: ClassSettings, key: string): number {
  const v = s.maxAttempts?.[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_ATTEMPTS;
}

export function leaderboardVisibleFor(s: ClassSettings, key: string): boolean {
  return s.leaderboardVisible?.[key] ?? true;
}

export function reflectionsRequiredFor(s: ClassSettings, key: string): boolean {
  return s.reflectionsRequiredByChallenge?.[key] ?? s.reflectionsRequired;
}

export function confidenceRatingEnabledFor(s: ClassSettings, key: string): boolean {
  return s.confidenceRatingEnabled?.[key] ?? false;
}

export function finalChallengeLevers(s: ClassSettings): FinalChallengeLevers {
  const l = s.finalChallengeLevers ?? {};
  return {
    batching: l.batching ?? true,
    barSize: l.barSize ?? true,
    diningTime: l.diningTime ?? true,
    advertising: l.advertising ?? true,
  };
}

export const DEFAULT_PARAMS: ParamOverrides = {};

export interface ClassDoc {
  instructorPin: string;
  settings: ClassSettings;
  params: ParamOverrides;
}

export interface LeaderboardRow {
  id: string;
  studentId: string;
  studentName: string;
  classCode: string;
  challengeKey: string;
  bestAvgProfit: number;
  bestMaxProfit: number;
  attempts: number;
  lastSubmittedAt: number;
  bestConfig: SimConfig;
}

export interface ReflectionRow {
  id: string;
  studentId: string;
  studentName: string;
  challengeKey: string;
  questionText: string;
  response: string;
  submittedAt: number;
}

// One row per brand-new Simulate run — the full audit trail, distinct from
// studentResults (which only ever keeps each student's best result).
export interface AttemptRow {
  id: string;
  studentId: string;
  displayName: string;
  challengeKey: string;
  attemptNumber: number;
  isFirstAttempt: boolean;
  config: string; // JSON.stringify(SimConfig)
  resultSummary: {
    avgProfit: number;
    avgLost: number;
    chefUtilisation: number;
    bestNight: number;
  };
  confidenceRating: number | null;
  timestamp: number;
}

export interface StudentRow {
  id: string;
  displayName: string;
  joinedAt: number;
}
