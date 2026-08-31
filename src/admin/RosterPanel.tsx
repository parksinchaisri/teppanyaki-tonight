import { useEffect, useMemo, useState } from 'react';
import { subscribeAttempts, subscribeStudents } from '../firebase/attempts';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import { removeStudent, renameStudent } from '../firebase/students';
import {
  buildRoster,
  formatCurrentView,
  presenceStatus,
  sortRoster,
  subscribeLiveState,
  type PresenceStatus,
  type RosterSort,
} from '../firebase/liveSession';
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

const PRESENCE: Record<PresenceStatus, { dot: string; label: string; tone: string }> = {
  active: { dot: '🟢', label: 'Active', tone: 'text-[var(--color-accent-green)]' },
  idle: { dot: '🟡', label: 'Idle', tone: 'text-[var(--color-accent-amber)]' },
  away: { dot: '⚪', label: 'Away', tone: 'text-[var(--color-text-muted)]' },
};

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
  // Non-null while a remove is being confirmed, or a name is being edited.
  const [confirming, setConfirming] = useState<{ studentId: string; displayName: string } | null>(null);
  const [editing, setEditing] = useState<{ studentId: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
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

  // buildRoster deliberately knows nothing about presence, so keep the raw
  // student documents to hand for the status column.
  const presenceById = useMemo(
    () => new Map(students.map((s) => [s.id, { currentView: s.currentView, lastSeenAt: s.lastSeenAt }])),
    [students],
  );

  const submitted = rows.filter((r) => r.hasSubmitted).length;
  const stuck = rows.filter((r) => r.needsNudge).length;
  const active = rows.filter((r) => presenceStatus(presenceById.get(r.studentId)?.lastSeenAt ?? 0, now) === 'active')
    .length;

  async function doRename(studentId: string, value: string) {
    setBusy(true);
    setNotice('');
    try {
      const res = await renameStudent(classCode, studentId, value);
      setNotice(
        `Renamed to “${value.trim()}”` +
          (res.resultsUpdated ? ` · ${res.resultsUpdated} leaderboard entr${res.resultsUpdated === 1 ? 'y' : 'ies'} updated.` : '.'),
      );
      setEditing(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Rename failed.');
    }
    setBusy(false);
  }

  async function doRemove(studentId: string, cascade: boolean) {
    setBusy(true);
    setNotice('');
    try {
      const res = await removeStudent(classCode, studentId, cascade);
      setNotice(
        cascade
          ? `Removed, along with ${res.deleted} of their document${res.deleted === 1 ? '' : 's'}.`
          : 'Removed from the roster. Their attempts, results and reflections were kept.',
      );
      setConfirming(null);
    } catch {
      setNotice('Could not remove that student.');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Roster &amp; activity
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {students.length} joined · {active} active now
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

      {notice && (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-secondary)]">
          {notice}
        </p>
      )}

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
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Joined</th>
              {currentChallenge && <th className="px-4 py-2 text-center">Attempted</th>}
              {currentChallenge && <th className="px-4 py-2 text-center">Submitted</th>}
              <th className="px-4 py-2 text-right">Last activity</th>
              <th className="px-4 py-2 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  Nobody has joined yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const p = presenceById.get(r.studentId);
              const status = PRESENCE[presenceStatus(p?.lastSeenAt ?? 0, now)];
              const isEditing = editing?.studentId === r.studentId;
              return (
                <tr
                  key={r.studentId}
                  className={`border-t border-[var(--color-border)]/40 ${
                    r.needsNudge ? 'bg-[var(--color-accent-amber)]/10' : ''
                  }`}
                >
                  <td className="px-4 py-2 font-medium">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editing.value}
                        onChange={(e) => setEditing({ studentId: r.studentId, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void doRename(r.studentId, editing.value);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        maxLength={30}
                        className="w-40 rounded-md border border-[var(--color-accent)] bg-[var(--color-surface-raised)] px-2 py-1 text-sm outline-none"
                      />
                    ) : (
                      <>
                        {r.displayName}
                        {r.needsNudge && (
                          <span className="ml-2 text-xs text-[var(--color-accent-amber)]">may be stuck</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`whitespace-nowrap text-xs ${status.tone}`}>
                      {status.dot} {status.label}
                    </span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                      {formatCurrentView(p?.currentView ?? '', (k) => CHALLENGE_BY_KEY[k]?.shortLabel)}
                    </span>
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
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => void doRename(r.studentId, editing.value)}
                          disabled={busy || editing.value.trim().length < 2}
                          className="rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs text-white disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="ml-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing({ studentId: r.studentId, value: r.displayName })}
                          title="Rename this student"
                          aria-label={`Rename ${r.displayName}`}
                          className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setConfirming({ studentId: r.studentId, displayName: r.displayName })}
                          title="Remove this student from the class"
                          aria-label={`Remove ${r.displayName}`}
                          className="ml-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent-red)] hover:text-[var(--color-accent-red)]"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirming && (
        <RemoveDialog
          displayName={confirming.displayName}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={(cascade) => void doRemove(confirming.studentId, cascade)}
        />
      )}
    </div>
  );
}

// Two separate decisions, deliberately: removing someone from the roster is
// routine, destroying their work is not. The cascade box starts unchecked and
// spells out exactly what it would take with it.
function RemoveDialog({
  displayName,
  busy,
  onCancel,
  onConfirm,
}: {
  displayName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (cascade: boolean) => void;
}) {
  const [cascade, setCascade] = useState(false);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="text-lg font-semibold">Remove {displayName}?</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          They will be signed out of this class immediately. Rejoining puts them back as a new student.
        </p>
        <label className="mt-4 flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 text-sm">
          <input
            type="checkbox"
            checked={cascade}
            onChange={(e) => setCascade(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also delete this student&apos;s attempts, results, and reflections
            <span className="block text-xs text-[var(--color-text-muted)]">
              Leave unchecked to keep their data for analysis. This cannot be undone.
            </span>
          </span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(cascade)}
            disabled={busy}
            className="rounded-md bg-[var(--color-accent-red)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Removing…' : cascade ? 'Remove and delete data' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
