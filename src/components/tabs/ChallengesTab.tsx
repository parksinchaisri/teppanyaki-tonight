import { useState } from 'react';
import { CHALLENGES, CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { useApp } from '../../store/appContext';
import { makeInitialChallengeState, type ChallengeContentProps } from '../challenges/ChallengeShell';
import { Batching } from '../challenges/Batching';
import { BarSize } from '../challenges/BarSize';
import { DiningTime } from '../challenges/DiningTime';
import { Advertising } from '../challenges/Advertising';
import { AdvancedBatching } from '../challenges/AdvancedBatching';
import { FinalChallenge } from '../challenges/FinalChallenge';

const COMPONENTS: Record<string, (props: ChallengeContentProps) => React.ReactElement> = {
  batching: Batching,
  barSize: BarSize,
  diningTime: DiningTime,
  advertising: Advertising,
  advancedBatching: AdvancedBatching,
  finalChallenge: FinalChallenge,
};

export function ChallengesTab() {
  const { settings, completed, params, challengeStates, setChallengeStates } = useApp();
  const [active, setActive] = useState('batching');
  // Per-challenge state lives in appContext so it survives switching the top-level
  // tabs (Prepare/Challenges/Leaderboard) as well as the challenge sub-tabs.
  const states = challengeStates;
  const setStates = setChallengeStates;

  const paramDefaults = { defaultBarSeats: params.defaultBarSeats, defaultTables: params.defaultTables };
  // Deterministic given params, so computing a missing slice during render is safe.
  const activeState = states[active] ?? makeInitialChallengeState(CHALLENGE_BY_KEY[active], paramDefaults);

  const onChange: ChallengeContentProps['onChange'] = (updater) => {
    setStates((prev) => {
      const cur = prev[active] ?? makeInitialChallengeState(CHALLENGE_BY_KEY[active], paramDefaults);
      return { ...prev, [active]: updater(cur) };
    });
  };

  function isLocked(index: number): boolean {
    if (!settings.lockChallenges) return false;
    if (index === 0) return false;
    const prev = CHALLENGES[index - 1];
    return !completed[prev.key];
  }

  const Active = COMPONENTS[active];
  const activeIndex = CHALLENGES.findIndex((c) => c.key === active);
  const activeLocked = isLocked(activeIndex);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3">
        {CHALLENGES.map((c) => {
          const locked = isLocked(c.index - 1);
          const done = completed[c.key];
          return (
            <button
              key={c.key}
              onClick={() => !locked && setActive(c.key)}
              disabled={locked}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active === c.key
                  ? 'bg-[var(--color-accent)] text-white'
                  : locked
                    ? 'cursor-not-allowed text-[var(--color-text-muted)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <span className="font-mono text-xs opacity-70">{c.index}</span>
              {c.shortLabel}
              {locked && <span>🔒</span>}
              {done && active !== c.key && <span className="text-[var(--color-accent-green)]">✓</span>}
            </button>
          );
        })}
      </div>

      {activeLocked ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
          🔒 Submit the previous challenge to your leaderboard to unlock this one.
        </div>
      ) : (
        <Active state={activeState} onChange={onChange} />
      )}
    </div>
  );
}
