import { useEffect, useRef } from 'react';
import type { SimEvent } from '../../engine/types';
import { clockLabel } from '../../lib/format';

const STYLE: Record<SimEvent['type'], { border: string; icon: string }> = {
  ARRIVE: { border: 'var(--color-text-muted)', icon: '→' },
  ENTER_BAR: { border: 'var(--color-accent)', icon: '→' },
  SEAT_DINING: { border: 'var(--color-accent-green)', icon: '🍽' },
  DEPART: { border: 'var(--color-text-muted)', icon: '←' },
  BALK: { border: 'var(--color-accent-red)', icon: '✗' },
  RENEGE: { border: 'var(--color-accent-red)', icon: '✗' },
  BATCH_FORMED: { border: 'var(--color-accent-green)', icon: '🍽' },
};

export function EventLog({ events, time }: { events: SimEvent[]; time: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = events.filter((e) => e.time <= time);
  const shown = visible.slice(-120); // cap DOM size; newest at the bottom

  // Auto-scroll to the bottom (newest) as events are added.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [visible.length]);

  return (
    <div
      ref={ref}
      className="w-full overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ height: 180 }}
    >
      {shown.length === 0 && (
        <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
          No events yet…
        </div>
      )}
      {shown.map((e, i) => {
        const s = STYLE[e.type];
        return (
          <div
            key={i}
            className="flex items-center gap-2 px-2 text-xs"
            style={{
              height: 28,
              borderLeft: `3px solid ${s.border}`,
              background: i % 2 ? 'transparent' : 'color-mix(in srgb, var(--color-surface-raised) 60%, transparent)',
            }}
          >
            <span className="shrink-0 font-mono text-[var(--color-text-muted)]" style={{ width: 64 }}>
              {clockLabel(e.time)}
            </span>
            <span className="shrink-0 text-center" style={{ width: 18, color: s.border }}>
              {s.icon}
            </span>
            <span className="truncate text-[var(--color-text-secondary)]">{e.description}</span>
          </div>
        );
      })}
    </div>
  );
}
