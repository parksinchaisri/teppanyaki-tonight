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
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-raised)] font-mono text-xs uppercase text-[var(--color-text-secondary)]">
          <tr>
            {header('index', 'Outcome #', 'text-left')}
            {header('profit', 'Profit', 'text-right')}
            {header('lost', 'Lost', 'text-right')}
          </tr>
        </thead>
        <tbody className="font-mono">
          <SummaryRow label="Average" profit={result.avgProfit} highlight />
          <SummaryRow label="Best" profit={result.maxProfit} />
          <SummaryRow label="Worst" profit={result.minProfit} />
          <tr>
            <td colSpan={3} className="border-t border-[var(--color-border)]" />
          </tr>
          {sorted.map((row) => (
            <tr
              key={row.i}
              onClick={() => onSelectRun(row.i)}
              className={`cursor-pointer border-t border-[var(--color-border)]/40 transition-colors ${
                selectedRun === row.i
                  ? 'bg-[var(--color-accent)]/15'
                  : 'hover:bg-[var(--color-surface-raised)]'
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
  );
}

function SummaryRow({ label, profit, highlight }: { label: string; profit: number; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-[var(--color-surface-raised)]' : ''}>
      <td className="px-3 py-1.5 text-left font-semibold text-[var(--color-text-primary)]">{label}</td>
      <td className={`px-3 py-1.5 text-right font-semibold ${profit < 0 ? 'text-[var(--color-accent-red)]' : 'text-[var(--color-accent-green)]'}`}>
        {money(profit)}
      </td>
      <td className="px-3 py-1.5" />
    </tr>
  );
}
