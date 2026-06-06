import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RunStats } from '../../engine/types';
import { clockLabel } from '../../lib/format';

const tooltipStyle = {
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function DualCharts({ run }: { run: RunStats }) {
  const ts = run.timeseries;
  const data = ts.time.map((t, i) => ({
    t,
    label: clockLabel(t),
    bar: ts.barOccupancy[i],
    dining: ts.diningOccupancy[i],
    lost: ts.lostCumulative[i],
    drinks: ts.drinksCumulative[i],
    dinners: ts.dinnersCumulative[i],
  }));

  const xAxis = (
    <XAxis
      dataKey="t"
      type="number"
      domain={['dataMin', 'dataMax']}
      tickFormatter={(v) => clockLabel(v)}
      tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
      ticks={[360, 420, 480, 540, 600, 660]}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Customers over the evening">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            {xAxis}
            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} width={28} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => clockLabel(Number(v))} />
            <Line type="monotone" dataKey="bar" name="Bar" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="dining" name="Dining" stroke="var(--color-accent-green)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="lost" name="Lost" stroke="var(--color-accent-red)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
        <ChartLegend
          items={[
            { color: 'var(--color-accent)', label: 'Bar' },
            { color: 'var(--color-accent-green)', label: 'Dining' },
            { color: 'var(--color-accent-red)', label: 'Lost (cumulative)' },
          ]}
        />
      </ChartCard>

      <ChartCard title="Items served (cumulative)">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            {xAxis}
            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} width={28} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => clockLabel(Number(v))} />
            <Line type="monotone" dataKey="drinks" name="Drinks" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="dinners" name="Dinners" stroke="var(--color-accent-green)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
        <ChartLegend
          items={[
            { color: 'var(--color-accent)', label: 'Drinks' },
            { color: 'var(--color-accent-green)', label: 'Dinners' },
          ]}
        />
      </ChartCard>
    </div>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
