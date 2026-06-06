import { useState } from 'react';
import type { ChallengeResult, SimConfig } from '../../engine/types';
import { money, pct } from '../../lib/format';
import { ProfitHistogram } from './ProfitHistogram';

export interface SavedRun {
  id: string;
  label: string;
  config: SimConfig;
  result: ChallengeResult;
}

const A_COLOR = 'var(--color-accent)';
const B_COLOR = 'var(--color-accent-amber)';

export function ComparePanel({ runs, onClose }: { runs: SavedRun[]; onClose: () => void }) {
  const [aId, setAId] = useState(runs[0]?.id);
  const [bId, setBId] = useState(runs[1]?.id ?? runs[0]?.id);

  const a = runs.find((r) => r.id === aId) ?? runs[0];
  const b = runs.find((r) => r.id === bId) ?? runs[1] ?? runs[0];

  function avgDinners(r: ChallengeResult) {
    return r.runs.reduce((s, x) => s + x.dinnersServed, 0) / r.runs.length;
  }

  const deltas = [
    { label: 'Avg profit', a: money(a.result.avgProfit), b: money(b.result.avgProfit), delta: money(b.result.avgProfit - a.result.avgProfit) },
    { label: 'Avg lost guests', a: a.result.avgLost.toFixed(1), b: b.result.avgLost.toFixed(1), delta: (b.result.avgLost - a.result.avgLost).toFixed(1) },
    { label: 'Chef utilisation', a: pct(a.result.avgChefUtil), b: pct(b.result.avgChefUtil), delta: pct(b.result.avgChefUtil - a.result.avgChefUtil) },
    { label: 'Empty chair-hours', a: a.result.avgEmptyChairHours.toFixed(1), b: b.result.avgEmptyChairHours.toFixed(1), delta: (b.result.avgEmptyChairHours - a.result.avgEmptyChairHours).toFixed(1) },
    { label: 'Avg dinners served', a: avgDinners(a.result).toFixed(0), b: avgDinners(b.result).toFixed(0), delta: (avgDinners(b.result) - avgDinners(a.result)).toFixed(0) },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Compare configurations</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <Picker label="A" color={A_COLOR} runs={runs} value={aId} onChange={setAId} />
          <Picker label="B" color={B_COLOR} runs={runs} value={bId} onChange={setBId} />
        </div>

        <div className="mb-4 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-raised)] text-xs uppercase text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-right" style={{ color: A_COLOR }}>A</th>
                <th className="px-3 py-2 text-right" style={{ color: B_COLOR }}>B</th>
                <th className="px-3 py-2 text-right">Δ (B − A)</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {deltas.map((d) => (
                <tr key={d.label} className="border-t border-[var(--color-border)]/40">
                  <td className="px-3 py-1.5 font-sans text-[var(--color-text-secondary)]">{d.label}</td>
                  <td className="px-3 py-1.5 text-right">{d.a}</td>
                  <td className="px-3 py-1.5 text-right">{d.b}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--color-text-primary)]">{d.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ProfitHistogram
          primary={{ label: `A · ${a.label}`, color: A_COLOR, profits: a.result.runs.map((r) => r.profit) }}
          secondary={{ label: `B · ${b.label}`, color: B_COLOR, profits: b.result.runs.map((r) => r.profit) }}
        />
      </div>
    </div>
  );
}

function Picker({
  label,
  color,
  runs,
  value,
  onChange,
}: {
  label: string;
  color: string;
  runs: SavedRun[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color }}>
        Configuration {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
      >
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label} — {money(r.result.avgProfit)}
          </option>
        ))}
      </select>
    </label>
  );
}
