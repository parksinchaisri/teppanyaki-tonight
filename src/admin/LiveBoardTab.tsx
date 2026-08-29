import { useEffect, useMemo, useState } from 'react';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import { subscribeStudents } from '../firebase/attempts';
import { subscribeLiveState } from '../firebase/liveSession';
import { updateSettingsFields } from '../firebase/classSettings';
import {
  DEFAULT_LIVE_STATE,
  activeChallengeKeys,
  leaderboardVisibleFor,
  type ClassSettings,
  type LeaderboardRow,
  type LiveSessionState,
  type StudentRow,
} from '../firebase/types';
import { CHALLENGE_BY_KEY, challengeLabel } from '../challenges/definitions';
import { RankBoard } from './RankBoard';

export function LiveBoardTab({ classCode, settings }: { classCode: string; settings: ClassSettings }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [live, setLive] = useState<LiveSessionState>(DEFAULT_LIVE_STATE);
  const [theater, setTheater] = useState(false);

  // D1: which challenge the board shows and whether it is revealed are decided
  // here, not buried in class Settings. Local to this tab so an instructor can
  // look at one challenge without changing anyone else's view.
  const order = useMemo(() => activeChallengeKeys(settings), [settings]);
  const [challenge, setChallenge] = useState<string>(() => settings.activeLeaderboardChallenge || order[0]);
  const [view, setView] = useState<'round' | 'cumulative'>('round');

  useEffect(() => {
    if (order.length && !order.includes(challenge)) setChallenge(order[0]);
  }, [order, challenge]);

  // The board needs every challenge's rows to compute cumulative totals.
  useEffect(() => subscribeLeaderboard(classCode, null, setRows), [classCode]);
  useEffect(() => subscribeStudents(classCode, setStudents), [classCode]);
  useEffect(() => subscribeLiveState(classCode, setLive), [classCode]);

  const revealed = leaderboardVisibleFor(settings, challenge);
  const title = view === 'cumulative' ? 'Cumulative Standings' : challengeLabel(challenge);
  const entries = rows.filter((r) => r.challengeKey === challenge).length;

  const board = (
    <RankBoard
      rows={rows}
      students={students}
      order={order}
      challengeKey={challenge}
      view={view}
      roundHistory={live.roundHistory}
      compact={!theater}
      maxHeight={theater ? 'calc(100vh - 14rem)' : undefined}
    />
  );

  const viewToggle = (
    <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {(['round', 'cumulative'] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            view === v
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {v === 'round' ? 'This Round' : 'Cumulative'}
        </button>
      ))}
    </div>
  );

  if (theater) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)] p-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="font-mono text-sm uppercase tracking-[0.3em] text-[var(--color-accent)]">
                Teppanyaki Tonight · Live
              </div>
              <h1 className="text-4xl font-bold">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {viewToggle}
              <button
                onClick={() => setTheater(false)}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
              >
                Exit Theater
              </button>
            </div>
          </div>
          {board}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Live — updates as students submit. {entries} {entries === 1 ? 'entry' : 'entries'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewToggle}
          <button
            onClick={() => setTheater(true)}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Fullscreen
          </button>
        </div>
      </div>

      {/* Board controls, local to this tab */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-secondary)]">Challenge</span>
          <select
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
          >
            {order.map((k) => (
              <option key={k} value={k}>
                {CHALLENGE_BY_KEY[k]?.title ?? k}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => void updateSettingsFields(classCode, { [`leaderboardVisible.${challenge}`]: !revealed })}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            revealed
              ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'
              : 'bg-[var(--color-accent)] text-white'
          }`}
        >
          {revealed ? 'Hide from students' : 'Reveal to students'}
        </button>
        <span className="text-xs text-[var(--color-text-muted)]">
          {revealed ? 'Students can see this challenge’s leaderboard.' : 'Hidden from students.'}
        </span>
      </div>

      {board}
    </div>
  );
}
