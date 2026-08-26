import { useEffect, useMemo, useState } from 'react';
import { subscribeLeaderboard } from '../firebase/leaderboard';
import { getAttempts } from '../firebase/attempts';
import type { LeaderboardRow } from '../firebase/types';
import { CHALLENGES, challengeLabel } from '../challenges/definitions';
import { money } from '../lib/format';
import { downloadCSV, toCSV } from '../lib/csv';

export function ResultsTab({ classCode }: { classCode: string }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [filter, setFilter] = useState('all');
  const [exportingAttempts, setExportingAttempts] = useState(false);
  const [attemptsError, setAttemptsError] = useState('');

  useEffect(() => subscribeLeaderboard(classCode, null, setRows), [classCode]);

  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.challengeKey === filter)),
    [rows, filter],
  );
  const sorted = [...filtered].sort((a, b) => b.bestAvgProfit - a.bestAvgProfit);

  function exportCSV() {
    const csv = toCSV(
      ['Anonymous ID', 'studentName', 'challengeKey', 'bestAvgProfit', 'attempts', 'lastSubmittedAt', 'bestConfig'],
      sorted.map((r) => [
        r.studentId,
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

  // The full audit trail — every Simulate run, not just each student's best.
  async function exportAttemptsCSV() {
    setExportingAttempts(true);
    setAttemptsError('');
    try {
      const all = await getAttempts(classCode);
      const attempts = filter === 'all' ? all : all.filter((a) => a.challengeKey === filter);
      const csv = toCSV(
        [
          'Anonymous ID',
          'displayName',
          'challengeKey',
          'attemptNumber',
          'isFirstAttempt',
          'config',
          'avgProfit',
          'avgLost',
          'chefUtilisation',
          'bestNight',
          'confidenceRating',
          'timestamp',
        ],
        attempts.map((a) => [
          a.studentId,
          a.displayName,
          a.challengeKey,
          a.attemptNumber,
          a.isFirstAttempt,
          a.config,
          Math.round(a.resultSummary.avgProfit),
          a.resultSummary.avgLost.toFixed(1),
          a.resultSummary.chefUtilisation.toFixed(4),
          Math.round(a.resultSummary.bestNight),
          a.confidenceRating ?? '',
          a.timestamp ? new Date(a.timestamp).toISOString() : '',
        ]),
      );
      downloadCSV(`teppanyaki-attempts-${classCode}.csv`, csv);
    } catch {
      // Almost always the `attempts` Firestore rules not being deployed yet —
      // better to say so than to hand over an empty CSV.
      setAttemptsError('Could not read the attempts log. Check that the Firestore rules for classes/*/attempts are deployed.');
    } finally {
      setExportingAttempts(false);
    }
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
          <button
            onClick={exportAttemptsCSV}
            disabled={exportingAttempts}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-40"
          >
            {exportingAttempts ? 'Preparing…' : 'Download Attempts Log (CSV)'}
          </button>
        </div>
      </div>

      {attemptsError && (
        <div className="rounded-md border border-[var(--color-accent-red)]/40 bg-[var(--color-accent-red)]/10 p-3 text-sm text-[var(--color-accent-red)]">
          {attemptsError}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-raised)] text-xs uppercase text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Anonymous ID</th>
              <th className="px-4 py-2 text-left">Challenge</th>
              <th className="px-4 py-2 text-right">Best Avg Profit</th>
              <th className="px-4 py-2 text-right">Attempts</th>
              <th className="px-4 py-2 text-right">Last Submitted</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-sans text-[var(--color-text-muted)]">
                  No results yet.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)]/40">
                <td className="px-4 py-2 font-sans font-medium">{r.studentName}</td>
                <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]" title={r.studentId}>
                  {r.studentId.slice(0, 8)}
                </td>
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
