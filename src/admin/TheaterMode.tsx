import { useEffect, useMemo, useState } from 'react';
import { AdminLogin } from './AdminLogin';
import { subscribeSettings } from '../firebase/classSettings';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import { subscribeStudents } from '../firebase/attempts';
import {
  cumulativeStandings,
  endRound,
  nextChallenge,
  nextChallengeKey,
  resetToLobby,
  roundStandings,
  setRoundView,
  startClass,
  startTimer,
  subscribeLiveState,
  type RoundStanding,
} from '../firebase/liveSession';
import {
  DEFAULT_LIVE_STATE,
  DEFAULT_ROUND_SECONDS,
  DEFAULT_SETTINGS,
  activeChallengeKeys,
  type ClassSettings,
  type LeaderboardRow,
  type LiveSessionState,
  type StudentRow,
} from '../firebase/types';
import { CHALLENGE_BY_KEY } from '../challenges/definitions';
import { money } from '../lib/format';
import { useCountdown } from '../components/shared/useCountdown';

export function TheaterMode() {
  const [classCode, setClassCode] = useState('');
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <h1 className="text-xl font-bold">Theater Mode</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Live host view</p>
          <div className="mt-5">
            <AdminLogin
              onAuthed={(code) => {
                setClassCode(code);
                setAuthed(true);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return <TheaterSession classCode={classCode} />;
}

function TheaterSession({ classCode }: { classCode: string }) {
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_SETTINGS);
  const [live, setLive] = useState<LiveSessionState>(DEFAULT_LIVE_STATE);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [showControls, setShowControls] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [duration, setDuration] = useState(DEFAULT_ROUND_SECONDS / 60);

  useEffect(() => subscribeSettings(classCode, (s) => setSettings(s)), [classCode]);
  useEffect(() => subscribeLiveState(classCode, setLive), [classCode]);
  useEffect(() => subscribeStudents(classCode, setStudents), [classCode]);
  useEffect(() => subscribeLeaderboard(classCode, null, setRows), [classCode]);

  const order = useMemo(() => activeChallengeKeys(settings), [settings]);
  const def = live.currentChallenge ? CHALLENGE_BY_KEY[live.currentChallenge] : null;
  const isLast = live.currentChallenge ? nextChallengeKey(order, live.currentChallenge) === null : false;

  async function run(fn: () => Promise<unknown>, failure: string) {
    setBusy(true);
    setNotice('');
    try {
      await fn();
    } catch (err) {
      console.warn(failure, err);
      setNotice(`${failure} Check that the Firestore rules for classes/*/live are deployed.`);
    }
    setBusy(false);
  }

  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      {live.phase === 'lobby' && (
        <BigButton
          tone="green"
          disabled={busy || !order.length}
          onClick={() => run(() => startClass(classCode, settings), 'Could not start the class.')}
        >
          ▶ Start Class
        </BigButton>
      )}

      {live.phase === 'briefing' && (
        <>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            Round length
            <input
              type="number"
              min={1}
              max={60}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 text-center font-mono outline-none"
            />
            min
          </label>
          <BigButton
            tone="green"
            disabled={busy}
            onClick={() => run(() => startTimer(classCode, Math.round(duration * 60)), 'Could not start the timer.')}
          >
            ⏱ Start Timer
          </BigButton>
        </>
      )}

      {live.phase === 'timed_round' && live.currentChallenge && (
        <BigButton
          tone="amber"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const res = await endRound(classCode, live.currentChallenge as string);
              setNotice(
                `Round closed — ${res.forced} result${res.forced === 1 ? '' : 's'} auto-submitted` +
                  (res.noSubmission ? `, ${res.noSubmission} with no submission.` : '.'),
              );
            }, 'Could not end the round.')
          }
        >
          ⏹ End Round Now
        </BigButton>
      )}

      {live.phase === 'round_results' && (
        <BigButton
          tone="green"
          disabled={busy}
          onClick={() =>
            run(() => nextChallenge(classCode, settings, live.currentChallenge), 'Could not advance.')
          }
        >
          {isLast ? '🏁 Show Final Results' : '→ Next Challenge'}
        </BigButton>
      )}

      <button
        onClick={() => run(() => resetToLobby(classCode), 'Could not reset.')}
        disabled={busy}
        className="rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
      >
        Reset to Lobby
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      {showControls ? (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-bold">Theater · {classCode}</span>
              <PhaseChip phase={live.phase} />
            </div>
            {controls}
            <button
              onClick={() => setShowControls(false)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)]"
            >
              Hide controls
            </button>
          </div>
          {notice && <p className="mt-2 text-xs text-[var(--color-accent-amber)]">{notice}</p>}
        </div>
      ) : (
        <button
          onClick={() => setShowControls(true)}
          className="fixed right-3 top-3 z-30 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
        >
          ⚙ Controls
        </button>
      )}

      <main className="flex flex-1 flex-col justify-center px-10 py-8">
        {live.phase === 'lobby' && <LobbyView classCode={classCode} students={students} />}
        {live.phase === 'briefing' && <BriefingView title={def?.title} description={def?.description} />}
        {live.phase === 'timed_round' && (
          <TimedRoundView live={live} rows={rows} students={students} />
        )}
        {live.phase === 'round_results' && live.currentChallenge && (
          <RoundResultsView
            classCode={classCode}
            live={live}
            rows={rows}
            students={students}
            order={order}
            challengeKey={live.currentChallenge}
          />
        )}
        {live.phase === 'wrap_up' && <WrapUpView rows={rows} students={students} order={order} />}
      </main>
    </div>
  );
}

