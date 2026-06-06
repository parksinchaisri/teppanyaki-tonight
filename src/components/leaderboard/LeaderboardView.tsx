import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeaderboardRow, ClassSettings } from '../../firebase/types';
import { challengeLabel } from '../../challenges/definitions';
import { money } from '../../lib/format';

interface Props {
  rows: LeaderboardRow[];
  metric: ClassSettings['leaderboardMetric'];
  highlightStudentId?: string;
  big?: boolean;
}

export function LeaderboardView({ rows, metric, highlightStudentId, big }: Props) {
  const value = (r: LeaderboardRow) => (metric === 'maxProfit' ? r.bestMaxProfit : r.bestAvgProfit);
  const ranked = [...rows].sort((a, b) => value(b) - value(a));

  return (
    <div className="space-y-5">
      <Histogram rows={ranked} value={value} highlightStudentId={highlightStudentId} />
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className={`w-full ${big ? 'text-base' : 'text-sm'}`}>
          <thead className="bg-[var(--color-surface-raised)] text-xs uppercase text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Challenge</th>
              <th className="px-4 py-2 text-right">{metric === 'maxProfit' ? 'Best Night' : 'Avg Profit'}</th>
              <th className="px-4 py-2 text-right">Attempts</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {ranked.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-sans text-[var(--color-text-muted)]">
                  No submissions yet.
                </td>
              </tr>
            )}
            {ranked.map((r, i) => {
              const me = r.studentId === highlightStudentId;
              return (
                <tr
                  key={r.id}
                  className={`border-t border-[var(--color-border)]/40 ${
                    me ? 'bg-[var(--color-accent)]/15' : i % 2 ? 'bg-[var(--color-surface)]/40' : ''
                  }`}
                >
                  <td className={`px-4 py-2 ${big ? 'text-2xl' : ''} font-semibold text-[var(--color-accent)]`}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-2 font-sans font-medium">
                    {r.studentName} {me && <span className="text-xs text-[var(--color-accent)]">(you)</span>}
                  </td>
                  <td className="px-4 py-2 font-sans text-[var(--color-text-secondary)]">
                    {challengeLabel(r.challengeKey)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-[var(--color-accent-green)]">
                    {money(value(r))}
                  </td>
                  <td className="px-4 py-2 text-right text-[var(--color-text-secondary)]">{r.attempts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Histogram({
  rows,
  value,
  highlightStudentId,
}: {
  rows: LeaderboardRow[];
  value: (r: LeaderboardRow) => number;
  highlightStudentId?: string;
}) {
  if (rows.length === 0) return null;
  const vals = rows.map(value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const BINS = 10;
  const width = (max - min) / BINS || 1;
  const bins = Array.from({ length: BINS }, (_, i) => ({
    label: money(min + i * width + width / 2),
    count: 0,
    mine: false,
  }));
  for (const r of rows) {
    let idx = Math.floor((value(r) - min) / width);
    if (idx >= BINS) idx = BINS - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
    if (r.studentId === highlightStudentId) bins[idx].mine = true;
  }
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-2 text-sm font-semibold">Class distribution</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={bins} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} interval={1} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} width={20} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {bins.map((b, i) => (
              <Cell key={i} fill={b.mine ? 'var(--color-accent-amber)' : 'var(--color-accent)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
