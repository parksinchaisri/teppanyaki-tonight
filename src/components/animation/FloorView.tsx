import type { RunStats, SimConfig } from '../../engine/types';
import { deriveFloorState, tableCount, type TableVis } from './floorState';

const FULL_CAPACITY = 8;
const SLOT_CAPACITY = 4;
const COUNTER_MIN = 7;

function tableOccupied(vis?: TableVis): number {
  return (vis?.slot0?.size ?? 0) + (vis?.slot1?.size ?? 0);
}

export function FloorView({ run, config, time }: { run: RunStats; config: SimConfig; time: number }) {
  const { barOccupants, tables } = deriveFloorState(run, time);
  const count = tableCount(config);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_1.8fr]">
      <BarArea barSeats={config.barSeats} occupants={barOccupants} />
      <DiningArea count={count} tables={tables} />
    </div>
  );
}

// ── Bar: scattered cocktail tables + a bar counter strip ────────────────────

function BarArea({ barSeats, occupants }: { barSeats: number; occupants: number }) {
  const cocktailTables = Math.max(0, Math.floor((barSeats - COUNTER_MIN) / 4));
  const counterSeats = barSeats - cocktailTables * 4; // ≥ COUNTER_MIN by construction

  // Greedy fill: cocktail tables first (4 each), then overflow to the counter.
  const tableFill = (t: number) => Math.max(0, Math.min(4, occupants - t * 4));
  const counterFilled = Math.max(0, occupants - cocktailTables * 4);

  return (
    <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs uppercase text-[var(--color-accent)]">Bar</span>
        <span className="font-mono text-xs text-[var(--color-text-secondary)]">
          {occupants}/{barSeats} seats
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">
        {Array.from({ length: cocktailTables }).map((_, t) => (
          <CocktailTable key={t} filled={tableFill(t)} />
        ))}
      </div>

      <BarCounter seats={counterSeats} filled={counterFilled} />
    </div>
  );
}

