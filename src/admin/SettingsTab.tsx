import { useEffect, useState } from 'react';
import { resetClassData, updateParams, updatePin, updateSettings } from '../firebase/classSettings';
import { firebaseConfigured } from '../firebase/config';
import type { ClassSettings } from '../firebase/types';
import type { ParamOverrides } from '../engine/types';
import { CHALLENGES } from '../challenges/definitions';
import { RadioGroup } from '../components/shared/RadioGroup';

interface Props {
  classCode: string;
  settings: ClassSettings;
  params: ParamOverrides;
}

const PARAM_FIELDS: { key: keyof ParamOverrides; label: string; placeholder: number; unit: string }[] = [
  { key: 'dinnerMargin', label: 'Dinner margin', placeholder: 12, unit: '$/cover' },
  { key: 'drinkMargin', label: 'Drink margin', placeholder: 6, unit: '$/drink' },
  { key: 'fixedCostEvening', label: 'Fixed cost per evening', placeholder: 3600, unit: '$' },
  { key: 'patienceMean', label: 'Avg customer patience', placeholder: 28, unit: 'minutes' },
  { key: 'defaultBarSeats', label: 'Default bar seats', placeholder: 40, unit: 'seats' },
  { key: 'defaultTables', label: 'Default dining tables', placeholder: 15, unit: 'tables' },
];

export function SettingsTab({ classCode, settings, params }: Props) {
  const [saving, setSaving] = useState(false);

  async function patch(p: Partial<ClassSettings>) {
    setSaving(true);
    await updateSettings(classCode, { ...settings, ...p });
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Class Settings</h1>
        <span className="text-xs text-[var(--color-text-muted)]">
          {firebaseConfigured ? (saving ? 'Saving…' : 'Live-saved') : 'Demo mode — not persisted'}
        </span>
      </div>

      <div className="space-y-3">
        <Toggle label="Reflections required" desc="Show the reflection prompt under each challenge." value={settings.reflectionsRequired} onChange={(v) => patch({ reflectionsRequired: v })} />
        <Toggle label="Auto-debrief visible" desc="Show computed insight sentences below the charts." value={settings.autoDebrief} onChange={(v) => patch({ autoDebrief: v })} />
        <Toggle label="Utilisation meter visible" desc="Reveal the chef utilisation card in results." value={settings.utilizationVisible} onChange={(v) => patch({ utilizationVisible: v })} />
        <Toggle label="Lock challenges" desc="Require students to submit each challenge before unlocking the next." value={settings.lockChallenges} onChange={(v) => patch({ lockChallenges: v })} />
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <RadioGroup
          label="Leaderboard mode"
          value={settings.leaderboardMode}
          options={[
            { value: 'challenge', label: 'By Challenge' },
            { value: 'final', label: 'Final Challenge Only' },
          ]}
          onChange={(v) => patch({ leaderboardMode: v as ClassSettings['leaderboardMode'] })}
          columns={2}
        />
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <RadioGroup
          label="Leaderboard metric"
          value={settings.leaderboardMetric}
          options={[
            { value: 'avgProfit', label: 'Average Profit' },
            { value: 'maxProfit', label: 'Best Single Run' },
          ]}
          onChange={(v) => patch({ leaderboardMetric: v as ClassSettings['leaderboardMetric'] })}
          columns={2}
        />
      </div>

      <label className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <span className="text-sm text-[var(--color-text-secondary)]">Active leaderboard challenge (for Live Board)</span>
        <select
          value={settings.activeLeaderboardChallenge}
          onChange={(e) => patch({ activeLeaderboardChallenge: e.target.value })}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
        >
          {CHALLENGES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.title}
            </option>
          ))}
          <option value="all">All challenges</option>
        </select>
      </label>

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
