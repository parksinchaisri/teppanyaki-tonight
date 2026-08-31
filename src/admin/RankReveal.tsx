import { useEffect, useRef, useState } from 'react';
import type { RankedRow } from '../firebase/liveSession';
import { money } from '../lib/format';

const STEP_MS = 1300; // pause between reveals

// Kahoot-style countdown reveal.
//
// Two orderings are in play and they are deliberately opposite:
//   • SPATIAL — slots are laid out rank 1 at the top down to rank N at the
//     bottom, so the finished board reads like any other leaderboard.
//   • TEMPORAL — reveals run from rank N upward to rank 1, so the winner lands
//     last. Each row animates into its own correct slot.
export function RankReveal({
  ranked,
  count,
  onDone,
  label,
}: {
  ranked: RankedRow[];
  count: number;
  onDone: () => void;
  label?: string;
}) {
  const top = ranked.filter((r) => r.submitted).slice(0, count);
  const slots = top.length || count;
  // How many places have been revealed so far, counting up from the bottom.
  const [revealed, setRevealed] = useState(0);
  const [started, setStarted] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!started) return;
    if (revealed >= slots) {
      const id = setTimeout(() => doneRef.current(), STEP_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setRevealed((n) => n + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [started, revealed, slots]);

  // Rendered top-to-bottom as 1..N; a place is revealed once the countdown has
  // reached it from the bottom.
  const places = Array.from({ length: slots }, (_, i) => i + 1);

  return (
    <div className="mx-auto w-full">
      <style>{`
        @keyframes revealIn{0%{opacity:0;transform:translateX(-40px) scale(.96)}70%{opacity:1;transform:translateX(0) scale(1.03)}100%{opacity:1;transform:none}}
        @keyframes winnerPulse{0%{transform:scale(1)}30%{transform:scale(1.05)}60%{transform:scale(.99)}100%{transform:scale(1)}}
      `}</style>

      <div className="mb-6 flex items-center justify-center">
        {!started ? (
          <button
            onClick={() => setStarted(true)}
            className="rounded-xl bg-[var(--color-accent)] px-8 py-4 text-2xl font-semibold text-white shadow-lg"
          >
            {label ?? 'Reveal Rankings'} →
          </button>
        ) : (
          <p className="text-xl text-[var(--color-text-muted)]">
            {revealed >= slots ? 'And that’s the round.' : 'Counting down…'}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {places.map((place) => {
          const isRevealed = started && revealed >= slots - place + 1;
          const row = top[place - 1];
          const isWinner = place === 1;
          if (!isRevealed) {
            return (
              <div
                key={place}
                className="flex items-center rounded-xl border-2 border-dashed border-[var(--color-border)] px-6 py-4 opacity-40"
              >
                <span className="w-16 font-mono text-3xl text-[var(--color-text-muted)]">#{place}</span>
                <span className="text-2xl text-[var(--color-text-muted)]">— — —</span>
              </div>
            );
          }
          return (
            <div
              key={place}
              style={{
                animation: isWinner
                  ? 'revealIn .5s cubic-bezier(.2,.9,.3,1.3), winnerPulse .7s ease-out .5s'
                  : 'revealIn .5s cubic-bezier(.2,.9,.3,1.3)',
              }}
              className={`flex items-center justify-between gap-4 rounded-xl px-6 py-4 ${
                isWinner
                  ? 'border-4 border-[#d4af37] bg-[#d4af37]/15'
                  : 'border border-[var(--color-border)] bg-[var(--color-surface)]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className={`w-16 shrink-0 font-mono ${isWinner ? 'text-4xl' : 'text-3xl'}`}>#{place}</span>
                <span className={`truncate font-semibold ${isWinner ? 'text-4xl' : 'text-3xl'}`}>
                  {row?.studentName ?? '—'}
                </span>
                {isWinner && <span className="text-3xl">👑</span>}
                {row && row.delta !== null && row.delta !== 0 && (
                  <span
                    className={`shrink-0 font-mono text-xl ${
                      row.delta > 0 ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-accent-red)]'
                    }`}
                  >
                    {row.delta > 0 ? '▲' : '▼'}
                    {Math.abs(row.delta)}
                  </span>
                )}
                {row && row.streak >= 2 && (
                  <span className="shrink-0 rounded-full border border-[var(--color-accent-amber)]/50 px-2 text-sm text-[var(--color-accent-amber)]">
                    🔥 {row.streak}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 font-mono text-[var(--color-accent-green)] ${isWinner ? 'text-4xl' : 'text-3xl'}`}
              >
                {row ? money(row.value) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {started && (
        <button
          onClick={() => doneRef.current()}
          className="mx-auto mt-6 block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Skip to full board →
        </button>
      )}
    </div>
  );
}
