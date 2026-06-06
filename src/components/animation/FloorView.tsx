import type { RunStats, SimConfig } from '../../engine/types';
import { deriveFloorState, tableCount, type TableVis } from './floorState';

const FULL_CAPACITY = 8;
const SLOT_CAPACITY = 4;

export function FloorView({ run, config, time }: { run: RunStats; config: SimConfig; time: number }) {
  const { barOccupants, tables } = deriveFloorState(run, time);
  const count = tableCount(config);

  const barSeats = config.barSeats;
  // Spread bar seats across a balanced block so the panel fills naturally instead
  // of leaving a large empty gap below two long rows.
  const barCols = Math.min(12, Math.max(6, Math.ceil(Math.sqrt(barSeats * 2.2))));
  const tableCols = Math.min(6, Math.max(3, count <= 15 ? 5 : 6));

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_1.8fr]">
      {/* Bar */}
      <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs uppercase text-[var(--color-accent)]">Bar</span>
          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
            {barOccupants}/{barSeats} seats
          </span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${barCols}, minmax(0, 1fr))` }}>
          {Array.from({ length: barSeats }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-full border"
              style={{
                maxWidth: 22,
                borderColor: i < barOccupants ? 'var(--color-accent)' : 'var(--color-border)',
                background: i < barOccupants ? 'var(--color-accent)' : 'transparent',
              }}
            />
          ))}
        </div>
      </div>

      {/* Dining room */}
      <div className="rounded-lg border border-[var(--color-accent-green)]/40 bg-[var(--color-surface)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs uppercase text-[var(--color-accent-green)]">Dining Room</span>
          <span className="font-mono text-xs text-[var(--color-text-secondary)]">
            {tables.size}/{count} tables occupied
          </span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tableCols}, minmax(0, 1fr))` }}>
          {Array.from({ length: count }).map((_, id) => (
            <TeppanTable key={id} id={id} vis={tables.get(id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Seat slot positions for a U-shaped 8-seat teppanyaki table. For full tables the
// fill order is left column → right column → top seats. For split (four_share)
// tables the LEFT half = indices 0,1,2,6 and the RIGHT half = indices 3,4,5,7.
const SEAT_SLOTS: { x: number; y: number }[] = [
  { x: 16, y: 50 }, // 0 left top
  { x: 16, y: 73 }, // 1 left mid
  { x: 16, y: 96 }, // 2 left bottom
  { x: 94, y: 50 }, // 3 right top
  { x: 94, y: 73 }, // 4 right mid
  { x: 94, y: 96 }, // 5 right bottom
  { x: 44, y: 22 }, // 6 top-left
  { x: 66, y: 22 }, // 7 top-right
];
const LEFT_HALF = [0, 1, 2, 6];
const RIGHT_HALF = [3, 4, 5, 7];

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

function TeppanTable({ id, vis }: { id: number; vis?: TableVis }) {
  const isOcc = Boolean(vis && (vis.slot0 || vis.slot1));
  const split = Boolean(vis?.split);

  if (split) return <SplitTable id={id} vis={vis!} />;

  const occupied = vis?.slot0?.size ?? 0;
  const full = occupied >= FULL_CAPACITY;
  const accent = !isOcc ? 'var(--color-border)' : full ? 'var(--color-accent-green)' : 'var(--color-accent-amber)';

  return (
    <svg viewBox="0 0 110 130" className="w-full" style={{ maxWidth: 120 }}>
      <rect
        x={30}
        y={32}
        width={50}
        height={72}
        rx={9}
        fill={isOcc ? `color-mix(in srgb, ${accent} 20%, transparent)` : 'var(--color-bg)'}
        stroke={isOcc ? accent : 'var(--color-border)'}
        strokeWidth={vis?.recentlySeated ? 2.5 : 1.2}
      />
      <text x={6} y={12} fill="var(--color-text-muted)" fontSize={9} fontFamily="IBM Plex Mono">
        T{id + 1}
      </text>
      {SEAT_SLOTS.map((s, i) => (
        <Seat key={i} slot={s} filled={i < occupied} color="var(--color-accent-green)" />
      ))}
      {isOcc && (
        <>
          <text x={55} y={66} textAnchor="middle" fontSize={18}>
            👨‍🍳
          </text>
          <text x={55} y={86} textAnchor="middle" fill={accent} fontSize={11} fontFamily="IBM Plex Mono">
            {occupied}/{FULL_CAPACITY}
          </text>
        </>
      )}
    </svg>
  );
}

// four_share: the table is split into two independent 4-seat halves by a centre
// line. Each half fills and empties on its own.
function SplitTable({ id, vis }: { id: number; vis: TableVis }) {
  const left = vis.slot0?.size ?? 0;
  const right = vis.slot1?.size ?? 0;
  const leftColor = left > 0 ? 'var(--color-accent-green)' : 'var(--color-border)';
  const rightColor = right > 0 ? 'var(--color-accent-green)' : 'var(--color-border)';

  return (
    <svg viewBox="0 0 110 130" className="w-full" style={{ maxWidth: 120 }}>
      {/* two half-surfaces */}
      <rect x={30} y={32} width={23} height={72} rx={7}
        fill={left > 0 ? 'color-mix(in srgb, var(--color-accent-green) 20%, transparent)' : 'var(--color-bg)'}
        stroke={left > 0 ? leftColor : 'var(--color-border)'} strokeWidth={vis.recentlySeated ? 2.2 : 1.1} />
      <rect x={57} y={32} width={23} height={72} rx={7}
        fill={right > 0 ? 'color-mix(in srgb, var(--color-accent-green) 20%, transparent)' : 'var(--color-bg)'}
        stroke={right > 0 ? rightColor : 'var(--color-border)'} strokeWidth={vis.recentlySeated ? 2.2 : 1.1} />
      {/* dividing line */}
      <line x1={55} y1={30} x2={55} y2={106} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3" />
      <text x={6} y={12} fill="var(--color-text-muted)" fontSize={9} fontFamily="IBM Plex Mono">
        T{id + 1}
      </text>
      {LEFT_HALF.map((idx, i) => (
        <Seat key={`l${idx}`} slot={SEAT_SLOTS[idx]} filled={i < left} color="var(--color-accent-green)" />
      ))}
      {RIGHT_HALF.map((idx, i) => (
        <Seat key={`r${idx}`} slot={SEAT_SLOTS[idx]} filled={i < right} color="var(--color-accent-green)" />
      ))}
      {left > 0 && (
        <text x={42} y={78} textAnchor="middle" fontSize={9} fontFamily="IBM Plex Mono" fill={leftColor}>
          {left}/{SLOT_CAPACITY}
        </text>
      )}
      {right > 0 && (
        <text x={68} y={78} textAnchor="middle" fontSize={9} fontFamily="IBM Plex Mono" fill={rightColor}>
          {right}/{SLOT_CAPACITY}
        </text>
      )}
    </svg>
  );
}
