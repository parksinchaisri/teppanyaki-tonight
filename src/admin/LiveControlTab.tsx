import { useEffect, useMemo, useState } from 'react';
import { updateSettingsFields } from '../firebase/classSettings';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import { subscribeStudents } from '../firebase/attempts';
import { startClass, subscribeLiveState } from '../firebase/liveSession';
import { firebaseConfigured } from '../firebase/config';
import {
  DEFAULT_LIVE_STATE,
  activeChallengeKeys,
  leaderboardVisibleFor,
  theaterJoinUrlDisplay,
  type ClassSettings,
  type LeaderboardRow,
  type LiveSessionState,
  type StudentRow,
} from '../firebase/types';
import type { ParamOverrides } from '../engine/types';
import { CHALLENGE_BY_KEY } from '../challenges/definitions';
import { QuickCompare } from './QuickCompare';
import { RosterPanel } from './RosterPanel';

interface Props {
  classCode: string;
  settings: ClassSettings;
  params: ParamOverrides;
}

const PHASE_LABELS: Record<LiveSessionState['phase'], string> = {
  lobby: 'Lobby — not started',
  briefing: 'Briefing',
  timed_round: 'Round in progress',
  round_results: 'Round results',
  wrap_up: 'Wrap-up',
};

// Everything an instructor touches while a session is actually running.
export function LiveControlTab({ classCode, settings, params }: Props) {
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [live, setLive] = useState<LiveSessionState>(DEFAULT_LIVE_STATE);

  useEffect(() => subscribeLeaderboard(classCode, null, setRows), [classCode]);
  useEffect(() => subscribeStudents(classCode, setStudents), [classCode]);
  useEffect(() => subscribeLiveState(classCode, setLive), [classCode]);

  const keys = useMemo(() => activeChallengeKeys(settings), [settings]);

  async function patch(p: Partial<ClassSettings>) {
    setSaving(true);
    await updateSettingsFields(classCode, p as Record<string, unknown>);
    setSaving(false);
  }

  async function patchMap<T>(field: 'leaderboardVisible', key: string, value: T) {
    setSaving(true);
    await updateSettingsFields(classCode, { [`${field}.${key}`]: value });
    setSaving(false);
  }

  function toggleUnlocked(key: string) {
    const cur = settings.unlockedChallenges ?? [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    return patch({ unlockedChallenges: next });
  }

  // Anyone who has submitted has necessarily joined, but the `students` roster
  // only covers joins recorded by this build — so never let the denominator sit
  // below the number of distinct students actually seen submitting.
  const joined = Math.max(students.length, new Set(rows.map((r) => r.studentId)).size);
  const submittedFor = (key: string) =>
    new Set(rows.filter((r) => r.challengeKey === key).map((r) => r.studentId)).size;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live Control</h1>
        <span className="text-xs text-[var(--color-text-muted)]">
          {firebaseConfigured ? (saving ? 'Saving…' : 'Live-saved') : 'Demo mode — not persisted'}
        </span>
      </div>

      {!settings.liveSessionMode && (
        <p className="rounded-md border border-[var(--color-accent-amber)]/40 bg-[var(--color-accent-amber)]/10 p-3 text-sm text-[var(--color-accent-amber)]">
          Live Session Mode is off — students are self-paced. Turn it on in Setup to gate unlocks from here.
        </p>
      )}

      {/* Theater Mode launcher + a read-only view of where the class currently is,
          so an instructor working from this tab alone still knows the phase. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-secondary)]">Live session:</span>
            <span className="font-medium">{PHASE_LABELS[live.phase]}</span>
            {live.currentChallenge && (
              <span className="text-[var(--color-text-secondary)]">
                · {CHALLENGE_BY_KEY[live.currentChallenge]?.title ?? live.currentChallenge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Theater Mode is the projected host view — lobby, briefing, timer and results.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {live.phase === 'lobby' && (
            <button
              onClick={() => void startClass(classCode, settings)}
              className="rounded-md bg-[var(--color-accent-green)] px-4 py-2 text-sm font-medium text-black"
            >
              ▶ Start Class
            </button>
          )}
          <button
            onClick={() => window.open(`${import.meta.env.BASE_URL}admin/theater`, '_blank')}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Open Theater Mode ↗
          </button>
        </div>

        {/* What the projected lobby shows for joining. */}
        <div className="mt-3 w-full border-t border-[var(--color-border)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-text-secondary)]">Lobby join link</span>
              <select
                value={theaterJoinUrlDisplay(settings)}
                onChange={(e) => patch({ theaterJoinUrlDisplay: e.target.value as ClassSettings['theaterJoinUrlDisplay'] })}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
              >
                <option value="full">Show full site URL</option>
                <option value="custom">Show a custom link</option>
                <option value="hidden">Hide the link (class code only)</option>
              </select>
            </label>
            {theaterJoinUrlDisplay(settings) === 'custom' && (
              <input
                value={settings.theaterCustomJoinUrl ?? ''}
                onChange={(e) => patch({ theaterCustomJoinUrl: e.target.value })}
                placeholder="e.g. tinyurl.com/teppanyaki"
                className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]"
              />
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            The class code is always shown on the lobby screen — students need it even when they get the link
            elsewhere.
          </p>
        </div>
      </div>


      {/* ── Per-challenge live controls ────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Challenge progress
        </h2>
        {keys.map((key) => {
          const def = CHALLENGE_BY_KEY[key];
          const unlocked = (settings.unlockedChallenges ?? []).includes(key);
          const submitted = submittedFor(key);
          const revealed = leaderboardVisibleFor(settings, key);
          return (
            <div key={key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-[var(--color-text-muted)]">{def?.index ?? '–'}</span>
                <span className="font-medium">{def?.title ?? key}</span>

                {settings.liveSessionMode && (
                  <button
                    onClick={() => toggleUnlocked(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                      unlocked
                        ? 'bg-[var(--color-accent-green)] text-black'
                        : 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {unlocked ? '🔓 Unlocked' : '🔒 Locked'}
                  </button>
                )}

                <button
                  onClick={() => patchMap('leaderboardVisible', key, !revealed)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    revealed
                      ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'
                      : 'bg-[var(--color-accent)] text-white'
                  }`}
                >
                  {revealed ? 'Hide Leaderboard' : 'Reveal Leaderboard'}
                </button>

                <span className="ml-auto font-mono text-sm">
                  <span className="text-[var(--color-accent-green)]">{submitted}</span>
                  <span className="text-[var(--color-text-muted)]"> / {joined} submitted</span>
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Roster / activity ──────────────────────────────────────────────── */}
      <RosterPanel classCode={classCode} settings={settings} />

      <QuickCompare classCode={classCode} settings={settings} params={params} rows={rows} keys={keys} />
    </div>
  );
}
