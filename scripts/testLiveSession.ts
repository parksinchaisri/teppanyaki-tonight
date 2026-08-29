// Live-session logic verification. Run with: npx tsx scripts/testLiveSession.ts
// Covers the iteration 8 phase machine and standings maths — the parts that can
// be checked without a Firestore round-trip.

import {
  bestAttemptsByStudent,
  cumulativeStandings,
  formatCountdown,
  isAwaitingTimer,
  isRoundClosed,
  nextChallengeKey,
  normalizeLiveState,
  reflectionGateBlocker,
  roundStandings,
} from '../src/firebase/liveLogic';
import { DEFAULT_SETTINGS, type AttemptRow, type ClassSettings, type LeaderboardRow, type LiveSessionState, type StudentRow } from '../src/firebase/types';

let failures = 0;
function check(label: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? '✅' : '❌'} ${label} — ${detail}`);
  if (!pass) failures++;
}
function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

const PLAYLIST = ['batching', 'barSize', 'diningTime', 'advancedBatching', 'finalChallenge'];

function settings(over: Partial<ClassSettings> = {}): ClassSettings {
  return { ...DEFAULT_SETTINGS, liveSessionMode: true, activeChallenges: PLAYLIST, ...over };
}
function live(over: Partial<LiveSessionState> = {}): LiveSessionState {
  return { phase: 'lobby', currentChallenge: null, timer: null, roundView: 'round', ...over };
}
function row(studentId: string, challengeKey: string, profit: number, over: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    id: `${studentId}_${challengeKey}`,
    studentId,
    studentName: studentId.toUpperCase(),
    classCode: 'test1',
    challengeKey,
    bestAvgProfit: profit,
    bestMaxProfit: profit * 2,
    attempts: 1,
    lastSubmittedAt: 1,
    bestConfig: {} as LeaderboardRow['bestConfig'],
    autoSubmitted: false,
    ...over,
  };
}
function student(id: string): StudentRow {
  return { id, displayName: id.toUpperCase(), joinedAt: 1 };
}
function attempt(studentId: string, challengeKey: string, avgProfit: number, n: number): AttemptRow {
  return {
    id: `${studentId}-${n}`,
    studentId,
    displayName: studentId.toUpperCase(),
    challengeKey,
    attemptNumber: n,
    isFirstAttempt: n === 1,
    config: '{}',
    resultSummary: { avgProfit, avgLost: 0, chefUtilisation: 0.5, bestNight: avgProfit * 2 },
    confidenceRating: null,
    timestamp: n,
  };
}

section('1. Phase progression walks the playlist and finishes');
check('lobby → first challenge', nextChallengeKey(PLAYLIST, null) === 'batching', `got ${nextChallengeKey(PLAYLIST, null)}`);
check('advances in order', nextChallengeKey(PLAYLIST, 'diningTime') === 'advancedBatching', `got ${nextChallengeKey(PLAYLIST, 'diningTime')}`);
check('last challenge ends the session', nextChallengeKey(PLAYLIST, 'finalChallenge') === null, 'returns null → wrap_up');
check('a skipped challenge is never visited', !PLAYLIST.includes('advertising') && nextChallengeKey(PLAYLIST, 'diningTime') !== 'advertising', 'advertising omitted from playlist');

section('2. Round closes simulation at the right moments');
const s = settings();
check('open during briefing', !isRoundClosed(s, live({ phase: 'briefing', currentChallenge: 'barSize' }), 'barSize'), 'students may start early');
check('open during the timed round', !isRoundClosed(s, live({ phase: 'timed_round', currentChallenge: 'barSize' }), 'barSize'), 'round running');
check('closed at round results', isRoundClosed(s, live({ phase: 'round_results', currentChallenge: 'barSize' }), 'barSize'), 'round over');
check('earlier challenge stays closed', isRoundClosed(s, live({ phase: 'timed_round', currentChallenge: 'diningTime' }), 'batching'), 'class has moved on');
check('later challenge not closed', !isRoundClosed(s, live({ phase: 'timed_round', currentChallenge: 'batching' }), 'diningTime'), 'not reached yet');
check('self-paced never closes', !isRoundClosed(settings({ liveSessionMode: false }), live({ phase: 'wrap_up', currentChallenge: 'batching' }), 'batching'), 'iteration 7 behaviour untouched');

section('3. Round standings rank submitters and surface non-submitters');
const roster = [student('ana'), student('bo'), student('cy')];
const rows = [row('ana', 'batching', 1200), row('bo', 'batching', 1500, { autoSubmitted: true })];
const round = roundStandings(rows, roster, 'batching');
check('ranked by profit', round[0].studentId === 'bo' && round[1].studentId === 'ana', `${round.map((r) => r.studentId).join(' > ')}`);
check('non-submitter sorts last', round[2].studentId === 'cy' && !round[2].submitted, 'cy has no result');
check('forced submit flagged', round[0].autoSubmitted === true, 'bo was auto-submitted');
check('every roster member appears', round.length === 3, `${round.length} rows`);

section('4. Cumulative sums only playlist challenges');
const multi = [
  row('ana', 'batching', 1000),
  row('ana', 'barSize', 500),
  row('ana', 'advertising', 9999), // not in the playlist — must be excluded
  row('bo', 'batching', 1200),
];
const cum = cumulativeStandings(multi, PLAYLIST, roster);
const ana = cum.find((c) => c.studentId === 'ana')!;
check('sums across challenges', ana.value === 1500, `ana = ${ana.value}`);
check('excludes non-playlist results', ana.value !== 11499, 'advertising ignored');
check('leader is highest total', cum[0].studentId === 'ana', `${cum[0].studentId} leads`);
check('zero-submission student last', cum[cum.length - 1].studentId === 'cy', 'cy has nothing yet');

section('5. Force-submit picks each student’s best attempt');
const attempts = [
  attempt('ana', 'batching', 900, 1),
  attempt('ana', 'batching', 1400, 2),
  attempt('ana', 'barSize', 5000, 1), // different challenge — must not leak in
  attempt('bo', 'batching', 1100, 1),
];
const best = bestAttemptsByStudent(attempts, 'batching');
check('best of many attempts', best.get('ana')?.resultSummary.avgProfit === 1400, `ana → ${best.get('ana')?.resultSummary.avgProfit}`);
check('scoped to the challenge', best.size === 2, `${best.size} students`);
check('student with no attempts absent', !best.has('cy'), 'cy never simulated → No submission');

section('6. Iteration 9 A4 — Simulate held until the timer starts');
check('held during briefing', isAwaitingTimer(s, live({ phase: 'briefing', currentChallenge: 'barSize' }), 'barSize'), 'waiting for instructor to start');
check('released in the timed round', !isAwaitingTimer(s, live({ phase: 'timed_round', currentChallenge: 'barSize' }), 'barSize'), 'round running');
check('another challenge unaffected', !isAwaitingTimer(s, live({ phase: 'briefing', currentChallenge: 'barSize' }), 'batching'), 'only the briefed challenge');
check('self-paced never holds', !isAwaitingTimer(settings({ liveSessionMode: false }), live({ phase: 'briefing', currentChallenge: 'barSize' }), 'barSize'), 'iteration 7/8 behaviour untouched');

section('7. Iteration 9 A2 — reflection gates progress');
const gated = settings({ reflectionGatesProgress: true, reflectionsRequired: true });
check('off by default', reflectionGateBlocker(settings(), 'barSize', {}) === null, 'setting disabled → never gates');
check('blocks the next challenge', reflectionGateBlocker(gated, 'barSize', {}) === 'batching', `blocker: ${reflectionGateBlocker(gated, 'barSize', {})}`);
check('clears once reflected', reflectionGateBlocker(gated, 'barSize', { batching: true }) === null, 'reflection submitted');
check('first challenge never gated', reflectionGateBlocker(gated, 'batching', {}) === null, 'nothing precedes it');
check('per-challenge override respected', reflectionGateBlocker(settings({ reflectionGatesProgress: true, reflectionsRequired: true, reflectionsRequiredByChallenge: { batching: false } }), 'barSize', {}) === null, 'batching reflection not required');
check('gates in live mode too', reflectionGateBlocker(settings({ reflectionGatesProgress: true, reflectionsRequired: true, liveSessionMode: true }), 'diningTime', { batching: true }) === 'barSize', 'unlock does not bypass it');

section('8. Countdown formatting');
check('minutes and seconds', formatCountdown(125_000) === '02:05', formatCountdown(125_000));
check('pads correctly', formatCountdown(9_000) === '00:09', formatCountdown(9_000));
check('never goes negative', formatCountdown(-5_000) === '00:00', formatCountdown(-5_000));

section('9. Missing/partial live document falls back safely');
const blank = normalizeLiveState(undefined);
check('defaults to lobby', blank.phase === 'lobby' && blank.currentChallenge === null, `${blank.phase}`);
check('rejects a bogus phase', normalizeLiveState({ phase: 'nonsense' }).phase === 'lobby', 'unknown phase ignored');
check('keeps a valid timer', normalizeLiveState({ timer: { durationSeconds: 60, startedAt: 5, endsAt: 65 } }).timer?.endsAt === 65, 'timer preserved');

console.log(failures === 0 ? '\n🎉 ALL CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
