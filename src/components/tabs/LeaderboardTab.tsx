import { useEffect, useState } from 'react';
import { useApp } from '../../store/appContext';
import { subscribeLeaderboard } from '../../firebase/leaderboard';
import { firebaseConfigured } from '../../firebase/config';
import type { LeaderboardRow } from '../../firebase/types';
import { CHALLENGES } from '../../challenges/definitions';
import { LeaderboardView } from '../leaderboard/LeaderboardView';

export function LeaderboardTab() {
  const { session, settings } = useApp();
  const [challenge, setChallenge] = useState(settings.activeLeaderboardChallenge || 'batching');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    if (!session) return;
    const unsub = subscribeLeaderboard(session.classCode, challenge, setRows);
    return unsub;
  }, [session, challenge]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Class Leaderboard</h1>
        <div className="flex flex-wrap gap-1.5">
          {CHALLENGES.map((c) => (
            <button
              key={c.key}
              onClick={() => setChallenge(c.key)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                challenge === c.key
                  ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {c.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {!firebaseConfigured && (
        <div className="rounded-md border border-[var(--color-accent-amber)]/40 bg-[var(--color-accent-amber)]/10 p-3 text-sm text-[var(--color-accent-amber)]">
          Demo mode — leaderboard is disabled because Firebase isn&apos;t configured.
        </div>
      )}

      <LeaderboardView rows={rows} metric={settings.leaderboardMetric} highlightStudentId={session?.studentId} />
    </div>
  );
}
