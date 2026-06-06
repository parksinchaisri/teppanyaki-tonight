import { useState } from 'react';
import type { ChallengeResult } from '../../engine/types';
import { money } from '../../lib/format';

type SortKey = 'index' | 'profit' | 'lost';

interface Props {
  result: ChallengeResult;
  selectedRun: number;
  onSelectRun: (i: number) => void;
}

export function OutcomesTable({ result, selectedRun, onSelectRun }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<SortKey>('index');
  const [asc, setAsc] = useState(true);

  const rows = result.runs.map((r, i) => ({ i, profit: r.profit, lost: r.lostCustomers }));
  const sorted = [...rows].sort((a, b) => {
    const dir = asc ? 1 : -1;
    if (sort === 'profit') return (a.profit - b.profit) * dir;
    if (sort === 'lost') return (a.lost - b.lost) * dir;
    return (a.i - b.i) * dir;
  });

  function header(key: SortKey, label: string, align: string) {
    return (
      <th
        className={`cursor-pointer px-3 py-2 ${align} select-none hover:text-[var(--color-text-primary)]`}
        onClick={() => {
          if (sort === key) setAsc(!asc);
          else {
            setSort(key);
            setAsc(key === 'index');
          }
        }}
      >
        {label} {sort === key ? (asc ? '▲' : '▼') : ''}
      </th>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Always-visible summary badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap gap-2">
          <Badge label="Avg" profit={result.avgProfit} primary />
          <Badge label="Best" profit={result.maxProfit} />
          <Badge label="Worst" profit={result.minProfit} />
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {expanded ? 'Hide ▲' : 'Show all 20 runs ▼'}
        </button>
      </div>

      {expanded && (
        <div className="overflow-hidden border-t border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-raised)] font-mono text-xs uppercase text-[var(--color-text-secondary)]">
              <tr>
                {header('index', 'Outcome #', 'text-left')}
                {header('profit', 'Profit', 'text-right')}
                {header('lost', 'Lost', 'text-right')}
              </tr>
            </thead>
            <tbody className="font-mono">
              {sorted.map((row) => (
                <tr
                  key={row.i}
                  onClick={() => onSelectRun(row.i)}
                  className={`cursor-pointer border-t border-[var(--color-border)]/40 transition-colors ${
                    selectedRun === row.i ? 'bg-[var(--color-accent)]/15' : 'hover:bg-[var(--color-surface-raised)]'
                  }`}
                >
                  <td className="px-3 py-1.5 text-left text-[var(--color-text-secondary)]">Run {row.i + 1}</td>
                  <td className={`px-3 py-1.5 text-right ${row.profit < 0 ? 'text-[var(--color-accent-red)]' : ''}`}>
                    {money(row.profit)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[var(--color-text-secondary)]">{row.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Badge({ label, profit, primary }: { label: string; profit: number; primary?: boolean }) {
  const color = profit < 0 ? 'var(--color-accent-red)' : 'var(--color-accent-green)';
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-md border px-3 py-1.5 ${
        primary ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10' : 'border-[var(--color-border)]'
      }`}
    >
      <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <span className="font-mono text-sm font-semibold" style={{ color }}>
        {money(profit)}
      </span>
    </span>
  );
}
