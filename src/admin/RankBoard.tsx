import { useMemo } from 'react';
import {
  biggestClimber,
  cumulativeStandings,
  previousRanks,
  rankRows,
  roundStandings,
  type RankedRow,
} from '../firebase/liveSession';
import type { LeaderboardRow, LiveSessionState, StudentRow } from '../firebase/types';
import { money } from '../lib/format';
import { useFlip } from '../components/shared/useFlip';

// The shared ranked board used by Theater Mode and the admin Live Board:
// proportional bars, rank movement, streaks and animated reordering.
export function RankBoard({
  rows,
  students,
  order,
  challengeKey,
  view,
  roundHistory,
  compact = false,
  maxHeight,
}: {
  rows: LeaderboardRow[];
  students: StudentRow[];
  order: string[];
  challengeKey: string | null;
  view: 'round' | 'cumulative';
  roundHistory: LiveSessionState['roundHistory'];
  compact?: boolean;
  maxHeight?: string;
}) {
  const ranked = useMemo(() => {
    const standings =
      view === 'cumulative'
        ? cumulativeStandings(rows, order, students)
        : challengeKey
          ? roundStandings(rows, students, challengeKey)
          : [];
    const previous = previousRanks(rows, order, challengeKey, view, students);
    // In cumulative view, how much of the total came from this round.
    const contribution =
      view === 'cumulative' && challengeKey
        ? new Map(
            rows.filter((r) => r.challengeKey === challengeKey).map((r) => [r.studentId, r.bestAvgProfit]),
          )
        : undefined;
    return rankRows(standings, previous, roundHistory, contribution);
  }, [rows, students, order, challengeKey, view, roundHistory]);

  const climber = useMemo(() => biggestClimber(ranked), [ranked]);
  const flipRef = useFlip();

  if (!ranked.length) {
    return <p className="py-8 text-center text-[var(--color-text-muted)]">No students yet.</p>;
  }

  return (
    <div className="space-y-3">
      {climber && (
        <div className="rounded-lg border border-[var(--color-accent-green)]/40 bg-[var(--color-accent-green)]/10 px-4 py-2 text-center">
          <span className={compact ? 'text-sm' : 'text-xl'}>
            🚀 Biggest Climber: <strong>{climber.studentName}</strong> (+{climber.delta} spot
            {climber.delta === 1 ? '' : 's'})
          </span>
        </div>
      )}

      <div
        className="space-y-2 overflow-y-auto pr-1"
        style={{ maxHeight: maxHeight ?? (compact ? '22rem' : 'calc(100vh - 20rem)') }}
      >
        {ranked.map((r) => (
          <RankRow key={r.studentId} row={r} compact={compact} view={view} innerRef={flipRef(r.studentId)} />
        ))}
      </div>
    </div>
  );
}

function RankRow({
  row,
  compact,
  view,
  innerRef,
}: {
  row: RankedRow;
  compact: boolean;
  view: 'round' | 'cumulative';
  innerRef: (el: HTMLElement | null) => void;
}) {
  const isLeader = row.rank === 1 && row.submitted;
  const pad = compact ? 'px-3 py-2' : 'px-5 py-3';
  const nameSize = compact ? 'text-sm' : 'text-2xl';
  const valueSize = compact ? 'text-sm' : 'text-2xl';

  return (
    <div
      ref={innerRef}
      className={`relative overflow-hidden rounded-xl border ${pad} ${
        !row.submitted
          ? 'border-dashed border-[var(--color-border)] opacity-50'
          : isLeader
            ? 'border-2 border-[#d4af37] bg-[#d4af37]/10'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      {/* Proportional bar, behind the content */}
      {row.submitted && (
        <div
          className="absolute inset-y-0 left-0 -z-0"
          style={{
            width: `${Math.max(2, row.share * 100)}%`,
            background: isLeader ? 'rgba(212,175,55,0.20)' : 'var(--color-accent)',
            opacity: isLeader ? 1 : 0.16,
            transition: 'width 480ms cubic-bezier(0.2,0.8,0.2,1)',
          }}
        />
      )}

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className={`${compact ? 'w-6 text-xs' : 'w-10 text-xl'} shrink-0 font-mono text-[var(--color-text-muted)]`}>
            {row.submitted ? row.rank : '—'}
          </span>
          <span className={`truncate font-medium ${nameSize}`}>{row.studentName}</span>
          {isLeader && <span className={compact ? 'text-sm' : 'text-xl'}>👑</span>}
          <Delta delta={row.delta} compact={compact} />
          {row.streak >= 2 && (
            <span
              title={`Top 5 for ${row.streak} rounds running`}
              className={`shrink-0 rounded-full border border-[var(--color-accent-amber)]/50 px-2 ${
                compact ? 'text-[10px]' : 'text-sm'
              } text-[var(--color-accent-amber)]`}
            >
              🔥 {row.streak}
            </span>
          )}
          {row.autoSubmitted && (
            <span className="shrink-0 rounded-full border border-[var(--color-accent-amber)]/50 px-2 text-[10px] text-[var(--color-accent-amber)]">
              auto
            </span>
          )}
        </span>

        {row.submitted ? (
          <span className="shrink-0 text-right">
            <span className={`font-mono ${valueSize} text-[var(--color-accent-green)]`}>{money(row.value)}</span>
            {view === 'cumulative' && row.roundDelta != null && row.roundDelta > 0 && (
              <span className={`ml-2 font-mono ${compact ? 'text-[10px]' : 'text-sm'} text-[var(--color-text-muted)]`}>
                (+{money(row.roundDelta)} this round)
              </span>
            )}
          </span>
        ) : (
          <span className={`shrink-0 ${compact ? 'text-xs' : 'text-lg'} text-[var(--color-text-muted)]`}>
            No submission
          </span>
        )}
      </div>
    </div>
  );
}

function Delta({ delta, compact }: { delta: number | null; compact: boolean }) {
  const size = compact ? 'text-[10px]' : 'text-base';
  if (delta === null) return <span className={`shrink-0 ${size} text-[var(--color-text-muted)]`}>new</span>;
  if (delta === 0) return <span className={`shrink-0 ${size} text-[var(--color-text-muted)]`}>—</span>;
  const up = delta > 0;
  return (
    <span
      className={`shrink-0 font-mono ${size} ${
        up ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-accent-red)]'
      }`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(delta)}
    </span>
  );
}
