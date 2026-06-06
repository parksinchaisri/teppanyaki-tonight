import type { ParamOverrides, SimConfig } from '../engine/types';

export interface ClassSettings {
  reflectionsRequired: boolean;
  autoDebrief: boolean;
  utilizationVisible: boolean;
  leaderboardMode: 'challenge' | 'final';
  leaderboardMetric: 'avgProfit' | 'maxProfit';
  lockChallenges: boolean;
  activeLeaderboardChallenge: string;
}

export const DEFAULT_SETTINGS: ClassSettings = {
  reflectionsRequired: true,
  autoDebrief: false,
  utilizationVisible: false,
  leaderboardMode: 'challenge',
  leaderboardMetric: 'avgProfit',
  lockChallenges: true,
  activeLeaderboardChallenge: 'batching',
};

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
