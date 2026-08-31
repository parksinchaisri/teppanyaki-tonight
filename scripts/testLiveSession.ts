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
  biggestClimber,
  buildRoster,
  previousRanks,
  rankRows,
  reflectionGateBlocker,
  streakFor,
  roundStandings,
  sortRoster,
  NUDGE_AFTER_MS,
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
  return { phase: 'lobby', currentChallenge: null, timer: null, roundView: 'round', roundHistory: [], ...over };
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

section('8. Iteration 9 B1 — roster activity');
const NOW = 10_000_000;
const rosterStudents: StudentRow[] = [
  { id: 'ana', displayName: 'Ana', joinedAt: NOW - 10 * 60 * 1000 },   // long ago, active
  { id: 'bo', displayName: 'Bo', joinedAt: NOW - 10 * 60 * 1000 },     // long ago, nothing
  { id: 'cy', displayName: 'Cy', joinedAt: NOW - 30 * 1000 },          // just joined, nothing
];
const rosterAttempts = [attempt('ana', 'batching', 1200, 1), attempt('ana', 'barSize', 900, 1)];
rosterAttempts[0].timestamp = NOW - 60 * 1000;
rosterAttempts[1].timestamp = NOW - 20 * 1000;
const rosterResults = [row('ana', 'batching', 1200)];
const entries = buildRoster(rosterStudents, rosterAttempts, rosterResults, 'batching', NOW);
const byId = (id: string) => entries.find((e) => e.studentId === id)!;
check('attempted flag', byId('ana').hasAttempted && !byId('bo').hasAttempted, 'ana attempted batching');
check('submitted flag', byId('ana').hasSubmitted && !byId('bo').hasSubmitted, 'ana submitted');
check('last activity is most recent across challenges', byId('ana').lastActivity === NOW - 20 * 1000, 'barSize attempt is newer');
check('no activity → null', byId('bo').lastActivity === null, 'bo never simulated');
check('flags the long-idle student', byId('bo').needsNudge, `joined ${(NOW - byId('bo').joinedAt) / 60000}m ago, no attempts`);
check('does not flag a fresh joiner', !byId('cy').needsNudge, `only ${(NOW - byId('cy').joinedAt) / 1000}s in, under the ${NUDGE_AFTER_MS / 60000}m threshold`);
check('does not flag an active student', !byId('ana').needsNudge, 'ana has attempts');
check('no current challenge → no flags', buildRoster(rosterStudents, [], [], null, NOW).every((e) => !e.needsNudge), 'self-paced class');
const stragglers = sortRoster(entries, 'unsubmitted');
check('stragglers sort first', stragglers[stragglers.length - 1].studentId === 'ana', `order: ${stragglers.map((e) => e.studentId).join(' > ')}`);
check('alphabetical sort', sortRoster(entries, 'alphabetical').map((e) => e.displayName).join(',') === 'Ana,Bo,Cy', 'A–Z');
check('recent-activity sort', sortRoster(entries, 'recent')[0].studentId === 'ana', 'most recently active first');

section('9. Iteration 9 D3 — ranking movement, streaks, climber');
const ORDER = ['batching', 'barSize', 'diningTime'];
// After round 1 ana led; in round 2 cy overtakes everyone.
const d3rows = [
  row('ana', 'batching', 1000), row('bo', 'batching', 900), row('cy', 'batching', 500),
  row('ana', 'barSize', 100), row('bo', 'barSize', 200), row('cy', 'barSize', 1500),
];
const d3roster = [student('ana'), student('bo'), student('cy')];
const prevCum = previousRanks(d3rows, ORDER, 'barSize', 'cumulative', d3roster);
check('previous cumulative ranks exclude the current round', prevCum.get('ana') === 1 && prevCum.get('cy') === 3, `ana=${prevCum.get('ana')} cy=${prevCum.get('cy')}`);
check('first challenge has no previous ranks', previousRanks(d3rows, ORDER, 'batching', 'cumulative', d3roster).size === 0, 'nothing precedes it');

const nowCum = cumulativeStandings(d3rows, ORDER, d3roster);
const history = [{ challengeKey: 'batching', top5: ['ana', 'bo', 'cy'] }, { challengeKey: 'barSize', top5: ['cy', 'ana', 'bo'] }];
const contribution = new Map([['ana', 100], ['bo', 200], ['cy', 1500]]);
const ranked = rankRows(nowCum, prevCum, history, contribution);
const r = (id: string) => ranked.find((x) => x.studentId === id)!;
check('ranks assigned in order', r('cy').rank === 1, `cy is #${r('cy').rank} on ${r('cy').value}`);
check('climber delta positive', r('cy').delta === 2, `cy moved ${r('cy').delta}`);
check('faller delta negative', r('ana').delta === -1, `ana moved ${r('ana').delta}`);
check('round contribution surfaced', r('cy').roundDelta === 1500, `+${r('cy').roundDelta} this round`);
check('bar share is relative to the leader', r('cy').share === 1 && r('ana').share < 1, `ana share ${r('ana').share.toFixed(2)}`);
check('biggest climber identified', biggestClimber(ranked)?.studentId === 'cy', `${biggestClimber(ranked)?.studentId} +${biggestClimber(ranked)?.delta}`);
check('no climber when nobody moves up', biggestClimber(rankRows(nowCum, new Map(), history)) === null, 'all deltas null');

check('streak counts trailing rounds', streakFor(history, 'cy') === 2, `cy streak ${streakFor(history, 'cy')}`);
check('streak breaks on a missed round', streakFor([{ challengeKey: 'a', top5: ['ana'] }, { challengeKey: 'b', top5: ['bo'] }], 'ana') === 0, 'ana missed the latest round');
check('no history → no streak', streakFor([], 'ana') === 0, 'fresh session');

section('10. Countdown formatting');
check('minutes and seconds', formatCountdown(125_000) === '02:05', formatCountdown(125_000));
check('pads correctly', formatCountdown(9_000) === '00:09', formatCountdown(9_000));
check('never goes negative', formatCountdown(-5_000) === '00:00', formatCountdown(-5_000));

section('11. Missing/partial live document falls back safely');
const blank = normalizeLiveState(undefined);
check('defaults to lobby', blank.phase === 'lobby' && blank.currentChallenge === null, `${blank.phase}`);
check('rejects a bogus phase', normalizeLiveState({ phase: 'nonsense' }).phase === 'lobby', 'unknown phase ignored');
check(
  'accepts the intro phase',
  normalizeLiveState({ phase: 'intro' }).phase === 'intro',
  'intro survives normalisation',
);
// The intro names no challenge, so nothing about it may close a round or hold
// a Simulate button — those gates key off currentChallenge, which is null here.
const introState = live({ phase: 'intro', currentChallenge: null });
check(
  'intro closes no round',
  PLAYLIST.every((k) => !isRoundClosed(settings(), introState, k)),
  'no challenge reads as closed during the intro',
);
check(
  'intro holds no timer gate',
  PLAYLIST.every((k) => !isAwaitingTimer(settings(), introState, k)),
  'no challenge is awaiting the timer during the intro',
);
check('keeps a valid timer', normalizeLiveState({ timer: { durationSeconds: 60, startedAt: 5, endsAt: 65 } }).timer?.endsAt === 65, 'timer preserved');
check('missing roundHistory defaults to empty', normalizeLiveState({}).roundHistory.length === 0, 'no history');
check('malformed history entries dropped', normalizeLiveState({ roundHistory: [{ challengeKey: 'a', top5: ['x'] }, { nope: 1 }] }).roundHistory.length === 1, 'only valid entries kept');

console.log(failures === 0 ? '\n🎉 ALL CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
