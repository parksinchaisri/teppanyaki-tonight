import { useEffect, useMemo, useState } from 'react';
import {
  resetClassData,
  updateParams,
  updatePin,
  updateSettingsFields,
} from '../firebase/classSettings';
import { firebaseConfigured } from '../firebase/config';
import {
  ALL_CHALLENGE_KEYS,
  activeChallengeKeys,
  confidenceRatingEnabledFor,
  finalChallengeLevers,
  maxAttemptsFor,
  reflectionsRequiredFor,
  type ClassSettings,
  type FinalChallengeLevers,
} from '../firebase/types';
import type { ParamOverrides } from '../engine/types';
import { CHALLENGE_BY_KEY } from '../challenges/definitions';

interface Props {
  classCode: string;
  settings: ClassSettings;
  params: ParamOverrides;
}

type NumericParamKey = Exclude<keyof ParamOverrides, 'strictBatching'>;

const PARAM_FIELDS: { key: NumericParamKey; label: string; placeholder: number; unit: string }[] = [
  { key: 'dinnerMargin', label: 'Dinner margin', placeholder: 12, unit: '$/cover' },
  { key: 'drinkMargin', label: 'Drink margin', placeholder: 6, unit: '$/drink' },
  { key: 'fixedCostEvening', label: 'Fixed cost per evening', placeholder: 3600, unit: '$' },
  { key: 'patienceMean', label: 'Avg customer patience', placeholder: 28, unit: 'minutes' },
  { key: 'defaultBarSeats', label: 'Default bar seats', placeholder: 40, unit: 'seats' },
  { key: 'defaultTables', label: 'Default dining tables', placeholder: 15, unit: 'tables' },
];

// Which Final Challenge lever each challenge corresponds to, used to
// pre-populate the levers the first time Live Session Mode is switched on.
const LEVER_SOURCE: Record<keyof FinalChallengeLevers, string> = {
  batching: 'batching',
  barSize: 'barSize',
  diningTime: 'diningTime',
  advertising: 'advertising',
};

