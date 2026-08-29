import { useEffect, useMemo, useState } from 'react';
import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import { useApp } from '../../store/appContext';
import { activeChallengeKeys, isChallengeUnlocked } from '../../firebase/types';
import { reflectionGateBlocker } from '../../firebase/liveSession';
import { CHALLENGE_BY_KEY as ALL_CHALLENGES } from '../../challenges/definitions';
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

// 'open'       — the student can work on it
// 'instructor' — live session mode, waiting for the instructor to unlock it
// 'sequence'   — self-paced, previous challenge not submitted yet
// 'reflection' — the previous challenge's reflection is still outstanding
type LockState = 'open' | 'instructor' | 'sequence' | 'reflection';

export function ChallengesTab() {
  const { settings, completed, reflected, params, challengeStates, setChallengeStates } = useApp();

  // The playlist the instructor has configured, in its configured order. A
  // challenge absent from it is not rendered at all.
  const keys = useMemo(() => activeChallengeKeys(settings), [settings]);
  const list = useMemo(() => keys.map((k) => CHALLENGE_BY_KEY[k]).filter(Boolean), [keys]);

  const [active, setActive] = useState(() => list[0]?.key ?? 'batching');

  // The instructor can pull the open challenge out of the playlist mid-class.
  useEffect(() => {
    if (list.length && !keys.includes(active)) setActive(list[0].key);
  }, [keys, list, active]);

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

  function lockStateFor(key: string): LockState {
    // An outstanding reflection outranks every other gate, in both modes — the
    // instructor unlocking the next challenge does not clear it.
    if (reflectionGateBlocker(settings, key, reflected)) return 'reflection';

    // Live session: nothing but the instructor's unlock list matters. Submitting
    // a challenge never opens the next one.
    if (settings.liveSessionMode) return isChallengeUnlocked(settings, key) ? 'open' : 'instructor';

    if (!settings.lockChallenges) return 'open';

    // The Final Challenge needs every *other* active challenge submitted.
    // Challenges the instructor removed from the playlist never block it.
    if (key === 'finalChallenge') {
      return keys.filter((k) => k !== 'finalChallenge').every((k) => completed[k]) ? 'open' : 'sequence';
    }

    const i = list.findIndex((c) => c.key === key);
    if (i <= 0) return 'open';
    return completed[list[i - 1].key] ? 'open' : 'sequence';
  }

  const Active = COMPONENTS[active];
  const activeLock = lockStateFor(active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3">
        {list.map((c) => {
          const lock = lockStateFor(c.key);
          const locked = lock !== 'open';
          // A reflection-gated tab stays selectable so the student can read why
          // it is closed and jump to the reflection — selecting it shows the
          // explanation, never the challenge itself.
          const selectable = !locked || lock === 'reflection';
          const done = completed[c.key];
          return (
            <button
              key={c.key}
              onClick={() => selectable && setActive(c.key)}
              disabled={!selectable}
              title={
                lock === 'instructor'
                  ? 'Waiting for your instructor to unlock this challenge.'
                  : lock === 'reflection'
                    ? 'Finish your reflection to continue.'
                    : undefined
              }
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
              {locked && <span>{lock === 'instructor' ? '⏳' : lock === 'reflection' ? '✍️' : '🔒'}</span>}
              {done && active !== c.key && <span className="text-[var(--color-accent-green)]">✓</span>}
            </button>
          );
        })}
      </div>

      {activeLock === 'reflection' ? (
        <div className="rounded-xl border border-dashed border-[var(--color-accent-amber)]/60 bg-[var(--color-accent-amber)]/5 p-12 text-center text-[var(--color-text-secondary)]">
          <p className="text-[var(--color-accent-amber)]">
            ✍️ Finish your reflection for{' '}
            {ALL_CHALLENGES[reflectionGateBlocker(settings, active, reflected) ?? '']?.title ??
              'the previous challenge'}{' '}
            to continue.
          </p>
          <button
            onClick={() => {
              const blocker = reflectionGateBlocker(settings, active, reflected);
              if (blocker) setActive(blocker);
            }}
            className="mt-4 rounded-md bg-[var(--color-accent-amber)] px-4 py-2 text-sm font-medium text-black"
          >
            Go to that reflection →
          </button>
        </div>
      ) : activeLock === 'instructor' ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
          ⏳ Waiting for instructor — this challenge will open when your instructor unlocks it.
        </div>
      ) : activeLock === 'sequence' ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-secondary)]">
          🔒 Submit the previous challenge to your leaderboard to unlock this one.
        </div>
      ) : (
        <Active state={activeState} onChange={onChange} />
      )}
    </div>
  );
}
