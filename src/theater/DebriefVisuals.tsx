import { SeatTable } from '../components/shared/FlowNode';
import type { DebriefVisualKey } from './debriefContent';

// One idea, one visual, one line — deliberately sparse, in Theater's own dark /
// accent palette rather than any print-deck styling.

const CAPTION = 'text-lg uppercase tracking-[0.2em] text-[var(--color-text-muted)]';

export function DebriefVisual({ which }: { which: DebriefVisualKey }) {
  switch (which) {
    case 'batchingFragmentation':
      return <BatchingFragmentation />;
    case 'barBufferCurve':
      return <BarBufferCurve />;
    case 'variabilityTypes':
      return <VariabilityTypes />;
    case 'diningTimeClock':
      return <DiningTimeClock />;
    case 'advertisingDemand':
      return <AdvertisingDemand />;
    case 'dynamicTimeline':
      return <DynamicTimeline />;
    case 'optimizingWhat':
      return <OptimizingWhat />;
    case 'systemNodes':
      return <SystemNodes />;
    case 'synthesisBands':
      return <SynthesisBands />;
  }
}

// Batching — fragmentation, not arithmetic. Three part-empty tables against one
// full one. Deliberately no equations: the point is wasted seats, not division.
function BatchingFragmentation() {
  return (
    <div className="flex flex-wrap items-start justify-center gap-16">
      <div className="text-center">
        <p className={CAPTION}>No batching</p>
        <div className="mt-4 flex flex-col items-center gap-1">
          {[2, 3, 3].map((n, i) => (
            <SeatTable key={i} filled={n} tone="var(--color-accent-amber)" />
          ))}
        </div>
        <p className="mt-3 text-base text-[var(--color-text-muted)]">Same customers. Three tables consumed.</p>
      </div>
      <div className="text-center">
        <p className={CAPTION}>Batching</p>
        <div className="mt-4 flex justify-center">
          <SeatTable filled={8} tone="var(--color-accent-green)" />
        </div>
        <p className="mt-3 text-2xl text-[var(--color-text-primary)]">2 + 3 + 3 → one full table</p>
      </div>
    </div>
  );
}

