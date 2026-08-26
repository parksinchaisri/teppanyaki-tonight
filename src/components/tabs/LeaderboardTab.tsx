import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/appContext';
import { subscribeLeaderboard } from '../../firebase/leaderboard';
import { firebaseConfigured } from '../../firebase/config';
import { activeChallengeKeys, leaderboardVisibleFor, type LeaderboardRow } from '../../firebase/types';
import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { LeaderboardView } from '../leaderboard/LeaderboardView';

export function LeaderboardTab() {
  const { session, settings } = useApp();
  const keys = useMemo(() => activeChallengeKeys(settings), [settings]);
  const list = useMemo(() => keys.map((k) => CHALLENGE_BY_KEY[k]).filter(Boolean), [keys]);
  const [challenge, setChallenge] = useState(settings.activeLeaderboardChallenge || 'batching');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  // Keep the selected board inside the instructor's playlist.
  useEffect(() => {
    if (list.length && !keys.includes(challenge)) setChallenge(list[0].key);
  }, [keys, list, challenge]);

  useEffect(() => {
    if (!session) return;
    const unsub = subscribeLeaderboard(session.classCode, challenge, setRows);
    return unsub;
  }, [session, challenge]);

  // Hidden by the instructor until enough of the class has submitted — this is
  // what keeps a student's first attempt independent of everyone else's.
  const revealed = leaderboardVisibleFor(settings, challenge);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Class Leaderboard</h1>
        <div className="flex flex-wrap gap-1.5">
          {list.map((c) => (
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

      {revealed ? (
        <LeaderboardView rows={rows} metric={settings.leaderboardMetric} highlightStudentId={session?.studentId} />
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
          🙈 Your instructor will reveal results after everyone has submitted.
        </div>
      )}
    </div>
  );
}
