import type { ChallengeResult } from '../../engine/types';
import { pct } from '../../lib/format';

export function UtilizationMeter({ result }: { result: ChallengeResult }) {
  const util = result.avgChefUtil;
  const empty = result.avgEmptyChairHours;
  // Approximate total chair-hours from used + empty for the proportional bar.
  const usedHours = empty * (util / Math.max(0.001, 1 - util));
  const total = usedHours + empty || 1;
  const usedFrac = usedHours / total;

  const tone = util >= 0.6 ? 'var(--color-accent-green)' : util >= 0.45 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)';

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold">Chef utilisation</h3>
      <div className="flex items-end gap-6">
        <div>
          <div className="font-mono text-4xl font-semibold" style={{ color: tone }}>
            {pct(util)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">seats filled × time</div>
        </div>
        <div
          className="group relative"
          title="Seat-hours of chef capacity paid for but not used by diners"
        >
          <div className="font-mono text-2xl">{empty.toFixed(0)} hrs</div>
          <div className="text-xs text-[var(--color-text-muted)]">empty chair-hours</div>
        </div>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[var(--color-bg)]">
        <div className="h-full" style={{ width: `${usedFrac * 100}%`, background: tone }} />
        <div className="h-full flex-1" style={{ background: 'var(--color-accent-red)', opacity: 0.35 }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
        <span>used capacity</span>
        <span>wasted capacity</span>
      </div>
    </div>
  );
}
