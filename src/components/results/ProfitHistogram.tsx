import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../../lib/format';

interface Series {
  label: string;
  color: string;
  profits: number[];
}

interface Props {
  primary: Series;
  secondary?: Series;
}

const BIN_COUNT = 8;

export function ProfitHistogram({ primary, secondary }: Props) {
  const all = [...primary.profits, ...(secondary?.profits ?? [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const width = span / BIN_COUNT;

  const bins = Array.from({ length: BIN_COUNT }, (_, i) => {
    const lo = min + i * width;
    return { lo, hi: lo + width, mid: lo + width / 2 };
  });

  function counts(profits: number[]): number[] {
    const c = new Array(BIN_COUNT).fill(0);
    for (const p of profits) {
      let idx = Math.floor((p - min) / width);
      if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
      if (idx < 0) idx = 0;
      c[idx]++;
    }
    return c;
  }

  const pc = counts(primary.profits);
  const sc = secondary ? counts(secondary.profits) : null;
  const data = bins.map((b, i) => ({
    label: money(b.mid),
    primary: pc[i],
    secondary: sc ? sc[i] : 0,
  }));

  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const primaryMean = mean(primary.profits);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Profit distribution across 20 runs</h3>
        <div className="flex gap-3 text-xs">
          <Legend color={primary.color} label={primary.label} />
          {secondary && <Legend color={secondary.color} label={secondary.label} />}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} interval={1} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} width={20} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="primary" name={primary.label} radius={[2, 2, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={primary.color} />
            ))}
          </Bar>
          {secondary && (
            <Bar dataKey="secondary" name={secondary.label} radius={[2, 2, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={secondary.color} fillOpacity={0.65} />
              ))}
            </Bar>
          )}
          <ReferenceLine
            x={data.reduce((best, d) => (Math.abs(parseProfit(d.label) - primaryMean) < Math.abs(parseProfit(best.label) - primaryMean) ? d : best)).label}
            stroke={primary.color}
            strokeDasharray="4 3"
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 text-center text-xs text-[var(--color-text-muted)]">
        Mean {money(primaryMean)} · spread {money(Math.min(...primary.profits))} → {money(Math.max(...primary.profits))}
      </div>
    </div>
  );
}

function parseProfit(label: string): number {
  return Number(label.replace(/[$,]/g, ''));
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
