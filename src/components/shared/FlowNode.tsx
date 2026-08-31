// The Arrivals → Bar → Dining Room flow motif from the Prepare page, shared so
// Theater's debrief can project the same diagram rather than a lookalike.

export function FlowNode({
  title,
  subtitle,
  tone,
  big,
}: {
  title: string;
  subtitle: string;
  tone: string;
  big?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border bg-[var(--color-surface-raised)] text-center ${
        big ? 'min-w-[210px] px-6 py-5' : 'min-w-[130px] px-4 py-3'
      }`}
      style={{ borderColor: tone }}
    >
      <span className={big ? 'text-2xl font-semibold' : 'font-semibold'} style={{ color: tone }}>
        {title}
      </span>
      <span className={`text-[var(--color-text-secondary)] ${big ? 'mt-1 text-base' : 'text-xs'}`}>{subtitle}</span>
    </div>
  );
}

export function Arrow({ big }: { big?: boolean }) {
  return <span className={`text-[var(--color-text-muted)] ${big ? 'text-4xl' : 'text-2xl'}`}>→</span>;
}

// An 8-seat teppanyaki table: a grill with seats around it, some filled. Same
// shapes as the Prepare page floor schematic, sized for projection.
export function SeatTable({
  filled,
  tone,
  className = 'h-40 w-52',
}: {
  filled: number;
  tone: string;
  className?: string;
}) {
  const seats = Array.from({ length: 8 }, (_, i) => i < filled);
  return (
    <svg viewBox="0 0 140 110" className={className}>
      <rect x="45" y="35" width="50" height="42" rx="6" fill="var(--color-bg)" stroke="var(--color-border)" />
      <text x="70" y="62" textAnchor="middle" fontSize="20">👨‍🍳</text>
      {/* three seats each side, two at the grill end */}
      {seats.map((on, i) => {
        const pos =
          i < 3
            ? { x: 22, y: 38 + i * 18 }
            : i < 6
              ? { x: 118, y: 38 + (i - 3) * 18 }
              : { x: 55 + (i - 6) * 30, y: 16 };
        return (
          <rect
            key={i}
            x={pos.x - 8}
            y={pos.y - 8}
            width={16}
            height={16}
            rx={3}
            fill={on ? tone : 'none'}
            stroke={on ? tone : 'var(--color-text-muted)'}
            opacity={on ? 0.9 : 0.5}
          />
        );
      })}
    </svg>
  );
}
