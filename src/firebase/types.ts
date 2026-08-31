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

  // ── Iteration 9 ───────────────────────────────────────────────────────────
  // When true, a student cannot move on to the next challenge in playlist order
  // until they have submitted the reflection the current one requires. Applies
  // in both self-paced and live mode.
  reflectionGatesProgress: boolean;

  // What the Theater Mode lobby shows for joining. 'full' prints the deployed
  // site URL, 'custom' prints theaterCustomJoinUrl verbatim (a short link, say),
  // 'hidden' prints nothing on the assumption the link is shared over chat.
  // The class code is always shown regardless.
  theaterJoinUrlDisplay: TheaterJoinUrlDisplay;
  theaterCustomJoinUrl: string;

  // 'guarded' swaps the Prepare tab's briefing prose for a condensed version and
  // makes it awkward to select or right-click. Friction only — anyone who wants
  // the text can still read it off the screen or the page source.
  preparePageMode: 'standard' | 'guarded';

  // How many places the Theater round-results reveal counts down through.
  theaterRevealCount: 5 | 10;

  // Adds a third "Debrief" view to Theater's round results, for challenges that
  // have debrief content. Off leaves the Round/Cumulative toggle exactly as it
  // was.
  fullDebriefMode: boolean;
}

export type TheaterJoinUrlDisplay = 'full' | 'custom' | 'hidden';

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
  reflectionGatesProgress: false,
  theaterJoinUrlDisplay: 'full',
  theaterCustomJoinUrl: '',
  preparePageMode: 'standard',
  theaterRevealCount: 5,
  fullDebriefMode: true,
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

export function theaterRevealCount(s: ClassSettings): 5 | 10 {
  return s.theaterRevealCount === 10 ? 10 : 5;
}

export function theaterJoinUrlDisplay(s: ClassSettings): TheaterJoinUrlDisplay {
  const v = s.theaterJoinUrlDisplay;
  return v === 'custom' || v === 'hidden' ? v : 'full';
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
  // True when the result was written by "End Round Now" rather than by the
  // student pressing Submit. Absent on documents written before iteration 8.
  autoSubmitted: boolean;
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

// ── Iteration 8: live session (theater mode) orchestration ─────────────────
// Stored at classes/{classCode}/live/state — kept out of `settings` because it
// changes many times during a single class, while settings rarely change.

// 'intro' sits between the lobby and the first briefing: the class is running
// but no challenge has been named yet, so currentChallenge is still null.
export type LivePhase = 'lobby' | 'intro' | 'briefing' | 'timed_round' | 'round_results' | 'wrap_up';

export interface LiveTimer {
  durationSeconds: number;
  startedAt: number | null; // ms epoch, set once when the instructor starts it
  endsAt: number | null; // startedAt + durationSeconds * 1000, computed once
}

export interface RoundHistoryEntry {
  challengeKey: string;
  top5: string[]; // studentIds, best first — drives the top-5 streak badge
}

export type RoundView = 'round' | 'cumulative' | 'debrief';

export interface LiveSessionState {
  phase: LivePhase;
  currentChallenge: string | null; // challenge key; null in lobby/wrap_up
  timer: LiveTimer | null;
  roundView: RoundView;
  roundHistory: RoundHistoryEntry[];
}

export const DEFAULT_LIVE_STATE: LiveSessionState = {
  phase: 'lobby',
  currentChallenge: null,
  timer: null,
  roundView: 'round',
  roundHistory: [],
};

export const DEFAULT_ROUND_SECONDS = 300; // 5 minutes

export interface StudentRow {
  id: string;
  displayName: string;
  joinedAt: number;
}
