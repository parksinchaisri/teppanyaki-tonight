import { CHALLENGE_BY_KEY } from '../../challenges/definitions';
import type { BatchingMode, SimConfig } from '../../engine/types';
import { ChallengeShell, type ChallengeContentProps } from './ChallengeShell';

// Batching has exactly two possible configurations and the engine is
// deterministic, so re-simulating an unchanged choice can only ever return the
// same number. Both policies are therefore run together in one action and the
// student's decision becomes which realised outcome to submit.
function uniform(mode: BatchingMode): SimConfig['batching'] {
  return { early: mode, peak: mode, late: mode };
}

export function Batching({ state, onChange }: ChallengeContentProps) {
  return (
    <ChallengeShell
      def={CHALLENGE_BY_KEY.batching}
      state={state}
      onChange={onChange}
      compare={{
        buttonLabel: '▶ Compare Both Policies',
        intro:
          'There are only two seating policies to choose from tonight, and the kitchen behaves the same way every time you run them. So rather than guessing one and re-running it, run both at once and compare what actually happens — then decide which one you would stake your evening on.',
        makeOptions: (config) => [
          {
            id: 'batching-eight',
            label: 'Use Batching (Tables of 8)',
            hint: 'Hold guests until a full table forms',
            config: { ...config, batching: uniform('eight') },
          },
          {
            id: 'batching-none',
            label: 'No Batching',
            hint: 'Seat each party as soon as a table opens',
            config: { ...config, batching: uniform('none') },
          },
        ],
      }}
      renderControls={() => null}
    />
  );
}
