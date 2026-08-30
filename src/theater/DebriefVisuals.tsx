import { Arrow, FlowNode, SeatTable } from '../components/shared/FlowNode';
import type { DebriefVisualKey } from './debriefContent';

// One idea, one visual, one line — deliberately sparse, in Theater's own dark /
// accent palette rather than any print-deck styling.

const CAPTION = 'text-lg uppercase tracking-[0.2em] text-[var(--color-text-muted)]';
const FIGURE = 'font-mono text-3xl text-[var(--color-text-primary)]';

export function DebriefVisual({ which }: { which: DebriefVisualKey }) {
  if (which === 'batching') return <BatchingVisual />;
  if (which === 'barSize') return <BarSizeVisual />;
  if (which === 'diningTime') return <DiningTimeVisual />;
  if (which === 'advancedBatching') return <AdvancedBatchingVisual />;
  return <FinalChallengeVisual />;
}

// 4a — a full table beside a half-full one: same chef cycle, half the output.
function BatchingVisual() {
  return (
    <div className="flex flex-wrap items-start justify-center gap-16">
      <div className="text-center">
        <SeatTable filled={8} tone="var(--color-accent-green)" />
        <p className={`mt-3 ${CAPTION}`}>Full table</p>
        <p className={`mt-2 ${FIGURE}`}>8 ÷ 1hr = 8/hr</p>
      </div>
      <div className="text-center">
        <SeatTable filled={4} tone="var(--color-accent-amber)" />
        <p className={`mt-3 ${CAPTION}`}>Half-full table</p>
        <p className={`mt-2 ${FIGURE}`}>4 ÷ 1hr = 4/hr</p>
        <p className="mt-2 text-base text-[var(--color-text-muted)]">50% of batch capacity unused</p>
      </div>
    </div>
  );
}

// 4b — the same flow diagram the Prepare page draws, relabelled for the buffer.
function BarSizeVisual() {
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <FlowNode big title="Arrivals" subtitle="small groups" tone="var(--color-text-secondary)" />
        <Arrow big />
        <FlowNode big title="Bar" subtitle="buffer · groups collect" tone="var(--color-accent)" />
        <Arrow big />
        <FlowNode big title="Table" subtitle="fuller batches" tone="var(--color-accent-green)" />
      </div>
      <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-6">
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4 text-xl text-[var(--color-text-secondary)]">
          Too small → poor batching
        </p>
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4 text-xl text-[var(--color-text-secondary)]">
          Too large → dining space + waiting
        </p>
      </div>
    </div>
  );
}

// 4c — the same table, turned faster.
function DiningTimeVisual() {
  return (
    <div className="text-center">
      <div className="flex flex-wrap items-center justify-center gap-12">
        <ClockTable minutes={60} tone="var(--color-text-secondary)" figure="8 ÷ 1.00 = 8/hr" />
        <Arrow big />
        <ClockTable minutes={45} tone="var(--color-accent-green)" figure="8 ÷ 0.75 = 10.67/hr" />
      </div>
      <p className="mt-10 text-5xl font-bold text-[var(--color-accent-green)]">+33% table capacity</p>
    </div>
  );
}

function ClockTable({ minutes, tone, figure }: { minutes: number; tone: string; figure: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-4">
        <SeatTable filled={8} tone={tone} />
        <svg viewBox="0 0 48 48" className="h-16 w-16">
          <circle cx="24" cy="24" r="20" fill="none" stroke={tone} strokeWidth="2.5" />
          <line x1="24" y1="24" x2="24" y2="11" stroke={tone} strokeWidth="2.5" strokeLinecap="round" />
          <line
            x1="24"
            y1="24"
            x2={24 + 11 * Math.sin((minutes / 60) * 2 * Math.PI)}
            y2={24 - 11 * Math.cos((minutes / 60) * 2 * Math.PI)}
            stroke={tone}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className={`mt-3 ${CAPTION}`}>{minutes} min meal</p>
      <p className={`mt-2 ${FIGURE}`}>{figure}</p>
    </div>
  );
}

// 4d — the right rule depends on where you are in the evening.
function AdvancedBatchingVisual() {
  const points = [
    { label: 'Early', line: 'few arrivals → seat more freely', tone: 'var(--color-text-secondary)' },
    { label: 'Peak', line: 'many arrivals → wait for fuller batches', tone: 'var(--color-accent)' },
    { label: 'Late', line: 'few arrivals left → stop waiting', tone: 'var(--color-accent-amber)' },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="relative">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-[var(--color-border)]" />
        <div className="relative flex justify-between">
          {points.map((p) => (
            <div key={p.label} className="flex w-1/3 flex-col items-center px-3 text-center">
              <span
                className="h-8 w-8 rounded-full border-4"
                style={{ borderColor: p.tone, background: 'var(--color-bg)' }}
              />
              <span className="mt-4 text-2xl font-semibold uppercase tracking-wide" style={{ color: p.tone }}>
                {p.label}
              </span>
              <span className="mt-2 text-lg text-[var(--color-text-secondary)]">{p.line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 4e — four levers feeding one outcome.
function FinalChallengeVisual() {
  const nodes = [
    { label: 'Batching', line: 'fills chef cycles' },
    { label: 'Buffer', line: 'stores arrivals' },
    { label: 'Dining time', line: 'creates capacity' },
    { label: 'Dynamic policy', line: 'matches decisions to demand' },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="grid grid-cols-2 items-center gap-x-16 gap-y-6">
        {nodes.slice(0, 2).map((n) => (
          <Node key={n.label} {...n} />
        ))}
        <div className="col-span-2 flex justify-center">
          <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full border-4 border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 p-4 text-center">
            <span className="text-xl font-bold leading-tight text-[var(--color-accent-green)]">
              Profitable customer flow
            </span>
          </div>
        </div>
        {nodes.slice(2).map((n) => (
          <Node key={n.label} {...n} />
        ))}
      </div>
    </div>
  );
}

function Node({ label, line }: { label: string; line: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-6 py-4 text-center">
      <p className="text-2xl font-semibold text-[var(--color-accent)]">{label}</p>
      <p className="mt-1 text-lg text-[var(--color-text-secondary)]">{line}</p>
    </div>
  );
}