// ── Phase views ─────────────────────────────────────────────────────────────

function LobbyView({ classCode, students }: { classCode: string; students: StudentRow[] }) {
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const sorted = [...students].sort((a, b) => a.joinedAt - b.joinedAt);
  return (
    <div className="text-center">
      <style>{`@keyframes theaterPop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}`}</style>
      <p className="text-xl uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Join at</p>
      <p className="mt-3 break-all font-mono text-4xl text-[var(--color-accent)] lg:text-5xl">{joinUrl}</p>
      <p className="mt-8 text-xl uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Class code</p>
      <p className="mt-2 font-mono text-7xl font-bold lg:text-8xl">{classCode}</p>

      <p className="mt-10 text-lg text-[var(--color-text-secondary)]">
        {sorted.length} {sorted.length === 1 ? 'chef' : 'chefs'} in the kitchen
      </p>
      <div className="mx-auto mt-4 flex max-w-5xl flex-wrap justify-center gap-3">
        {sorted.map((s) => (
          <span
            key={s.id}
            style={{ animation: 'theaterPop .35s ease-out' }}
            className="rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-5 py-2 text-2xl"
          >
            {s.displayName}
          </span>
        ))}
        {!sorted.length && (
          <span className="text-xl text-[var(--color-text-muted)]">Waiting for students to join…</span>
        )}
      </div>
    </div>
  );
}

function BriefingView({ title, description }: { title?: string; description?: string }) {
  return (
    <div className="mx-auto max-w-5xl text-center">
      <p className="text-xl uppercase tracking-[0.3em] text-[var(--color-accent)]">Next challenge</p>
      <h1 className="mt-5 text-6xl font-bold leading-tight lg:text-7xl">{title ?? 'Challenge'}</h1>
      <p className="mt-8 text-2xl leading-relaxed text-[var(--color-text-secondary)] lg:text-3xl">
        {description}
      </p>
    </div>
  );
}

function TimedRoundView({
  live,
  rows,
  students,
}: {
  live: LiveSessionState;
  rows: LeaderboardRow[];
  students: StudentRow[];
}) {
  const { label, expired } = useCountdown(live.timer?.endsAt ?? null);
  const submitted = new Set(
    rows.filter((r) => r.challengeKey === live.currentChallenge).map((r) => r.studentId),
  ).size;
  const joined = Math.max(students.length, submitted);

  return (
    <div className="text-center">
      <div
        className={`mx-auto inline-block rounded-3xl border-8 px-16 py-10 transition-colors ${
          expired
            ? 'animate-pulse border-[var(--color-accent-red)] bg-[var(--color-accent-red)]/10'
            : 'border-[var(--color-border)]'
        }`}
      >
        <p className="font-mono text-[10rem] font-bold leading-none tabular-nums lg:text-[14rem]">{label}</p>
      </div>
      {expired && (
        <p className="mt-6 text-5xl font-bold tracking-widest text-[var(--color-accent-red)]">TIME&apos;S UP</p>
      )}
      <p className="mt-10 text-5xl font-semibold lg:text-6xl">
        <span className="text-[var(--color-accent-green)]">{submitted}</span>
        <span className="text-[var(--color-text-muted)]"> / {joined} submitted</span>
      </p>
    </div>
  );
}

