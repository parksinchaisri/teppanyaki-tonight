import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  setRoundView,
  startClass,
  startTimer,
  subscribeLiveState,
} from '../firebase/liveSession';
import {
  DEFAULT_LIVE_STATE,
  DEFAULT_ROUND_SECONDS,
  DEFAULT_SETTINGS,
  activeChallengeKeys,
  theaterJoinUrlDisplay,
  type ClassSettings,
  type LeaderboardRow,
  type LiveSessionState,
  type StudentRow,
} from '../firebase/types';
import { CHALLENGE_BY_KEY } from '../challenges/definitions';
import { money } from '../lib/format';
import { useCountdown } from '../components/shared/useCountdown';
import { RankBoard } from './RankBoard';
import { avatarInitial, avatarStyle } from '../lib/avatar';

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
  // A3: shown for a beat when the round closes itself because everyone is in.
  const [autoClosing, setAutoClosing] = useState(false);
  const autoCloseFired = useRef<string | null>(null);

  useEffect(() => subscribeSettings(classCode, (s) => setSettings(s)), [classCode]);
  useEffect(() => subscribeLiveState(classCode, setLive), [classCode]);
  useEffect(() => subscribeStudents(classCode, setStudents), [classCode]);
  useEffect(() => subscribeLeaderboard(classCode, null, setRows), [classCode]);

  const order = useMemo(() => activeChallengeKeys(settings), [settings]);
  const def = live.currentChallenge ? CHALLENGE_BY_KEY[live.currentChallenge] : null;
  const isLast = live.currentChallenge ? nextChallengeKey(order, live.currentChallenge) === null : false;

  const submittedCount = useMemo(
    () => new Set(rows.filter((r) => r.challengeKey === live.currentChallenge).map((r) => r.studentId)).size,
    [rows, live.currentChallenge],
  );

  const closeRound = useCallback(
    async (challengeKey: string) => {
      const res = await endRound(classCode, challengeKey);
      setNotice(
        `Round closed — ${res.forced} result${res.forced === 1 ? '' : 's'} auto-submitted` +
          (res.noSubmission ? `, ${res.noSubmission} with no submission.` : '.'),
      );
    },
    [classCode],
  );

  // A3: the moment every student on the roster has submitted, close the round
  // itself rather than waiting out the clock. Guarded per challenge so it fires
  // once, and it needs a non-empty roster or an empty class would close instantly.
  useEffect(() => {
    const key = live.currentChallenge;
    if (live.phase !== 'timed_round' || !key) return;
    if (autoCloseFired.current === key) return;
    const joined = students.length;
    if (joined === 0 || submittedCount < joined) return;

    autoCloseFired.current = key;
    setAutoClosing(true);
    const id = setTimeout(() => {
      void closeRound(key).finally(() => setAutoClosing(false));
    }, 2000);
    return () => clearTimeout(id);
  }, [live.phase, live.currentChallenge, submittedCount, students.length, closeRound]);

  // Let a re-run of the same challenge (after a reset) auto-close again.
  useEffect(() => {
    if (live.phase === 'lobby') autoCloseFired.current = null;
  }, [live.phase]);

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
          onClick={() => run(() => closeRound(live.currentChallenge as string), 'Could not end the round.')}
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
        {live.phase === 'lobby' && (
          <LobbyView
            classCode={classCode}
            students={students}
            joinDisplay={theaterJoinUrlDisplay(settings)}
            customUrl={settings.theaterCustomJoinUrl ?? ''}
          />
        )}
        {live.phase === 'briefing' && (
          <BriefingView title={def?.title} description={def?.description} levers={def?.levers ?? []} />
        )}
        {live.phase === 'timed_round' && (
          <TimedRoundView
            live={live}
            submitted={submittedCount}
            students={students}
            autoClosing={autoClosing}
          />
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

function LobbyView({
  classCode,
  students,
  joinDisplay,
  customUrl,
}: {
  classCode: string;
  students: StudentRow[];
  joinDisplay: 'full' | 'custom' | 'hidden';
  customUrl: string;
}) {
  // Auto-detected from wherever this is actually served, never hardcoded.
  const siteUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const shownUrl = joinDisplay === 'custom' ? customUrl.trim() : joinDisplay === 'full' ? siteUrl : '';
  const sorted = useMemo(() => [...students].sort((a, b) => a.joinedAt - b.joinedAt), [students]);

  // Re-keying the counter on every increment restarts its animation, so each
  // arrival gets a visible beat rather than the number silently changing.
  const [pulseKey, setPulseKey] = useState(0);
  const lastCount = useRef(sorted.length);
  useEffect(() => {
    if (sorted.length > lastCount.current) setPulseKey((k) => k + 1);
    lastCount.current = sorted.length;
  }, [sorted.length]);

  return (
    // Sized to the viewport so the roster grid absorbs whatever space is left
    // rather than pushing the flavor line off a projected screen. A fixed
    // reserve broke as soon as the join URL was hidden or the roster grew.
    <div className="flex h-[calc(100vh-9rem)] flex-col text-center">
      <style>{`
        @keyframes theaterPop{0%{opacity:0;transform:scale(.6) translateY(8px)}60%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
        @keyframes counterPulse{0%{transform:scale(1)}35%{transform:scale(1.14)}100%{transform:scale(1)}}
        @keyframes flavorIn{from{opacity:0;transform:translateY(6px)}to{opacity:.85;transform:none}}
      `}</style>

      {shownUrl && (
        <div className="shrink-0">
          <p className="text-xl uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Join at</p>
          <p className="mt-3 break-all font-mono text-4xl text-[var(--color-accent)] lg:text-5xl">{shownUrl}</p>
        </div>
      )}
      {/* The class code is shown in every mode — students need it to join even
          when the link reached them some other way. */}
      <p className={`shrink-0 ${shownUrl ? 'mt-8' : ''} text-xl uppercase tracking-[0.3em] text-[var(--color-text-muted)]`}>
        Class code
      </p>
      <p className="shrink-0 font-mono text-7xl font-bold lg:text-8xl">{classCode}</p>

      <p key={pulseKey} style={{ animation: 'counterPulse .5s ease-out' }} className="mt-8 shrink-0">
        <span className="font-mono text-6xl font-bold text-[var(--color-accent-green)] lg:text-7xl">
          {sorted.length}
        </span>
        <span className="ml-3 text-2xl text-[var(--color-text-secondary)] lg:text-3xl">
          {sorted.length === 1 ? 'chef' : 'chefs'} in the kitchen
        </span>
      </p>

      {/* Wraps and scrolls the same way the leaderboard does, so a full class
          stays legible instead of overflowing the projected screen. */}
      <div className="mx-auto mt-6 flex min-h-0 w-full max-w-5xl flex-1 flex-wrap content-start justify-center gap-3 overflow-y-auto px-1 pb-1">
        {sorted.map((s) => (
          <StudentChip key={s.id} name={s.displayName} />
        ))}
        {!sorted.length && (
          <span className="self-center text-xl text-[var(--color-text-muted)]">Waiting for students to join…</span>
        )}
      </div>

      <FlavorStrip />
    </div>
  );
}

function StudentChip({ name }: { name: string }) {
  const style = avatarStyle(name);
  return (
    <span
      style={{ animation: 'theaterPop .45s cubic-bezier(.2,.9,.3,1.2)' }}
      className="flex items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-1.5 pr-4"
    >
      <span
        aria-hidden
        style={{ background: style.background, borderColor: style.border, color: style.color }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-lg font-bold"
      >
        {avatarInitial(name)}
      </span>
      <span className="text-xl">{name}</span>
    </span>
  );
}

// Purely cosmetic filler while students trickle in — no data behind it.
const FLAVOR_LINES = [
  'One chef. Eight seats. Zero mercy.',
  'The bar is where patience goes to die.',
  'An empty chair is a chef cooking for nobody.',
  'Tonight the grill does not wait for stragglers.',
  'Every table of four costs you half a chef.',
  'Peak hour is coming. It always comes.',
  'Drinks are profit. Waiting is not.',
  'Somewhere, a party of six is deciding to leave.',
];

function FlavorStrip() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % FLAVOR_LINES.length), 4500);
    return () => clearInterval(id);
  }, []);
  return (
    <p
      key={i}
      style={{ animation: 'flavorIn .6s ease-out forwards' }}
      className="mt-6 shrink-0 text-xl italic tracking-wide text-[var(--color-text-muted)] lg:text-2xl"
    >
      {FLAVOR_LINES[i]}
    </p>
  );
}