// Everything configured before a session runs. Live-session actions live in the
// Live Control tab.
export function SetupTab({ classCode, settings, params }: Props) {
  const [saving, setSaving] = useState(false);
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
    field: 'maxAttempts' | 'reflectionsRequiredByChallenge' | 'confidenceRatingEnabled',
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Setup</h1>
        <span className="text-xs text-[var(--color-text-muted)]">
          {firebaseConfigured ? (saving ? 'Saving…' : 'Live-saved') : 'Demo mode — not persisted'}
        </span>
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

      {/* ── Class-level progression rules ──────────────────────────────────── */}
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <span>
          <span className="font-medium">Reflection gates progress</span>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Students cannot move to the next challenge until they have submitted the reflection the current one
            requires — in both self-paced and live mode.
          </p>
        </span>
        <input
          type="checkbox"
          checked={settings.reflectionGatesProgress ?? false}
          onChange={(e) => patch({ reflectionGatesProgress: e.target.checked })}
          className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        />
      </label>

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

      {/* ── Per-challenge setup ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Per-challenge rules
        </h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Unlocking, progress and leaderboard reveal happen during the session — those live in Live Control.
        </p>
        {keys.map((key) => {
          const def = CHALLENGE_BY_KEY[key];
          return (
            <div key={key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-[var(--color-text-muted)]">{def?.index ?? '–'}</span>
                <span className="font-medium">{def?.title ?? key}</span>
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

      {/* ── Debrief ────────────────────────────────────────────────────────── */}
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <span>
          <span className="font-medium">Full debrief mode</span>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Adds a Debrief view to Theater's round results — the big idea, one visual and a discussion question.
            Challenges without debrief content keep the plain Round/Cumulative toggle.
          </p>
        </span>
        <input
          type="checkbox"
          checked={settings.fullDebriefMode !== false}
          onChange={(e) => patch({ fullDebriefMode: e.target.checked })}
          className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        />
      </label>

      {/* ── Prepare tab presentation ───────────────────────────────────────── */}
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <span>
          <span className="font-medium">Guarded Prepare page</span>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Shows a condensed briefing and makes the text awkward to select or copy.
          </p>
        </span>
        <select
          value={settings.preparePageMode ?? 'standard'}
          onChange={(e) => patch({ preparePageMode: e.target.value as ClassSettings['preparePageMode'] })}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
        >
          <option value="standard">Standard briefing</option>
          <option value="guarded">Guarded briefing</option>
        </select>
      </label>

      {/* ── Class-wide student experience ──────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Student experience
        </h2>
        <Toggle label="Reflections required" desc="Show the reflection prompt under each challenge." value={settings.reflectionsRequired} onChange={(v) => patch({ reflectionsRequired: v })} />
        <Toggle label="Auto-debrief visible" desc="Show computed insight sentences below the charts." value={settings.autoDebrief} onChange={(v) => patch({ autoDebrief: v })} />
        <Toggle label="Utilisation meter visible" desc="Reveal the chef utilisation card in results." value={settings.utilizationVisible} onChange={(v) => patch({ utilizationVisible: v })} />
        <Toggle label="Lock challenges" desc="Require students to submit each challenge before unlocking the next." value={settings.lockChallenges} onChange={(v) => patch({ lockChallenges: v })} />
        <Toggle
          label="Strict table-of-8 only (no partial seatings)"
          desc="When on, tables only seat when a full table of 8 is ready. When off, tables can seat 6–8 (more flexible, allows partial fills)."
          value={settings.strictBatching}
          onChange={(v) => patch({ strictBatching: v })}
        />
      </section>

      <EconomicsSection classCode={classCode} params={params} />
      <ChangePinSection classCode={classCode} />
      <ResetSection classCode={classCode} />
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--color-text-muted)]">{desc}</div>
      </div>
      <div
        onClick={() => onChange(!value)}
        className="relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors"
        style={{ backgroundColor: value ? 'var(--color-accent-green)' : 'var(--color-border)' }}
        role="switch"
        aria-checked={value}
      >
        <span
          className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? 'translateX(1.5rem)' : 'translateX(0.125rem)' }}
        />
      </div>
    </div>
  );
}

function EconomicsSection({ classCode, params }: { classCode: string; params: ParamOverrides }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Sync editable strings from live params whenever they change.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of PARAM_FIELDS) {
      const v = params[f.key];
      next[f.key] = v == null ? '' : String(v);
    }
    setDraft(next);
  }, [params]);

  async function save() {
    const out: ParamOverrides = {};
    for (const f of PARAM_FIELDS) {
      const raw = draft[f.key]?.trim();
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) out[f.key] = n;
      }
    }
    await updateParams(classCode, out);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <div className="text-sm font-semibold">Economics &amp; Calibration</div>
          <div className="text-xs text-[var(--color-text-muted)]">Override engine constants for this class only.</div>
        </div>
        <span className="text-[var(--color-text-muted)]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-[var(--color-border)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {PARAM_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {f.label} <span className="text-[var(--color-text-muted)]">({f.unit})</span>
                </span>
                <input
                  type="number"
                  value={draft[f.key] ?? ''}
                  placeholder={String(f.placeholder)}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Leave a field blank to use the default. Changes take effect for students on their next page load.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={save} className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white">
              Save economics
            </button>
            {saved && <span className="text-xs text-[var(--color-accent-green)]">Saved ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePinSection({ classCode }: { classCode: string }) {
  const [pin, setPin] = useState('');
  const [done, setDone] = useState(false);

  async function save() {
    if (!pin.trim()) return;
    await updatePin(classCode, pin.trim());
    setPin('');
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-sm font-semibold">Change PIN</div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="New PIN"
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          onClick={save}
          disabled={!pin.trim()}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Save PIN
        </button>
      </div>
      {done && <p className="mt-2 text-xs text-[var(--color-accent-green)]">PIN updated</p>}
    </div>
  );
}

function ResetSection({ classCode }: { classCode: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    const ok = window.confirm(
      `This will delete all student results and reflections for class ${classCode}. This cannot be undone. Continue?`,
    );
    if (!ok) return;
    setBusy(true);
    setDone(false);
    try {
      await resetClassData(classCode);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-accent-red)]/40 bg-[var(--color-accent-red)]/5 p-4">
      <div className="text-sm font-semibold text-[var(--color-accent-red)]">Reset Class Data</div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Permanently deletes all student results and reflections for this class. Settings, PIN, and economics are kept.
      </p>
      <button
        onClick={reset}
        disabled={busy}
        className="mt-3 rounded-md border border-[var(--color-accent-red)] bg-[var(--color-accent-red)]/15 px-4 py-2 text-sm font-medium text-[var(--color-accent-red)] disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Reset Class Data'}
      </button>
      {done && <p className="mt-2 text-xs text-[var(--color-accent-green)]">Class data cleared.</p>}
    </div>
  );
}