function RoundResultsView({
  classCode,
  live,
  rows,
  students,
  order,
  challengeKey,
}: {
  classCode: string;
  live: LiveSessionState;
  rows: LeaderboardRow[];
  students: StudentRow[];
  order: string[];
  challengeKey: string;
}) {
  const view = live.roundView;
  const standings =
    view === 'cumulative'
      ? cumulativeStandings(rows, order, students)
      : roundStandings(rows, students, challengeKey);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">
          {view === 'cumulative' ? 'Cumulative Standings' : CHALLENGE_BY_KEY[challengeKey]?.title ?? challengeKey}
        </h1>
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          {(['round', 'cumulative'] as const).map((v) => (
            <button
              key={v}
              onClick={() => void setRoundView(classCode, v)}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                view === v
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {v === 'round' ? 'This Round' : 'Cumulative'}
            </button>
          ))}
        </div>
      </div>
      <StandingsList standings={standings} />
    </div>
  );
}

function WrapUpView({
  rows,
  students,
  order,
}: {
  rows: LeaderboardRow[];
  students: StudentRow[];
  order: string[];
}) {
  const standings = cumulativeStandings(rows, order, students);
  const podium = standings.filter((s) => s.submitted).slice(0, 3);
  const rest = standings.slice(podium.length);
  const MEDALS = ['🥇', '🥈', '🥉'];
  const FRAMES = [
    'border-[#d4af37] bg-[#d4af37]/10',
    'border-[#9ca3af] bg-[#9ca3af]/10',
    'border-[#b45309] bg-[#b45309]/10',
  ];

  return (
    <div className="mx-auto w-full max-w-4xl text-center">
      <h1 className="text-5xl font-bold lg:text-6xl">Final Standings</h1>
      <p className="mt-2 text-lg text-[var(--color-text-secondary)]">Total profit across every challenge</p>

      <div className="mt-10 space-y-3">
        {podium.map((s, i) => (
          <div
            key={s.studentId}
            className={`flex items-center justify-between rounded-2xl border-4 px-8 py-5 ${FRAMES[i]}`}
          >
            <span className="flex items-center gap-4 text-4xl font-bold">
              <span>{MEDALS[i]}</span>
              {s.studentName}
            </span>
            <span className="font-mono text-4xl text-[var(--color-accent-green)]">{money(s.value)}</span>
          </div>
        ))}
        {!podium.length && (
          <p className="text-xl text-[var(--color-text-muted)]">No submissions were recorded.</p>
        )}
      </div>

      {rest.length > 0 && (
        <div className="mt-8">
          <StandingsList standings={rest} startRank={podium.length + 1} />
        </div>
      )}
    </div>
  );
}

function StandingsList({ standings, startRank = 1 }: { standings: RoundStanding[]; startRank?: number }) {
  if (!standings.length) {
    return <p className="text-center text-xl text-[var(--color-text-muted)]">No students yet.</p>;
  }
  let rank = startRank - 1;
  return (
    <div className="space-y-2">
      {standings.map((s) => {
        if (s.submitted) rank += 1;
        return (
          <div
            key={s.studentId}
            className={`flex items-center justify-between rounded-xl border px-6 py-4 ${
              s.submitted
                ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                : 'border-dashed border-[var(--color-border)] opacity-50'
            }`}
          >
            <span className="flex items-center gap-4">
              <span className="w-10 font-mono text-2xl text-[var(--color-text-muted)]">
                {s.submitted ? rank : '—'}
              </span>
              <span className="text-2xl font-medium">{s.studentName}</span>
              {s.autoSubmitted && (
                <span className="rounded-full border border-[var(--color-accent-amber)]/50 px-2 py-0.5 text-xs text-[var(--color-accent-amber)]">
                  auto
                </span>
              )}
            </span>
            {s.submitted ? (
              <span className="font-mono text-2xl text-[var(--color-accent-green)]">{money(s.value)}</span>
            ) : (
              <span className="text-lg text-[var(--color-text-muted)]">No submission</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhaseChip({ phase }: { phase: LiveSessionState['phase'] }) {
  const LABELS: Record<LiveSessionState['phase'], string> = {
    lobby: 'Lobby',
    briefing: 'Briefing',
    timed_round: 'Round in progress',
    round_results: 'Round results',
    wrap_up: 'Wrap-up',
  };
  return (
    <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
      {LABELS[phase]}
    </span>
  );
}

function BigButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: 'green' | 'amber';
}) {
  const bg = tone === 'green' ? 'var(--color-accent-green)' : 'var(--color-accent-amber)';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ background: bg }}
      className="rounded-md px-6 py-2.5 font-semibold text-black disabled:opacity-40"
    >
      {children}
    </button>
  );
}
