import { useEffect, useMemo, useState } from 'react';
import { subscribeAttempts, subscribeStudents } from '../firebase/attempts';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import { buildRoster, sortRoster, subscribeLiveState, type RosterSort } from '../firebase/liveSession';
import {
  DEFAULT_LIVE_STATE,
  type AttemptRow,
  type ClassSettings,
  type LeaderboardRow,
  type LiveSessionState,
  type StudentRow,
} from '../firebase/types';
import { CHALLENGE_BY_KEY } from '../challenges/definitions';

const SORTS: { key: RosterSort; label: string }[] = [
  { key: 'unsubmitted', label: 'Stragglers first' },
  { key: 'recent', label: 'Most recent activity' },
  { key: 'alphabetical', label: 'A–Z' },
];

function ago(ts: number | null, now: number): string {
  if (!ts) return '—';
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Embedded as a section of the Live Control tab.
export function RosterPanel({ classCode, settings }: { classCode: string; settings: ClassSettings }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [results, setResults] = useState<LeaderboardRow[]>([]);
  const [live, setLive] = useState<LiveSessionState>(DEFAULT_LIVE_STATE);
  const [sort, setSort] = useState<RosterSort>('unsubmitted');
  // Re-tick so "3m ago" and the nudge flag stay honest without a refresh.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeStudents(classCode, setStudents), [classCode]);
  useEffect(() => subscribeAttempts(classCode, setAttempts), [classCode]);
  useEffect(() => subscribeLeaderboard(classCode, null, setResults), [classCode]);
  useEffect(() => subscribeLiveState(classCode, setLive), [classCode]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // Current-challenge columns only mean something during a live session.
  const currentChallenge = settings.liveSessionMode ? live.currentChallenge : null;

  const rows = useMemo(
    () => sortRoster(buildRoster(students, attempts, results, currentChallenge, now), sort),
    [students, attempts, results, currentChallenge, now, sort],
  );

  const submitted = rows.filter((r) => r.hasSubmitted).length;
  const stuck = rows.filter((r) => r.needsNudge).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Roster &amp; activity
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {students.length} joined
            {currentChallenge && (
              <>
                {' · '}
                {submitted} submitted for {CHALLENGE_BY_KEY[currentChallenge]?.shortLabel ?? currentChallenge}
                {stuck > 0 && (
                  <span className="text-[var(--color-accent-amber)]"> · {stuck} may need a nudge</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                sort === s.key
                  ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {!currentChallenge && (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-muted)]">
          {settings.liveSessionMode
            ? 'No challenge is live yet — start the class to see per-challenge progress.'
            : 'Self-paced class: showing who has joined and how recently they were active.'}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-raised)] text-xs uppercase text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Joined</th>
              {currentChallenge && <th className="px-4 py-2 text-center">Attempted</th>}
              {currentChallenge && <th className="px-4 py-2 text-center">Submitted</th>}
              <th className="px-4 py-2 text-right">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  Nobody has joined yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.studentId}
                className={`border-t border-[var(--color-border)]/40 ${
                  r.needsNudge ? 'bg-[var(--color-accent-amber)]/10' : ''
                }`}
              >
                <td className="px-4 py-2 font-medium">
                  {r.displayName}
                  {r.needsNudge && <span className="ml-2 text-xs text-[var(--color-accent-amber)]">may be stuck</span>}
                </td>
                <td className="px-4 py-2 text-[var(--color-text-secondary)]">
                  {r.joinedAt ? new Date(r.joinedAt).toLocaleTimeString() : '—'}
                </td>
                {currentChallenge && (
                  <td className="px-4 py-2 text-center">
                    {r.hasAttempted ? <span className="text-[var(--color-accent-green)]">✓</span> : '—'}
                  </td>
                )}
                {currentChallenge && (
                  <td className="px-4 py-2 text-center">
                    {r.hasSubmitted ? <span className="text-[var(--color-accent-green)]">✓</span> : '—'}
                  </td>
                )}
                <td className="px-4 py-2 text-right font-mono text-xs text-[var(--color-text-muted)]">
                  {ago(r.lastActivity, now)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