// Bar Size — three states and an illustrative inverted-U. No axis values: the
// curve is conceptual, not plotted data.
function BarBufferCurve() {
  const states = [
    { label: 'Too small', line: 'buffer starves the batch', tone: 'var(--color-accent-red)', bar: 1, tables: 5 },
    { label: 'Just right', line: 'buffer feeds fuller batches', tone: 'var(--color-accent-green)', bar: 3, tables: 4 },
    { label: 'Too large', line: 'fewer tables, long waits', tone: 'var(--color-accent-amber)', bar: 6, tables: 2 },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex justify-between gap-6">
        {states.map((s) => (
          <div key={s.label} className="flex-1 text-center">
            <p className="text-xl font-semibold uppercase tracking-wide" style={{ color: s.tone }}>
              {s.label}
            </p>
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <div className="flex gap-1">
                {Array.from({ length: s.bar }).map((_, i) => (
                  <span key={i} className="h-4 w-4 rounded-full" style={{ background: s.tone, opacity: 0.75 }} />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {Array.from({ length: s.tables }).map((_, i) => (
                  <span
                    key={i}
                    className="h-5 w-7 rounded-sm border"
                    style={{ borderColor: 'var(--color-text-muted)' }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-3 text-base text-[var(--color-text-secondary)]">{s.line}</p>
          </div>
        ))}
      </div>

      <svg viewBox="0 0 600 130" className="mt-6 w-full">
        <path
          d="M 40 110 Q 300 -10 560 110"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          opacity="0.8"
        />
        <line x1="300" y1="34" x2="300" y2="110" stroke="var(--color-accent-green)" strokeDasharray="5 5" />
        <text x="300" y="126" textAnchor="middle" fill="var(--color-text-muted)" fontSize="15">
          profit
        </text>
      </svg>
    </div>
  );
}

// Dining Time screen 1 — which kind of variability each challenge attacks.
function VariabilityTypes() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className={CAPTION}>Challenges 1–2</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--color-accent)]">Demand variability</p>
        <div className="mt-6 flex items-end justify-center gap-2">
          {[1, 3, 1, 4, 2, 5, 2].map((n, i) => (
            <span key={i} className="w-3 rounded-t bg-[var(--color-accent)]/70" style={{ height: `${n * 12}px` }} />
          ))}
        </div>
        <p className="mt-4 text-lg text-[var(--color-text-secondary)]">irregular arrivals → a buffer</p>
      </div>
      <div className="rounded-2xl border border-[var(--color-accent-green)]/50 bg-[var(--color-surface)] p-6 text-center">
        <p className={CAPTION}>Challenge 3</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--color-accent-green)]">Process variability</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <SeatTable filled={8} tone="var(--color-accent-green)" />
          <span className="font-mono text-2xl text-[var(--color-text-secondary)]">45 / 60 / 75</span>
        </div>
        <p className="mt-2 text-lg text-[var(--color-text-secondary)]">how long the table is held</p>
      </div>
    </div>
  );
}

// Dining Time screen 2 — the one calculation worth keeping.
function DiningTimeClock() {
  return (
    <div className="text-center">
      <div className="flex flex-wrap items-center justify-center gap-12">
        <ClockTable minutes={60} tone="var(--color-text-secondary)" figure="8 ÷ 1.00 = 8/hr" />
        <span className="text-4xl text-[var(--color-text-muted)]">→</span>
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
      <p className="mt-2 font-mono text-3xl text-[var(--color-text-primary)]">{figure}</p>
    </div>
  );
}

// Advertising — where the demand lands matters more than how much of it there is.
// Arrowheads are drawn as explicit geometry rather than SVG markers: markers
// re-orient along the line and do not inherit the stroke colour, which rendered
// them rotated and white.
function Arrow({ from, to, color }: { from: [number, number]; to: [number, number]; color: string }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = 11;
  const half = 5.5;
  // base of the arrowhead, and the two corners perpendicular to the direction
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const points = `${x2},${y2} ${bx - uy * half},${by + ux * half} ${bx + uy * half},${by - ux * half}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth="3" strokeLinecap="round" />
      <polygon points={points} fill={color} />
    </g>
  );
}

function AdvertisingDemand() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <svg viewBox="0 0 620 250" className="w-full">
        {/* unused early-evening capacity */}
        <path d="M 40 205 C 130 200 175 180 235 118 L 235 205 Z" fill="var(--color-accent)" opacity="0.14" />
        <path
          d="M 40 205 C 130 200 175 180 235 118 C 285 60 325 60 375 118 C 435 188 505 203 580 205"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
        />
        <line x1="40" y1="205" x2="580" y2="205" stroke="var(--color-border)" strokeWidth="2" />
        <text x="137" y="196" textAnchor="middle" fill="var(--color-text-muted)" fontSize="14">
          unused capacity
        </text>
        <text x="46" y="228" fill="var(--color-text-muted)" fontSize="14">5:30</text>
        <text x="305" y="228" textAnchor="middle" fill="var(--color-text-muted)" fontSize="14">8:00</text>
        <text x="548" y="228" fill="var(--color-text-muted)" fontSize="14">close</text>

        {/* lift the whole curve */}
        <Arrow from={[470, 180]} to={[470, 128]} color="var(--color-accent-green)" />
        <Arrow from={[418, 186]} to={[418, 134]} color="var(--color-accent-amber)" />
        {/* move demand from the peak into the unused early region */}
        <Arrow from={[300, 78]} to={[168, 150]} color="var(--color-accent)" />
      </svg>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Annot tone="var(--color-accent-green)" label="Awareness" caption="more total demand" />
        <Annot tone="var(--color-accent-amber)" label="Discount" caption="more demand, lower margin" />
        <Annot
          tone="var(--color-accent)"
          label="Happy hour / open earlier"
          caption="move demand to unused capacity"
        />
      </div>
    </div>
  );
}

function Annot({ tone, label, caption }: { tone: string; label: string; caption: string }) {
  return (
    <div className="rounded-xl border bg-[var(--color-surface)] px-4 py-3 text-center" style={{ borderColor: tone }}>
      <p className="text-lg font-semibold uppercase tracking-wide" style={{ color: tone }}>
        {label}
      </p>
      <p className="mt-1 text-base text-[var(--color-text-secondary)]">{caption}</p>
    </div>
  );
}

// Advanced Batching — unchanged timeline, plus the trigger prompt.
function DynamicTimeline() {
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
      <p className="mt-10 text-center text-lg text-[var(--color-text-muted)]">
        Possible triggers: arrival rate · bar queue · empty tables · time to close
      </p>
    </div>
  );
}

// Final screen 1 — three things people conflate.
function OptimizingWhat() {
  const cards = [
    { label: 'Throughput', line: 'more dinners' },
    { label: 'Utilization', line: 'busier tables' },
    { label: 'Profit', line: 'economic value' },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex items-center justify-center gap-4">
        {cards.map((c, i) => (
          <div key={c.label} className="flex items-center gap-4">
            <div
              className={`min-w-[190px] rounded-2xl border-2 px-6 py-8 text-center ${
                c.label === 'Profit'
                  ? 'border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]'
              }`}
            >
              <p
                className={`text-2xl font-bold uppercase tracking-wide ${
                  c.label === 'Profit' ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-text-primary)]'
                }`}
              >
                {c.label}
              </p>
              <p className="mt-2 text-lg text-[var(--color-text-secondary)]">{c.line}</p>
            </div>
            {i < cards.length - 1 && <span className="text-4xl font-bold text-[var(--color-text-muted)]">≠</span>}
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-lg text-[var(--color-accent-amber)]">
        Lost customers = future revenue at risk.
      </p>
    </div>
  );
}

// Final screen 2 — the levers feeding one outcome, now including demand shaping.
function SystemNodes() {
  const nodes = [
    { label: 'Batching', line: 'fills chef cycles' },
    { label: 'Buffer', line: 'stores arrivals' },
    { label: 'Dining time', line: 'creates capacity' },
    { label: 'Dynamic policy', line: 'matches decisions to demand' },
    { label: 'Demand shaping', line: 'moves load to spare capacity' },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="grid grid-cols-2 items-center gap-x-14 gap-y-4">
        {nodes.slice(0, 2).map((n) => (
          <Node key={n.label} {...n} />
        ))}
        <div className="col-span-2 flex justify-center">
          <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-4 border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 p-4 text-center">
            <span className="text-lg font-bold leading-tight text-[var(--color-accent-green)]">
              Profitable customer flow
            </span>
          </div>
        </div>
        {nodes.slice(2, 4).map((n) => (
          <Node key={n.label} {...n} />
        ))}
        <div className="col-span-2 flex justify-center">
          <div className="w-1/2">
            <Node {...nodes[4]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Node({ label, line }: { label: string; line: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-5 py-3 text-center">
      <p className="text-xl font-semibold text-[var(--color-accent)]">{label}</p>
      <p className="mt-1 text-base text-[var(--color-text-secondary)]">{line}</p>
    </div>
  );
}

// Final screen 3 — what each challenge was actually about.
function SynthesisBands() {
  // Same six bands and labels; the phrases now narrate Little's Law.
  const bands = [
    { label: 'Batching', line: 'protect productive I from party-size variability' },
    { label: 'Bar', line: 'buffer arrivals so productive I stays full' },
    { label: 'Dining time', line: 'reduce T when faster flow is valuable' },
    { label: 'Advertising', line: 'shape demand so capacity is useful at the right time' },
    { label: 'Dynamic batching', line: 'change the policy as the system state changes' },
    { label: 'Final', line: 'maximizing flow is not the same as maximizing profit' },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl space-y-2">
      {bands.map((b) => (
        <div
          key={b.label}
          className="flex items-center gap-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-left"
        >
          <span className="w-52 shrink-0 text-lg font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            {b.label}
          </span>
          <span className="text-lg text-[var(--color-text-secondary)]">{b.line}</span>
        </div>
      ))}
    </div>
  );
}
