import { clockLabel } from '../../lib/format';

interface Props {
  time: number;
  min: number;
  max: number;
  playing: boolean;
  speed: number;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
  onStep: (dir: 1 | -1) => void;
  onSpeed: (s: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export function TimelineScrubber({ time, min, max, playing, speed, onSeek, onTogglePlay, onStep, onSpeed }: Props) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onStep(-1)}
          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ⏮
        </button>
        <button
          onClick={onTogglePlay}
          className="rounded bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-white"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => onStep(1)}
          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ⏭
        </button>
        <span className="font-mono text-sm text-[var(--color-text-primary)]">{clockLabel(time)}</span>
        <div className="ml-auto flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              className={`rounded px-2 py-1 font-mono text-xs ${
                speed === s
                  ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <input
        type="range"
        className="mt-3 w-full"
        min={min}
        max={max}
        step={1}
        value={time}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <div className="mt-1 flex justify-between font-mono text-xs text-[var(--color-text-muted)]">
        <span>{clockLabel(min)}</span>
        <span>{clockLabel(max)}</span>
      </div>
    </div>
  );
}
