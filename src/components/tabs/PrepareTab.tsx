import { PARAMS } from '../../engine/params';
import { money } from '../../lib/format';
import { useApp } from '../../store/appContext';
import { Arrow, FlowNode } from '../shared/FlowNode';
import { IntroContent } from '../shared/IntroContent';

export function PrepareTab({ onStart }: { onStart: () => void }) {
  const { settings } = useApp();
  const guarded = settings.preparePageMode === 'guarded';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Scoped strictly to this tab's prose — challenge controls, the app name
          and every other page are untouched. */}
      {/* Both the welcome copy and the run sheet below it come from the shared
          component Theater projects, so the two can never disagree. */}
      <section
        style={guarded ? { userSelect: 'none', WebkitUserSelect: 'none' } : undefined}
        onContextMenu={guarded ? (e) => e.preventDefault() : undefined}
      >
        <IntroContent settings={settings} />
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">How a guest moves through the restaurant</h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <FlowNode title="Arrivals" subtitle="parties of 1–8" tone="var(--color-text-secondary)" />
          <Arrow />
          <FlowNode title="Bar" subtitle="buffer · drinks · may renege" tone="var(--color-accent)" />
          <Arrow />
          <FlowNode title="Dining Room" subtitle="chef grill tables" tone="var(--color-accent-green)" />
          <Arrow />
          <FlowNode title="Depart" subtitle="dinner complete" tone="var(--color-text-secondary)" />
        </div>
        <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
          If the bar is full when a party arrives, they leave immediately (a balk). If they wait too long, they give
          up (a renege). Either way, a lost guest is lost revenue.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Dinner price', value: money(PARAMS.DINNER_PRICE), sub: `margin ${money(PARAMS.DINNER_PRICE - PARAMS.DINNER_VAR_COST)}/cover` },
          { label: 'Drink price', value: money(PARAMS.DRINK_PRICE), sub: `margin ${money(PARAMS.DRINK_PRICE - PARAMS.DRINK_VAR_COST)}/drink` },
          { label: 'Evening fixed cost', value: money(PARAMS.FIXED_COST_EVENING), sub: 'chefs · rent · overhead' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{s.label}</div>
            <div className="mt-1 font-mono text-2xl">{s.value}</div>
            <div className="text-xs text-[var(--color-text-secondary)]">{s.sub}</div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">The floor</h2>
        <FloorSchematic />
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          Work through the six challenges from left to right. Each one isolates a single decision so you can see its
          effect cleanly, before the final challenge asks you to combine everything.
        </p>
        <button
          onClick={onStart}
          className="mt-4 rounded-md bg-[var(--color-accent)] px-5 py-2.5 font-medium text-white"
        >
          Start the challenges →
        </button>
      </section>
    </div>
  );
}

function FloorSchematic() {
  return (
    <svg viewBox="0 0 600 200" className="w-full">
      {/* Bar */}
      <rect x="10" y="20" width="180" height="160" rx="8" fill="var(--color-surface-raised)" stroke="var(--color-accent)" />
      <text x="100" y="40" textAnchor="middle" fill="var(--color-accent)" fontSize="13" fontFamily="IBM Plex Mono">
        BAR
      </text>
      {Array.from({ length: 16 }).map((_, i) => (
        <circle
          key={i}
          cx={35 + (i % 8) * 18}
          cy={70 + Math.floor(i / 8) * 30}
          r={6}
          fill="none"
          stroke="var(--color-text-muted)"
        />
      ))}
      {/* Arrow */}
      <text x="210" y="105" textAnchor="middle" fill="var(--color-text-muted)" fontSize="22">→</text>
      {/* Dining room */}
      <rect x="240" y="20" width="350" height="160" rx="8" fill="var(--color-surface-raised)" stroke="var(--color-accent-green)" />
      <text x="415" y="40" textAnchor="middle" fill="var(--color-accent-green)" fontSize="13" fontFamily="IBM Plex Mono">
        DINING ROOM
      </text>
      {Array.from({ length: 6 }).map((_, i) => {
        const tx = 262 + (i % 3) * 108;
        const ty = 62 + Math.floor(i / 3) * 62;
        // U-shaped teppanyaki table: grill surface with 3 seats per side + 2 at the
        // grill end (matches the live animation, shapes only — no live state here).
        const seats = [
          { x: tx + 8, y: ty + 14 }, // left column
          { x: tx + 8, y: ty + 26 },
          { x: tx + 8, y: ty + 38 },
          { x: tx + 62, y: ty + 14 }, // right column
          { x: tx + 62, y: ty + 26 },
          { x: tx + 62, y: ty + 38 },
          { x: tx + 28, y: ty + 4 }, // grill end (top)
          { x: tx + 42, y: ty + 4 },
        ];
        return (
          <g key={i}>
            <rect x={tx + 20} y={ty + 12} width={30} height={30} rx={5} fill="var(--color-bg)" stroke="var(--color-border)" />
            <text x={tx + 35} y={ty + 30} textAnchor="middle" fontSize={11}>👨‍🍳</text>
            {seats.map((s, k) => (
              <circle key={k} cx={s.x} cy={s.y} r={4} fill="none" stroke="var(--color-text-muted)" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
