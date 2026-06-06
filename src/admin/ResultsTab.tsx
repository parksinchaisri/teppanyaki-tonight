import { useEffect, useMemo, useState } from 'react';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import type { LeaderboardRow } from '../firebase/types';
import { CHALLENGES, challengeLabel } from '../challenges/definitions';
import { money } from '../lib/format';
import { downloadCSV, toCSV } from '../lib/csv';

export function ResultsTab({ classCode }: { classCode: string }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => subscribeLeaderboard(classCode, null, setRows), [classCode]);

  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.challengeKey === filter)),
    [rows, filter],
  );
  const sorted = [...filtered].sort((a, b) => b.bestAvgProfit - a.bestAvgProfit);

  function exportCSV() {
    const csv = toCSV(
      ['studentName', 'challengeKey', 'bestAvgProfit', 'attempts', 'lastSubmittedAt', 'bestConfig'],
      sorted.map((r) => [
        r.studentName,
        r.challengeKey,
        Math.round(r.bestAvgProfit),
        r.attempts,
        new Date(r.lastSubmittedAt).toISOString(),
        JSON.stringify(r.bestConfig),
      ]),
    );
    downloadCSV(`teppanyaki-results-${classCode}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">All Results</h1>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none"
          >
            <option value="all">All challenges</option>
            {CHALLENGES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.title}
              </option>
            ))}
          </select>
          <button onClick={exportCSV} className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white">
            Download CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-raised)] text-xs uppercase text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Challenge</th>
              <th className="px-4 py-2 text-right">Best Avg Profit</th>
              <th className="px-4 py-2 text-right">Attempts</th>
              <th className="px-4 py-2 text-right">Last Submitted</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-sans text-[var(--color-text-muted)]">
                  No results yet.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)]/40">
                <td className="px-4 py-2 font-sans font-medium">{r.studentName}</td>
                <td className="px-4 py-2 font-sans text-[var(--color-text-secondary)]">{challengeLabel(r.challengeKey)}</td>
                <td className="px-4 py-2 text-right text-[var(--color-accent-green)]">{money(r.bestAvgProfit)}</td>
                <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.attempts}</td>
                <td className="px-4 py-2 text-right text-[var(--color-text-muted)]">
                  {r.lastSubmittedAt ? new Date(r.lastSubmittedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
