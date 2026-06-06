import { useEffect, useState } from 'react';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import type { ClassSettings, LeaderboardRow } from '../firebase/types';
import { challengeLabel } from '../challenges/definitions';
import { LeaderboardView } from '../components/leaderboard/LeaderboardView';

export function LiveBoardTab({ classCode, settings }: { classCode: string; settings: ClassSettings }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [theater, setTheater] = useState(false);
  const [tick, setTick] = useState(0);

  const challengeFilter =
    settings.leaderboardMode === 'final'
      ? 'finalChallenge'
      : settings.activeLeaderboardChallenge === 'all'
        ? null
        : settings.activeLeaderboardChallenge;

  useEffect(() => {
    const unsub = subscribeLeaderboard(classCode, challengeFilter, setRows);
    return unsub;
  }, [classCode, challengeFilter, tick]);

  const title =
    challengeFilter === null ? 'All Challenges' : challengeLabel(challengeFilter);

  const board = (
    <LeaderboardView rows={rows} metric={settings.leaderboardMetric} big={theater} />
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
            <button
              onClick={() => setTheater(false)}
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
            >
              Exit Theater
            </button>
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
            Live — updates as students submit. {rows.length} {rows.length === 1 ? 'entry' : 'entries'}.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTick((t) => t + 1)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setTheater(true)}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Theater Mode
          </button>
        </div>
      </div>
      {board}
    </div>
  );
}
