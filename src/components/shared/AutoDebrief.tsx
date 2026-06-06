import type { ChallengeResult } from '../../engine/types';
import { money, pct } from '../../lib/format';

export function generateDebrief(result: ChallengeResult): string[] {
  const util = pct(result.avgChefUtil);
  const emptyHours = result.avgEmptyChairHours.toFixed(1);
  const dinners = result.runs.reduce((s, r) => s + r.dinnersServed, 0) / result.runs.length;
  const lostPct = pct(result.avgLost / (result.avgLost + dinners || 1));
  return [
    `Your chefs cooked for full-capacity equivalent of ${util} of the evening on average.`,
    `${emptyHours} chair-hours were paid for but sat empty next to diners during occupied seatings.`,
    `${lostPct} of the guests who showed up were lost — balking at a full bar or giving up while waiting.`,
    `Average profit landed at ${money(result.avgProfit)}, ranging from ${money(result.minProfit)} to ${money(result.maxProfit)} across the 20 nights.`,
  ];
}

export function AutoDebrief({ result }: { result: ChallengeResult }) {
  const lines = generateDebrief(result);
  return (
    <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-accent)]">Auto-debrief</h3>
      <ul className="space-y-1.5 text-sm text-[var(--color-text-primary)]">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[var(--color-accent)]">•</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