function CocktailTable({ filled }: { filled: number }) {
  // center surface + 4 stools at N/E/S/W
  const seats = [
    { x: 30, y: 9 },
    { x: 51, y: 30 },
    { x: 30, y: 51 },
    { x: 9, y: 30 },
  ];
  return (
    <svg viewBox="0 0 60 60" style={{ width: 54, height: 54 }}>
      <circle cx={30} cy={30} r={12} fill="var(--color-surface-raised)" stroke="var(--color-border)" strokeWidth={1.2} />
      {seats.map((s, i) => {
        const on = i < filled;
        return (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={7}
            fill={on ? 'var(--color-accent)' : 'transparent'}
            stroke={on ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            strokeWidth={1.2}
          />
        );
      })}
    </svg>
  );
}

function BarCounter({ seats, filled }: { seats: number; filled: number }) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-end justify-center gap-1">
        {Array.from({ length: seats }).map((_, i) => {
          const on = i < filled;
          return (
            <div
              key={i}
              className="rounded-full border"
              style={{
                width: 13,
                height: 13,
                borderColor: on ? 'var(--color-accent)' : 'var(--color-text-muted)',
                background: on ? 'var(--color-accent)' : 'transparent',
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 h-2 rounded-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)]" />
      <div className="mt-0.5 text-center font-mono text-[10px] uppercase text-[var(--color-text-muted)]">Bar counter</div>
    </div>
  );
}

// ── Dining room: tables paired with one chef at the grill between them ──────

function DiningArea({ count, tables }: { count: number; tables: Map<number, TableVis> }) {
  const occupiedCount = [...tables.values()].filter((v) => v.slot0 || v.slot1).length;
  const pairs: Array<[number, number | null]> = [];
  for (let i = 0; i < count; i += 2) pairs.push([i, i + 1 < count ? i + 1 : null]);

  return (
    <div className="rounded-lg border border-[var(--color-accent-green)]/40 bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs uppercase text-[var(--color-accent-green)]">Dining Room</span>
        <span className="font-mono text-xs text-[var(--color-text-secondary)]">
          {occupiedCount}/{count} tables occupied
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {pairs.map(([a, b]) => (
          <TablePair key={a} a={a} b={b} visA={tables.get(a)} visB={b != null ? tables.get(b) : undefined} />
        ))}
      </div>
    </div>
  );
}

function TablePair({
  a,
  b,
  visA,
  visB,
}: {
  a: number;
  b: number | null;
  visA?: TableVis;
  visB?: TableVis;
}) {
  const chefActive = tableOccupied(visA) > 0 || tableOccupied(visB) > 0;
  return (
    <div className="flex items-center" style={{ gap: 2 }}>
      {/* Table A: U opens to the right — grill edge faces the chef in the gap. */}
      <div className="flex-1" style={{ maxWidth: 82 }}>
        <TeppanTable id={a} vis={visA} openSide="right" />
      </div>
      <div
        className="flex shrink-0 items-center justify-center text-base"
        style={{ width: 22, opacity: chefActive ? 1 : 0.12 }}
        title="Chef cooks for both tables in the pair"
      >
        👨‍🍳
      </div>
      {/* Table B: U opens to the left — grill edge faces the chef in the gap. */}
      {b != null ? (
        <div className="flex-1" style={{ maxWidth: 82 }}>
          <TeppanTable id={b} vis={visB} openSide="left" />
        </div>
      ) : (
        <div style={{ width: 82 }} />
      )}
    </div>
  );
}

function Seat({ slot, filled, color }: { slot: { x: number; y: number }; filled: boolean; color: string }) {
  return (
    <circle
      cx={slot.x}
      cy={slot.y}
      r={7}
      fill={filled ? color : 'transparent'}
      stroke={filled ? color : 'var(--color-text-muted)'}
      strokeWidth={1.2}
    />
  );
}

// Seats for a U whose grill edge faces RIGHT (toward the chef): 2 on the closed
// back (left), 3 along the top, 3 along the bottom — the right side is the grill
// (no seats). Fill order: back → top → bottom. Mirror for the left-facing U.
const OPEN_RIGHT_SEATS = [
  { x: 12, y: 52 },
  { x: 12, y: 78 },
  { x: 30, y: 14 },
  { x: 48, y: 14 },
  { x: 66, y: 14 },
  { x: 30, y: 116 },
  { x: 48, y: 116 },
  { x: 66, y: 116 },
];
const OPEN_LEFT_SEATS = OPEN_RIGHT_SEATS.map((s) => ({ x: 110 - s.x, y: s.y }));

function TeppanTable({ id, vis, openSide }: { id: number; vis?: TableVis; openSide: 'left' | 'right' }) {
  const isOcc = Boolean(vis && (vis.slot0 || vis.slot1));
  if (vis?.split) return <SplitTable id={id} vis={vis} openSide={openSide} />;

  const occupied = vis?.slot0?.size ?? 0;
  const full = occupied >= FULL_CAPACITY;
  const accent = !isOcc ? 'var(--color-border)' : full ? 'var(--color-accent-green)' : 'var(--color-accent-amber)';

  const openRight = openSide === 'right';
  const seats = openRight ? OPEN_RIGHT_SEATS : OPEN_LEFT_SEATS;
  const surfaceX = openRight ? 22 : 32; // dining surface; grill edge sits on the chef side
  const grillX = openRight ? 78 : 20; // 12-wide grill bar on the chef-facing edge
  const labelX = openRight ? 6 : 104;
  const labelAnchor = openRight ? 'start' : 'end';

  return (
    <svg viewBox="0 0 110 130" className="w-full">
      {/* dining surface (three seated sides) */}
      <rect
        x={surfaceX}
        y={26}
        width={56}
        height={78}
        rx={8}
        fill={isOcc ? `color-mix(in srgb, ${accent} 20%, transparent)` : 'var(--color-bg)'}
        stroke={isOcc ? accent : 'var(--color-border)'}
        strokeWidth={vis?.recentlySeated ? 2.5 : 1.2}
      />
      {/* grill edge — the flat back of the U, facing the chef in the gap */}
      <rect
        x={grillX}
        y={24}
        width={12}
        height={82}
        rx={3}
        fill="color-mix(in srgb, var(--color-accent-amber) 22%, transparent)"
        stroke="var(--color-accent-amber)"
        strokeWidth={1}
      />
      <text x={labelX} y={12} textAnchor={labelAnchor} fill="var(--color-text-muted)" fontSize={9} fontFamily="IBM Plex Mono">
        T{id + 1}
      </text>
      {seats.map((s, i) => (
        <Seat key={i} slot={s} filled={i < occupied} color="var(--color-accent-green)" />
      ))}
      {isOcc && (
        <text x={surfaceX + 28} y={70} textAnchor="middle" fill={accent} fontSize={13} fontFamily="IBM Plex Mono">
          {occupied}/{FULL_CAPACITY}
        </text>
      )}
    </svg>
  );
}

// four_share: the table is split into two independent 4-seat groups that still
// share one grill facing the chef. The grill edge faces the chef (openSide), a
// dashed line divides the upper 4-top (slot0) from the lower 4-top (slot1).
function SplitTable({ id, vis, openSide }: { id: number; vis: TableVis; openSide: 'left' | 'right' }) {
  const upper = vis.slot0?.size ?? 0;
  const lower = vis.slot1?.size ?? 0;
  const upperColor = upper > 0 ? 'var(--color-accent-green)' : 'var(--color-border)';
  const lowerColor = lower > 0 ? 'var(--color-accent-green)' : 'var(--color-border)';

  const openRight = openSide === 'right';
  const seats = openRight ? OPEN_RIGHT_SEATS : OPEN_LEFT_SEATS;
  // Upper 4-top = back seat 0 + the three top seats; lower 4-top = back seat 1 + three bottom seats.
  const UPPER = [0, 2, 3, 4];
  const LOWER = [1, 5, 6, 7];
  const surfaceX = openRight ? 22 : 32;
  const grillX = openRight ? 78 : 20;
  const labelX = openRight ? 6 : 104;
  const labelAnchor = openRight ? 'start' : 'end';

  return (
    <svg viewBox="0 0 110 130" className="w-full">
      {/* upper / lower half-surfaces */}
      <rect x={surfaceX} y={26} width={56} height={37} rx={7}
        fill={upper > 0 ? 'color-mix(in srgb, var(--color-accent-green) 20%, transparent)' : 'var(--color-bg)'}
        stroke={upper > 0 ? upperColor : 'var(--color-border)'} strokeWidth={vis.recentlySeated ? 2.2 : 1.1} />
      <rect x={surfaceX} y={67} width={56} height={37} rx={7}
        fill={lower > 0 ? 'color-mix(in srgb, var(--color-accent-green) 20%, transparent)' : 'var(--color-bg)'}
        stroke={lower > 0 ? lowerColor : 'var(--color-border)'} strokeWidth={vis.recentlySeated ? 2.2 : 1.1} />
      {/* shared grill edge facing the chef */}
      <rect x={grillX} y={24} width={12} height={82} rx={3}
        fill="color-mix(in srgb, var(--color-accent-amber) 22%, transparent)" stroke="var(--color-accent-amber)" strokeWidth={1} />
      <text x={labelX} y={12} textAnchor={labelAnchor} fill="var(--color-text-muted)" fontSize={9} fontFamily="IBM Plex Mono">
        T{id + 1}
      </text>
      {UPPER.map((idx, i) => (
        <Seat key={`u${idx}`} slot={seats[idx]} filled={i < upper} color="var(--color-accent-green)" />
      ))}
      {LOWER.map((idx, i) => (
        <Seat key={`d${idx}`} slot={seats[idx]} filled={i < lower} color="var(--color-accent-green)" />
      ))}
      {upper > 0 && (
        <text x={surfaceX + 28} y={48} textAnchor="middle" fontSize={9} fontFamily="IBM Plex Mono" fill={upperColor}>
          {upper}/{SLOT_CAPACITY}
        </text>
      )}
      {lower > 0 && (
        <text x={surfaceX + 28} y={90} textAnchor="middle" fontSize={9} fontFamily="IBM Plex Mono" fill={lowerColor}>
          {lower}/{SLOT_CAPACITY}
        </text>
      )}
    </svg>
  );
}
