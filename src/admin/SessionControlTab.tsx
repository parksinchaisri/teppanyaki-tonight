import { useEffect, useMemo, useState } from 'react';
import { updateSettingsFields } from '../firebase/classSettings';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import { subscribeStudents } from '../firebase/attempts';
import { startClass, subscribeLiveState } from '../firebase/liveSession';
import { firebaseConfigured } from '../firebase/config';
import {
  ALL_CHALLENGE_KEYS,
  activeChallengeKeys,
  confidenceRatingEnabledFor,
  finalChallengeLevers,
  leaderboardVisibleFor,
  maxAttemptsFor,
  reflectionsRequiredFor,
  DEFAULT_LIVE_STATE,
  type ClassSettings,
  type FinalChallengeLevers,
  type LeaderboardRow,
  type LiveSessionState,
  type StudentRow,
} from '../firebase/types';
import { CHALLENGE_BY_KEY } from '../challenges/definitions';
import { runChallenge } from '../engine/simulation';
import type { ParamOverrides, SimConfig } from '../engine/types';
import { money, pct } from '../lib/format';
import { AnimationPanel } from '../components/animation/AnimationPanel';
import { DualCharts } from '../components/results/DualCharts';
import { ComparePanel, type SavedRun } from '../components/results/ComparePanel';

interface Props {
  classCode: string;
  settings: ClassSettings;
  params: ParamOverrides;
}

// The Final Challenge lever each challenge corresponds to, used to pre-populate
// the levers the first time Live Session Mode is switched on.
const LEVER_SOURCE: Record<keyof FinalChallengeLevers, string> = {
  batching: 'batching',
  barSize: 'barSize',
  diningTime: 'diningTime',
  advertising: 'advertising',
};

const PHASE_LABELS: Record<LiveSessionState['phase'], string> = {
  lobby: 'Lobby — not started',
  briefing: 'Briefing',
  timed_round: 'Round in progress',
  round_results: 'Round results',
  wrap_up: 'Wrap-up',
};

