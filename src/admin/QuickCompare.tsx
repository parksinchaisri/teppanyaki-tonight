import { useEffect, useMemo, useState } from 'react';
import { CHALLENGE_BY_KEY } from '../challenges/definitions';
import { runChallenge } from '../engine/simulation';
import type { ParamOverrides, SimConfig } from '../engine/types';
import type { ClassSettings, LeaderboardRow } from '../firebase/types';
import { money, pct } from '../lib/format';
import { AnimationPanel } from '../components/animation/AnimationPanel';
import { DualCharts } from '../components/results/DualCharts';
import { ComparePanel, type SavedRun } from '../components/results/ComparePanel';

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

export function QuickCompare({
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