function BriefingView({
  title,
  description,
  levers,
}: {
  title?: string;
  description?: string;
  levers: string[];
}) {
  return (
    <div className="mx-auto max-w-5xl text-center">
      <p className="text-xl uppercase tracking-[0.3em] text-[var(--color-accent)]">Next challenge</p>
      <h1 className="mt-5 text-5xl font-bold leading-tight lg:text-6xl">{title ?? 'Challenge'}</h1>
      <p className="mt-6 text-xl leading-relaxed text-[var(--color-text-secondary)] lg:text-2xl">{description}</p>

      {/* D4: what students can actually change this round — something concrete
          to point at while the Simulate button is still held. */}
      {levers.length > 0 && (
        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-left">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-accent)]">What you can change</p>
          <ul className="mt-3 space-y-2">
            {levers.map((l) => (
              <li key={l} className="flex gap-3 text-lg text-[var(--color-text-secondary)] lg:text-xl">
                <span className="text-[var(--color-accent)]">▸</span>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TimedRoundView({
  live,
  submitted,
  students,
  autoClosing,
}: {
  live: LiveSessionState;
  submitted: number;
  students: StudentRow[];
  autoClosing: boolean;
}) {
  const { label, expired } = useCountdown(live.timer?.endsAt ?? null);
  const joined = Math.max(students.length, submitted);

  if (autoClosing) {
    return (
      <div className="text-center">
        <p className="text-6xl font-bold text-[var(--color-accent-green)] lg:text-7xl">
          Everyone&apos;s in — closing the round!
        </p>
        <p className="mt-6 font-mono text-4xl text-[var(--color-text-secondary)]">
          {submitted} / {joined} submitted
        </p>
      </div>
    );
  }

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
      <RankBoard
        rows={rows}
        students={students}
        order={order}
        challengeKey={challengeKey}
        view={view}
        roundHistory={live.roundHistory}
      />
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
        <div className="mt-8 max-h-[40vh] space-y-2 overflow-y-auto pr-1 text-left">
          {rest.map((s, i) => (
            <div
              key={s.studentId}
              className={`flex items-center justify-between rounded-xl border px-6 py-3 ${
                s.submitted
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                  : 'border-dashed border-[var(--color-border)] opacity-50'
              }`}
            >
              <span className="flex items-center gap-4">
                <span className="w-10 font-mono text-xl text-[var(--color-text-muted)]">
                  {s.submitted ? podium.length + i + 1 : '—'}
                </span>
                <span className="text-xl">{s.studentName}</span>
              </span>
              {s.submitted ? (
                <span className="font-mono text-xl text-[var(--color-accent-green)]">{money(s.value)}</span>
              ) : (
                <span className="text-[var(--color-text-muted)]">No submission</span>
              )}
            </div>
          ))}
        </div>
      )}
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