export function SessionControlTab({ classCode, settings, params }: Props) {
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [live, setLive] = useState<LiveSessionState>(DEFAULT_LIVE_STATE);

  useEffect(() => subscribeLeaderboard(classCode, null, setRows), [classCode]);
  useEffect(() => subscribeStudents(classCode, setStudents), [classCode]);
  useEffect(() => subscribeLiveState(classCode, setLive), [classCode]);

  const keys = useMemo(() => activeChallengeKeys(settings), [settings]);
  const levers = finalChallengeLevers(settings);

  // Each control writes only its own field path, so flipping several toggles in
  // quick succession cannot revert one another.
  async function patch(p: Partial<ClassSettings>) {
    setSaving(true);
    await updateSettingsFields(classCode, p as Record<string, unknown>);
    setSaving(false);
  }

  async function patchMap<T>(
    field: 'maxAttempts' | 'leaderboardVisible' | 'reflectionsRequiredByChallenge' | 'confidenceRatingEnabled',
    key: string,
    value: T,
  ) {
    setSaving(true);
    await updateSettingsFields(classCode, { [`${field}.${key}`]: value });
    setSaving(false);
  }

  function toggleLiveMode(on: boolean) {
    if (!on) return patch({ liveSessionMode: false });
    // Switching on for the first time: start with nothing unlocked, and default
    // each Final Challenge lever to whether its challenge is in the playlist.
    const seeded: FinalChallengeLevers = {
      batching: keys.includes(LEVER_SOURCE.batching),
      barSize: keys.includes(LEVER_SOURCE.barSize),
      diningTime: keys.includes(LEVER_SOURCE.diningTime),
      advertising: keys.includes(LEVER_SOURCE.advertising),
    };
    return patch({
      liveSessionMode: true,
      unlockedChallenges: settings.unlockedChallenges ?? [],
      finalChallengeLevers: settings.finalChallengeLevers ?? seeded,
    });
  }

  function togglePlaylist(key: string, on: boolean) {
    const next = on
      ? ALL_CHALLENGE_KEYS.filter((k) => k === key || keys.includes(k))
      : keys.filter((k) => k !== key);
    if (!next.length) return; // never leave students with an empty playlist
    // A challenge pulled from the playlist should not stay unlocked.
    const unlocked = (settings.unlockedChallenges ?? []).filter((k) => next.includes(k));
    return patch({ activeChallenges: [...next], unlockedChallenges: unlocked });
  }

  function movePlaylist(key: string, delta: number) {
    const i = keys.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= keys.length) return;
    const next = [...keys];
    [next[i], next[j]] = [next[j], next[i]];
    return patch({ activeChallenges: next });
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
        <h1 className="text-2xl font-bold">Session Control</h1>
        <span className="text-xs text-[var(--color-text-muted)]">
          {firebaseConfigured ? (saving ? 'Saving…' : 'Live-saved') : 'Demo mode — not persisted'}
        </span>
      </div>

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
      </div>

      {/* ── Live Session Mode ──────────────────────────────────────────────── */}
      <div
        className={`rounded-xl border p-5 ${
          settings.liveSessionMode
            ? 'border-[var(--color-accent-green)]/50 bg-[var(--color-accent-green)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]'
        }`}
      >
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="text-lg font-semibold">Live Session Mode</span>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {settings.liveSessionMode
                ? 'ON — students can only reach challenges you have unlocked below. Submitting no longer unlocks the next one.'
                : 'OFF — self-paced: students unlock each challenge by submitting the previous one.'}
            </p>
          </span>
          <input
            type="checkbox"
            checked={settings.liveSessionMode}
            onChange={(e) => toggleLiveMode(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[var(--color-accent-green)]"
          />
        </label>
        {settings.liveSessionMode && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => patch({ unlockedChallenges: [...keys] })}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs"
            >
              Unlock all
            </button>
            <button
              onClick={() => patch({ unlockedChallenges: [] })}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs"
            >
              Lock all
            </button>
          </div>
        )}
      </div>

      {/* ── Playlist editor ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Playlist</h2>
        <div className="mt-3 space-y-1.5">
          {/* Active challenges first, in playlist order, then the omitted ones. */}
          {[...keys, ...ALL_CHALLENGE_KEYS.filter((k) => !keys.includes(k))].map((key) => {
            const def = CHALLENGE_BY_KEY[key];
            const on = keys.includes(key);
            const pos = keys.indexOf(key);
            return (
              <div
                key={key}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                  on ? 'border-[var(--color-border)]' : 'border-transparent opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => togglePlaylist(key, e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span className="font-mono text-xs text-[var(--color-text-muted)]">{def?.index ?? '–'}</span>
                <span className="flex-1 text-sm">{def?.title ?? key}</span>
                {on && (
                  <span className="flex gap-1">
                    <button
                      onClick={() => movePlaylist(key, -1)}
                      disabled={pos <= 0}
                      className="rounded border border-[var(--color-border)] px-2 text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePlaylist(key, 1)}
                      disabled={pos < 0 || pos >= keys.length - 1}
                      className="rounded border border-[var(--color-border)] px-2 text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Removing a challenge here hides it from students and skips it when checking whether the Final Challenge can
          unlock.
        </p>
      </section>

      {/* ── Per-challenge controls ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Challenge controls
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

                <span className="ml-auto font-mono text-sm">
                  <span className="text-[var(--color-accent-green)]">{submitted}</span>
                  <span className="text-[var(--color-text-muted)]"> / {joined} submitted</span>
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <label className="flex items-center gap-1.5">
                  <span className="text-[var(--color-text-secondary)]">Max attempts</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={maxAttemptsFor(settings, key)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 1) patchMap('maxAttempts', key, Math.round(v));
                    }}
                    className="w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 text-center font-mono outline-none"
                  />
                </label>

                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={reflectionsRequiredFor(settings, key)}
                    onChange={(e) => patchMap('reflectionsRequiredByChallenge', key, e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                  />
                  <span className="text-[var(--color-text-secondary)]">Reflection required</span>
                </label>

                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={confidenceRatingEnabledFor(settings, key)}
                    onChange={(e) => patchMap('confidenceRatingEnabled', key, e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                  />
                  <span className="text-[var(--color-text-secondary)]">Confidence rating</span>
                </label>

                <button
                  onClick={() => patchMap('leaderboardVisible', key, !revealed)}
                  className={`ml-auto rounded-md px-3 py-1.5 font-medium ${
                    revealed
                      ? 'border border-[var(--color-border)] text-[var(--color-text-secondary)]'
                      : 'bg-[var(--color-accent)] text-white'
                  }`}
                >
                  {revealed ? 'Hide Leaderboard' : 'Reveal Leaderboard'}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Final Challenge levers ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Final Challenge levers
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          A lever that is off is removed from the Final Challenge config panel, and the class default is used for that
          parameter.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {(
            [
              ['batching', 'Batching'],
              ['barSize', 'Bar & Timing'],
              ['diningTime', 'Dining Time'],
              ['advertising', 'Advertising'],
            ] as [keyof FinalChallengeLevers, string][]
          ).map(([lever, label]) => (
            <label key={lever} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={levers[lever]}
                          onChange={(e) => patch({ finalChallengeLevers: { ...levers, [lever]: e.target.checked } })}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <QuickCompare classCode={classCode} settings={settings} params={params} rows={rows} keys={keys} />
    </div>
  );
}

// ── Quick Compare ───────────────────────────────────────────────────────────
// Re-runs a submitted student config through the same engine (deterministic
// seeds, so it reproduces their result) and renders it with the very components
// the students see — screen-share this during the debrief.

interface CompareSlot {
  kind: 'top' | 'contrast';
  run: SavedRun;
  studentName: string;
  submittedAvgProfit: number; // what studentResults holds, for comparison
}

function QuickCompare({
  classCode,
  settings,
  params,
  rows,
  keys,
}: {
  classCode: string;
  settings: ClassSettings;
  params: ParamOverrides;
  rows: LeaderboardRow[];
  keys: string[];
}) {
  const [challenge, setChallenge] = useState(keys[0] ?? 'batching');
  const [slots, setSlots] = useState<Partial<Record<'top' | 'contrast', CompareSlot>>>({});
  const [showCompare, setShowCompare] = useState(false);

  // Reset the loaded strategies when the instructor switches challenge or class.
  useEffect(() => setSlots({}), [challenge, classCode]);

  const eligible = useMemo(
    () =>
      rows.filter(
        (r) => r.challengeKey === challenge && r.bestConfig && Number.isFinite(r.bestAvgProfit) && r.bestAvgProfit !== 0,
      ),
    [rows, challenge],
  );

  const available = keys.filter((k) => new Set(rows.filter((r) => r.challengeKey === k).map((r) => r.studentId)).size >= 2);
  if (!available.length) return null;

  function load(kind: 'top' | 'contrast') {
    if (!eligible.length) return;
    const sorted = [...eligible].sort((a, b) => b.bestAvgProfit - a.bestAvgProfit);
    const row = kind === 'top' ? sorted[0] : sorted[sorted.length - 1];
    const config = row.bestConfig as SimConfig;
    const result = runChallenge(config, challenge, { ...params, strictBatching: settings.strictBatching });
    setSlots((prev) => ({
      ...prev,
      [kind]: {
        kind,
        studentName: row.studentName,
        submittedAvgProfit: row.bestAvgProfit,
        run: {
          id: `${kind}-${row.id}`,
          label: kind === 'top' ? `Top · ${row.studentName}` : `Contrasting · ${row.studentName}`,
          config,
          result,
        },
      },
    }));
  }

  const loaded = (['top', 'contrast'] as const).map((k) => slots[k]).filter((s): s is CompareSlot => Boolean(s));

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        Quick Compare
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
        >
          {available.map((k) => (
            <option key={k} value={k}>
              {CHALLENGE_BY_KEY[k]?.title ?? k}
            </option>
          ))}
        </select>
        <button
          onClick={() => load('top')}
          disabled={!eligible.length}
          className="rounded-md bg-[var(--color-accent-green)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          Load Top Strategy
        </button>
        <button
          onClick={() => load('contrast')}
          disabled={eligible.length < 2}
          className="rounded-md bg-[var(--color-accent-amber)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          Load Contrasting Strategy
        </button>
        {loaded.length === 2 && (
          <button
            onClick={() => setShowCompare(true)}
            className="ml-auto rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Compare side by side →
          </button>
        )}
      </div>

      {!eligible.length && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">No completed submissions for this challenge yet.</p>
      )}

      <div className="mt-5 space-y-8">
        {loaded.map((slot) => (
          <StrategyView key={slot.kind} slot={slot} challengeKey={challenge} />
        ))}
      </div>

      {showCompare && loaded.length === 2 && (
        <ComparePanel runs={loaded.map((s) => s.run)} onClose={() => setShowCompare(false)} />
      )}
    </section>
  );
}

function StrategyView({ slot, challengeKey }: { slot: CompareSlot; challengeKey: string }) {
  const { result, config } = slot.run;
  // The replicate closest to the average — the same "typical night" the student saw.
  const runIndex = useMemo(() => {
    let best = 0;
    let bestDiff = Infinity;
    result.runs.forEach((r, i) => {
      const d = Math.abs(r.profit - result.avgProfit);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    });
    return best;
  }, [result]);

  return (
    <div className="space-y-3 border-t border-[var(--color-border)] pt-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="font-semibold">{slot.run.label}</h3>
        <span className="font-mono text-sm text-[var(--color-accent-green)]">{money(result.avgProfit)}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          lost {result.avgLost.toFixed(0)} · chef util {pct(result.avgChefUtil)} · best night {money(result.maxProfit)}
        </span>
        {Math.round(slot.submittedAvgProfit) !== Math.round(result.avgProfit) && (
          <span className="text-xs text-[var(--color-accent-amber)]">
            re-run under current class settings · submitted {money(slot.submittedAvgProfit)}
          </span>
        )}
      </div>
      <AnimationPanel run={result.runs[runIndex]} config={config} challengeKey={`admin-${challengeKey}-${slot.kind}`} />
      <DualCharts run={result.runs[runIndex]} />
    </div>
  );
}
