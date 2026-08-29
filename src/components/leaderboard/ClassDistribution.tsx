import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LeaderboardRow } from '../../firebase/types';
import { money } from '../../lib/format';

// Class-wide profit distribution with the viewer's own bin picked out. Carries
// no names and no individual scores, so it is safe on the student-facing
// leaderboard where only your own standing may be shown.
export function ClassDistribution({
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
      <h3 className="mb-1 text-sm font-semibold">Class distribution</h3>
      <p className="mb-2 text-xs text-[var(--color-text-muted)]">
        Every submitted result, grouped by profit.{' '}
        <span className="text-[var(--color-accent-amber)]">The amber bar is where you land.</span>
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={bins} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} interval={1} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} width={20} />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
          />
          {/* Recharts 3 needs a fill on the Bar itself — without it the series
              renders invisibly and per-Cell fills never show. */}
          <Bar dataKey="count" fill="var(--color-accent)" isAnimationActive={false} radius={[2, 2, 0, 0]}>
            {bins.map((b, i) => (
              <Cell key={i} fill={b.mine ? 'var(--color-accent-amber)' : 'var(--color-accent)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
