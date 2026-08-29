import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/appContext';
import { subscribeLeaderboard } from '../../firebase/leaderboard';
import { firebaseConfigured } from '../../firebase/config';
import { activeChallengeKeys, leaderboardVisibleFor, type LeaderboardRow } from '../../firebase/types';
import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { ClassDistribution } from '../leaderboard/ClassDistribution';
import { money } from '../../lib/format';

// Students see only where they stand — their own rank and score, plus the shape
// of the class distribution. No other student's name or score appears here.
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

  const value = (r: LeaderboardRow) =>
    settings.leaderboardMetric === 'maxProfit' ? r.bestMaxProfit : r.bestAvgProfit;

  // "of Y" counts students who actually submitted for this challenge, not the
  // whole roster.
  const ranked = useMemo(() => [...rows].sort((a, b) => value(b) - value(a)), [rows, settings.leaderboardMetric]);
  const myIndex = ranked.findIndex((r) => r.studentId === session?.studentId);
  const me = myIndex >= 0 ? ranked[myIndex] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Where You Stand</h1>
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

      {!revealed ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
          🙈 Your instructor will reveal results after everyone has submitted.
        </div>
      ) : !me ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
          Submit a result for this challenge to see where you land.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-8 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Your rank</p>
            <p className="mt-2 font-mono text-6xl font-bold lg:text-7xl">
              #{myIndex + 1}
              <span className="ml-3 text-2xl font-normal text-[var(--color-text-muted)]">
                of {ranked.length}
              </span>
            </p>
            <p className="mt-4 font-mono text-4xl text-[var(--color-accent-green)] lg:text-5xl">{money(value(me))}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              {settings.leaderboardMetric === 'maxProfit' ? 'Your best night' : 'Your average profit'}
            </p>
          </div>

          <ClassDistribution rows={ranked} value={value} highlightStudentId={session?.studentId} />
        </>
      )}
    </div>
  );
}
